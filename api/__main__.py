"""
CLI entry point for running the parse pipeline locally.

Usage:
    python -m api --pdf test.pdf
    python -m api --pdf test.pdf --job-id abc123
    python -m api --pdf test.pdf --dry-run
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# Load environment variables from api/.env
env_file = Path(__file__).parent / ("prod.env" if os.getenv("PROD") else ".env")
load_dotenv(env_file)

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

from api.pipeline import run_pipeline


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Run parse pipeline on a PDF file.",
    )
    parser.add_argument(
        "--pdf",
        type=str,
        required=True,
        help="Path to PDF file to process",
    )
    parser.add_argument(
        "--job-id",
        type=str,
        default=None,
        help="Job ID (generated if not provided)",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default=None,
        help="Output directory (defaults to debug/<job_id>)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Skip API calls (useful for testing)",
    )
    
    args = parser.parse_args(argv)
    
    # Validate PDF exists
    pdf_path = Path(args.pdf)
    if not pdf_path.exists():
        print(f"Error: PDF not found: {pdf_path}", file=sys.stderr)
        return 1
    
    try:
        artifacts = run_pipeline(
            job_id=args.job_id,
            local_pdf_path=pdf_path,
            output_dir=args.output_dir,
            dry_run=args.dry_run,
        )
        
        print("\n=== Pipeline Complete ===")
        print(f"Job ID: {artifacts.input.job_id}")
        print(f"Output: {artifacts.input.output_dir}")
        print(f"Outputs: {list(artifacts.outputs.keys())}")
        
        if artifacts.errors:
            print(f"Errors: {artifacts.errors}")
            return 1
        
        return 0
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
