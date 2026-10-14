import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cors, rateLimit, securityHeaders } from '../src/security.js';

function fakeRes() {
  return {
    headers: {},
    statusCode: 200,
    body: null,
    ended: false,
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    end() { this.ended = true; return this; },
  };
}

test('securityHeaders define os cabeçalhos e segue adiante', () => {
  const res = fakeRes();
  let called = false;
  securityHeaders({}, res, () => { called = true; });
  assert.equal(res.headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(res.headers['X-Frame-Options'], 'DENY');
  assert.ok(called);
});

test('cors libera só origens da lista', () => {
  const mw = cors(['http://localhost:3001']);

  const ok = fakeRes();
  mw({ headers: { origin: 'http://localhost:3001' }, method: 'GET' }, ok, () => {});
  assert.equal(ok.headers['Access-Control-Allow-Origin'], 'http://localhost:3001');

  const bad = fakeRes();
  mw({ headers: { origin: 'http://malicioso.com' }, method: 'GET' }, bad, () => {});
  assert.equal(bad.headers['Access-Control-Allow-Origin'], undefined);
});

test('cors responde 204 ao preflight OPTIONS de origem permitida', () => {
  const res = fakeRes();
  cors(['http://a.com'])({ headers: { origin: 'http://a.com' }, method: 'OPTIONS' }, res, () => assert.fail('não deveria seguir'));
  assert.equal(res.statusCode, 204);
  assert.ok(res.ended);
});

test('rateLimit bloqueia depois do máximo e libera na janela seguinte', () => {
  let t = 1000;
  const mw = rateLimit({ windowMs: 60_000, max: 2, now: () => t });
  const hit = () => {
    const res = fakeRes();
    let passed = false;
    mw({ ip: '1.2.3.4' }, res, () => { passed = true; });
    return { res, passed };
  };

  assert.ok(hit().passed);
  assert.ok(hit().passed);
  const blocked = hit();
  assert.equal(blocked.passed, false);
  assert.equal(blocked.res.statusCode, 429);
  assert.ok(Number(blocked.res.headers['Retry-After']) > 0);

  t += 60_001; // nova janela
  assert.ok(hit().passed);
});

test('rateLimit conta cada IP separadamente', () => {
  const mw = rateLimit({ windowMs: 60_000, max: 1 });
  const run = (ip) => { let p = false; mw({ ip }, fakeRes(), () => { p = true; }); return p; };
  assert.ok(run('1.1.1.1'));
  assert.ok(run('2.2.2.2'));
  assert.equal(run('1.1.1.1'), false);
});
