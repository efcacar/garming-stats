#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  cat <<'EOF'
Uso: ./start.sh [opciones de sync.py]

Opciones habituales:
  --limit N   Sincroniza como máximo N actividades
  --force     Vuelve a descargar y sobrescribe actividades ya guardadas
  --help      Muestra esta ayuda

Ejemplos:
  ./start.sh
  ./start.sh --limit 20
  ./start.sh --limit 20 --force
EOF
  exit 0
fi

if [[ ! -f .env ]]; then
  echo "Falta el archivo .env. Cópialo desde .env.example y configura tus credenciales de Garmin." >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "No se encontró python3. Instala Python 3 para sincronizar los datos de Garmin." >&2
  exit 1
fi

if [[ ! -x .venv/bin/python ]]; then
  echo "Creando el entorno de Python e instalando dependencias..."
  python3 -m venv .venv
  .venv/bin/python -m pip install -r fetch/requirements.txt
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "No se encontró npm. Instala Node.js para poder arrancar el frontend." >&2
  exit 1
fi

if [[ ! -d node_modules ]]; then
  echo "Instalando dependencias del frontend..."
  npm install
fi

echo "Sincronizando datos de Garmin..."
.venv/bin/python fetch/sync.py "$@"

echo "Arrancando el frontend..."
npm run dev
