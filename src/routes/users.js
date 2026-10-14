import { Router } from 'express';
import { hashPassword } from '../password.js';
import { parse, createUserSchema } from '../schemas.js';

// Gestão de usuários da oficina: somente administradores.
export function usersRouter({ pool, auth }) {
  const router = Router();
  router.use(auth.requireRole('admin'));

  router.get('/', async (req, res) => {
    const { rows } = await pool.query(
      'SELECT id, email, role, created_at FROM users WHERE workshop_id = $1 ORDER BY created_at',
      [req.user.workshopId],
    );
    res.json(rows);
  });

  router.post('/', async (req, res) => {
    const body = parse(createUserSchema, req.body);
    const passwordHash = await hashPassword(body.password);
    const { rows } = await pool.query(
      `INSERT INTO users (workshop_id, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, workshop_id, email, role, created_at`,
      [req.user.workshopId, body.email, passwordHash, body.role],
    );
    res.status(201).json(rows[0]);
  });

  return router;
}
