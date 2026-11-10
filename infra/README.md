# Infraestrutura (produção)

Sobe quatro containers numa única máquina (AWS EC2, Ubuntu, Docker):

| Serviço | Imagem | Função | Exposto na internet? |
|---|---|---|---|
| `db` | timescale/timescaledb (PostgreSQL 16) | banco de dados | não |
| `api` | `ghcr.io/samuelmorsch/telemetria-api` (imagem do CI da API) | API REST | não (só via proxy) |
| `painel` | `ghcr.io/samuelmorsch/painel-telemetria-web` (imagem do CI do painel) | painel web (Next.js) | não (só via proxy) |
| `prometheus` | prom/prometheus | coleta as métricas da API a cada 15 s (retenção de 7 dias) | não |
| `caddy` | caddy:2-alpine | proxy reverso + HTTPS automático: `/api` vai para a API, o resto para o painel | sim, portas 80 e 443 |

## Pré-requisitos
- Docker e Docker Compose v2 instalados.
- Domínio apontando para o IP do servidor (DuckDNS ou outro).
- Portas 80 e 443 liberadas no Security Group da AWS.

## Como subir
```bash
cd infra
cp .env.example .env
nano .env                      # defina DOMAIN, POSTGRES_PASSWORD e JWT_SECRET
docker compose up -d
docker compose ps
curl https://SEU_DOMINIO/api/health
```
Documentação interativa da API: `https://SEU_DOMINIO/api/docs`.

## Atualizar uma versão já instalada

O CI (GitHub Actions) testa o código e publica as imagens da API e do painel no GitHub Container
Registry a cada merge na `main`. O servidor **busca** as imagens novas (o GitHub nunca se conecta a ele).

### Automático (recomendado)
O script `atualizar.sh` baixa as imagens novas e recria só os containers que mudaram. Agende no cron
do servidor para rodar a cada 5 minutos (`crontab -e`):

```cron
*/5 * * * * flock -n /tmp/telemetria-atualizar.lock sh $HOME/telemetria-api/infra/atualizar.sh >> $HOME/atualizar.log 2>&1
```

O `flock` impede duas execuções ao mesmo tempo. O histórico fica em `~/atualizar.log`.

### Manual
```bash
cd ~/telemetria-api && git pull     # só necessário se o docker-compose.yml ou o Caddyfile mudaram
cd infra
sh atualizar.sh
docker compose restart caddy        # só necessário se o Caddyfile mudou
```
As migrations novas da API são aplicadas sozinhas quando ela inicia.

### Voltar para uma versão anterior
Cada imagem também é publicada com o código curto do commit (ex.: `telemetria-api:2583d8b`).
Defina `API_TAG` (ou `PAINEL_TAG`) no `.env` com esse código e rode `docker compose up -d`.
Enquanto a variável estiver fixada, o `atualizar.sh` não troca a versão. Para voltar a acompanhar a
última, apague a linha ou use `main`.

As imagens (API e painel) precisam estar **públicas** no GitHub (perfil, Packages, o pacote,
Package settings, Change visibility), ou o servidor precisa fazer `docker login ghcr.io`.

## Observabilidade
A API expõe métricas no formato Prometheus em `GET /metrics` (**só pela rede interna**: o Caddy não
encaminha essa rota). O container `prometheus` as coleta a cada 15 segundos e guarda 7 dias, com
limite de 128 MB de memória (a máquina tem 1 GB).

**Conferir que está coletando** (no servidor, na pasta `infra`):
```bash
docker compose ps prometheus
docker compose exec prometheus wget -qO- 'http://localhost:9090/api/v1/query?query=up'
```
A resposta deve trazer `"value":[...,"1"]` para os `job` `telemetria-api` e `prometheus` (1 = no ar).

**Consumo de memória** (conferir depois de subir):
```bash
free -m
docker stats --no-stream
```

## Operação
```bash
docker compose logs -f api     # logs da API
docker compose restart api     # reinicia só a API
docker compose down            # para tudo (os dados ficam no volume db_data)
docker stats --no-stream       # consumo de memória
```

## Backup manual do banco
```bash
docker compose exec db pg_dump -U telemetria telemetria > backup_$(date +%F).sql
```

## Variáveis (`.env`)
| Variável | Obrigatória | Descrição |
|---|---|---|
| `DOMAIN` | sim | domínio servido pelo Caddy |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | sim | credenciais do banco |
| `JWT_SECRET` | sim | segredo (32+ caracteres) que assina os tokens de login |
| `API_TAG` | não | tag da imagem da API (`main` por padrão); use o código de um commit para fixar uma versão |
| `PAINEL_TAG` | não | tag da imagem do painel (`main` por padrão; `v2` durante o desenvolvimento) |
| `JWT_EXPIRES_IN` | não | validade do token (padrão `8h`) |
| `CORS_ORIGINS` | não | origens de navegador permitidas, separadas por vírgula |
| `REGISTRATION_ENABLED` | não | `false` fecha o cadastro público de oficinas |

O arquivo `.env` está no `.gitignore` e nunca deve ser enviado ao repositório.

Decisões de arquitetura: ver [`../docs/adr`](../docs/adr).
