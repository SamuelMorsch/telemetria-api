import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectVoltageDrops, refreshStoredAnomalies } from '../src/anomalies.js';

const T0 = Date.parse('2026-10-14T12:00:00Z');
const at = (s, volts, rpm, extra = {}) => ({ time: new Date(T0 + s * 1000), battery_voltage: volts, rpm, ...extra });

test('detecta a queda de 14,2 V para 11,5 V a 4000 rpm (o cenário do artigo)', () => {
  const readings = [
    at(0, 14.2, 2500), at(1, 14.2, 2500),
    at(2, 11.5, 4000), at(3, 11.4, 4000), at(4, 11.6, 4000),
    at(5, 14.2, 2500), at(6, 14.2, 2500),
  ];
  const events = detectVoltageDrops(readings);
  assert.equal(events.length, 1);
  assert.equal(events[0].kind, 'voltage_drop');
  assert.equal(events[0].min_value, 11.4);
  assert.equal(events[0].started_at, new Date(T0 + 2000).toISOString());
  assert.equal(events[0].ended_at, new Date(T0 + 4000).toISOString());
  assert.equal(events[0].details.samples, 3);
  assert.equal(events[0].details.max_rpm, 4000);
});

test('motor desligado com 12,4 V é normal: não é anomalia', () => {
  const readings = [at(0, 12.4, 0), at(1, 12.4, 0), at(2, 12.4, 0)];
  assert.deepEqual(detectVoltageDrops(readings), []);
});

test('leitura baixa isolada (ruído) é ignorada com o padrão de 2 amostras', () => {
  const readings = [at(0, 14.2, 2500), at(1, 11.0, 2500), at(2, 14.2, 2500)];
  assert.deepEqual(detectVoltageDrops(readings), []);
  assert.equal(detectVoltageDrops(readings, { minSamples: 1 }).length, 1);
});

test('buraco grande nos dados separa dois eventos', () => {
  const readings = [at(0, 11.5, 3000), at(1, 11.5, 3000), at(60, 11.5, 3000), at(61, 11.5, 3000)];
  assert.equal(detectVoltageDrops(readings).length, 2);
});

test('sem rpm não dá para saber se o motor gira: não gera evento', () => {
  assert.deepEqual(detectVoltageDrops([at(0, 11.5, null), at(1, 11.5, null)]), []);
});

test('usa a tensão da ECU quando a do adaptador não veio', () => {
  const readings = [
    { time: new Date(T0), battery_voltage: null, control_module_voltage: 11.8, rpm: 3000 },
    { time: new Date(T0 + 1000), battery_voltage: null, control_module_voltage: 11.7, rpm: 3000 },
  ];
  assert.equal(detectVoltageDrops(readings).length, 1);
});

test('os limites são configuráveis', () => {
  const readings = [at(0, 13.4, 2500), at(1, 13.3, 2500)];
  assert.equal(detectVoltageDrops(readings).length, 0);
  assert.equal(detectVoltageDrops(readings, { voltageMin: 13.8 }).length, 1);
});

test('refreshStoredAnomalies apaga os eventos antigos e grava os novos numa transação', async () => {
  const executed = [];
  const readings = [at(0, 11.5, 3000), at(1, 11.4, 3000)];
  const client = { query: async (sql, params) => { executed.push({ sql: sql.trim(), params }); return { rows: [] }; }, release() {} };
  const pool = { query: async () => ({ rows: readings }), connect: async () => client };

  const events = await refreshStoredAnomalies(pool, 'sess-1');
  assert.equal(events.length, 1);
  const sqls = executed.map((e) => e.sql.split(/\s+/)[0]);
  assert.deepEqual(sqls, ['BEGIN', 'DELETE', 'INSERT', 'COMMIT']);
});

test('refreshStoredAnomalies faz ROLLBACK se a gravação falhar', async () => {
  const executed = [];
  const client = {
    query: async (sql) => { executed.push(sql.trim()); if (sql.includes('INSERT')) throw new Error('falha'); return { rows: [] }; },
    release() {},
  };
  const pool = { query: async () => ({ rows: [at(0, 11.5, 3000), at(1, 11.4, 3000)] }), connect: async () => client };
  await assert.rejects(() => refreshStoredAnomalies(pool, 's'), /falha/);
  assert.ok(executed.includes('ROLLBACK'));
});
