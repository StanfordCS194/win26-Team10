from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Iterable, Mapping

from backend.helpers.data import normalize_code
from backend.helpers.dates import term_offered_to_quarter_abbrev
from backend.helpers.descriptions import process_desc


def _maybe_int(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _minutes_to_timestamp_seconds(minutes: Any) -> int:
    m = _maybe_int(minutes)
    return (m or 0) * 60


def _days_from_meeting(meeting: Mapping[str, Any]) -> str | None:
    days = meeting.get("daysOfWeekList")
    if isinstance(days, list) and days:
        joined = " ".join(str(d).strip() for d in days if str(d).strip()).strip()
        return joined or None
    s = meeting.get("daysOfWeek")
    if isinstance(s, str) and s.strip():
        return s.strip()
    return None


def _meeting_location(meeting: Mapping[str, Any]) -> str | None:
    for key in (
        "location",
        "buildingRoom",
        "locationDescr",
        "locationDescription",
    ):
        v = meeting.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip()

    b = meeting.get("building")
    r = meeting.get("room")
    if isinstance(b, str) and b.strip() and isinstance(r, str) and r.strip():
        return f"{b.strip()} {r.strip()}"
    return None


@dataclass(frozen=True)
class InstructorRef:
    name: str
    sunet: str = ""

    @classmethod
    def from_algolia(cls, raw: Mapping[str, Any]) -> InstructorRef | None:
        name = raw.get("displayName") or raw.get("name")
        if not isinstance(name, str) or not name.strip():
            return None
        sunet = raw.get("sunet") or raw.get("sunetId") or ""
        return cls(name=name.strip(), sunet=str(sunet).strip())


@dataclass(frozen=True)
class MeetingSchedule:
    days: str | None
    start_timestamp: int
    end_timestamp: int
    location: str | None
    instructors: list[InstructorRef] = field(default_factory=list)
    start_time_in_minutes: int | None = None
    end_time_in_minutes: int | None = None

    @classmethod
    def from_algolia(cls, raw: Mapping[str, Any]) -> MeetingSchedule:
        start_min = raw.get("startTimeInMinutes") or raw.get("startTimeMinutes")
        end_min = raw.get("endTimeInMinutes") or raw.get("endTimeMinutes")

        inst: list[InstructorRef] = []
        raw_instructors = raw.get("instructors")
        if isinstance(raw_instructors, list):
            for i in raw_instructors:
                if not isinstance(i, Mapping):
                    continue
                parsed = InstructorRef.from_algolia(i)
                if parsed is not None:
                    inst.append(parsed)

        return cls(
            days=_days_from_meeting(raw),
            start_timestamp=_minutes_to_timestamp_seconds(start_min),
            end_timestamp=_minutes_to_timestamp_seconds(end_min),
            location=_meeting_location(raw),
            instructors=inst,
            start_time_in_minutes=_maybe_int(start_min),
            end_time_in_minutes=_maybe_int(end_min),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "days": self.days,
            "startTimestamp": self.start_timestamp,
            "endTimestamp": self.end_timestamp,
            "location": self.location,
            "instructors": [asdict(i) for i in self.instructors],
            # Keep raw minute fields for debugging
            "startTimeInMinutes": self.start_time_in_minutes,
            "endTimeInMinutes": self.end_time_in_minutes,
        }


@dataclass(frozen=True)
class Section:
    term: str
    term_offered: str
    section_number: str
    component: str
    class_id: str
    schedules: list[MeetingSchedule] = field(default_factory=list)

    @classmethod
    def from_algolia_hit(cls, hit: Mapping[str, Any]) -> Section:
        term_offered = str(hit.get("termOffered") or "").strip()
        term = term_offered_to_quarter_abbrev(term_offered) if term_offered else ""

        section_number = (
            hit.get("sectionNbr")
            or hit.get("sectionNumber")
            or hit.get("classSection")
            or hit.get("section")
            or ""
        )
        component = hit.get("component") or hit.get("componentDescr") or ""
        class_id = (
            hit.get("classId")
            or hit.get("classNbr")
            or hit.get("classNumber")
            or ""
        )

        schedules: list[MeetingSchedule] = []
        meetings = hit.get("meetings")
        if isinstance(meetings, list):
            for m in meetings:
                if isinstance(m, Mapping):
                    schedules.append(MeetingSchedule.from_algolia(m))

        return cls(
            term=term,
            term_offered=term_offered,
            section_number=str(section_number),
            component=str(component),
            class_id=str(class_id),
            schedules=schedules,
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "term": self.term,
            "termOffered": self.term_offered,
            "sectionNumber": self.section_number,
            "component": self.component,
            "classId": self.class_id,
            "schedules": [m.to_dict() for m in self.schedules],
        }


@dataclass(frozen=True)
class CourseMeta:
    id: str
    course_code: str
    subject: str
    catalog_number: str
    title: str
    description: str
    career: str | None = None
    department: str | None = None
    units_min: int | None = None
    units_max: int | None = None
    gers: list[str] = field(default_factory=list)

    mean_hours: float | None = None
    median_hours: float | None = None
    median_grade: str | None = None
    percent_as: float | None = None
    syllabus_id: str | None = None

    past_reviews: list[str] | None = None
    past_reviews_error: str | None = None

    @classmethod
    def from_algolia_rep(
        cls,
        rep: Mapping[str, Any],
        *,
        subject: str,
        course_code: str,
    ) -> CourseMeta:
        doc_id = normalize_code(course_code)
        raw_desc = rep.get("description")
        if isinstance(raw_desc, str):
            desc = process_desc(raw_desc, subject)
        else:
            desc = ""

        title = (
            rep.get("courseTitle")
            or rep.get("title")
            or rep.get("courseLongTitle")
            or ""
        )
        title = str(title).strip()

        units_min = rep.get("unitsMin") if rep.get("unitsMin") is not None else rep.get("minUnits")
        units_max = rep.get("unitsMax") if rep.get("unitsMax") is not None else rep.get("maxUnits")

        gers_raw = rep.get("geRequirements") or rep.get("geRequirementsList") or []
        if isinstance(gers_raw, list):
            gers = [str(x) for x in gers_raw if str(x).strip()]
        else:
            gers = [str(gers_raw)] if str(gers_raw).strip() else []

        return cls(
            id=doc_id,
            course_code=course_code,
            subject=subject,
            catalog_number=course_code.split(" ", 1)[1],
            title=title,
            description=desc,
            career=str(rep.get("acadCareerDescr")).strip()
            if rep.get("acadCareerDescr") is not None
            else None,
            department=(
                str(rep.get("acadGroupDescr")).strip()
                if rep.get("acadGroupDescr") is not None
                else (
                    str(rep.get("deptName")).strip()
                    if rep.get("deptName") is not None
                    else None
                )
            ),
            units_min=_maybe_int(units_min),
            units_max=_maybe_int(units_max),
            gers=gers,
        )

    def to_dict(self) -> dict[str, Any]:
        out: dict[str, Any] = {
            "id": self.id,
            "courseCode": self.course_code,
            "subject": self.subject,
            "code": self.catalog_number,
            "title": self.title,
            "description": self.description,
            "career": self.career,
            "department": self.department,
            "unitsMin": self.units_min,
            "unitsMax": self.units_max,
            "gers": self.gers,
        }

        if self.mean_hours is not None:
            out["meanHours"] = round(float(self.mean_hours), 2)
        if self.median_hours is not None:
            out["medianHours"] = round(float(self.median_hours), 2)
        if self.median_grade is not None:
            out["medianGrade"] = self.median_grade
        if self.percent_as is not None:
            out["percentAs"] = self.percent_as
        if self.syllabus_id is not None:
            out["syllabus"] = self.syllabus_id

        if self.past_reviews is not None:
            out["pastReviews"] = self.past_reviews
        if self.past_reviews_error is not None:
            out["pastReviewsError"] = self.past_reviews_error

        return out


@dataclass(frozen=True)
class CoursePayload:
    id: str
    meta: CourseMeta
    sections_by_term: dict[str, list[Section]]

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "meta": self.meta.to_dict(),
            "sectionsByTerm": {
                term: [s.to_dict() for s in sections]
                for term, sections in self.sections_by_term.items()
            },
        }


def group_hits_by_course_code(
    hits: Iterable[Mapping[str, Any]],
    *,
    subject: str,
) -> dict[str, list[Mapping[str, Any]]]:
    out: dict[str, list[Mapping[str, Any]]] = {}
    for h in hits:
        subj = str(h.get("subject") or "").strip()
        cat = str(
            h.get("catalogNbr")
            or h.get("catalogNbrStr")
            or h.get("catalogNbrLong")
            or ""
        ).strip()
        if not subj or not cat or subj != subject:
            continue
        course_code = f"{subj} {cat}"
        out.setdefault(course_code, []).append(h)
    return out


