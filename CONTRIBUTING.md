# Como contribuir

Obrigado pelo interesse! Este repositório é a API do sistema de telemetria automotiva remota
(veja o [README](README.md) para a visão geral). Correções e sugestões são bem-vindas.

## Preparando o ambiente
Requer Node 22+ e um PostgreSQL com TimescaleDB (o container de [`infra/`](infra) serve).

```bash
npm install
cp .env.example .env     # defina DATABASE_URL e JWT_SECRET (mínimo de 32 caracteres)
npm run dev
npm test                 # testes + relatório de cobertura
```

Os testes usam um banco falso em memória e não precisam do PostgreSQL.

## Fluxo de trabalho
1. Crie uma branch a partir da `main`, com um nome que diga o que muda (`feat/...`, `fix/...`).
2. Faça as alterações **com testes** quando mudar comportamento.
3. Mensagens de commit seguem o padrão do histórico: `feat:`, `fix:`, `ci:`, `docs:`,
   `refactor:`, `build:` ou `chore:`, seguido de uma frase curta.
4. Abra um Pull Request para a `main`. Ele só deve ser juntado quando:
   - o **CI** estiver verde (testes e imagem Docker);
   - o **SonarQube Cloud** não apontar problemas novos.
5. Mudanças de arquitetura relevantes ganham uma nova [ADR](docs/adr) explicando o contexto, a
   decisão e as consequências.

## Segurança
- **Nunca** faça commit do arquivo `.env`, de senhas ou de tokens.
- Para relatar uma vulnerabilidade, escreva para samuel.morsch@catolicasc.edu.br em vez de abrir
  uma issue pública.

## Atenção ao fazer merge
Cada merge na `main` é publicado em produção em poucos minutos, e a API reinicia por alguns
segundos. Evite juntar durante testes de campo.
