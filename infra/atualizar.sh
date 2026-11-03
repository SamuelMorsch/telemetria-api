#!/bin/sh
# Atualiza a API e o painel para as imagens mais recentes publicadas pelo CI.
# Pode ser executado à mão ou agendado no cron (ver infra/README.md).
# Se nada mudou, nada é recriado.
set -eu
export PATH=/usr/local/bin:/usr/bin:/bin
cd "$(dirname "$0")"

echo "[$(date '+%F %T')] verificando imagens novas"
docker compose pull --quiet api painel
docker compose up -d --remove-orphans
docker image prune -f > /dev/null
echo "[$(date '+%F %T')] concluído"
