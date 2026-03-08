"""
Resume parsing step - uses OpenRouter file input to extract structured resume JSON.
"""

from __future__ import annotations

import base64
import json
import os
from datetime import datetime, timezone
from pathlib import Path
import httpx
from pydantic import BaseModel, Field

from api.pipeline.steps.base import ParseStep
from api.pipeline.types import ParseArtifacts


SYSTEM_PROMPT = """You are a resume extraction assistant.

Extract structured resume data and return ONLY valid JSON with this exact shape:
{
  "resume_raw": {
    "schema_version": "1.0",
    "candidate": {
      "name": "<string or null>",
      "email": "<string or null>",
      "phone": "<string or null>",
      "location": "<string or null>"
    },
    "jobs": [
      {
        "company": "<string or null>",
        "role": "<string or null>",
        "start_date": "<YYYY-MM or YYYY-MM-DD or null>",
        "end_date": "<YYYY-MM or YYYY-MM-DD or null>",
        "is_current": <true/false/null>,
        "location": "<string or null>",
        "employment_type": "<full-time/internship/contract/part-time/other or null>",
        "details": ["<bullet>"],
        "skills_used": ["<skill>"]
      }
    ],
    "education": [
      {
        "institution": "<string or null>",
        "degree": "<string or null>",
        "field_of_study": "<string or null>",
        "start_date": "<YYYY-MM or YYYY-MM-DD or null>",
        "end_date": "<YYYY-MM or YYYY-MM-DD or null>",
        "is_current": <true/false/null>,
        "gpa": "<string or null>",
        "details": ["<bullet>"]
      }
    ],
    "projects": [
      {
        "name": "<string or null>",
        "role": "<string or null>",
        "start_date": "<YYYY-MM or YYYY-MM-DD or null>",
        "end_date": "<YYYY-MM or YYYY-MM-DD or null>",
        "is_current": <true/false/null>,
        "description": ["<bullet>"],
        "technologies": ["<tech>"],
        "url": "<string or null>"
      }
    ],
    "certifications": [
      {
        "name": "<string or null>",
        "issuer": "<string or null>",
        "issue_date": "<YYYY-MM or YYYY-MM-DD or null>",
        "expiry_date": "<YYYY-MM or YYYY-MM-DD or null>",
        "credential_id": "<string or null>",
        "credential_url": "<string or null>"
      }
    ],
    "skills": [],
    "parsed_at": "<ISO8601 timestamp or null>"
  },
  "resume_analysis": {
    "jobs": [],
    "highlights": ["<concise recruiter-facing summary bullet>"],
    "gaps_or_uncertain_dates": ["<gap/uncertainty note>"]
  }
}

Rules:
1. Preserve chronology exactly as inferred from the resume.
2. Use null when unknown.
3. Keep `details` concise and factual.
4. Output only JSON (no markdown)."""


class ResumeCandidate(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    location: str | None = None


class ResumeJob(BaseModel):
    company: str | None = None
    role: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    is_current: bool | None = None
    location: str | None = None
    employment_type: str | None = None
    details: list[str] = Field(default_factory=list)
    skills_used: list[str] = Field(default_factory=list)


class ResumeEducation(BaseModel):
    institution: str | None = None
    degree: str | None = None
    field_of_study: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    is_current: bool | None = None
    gpa: str | None = None
    details: list[str] = Field(default_factory=list)


class ResumeProject(BaseModel):
    name: str | None = None
    role: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    is_current: bool | None = None
    description: list[str] = Field(default_factory=list)
    technologies: list[str] = Field(default_factory=list)
    url: str | None = None


class ResumeCertification(BaseModel):
    name: str | None = None
    issuer: str | None = None
    issue_date: str | None = None
    expiry_date: str | None = None
    credential_id: str | None = None
    credential_url: str | None = None


class ResumeRaw(BaseModel):
    schema_version: str = "1.0"
    candidate: ResumeCandidate = Field(default_factory=ResumeCandidate)
    jobs: list[ResumeJob] = Field(default_factory=list)
    education: list[ResumeEducation] = Field(default_factory=list)
    projects: list[ResumeProject] = Field(default_factory=list)
    certifications: list[ResumeCertification] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    parsed_at: str | None = None


class ResumeAnalysis(BaseModel):
    jobs: list[ResumeJob] = Field(default_factory=list)
    highlights: list[str] = Field(default_factory=list)
    gaps_or_uncertain_dates: list[str] = Field(default_factory=list)


class ResumeParseResponse(BaseModel):
    resume_raw: ResumeRaw
    resume_analysis: ResumeAnalysis


class ResumeParseStep(ParseStep):
    """Use OpenRouter file input to parse resume PDF into structured JSON."""

    name = "resume_parse"

    def __init__(self, model: str | None = None, api_key: str | None = None):
        super().__init__()
        self.model = model or os.getenv("MODEL_ID") or "openai/gpt-oss-120b"
        self.api_key = api_key or os.getenv("OPENROUTER_API_KEY")
        self.api_url = "https://openrouter.ai/api/v1/chat/completions"
        self.timeout_seconds = float(os.getenv("OPENROUTER_TIMEOUT_SECONDS", "180"))
        self.save_debug = os.getenv("SAVE_LLM_DEBUG", "1").lower() in {"1", "true", "yes"}

    def _build_data_url(self, pdf_path: Path) -> str:
        content = pdf_path.read_bytes()
        encoded = base64.b64encode(content).decode("ascii")
        return f"data:application/pdf;base64,{encoded}"

    def run(self, artifacts: ParseArtifacts) -> ParseArtifacts:
        if artifacts.input.dry_run:
            self.logger.info("Dry run - skipping resume parse")
            artifacts.resume_raw = {"dry_run": True}
            artifacts.resume_analysis = {"jobs": []}
            return artifacts

        if not self.api_key:
            raise ValueError("OPENROUTER_API_KEY must be set")

        pdf_path = artifacts.pdf_path
        if not pdf_path or not pdf_path.exists():
            raise ValueError(f"PDF not found at {pdf_path}")

        parse_dir = artifacts.input.output_dir / "resume_parse"
        parse_dir.mkdir(parents=True, exist_ok=True)

        request_payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": (
                                "Extract the resume into the requested JSON shape. "
                                "Focus on work experience jobs with dates, role, and details."
                            ),
                        },
                        {
                            "type": "file",
                            "file": {
                                "filename": pdf_path.name,
                                "file_data": self._build_data_url(pdf_path),
                            },
                        },
                    ],
                },
            ],
            "temperature": 0.1,
        }

        if self.save_debug:
            request_path = parse_dir / "request.json"
            request_path.write_text(
                json.dumps(request_payload, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )

        response = httpx.post(
            self.api_url,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            json=request_payload,
            timeout=self.timeout_seconds,
        )
        response.raise_for_status()
        result = response.json()

        if self.save_debug:
            response_path = parse_dir / "response.json"
            response_path.write_text(response.text, encoding="utf-8")

        content = result["choices"][0]["message"]["content"]
        if content.strip().startswith("```"):
            lines = content.strip().splitlines()
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            content = "\n".join(lines).strip()

        try:
            response_data = json.loads(content)
        except json.JSONDecodeError as exc:
            raw_path = parse_dir / "content_raw.txt"
            raw_path.write_text(content, encoding="utf-8")
            raise ValueError(f"LLM did not return valid JSON: {exc}") from exc

        validated = ResumeParseResponse.model_validate(response_data)

        resume_raw = validated.resume_raw.model_dump()
        if not resume_raw.get("parsed_at"):
            resume_raw["parsed_at"] = datetime.now(timezone.utc).isoformat()

        resume_analysis = validated.resume_analysis.model_dump()
        if not resume_analysis.get("jobs"):
            resume_analysis["jobs"] = resume_raw.get("jobs", [])

        resume_path = artifacts.input.output_dir / "resume.json"
        analysis_path = artifacts.input.output_dir / "resume_analysis.json"
        resume_path.write_text(
            json.dumps(resume_raw, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        analysis_path.write_text(
            json.dumps(resume_analysis, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        artifacts.resume_raw = resume_raw
        artifacts.resume_analysis = resume_analysis
        artifacts.outputs["resume"] = resume_path
        artifacts.outputs["resume_analysis"] = analysis_path
        return artifacts
