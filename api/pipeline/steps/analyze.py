"""
Analyze step - calculates grade percentiles using stored distributions.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional
from api.pipeline.steps.base import ParseStep
from api.pipeline.types import ParseArtifacts
from api.supabase import get_client

# Define the ordering of grades from worst to best
GRADE_ORDER = ["F", "D-", "D", "D+", "C-", "C", "C+", "B-", "B", "B+", "A-", "A", "A+"]

class AnalyzeStep(ParseStep):
    """Analyze transcript data to calculate grade percentiles."""

    name = "analyze"

    def __init__(self, school_name: str = "Stanford"):
        super().__init__()
        self.school_name = school_name
        self.client = get_client()
        self._school_id: Optional[str] = None
        self._distributions: Dict[str, Dict[str, float]] = {}

    def _get_school_id(self) -> Optional[str]:
        """Fetch school ID from Supabase."""
        if self._school_id:
            return self._school_id
            
        result = self.client.table("schools").select("id").eq("name", self.school_name).execute()
        if result.data:
            self._school_id = result.data[0]["id"]
            return self._school_id
        return None

    def _load_distributions(self, school_id: str):
        """Load all grade distributions for the school into memory."""
        result = self.client.table("grade_distributions").select("course_code, distribution").eq("school_id", school_id).execute()
        for row in result.data:
            self._distributions[row["course_code"]] = row["distribution"]

    def calculate_percentile(self, grade: str, distribution: Dict[str, float]) -> Optional[float]:
        """
        Calculate percentile for a given grade based on the distribution.
        Percentile = (Sum of weights for grades strictly worse than yours) + (0.5 * weight of your grade)
        """
        if grade not in GRADE_ORDER:
            return None
            
        current_grade_index = GRADE_ORDER.index(grade)
        
        lower_sum = 0.0
        for i in range(current_grade_index):
            lower_sum += distribution.get(GRADE_ORDER[i], 0.0)
            
        current_weight = distribution.get(grade, 0.0)
        
        # Percentile calculation
        percentile = lower_sum + (0.5 * current_weight)
        return round(percentile * 100, 2)

    def run(self, artifacts: ParseArtifacts) -> ParseArtifacts:
        """
        Analyze standardized transcript data.
        Matches course codes and calculates percentiles.
        """
        if not artifacts.transcript:
            self.logger.warning("No transcript data to analyze")
            return artifacts

        school_id = self._get_school_id()
        if not school_id:
            self.logger.error(f"School '{self.school_name}' not found in database")
            return artifacts

        self._load_distributions(school_id)
        self.logger.info(f"Loaded {len(self._distributions)} distributions for {self.school_name}")

        # Process terms and courses to build a summary list
        grades = []
        repeated = {}
        
        terms = artifacts.transcript.get("terms", [])
        for term in terms:
            term_name = term.get("name", "")
            courses = term.get("courses", [])
            for course in courses:
                dept = course.get("department") or ""
                num = course.get("number") or ""
                course_code = f"{dept}{num}".replace(" ", "").upper()
                title = course.get("title", "")
                
                grade_raw = course.get("grade")
                if grade_raw is None:
                    self.logger.warning(f"Course {course_code} has no grade, skipping percentile calculation")
                    continue
                
                grade = str(grade_raw).upper()
                
                # Track repeated courses
                if course_code not in repeated:
                    repeated[course_code] = {
                        "course_code": course_code,
                        "title": title,
                        "attempts": []
                    }
                repeated[course_code]["attempts"].append({
                    "term": term_name,
                    "grade": grade
                })
                
                # Try to find a match in distributions for the grades section
                distribution = self._distributions.get(course_code)
                if distribution:
                    percentile = self.calculate_percentile(grade, distribution)
                    if percentile is not None:
                        # Add to our grades list
                        grades.append({
                            "course_code": course_code,
                            "title": title,
                            "grade": grade,
                            "percentile": percentile,
                            "term": term_name
                        })
                        self.logger.info(f"Calculated percentile for {course_code}: {percentile}%")
                else:
                    self.logger.debug(f"No distribution found for {course_code}")

        # Filter repeated to only those with > 1 attempt and different grades
        # This helps identify potential Honor Code violations by excluding 
        # lecture/activity pairs that often share the same grade.
        repeated_list = []
        for v in repeated.values():
            if len(v["attempts"]) > 1:
                grades_seen = {a["grade"] for a in v["attempts"]}
                if len(grades_seen) > 1:
                    repeated_list.append(v)

        # Save the filtered summary instead of the full transcript
        analysis_result = {
            "school": self.school_name,
            "analyzed_at": artifacts.transcript.get("standardized_at"),
            "grades": grades,
            "repeated": repeated_list
        }

        output_path = artifacts.input.output_dir / "analysis_summary.json"
        output_path.write_text(
            json.dumps(analysis_result, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        artifacts.outputs["analysis_summary"] = output_path
        
        # Also update artifacts.transcript if needed by subsequent steps, 
        # but the primary output of this step is now the summary.
        self.logger.info(f"Analysis complete, saved summary to {output_path}")
        return artifacts
