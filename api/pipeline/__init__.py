"""
Parse pipeline module.

Usage:
    from api.pipeline import run_pipeline
    
    artifacts = run_pipeline(
        job_id="abc123",
        file_id="storage-file-id",
    )
"""

from __future__ import annotations

import uuid
from pathlib import Path
from typing import Iterable

from api.pipeline.executor import ParseExecutor
from api.pipeline.steps import ParseStep, ReductoStep
from api.pipeline.types import ParseArtifacts, ParseInput


def default_output_dir(job_id: str) -> Path:
    """Get default output directory for a job."""
    repo_root = Path(__file__).resolve().parents[2]
    return repo_root / "debug" / job_id


def default_steps() -> list[ParseStep]:
    """
    Default pipeline steps.
    
    Currently:
    - ReductoStep: Parse PDF using Reducto API
    """
    return [
        ReductoStep(),
    ]


def run_pipeline(
    *,
    job_id: str | None = None,
    file_id: str | None = None,
    local_pdf_path: str | Path | None = None,
    output_dir: str | Path | None = None,
    dry_run: bool = False,
    steps: Iterable[ParseStep] | None = None,
    artifacts: ParseArtifacts | None = None,
) -> ParseArtifacts:
    """
    Run the parse pipeline.
    
    Args:
        job_id: Job identifier (generated if not provided)
        file_id: Supabase Storage file ID
        local_pdf_path: Local PDF path (for CLI usage)
        output_dir: Output directory (defaults to debug/<job_id>)
        dry_run: Skip API calls if True
        steps: Custom steps (defaults to default_steps())
        artifacts: Existing artifacts to continue from
        
    Returns:
        Pipeline artifacts with all outputs
    """
    # Generate job_id if not provided
    if job_id is None:
        job_id = uuid.uuid4().hex[:12]
    
    # Resolve output directory
    resolved_output_dir = (
        Path(output_dir).resolve()
        if output_dir is not None
        else default_output_dir(job_id)
    )
    
    # Build input
    parse_input = ParseInput(
        job_id=job_id,
        file_id=file_id or "",
        output_dir=resolved_output_dir,
        dry_run=dry_run,
        local_pdf_path=Path(local_pdf_path).resolve() if local_pdf_path else None,
    )
    
    # Run pipeline
    executor = ParseExecutor(list(steps) if steps is not None else default_steps())
    return executor.run(parse_input=parse_input, artifacts=artifacts)


__all__ = [
    "run_pipeline",
    "ParseExecutor",
    "ParseStep",
    "ReductoStep",
    "ParseInput",
    "ParseArtifacts",
    "default_steps",
]
