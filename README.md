# Telemetria Automotiva Remota - API

API do sistema de telemetria automotiva remota do TCC (Engenharia de Software, Católica SC).
Recebe leituras de tensão, rotação, velocidade e códigos de falha enviadas pelo aplicativo
móvel (via adaptador OBD-II/ELM327) e as disponibiliza ao painel web da oficina, para
diagnosticar defeitos elétricos **intermitentes** que não aparecem com o carro parado.

> **Status:** v2 em desenvolvimento (branch `v2`). Já disponíveis: login com JWT, cadastro de
> oficinas, usuários, veículos e sessões de monitoramento, documentação Swagger e proteções
> básicas. Próxima etapa: envio de leituras em lote, tempo real e detecção de anomalias.

## Ecossistema

| Módulo | Repositório |
|---|---|
| App Android (gateway) | [telemetria_obd2_app](https://github.com/SamuelMorsch/telemetria_obd2_app) |
| API (este repositório) | [telemetria-api](https://github.com/SamuelMorsch/telemetria-api) |
| Painel web da oficina | [painel-telemetria-web](https://github.com/SamuelMorsch/painel-telemetria-web) |

## Stack
Node.js 22 (ESM) · Express 5 · PostgreSQL 16 + TimescaleDB · Docker · Caddy (HTTPS) ·
`jose` (JWT) · `zod` (validação) · `swagger-ui-express` (documentação).
Decisões e justificativas em [`docs/adr`](docs/adr).

## Documentação interativa
Em produção: **`/api/docs`** (Swagger UI). Para testar: faça `POST /api/auth/register`,
copie o `token` da resposta, clique em **Authorize** e cole o token.

## Endpoints
| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/health` | público | API e banco respondem? |
| POST | `/api/auth/register` | público | cria oficina + usuário admin |
| POST | `/api/auth/login` | público | devolve token JWT |
| GET | `/api/auth/me` | logado | dados do usuário |
| GET/POST | `/api/users` | admin | lista / cria usuários da oficina |
| GET/POST | `/api/vehicles` | logado / admin, mecânico | lista / cadastra veículos |
| GET | `/api/vehicles/:id` | logado | detalhe do veículo |
| GET/POST | `/api/sessions` | logado | lista / abre sessão (idempotente) |
| GET | `/api/sessions/:id` | logado | detalhe da sessão |
| PATCH | `/api/sessions/:id/end` | logado | encerra a sessão |

## Segurança
- Senhas com **scrypt** (salt aleatório por senha, comparação em tempo constante).
- Tokens **JWT HS256** com expiração; o segredo vem do ambiente e nunca vai ao repositório.
- **Isolamento por oficina**: toda consulta filtra pelo `workshop_id` do token.
- Validação de toda entrada (zod) e consultas SQL parametrizadas.
- Limite de requisições por IP (geral e mais rígido no login), cabeçalhos de segurança e CORS por lista de origens.
- Banco sem porta exposta à internet; HTTPS automático.

## Rodando localmente
Requer Node 22+ e um PostgreSQL com TimescaleDB (por exemplo, o container de `infra/`).

```bash
npm install
cp .env.example .env     # defina DATABASE_URL e JWT_SECRET
npm run dev
```

## Testes
```bash
npm test                 # testes + relatório de cobertura (node:test)
```

## Produção
Ver [`infra/README.md`](infra/README.md).

## Modelo de dados
`workshops` → `users`, `vehicles` → `monitoring_sessions` → `readings` (hypertable),
`dtcs`, `anomaly_events`. Definição em [`migrations`](migrations).
