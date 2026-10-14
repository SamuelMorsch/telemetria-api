import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LiveBus } from '../src/live.js';

test('entrega a mensagem só a quem assinou aquela sessão', () => {
  const bus = new LiveBus();
  const got = { a: [], b: [] };
  bus.subscribe('sessao-a', (m) => got.a.push(m));
  bus.subscribe('sessao-b', (m) => got.b.push(m));
  bus.publish('sessao-a', { event: 'readings', data: 1 });
  assert.deepEqual(got.a, [{ event: 'readings', data: 1 }]);
  assert.deepEqual(got.b, []);
});

test('cancelar a assinatura para de entregar e atualiza a contagem (mesmo chamando duas vezes)', () => {
  const bus = new LiveBus();
  const got = [];
  const unsubscribe = bus.subscribe('s', (m) => got.push(m));
  assert.equal(bus.count, 1);
  unsubscribe();
  unsubscribe();
  assert.equal(bus.count, 0);
  bus.publish('s', { event: 'x' });
  assert.deepEqual(got, []);
});
