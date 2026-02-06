# Parse API

REST API for parsing with async job processing.

## Quick Launch (Local Development)

Run all commands from the `backend/` directory.

```bash
cd backend

# Terminal 1: API server
source .venv/bin/activate
uvicorn api.main:app --reload --port 8000

# Terminal 2: Parse worker (processes /parse jobs)
source .venv/bin/activate
python -m api.parse
```

## SSL Issue

If you encounter SSL certificate errors:

```bash
python -m pip install -U certifi
export SSL_CERT_FILE="$(python -c 'import certifi; print(certifi.where())')"
```
