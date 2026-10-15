import { HttpError } from './errors.js';

/** Confirma que a sessão existe E pertence à oficina do token; senão, 404. */
export async function findOwnSession(pool, id, workshopId) {
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
