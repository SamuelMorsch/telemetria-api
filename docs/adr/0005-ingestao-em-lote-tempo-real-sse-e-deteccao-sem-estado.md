# ADR 0005 - Ingestão em lote, tempo real por SSE e detecção sem estado

**Status:** aceita

## Contexto
O celular do motorista perde sinal, e o painel da oficina precisa ver a tensão enquanto o
carro circula. O artigo propunha polling ou WebSockets e um banco de série temporal.

## Decisão
- **Lotes idempotentes.** O app envia até 500 leituras por requisição. A chave única
  `(sessão, seq, time)` com `ON CONFLICT DO NOTHING` torna o reenvio seguro, o que permite
  um buffer offline no app sem risco de duplicar dados.
- **Server-Sent Events (SSE) em vez de WebSockets.** O fluxo é só do servidor para o painel, o
  SSE usa HTTP comum (funciona atrás do Caddy e reconecta sozinho) e é bem mais simples.
  A autenticação usa o cabeçalho Authorization (o painel lê com `fetch`), evitando colocar o
  token na URL, onde ele ficaria nos logs. Barramento em memória, suficiente para uma instância.
- **Detecção sem estado.** O detector é uma função pura aplicada às leituras da sessão
  (ao encerrar e sob demanda), em vez de um processo incremental com estado. Evita eventos
  duplicados ou cortados entre lotes, e é fácil de testar e de explicar.
- **Regra com o motor girando.** Tensão baixa só conta se rpm >= 700, porque com o motor
  desligado ~12,4 V é normal. Limites ajustáveis, a calibrar na validação em campo.
- **Métricas próprias** em formato Prometheus (sem biblioteca extra), em `/metrics`, que o
  Caddy não encaminha: ficam visíveis só dentro da rede do Docker.

## Consequências
- (+) Tolerante a falhas de rede, simples de operar e de defender na banca.
- (-) Em tempo real a detecção não alerta no instante: o painel vê a curva ao vivo, e a
  consulta de anomalias recalcula quando pedida.
- (-) O barramento em memória não funciona com várias instâncias da API (precisaria de Redis
  ou LISTEN/NOTIFY).
- (-) O ELM327 amostra poucas vezes por segundo; quedas mais curtas que o intervalo de
  amostragem podem passar despercebidas. A taxa real será medida e documentada.
