# Parse API

REST API for parsing with async job processing.

## Test Pipeline Locally (No Worker)

```bash
cd /Users/niall/Dev/win26-Team10
source .venv/bin/activate

# Run full pipeline (text_extract + standardize)
python -m api --pdf transcripts/niall.pdf

# Run individual steps
python -m api --step text_extract --pdf transcripts/niall.pdf
python -m api --step standardize --job-id <job_id>

# With custom job ID
python -m api --pdf transcripts/niall.pdf --job-id my-test-job

# Dry run (skip API calls)
python -m api --pdf transcripts/niall.pdf --dry-run
```

Output goes to `debug/<job_id>/`:
- `source.pdf` - Copy of input file
- `text.txt` - Extracted text (PyPDF2)
- `transcript.json` - Standardized transcript data

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
OPENROUTER_API_KEY=sk-or-...
REDUCTO_API_KEY=...  # Optional: only if using --step reducto
```

## SSL Issue

If you encounter SSL certificate errors:

```bash
python -m pip install -U certifi
export SSL_CERT_FILE="$(python -c 'import certifi; print(certifi.where())')"
```

## Testing the Pipeline
```bash
python -m api --pdf transcripts/niall.pdf --job-id test-niall-$(date +%s)
```