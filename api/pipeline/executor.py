"""
Pipeline executor - runs steps in sequence.
"""

from __future__ import annotations

import logging
import shutil
from pathlib import Path

from api.pipeline.steps.base import ParseStep
from api.pipeline.types import ParseArtifacts, ParseInput

logger = logging.getLogger("pipeline.executor")


class ParseExecutor:
    """Executes parse pipeline steps in sequence."""
    
    def __init__(self, steps: list[ParseStep]):
        self.steps = steps
    
    def run(
        self,
        parse_input: ParseInput,
        artifacts: ParseArtifacts | None = None,
    ) -> ParseArtifacts:
        """
        Run the pipeline with the given input.
        
        Args:
            parse_input: Pipeline input configuration
            artifacts: Optional existing artifacts to continue from
            
        Returns:
            Final artifacts after all steps complete
        """
        # Create output directory
        parse_input.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize artifacts
        if artifacts is None:
            artifacts = ParseArtifacts(input=parse_input)
        
        # Set up PDF path
        if parse_input.local_pdf_path:
            dest = parse_input.output_dir / "input.pdf"
            # Only copy if source and dest are different
            if parse_input.local_pdf_path.resolve() != dest.resolve():
                shutil.copy(parse_input.local_pdf_path, dest)
                logger.info(f"Copied local PDF to {dest}")
            artifacts.pdf_path = dest
            artifacts.outputs["input_pdf"] = dest
        
        logger.info(f"Starting pipeline for job {parse_input.job_id}")
        logger.info(f"Output directory: {parse_input.output_dir}")
        
        # Run each step
        for step in self.steps:
            logger.info(f"Running step: {step.name}")
            
            if step.should_skip(artifacts):
                logger.info(f"Skipping step: {step.name}")
                continue
            
            try:
                artifacts = step.run(artifacts)
                logger.info(f"Completed step: {step.name}")
            except Exception as e:
                error_msg = f"Step {step.name} failed: {e}"
                logger.error(error_msg)
                artifacts.errors.append(error_msg)
                raise
        
        logger.info(f"Pipeline complete for job {parse_input.job_id}")
        return artifacts
