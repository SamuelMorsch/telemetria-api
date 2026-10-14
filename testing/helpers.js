import { createApp } from '../src/app.js';

export const testConfig = {
  jwtSecret: 'segredo-de-teste-com-mais-de-32-caracteres',
  jwtExpiresIn: '1h',
  corsOrigins: [],
  registrationEnabled: true,
};

export const WORKSHOP_ID = '11111111-1111-4111-8111-111111111111';
export const USER_ID = '22222222-2222-4222-8222-222222222222';
export const VEHICLE_ID = '33333333-3333-4333-8333-333333333333';
export const SESSION_ID = '44444444-4444-4444-8444-444444444444';

/**
 * Banco falso. `routes` é uma lista de [regex, resposta]; a primeira regex que casa
 * com o SQL decide a resposta (objeto { rows } ou função (params) => { rows }).
 * Se a função lançar erro, o erro sobe como se fosse do banco.
 */
export function fakePool(routes = []) {
  const calls = [];
  async function query(sql, params = []) {
    const text = String(sql).trim();
    calls.push({ sql: text, params });
    if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(text)) return { rows: [] };
    for (const [pattern, handler] of routes) {
      if (pattern.test(text)) {
        const out = typeof handler === 'function' ? handler(params, text) : handler;
        return out ?? { rows: [] };
      }
    }
    throw new Error(`SQL não previsto no teste: ${text.slice(0, 80)}`);
  }
  return { calls, query, connect: async () => ({ query, release() {} }) };
}

/** Sobe a API numa porta livre e entrega a `call(method, path, { token, body })` ao teste. */
export async function withApp(pool, fn, config = testConfig, extras = {}) {
  const server = createApp({ pool, config, ...extras }).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  const call = async (method, path, { token, body, raw } = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: {
        ...(body || raw ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: raw ?? (body ? JSON.stringify(body) : undefined),
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* resposta não é JSON (ex.: página HTML) */ }
    return { status: res.status, body: json, text, headers: res.headers };
  };

  try {
    await fn(call, { base });
  } finally {
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    });
  }
}
