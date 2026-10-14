import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAuth } from '../src/auth.js';
import { LiveBus } from '../src/live.js';
import { fakePool, withApp, testConfig, USER_ID, WORKSHOP_ID, VEHICLE_ID, SESSION_ID } from '../testing/helpers.js';

const tokenFor = (role = 'driver') => createAuth(testConfig).signToken({ id: USER_ID, workshop_id: WORKSHOP_ID, role });
const ownSession = [/FROM monitoring_sessions s\s+JOIN vehicles v/, { rows: [{ id: SESSION_ID, vehicle_id: VEHICLE_ID }] }];
const path = (suffix = '') => `/api/sessions/${SESSION_ID}${suffix}`;

const batch = {
  readings: [
    { seq: 0, time: '2026-10-14T12:00:00Z', battery_voltage: 14.2, rpm: 2500, speed_kmh: 62, coolant_temp_c: 90 },
    { seq: 1, time: '2026-10-14T12:00:01Z', battery_voltage: 11.5, rpm: 4000 },
  ],
};
const insertedRows = [
  { time: new Date('2026-10-14T12:00:00Z'), seq: 0 },
  { time: new Date('2026-10-14T12:00:01Z'), seq: 1 },
];

test('POST readings grava o lote em uma consulta só, devolve a contagem e avisa os painéis', async () => {
  const pool = fakePool([ownSession, [/INSERT INTO readings/, { rows: insertedRows }]]);
  const bus = new LiveBus();
  const heard = [];
  bus.subscribe(SESSION_ID, (m) => heard.push(m));

  await withApp(pool, async (call) => {
    const res = await call('POST', path('/readings'), { token: await tokenFor(), body: batch });
    assert.equal(res.status, 201);
    assert.deepEqual(res.body, { received: 2, inserted: 2, duplicates: 0 });

    const insert = pool.calls.find((c) => /INSERT INTO readings/.test(c.sql));
    assert.equal(insert.params[0], SESSION_ID);
    assert.deepEqual(insert.params[3], [14.2, 11.5]);       // battery_voltage
    assert.deepEqual(insert.params[5], [2500, 4000]);       // rpm
    assert.deepEqual(insert.params[6], [62, null]);         // campo ausente vira null
    assert.equal(heard.length, 1);
    assert.equal(heard[0].event, 'readings');
    assert.equal(heard[0].data.readings.length, 2);
  }, undefined, { bus });
});

test('reenvio do mesmo lote: 200, zero inseridos e ninguém é avisado de novo', async () => {
  const pool = fakePool([ownSession, [/INSERT INTO readings/, { rows: [] }]]);
  const bus = new LiveBus();
  const heard = [];
  bus.subscribe(SESSION_ID, (m) => heard.push(m));
  await withApp(pool, async (call) => {
    const res = await call('POST', path('/readings'), { token: await tokenFor(), body: batch });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { received: 2, inserted: 0, duplicates: 2 });
    assert.equal(heard.length, 0);
  }, undefined, { bus });
});

test('só as leituras novas de um lote parcialmente repetido vão ao vivo', async () => {
  const pool = fakePool([ownSession, [/INSERT INTO readings/, { rows: [insertedRows[1]] }]]);
  const bus = new LiveBus();
  const heard = [];
  bus.subscribe(SESSION_ID, (m) => heard.push(m));
  await withApp(pool, async (call) => {
    const res = await call('POST', path('/readings'), { token: await tokenFor(), body: batch });
    assert.deepEqual(res.body, { received: 2, inserted: 1, duplicates: 1 });
    assert.deepEqual(heard[0].data.readings.map((r) => r.seq), [1]);
  }, undefined, { bus });
});

test('validação do lote: vazio, grande demais, tensão absurda, data inválida e seq negativo', async () => {
  await withApp(fakePool([ownSession]), async (call) => {
    const token = await tokenFor();
    const post = (body) => call('POST', path('/readings'), { token, body });
    const ok = batch.readings[0];

    assert.equal((await post({ readings: [] })).status, 400);
    assert.equal((await post({ readings: Array.from({ length: 501 }, (_, i) => ({ ...ok, seq: i })) })).status, 400);
    assert.equal((await post({ readings: [{ ...ok, battery_voltage: 99 }] })).status, 400);
    assert.equal((await post({ readings: [{ ...ok, time: 'ontem' }] })).status, 400);
    assert.equal((await post({ readings: [{ ...ok, seq: -1 }] })).status, 400);
    assert.equal((await post({})).status, 400);
  });
});

test('sessão de outra oficina: 404 e nada é gravado', async () => {
  const pool = fakePool([[/FROM monitoring_sessions s\s+JOIN vehicles v/, { rows: [] }]]);
  await withApp(pool, async (call) => {
    const res = await call('POST', path('/readings'), { token: await tokenFor(), body: batch });
    assert.equal(res.status, 404);
    assert.ok(!pool.calls.some((c) => /INSERT INTO readings/.test(c.sql)));
  });
});

test('GET readings bruto: filtra por sessão e período e respeita limit/order', async () => {
  const pool = fakePool([ownSession, [/FROM readings\s+WHERE/, { rows: [{ seq: 1 }] }]]);
  await withApp(pool, async (call) => {
    const res = await call('GET', path('/readings?from=2026-10-14T12:00:00Z&limit=10&order=desc'), { token: await tokenFor() });
    assert.equal(res.status, 200);
    const q = pool.calls.find((c) => /FROM readings/.test(c.sql));
    assert.match(q.sql, /ORDER BY time DESC/);
    assert.deepEqual(q.params, [SESSION_ID, '2026-10-14T12:00:00Z', null, 10]);
  });
});

test('GET readings com bucket usa time_bucket do TimescaleDB', async () => {
  const pool = fakePool([ownSession, [/time_bucket/, { rows: [{ samples: 10 }] }]]);
  await withApp(pool, async (call) => {
    const res = await call('GET', path('/readings?bucket=10'), { token: await tokenFor() });
    assert.equal(res.status, 200);
    const q = pool.calls.find((c) => /time_bucket/.test(c.sql));
    assert.equal(q.params[3], 10);
  });
});

test('GET readings recusa limit e bucket fora da faixa', async () => {
  await withApp(fakePool([ownSession]), async (call) => {
    const token = await tokenFor();
    assert.equal((await call('GET', path('/readings?limit=99999'), { token })).status, 400);
    assert.equal((await call('GET', path('/readings?bucket=0'), { token })).status, 400);
    assert.equal((await call('GET', path('/readings?order=sideways'), { token })).status, 400);
  });
});

test('GET anomalies calcula na hora e aceita limites ajustáveis', async () => {
  const t = (s) => new Date(Date.parse('2026-10-14T12:00:00Z') + s * 1000);
  const rows = [
    { time: t(0), battery_voltage: 14.2, control_module_voltage: null, rpm: 2500 },
    { time: t(1), battery_voltage: 13.4, control_module_voltage: null, rpm: 2500 },
    { time: t(2), battery_voltage: 13.3, control_module_voltage: null, rpm: 2500 },
    { time: t(3), battery_voltage: 14.2, control_module_voltage: null, rpm: 2500 },
  ];
  const pool = fakePool([ownSession, [/FROM readings/, { rows }]]);
  await withApp(pool, async (call) => {
    const token = await tokenFor();
    const padrao = await call('GET', path('/anomalies'), { token });
    assert.equal(padrao.status, 200);
    assert.equal(padrao.body.events.length, 0);                 // 13,3 V não passa do limite de 13,0 V

    const rigido = await call('GET', path('/anomalies?voltage_min=13.8'), { token });
    assert.equal(rigido.body.events.length, 1);
    assert.equal(rigido.body.parameters.voltage_min, 13.8);

    assert.equal((await call('GET', path('/anomalies?voltage_min=1'), { token })).status, 400);
  });
});

test('GET /api/anomalies lista os eventos gravados da oficina', async () => {
  const pool = fakePool([[/FROM anomaly_events a/, { rows: [{ id: 1, plate: 'ABC1D23', kind: 'voltage_drop' }] }]]);
  await withApp(pool, async (call) => {
    const res = await call('GET', `/api/anomalies?vehicle_id=${VEHICLE_ID}`, { token: await tokenFor() });
    assert.equal(res.status, 200);
    assert.deepEqual(pool.calls[0].params, [WORKSHOP_ID, VEHICLE_ID, 50, 0]);
  });
});

test('rotas de telemetria exigem login', async () => {
  await withApp(fakePool(), async (call) => {
    assert.equal((await call('POST', path('/readings'), { body: batch })).status, 401);
    assert.equal((await call('GET', path('/stream'))).status, 401);
  });
});

test('stream SSE entrega "ready" e depois as leituras novas, em tempo real', async () => {
  const pool = fakePool([ownSession, [/INSERT INTO readings/, { rows: insertedRows }]]);
  const bus = new LiveBus();

  await withApp(pool, async (call, { base }) => {
    const token = await tokenFor();
    const ctrl = new AbortController();
    const res = await fetch(`${base}${path('/stream')}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.any([ctrl.signal, AbortSignal.timeout(5000)]),
    });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/event-stream/);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const readUntil = async (needle) => {
      while (!buffer.includes(needle)) {
        const { value, done } = await reader.read();
        if (done) return false;
        buffer += decoder.decode(value, { stream: true });
      }
      return true;
    };

    assert.ok(await readUntil('event: ready'));
    assert.equal(bus.count, 1);

    const posted = await call('POST', path('/readings'), { token, body: batch });
    assert.equal(posted.status, 201);
    assert.ok(await readUntil('event: readings'));
    assert.match(buffer, /"battery_voltage":11\.5/);

    ctrl.abort();
  }, undefined, { bus });
});

test('GET /metrics expõe contadores no formato do Prometheus', async () => {
  await withApp(fakePool([[/SELECT 1/, { rows: [] }]]), async (call) => {
    await call('GET', '/api/health');
    const res = await call('GET', '/metrics');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/plain/);
    assert.match(res.text, /http_requests_total\{method="GET",route="\/api\/health",status="200"\} 1/);
    assert.match(res.text, /telemetry_readings_ingested_total 0/);
  });
});
