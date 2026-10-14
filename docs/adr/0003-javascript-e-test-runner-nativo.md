# ADR 0003 - JavaScript (ESM) e test runner nativo do Node

**Status:** aceita (revisável)

## Contexto
A API v1 já era Node.js/JavaScript. Frameworks de teste adicionam dependências e
configuração (Jest com ESM exige flags extras).

## Decisão
Manter JavaScript com módulos ES e usar `node:test`, o runner embutido no Node 22, com
cobertura (`--experimental-test-coverage`). Dependências de produção: apenas `express` e `pg`.

## Consequências
- (+) Menos dependências e superfície de ataque; testes rápidos.
- (+) Menos conceitos novos para defender na prova de autoria.
- (-) Sem tipagem estática. Migrar para TypeScript continua possível depois.
