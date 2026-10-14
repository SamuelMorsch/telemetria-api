# Telemetria Automotiva Remota - API

API do sistema de telemetria automotiva remota do TCC (Engenharia de Software, Católica SC).
Recebe leituras de tensão, rotação, velocidade e códigos de falha enviadas pelo aplicativo
móvel (via adaptador OBD-II/ELM327) e as disponibiliza ao painel web da oficina, para
diagnosticar defeitos elétricos **intermitentes** que não aparecem com o carro parado.

> **Status:** v2 em desenvolvimento (branch `v2`). Esta etapa entrega o esqueleto:
> banco com o modelo de dados completo, migrations, `GET /api/health`, Docker e HTTPS.
> Rotas de login, veículos, sessões e leituras vêm nas próximas etapas.

## Ecossistema

| Módulo | Repositório |
|---|---|
| App Android (gateway) | [telemetria_obd2_app](https://github.com/SamuelMorsch/telemetria_obd2_app) |
| API (este repositório) | [telemetria-api](https://github.com/SamuelMorsch/telemetria-api) |
| Painel web da oficina | [painel-telemetria-web](https://github.com/SamuelMorsch/painel-telemetria-web) |

## Stack
Node.js 22 (ESM) · Express 5 · PostgreSQL 16 + TimescaleDB · Docker · Caddy (HTTPS).
Decisões e justificativas em [`docs/adr`](docs/adr).

## Rodando localmente
Requer Node 22+ e um PostgreSQL com TimescaleDB (por exemplo, o container de `infra/`).

```bash
npm install
cp .env.example .env     # defina DATABASE_URL
npm run dev
```

## Testes
```bash
npm test                 # testes + relatório de cobertura (node:test)
```

## Produção
Ver [`infra/README.md`](infra/README.md).

## Endpoints atuais
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/health` | 200 se a API e o banco respondem; 503 se o banco falha |

## Modelo de dados
`workshops` → `users`, `vehicles` → `monitoring_sessions` → `readings` (hypertable),
`dtcs`, `anomaly_events`. Definição em [`migrations/001_init.sql`](migrations/001_init.sql).
