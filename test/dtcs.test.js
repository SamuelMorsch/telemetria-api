import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAuth } from '../src/auth.js';
import { LiveBus } from '../src/live.js';
import { fakePool, withApp, testConfig, USER_ID, WORKSHOP_ID, VEHICLE_ID, SESSION_ID } from '../testing/helpers.js';

const tokenFor = (role = 'driver') => createAuth(testConfig).signToken({ id: USER_ID, workshop_id: WORKSHOP_ID, role });
const ownSession = [/FROM monitoring_sessions s\s+JOIN vehicles v/, { rows: [{ id: SESSION_ID, vehicle_id: VEHICLE_ID }] }];
const path = `/api/sessions/${SESSION_ID}/dtcs`;
const T = '2026-10-14T12:00:50Z';

const body = {
  dtcs: [
    { code: 'p0562', status: 'pending', detected_at: T },
    { code: 'P0622', detected_at: T },
  ],
};
const insertedRows = [
  { code: 'P0562', status: 'pending', description: 'Tensão do sistema baixa', detected_at: new Date(T) },
  { code: 'P0622', status: 'stored', description: 'Campo do gerador', detected_at: new Date(T) },
];

test('POST dtcs normaliza o código, usa a descrição do servidor e avisa os painéis', async () => {
  const pool = fakePool([ownSession, [/INSERT INTO dtcs/, { rows: insertedRows }]]);
  const bus = new LiveBus();
  const heard = [];
  bus.subscribe(SESSION_ID, (m) => heard.push(m));

  await withApp(pool, async (call) => {
    const res = await call('POST', path, { token: await tokenFor(), body });
    assert.equal(res.status, 201);
    assert.deepEqual(res.body, { received: 2, inserted: 2, duplicates: 0 });

    const insert = pool.calls.find((c) => /INSERT INTO dtcs/.test(c.sql));
    assert.deepEqual(insert.params[1], ['P0562', 'P0622']);          // maiúsculas
    assert.deepEqual(insert.params[2], ['pending', 'stored']);       // status padrão = stored
    assert.match(insert.params[3][0], /Tensão do sistema baixa/);    // descrição vem do dicionário
    assert.equal(heard[0].event, 'dtcs');
    assert.equal(heard[0].data.dtcs[0].electrical, true);
  }, undefined, { bus });
});

test('reenvio dos mesmos códigos: 200 e ninguém é avisado de novo', async () => {
  const pool = fakePool([ownSession, [/INSERT INTO dtcs/, { rows: [] }]]);
  const bus = new LiveBus();
  const heard = [];
  bus.subscribe(SESSION_ID, (m) => heard.push(m));
  await withApp(pool, async (call) => {
    const res = await call('POST', path, { token: await tokenFor(), body });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { received: 2, inserted: 0, duplicates: 2 });
    assert.equal(heard.length, 0);
  }, undefined, { bus });
});

test('validação: lista vazia, código inválido, status inválido e data inválida', async () => {
  await withApp(fakePool([ownSession]), async (call) => {
    const token = await tokenFor();
    const post = (dtcs) => call('POST', path, { token, body: { dtcs } });
    assert.equal((await post([])).status, 400);
    assert.equal((await post([{ code: 'XYZ', detected_at: T }])).status, 400);
    assert.equal((await post([{ code: 'P0562', status: 'qualquer', detected_at: T }])).status, 400);
    assert.equal((await post([{ code: 'P0562', detected_at: 'ontem' }])).status, 400);
    assert.equal((await post(Array.from({ length: 51 }, () => ({ code: 'P0562', detected_at: T })))).status, 400);
  });
});

test('sessão de outra oficina: 404 e nada é gravado', async () => {
  const pool = fakePool([[/FROM monitoring_sessions s\s+JOIN vehicles v/, { rows: [] }]]);
  await withApp(pool, async (call) => {
    const res = await call('POST', path, { token: await tokenFor(), body });
    assert.equal(res.status, 404);
    assert.ok(!pool.calls.some((c) => /INSERT INTO dtcs/.test(c.sql)));
  });
});

test('GET dtcs devolve os códigos com descrição, tipo e marca de sistema elétrico', async () => {
  const pool = fakePool([
    ownSession,
    [/FROM dtcs/, { rows: [
      { code: 'P0562', status: 'stored', description: 'Tensão do sistema baixa', detected_at: new Date(T) },
      { code: 'P0300', status: 'pending', description: null, detected_at: new Date(T) },
    ] }],
  ]);
  await withApp(pool, async (call) => {
    const res = await call('GET', path, { token: await tokenFor() });
    assert.equal(res.status, 200);
    assert.equal(res.body[0].electrical, true);
    assert.equal(res.body[1].electrical, false);
    assert.match(res.body[1].description, /Falhas de combustão/); // sem descrição no banco: usa o dicionário
    assert.equal(res.body[1].scope, 'generic');
  });
});

test('dtcs exige login', async () => {
  await withApp(fakePool(), async (call) => {
    assert.equal((await call('GET', path)).status, 401);
    assert.equal((await call('POST', path, { body })).status, 401);
  });
});
