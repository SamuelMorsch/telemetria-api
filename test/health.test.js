import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakePool, withApp } from '../testing/helpers.js';

test('GET /api/health devolve 200 quando o banco responde', async () => {
  await withApp(fakePool([[/SELECT 1/, { rows: [{ '?column?': 1 }] }]]), async (call) => {
    const res = await call('GET', '/api/health');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { status: 'ok', database: 'up' });
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  });
});

test('GET /api/health devolve 503 quando o banco falha', async () => {
  const pool = fakePool([[/SELECT 1/, () => { throw new Error('conexão recusada'); }]]);
  await withApp(pool, async (call) => {
    const res = await call('GET', '/api/health');
    assert.equal(res.status, 503);
    assert.deepEqual(res.body, { status: 'degraded', database: 'down' });
  });
});

test('rota inexistente devolve 404', async () => {
  await withApp(fakePool(), async (call) => {
    assert.equal((await call('GET', '/api/nao-existe')).status, 404);
  });
});

test('JSON inválido devolve 400, não 500', async () => {
  await withApp(fakePool(), async (call) => {
    const res = await call('POST', '/api/auth/login', { raw: '{quebrado' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'bad_request');
  });
});

test('documentação: /api/openapi.json e /api/docs respondem', async () => {
  await withApp(fakePool(), async (call) => {
    const spec = await call('GET', '/api/openapi.json');
    assert.equal(spec.status, 200);
    assert.equal(spec.body.openapi, '3.0.3');
    assert.ok(spec.body.paths['/api/auth/login']);

    const docs = await call('GET', '/api/docs/');
    assert.equal(docs.status, 200);
    assert.match(docs.text, /swagger/i);
  });
});
