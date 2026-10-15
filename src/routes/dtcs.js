import { Router } from 'express';
import { describeDtc } from '../dtc.js';
import { findOwnSession } from '../session-access.js';
import { parse, idParam, dtcBatchSchema } from '../schemas.js';

/** Como o código sai da API: com a explicação, o tipo e se é ligado ao sistema elétrico. */
function toView(row) {
  const info = describeDtc(row.code);
  return {
    code: row.code,
    status: row.status,
    detected_at: row.detected_at,
    description: row.description ?? info.description,
    electrical: info.electrical,
    scope: info.scope,
  };
}

export function dtcsRouter({ pool, bus, metrics }) {
  const router = Router();

  // Recebe códigos de falha lidos pelo app. Reenviar o mesmo código não duplica.
  router.post('/:id/dtcs', async (req, res) => {
    const id = parse(idParam, req.params.id);
    const { dtcs } = parse(dtcBatchSchema, req.body);
    await findOwnSession(pool, id, req.user.workshopId);

    // A descrição vem do dicionário do servidor, para ser a mesma para todos os celulares.
    const { rows } = await pool.query(
      `INSERT INTO dtcs (session_id, code, status, description, detected_at)
       SELECT $1::uuid, t.code, t.status, t.description, t.detected_at
         FROM unnest($2::text[], $3::text[], $4::text[], $5::timestamptz[])
           AS t(code, status, description, detected_at)
       ON CONFLICT (session_id, code, status) DO NOTHING
       RETURNING code, status, description, detected_at`,
      [
        id,
        dtcs.map((d) => d.code),
        dtcs.map((d) => d.status),
        dtcs.map((d) => describeDtc(d.code).description),
        dtcs.map((d) => d.detected_at),
      ],
    );

    const inserted = rows.length;
    metrics.dtcsIngested.inc({}, inserted);
    if (inserted > 0) bus.publish(id, { event: 'dtcs', data: { dtcs: rows.map(toView) } });

    res.status(inserted > 0 ? 201 : 200).json({
      received: dtcs.length,
      inserted,
      duplicates: dtcs.length - inserted,
    });
  });

  router.get('/:id/dtcs', async (req, res) => {
    const id = parse(idParam, req.params.id);
    await findOwnSession(pool, id, req.user.workshopId);
    const { rows } = await pool.query(
      `SELECT code, status, description, detected_at
         FROM dtcs
        WHERE session_id = $1
        ORDER BY detected_at ASC, code ASC`,
      [id],
    );
    res.json(rows.map(toView));
  });

  return router;
}
