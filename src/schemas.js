import { z } from 'zod';
import { HttpError } from './errors.js';

/** Valida `data` com o schema; em caso de erro, lança 400 com a lista de campos inválidos. */
export function parse(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new HttpError(
      400,
      'validation_error',
      'Dados inválidos.',
      result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    );
  }
  return result.data;
}

const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(8, 'mínimo de 8 caracteres').max(128);
const uuid = z.string().uuid();
const timestamp = z.string().datetime({ offset: true });

// Placa: maiúscula e sem espaço/hífen (aceita ABC-1D23, abc 1234 etc.)
const plate = z
  .string()
  .trim()
  .transform((s) => s.toUpperCase().replace(/[\s-]/g, ''))
  .pipe(z.string().regex(/^[A-Z0-9]{5,8}$/, 'placa inválida'));

export const idParam = uuid;

export const registerSchema = z.object({
  workshop_name: z.string().trim().min(2).max(120),
  email,
  password,
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(128),
});

export const createUserSchema = z.object({
  email,
  password,
  role: z.enum(['admin', 'mechanic', 'driver']),
});

export const createVehicleSchema = z.object({
  plate,
  model: z.string().trim().max(80).optional(),
  owner_name: z.string().trim().max(120).optional(),
});

export const createSessionSchema = z.object({
  id: uuid,
  vehicle_id: uuid,
  started_at: timestamp,
  source: z.enum(['obd', 'simulator']).default('obd'),
  app_version: z.string().trim().max(40).optional(),
});

export const endSessionSchema = z.object({
  ended_at: timestamp.optional(),
});

export const listSessionsQuery = z.object({
  vehicle_id: uuid.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
