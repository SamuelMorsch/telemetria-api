import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { HttpError } from '../errors.js';
import { hashPassword, verifyPassword } from '../password.js';
import { parse, registerSchema, loginSchema } from '../schemas.js';

// Hash "isca": quando o e-mail não existe, ainda gastamos o mesmo tempo de CPU,
// para que o tempo de resposta não revele quais e-mails estão cadastrados.
let dummyHash;

export function authRouter({ pool, auth, config }) {
  const router = Router();

  // Cadastra uma oficina e o seu primeiro usuário (admin)
  router.post('/register', async (req, res) => {
    if (!config.registrationEnabled) {
      throw new HttpError(403, 'registration_disabled', 'Cadastro de oficinas desativado.');
    }
    const body = parse(registerSchema, req.body);
    const passwordHash = await hashPassword(body.password);

    let user;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const workshop = await client.query('INSERT INTO workshops (name) VALUES ($1) RETURNING id', [
        body.workshop_name,
      ]);
      const created = await client.query(
        `INSERT INTO users (workshop_id, email, password_hash, role)
         VALUES ($1, $2, $3, 'admin')
         RETURNING id, workshop_id, email, role, created_at`,
        [workshop.rows[0].id, body.email, passwordHash],
      );
      await client.query('COMMIT');
      user = created.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err; // e-mail repetido (23505) vira 409 no tratador de erros
    } finally {
      client.release();
    }

    res.status(201).json({ token: await auth.signToken(user), user });
  });

  router.post('/login', async (req, res) => {
    const { email, password } = parse(loginSchema, req.body);
    const { rows } = await pool.query(
      'SELECT id, workshop_id, email, role, password_hash, created_at FROM users WHERE email = $1',
      [email],
    );
    const row = rows[0];

    dummyHash ??= await hashPassword(randomBytes(16).toString('hex'));
    const valid = await verifyPassword(password, row ? row.password_hash : dummyHash);
    if (!row || !valid) {
      throw new HttpError(401, 'invalid_credentials', 'E-mail ou senha inválidos.');
    }

    const { password_hash: _omit, ...user } = row;
    res.json({ token: await auth.signToken(user), user });
  });

  router.get('/me', auth.requireAuth, async (req, res) => {
    const { rows } = await pool.query(
      'SELECT id, workshop_id, email, role, created_at FROM users WHERE id = $1 AND workshop_id = $2',
      [req.user.id, req.user.workshopId],
    );
    if (rows.length === 0) throw new HttpError(401, 'unauthorized', 'Usuário não existe mais.');
    res.json({ user: rows[0] });
  });

  return router;
}
