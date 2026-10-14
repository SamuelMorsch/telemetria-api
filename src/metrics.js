const escapeLabel = (v) => String(v).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');

function labelString(labels = {}, extra = {}) {
  const entries = Object.entries({ ...labels, ...extra });
  if (entries.length === 0) return '';
  return `{${entries.map(([k, v]) => `${k}="${escapeLabel(v)}"`).join(',')}}`;
}

const keyOf = (labels) => JSON.stringify(Object.entries(labels).sort());

/** Registro mínimo de métricas (contador, gauge, histograma) com saída no formato de texto do Prometheus. */
export function createRegistry() {
  const metrics = [];
  const add = (m) => { metrics.push(m); return m; };

  const counter = (name, help) => {
    const series = new Map();
    return add({
      name, help, type: 'counter',
      inc(labels = {}, by = 1) {
        const k = keyOf(labels);
        const s = series.get(k) ?? { labels, value: 0 };
        s.value += by;
        series.set(k, s);
      },
      lines: () => [...series.values()].map((s) => `${name}${labelString(s.labels)} ${s.value}`),
    });
  };

  const gauge = (name, help, collect) => {
    let value = 0;
    return add({
      name, help, type: 'gauge',
      set(v) { value = v; },
      lines: () => [`${name} ${collect ? collect() : value}`],
    });
  };

  const histogram = (name, help, buckets) => {
    const series = new Map();
    return add({
      name, help, type: 'histogram',
      observe(labels, value) {
        const k = keyOf(labels);
        let s = series.get(k);
        if (!s) {
          s = { labels, counts: new Array(buckets.length).fill(0), sum: 0, count: 0 };
          series.set(k, s);
        }
        buckets.forEach((b, i) => { if (value <= b) s.counts[i] += 1; });
        s.sum += value;
        s.count += 1;
      },
      lines() {
        const out = [];
        for (const s of series.values()) {
          buckets.forEach((b, i) => out.push(`${name}_bucket${labelString(s.labels, { le: b })} ${s.counts[i]}`));
          out.push(`${name}_bucket${labelString(s.labels, { le: '+Inf' })} ${s.count}`);
          out.push(`${name}_sum${labelString(s.labels)} ${s.sum}`);
          out.push(`${name}_count${labelString(s.labels)} ${s.count}`);
        }
        return out;
      },
    });
  };

  const render = () =>
    metrics
      .map((m) => [`# HELP ${m.name} ${m.help}`, `# TYPE ${m.name} ${m.type}`, ...m.lines()].join('\n'))
      .join('\n') + '\n';

  return { counter, gauge, histogram, render };
}

/** Troca ids por ":id" e tira a query string, para não criar um rótulo novo por requisição. */
export function normalizePath(url) {
  return String(url)
    .split('?')[0]
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id');
}

/** Métricas da aplicação. `bus` fornece o número de painéis conectados ao vivo. */
export function createMetrics({ bus } = {}) {
  const registry = createRegistry();

  registry.gauge('process_resident_memory_bytes', 'Memória residente do processo.', () => process.memoryUsage().rss);
  registry.gauge('process_uptime_seconds', 'Tempo desde o início do processo.', () => Math.round(process.uptime()));
  registry.gauge('telemetry_live_streams', 'Painéis com a transmissão ao vivo aberta.', () => bus?.count ?? 0);
  const lastReading = registry.gauge('telemetry_last_reading_timestamp_seconds', 'Instante (Unix) da última leitura recebida.');

  const httpRequests = registry.counter('http_requests_total', 'Requisições HTTP atendidas.');
  const httpDuration = registry.histogram(
    'http_request_duration_seconds',
    'Duração das requisições HTTP.',
    [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  );
  const readingsIngested = registry.counter('telemetry_readings_ingested_total', 'Leituras novas gravadas.');
  const readingsDuplicate = registry.counter('telemetry_readings_duplicate_total', 'Leituras repetidas descartadas (reenvio).');
  const anomaliesStored = registry.counter('telemetry_anomalies_stored_total', 'Eventos de anomalia gravados ao encerrar sessões.');
  readingsIngested.inc({}, 0);
  readingsDuplicate.inc({}, 0);
  anomaliesStored.inc({}, 0);

  /** Middleware: mede cada requisição quando a resposta termina. */
  function middleware(req, res, next) {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const seconds = Number(process.hrtime.bigint() - start) / 1e9;
      const route = res.statusCode === 404 ? 'unmatched' : normalizePath(req.originalUrl);
      httpRequests.inc({ method: req.method, route, status: String(res.statusCode) });
      httpDuration.observe({ method: req.method, route }, seconds);
    });
    next();
  }

  return {
    registry,
    middleware,
    readingsIngested,
    readingsDuplicate,
    anomaliesStored,
    markReading: (unixSeconds) => lastReading.set(unixSeconds),
  };
}
