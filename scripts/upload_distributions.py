import json
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, Any

# Add the parent directory to sys.path so we can import from api
sys.path.append(str(Path(__file__).parent.parent))

from api.supabase import get_client

"""
Example usage:

    # Upload Stanford grade distributions
    python scripts/upload_distributions.py analysis/out/stanford_grades.json

    # Upload UT Austin grade distributions
    python scripts/upload_distributions.py analysis/out/ut_austin_grades.json
"""


def upload_distributions(json_path: str):
    """
    Upload grade distributions from a JSON file to Supabase.
    """
    path = Path(json_path)
    if not path.exists():
        print(f"Error: File {json_path} not found.")
        return

    with open(path, 'r') as f:
        data = json.load(f)

    school_name = data.get("school")
    classes = data.get("classes", {})

    if not school_name or not classes:
        print("Error: Invalid JSON format. 'school' and 'classes' are required.")
        return

    client = get_client()

    # 1. Upsert school
    print(f"Upserting school: {school_name}")
    school_result = client.table("schools").upsert(
        {"name": school_name},
        on_conflict="name"
    ).execute()
    
    if not school_result.data:
        # If upsert didn't return data (sometimes happens with on_conflict), fetch it
        school_result = client.table("schools").select("id").eq("name", school_name).execute()
    
    school_id = school_result.data[0]["id"]
    print(f"School ID: {school_id}")

    # 2. Prepare distributions for batch upsert
    distributions = []
    for course_code, distribution in classes.items():
        distributions.append({
            "school_id": school_id,
            "course_code": course_code,
            "distribution": distribution,
            "last_updated": datetime.now().isoformat()
        })

    # 3. Batch upsert distributions
    print(f"Upserting {len(distributions)} distributions...")
    
    # Supabase/PostgREST handles batching, but let's do it in chunks just in case
    chunk_size = 100
    for i in range(0, len(distributions), chunk_size):
        chunk = distributions[i:i + chunk_size]
        client.table("grade_distributions").upsert(
            chunk,
            on_conflict="school_id, course_code"
        ).execute()
        print(f"Uploaded chunk {i//chunk_size + 1}/{(len(distributions)-1)//chunk_size + 1}")

    print("Upload complete!")

if __name__ == "__main__":
    # Default to the stanford_grades.json in analysis/
    default_path = Path(__file__).parent.parent / "analysis" / "out" / "stanford_grades.json"
    
    json_file = sys.argv[1] if len(sys.argv) > 1 else str(default_path)
    upload_distributions(json_file)
