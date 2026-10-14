import { Router } from 'express';
import { HttpError } from '../errors.js';
import { refreshStoredAnomalies } from '../anomalies.js';
import { parse, idParam, createSessionSchema, endSessionSchema, listSessionsQuery } from '../schemas.js';

const COLUMNS = 'id, vehicle_id, started_at, ended_at, source, app_version, created_at';
const COLUMNS_S = 's.id, s.vehicle_id, s.started_at, s.ended_at, s.source, s.app_version, s.created_at';

// Sessão = um trajeto monitorado. O app gera o UUID, então repetir o POST é seguro.
export function sessionsRouter({ pool, bus, metrics }) {
  const router = Router();

  router.post('/', async (req, res) => {
    const body = parse(createSessionSchema, req.body);
    const { workshopId } = req.user;

    const vehicle = await pool.query('SELECT id FROM vehicles WHERE id = $1 AND workshop_id = $2', [
      body.vehicle_id,
      workshopId,
    ]);
    if (vehicle.rows.length === 0) {
      throw new HttpError(404, 'vehicle_not_found', 'Veículo não encontrado.');
    }

    const inserted = await pool.query(
      `INSERT INTO monitoring_sessions (id, vehicle_id, started_at, source, app_version)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO NOTHING
       RETURNING ${COLUMNS}`,
      [body.id, body.vehicle_id, body.started_at, body.source, body.app_version ?? null],
    );
    if (inserted.rows.length === 1) return res.status(201).json(inserted.rows[0]);

    // Já existia: se é a mesma sessão do mesmo veículo, devolve (reenvio do app); senão, conflito.
    const existing = await pool.query(
      `SELECT ${COLUMNS} FROM monitoring_sessions WHERE id = $1 AND vehicle_id = $2`,
      [body.id, body.vehicle_id],
    );
    if (existing.rows.length === 1) return res.status(200).json(existing.rows[0]);
    throw new HttpError(409, 'conflict', 'Já existe uma sessão com esse id.');
  });

  router.get('/', async (req, res) => {
    const q = parse(listSessionsQuery, req.query);
    const { rows } = await pool.query(
      `SELECT ${COLUMNS_S}
         FROM monitoring_sessions s
         JOIN vehicles v ON v.id = s.vehicle_id
        WHERE v.workshop_id = $1 AND ($2::uuid IS NULL OR s.vehicle_id = $2::uuid)
        ORDER BY s.started_at DESC
        LIMIT $3 OFFSET $4`,
      [req.user.workshopId, q.vehicle_id ?? null, q.limit, q.offset],
    );
    res.json(rows);
  });

  router.get('/:id', async (req, res) => {
    const id = parse(idParam, req.params.id);
    const { rows } = await pool.query(
      `SELECT ${COLUMNS_S}
         FROM monitoring_sessions s
         JOIN vehicles v ON v.id = s.vehicle_id
        WHERE s.id = $1 AND v.workshop_id = $2`,
      [id, req.user.workshopId],
    );
    if (rows.length === 0) throw new HttpError(404, 'session_not_found', 'Sessão não encontrada.');
    res.json(rows[0]);
  });

  // Encerra a sessão (o app chama ao desconectar). Sem ended_at, usa a hora do servidor.
  router.patch('/:id/end', async (req, res) => {
    const id = parse(idParam, req.params.id);
    const { ended_at: endedAt } = parse(endSessionSchema, req.body ?? {});
    const { rows } = await pool.query(
      `UPDATE monitoring_sessions AS s
          SET ended_at = COALESCE($3::timestamptz, now())
         FROM vehicles AS v
        WHERE s.id = $1 AND v.id = s.vehicle_id AND v.workshop_id = $2
       RETURNING ${COLUMNS_S}`,
      [id, req.user.workshopId, endedAt ?? null],
    );
    if (rows.length === 0) throw new HttpError(404, 'session_not_found', 'Sessão não encontrada.');

    // Ao encerrar, procura quedas de tensão e grava os eventos. Se a análise falhar,
    // a sessão continua encerrada (a análise pode ser refeita depois).
    let anomalies = 0;
    try {
      anomalies = (await refreshStoredAnomalies(pool, id)).length;
      metrics.anomaliesStored.inc({}, anomalies);
    } catch (err) {
      console.error('falha ao analisar a sessão', id, err);
    }
    bus.publish(id, { event: 'ended', data: { ended_at: rows[0].ended_at, anomalies_detected: anomalies } });
    res.json({ ...rows[0], anomalies_detected: anomalies });
  });

  return router;
}
