import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateDtcs, generateReading } from '../scripts/simulate.js';
import { detectVoltageDrops } from '../src/anomalies.js';

const series = (n, opts) => Array.from({ length: n }, (_, i) => ({
  ...generateReading(i, opts),
  time: new Date(Date.parse('2026-10-14T12:00:00Z') + i * 1000),
}));

test('o simulador é determinístico e respeita os limites da API', () => {
  assert.deepEqual(generateReading(10), generateReading(10));
  for (let i = 0; i < 300; i += 1) {
    const r = generateReading(i);
    assert.ok(r.battery_voltage > 0 && r.battery_voltage < 40);
    assert.ok(r.rpm >= 0 && r.rpm <= 20000);
    assert.ok(Number.isInteger(r.seq) && Number.isInteger(r.speed_kmh) && Number.isInteger(r.coolant_temp_c));
  }
});

test('a queda simulada (11,5 V a ~4000 rpm) é encontrada pelo detector, e só ela', () => {
  const events = detectVoltageDrops(series(120));
  assert.equal(events.length, 1);
  assert.ok(events[0].min_value < 12);
  assert.ok(events[0].details.max_rpm >= 3900);
  assert.equal(events[0].details.samples, 10); // 45 s a 54 s
});

test('sem a janela de defeito, não há anomalia', () => {
  assert.deepEqual(detectVoltageDrops(series(120, { dropStartS: 500, dropEndS: 510 })), []);
});

test('o simulador gera os códigos de falha coerentes com a queda de tensão', () => {
  const dtcs = generateDtcs({ dropStartS: 45, dropEndS: 55 });
  assert.deepEqual(dtcs.map((d) => `${d.code}/${d.status}`), ['P0562/pending', 'P0562/stored', 'P0622/stored']);
  assert.ok(dtcs[0].second > 45 && dtcs[0].second < 55); // o pendente aparece DURANTE a queda
  assert.equal(dtcs[1].second, 55);                       // o confirmado, quando ela termina
});
