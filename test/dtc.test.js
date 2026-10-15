import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeDtc, ELECTRICAL } from '../src/dtc.js';

test('código conhecido devolve a descrição em português', () => {
  const r = describeDtc('P0562');
  assert.equal(r.known, true);
  assert.match(r.description, /Tensão do sistema baixa/);
  assert.equal(r.scope, 'generic');
});

test('códigos de carga e partida são marcados como elétricos', () => {
  for (const code of ['P0560', 'P0562', 'P0620', 'P0622', 'P0615']) {
    assert.equal(describeDtc(code).electrical, true, code);
  }
  assert.equal(describeDtc('P0301').electrical, false);
  assert.ok(ELECTRICAL.size >= 10);
});

test('aceita minúsculas e espaços', () => {
  assert.equal(describeDtc(' p0562 ').code, 'P0562');
  assert.equal(describeDtc('p0562').known, true);
});

test('código genérico fora do dicionário é explicado pela estrutura (sistema e subsistema)', () => {
  const r = describeDtc('P0999');
  assert.equal(r.known, false);
  assert.equal(r.scope, 'generic');
  assert.match(r.description, /genérico/);
  assert.match(r.description, /Motor e transmissão/);
  assert.match(r.description, /transmissão/); // 3º caractere 9 = transmissão
  assert.match(r.description, /manual do fabricante/);
});

test('código P1xxx é do fabricante', () => {
  const r = describeDtc('P1234');
  assert.equal(r.scope, 'manufacturer');
  assert.match(r.description, /específico do fabricante/);
});

test('códigos U, C e B recebem o sistema correto', () => {
  assert.match(describeDtc('U0999').description, /Rede de comunicação/);
  assert.match(describeDtc('C0035').description, /Chassi/);
  assert.match(describeDtc('B1000').description, /Carroceria/);
  assert.equal(describeDtc('B1000').scope, 'manufacturer');
  assert.equal(describeDtc('C0035').scope, 'generic');
});

test('código inválido não quebra', () => {
  for (const bad of ['', 'XYZ', 'P99999', 'Z0100', null, undefined, 'P0G00']) {
    const r = describeDtc(bad);
    assert.equal(r.known, false);
    assert.equal(r.scope, 'unknown');
    assert.equal(r.description, 'Código de falha inválido.');
  }
});
