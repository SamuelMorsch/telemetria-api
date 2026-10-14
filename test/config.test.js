import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';

const base = { DATABASE_URL: 'postgres://x', JWT_SECRET: 'a'.repeat(32) };

test('config válida usa os padrões', () => {
  const c = loadConfig(base);
  assert.equal(c.port, 3000);
  assert.equal(c.jwtExpiresIn, '8h');
  assert.deepEqual(c.corsOrigins, []);
  assert.equal(c.registrationEnabled, true);
});

test('lê CORS_ORIGINS separados por vírgula e REGISTRATION_ENABLED', () => {
  const c = loadConfig({ ...base, CORS_ORIGINS: 'http://a.com, http://b.com ,', REGISTRATION_ENABLED: 'false' });
  assert.deepEqual(c.corsOrigins, ['http://a.com', 'http://b.com']);
  assert.equal(c.registrationEnabled, false);
});

test('rejeita JWT_SECRET curto ou ausente', () => {
  assert.throws(() => loadConfig({ ...base, JWT_SECRET: 'curto' }), /JWT_SECRET/);
  assert.throws(() => loadConfig({ DATABASE_URL: 'x' }), /JWT_SECRET/);
});

test('rejeita DATABASE_URL ausente', () => {
  assert.throws(() => loadConfig({ JWT_SECRET: 'a'.repeat(32) }), /DATABASE_URL/);
});
