import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

// Sobe a API numa porta livre, roda o teste e derruba o servidor.
async function withServer(pool, fn) {
  const server = createApp({ pool }).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base);
  } finally {
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    });
  }
}

test('GET /api/health devolve 200 quando o banco responde', async () => {
  const pool = { query: async () => ({ rows: [{ '?column?': 1 }] }) };
  await withServer(pool, async (base) => {
    const res = await fetch(`${base}/api/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: 'ok', database: 'up' });
  });
});

test('GET /api/health devolve 503 quando o banco falha', async () => {
  const pool = { query: async () => { throw new Error('conexão recusada'); } };
  await withServer(pool, async (base) => {
    const res = await fetch(`${base}/api/health`);
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { status: 'degraded', database: 'down' });
  });
});

test('rota inexistente devolve 404', async () => {
  await withServer({ query: async () => ({ rows: [] }) }, async (base) => {
    const res = await fetch(`${base}/api/nao-existe`);
    assert.equal(res.status, 404);
  });
});

test('JSON inválido devolve 400, não 500', async () => {
  await withServer({ query: async () => ({ rows: [] }) }, async (base) => {
    const res = await fetch(`${base}/api/health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{quebrado',
    });
    assert.equal(res.status, 400);
  });
});
