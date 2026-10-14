import { Router } from 'express';
import { HttpError } from '../errors.js';
import { detectVoltageDrops, loadReadingsForAnalysis } from '../anomalies.js';
import { parse, idParam, readingsBatchSchema, readingsQuery, anomalyParams } from '../schemas.js';

const MAX_STREAMS = 50; // limite de painéis ao vivo (máquina pequena)
const HEARTBEAT_MS = 15_000;

export function telemetryRouter({ pool, bus, metrics }) {
  const router = Router();

  // Confirma que a sessão existe E pertence à oficina do token.
  async function ownSession(id, workshopId) {
    const { rows } = await pool.query(
      `SELECT s.id, s.vehicle_id, s.started_at, s.ended_at
         FROM monitoring_sessions s
         JOIN vehicles v ON v.id = s.vehicle_id
        WHERE s.id = $1 AND v.workshop_id = $2`,
      [id, workshopId],
    );
    if (rows.length === 0) throw new HttpError(404, 'session_not_found', 'Sessão não encontrada.');
    return rows[0];
  }

  // Recebe um LOTE de leituras. Reenviar o mesmo lote não duplica nada.
  router.post('/:id/readings', async (req, res) => {
    const id = parse(idParam, req.params.id);
    const { readings } = parse(readingsBatchSchema, req.body);
    await ownSession(id, req.user.workshopId);

    const col = (key) => readings.map((r) => r[key] ?? null);
    const { rows } = await pool.query(
      `INSERT INTO readings (time, session_id, seq, battery_voltage, control_module_voltage, rpm, speed_kmh, coolant_temp_c)
       SELECT t.time, $1::uuid, t.seq, t.bv, t.cmv, t.rpm, t.spd, t.ct
         FROM unnest($2::timestamptz[], $3::int[], $4::real[], $5::real[], $6::int[], $7::int[], $8::int[])
           AS t(time, seq, bv, cmv, rpm, spd, ct)
       ON CONFLICT (session_id, seq, time) DO NOTHING
       RETURNING time, seq`,
      [id, col('time'), col('seq'), col('battery_voltage'), col('control_module_voltage'), col('rpm'), col('speed_kmh'), col('coolant_temp_c')],
    );

    const inserted = rows.length;
    const duplicates = readings.length - inserted;
    metrics.readingsIngested.inc({}, inserted);
    metrics.readingsDuplicate.inc({}, duplicates);

    if (inserted > 0) {
      // Só as leituras realmente novas vão para os painéis ao vivo
      const fresh = new Set(rows.map((r) => `${r.seq}|${new Date(r.time).getTime()}`));
      const news = readings.filter((r) => fresh.has(`${r.seq}|${new Date(r.time).getTime()}`));
      const newest = Math.max(...news.map((r) => new Date(r.time).getTime()));
      metrics.markReading(newest / 1000);
      bus.publish(id, { event: 'readings', data: { readings: news } });
    }

    res.status(inserted > 0 ? 201 : 200).json({ received: readings.length, inserted, duplicates });
  });

  // Histórico: leituras brutas ou resumidas por intervalo (time_bucket do TimescaleDB).
  router.get('/:id/readings', async (req, res) => {
    const id = parse(idParam, req.params.id);
    const q = parse(readingsQuery, req.query);
    await ownSession(id, req.user.workshopId);

    const direction = q.order === 'desc' ? 'DESC' : 'ASC'; // valor fixo (lista branca), nunca texto do usuário
    const filter = `session_id = $1
                AND ($2::timestamptz IS NULL OR time >= $2::timestamptz)
                AND ($3::timestamptz IS NULL OR time <= $3::timestamptz)`;
    const base = [id, q.from ?? null, q.to ?? null];

    if (q.bucket) {
      const { rows } = await pool.query(
        `SELECT time_bucket(make_interval(secs => $4::double precision), time) AS time,
                MIN(battery_voltage) AS voltage_min,
                ROUND(AVG(battery_voltage)::numeric, 2)::float8 AS voltage_avg,
                MAX(battery_voltage) AS voltage_max,
                MAX(rpm) AS rpm_max,
                MAX(speed_kmh) AS speed_max,
                MAX(coolant_temp_c) AS coolant_max,
                COUNT(*)::int AS samples
           FROM readings
          WHERE ${filter}
          GROUP BY 1
          ORDER BY 1 ${direction}
          LIMIT $5`,
        [...base, q.bucket, q.limit],
      );
      return res.json(rows);
    }

    const { rows } = await pool.query(
      `SELECT time, seq, battery_voltage, control_module_voltage, rpm, speed_kmh, coolant_temp_c
         FROM readings
        WHERE ${filter}
        ORDER BY time ${direction}
        LIMIT $4`,
      [...base, q.limit],
    );
    return res.json(rows);
  });

  // Anomalias da sessão, calculadas na hora com os limites pedidos (ajustáveis).
  router.get('/:id/anomalies', async (req, res) => {
    const id = parse(idParam, req.params.id);
    const p = parse(anomalyParams, req.query);
    await ownSession(id, req.user.workshopId);

    const options = { voltageMin: p.voltage_min, rpmMin: p.rpm_min, minSamples: p.min_samples, maxGapMs: p.max_gap_s * 1000 };
    const events = detectVoltageDrops(await loadReadingsForAnalysis(pool, id), options);
    res.json({ parameters: p, events });
  });

  // Transmissão ao vivo (Server-Sent Events). O painel lê com fetch + Authorization.
  router.get('/:id/stream', async (req, res) => {
    const id = parse(idParam, req.params.id);
    await ownSession(id, req.user.workshopId);
    if (bus.count >= MAX_STREAMS) {
      throw new HttpError(503, 'too_many_streams', 'Limite de transmissões ao vivo atingido.');
    }

    res.status(200).set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    res.write('retry: 3000\n\n');

    const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    // "ready" e a assinatura ficam juntos, sem await entre eles: quem recebe "ready" já está inscrito.
    send('ready', { session_id: id });
    const unsubscribe = bus.subscribe(id, (msg) => send(msg.event, msg.data));
    const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });

  return router;
}
