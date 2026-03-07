"""
Transcript Analysis step - uses LLM to provide qualitative analysis of the transcript.
"""

from __future__ import annotations

import json
import os

import httpx

from api.pipeline.steps.base import ParseStep
from api.pipeline.types import ParseArtifacts

SYSTEM_PROMPT = """You are a transcript analysis assistant. Your task is to provide a qualitative analysis of a student's academic performance based on their standardized transcript data.

## Output Schema

You must output a JSON object with these fields:

```json
{
  "topic_rating": {
    "program_performance": "<Detailed qualitative assessment of performance within their specific program>"
  },
  "class_anti_skills": [
    {
      "class": "<Course code and title>",
      "skills": ["<Skill taught in this class that the student may be weak in based on poor performance>"],
      "reason": "<Brief explanation why this is flagged>"
    }
  ],
  "categories": {
    "technical_domain_skill": {
      "score": <0-10>,
      "justification": "<Reasoning for this score>"
    },
    "problem_solving": {
      "score": <0-10>,
      "justification": "<Reasoning for this score>"
    },
    "communication": {
      "score": <0-10>,
      "justification": "<Reasoning for this score>"
    },
    "execution": {
      "score": <0-10>,
      "justification": "<Reasoning for this score>"
    },
    "collaboration": {
      "score": <0-10>,
      "justification": "<Reasoning for this score>"
    }
  }
}
```

## Category Definitions
- **Technical / Domain Skill**: How strong they are at the core hard skills for the role (based on relevant coursework).
- **Problem Solving**: Ability to analyze, learn quickly, and handle ambiguity (often reflected in difficult math/CS/engineering courses).
- **Communication**: Written, verbal, clarity, stakeholder management (reflected in humanities, writing, or project-based courses).
- **Execution**: Reliability, speed, follow-through, attention to detail (reflected in labs, large projects, and consistent performance).
- **Collaboration**: Teamwork, empathy, feedback, cross-functional work (reflected in group projects or specific collaborative courses).

## Instructions
1. Analyze the grades, course titles, and overall trajectory.
2. 5 is neutral. Scores above 5 indicate strength, below 5 indicate relative weakness.
3. Be objective and base justifications on the evidence in the transcript.
4. Output ONLY valid JSON, no markdown or explanations."""

class TranscriptAnalysisStep(ParseStep):
    """Use LLM to provide qualitative analysis of the transcript."""

    name = "transcript_analysis"

    def __init__(
        self,
        model: str | None = None,
        api_key: str | None = None,
    ):
        super().__init__()
        self.model = model or os.getenv("MODEL_ID") or "openai/gpt-oss-120b"
        self.api_key = api_key or os.getenv("OPENROUTER_API_KEY")
        self.api_url = "https://openrouter.ai/api/v1/chat/completions"

    def run(self, artifacts: ParseArtifacts) -> ParseArtifacts:
        """
        Analyze transcript data using LLM.
        """
        if artifacts.input.dry_run:
            self.logger.info("Dry run - skipping LLM call")
            return artifacts

        if not self.api_key:
            raise ValueError("OPENROUTER_API_KEY must be set")

        if not artifacts.transcript:
            self.logger.warning("No transcript data to analyze")
            return artifacts

        # Build user message
        user_content = f"""Analyze the following standardized transcript data:

{json.dumps(artifacts.transcript, indent=2)}

Output the qualitative analysis as a JSON object following the schema exactly."""

        # Create analysis debug directory
        analysis_dir = artifacts.input.output_dir / "transcript_analysis"
        analysis_dir.mkdir(parents=True, exist_ok=True)

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
        request_path = analysis_dir / "request.json"
        request_path.write_text(
            json.dumps(request_payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        # Call OpenRouter API
        self.logger.info("Calling OpenRouter API for qualitative analysis...")
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
        result = response.json()

        # Save response for debugging
        response_path = analysis_dir / "response.json"
        response_path.write_text(
            json.dumps(result, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        # Extract content from response
        content = result["choices"][0]["message"]["content"]

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
        try:
            analysis_report = json.loads(content)
        except json.JSONDecodeError as e:
            self.logger.error("Failed to parse LLM response as JSON: %s", e)
            raise ValueError(f"LLM did not return valid JSON: {e}") from e

        # Save to output
        output_path = artifacts.input.output_dir / "analysis_report.json"
        output_path.write_text(
            json.dumps(analysis_report, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        artifacts.outputs["analysis_report"] = output_path
        self.logger.info("Qualitative analysis complete, saved to %s", output_path)

        return artifacts
