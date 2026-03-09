"""
Supabase database helpers for job queue and user operations.
"""

import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables from api/.env or api/prod.env
env_file = Path(__file__).parent / ("prod.env" if os.getenv("PROD") else ".env")
load_dotenv(env_file)

# Initialize Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")


# =============================================================================
# User helpers
# =============================================================================


async def get_user(user_id: str) -> Optional[dict]:
    """
    Get a user by ID.

    Args:
        user_id: The user UUID

    Returns:
        The user record or None if not found
    """
    client = get_client()
    result = client.table("users").select("*").eq("id", user_id).execute()

    if result.data:
        return result.data[0]
    return None


async def get_all_users() -> Optional[list[dict]]:
    """
    Get all users.

    Returns:
        List of user records or None if not found
    """
    client = get_client()
    result = client.table("users").select("*").execute()

    if result.data:
        return result.data
    return None


async def update_user_latest_repr(user_id: str, storage_path: str, report_path: Optional[str] = None) -> dict:
    """
    Update an applicant's latest_repr_path and latest_report_path.

    Args:
        user_id: The user UUID
        storage_path: Path to the transcript.json in storage
        report_path: Optional path to the analysis_summary.json in storage

    Returns:
        The updated applicant record
    """
    client = get_client()
    update_data = {"latest_repr_path": storage_path}
    if report_path:
        update_data["latest_report_path"] = report_path

    result = (
        client.table("applicants")
        .update(update_data)
        .eq("id", user_id)
        .execute()
    )
    return result.data[0] if result.data else {}


async def get_applicant(user_id: str) -> Optional[dict]:
    """
    Get an applicant profile by user ID.
    """
    client = get_client()
    result = client.table("applicants").select("*").eq("id", user_id).execute()
    return result.data[0] if result.data else None


async def update_applicant(user_id: str, data: dict) -> dict:
    """
    Update an applicant profile.
    """
    client = get_client()
    result = (
        client.table("applicants")
        .update(data)
        .eq("id", user_id)
        .execute()
    )
    return result.data[0] if result.data else {}


async def get_applicant_detail(user_id: str) -> Optional[dict]:
    """
    Get an applicant's detailed data (transcript/resume raw and analysis).
    """
    client = get_client()
    result = client.table("applicants_detail").select("*").eq("id", user_id).execute()
    return result.data[0] if result.data else None


async def upsert_applicant_detail(user_id: str, data: dict) -> dict:
    """
    Upsert an applicant's detailed data.
    """
    client = get_client()
    # Ensure ID is in the data for upsert
    data["id"] = user_id
    
    # Check if record exists first to decide whether to insert or update
    # This is a workaround for some Supabase client versions/configurations
    # that might struggle with RLS on upsert if the record doesn't exist yet.
    result = client.table("applicants_detail").upsert(data).execute()
    
    if not result.data:
        # Fallback: try direct insert if upsert didn't return data
        try:
            result = client.table("applicants_detail").insert(data).execute()
        except Exception:
            # If insert fails (e.g. already exists), try update
            result = client.table("applicants_detail").update(data).eq("id", user_id).execute()
            
    return result.data[0] if result.data else {}


async def get_school_id_by_name(school_name: str) -> Optional[str]:
    """
    Look up a school's UUID by its name.
    
    Args:
        school_name: The name of the school
        
    Returns:
        The school UUID or None if not found
    """
    client = get_client()
    result = client.table("schools").select("id").eq("name", school_name).execute()
    
    if result.data:
        return result.data[0]["id"]
    return None


async def get_user_type(user_id: str) -> Optional[str]:
    """
    Get a user's type (student or recruiter).

    Args:
        user_id: The user UUID

    Returns:
        The user type or None if not found
    """
    user = await get_user(user_id)
    return user.get("type") if user else None


# =============================================================================
# Client
# =============================================================================


def get_client() -> Client:
    """Get Supabase client instance."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


async def create_job(
    user_id: str,
    storage_path: str,
    parsed_file_id: Optional[str] = None,
    job_type: str = "transcript",
) -> dict:
    """
    Create a new parse job in the queue.

    Args:
        user_id: The user UUID
        storage_path: Path in storage where files are stored (e.g., "{user_id}/{job_id}")
        parsed_file_id: Optional parsed file ID

    Returns:
        The created job record
    """
    client = get_client()
    if job_type not in {"transcript", "resume"}:
        raise ValueError(f"Unsupported job_type: {job_type}")

    job_data = {
        "user_id": user_id,
        "parsed_file_id": parsed_file_id or str(uuid.uuid4()),
        "storage_path": storage_path,
        "job_type": job_type,
        "status": "queued",
    }

    result = client.table("parse_jobs").insert(job_data).execute()
    return result.data[0]


async def get_job_status(job_id: str) -> Optional[dict]:
    """
    Get the status of a job by ID.
    
    Args:
        job_id: The job UUID
    
    Returns:
        The job record or None if not found
    """
    client = get_client()
    result = client.table("parse_jobs").select("*").eq("id", job_id).execute()
    
    if result.data:
        return result.data[0]
    return None


async def claim_parse_job(worker_id: str, lock_seconds: int = 900) -> Optional[dict]:
    """
    Claim the next available job using the claim_parse_job RPC function.
    Uses FOR UPDATE SKIP LOCKED to prevent worker contention.
    
    Args:
        worker_id: Unique identifier for this worker instance
        lock_seconds: How long to hold the lock (default 15 minutes)
    
    Returns:
        The claimed job or None if no jobs available
    """
    client = get_client()
    result = client.rpc(
        "claim_parse_job",
        {"p_worker_id": worker_id, "p_lock_seconds": lock_seconds}
    ).execute()
    
    return result.data if result.data else None


async def complete_job(job_id: str, _result_data: Optional[dict] = None) -> dict:
    """
    Mark a job as successfully completed.
    
    Args:
        job_id: The job UUID
        _result_data: Optional result data to store (unused)
    
    Returns:
        The updated job record
    """
    client = get_client()
    
    update_data = {
        "status": "succeeded",
        "finished_at": datetime.now(timezone.utc).isoformat(),
        "locked_at": None,
        "locked_by": None,
    }
    
    result = client.table("parse_jobs").update(update_data).eq("id", job_id).execute()
    return result.data[0] if result.data else {}


async def fail_job(job_id: str, error: str) -> dict:
    """
    Mark a job as failed.
    
    Args:
        job_id: The job UUID
        error: Error message describing the failure
    
    Returns:
        The updated job record
    """
    client = get_client()
    
    update_data = {
        "status": "failed",
        "error": error,
        "finished_at": datetime.now(timezone.utc).isoformat(),
        "locked_at": None,
        "locked_by": None,
    }
    
    result = client.table("parse_jobs").update(update_data).eq("id", job_id).execute()
    return result.data[0] if result.data else {}


# Storage helpers
#
# NOTE: the Supabase Storage bucket must exist in your Supabase project.
# Configure via env var to avoid hard-coding bucket names across environments.
DEFAULT_BUCKET = os.getenv("SUPABASE_STORAGE_BUCKET", "parse-files")


def download_file(file_id: str, dest_path: Path, bucket: str = DEFAULT_BUCKET) -> Path:
    """
    Download a file from Supabase Storage.
    
    Args:
        file_id: The file path/ID in storage
        dest_path: Local path to save the file
        bucket: Storage bucket name
        
    Returns:
        Path to the downloaded file
    """
    client = get_client()
    
    # Download file content
    response = client.storage.from_(bucket).download(file_id)
    
    # Ensure parent directory exists
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Write to file
    dest_path.write_bytes(response)
    
    return dest_path


def upload_file(local_path: Path, bucket: str = DEFAULT_BUCKET, dest_path: Optional[str] = None) -> str:
    """
    Upload a file to Supabase Storage.

    Args:
        local_path: Local file path to upload
        bucket: Storage bucket name
        dest_path: Destination path in bucket (defaults to filename)

    Returns:
        The file path/ID in storage
    """
    client = get_client()

    # Use filename if no dest_path provided
    file_path = dest_path or local_path.name

    # Read file content
    content = local_path.read_bytes()

    # Upload to storage
    client.storage.from_(bucket).upload(
        path=file_path,
        file=content,
        file_options={"content-type": "application/pdf"},
    )

    return file_path


def upload_bytes(
    content: bytes,
    dest_path: str,
    bucket: str = DEFAULT_BUCKET,
    content_type: str = "application/pdf",
) -> str:
    """
    Upload bytes directly to Supabase Storage.

    Args:
        content: File content as bytes
        dest_path: Destination path in bucket
        bucket: Storage bucket name
        content_type: MIME type of the file

    Returns:
        The file path in storage
    """
    client = get_client()

    client.storage.from_(bucket).upload(
        path=dest_path,
        file=content,
        file_options={"content-type": content_type},
    )

    return dest_path


def get_file_bytes(file_path: str, bucket: str = DEFAULT_BUCKET) -> bytes:
    """
    Get file content as bytes from Supabase Storage.

    Args:
        file_path: Path to file in storage
        bucket: Storage bucket name

    Returns:
        File content as bytes
    """
    client = get_client()
    return client.storage.from_(bucket).download(file_path)
