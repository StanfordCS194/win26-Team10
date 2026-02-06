"""
FastAPI application for the parse job queue API.
"""

import uuid
from typing import Optional

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel

from api.auth import get_current_user
from api.supabase import (
    create_job,
    get_file_bytes,
    get_job_status,
    get_user,
    update_user_latest_repr,
    upload_bytes,
)

app = FastAPI(
    title="Parse API",
    description="API for submitting and tracking parse jobs",
    version="1.0.0",
)


# =============================================================================
# Response Models
# =============================================================================


class ParseJobResponse(BaseModel):
    """Response for a parse job."""

    job_id: str
    status: str
    storage_path: str


class JobStatusResponse(BaseModel):
    """Response for job status query."""

    job_id: str
    status: str
    storage_path: Optional[str] = None
    error: Optional[str] = None
    created_at: Optional[str] = None
    started_at: Optional[str] = None
    finished_at: Optional[str] = None


# =============================================================================
# Endpoints
# =============================================================================


@app.get("/")
async def health_check():
    """Health check endpoint for Railway."""
    return {"status": "healthy", "service": "api"}


@app.post("/parse", status_code=202, response_model=ParseJobResponse)
async def create_parse_job(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """
    Create a new parse job by uploading a PDF.

    Requires authentication via Bearer token.

    The PDF is uploaded to storage at /{user_id}/{job_id}/source.pdf
    and a job is queued for processing.

    Returns 202 Accepted immediately with the job ID.
    The job will be processed asynchronously by a worker.
    """
    # Validate file type
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    # Generate job ID and storage path
    job_id = str(uuid.uuid4())
    user_id = user["id"]
    storage_path = f"{user_id}/{job_id}"

    # Read file content
    content = await file.read()

    # Upload PDF to storage
    upload_bytes(
        content=content,
        dest_path=f"{storage_path}/source.pdf",
        content_type="application/pdf",
    )

    # Create job record
    job = await create_job(
        user_id=user_id,
        storage_path=storage_path,
    )

    # Update user's latest_repr_path if they are a student
    # The actual transcript.json path will be updated by the worker after processing
    db_user = await get_user(user_id)
    if db_user and db_user.get("type") == "student":
        await update_user_latest_repr(user_id, f"{storage_path}/transcript.json")

    return ParseJobResponse(
        job_id=str(job["id"]),
        status=job["status"],
        storage_path=storage_path,
    )


@app.get("/parse/{job_id}", response_model=JobStatusResponse)
async def get_parse_job_status(
    job_id: str,
    user: dict = Depends(get_current_user),
):
    """
    Get the status of a parse job.

    Requires authentication. Users can only view their own jobs.

    Args:
        job_id: The UUID of the job to check

    Returns:
        The current status of the job
    """
    job = await get_job_status(job_id)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Verify ownership
    if job.get("user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    return JobStatusResponse(
        job_id=str(job["id"]),
        status=job["status"],
        storage_path=job.get("storage_path"),
        error=job.get("error"),
        created_at=job.get("created_at"),
        started_at=job.get("started_at"),
        finished_at=job.get("finished_at"),
    )


@app.get("/latest")
async def get_latest_transcript(user: dict = Depends(get_current_user)):
    """
    Get the current user's latest parsed transcript.

    Returns the contents of the user's latest transcript.json file.
    Only available for users with type='student'.
    """
    user_id = user["id"]

    # Get user record
    db_user = await get_user(user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if user has a latest transcript
    latest_path = db_user.get("latest_repr_path")
    if not latest_path:
        raise HTTPException(status_code=404, detail="No transcript found")

    try:
        # Download and return the transcript
        content = get_file_bytes(latest_path)
        return Response(
            content=content,
            media_type="application/json",
        )
    except Exception as e:
        raise HTTPException(
            status_code=404,
            detail=f"Transcript file not found: {e}",
        )
