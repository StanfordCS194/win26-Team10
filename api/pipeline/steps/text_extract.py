"""
Text extraction step - uses PyPDF2 to extract raw text from PDF.

This is a simpler alternative to ReductoStep that doesn't require an API call.
"""

from __future__ import annotations

from PyPDF2 import PdfReader

from api.pipeline.steps.base import ParseStep
from api.pipeline.types import ParseArtifacts


class TextExtractStep(ParseStep):
    """Extract raw text from PDF using PyPDF2."""

    name = "text_extract"

    def run(self, artifacts: ParseArtifacts) -> ParseArtifacts:
        """
        Extract text from PDF using PyPDF2.

        Expects artifacts.pdf_path to be set (by executor or previous step).
        Saves result to output_dir/text.txt and populates artifacts.text_content.
        """
        if artifacts.input.dry_run:
            self.logger.info("Dry run - skipping text extraction")
            artifacts.text_content = "[dry run]"
            return artifacts

        pdf_path = artifacts.pdf_path
        if not pdf_path or not pdf_path.exists():
            raise ValueError(f"PDF not found at {pdf_path}")

        self.logger.info("Extracting text from %s", pdf_path)

        # Read PDF and extract text from each page
        reader = PdfReader(pdf_path)
        text_parts = []

        for i, page in enumerate(reader.pages):
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
            self.logger.debug(
                "Extracted %d chars from page %d", len(page_text or ""), i + 1
            )

        text_content = "\n\n".join(text_parts)
        self.logger.info(
            "Extracted %d chars total from %d pages",
            len(text_content),
            len(reader.pages),
        )

        # Save to output
        output_path = artifacts.input.output_dir / "text.txt"
        output_path.write_text(text_content, encoding="utf-8")

        artifacts.text_content = text_content
        artifacts.outputs["text"] = output_path

        self.logger.info("Text saved to %s", output_path)

        return artifacts
