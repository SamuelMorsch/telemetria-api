import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAuth } from '../src/auth.js';
import { fakePool, withApp, testConfig, USER_ID, WORKSHOP_ID, VEHICLE_ID } from '../testing/helpers.js';

const tokenFor = (role) => createAuth(testConfig).signToken({ id: USER_ID, workshop_id: WORKSHOP_ID, role });
const vehicle = { id: VEHICLE_ID, plate: 'ABC1D23', model: 'Fiat Uno', owner_name: null, created_at: '2026-10-14T00:00:00Z' };

test('lista só os veículos da oficina do token', async () => {
  const pool = fakePool([[/FROM vehicles WHERE workshop_id/, { rows: [vehicle] }]]);
  await withApp(pool, async (call) => {
    const res = await call('GET', '/api/vehicles', { token: await tokenFor('driver') });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, [vehicle]);
    assert.equal(pool.calls[0].params[0], WORKSHOP_ID);
  });
});

test('cadastra veículo normalizando a placa; motorista não pode', async () => {
  const pool = fakePool([[/INSERT INTO vehicles/, { rows: [vehicle] }]]);
  await withApp(pool, async (call) => {
    const denied = await call('POST', '/api/vehicles', { token: await tokenFor('driver'), body: { plate: 'ABC1D23' } });
    assert.equal(denied.status, 403);

    const ok = await call('POST', '/api/vehicles', {
      token: await tokenFor('mechanic'),
      body: { plate: ' abc-1d23 ', model: 'Fiat Uno' },
    });
    assert.equal(ok.status, 201);
    const insert = pool.calls.find((c) => /INSERT INTO vehicles/.test(c.sql));
    assert.equal(insert.params[1], 'ABC1D23');
  });
});

test('placa inválida devolve 400', async () => {
  await withApp(fakePool(), async (call) => {
    const res = await call('POST', '/api/vehicles', { token: await tokenFor('admin'), body: { plate: '!!' } });
    assert.equal(res.status, 400);
  });
});

test('placa repetida na oficina devolve 409', async () => {
  const pool = fakePool([[/INSERT INTO vehicles/, () => { throw Object.assign(new Error('dup'), { code: '23505' }); }]]);
  await withApp(pool, async (call) => {
    const res = await call('POST', '/api/vehicles', { token: await tokenFor('admin'), body: { plate: 'ABC1D23' } });
    assert.equal(res.status, 409);
  });
});

test('GET /api/vehicles/:id: 200, 404 e 400 para id malformado', async () => {
  const pool = fakePool([
    [/FROM vehicles WHERE id/, (params) => (params[0] === VEHICLE_ID ? { rows: [vehicle] } : { rows: [] })],
  ]);
  await withApp(pool, async (call) => {
    const token = await tokenFor('driver');
    assert.equal((await call('GET', `/api/vehicles/${VEHICLE_ID}`, { token })).status, 200);
    assert.equal((await call('GET', '/api/vehicles/55555555-5555-4555-8555-555555555555', { token })).status, 404);
    assert.equal((await call('GET', '/api/vehicles/nao-e-uuid', { token })).status, 400);
  });
});
