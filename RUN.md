# Parse API

REST API for parsing with async job processing.

## Test Pipeline Locally (No Worker)

Run the pipeline directly on a PDF file:

```bash
cd /Users/niall/Dev/win26-Team10
source .venv/bin/activate

# Run pipeline on a PDF
python -m api --pdf /path/to/your/file.pdf

# With custom job ID
python -m api --pdf /path/to/your/file.pdf --job-id my-test-job

# Dry run (skip API calls)
python -m api --pdf /path/to/your/file.pdf --dry-run
```

Output goes to `debug/<job_id>/`:
- `input.pdf` - Copy of input file
- `reducto.json` - Reducto API response

## Quick Launch (Full Stack)

```bash
# Terminal 1: API server
cd /Users/niall/Dev/win26-Team10
source .venv/bin/activate
uvicorn api.main:app --reload --port 8000

# Terminal 2: Parse worker (processes /parse jobs)
cd /Users/niall/Dev/win26-Team10
source .venv/bin/activate
python -m api.parse

# Extra: start supabase
# Make sure docker desktop is running
supabase start
```

## Environment

Add to `api/.env`:

```
REDUCTO_API_KEY=your-reducto-api-key
```

## SSL Issue

If you encounter SSL certificate errors:

```bash
python -m pip install -U certifi
export SSL_CERT_FILE="$(python -c 'import certifi; print(certifi.where())')"
```
