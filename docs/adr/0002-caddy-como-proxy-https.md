# ADR 0002 - Caddy como proxy reverso e HTTPS

**Status:** aceita

## Contexto
A API e o painel precisam responder em HTTPS num domínio. O app Android bloqueia HTTP
puro, e a versão 1 usava HTTP direto no IP. A alternativa clássica é nginx + certbot
(dois serviços, renovação por cron).

## Decisão
Usar o Caddy, que emite e renova certificados Let's Encrypt automaticamente com um
arquivo de configuração de poucas linhas.

## Consequências
- (+) Menos peças para manter e para explicar; usa pouca memória (limite de 64 MB).
- (+) Renovação de certificado sem intervenção.
- (-) Menos conhecido que o nginx no mercado; a configuração equivalente existe se necessário.
