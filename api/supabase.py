"""
Supabase database helpers for job queue and user operations.
"""

import os
import uuid
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


async def update_user_latest_repr(user_id: str, storage_path: str) -> dict:
    """
    Update a user's latest_repr_path.

    Args:
        user_id: The user UUID
        storage_path: Path to the transcript.json in storage

    Returns:
        The updated user record
    """
    client = get_client()
    result = (
        client.table("users")
        .update({"latest_repr_path": storage_path})
        .eq("id", user_id)
        .execute()
    )
    return result.data[0] if result.data else {}


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

    job_data = {
        "user_id": user_id,
        "parsed_file_id": parsed_file_id or str(uuid.uuid4()),
        "storage_path": storage_path,
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


async def complete_job(job_id: str, result_data: Optional[dict] = None) -> dict:
    """
    Mark a job as successfully completed.
    
    Args:
        job_id: The job UUID
        result_data: Optional result data to store
    
    Returns:
        The updated job record
    """
    client = get_client()
    
    update_data = {
        "status": "succeeded",
        "finished_at": "now()",
    }
    
    result = client.table("parse_jobs").update(update_data).eq("id", job_id).execute()
    return result.data[0]


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
        "finished_at": "now()",
    }
    
    result = client.table("parse_jobs").update(update_data).eq("id", job_id).execute()
    return result.data[0]


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


def upload_file(local_path: Path, bucket: str = DEFAULT_BUCKET, dest_path: str | None = None) -> str:
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
