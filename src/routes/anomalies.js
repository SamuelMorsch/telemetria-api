import { Router } from 'express';
import { parse, listAnomaliesQuery } from '../schemas.js';

// Eventos de anomalia já gravados (gerados ao encerrar cada sessão), de toda a oficina.
export function anomaliesRouter({ pool }) {
  const router = Router();

  router.get('/', async (req, res) => {
    const q = parse(listAnomaliesQuery, req.query);
    const { rows } = await pool.query(
      `SELECT a.id, a.session_id, s.vehicle_id, v.plate, a.kind,
              a.started_at, a.ended_at, a.min_value, a.details
         FROM anomaly_events a
         JOIN monitoring_sessions s ON s.id = a.session_id
         JOIN vehicles v ON v.id = s.vehicle_id
        WHERE v.workshop_id = $1 AND ($2::uuid IS NULL OR s.vehicle_id = $2::uuid)
        ORDER BY a.started_at DESC
        LIMIT $3 OFFSET $4`,
      [req.user.workshopId, q.vehicle_id ?? null, q.limit, q.offset],
    );
    res.json(rows);
  });

  return router;
}
