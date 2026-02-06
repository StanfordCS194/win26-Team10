"""
Reducto step - calls Reducto API to parse PDF.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from reducto import Reducto

from api.pipeline.steps.base import ParseStep
from api.pipeline.types import ParseArtifacts


class ReductoStep(ParseStep):
    """Call Reducto API to parse a PDF document."""
    
    name = "reducto"
    
    def __init__(self, api_key: str | None = None):
        super().__init__()
        self.api_key = api_key or os.getenv("REDUCTO_API_KEY")
    
    def run(self, artifacts: ParseArtifacts) -> ParseArtifacts:
        """
        Run Reducto parsing on the PDF.
        
        Expects artifacts.pdf_path to be set (by executor or previous step).
        Saves result to output_dir/reducto.json.
        """
        if artifacts.input.dry_run:
            self.logger.info("Dry run - skipping Reducto API call")
            artifacts.reducto_result = {"dry_run": True}
            return artifacts
        
        pdf_path = artifacts.pdf_path
        if not pdf_path or not pdf_path.exists():
            raise ValueError(f"PDF not found at {pdf_path}")
        
        self.logger.info(f"Calling Reducto API for {pdf_path}")
        
        # Initialize client
        client = Reducto(api_key=self.api_key) if self.api_key else Reducto()
        
        # Upload file
        upload = client.upload(file=pdf_path)
        
        # Parse the uploaded file
        result = client.parse.run(input=upload.file_id)
        
        # Convert result to dict
        payload: dict[str, Any] = (
            result.model_dump()
            if hasattr(result, "model_dump")
            else result.dict()
            if hasattr(result, "dict")
            else dict(result)
        )
        
        # Save to output
        output_path = artifacts.input.output_dir / "reducto.json"
        output_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2, default=str),
            encoding="utf-8",
        )
        
        artifacts.reducto_result = payload
        artifacts.outputs["reducto"] = output_path
        
        self.logger.info(f"Reducto result saved to {output_path}")
        
        return artifacts
