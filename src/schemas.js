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

// ---- Telemetria ----
const metric = (min, max) => z.number().min(min).max(max).nullable().optional();
const intMetric = (min, max) => z.number().int().min(min).max(max).nullable().optional();

const readingSchema = z.object({
  seq: z.number().int().min(0).max(2_000_000_000),
  time: timestamp,
  battery_voltage: metric(0, 40),
  control_module_voltage: metric(0, 40),
  rpm: intMetric(0, 20000),
  speed_kmh: intMetric(0, 400),
  coolant_temp_c: intMetric(-60, 300),
});

export const readingsBatchSchema = z.object({
  readings: z.array(readingSchema).min(1).max(500),
});

export const readingsQuery = z.object({
  from: timestamp.optional(),
  to: timestamp.optional(),
  limit: z.coerce.number().int().min(1).max(5000).default(1000),
  order: z.enum(['asc', 'desc']).default('asc'),
  bucket: z.coerce.number().int().min(1).max(3600).optional(),
});

export const anomalyParams = z.object({
  voltage_min: z.coerce.number().min(5).max(20).default(13),
  rpm_min: z.coerce.number().int().min(0).max(10000).default(700),
  min_samples: z.coerce.number().int().min(1).max(100).default(2),
  max_gap_s: z.coerce.number().min(1).max(300).default(10),
});

export const listAnomaliesQuery = z.object({
  vehicle_id: uuid.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// ---- Códigos de falha (DTC) ----
const dtcCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[PCBU][0-3][0-9A-F]{3}$/, 'código de falha inválido (ex.: P0562)');

export const dtcBatchSchema = z.object({
  dtcs: z
    .array(
      z.object({
        code: dtcCode,
        status: z.enum(['stored', 'pending', 'permanent']).default('stored'),
        detected_at: timestamp,
      }),
    )
    .min(1)
    .max(50),
});
