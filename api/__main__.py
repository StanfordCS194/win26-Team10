"""
CLI entry point for running the parse pipeline locally.

Usage:
    # Run full pipeline (text_extract + standardize)
    python -m api --pdf transcripts/niall.pdf
    
    # Run individual steps
    python -m api --step text_extract --pdf transcripts/niall.pdf
    python -m api --step standardize --job-id a9d6b99f0fa6
    
    # Options
    python -m api --pdf test.pdf --job-id my-job
    python -m api --pdf test.pdf --dry-run
"""

from __future__ import annotations

import argparse
import json
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

from api.pipeline import (
    run_pipeline,
    ReductoStep,
    TextExtractStep,
    TranscriptStandardizeStep,
    TranscriptStatisticsStep,
    TranscriptAnalysisStep,
    ParseInput,
    ParseArtifacts,
    default_output_dir,
)


async def run_analyze_step(args) -> int:
    """Run only the post-standardize steps (Statistics + Analysis) on existing transcript.json."""
    if not args.job_id:
        print("Error: --job-id is required for analyze step", file=sys.stderr)
        return 1
    
    # Determine output directory
    if args.output_dir:
        output_dir = Path(args.output_dir).resolve()
    else:
        output_dir = default_output_dir(args.job_id)
    
    # Look for existing transcript output
    transcript_path = output_dir / "transcript.json"
    
    if not transcript_path.exists():
        print(f"Error: No transcript.json found in {output_dir}", file=sys.stderr)
        print("Run standardize first: python -m api --step standardize --job-id <id>", file=sys.stderr)
        return 1
    
    try:
        transcript = json.loads(transcript_path.read_text(encoding="utf-8"))
        
        # Create artifacts with existing transcript
        parse_input = ParseInput(
            job_id=args.job_id,
            file_id="",
            output_dir=output_dir,
            dry_run=args.dry_run,
        )
        artifacts = ParseArtifacts(
            input=parse_input,
            transcript=transcript,
        )
        
        # Run statistics step
        print("Running TranscriptStatisticsStep...")
        stats_step = TranscriptStatisticsStep()
        artifacts = stats_step.run(artifacts)
        
        # Run analyze step
        print("Running TranscriptAnalysisStep...")
        analysis_step = TranscriptAnalysisStep()
        artifacts = analysis_step.run(artifacts)
        
        print("\n=== Post-Standardize Analysis Complete ===")
        print(f"Job ID: {args.job_id}")
        print(f"Statistics Output: {artifacts.outputs.get('statistics_summary')}")
        print(f"Analysis Output: {artifacts.outputs.get('analysis_report')}")

        return 0
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


def run_text_extract_step(args) -> int:
    """Run only the TextExtractStep (PyPDF2)."""
    if not args.pdf:
        print("Error: --pdf is required for text_extract step", file=sys.stderr)
        return 1
    
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
            steps=[TextExtractStep()],
        )
        
        print("\n=== Text Extract Step Complete ===")
        print(f"Job ID: {artifacts.input.job_id}")
        print(f"Output: {artifacts.outputs.get('text')}")
        return 0
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


def run_reducto_step(args) -> int:
    """Run only the Reducto step (API call)."""
    if not args.pdf:
        print("Error: --pdf is required for reducto step", file=sys.stderr)
        return 1
    
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
            steps=[ReductoStep()],
        )
        
        print("\n=== Reducto Step Complete ===")
        print(f"Job ID: {artifacts.input.job_id}")
        print(f"Output: {artifacts.outputs.get('reducto')}")
        return 0
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


def run_standardize_step(args) -> int:
    """Run only the Standardize step on existing PDF."""
    if not args.job_id:
        print("Error: --job-id is required for standardize step", file=sys.stderr)
        return 1
    
    # Determine output directory
    if args.output_dir:
        output_dir = Path(args.output_dir).resolve()
    else:
        output_dir = default_output_dir(args.job_id)
    
    # Look for existing PDF output
    pdf_path = output_dir / "input.pdf"
    
    if not pdf_path.exists():
        if args.pdf:
            pdf_path = Path(args.pdf)
            if not pdf_path.exists():
                print(f"Error: PDF not found: {pdf_path}", file=sys.stderr)
                return 1
        else:
            print(f"Error: No input.pdf found in {output_dir}", file=sys.stderr)
            print("Run pipeline first or provide --pdf", file=sys.stderr)
            return 1
    
    try:
        # Create artifacts with existing PDF
        parse_input = ParseInput(
            job_id=args.job_id,
            file_id="",
            output_dir=output_dir,
            dry_run=args.dry_run,
        )
        artifacts = ParseArtifacts(
            input=parse_input,
            pdf_path=pdf_path,
        )
        
        # Run standardize step
        step = TranscriptStandardizeStep()
        artifacts = step.run(artifacts)
        
        print("\n=== Standardize Step Complete ===")
        print(f"Job ID: {args.job_id}")
        print(f"Output: {artifacts.outputs.get('transcript')}")
        return 0
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


def run_full_pipeline(args) -> int:
    """Run the full pipeline."""
    if not args.pdf:
        print("Error: --pdf is required for pipeline step", file=sys.stderr)
        return 1
    
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


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Run parse pipeline on PDF transcripts.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run full pipeline (standardize + statistics + analysis)
  python -m api --pdf transcripts/niall.pdf
  
  # Run only standardization (requires existing input.pdf)
  python -m api --step standardize --job-id a9d6b99f0fa6
""",
    )
    parser.add_argument(
        "--step",
        type=str,
        choices=["pipeline", "standardize", "analyze"],
        default="pipeline",
        help="Step to run: pipeline (default), standardize, or analyze",
    )
    parser.add_argument(
        "--pdf",
        type=str,
        default=None,
        help="Path to PDF file (required for pipeline/text_extract/reducto)",
    )
    parser.add_argument(
        "--job-id",
        type=str,
        default=None,
        help="Job ID (required for standardize, optional otherwise)",
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
    
    if args.step == "standardize":
        return run_standardize_step(args)
    elif args.step == "analyze":
        import asyncio
        return asyncio.run(run_analyze_step(args))
    else:  # pipeline
        return run_full_pipeline(args)


if __name__ == "__main__":
    sys.exit(main())
