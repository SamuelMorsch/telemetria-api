/**
 * Detecção de quedas de tensão com o motor girando.
 *
 * Regra: uma leitura é "baixa" quando o motor está girando (rpm >= rpmMin) e a tensão
 * está abaixo de voltageMin. Uma sequência de pelo menos `minSamples` leituras baixas
 * consecutivas, sem buraco maior que `maxGapMs` entre elas, vira um evento.
 *
 * Por que exigir o motor girando? Com o motor desligado a bateria fica em ~12,6 V, o
 * que é normal e não indica defeito. Com o motor girando, o alternador deveria manter
 * ~13,8 a 14,8 V.
 *
 * Os limites são PONTOS DE PARTIDA e devem ser calibrados na validação em campo.
 */
export const DEFAULTS = { voltageMin: 13.0, rpmMin: 700, minSamples: 2, maxGapMs: 10_000 };

/** Máximo de leituras carregadas por análise (~14 h a 1 leitura/s), para proteger a memória. */
export const MAX_ANALYSIS_ROWS = 50_000;

const round2 = (n) => Math.round(n * 100) / 100;

/** @param readings leituras ORDENADAS por time (ASC) */
export function detectVoltageDrops(readings, options = {}) {
  const { voltageMin, rpmMin, minSamples, maxGapMs } = { ...DEFAULTS, ...options };
  const events = [];
  let run = [];

  const flush = () => {
    if (run.length >= minSamples) {
      const volts = run.map((p) => p.v);
      events.push({
        kind: 'voltage_drop',
        started_at: new Date(run[0].t).toISOString(),
        ended_at: new Date(run[run.length - 1].t).toISOString(),
        min_value: Math.min(...volts),
        details: {
          samples: run.length,
          duration_ms: run[run.length - 1].t - run[0].t,
          avg_voltage: round2(volts.reduce((a, b) => a + b, 0) / volts.length),
          max_rpm: Math.max(...run.map((p) => p.rpm)),
          threshold_v: voltageMin,
          rpm_min: rpmMin,
        },
      });
    }
    run = [];
  };

  for (const r of readings) {
    const v = r.battery_voltage ?? r.control_module_voltage;
    if (v == null) continue; // leitura sem tensão não diz nada
    const t = new Date(r.time).getTime();
    const low = r.rpm != null && r.rpm >= rpmMin && v < voltageMin;

    if (run.length > 0 && t - run[run.length - 1].t > maxGapMs) flush(); // buraco nos dados
    if (low) run.push({ t, v, rpm: r.rpm });
    else flush();
  }
  flush();
  return events;
}

/** Carrega as leituras da sessão (ordenadas) para análise. */
export async function loadReadingsForAnalysis(pool, sessionId) {
  const { rows } = await pool.query(
    `SELECT time, battery_voltage, control_module_voltage, rpm
       FROM readings
      WHERE session_id = $1
      ORDER BY time ASC
      LIMIT $2`,
    [sessionId, MAX_ANALYSIS_ROWS],
  );
  return rows;
}

/** Recalcula os eventos da sessão e grava (apaga os anteriores: é seguro repetir). */
export async function refreshStoredAnomalies(pool, sessionId, options) {
  const events = detectVoltageDrops(await loadReadingsForAnalysis(pool, sessionId), options);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("DELETE FROM anomaly_events WHERE session_id = $1 AND kind = 'voltage_drop'", [sessionId]);
    for (const e of events) {
      await client.query(
        `INSERT INTO anomaly_events (session_id, kind, started_at, ended_at, min_value, details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [sessionId, e.kind, e.started_at, e.ended_at, e.min_value, JSON.stringify(e.details)],
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return events;
}
