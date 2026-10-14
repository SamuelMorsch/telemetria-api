import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAuth } from '../src/auth.js';
import { hashPassword } from '../src/password.js';
import { fakePool, withApp, testConfig, USER_ID, WORKSHOP_ID } from '../testing/helpers.js';

const userRow = { id: USER_ID, workshop_id: WORKSHOP_ID, email: 'oficina@exemplo.com', role: 'admin', created_at: '2026-10-14T00:00:00Z' };

const tokenFor = (role) => createAuth(testConfig).signToken({ id: USER_ID, workshop_id: WORKSHOP_ID, role });

test('register cria oficina + admin, devolve token e não vaza o hash', async () => {
  const pool = fakePool([
    [/INSERT INTO workshops/, { rows: [{ id: WORKSHOP_ID }] }],
    [/INSERT INTO users/, { rows: [userRow] }],
  ]);
  await withApp(pool, async (call) => {
    const res = await call('POST', '/api/auth/register', {
      body: { workshop_name: 'Autoelétrica Morsch', email: ' Oficina@Exemplo.com ', password: 'senha-forte-123' },
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.token.split('.').length, 3);
    assert.equal(res.body.user.role, 'admin');
    assert.ok(!JSON.stringify(res.body).includes('password'));

    const insertUser = pool.calls.find((c) => /INSERT INTO users/.test(c.sql));
    assert.equal(insertUser.params[1], 'oficina@exemplo.com'); // e-mail normalizado
    assert.match(insertUser.params[2], /^scrypt\$/);           // senha guardada como hash
    assert.ok(pool.calls.some((c) => c.sql === 'COMMIT'));
  });
});

test('register rejeita senha curta com 400 e lista os campos', async () => {
  await withApp(fakePool(), async (call) => {
    const res = await call('POST', '/api/auth/register', {
      body: { workshop_name: 'X', email: 'nao-e-email', password: '123' },
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'validation_error');
    const fields = res.body.details.map((d) => d.field);
    assert.ok(fields.includes('email') && fields.includes('password') && fields.includes('workshop_name'));
  });
});

test('register com e-mail repetido devolve 409 e faz ROLLBACK', async () => {
  const pool = fakePool([
    [/INSERT INTO workshops/, { rows: [{ id: WORKSHOP_ID }] }],
    [/INSERT INTO users/, () => { throw Object.assign(new Error('duplicate key'), { code: '23505' }); }],
  ]);
  await withApp(pool, async (call) => {
    const res = await call('POST', '/api/auth/register', {
      body: { workshop_name: 'Oficina', email: 'a@b.com', password: 'senha-forte-123' },
    });
    assert.equal(res.status, 409);
    assert.ok(pool.calls.some((c) => c.sql === 'ROLLBACK'));
  });
});

test('register devolve 403 quando o cadastro está desativado', async () => {
  await withApp(fakePool(), async (call) => {
    const res = await call('POST', '/api/auth/register', {
      body: { workshop_name: 'Oficina', email: 'a@b.com', password: 'senha-forte-123' },
    });
    assert.equal(res.status, 403);
    assert.equal(res.body.error, 'registration_disabled');
  }, { ...testConfig, registrationEnabled: false });
});

test('login com senha correta devolve token; com errada ou e-mail inexistente devolve 401', async () => {
  const hash = await hashPassword('senha-forte-123');
  const pool = fakePool([
    [/FROM users WHERE email/, (params) =>
      params[0] === 'oficina@exemplo.com' ? { rows: [{ ...userRow, password_hash: hash }] } : { rows: [] }],
  ]);
  await withApp(pool, async (call) => {
    const ok = await call('POST', '/api/auth/login', { body: { email: 'oficina@exemplo.com', password: 'senha-forte-123' } });
    assert.equal(ok.status, 200);
    assert.ok(ok.body.token);
    assert.equal(ok.body.user.password_hash, undefined);

    const wrong = await call('POST', '/api/auth/login', { body: { email: 'oficina@exemplo.com', password: 'errada-errada' } });
    assert.equal(wrong.status, 401);
    assert.equal(wrong.body.error, 'invalid_credentials');

    const unknown = await call('POST', '/api/auth/login', { body: { email: 'ninguem@exemplo.com', password: 'qualquer-coisa' } });
    assert.equal(unknown.status, 401);
    assert.equal(unknown.body.message, wrong.body.message); // mesma mensagem: não revela se o e-mail existe
  });
});

test('rotas protegidas exigem token válido', async () => {
  await withApp(fakePool(), async (call) => {
    assert.equal((await call('GET', '/api/auth/me')).status, 401);
    assert.equal((await call('GET', '/api/vehicles')).status, 401);
    assert.equal((await call('GET', '/api/vehicles', { token: 'lixo.lixo.lixo' })).status, 401);
  });
});

test('token assinado com outro segredo é rejeitado', async () => {
  const forged = await createAuth({ ...testConfig, jwtSecret: 'outro-segredo-qualquer-com-32-caracteres!!' })
    .signToken({ id: USER_ID, workshop_id: WORKSHOP_ID, role: 'admin' });
  await withApp(fakePool(), async (call) => {
    assert.equal((await call('GET', '/api/vehicles', { token: forged })).status, 401);
  });
});

test('GET /api/auth/me devolve o usuário do token', async () => {
  const pool = fakePool([[/FROM users WHERE id/, { rows: [userRow] }]]);
  await withApp(pool, async (call) => {
    const res = await call('GET', '/api/auth/me', { token: await tokenFor('admin') });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.email, 'oficina@exemplo.com');
  });
});

test('usuários: só admin lista e cria; senha vira hash', async () => {
  const pool = fakePool([
    [/SELECT id, email, role, created_at FROM users/, { rows: [userRow] }],
    [/INSERT INTO users/, { rows: [{ ...userRow, role: 'mechanic' }] }],
  ]);
  await withApp(pool, async (call) => {
    const driver = await tokenFor('driver');
    assert.equal((await call('GET', '/api/users', { token: driver })).status, 403);

    const admin = await tokenFor('admin');
    assert.equal((await call('GET', '/api/users', { token: admin })).status, 200);

    const created = await call('POST', '/api/users', {
      token: admin,
      body: { email: 'mec@exemplo.com', password: 'senha-forte-123', role: 'mechanic' },
    });
    assert.equal(created.status, 201);
    const insert = pool.calls.find((c) => /INSERT INTO users/.test(c.sql));
    assert.equal(insert.params[0], WORKSHOP_ID); // usuário entra na oficina do admin
    assert.match(insert.params[2], /^scrypt\$/);
  });
});
