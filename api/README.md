# Parse Pipeline CLI

Run the transcript parsing pipeline locally via the command line.

## Quick Start

```bash
# Activate virtual environment
source .venv/bin/activate

# Run full pipeline on a PDF
python -m api --pdf transcripts/niall.pdf
```

## Pipeline Steps

The default pipeline:
1. **TextExtractStep** - Extract raw text from PDF using PyPDF2
2. **TranscriptStandardizeStep** - Use LLM to convert text to structured transcript JSON

## Commands

### Full Pipeline

```bash
# Run complete pipeline (text extraction + LLM)
python -m api --pdf transcripts/niall.pdf

# With custom job ID
python -m api --pdf transcripts/niall.pdf --job-id my-test-job

# Dry run (skip API calls)
python -m api --pdf transcripts/niall.pdf --dry-run
```

### Individual Steps

```bash
# Run only text extraction (PyPDF2)
python -m api --step text_extract --pdf transcripts/niall.pdf

# Run only standardization on existing job
python -m api --step standardize --job-id fe92fa081417

# Run only Reducto text extraction (API call)
python -m api --step reducto --pdf transcripts/niall.pdf
```

## Output

All outputs are saved to `debug/<job_id>/`:

```
debug/<job_id>/
├── source.pdf          # Copy of input PDF
├── text.txt            # Extracted text (from TextExtractStep)
├── transcript.json     # Final structured transcript
└── standardize/
    ├── request.json    # LLM API request payload
    └── response.json   # LLM API response
```

## Environment Variables

Create `api/.env` with:

```env
OPENROUTER_API_KEY=sk-or-...
REDUCTO_API_KEY=...        # Only if using ReductoStep
```

## Examples

### Test Full Pipeline

```bash
python -m api --pdf transcripts/niall.pdf
```

### Re-run Standardization

If you want to re-run just the LLM step on existing extracted text:

```bash
python -m api --step standardize --job-id a9d6b99f0fa6
```

### Using Reducto Instead of PyPDF2

The default pipeline uses PyPDF2 for text extraction. To use Reducto API instead:

```bash
# Run Reducto step
python -m api --step reducto --pdf transcripts/niall.pdf

# Then run standardize on the Reducto output
python -m api --step standardize --job-id <job_id_from_above>
```

## CLI Options

| Option | Description |
|--------|-------------|
| `--step` | Step to run: `pipeline` (default), `text_extract`, `reducto`, `standardize` |
| `--pdf` | Path to PDF file (required for pipeline/text_extract/reducto) |
| `--job-id` | Job ID (required for standardize, auto-generated otherwise) |
| `--output-dir` | Custom output directory (default: `debug/<job_id>`) |
| `--dry-run` | Skip API calls (for testing) |
