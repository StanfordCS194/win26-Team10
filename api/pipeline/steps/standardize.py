"""
Standardize step - uses LLM to convert PDF text to standardized JSON.

Supports two input sources:
1. artifacts.text_content (from TextExtractStep, preferred)
2. artifacts.reducto_result (from ReductoStep, fallback)
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any

import httpx

from api.pipeline.steps.base import ParseStep
from api.pipeline.types import ParseArtifacts


# fmt: off
SYSTEM_PROMPT = """You are a transcript data extraction assistant. Your task is to extract structured data from a parsed PDF transcript and output it as JSON according to a specific schema.

## Output Schema

You must output a JSON object with these fields:

```
{
  "schema_version": "1.0",
  "source_format": "<institution_type>_<official/unofficial>",
  "student": {
    "name": "<full name>",
    "student_id": "<id or null>",
    "additional": {}
  },
  "institution": {
    "name": "<institution name>",
    "location": "<address or null>",
    "transcript_type": "<type or null>",
    "print_date": "<date or null>"
  },
  "programs": [
    {
      "name": "<program name>",
      "degree": "<BS/BA/MS/PhD/etc or null>",
      "level": "<undergraduate/graduate>",
      "status": "<active/completed/withdrawn>",
      "start_date": "<date or null>",
      "end_date": "<date or null>",
      "subplans": ["<concentration/track>"],
      "advisor": "<name or null>",
      "notes": []
    }
  ],
  "transfer_credits": [
    {
      "source": "<source institution/exam>",
      "equivalency": "<equivalent course or null>",
      "units": <number or null>,
      "applied_to": "<program or null>"
    }
  ],
  "terms": [
    {
      "name": "<term name, e.g. 2022-2023 Autumn>",
      "year": "<academic year>",
      "season": "<Autumn/Winter/Spring/Summer/Fall>",
      "level": "<undergraduate/graduate>",
      "courses": [
        {
          "department": "<dept code>",
          "number": "<course number>",
          "component": "<component code, e.g. LEC/SEM/LAB/DIS/COL/ACT/INS or null>",
          "title": "<course title>",
          "instructors": ["<instructor names>"],
          "units_attempted": <number>,
          "units_earned": <number>,
          "grade": "<grade>",
          "grade_points": <number or null for S/NC grades>,
          "notes": []
        }
      ],
      "statistics": {
        "term_gpa": <number>,
        "cumulative_gpa": <number>,
        "units_attempted": <number>,
        "units_earned": <number>,
        "cumulative_units_attempted": <number>,
        "cumulative_units_earned": <number>
      }
    }
  ],
  "career_totals": {
    "undergraduate": {
      "gpa": <number>,
      "units_attempted": <number>,
      "units_earned": <number>,
      "units_toward_degree": <number or null>,
      "institution_units": <number or null>
    },
    "graduate": <same structure or null>
  },
  "notes": ["<any additional info that doesn't fit elsewhere>"]
}
```

## Instructions
1. Extract ALL information from the transcript content
2. Use null for missing/unknown fields
3. Parse ALL terms and ALL courses within each term
4. Include transfer credits if present
5. Capture any notes or special annotations
6. Output ONLY valid JSON, no markdown or explanations"""
# fmt: on


def extract_text_from_reducto(reducto_result: dict[str, Any]) -> str:
    """
    Extract text content from Reducto result for LLM processing.

    Uses chunk-level 'content' field instead of iterating through blocks.
    This saves tokens and improves performance since the chunk content
    already contains all text in markdown format.
    """
    content_parts = []

    result = reducto_result.get("result", {})
    chunks = result.get("chunks", [])

    for chunk in chunks:
        content = chunk.get("content", "")
        if content:
            content_parts.append(content)

    return "\n\n".join(content_parts)


class StandardizeStep(ParseStep):
    """Use LLM to convert text into standardized transcript JSON."""

    name = "standardize"

    def __init__(
        self,
        model: str | None = None,
        api_key: str | None = None,
    ):
        super().__init__()
        self.model = model or os.getenv("MODEL_ID") or "openai/gpt-oss-120b"
        self.api_key = api_key or os.getenv("OPENROUTER_API_KEY")
        self.api_url = "https://openrouter.ai/api/v1/chat/completions"

    def should_skip(self, artifacts: ParseArtifacts) -> bool:
        """Skip if transcript already exists in output directory."""
        output_path = artifacts.input.output_dir / "transcript.json"
        if output_path.exists():
            try:
                if not artifacts.transcript:
                    artifacts.transcript = json.loads(output_path.read_text(encoding="utf-8"))
                self.logger.info(f"Using existing transcript from {output_path}")
                return True
            except Exception as e:
                self.logger.warning(f"Failed to load existing transcript: {e}")
        return False

    def run(self, artifacts: ParseArtifacts) -> ParseArtifacts:
        """
        Convert text to standardized transcript JSON using LLM.

        Uses text_content (from TextExtractStep) if available,
        falls back to reducto_result (from ReductoStep).
        Saves result to output_dir/transcript.json.
        """
        if artifacts.input.dry_run:
            self.logger.info("Dry run - skipping LLM call")
            artifacts.transcript = {"dry_run": True}
            return artifacts

        if not self.api_key:
            raise ValueError("OPENROUTER_API_KEY must be set")

        # Get text content - prefer direct text, fall back to Reducto
        if artifacts.text_content:
            text_content = artifacts.text_content
            self.logger.info("Using text_content: %d chars", len(text_content))
        elif artifacts.reducto_result:
            text_content = extract_text_from_reducto(artifacts.reducto_result)
            self.logger.info("Using reducto_result: %d chars", len(text_content))
        else:
            raise ValueError(
                "No text content available - run TextExtractStep or ReductoStep first"
            )

        # Build user message
        user_content = f"""Extract structured transcript data from the following:

{text_content}

Output the extracted data as a JSON object following the schema exactly."""

        # Create standardize debug directory
        standardize_dir = artifacts.input.output_dir / "standardize"
        standardize_dir.mkdir(parents=True, exist_ok=True)

        # Build request payload
        request_payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            "temperature": 0.1,
        }

        # Save request for debugging
        request_path = standardize_dir / "request.json"
        request_path.write_text(
            json.dumps(request_payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        self.logger.info("Request saved to %s", request_path)

        # Call OpenRouter API
        self.logger.info("Calling OpenRouter API with model %s", self.model)

        response = httpx.post(
            self.api_url,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            json=request_payload,
            timeout=180.0,
        )

        response.raise_for_status()
        self.logger.info("Parsing API response...")
        result = response.json()

        # Save response for debugging
        response_path = standardize_dir / "response.json"
        response_path.write_text(
            json.dumps(result, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        self.logger.info("Response saved to %s", response_path)

        # Extract content from response
        self.logger.info("Extracting content from response...")
        content = result["choices"][0]["message"]["content"]
        self.logger.info("Got %d chars of content", len(content))

        # Clean markdown code blocks if present
        if content.strip().startswith("```"):
            self.logger.info("Cleaning markdown code blocks from response...")
            lines = content.strip().splitlines()
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            content = "\n".join(lines).strip()

        # Parse JSON response
        self.logger.info("Parsing JSON...")
        try:
            transcript = json.loads(content)
        except json.JSONDecodeError as e:
            self.logger.error("Failed to parse LLM response as JSON: %s", e)
            raw_path = standardize_dir / "content_raw.txt"
            raw_path.write_text(content, encoding="utf-8")
            self.logger.error("Raw content saved to %s", raw_path)
            raise ValueError(f"LLM did not return valid JSON: {e}") from e

        # Add timestamp
        transcript["standardized_at"] = datetime.now(timezone.utc).isoformat()

        # Save to output
        output_path = artifacts.input.output_dir / "transcript.json"
        output_path.write_text(
            json.dumps(transcript, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        artifacts.transcript = transcript
        artifacts.outputs["transcript"] = output_path

        self.logger.info("Transcript standardized and saved to %s", output_path)

        # TODO: Add school-specific analysis here (currently defaults to Stanford in AnalyzeStep)
        return artifacts
