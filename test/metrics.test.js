import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRegistry, createMetrics, normalizePath } from '../src/metrics.js';

test('contador com rótulos aparece no formato do Prometheus', () => {
  const r = createRegistry();
  const c = r.counter('pedidos_total', 'Pedidos.');
  c.inc({ rota: '/a', status: '200' });
  c.inc({ rota: '/a', status: '200' }, 2);
  const out = r.render();
  assert.match(out, /# HELP pedidos_total Pedidos\./);
  assert.match(out, /# TYPE pedidos_total counter/);
  assert.match(out, /pedidos_total\{rota="\/a",status="200"\} 3/);
});

test('histograma acumula os buckets e fecha com +Inf, soma e contagem', () => {
  const r = createRegistry();
  const h = r.histogram('duracao_seconds', 'Duração.', [0.1, 1]);
  h.observe({}, 0.05);
  h.observe({}, 0.5);
  h.observe({}, 5);
  const out = r.render();
  assert.match(out, /duracao_seconds_bucket\{le="0\.1"\} 1/);
  assert.match(out, /duracao_seconds_bucket\{le="1"\} 2/);
  assert.match(out, /duracao_seconds_bucket\{le="\+Inf"\} 3/);
  assert.match(out, /duracao_seconds_count 3/);
  assert.match(out, /duracao_seconds_sum 5\.55/);
});

test('gauge usa a função de coleta no momento da leitura', () => {
  const r = createRegistry();
  let n = 1;
  r.gauge('conectados', 'Conectados.', () => n);
  assert.match(r.render(), /conectados 1/);
  n = 7;
  assert.match(r.render(), /conectados 7/);
});

test('escapa aspas e barras nos valores dos rótulos', () => {
  const r = createRegistry();
  r.counter('x_total', 'x').inc({ rota: 'a"b\\c' });
  assert.match(r.render(), /x_total\{rota="a\\"b\\\\c"\} 1/);
});

test('normalizePath troca UUIDs por :id e remove a query string', () => {
  assert.equal(
    normalizePath('/api/sessions/44444444-4444-4444-8444-444444444444/readings?limit=10'),
    '/api/sessions/:id/readings',
  );
});

test('métricas da aplicação exportam contadores zerados e processo', () => {
  const m = createMetrics({ bus: { count: 3 } });
  const out = m.registry.render();
  assert.match(out, /telemetry_readings_ingested_total 0/);
  assert.match(out, /telemetry_live_streams 3/);
  assert.match(out, /process_resident_memory_bytes \d+/);
});

test('o middleware conta a requisição quando a resposta termina; 404 vira "unmatched"', () => {
  const m = createMetrics();
  const run = (statusCode, url) => {
    let finish;
    m.middleware({ method: 'GET', originalUrl: url }, { statusCode, on: (_e, fn) => { finish = fn; } }, () => {});
    finish();
  };
  run(200, '/api/vehicles/44444444-4444-4444-8444-444444444444');
  run(404, '/wp-admin/xmlrpc.php');
  const out = m.registry.render();
  assert.match(out, /http_requests_total\{method="GET",route="\/api\/vehicles\/:id",status="200"\} 1/);
  assert.match(out, /route="unmatched",status="404"\} 1/);
});
