import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../src/password.js';

test('hash tem o formato esperado e não contém a senha', async () => {
  const hash = await hashPassword('senha-forte-123');
  assert.match(hash, /^scrypt\$16384\$8\$1\$/);
  assert.ok(!hash.includes('senha-forte-123'));
});

test('mesma senha gera hashes diferentes (salt aleatório)', async () => {
  assert.notEqual(await hashPassword('abc12345'), await hashPassword('abc12345'));
});

test('verifica a senha correta e rejeita a errada', async () => {
  const hash = await hashPassword('senha-forte-123');
  assert.equal(await verifyPassword('senha-forte-123', hash), true);
  assert.equal(await verifyPassword('senha-errada', hash), false);
});

test('formato de hash inválido devolve false, sem lançar erro', async () => {
  assert.equal(await verifyPassword('x', 'lixo'), false);
  assert.equal(await verifyPassword('x', 'scrypt$a$b$c$d$e'), false);
  assert.equal(await verifyPassword('x', undefined), false);
});
