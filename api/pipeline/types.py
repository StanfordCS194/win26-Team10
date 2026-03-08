"""
Pipeline types for parse jobs.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class ParseInput:
    """Input configuration for a parse pipeline run."""
    
    job_id: str
    file_id: str  # Supabase Storage file ID (or local path for CLI)
    output_dir: Path  # debug/<job_id>/
    dry_run: bool = False
    
    # For CLI usage with local files
    local_pdf_path: Path | None = None


@dataclass
class ParseArtifacts:
    """Accumulated outputs from pipeline steps."""
    
    input: ParseInput
    
    # Step outputs
    pdf_path: Path | None = None  # Downloaded/local PDF
    text_content: str | None = None  # Raw text extracted from PDF
    reducto_result: dict[str, Any] | None = None  # Reducto API result (optional)
    transcript: dict[str, Any] | None = None  # Extracted transcript data
    resume_raw: dict[str, Any] | None = None  # Extracted resume data
    resume_analysis: dict[str, Any] | None = None  # Resume analysis summary
    
    # Map of output name -> file path
    outputs: dict[str, Path] = field(default_factory=dict)
    
    # Errors encountered
    errors: list[str] = field(default_factory=list)
