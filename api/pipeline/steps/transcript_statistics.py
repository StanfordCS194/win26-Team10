"""
Transcript Statistics step - calculates grade percentiles and general statistics.
"""

from __future__ import annotations

import json
from collections import Counter
from typing import Any, Dict, List, Optional
from api.pipeline.steps.base import ParseStep
from api.pipeline.types import ParseArtifacts
from api.supabase import get_client

# Define the ordering of grades from worst to best
GRADE_ORDER = ["F", "D-", "D", "D+", "C-", "C", "C+", "B-", "B", "B+", "A-", "A", "A+"]

class TranscriptStatisticsStep(ParseStep):
    """Analyze transcript data to calculate grade percentiles and statistics."""

    name = "transcript_statistics"

    def __init__(self, school_name: str = "Stanford"):
        super().__init__()
        self.school_name = school_name
        self.client = get_client()
        self._school_id: Optional[str] = None
        self._distributions: Dict[str, Dict[str, float]] = {}

    def _get_school_id(self) -> Optional[str]:
        """Fetch school ID from Supabase using normalization function."""
        if self._school_id:
            return self._school_id
            
        # Call the normalization function in Supabase
        try:
            result = self.client.rpc("normalize_school_name", {"input_name": self.school_name}).execute()
            if result.data:
                self._school_id = result.data
                self.logger.info(f"Normalized '{self.school_name}' to school ID {self._school_id}")
                return self._school_id
        except Exception as e:
            self.logger.error(f"Error calling normalize_school_name: {e}")

        # Fallback to direct name match if RPC fails or returns nothing
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
        
        # Percentile calculation: midpoint
        percentile = lower_sum + (0.5 * current_weight)
        return round(percentile * 100, 2)

    def run(self, artifacts: ParseArtifacts) -> ParseArtifacts:
        """
        Analyze standardized transcript data.
        Matches course codes and calculates percentiles and statistics.
        """
        if not artifacts.transcript:
            self.logger.warning("No transcript data to analyze")
            return artifacts

        # Try to identify school from transcript if not explicitly set to a non-default
        if self.school_name == "Stanford" and artifacts.transcript.get("institution", {}).get("name"):
            self.school_name = artifacts.transcript["institution"]["name"]
            self.logger.info(f"Identified school from transcript: {self.school_name}")

        school_id = self._get_school_id()
        if not school_id:
            self.logger.error(f"School '{self.school_name}' not found in database")
        else:
            # Update school_name to canonical name if we found a match
            try:
                canonical_result = self.client.table("schools").select("name").eq("id", school_id).execute()
                if canonical_result.data:
                    self.school_name = canonical_result.data[0]["name"]
                    self.logger.info(f"Using canonical school name: {self.school_name}")
            except Exception as e:
                self.logger.warning(f"Failed to fetch canonical school name: {e}")

            self._load_distributions(school_id)
            self.logger.info(f"Loaded {len(self._distributions)} distributions for {self.school_name}")

        # Process terms and courses to build a summary list
        grades = []
        repeated = {}
        department_counts = Counter()
        
        weighted_percentile_sum = 0.0
        units_with_percentile = 0.0
        
        percentile_sum = 0.0
        count_with_percentile = 0
        
        terms = artifacts.transcript.get("terms", [])
        for term in terms:
            term_name = term.get("name", "")
            courses = term.get("courses", [])
            for course in courses:
                dept = course.get("department") or ""
                num = course.get("number") or ""
                course_code = f"{dept}{num}".replace(" ", "").upper()
                title = course.get("title", "")
                units_earned = float(course.get("units_earned") or 0.0)
                
                if dept:
                    department_counts[dept] += 1
                
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
                percentile = None
                if distribution:
                    percentile = self.calculate_percentile(grade, distribution)
                    if percentile is not None:
                        weighted_percentile_sum += percentile * units_earned
                        units_with_percentile += units_earned
                        percentile_sum += percentile
                        count_with_percentile += 1
                        self.logger.info(f"Calculated percentile for {course_code}: {percentile}%")
                
                # Add to our grades list (always include if it has a grade)
                grades.append({
                    "course_code": course_code,
                    "title": title,
                    "grade": grade,
                    "percentile": percentile,
                    "units_earned": units_earned,
                    "term": term_name
                })

        # Filter repeated to only those with > 1 attempt and different grades
        repeated_list = []
        for v in repeated.values():
            if len(v["attempts"]) > 1:
                grades_seen = {a["grade"] for a in v["attempts"]}
                if len(grades_seen) > 1:
                    repeated_list.append(v)

        # Top 3 departments
        common_departments = dict(department_counts.most_common(3))
        most_common_dept = department_counts.most_common(1)[0][0] if department_counts else None

        # Major-specific scores (heuristic: most frequent department)
        major_weighted_sum = 0.0
        major_units = 0.0
        major_unweighted_sum = 0.0
        major_count = 0

        for g in grades:
            if most_common_dept and g["course_code"].startswith(most_common_dept) and g["percentile"] is not None:
                major_weighted_sum += g["percentile"] * g["units_earned"]
                major_units += g["units_earned"]
                major_unweighted_sum += g["percentile"]
                major_count += 1

        # Universal (all courses) and Major-specific scores
        universal_scores = {
            "weighted_percentile": round(weighted_percentile_sum / units_with_percentile, 2) if units_with_percentile > 0 else None,
            "unweighted_percentile": round(percentile_sum / count_with_percentile, 2) if count_with_percentile > 0 else None,
            "weighted_gpa": (
                artifacts.transcript.get("career_totals", {})
                .get("undergraduate", {})
                .get("gpa")
                if artifacts.transcript.get("career_totals") 
                else artifacts.transcript.get("gpa")
            )
        }
        
        major_scores = {
            "weighted_percentile": round(major_weighted_sum / major_units, 2) if major_units > 0 else None,
            "unweighted_percentile": round(major_unweighted_sum / major_count, 2) if major_count > 0 else None,
            "heuristic_note": f"Major identified as '{most_common_dept}' based on highest course frequency." if most_common_dept else "No major identified."
        }

        # Academic scores (deprecated/legacy support)
        academic_scores = {
            "weighted_average_percentile": universal_scores["weighted_percentile"],
            "unweighted_average_percentile": universal_scores["unweighted_percentile"]
        }

        # Save the filtered summary instead of the full transcript
        analysis_result = {
            "school": self.school_name,
            "analyzed_at": artifacts.transcript.get("standardized_at"),
            "common_departments": common_departments,
            "universal_scores": universal_scores,
            "major_scores": major_scores,
            "academic_scores": academic_scores, # Keep for legacy support
            "grades": grades,
            "repeated": repeated_list
        }

        output_path = artifacts.input.output_dir / "statistics_summary.json"
        output_path.write_text(
            json.dumps(analysis_result, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        artifacts.outputs["statistics_summary"] = output_path
        
        # Prepare data for applicants_detail table
        # We store the summary statistics and identified major
        artifacts.outputs["applicants_detail_update"] = {
            "transcript_stats": {
                "universal_scores": universal_scores,
                "major_scores": major_scores,
                "common_departments": common_departments
            }
        }
        
        self.logger.info(f"Statistics complete, saved summary to {output_path}")
        return artifacts

