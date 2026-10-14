# ADR 0004 - Autenticação JWT, validação com zod e documentação OpenAPI

**Status:** aceita

## Contexto
A API v1 não tinha login: qualquer pessoa lia e gravava dados. O sistema atende várias
oficinas, então precisa saber quem está chamando e isolar os dados de cada uma. Os
professores também precisam conseguir explorar a API sem instalar nada.

## Decisão
- **Login com JWT (HS256), sem estado.** O token leva o id do usuário, o id da oficina e o
  papel (admin, mecânico, motorista). Biblioteca `jose` em vez de assinar na mão.
- **Senhas com scrypt** do próprio Node (`node:crypto`), sem dependência extra.
- **Validação de entrada com zod**, que também normaliza (e-mail em minúsculas, placa sem hífen).
- **Documentação OpenAPI 3** servida em `/api/docs` (Swagger UI).
- **Rate limit, CORS e cabeçalhos de segurança** implementados em poucas linhas próprias,
  com testes, em vez de três pacotes adicionais.

## Consequências
- (+) Dados isolados por oficina; permissões por papel.
- (+) Sem sessão no servidor: simples de escalar e de testar.
- (-) Um JWT não pode ser revogado antes de expirar (por isso a validade curta, 8 h).
- (-) O rate limit em memória vale para uma única instância da API.
