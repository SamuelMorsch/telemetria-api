# Infraestrutura (produção)

Sobe quatro containers numa única máquina (AWS EC2, Ubuntu, Docker):

| Serviço | Imagem | Função | Exposto na internet? |
|---|---|---|---|
| `db` | timescale/timescaledb (PostgreSQL 16) | banco de dados | não |
| `api` | construída a partir do `Dockerfile` da raiz | API REST | não (só via proxy) |
| `painel` | `ghcr.io/samuelmorsch/painel-telemetria-web` (imagem do CI do painel) | painel web (Next.js) | não (só via proxy) |
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
docker compose up -d --build
docker compose ps
curl https://SEU_DOMINIO/api/health
```
Documentação interativa da API: `https://SEU_DOMINIO/api/docs`.

## Atualizar uma versão já instalada
```bash
cd ~/telemetria-api && git pull
cd infra
docker compose pull painel          # baixa a imagem nova do painel (publicada pelo CI)
docker compose up -d --build        # reconstrói a API e recria o que mudou
docker compose restart caddy        # só necessário se o Caddyfile mudou
```
As migrations novas da API são aplicadas sozinhas quando ela inicia.

O pacote da imagem do painel precisa estar **público** no GitHub (perfil, Packages, painel-telemetria-web,
Package settings, Change visibility), ou o servidor precisa fazer `docker login ghcr.io`.

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
| `PAINEL_TAG` | não | tag da imagem do painel (`main` por padrão; `v2` durante o desenvolvimento) |
| `JWT_EXPIRES_IN` | não | validade do token (padrão `8h`) |
| `CORS_ORIGINS` | não | origens de navegador permitidas, separadas por vírgula |
| `REGISTRATION_ENABLED` | não | `false` fecha o cadastro público de oficinas |

O arquivo `.env` está no `.gitignore` e nunca deve ser enviado ao repositório.

Decisões de arquitetura: ver [`../docs/adr`](../docs/adr).
