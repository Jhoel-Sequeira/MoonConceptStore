#!/usr/bin/env bash
set -euo pipefail

BACKEND_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
VENV_DIR="$BACKEND_DIR/.venv"
PYTHON_BIN="${PYTHON_BIN:-python3}"

if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  echo "No se encontró $PYTHON_BIN. Instala Python 3 o define PYTHON_BIN." >&2
  exit 1
fi

if [[ ! -x "$VENV_DIR/bin/python" ]]; then
  "$PYTHON_BIN" -m venv "$VENV_DIR"
  "$VENV_DIR/bin/python" -m pip install --upgrade pip
  "$VENV_DIR/bin/python" -m pip install -r "$BACKEND_DIR/requirements.txt"
elif ! "$VENV_DIR/bin/python" -c 'import gunicorn, uvicorn_worker' >/dev/null 2>&1; then
  "$VENV_DIR/bin/python" -m pip install -r "$BACKEND_DIR/requirements.txt"
fi

cd "$BACKEND_DIR"
exec "$VENV_DIR/bin/gunicorn" main:app \
  --worker-class uvicorn_worker.UvicornWorker \
  --workers "${WEB_CONCURRENCY:-2}" \
  --bind "${HOST:-0.0.0.0}:${PORT:-8000}"
