#!/bin/sh
set -e

SERVICE_TYPE="${SERVICE_TYPE:-api}"

case "$SERVICE_TYPE" in
  api)
    PORT="${PORT:-8080}"
    echo "Starting API server on port $PORT"
    exec uvicorn api.main:app --host 0.0.0.0 --port "$PORT" --workers 1
    ;;
  worker-parse)
    echo "Starting parse worker..."
    exec python -m api.parse
    ;;
  *)
    echo "ERROR: Unknown SERVICE_TYPE '$SERVICE_TYPE'"
    exit 1
    ;;
esac
