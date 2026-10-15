# Telemetria Automotiva Remota - API

API do sistema de telemetria automotiva remota do TCC (Engenharia de Software, Católica SC).
Recebe leituras de tensão, rotação, velocidade e códigos de falha enviadas pelo aplicativo
móvel (via adaptador OBD-II/ELM327) e as disponibiliza ao painel web da oficina, para
diagnosticar defeitos elétricos **intermitentes** que não aparecem com o carro parado.

> **Status:** v2 em desenvolvimento (branch `v2`). Disponíveis: login com JWT, oficinas, usuários,
> veículos, sessões, **recepção de leituras em lote, histórico, transmissão ao vivo (SSE),
> detecção de quedas de tensão e métricas Prometheus**, além de documentação Swagger.

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
| PATCH | `/api/sessions/:id/end` | logado | encerra a sessão, analisa e grava anomalias |
| POST | `/api/sessions/:id/readings` | logado | envia lote de até 500 leituras (idempotente) |
| GET | `/api/sessions/:id/readings` | logado | histórico bruto ou resumido (`bucket`) |
| GET | `/api/sessions/:id/anomalies` | logado | quedas de tensão, calculadas na hora, limites ajustáveis |
| GET | `/api/sessions/:id/stream` | logado | transmissão ao vivo (Server-Sent Events) |
| POST | `/api/sessions/:id/dtcs` | logado | envia códigos de falha (idempotente) |
| GET | `/api/sessions/:id/dtcs` | logado | códigos da sessão com descrição em português |
| GET | `/api/anomalies` | logado | eventos de anomalia gravados da oficina |
| GET | `/metrics` | interno | métricas Prometheus (não exposto pelo Caddy) |

## Como a telemetria funciona
1. O app abre uma **sessão** (UUID gerado por ele) e envia **lotes** de leituras. Cada leitura
   tem `seq` e `time`, e a chave `(sessão, seq, time)` é única: reenviar um lote após uma queda
   de sinal não duplica nada.
2. As leituras vão para a tabela `readings`, uma *hypertable* do TimescaleDB. O histórico longo
   pode ser resumido no próprio banco com `bucket` (mínimo, média e máximo por intervalo).
3. Leituras novas são publicadas a quem está com a **transmissão ao vivo** aberta (SSE).
4. O **detector** procura quedas de tensão **com o motor girando** (padrão: abaixo de 13,0 V com
   rpm >= 700, por pelo menos 2 leituras seguidas). Roda ao encerrar a sessão e sob demanda, e os
   limites são ajustáveis por parâmetro. Os padrões são pontos de partida para calibrar em campo.

## Códigos de falha (DTC)
Além da tensão, o app lê os códigos que a central do veículo registrou (modo 03, confirmados; modo 07,
**pendentes**, detectados mas ainda não confirmados, o que ajuda em defeitos intermitentes).
A API guarda cada código com seu estado (`stored`, `pending` ou `permanent`) e devolve a descrição
em português a partir de um dicionário próprio ([`src/dtc.js`](src/dtc.js)) com os códigos genéricos
mais comuns, em especial os de **carga, bateria e partida** (P0560 a P0563, P0615 a P0622), marcados
como `electrical`. Códigos fora do dicionário são explicados pela estrutura (sistema, tipo e subsistema).
O painel mostra os códigos ao lado do gráfico de tensão.

## Simulador (demonstração)
Sem um carro à mão, `scripts/simulate.js` envia leituras de um alternador defeituoso
(14,2 V para 11,5 V a ~4000 rpm) e os códigos de falha correspondentes (P0562 pendente, depois
P0562 e P0622 confirmados), usando a API de verdade:
```bash
node scripts/simulate.js --url https://SEU_DOMINIO --email EMAIL --password SENHA          # tempo real
node scripts/simulate.js --url https://SEU_DOMINIO --email EMAIL --password SENHA --fast   # de uma vez
```
Sessões geradas por ele ficam marcadas com `source = simulator`.

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
