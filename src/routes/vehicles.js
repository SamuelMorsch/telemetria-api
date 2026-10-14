import { Router } from 'express';
import { HttpError } from '../errors.js';
import { parse, idParam, createVehicleSchema } from '../schemas.js';

const COLUMNS = 'id, plate, model, owner_name, created_at';

// Todo acesso é filtrado por workshop_id (vem do token): uma oficina nunca vê dados de outra.
export function vehiclesRouter({ pool, auth }) {
  const router = Router();

  router.get('/', async (req, res) => {
    const { rows } = await pool.query(
      `SELECT ${COLUMNS} FROM vehicles WHERE workshop_id = $1 ORDER BY created_at DESC`,
      [req.user.workshopId],
    );
    res.json(rows);
  });

  router.post('/', auth.requireRole('admin', 'mechanic'), async (req, res) => {
    const body = parse(createVehicleSchema, req.body);
    const { rows } = await pool.query(
      `INSERT INTO vehicles (workshop_id, plate, model, owner_name)
       VALUES ($1, $2, $3, $4)
       RETURNING ${COLUMNS}`,
      [req.user.workshopId, body.plate, body.model ?? null, body.owner_name ?? null],
    );
    res.status(201).json(rows[0]);
  });

  router.get('/:id', async (req, res) => {
    const id = parse(idParam, req.params.id);
    const { rows } = await pool.query(
      `SELECT ${COLUMNS} FROM vehicles WHERE id = $1 AND workshop_id = $2`,
      [id, req.user.workshopId],
    );
    if (rows.length === 0) throw new HttpError(404, 'vehicle_not_found', 'Veículo não encontrado.');
    res.json(rows[0]);
  });

  return router;
}
