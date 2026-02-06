# Standardized Transcript Schema v1.0

This document defines the JSON schema for standardized student transcript data. The schema normalizes transcripts from various institutions (Stanford, UC system, community colleges, etc.) into a consistent structure.

## Schema Overview

```
StandardizedTranscript
├── schema_version       # Schema version for compatibility
├── source_format        # Original transcript format identifier
├── extracted_at         # ISO timestamp of extraction
├── student              # Student identity and metadata
├── institution          # Source institution info
├── programs[]           # Academic programs (majors/minors/degrees)
├── transfer_credits[]   # Credits from other institutions
├── terms[]              # Academic terms with courses
│   └── courses[]        # Individual course records
├── career_totals        # Cumulative statistics
└── notes[]              # Additional unstructured information
```

---

## Full Schema Definition

### Root Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `schema_version` | string | Yes | Schema version (e.g., "1.0") |
| `source_format` | string | Yes | Identifier for original format (e.g., "stanford_unofficial", "uc_official") |
| `extracted_at` | string (ISO 8601) | Yes | Timestamp when extraction occurred |
| `student` | object | Yes | Student information |
| `institution` | object | Yes | Institution information |
| `programs` | array | Yes | List of academic programs (can be empty) |
| `transfer_credits` | array | Yes | List of transfer credits (can be empty) |
| `terms` | array | Yes | List of academic terms with courses |
| `career_totals` | object | No | Cumulative statistics across all terms |
| `notes` | array | No | Additional notes that don't fit elsewhere |

---

### Student Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Full name as appears on transcript |
| `student_id` | string | No | Student ID number |
| `additional` | object | No | Additional fields (email, DOB, etc.) |

```json
{
  "name": "John Doe",
  "student_id": "01234567",
  "additional": {
    "email": "jdoe@stanford.edu"
  }
}
```

---

### Institution Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Full institution name |
| `location` | string | No | Address or location |
| `transcript_type` | string | No | Type of transcript (official, unofficial, detailed) |
| `print_date` | string | No | Date transcript was generated |

```json
{
  "name": "Leland Stanford Jr. University",
  "location": "Stanford, CA 94305, USA",
  "transcript_type": "Undergraduate Unofficial Transcript - Detailed",
  "print_date": "2026-01-14"
}
```

---

### Program Object (in `programs` array)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Program/major name |
| `degree` | string | No | Degree type (BS, BA, MS, PhD, etc.) |
| `level` | string | No | "undergraduate" or "graduate" |
| `status` | string | No | "active", "completed", "withdrawn" |
| `start_date` | string | No | Program start date (YYYY-MM-DD or descriptive) |
| `end_date` | string | No | Program end date (null if ongoing) |
| `subplans` | array | No | Concentrations, tracks, or specializations |
| `advisor` | string | No | Academic advisor name |
| `notes` | array | No | Additional program-specific notes |

```json
{
  "name": "Computer Science",
  "degree": "BS",
  "level": "undergraduate",
  "status": "active",
  "start_date": "2023-03-01",
  "end_date": null,
  "subplans": ["Artificial Intelligence"],
  "advisor": "Haber, Nick Joseph",
  "notes": ["Coterminal Undergraduate, 09/25/2023"]
}
```

---

### Transfer Credit Object (in `transfer_credits` array)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `source` | string | Yes | Source of credit (institution or exam name) |
| `equivalency` | string | No | Equivalent course at current institution |
| `units` | number | No | Units/credits awarded |
| `applied_to` | string | No | Which program the credit applies to |
| `notes` | array | No | Additional information |

```json
{
  "source": "Irish Leaving Certificate",
  "equivalency": "CS106A",
  "units": 5.0,
  "applied_to": "Undergraduate Matriculated"
}
```

---

### Term Object (in `terms` array)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Full term name (e.g., "2022-2023 Autumn") |
| `year` | string | No | Academic year (e.g., "2022-2023") |
| `season` | string | No | Season/quarter/semester (e.g., "Autumn", "Fall", "Spring") |
| `level` | string | No | "undergraduate" or "graduate" |
| `courses` | array | Yes | List of courses taken this term |
| `statistics` | object | No | Term and cumulative statistics |

```json
{
  "name": "2022-2023 Autumn",
  "year": "2022-2023",
  "season": "Autumn",
  "level": "undergraduate",
  "courses": [...],
  "statistics": {
    "term_gpa": 3.884,
    "cumulative_gpa": 3.884,
    "units_attempted": 15.0,
    "units_earned": 15.0,
    "cumulative_units_attempted": 15.0,
    "cumulative_units_earned": 15.0
  }
}
```

#### Term Statistics Object

| Field | Type | Description |
|-------|------|-------------|
| `term_gpa` | number | GPA for this term only |
| `cumulative_gpa` | number | Cumulative GPA through this term |
| `units_attempted` | number | Units attempted this term |
| `units_earned` | number | Units earned this term |
| `cumulative_units_attempted` | number | Total units attempted through this term |
| `cumulative_units_earned` | number | Total units earned through this term |

---

### Course Object (in `term.courses` array)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `department` | string | Yes | Department code (e.g., "CS", "MATH") |
| `number` | string | Yes | Course number (e.g., "106B", "51") |
| `component` | string | No | Component type code as shown on transcript (e.g., LEC, SEM, LAB) |
| `title` | string | No | Course title |
| `instructors` | array | No | List of instructor names |
| `units_attempted` | number | No | Units attempted |
| `units_earned` | number | No | Units earned |
| `grade` | string | No | Grade received (A, B+, S, etc.) |
| `grade_points` | number | No | Numeric grade points (4.0 scale) |
| `notes` | array | No | Additional info (repeated course, etc.) |

```json
{
  "department": "CS",
  "number": "106B",
  "component": "LEC",
  "title": "PROGRAMMING ABSTRACTIONS",
  "instructors": ["Cynthia Bailey", "Julie Zelenski"],
  "units_attempted": 5.0,
  "units_earned": 5.0,
  "grade": "A",
  "grade_points": 4.0,
  "notes": []
}
```

#### Component Types (examples)

Preserve component codes exactly as they appear on the transcript. Common examples:

| Code | Description |
|------|-------------|
| LEC | Lecture |
| SEM | Seminar |
| LAB | Laboratory |
| DIS | Discussion |
| COL | Colloquium |
| ACT | Activity |
| INS | Instruction/Internship |

Other institutions may use different codes.

---

### Career Totals Object

| Field | Type | Description |
|-------|------|-------------|
| `undergraduate` | object | Undergraduate career totals |
| `graduate` | object | Graduate career totals (null if N/A) |

Each level contains:

| Field | Type | Description |
|-------|------|-------------|
| `gpa` | number | Final cumulative GPA |
| `units_attempted` | number | Total units attempted |
| `units_earned` | number | Total units earned |
| `units_toward_degree` | number | Units counting toward degree |
| `institution_units` | number | Units taken at this institution |

```json
{
  "undergraduate": {
    "gpa": 3.896,
    "units_attempted": 194.0,
    "units_earned": 182.0,
    "units_toward_degree": 203.0,
    "institution_units": 182.0
  },
  "graduate": null
}
```

---

## Grade Reference

### Standard 4.0 Scale

| Grade | Points | Description |
|-------|--------|-------------|
| A+ | 4.0 | Exceptional |
| A | 4.0 | Excellent |
| A- | 3.7 | Very Good |
| B+ | 3.3 | Good |
| B | 3.0 | Above Average |
| B- | 2.7 | Satisfactory |
| C+ | 2.3 | Average |
| C | 2.0 | Below Average |
| C- | 1.7 | Passing |
| D+ | 1.3 | Poor |
| D | 1.0 | Very Poor |
| D- | 0.7 | Minimal Passing |
| F | 0.0 | Failing |

### Pass/Fail Grades (no GPA impact)

| Grade | Description |
|-------|-------------|
| S | Satisfactory |
| CR | Credit |
| P | Pass |
| NC | No Credit |
| NP | No Pass |
| W | Withdrawn |
| I | Incomplete |

---

## Complete Example

```json
{
  "schema_version": "1.0",
  "source_format": "stanford_unofficial",
  "extracted_at": "2026-02-05T20:13:00Z",
  "student": {
    "name": "John Doe",
    "student_id": "01234567",
    "additional": {}
  },
  "institution": {
    "name": "Leland Stanford Jr. University",
    "location": "Stanford, CA 94305, USA",
    "transcript_type": "Undergraduate Unofficial Transcript - Detailed",
    "print_date": "2026-01-14"
  },
  "programs": [
    {
      "name": "Computer Science",
      "degree": "BS",
      "level": "undergraduate",
      "status": "active",
      "start_date": "2023-03-01",
      "end_date": null,
      "subplans": ["Artificial Intelligence"],
      "advisor": "Haber, Nick Joseph",
      "notes": []
    },
    {
      "name": "Computer Science",
      "degree": "MS",
      "level": "graduate",
      "status": "active",
      "start_date": "2023-09-26",
      "end_date": null,
      "subplans": [],
      "advisor": null,
      "notes": ["First Graduate Quarter: 2025-2026 Autumn"]
    }
  ],
  "transfer_credits": [
    {
      "source": "Irish Leaving Certificate",
      "equivalency": "CS106A",
      "units": 5.0,
      "applied_to": "Undergraduate Matriculated"
    },
    {
      "source": "Irish Leaving Certificate",
      "equivalency": "CHEM31A",
      "units": 5.0,
      "applied_to": "Undergraduate Matriculated"
    },
    {
      "source": "Irish Leaving Certificate",
      "equivalency": "PHYSICS 21/23",
      "units": 8.0,
      "applied_to": "Undergraduate Matriculated"
    },
    {
      "source": "Irish Leaving Certificate",
      "equivalency": "MATH 19",
      "units": 3.0,
      "applied_to": "Undergraduate Matriculated"
    }
  ],
  "terms": [
    {
      "name": "2022-2023 Autumn",
      "year": "2022-2023",
      "season": "Autumn",
      "level": "undergraduate",
      "courses": [
        {
          "department": "COLLEGE",
          "number": "101",
          "component": "SEM",
          "title": "WHY COLLEGE? YOUR EDUCATION AND THE GOOD LIFE",
          "instructors": ["Alice Staveley"],
          "units_attempted": 3.0,
          "units_earned": 3.0,
          "grade": "A",
          "grade_points": 4.0,
          "notes": []
        },
        {
          "department": "CS",
          "number": "106B",
          "component": "LEC",
          "title": "PROGRAMMING ABSTRACTIONS",
          "instructors": ["Cynthia Bailey", "Julie Zelenski"],
          "units_attempted": 5.0,
          "units_earned": 5.0,
          "grade": "A",
          "grade_points": 4.0,
          "notes": []
        },
        {
          "department": "CS",
          "number": "529",
          "component": "COL",
          "title": "ROBOTICS AND AUTONOMOUS SYSTEMS SEMINAR",
          "instructors": ["Marco Pavone", "Mark Cutkosky"],
          "units_attempted": 1.0,
          "units_earned": 1.0,
          "grade": "S",
          "grade_points": null,
          "notes": []
        },
        {
          "department": "MATH",
          "number": "51",
          "component": "LEC",
          "title": "LINEAR ALGEBRA, MULTIVARIABLE CALCULUS, AND MODERN APPLICATIONS",
          "instructors": ["Andrew Hardt"],
          "units_attempted": 5.0,
          "units_earned": 5.0,
          "grade": "A-",
          "grade_points": 3.7,
          "notes": []
        },
        {
          "department": "STS",
          "number": "10SI",
          "component": "ACT",
          "title": "INTRODUCTION TO AI ALIGNMENT",
          "instructors": ["Paul Edwards"],
          "units_attempted": 1.0,
          "units_earned": 1.0,
          "grade": "S",
          "grade_points": null,
          "notes": []
        }
      ],
      "statistics": {
        "term_gpa": 3.884,
        "cumulative_gpa": 3.884,
        "units_attempted": 15.0,
        "units_earned": 15.0,
        "cumulative_units_attempted": 15.0,
        "cumulative_units_earned": 15.0
      }
    }
  ],
  "career_totals": {
    "undergraduate": {
      "gpa": 3.896,
      "units_attempted": 194.0,
      "units_earned": 182.0,
      "units_toward_degree": 203.0,
      "institution_units": 182.0
    },
    "graduate": null
  },
  "notes": [
    "Worksheet - For office use by authorized Stanford personnel"
  ]
}
```

---

## Handling Different Institution Formats

### Stanford
- Uses quarter system (Autumn, Winter, Spring, Summer)
- Academic year format: "YYYY-YYYY Season"
- Has coterminal (BS/MS) programs
- Component types: LEC, SEM, LAB, COL, ACT, INS

### UC System
- Uses quarter or semester system depending on campus
- May have different grade notations
- Transfer credits often from California Community Colleges

### Community Colleges
- Typically semester system
- May have different unit systems
- Often source of transfer credits

### Handling Unknowns
- Use `notes` arrays to capture institution-specific data
- Use `additional` objects for non-standard fields
- Set optional fields to `null` when not available
- Include `source_format` to track origin for debugging
