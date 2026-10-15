import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAuth } from '../src/auth.js';
import { LiveBus } from '../src/live.js';
import { fakePool, withApp, testConfig, USER_ID, WORKSHOP_ID, VEHICLE_ID, SESSION_ID } from '../testing/helpers.js';

const tokenFor = (role = 'driver') => createAuth(testConfig).signToken({ id: USER_ID, workshop_id: WORKSHOP_ID, role });
const session = {
  id: SESSION_ID, vehicle_id: VEHICLE_ID, started_at: '2026-10-14T12:00:00.000Z',
  ended_at: null, source: 'obd', app_version: '2.0.0', created_at: '2026-10-14T12:00:01Z',
};
const body = { id: SESSION_ID, vehicle_id: VEHICLE_ID, started_at: '2026-10-14T12:00:00Z', app_version: '2.0.0' };

const vehicleFound = [/SELECT id FROM vehicles/, { rows: [{ id: VEHICLE_ID }] }];

test('abre sessão nova: 201', async () => {
  const pool = fakePool([vehicleFound, [/INSERT INTO monitoring_sessions/, { rows: [session] }]]);
  await withApp(pool, async (call) => {
    const res = await call('POST', '/api/sessions', { token: await tokenFor(), body });
    assert.equal(res.status, 201);
    const insert = pool.calls.find((c) => /INSERT INTO monitoring_sessions/.test(c.sql));
    assert.equal(insert.params[3], 'obd'); // source padrão
  });
});

test('reenvio do mesmo id e veículo é idempotente: 200 com a sessão existente', async () => {
  const pool = fakePool([
    vehicleFound,
    [/INSERT INTO monitoring_sessions/, { rows: [] }],            // ON CONFLICT DO NOTHING
    [/FROM monitoring_sessions WHERE id/, { rows: [session] }],
  ]);
  await withApp(pool, async (call) => {
    const res = await call('POST', '/api/sessions', { token: await tokenFor(), body });
    assert.equal(res.status, 200);
    assert.equal(res.body.id, SESSION_ID);
  });
});

test('id já usado por sessão de outro veículo: 409', async () => {
  const pool = fakePool([
    vehicleFound,
    [/INSERT INTO monitoring_sessions/, { rows: [] }],
    [/FROM monitoring_sessions WHERE id/, { rows: [] }],
  ]);
  await withApp(pool, async (call) => {
    const res = await call('POST', '/api/sessions', { token: await tokenFor(), body });
    assert.equal(res.status, 409);
  });
});

test('veículo de outra oficina: 404, e nada é inserido', async () => {
  const pool = fakePool([[/SELECT id FROM vehicles/, { rows: [] }]]);
  await withApp(pool, async (call) => {
    const res = await call('POST', '/api/sessions', { token: await tokenFor(), body });
    assert.equal(res.status, 404);
    assert.ok(!pool.calls.some((c) => /INSERT/.test(c.sql)));
  });
});

test('validação: data inválida e id que não é UUID viram 400', async () => {
  await withApp(fakePool(), async (call) => {
    const token = await tokenFor();
    assert.equal((await call('POST', '/api/sessions', { token, body: { ...body, started_at: 'ontem' } })).status, 400);
    assert.equal((await call('POST', '/api/sessions', { token, body: { ...body, id: '123' } })).status, 400);
  });
});

test('lista sessões filtrando pela oficina e por veículo, com paginação', async () => {
  const pool = fakePool([[/FROM monitoring_sessions s/, { rows: [session] }]]);
  await withApp(pool, async (call) => {
    const res = await call('GET', `/api/sessions?vehicle_id=${VEHICLE_ID}&limit=10&offset=5`, { token: await tokenFor() });
    assert.equal(res.status, 200);
    assert.deepEqual(pool.calls[0].params, [WORKSHOP_ID, VEHICLE_ID, 10, 5]);
  });
});

test('limite acima de 200 é recusado', async () => {
  await withApp(fakePool(), async (call) => {
    const res = await call('GET', '/api/sessions?limit=9999', { token: await tokenFor() });
    assert.equal(res.status, 400);
  });
});

test('encerra a sessão: analisa as leituras, grava a anomalia e devolve a contagem; 404 se não for da oficina', async () => {
  const t = (sec) => new Date(Date.parse('2026-10-14T12:00:00Z') + sec * 1000);
  const readings = [
    { time: t(0), battery_voltage: 14.2, control_module_voltage: null, rpm: 2500 },
    { time: t(1), battery_voltage: 11.5, control_module_voltage: null, rpm: 4000 },
    { time: t(2), battery_voltage: 11.4, control_module_voltage: null, rpm: 4000 },
    { time: t(3), battery_voltage: 14.2, control_module_voltage: null, rpm: 2500 },
  ];
  const pool = fakePool([
    [/UPDATE monitoring_sessions/, (params) =>
      params[0] === SESSION_ID ? { rows: [{ ...session, ended_at: '2026-10-14T13:00:00Z' }] } : { rows: [] }],
    [/FROM readings/, { rows: readings }],
    [/DELETE FROM anomaly_events/, { rows: [] }],
    [/INSERT INTO anomaly_events/, { rows: [] }],
  ]);
  const bus = new LiveBus();
  const heard = [];
  bus.subscribe(SESSION_ID, (m) => heard.push(m));

  await withApp(pool, async (call) => {
    const token = await tokenFor();
    const ok = await call('PATCH', `/api/sessions/${SESSION_ID}/end`, { token, body: { ended_at: '2026-10-14T13:00:00Z' } });
    assert.equal(ok.status, 200);
    assert.ok(ok.body.ended_at);
    assert.equal(ok.body.anomalies_detected, 1);
    assert.ok(pool.calls.some((c) => /INSERT INTO anomaly_events/.test(c.sql)));
    assert.equal(heard.at(-1).event, 'ended'); // os painéis ao vivo são avisados

    const missing = await call('PATCH', '/api/sessions/55555555-5555-4555-8555-555555555555/end', { token });
    assert.equal(missing.status, 404);
  }, undefined, { bus });
});

test('listagem e detalhe trazem o instante da última leitura (para distinguir "ao vivo" de "sem sinal")', async () => {
  const pool = fakePool([[/FROM monitoring_sessions s/, { rows: [{ ...session, last_reading_at: '2026-10-14T12:00:09Z' }] }]]);
  await withApp(pool, async (call) => {
    const token = await tokenFor();
    const list = await call('GET', '/api/sessions', { token });
    assert.equal(list.body[0].last_reading_at, '2026-10-14T12:00:09Z');
    const one = await call('GET', `/api/sessions/${SESSION_ID}`, { token });
    assert.equal(one.status, 200);
    for (const c of pool.calls) assert.match(c.sql, /last_reading_at/);
  });
});
