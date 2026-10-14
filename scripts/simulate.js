#!/usr/bin/env node
/**
 * Simulador de um carro com alternador defeituoso, para demonstrações e testes.
 * Envia leituras reais para a API, como o app faria, incluindo uma queda de tensão
 * (14,2 V -> 11,5 V) com o motor a ~4000 rpm.
 *
 * Uso:
 *   node scripts/simulate.js --url https://SEU_DOMINIO --email voce@exemplo.com --password SENHA
 *
 * Opções: --duration 120 (segundos)  --drop-start 45  --drop-end 55  --plate SIM0001  --fast
 *   Sem --fast, envia em tempo real (1 leitura/s, em lotes de 5), bom para ver o painel ao vivo.
 *   Com --fast, envia tudo de uma vez com horários no passado.
 */
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const round2 = (n) => Math.round(n * 100) / 100;

/** i-ésima leitura (1 por segundo). Determinística, sem aleatoriedade, para poder ser testada. */
export function generateReading(i, { dropStartS = 45, dropEndS = 55 } = {}) {
  const inDrop = i >= dropStartS && i < dropEndS;
  const rpm = i < 8 ? 800 : inDrop ? 4000 + Math.round(Math.sin(i) * 50) : 2200 + Math.round(Math.sin(i / 5) * 300);
  const noise = Math.sin(i * 1.7) * 0.06;
  const volts = (inDrop ? 11.5 : 14.2) + noise;
  return {
    seq: i,
    battery_voltage: round2(volts),
    control_module_voltage: round2(volts + 0.1),
    rpm,
    speed_kmh: Math.round(rpm / 40),
    coolant_temp_c: Math.min(92, 60 + Math.floor(i / 2)),
  };
}

function parseArgs(argv) {
  const args = { duration: 120, dropStart: 45, dropEnd: 55, plate: 'SIM0001', fast: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--fast') args.fast = true;
    else if (a.startsWith('--')) {
      const key = a.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      args[key] = argv[++i];
    }
  }
  for (const k of ['duration', 'dropStart', 'dropEnd']) args[k] = Number(args[k]);
  return args;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.url || !args.email || !args.password) {
    console.error('Uso: node scripts/simulate.js --url URL --email EMAIL --password SENHA [--duration 120] [--fast]');
    process.exit(1);
  }
  const api = args.url.replace(/\/$/, '');
  let token;

  async function call(method, path, body) {
    const res = await fetch(api + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : null;
    return { status: res.status, json };
  }

  const login = await call('POST', '/api/auth/login', { email: args.email, password: args.password });
  if (login.status !== 200) throw new Error(`login falhou (${login.status}): ${JSON.stringify(login.json)}`);
  token = login.json.token;
  console.log('login ok');

  // Reaproveita o veículo de simulação ou cria
  const created = await call('POST', '/api/vehicles', { plate: args.plate, model: 'Veículo simulado' });
  let vehicleId = created.json?.id;
  if (created.status === 409) {
    const list = await call('GET', '/api/vehicles');
    vehicleId = list.json.find((v) => v.plate === args.plate.toUpperCase().replace(/[\s-]/g, ''))?.id;
  } else if (created.status !== 201) {
    throw new Error(`não consegui cadastrar o veículo (${created.status}): ${JSON.stringify(created.json)}`);
  }

  const sessionId = randomUUID();
  const startMs = args.fast ? Date.now() - args.duration * 1000 : Date.now();
  const opened = await call('POST', '/api/sessions', {
    id: sessionId, vehicle_id: vehicleId, started_at: new Date(startMs).toISOString(), source: 'simulator', app_version: 'simulador',
  });
  if (opened.status !== 201) throw new Error(`não consegui abrir a sessão (${opened.status}): ${JSON.stringify(opened.json)}`);
  console.log(`sessão aberta: ${sessionId}`);

  const BATCH = args.fast ? 100 : 5;
  const opts = { dropStartS: args.dropStart, dropEndS: args.dropEnd };
  for (let from = 0; from < args.duration; from += BATCH) {
    const readings = [];
    for (let i = from; i < Math.min(from + BATCH, args.duration); i += 1) {
      readings.push({ ...generateReading(i, opts), time: new Date(startMs + i * 1000).toISOString() });
    }
    if (!args.fast) await sleep(BATCH * 1000);
    const sent = await call('POST', `/api/sessions/${sessionId}/readings`, { readings });
    if (sent.status >= 300) throw new Error(`envio falhou (${sent.status}): ${JSON.stringify(sent.json)}`);
    console.log(`enviadas ${readings.length} leituras (${from}-${from + readings.length - 1}) -> ${JSON.stringify(sent.json)}`);
  }

  const ended = await call('PATCH', `/api/sessions/${sessionId}/end`, { ended_at: new Date(startMs + args.duration * 1000).toISOString() });
  console.log(`sessão encerrada. anomalias detectadas: ${ended.json.anomalies_detected}`);

  const found = await call('GET', `/api/sessions/${sessionId}/anomalies`);
  console.log(JSON.stringify(found.json.events, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err) => { console.error(err.message); process.exit(1); });
}
