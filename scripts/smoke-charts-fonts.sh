#!/usr/bin/env bash
#
# Ejecuta el smoke de rasterizado contra una imagen de produccion ya construida.
#
# Uso: scripts/smoke-charts-fonts.sh [imagen]
set -euo pipefail

IMAGE="${1:-daily-race:smoke}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Comprobando el rasterizado de texto en ${IMAGE}"

# El script se monta bajo /app para que node resuelva @resvg/resvg-js desde el
# node_modules de la propia imagen, el mismo que usa la app en produccion
docker run --rm \
  --network none \
  -e NODE_ENV=production \
  -v "${SCRIPT_DIR}/smoke-charts-fonts.js:/app/smoke-charts-fonts.js:ro" \
  "${IMAGE}" node /app/smoke-charts-fonts.js
