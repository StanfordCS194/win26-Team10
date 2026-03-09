"""
FastAPI application for the parse job queue API.
"""

import uuid
import json
from datetime import datetime
from typing import Optional

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

from api.auth import get_current_user
from api.supabase import (
    create_job,
    get_applicant,
    get_file_bytes,
    get_job_status,
    get_user,
    get_all_users,
    update_applicant,
    update_user_latest_repr,
    upload_bytes,
    get_school_id_by_name,
    get_school_by_email,
    get_applicant_detail,
    upsert_applicant_detail,
)

app = FastAPI(
    title="Parse API",
    description="API for submitting and tracking parse jobs",
    version="1.0.0",
)

# CORS: allow local frontend dev server(s) to call the API
# Without this, browsers will block requests due to failed preflight (OPTIONS).
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://win26-team10-frontend.onrender.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


class ApplicantProfile(BaseModel):
    """Applicant profile data."""

    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    school: Optional[str] = None
    school_id: Optional[str] = None
    major: Optional[str] = None
    graduation_year: Optional[str] = None
    gpa: Optional[float] = None
    skills: Optional[list[str]] = None
    work_authorization: Optional[str] = None
    updated_at: Optional[str] = None
    latest_repr_path: Optional[str] = None
    resume_path: Optional[str] = None
    latest_report_path: Optional[str] = None
    is_complete: Optional[bool] = None


# =============================================================================
# Endpoints
# =============================================================================


@app.get("/")
async def health_check():
    """Health check endpoint for Railway."""
    return {"status": "healthy", "service": "api"}


@app.post("/transcript/parse", status_code=202, response_model=ParseJobResponse)
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
        job_type="transcript",
    )

    # Update user's latest_repr_path if they are a student
    # The actual transcript.json path will be updated by the worker after processing
    db_user = await get_user(user_id)
    if db_user and db_user.get("type") == "student":
        await update_user_latest_repr(
            user_id, 
            f"{storage_path}/transcript.json",
            f"{storage_path}/analysis_summary.json"
        )
    
    # Also update applicant record if it exists
    applicant = await get_applicant(user_id)
    if applicant:
        await update_applicant(user_id, {
            "latest_repr_path": f"{storage_path}/transcript.json",
            "latest_report_path": f"{storage_path}/analysis_summary.json"
        })

    return ParseJobResponse(
        job_id=str(job["id"]),
        status=job["status"],
        storage_path=storage_path,
    )


@app.post("/resume/parse", status_code=202, response_model=ParseJobResponse)
async def create_resume_parse_job(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """
    Create a new resume parse job by uploading a PDF.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    job_id = str(uuid.uuid4())
    user_id = user["id"]
    storage_path = f"{user_id}/{job_id}"
    content = await file.read()

    upload_bytes(
        content=content,
        dest_path=f"{storage_path}/source.pdf",
        content_type="application/pdf",
    )

    job = await create_job(
        user_id=user_id,
        storage_path=storage_path,
        job_type="resume",
    )

    # Track latest uploaded resume path immediately.
    applicant = await get_applicant(user_id)
    if applicant:
        await update_applicant(user_id, {"resume_path": f"{storage_path}/source.pdf"})

    return ParseJobResponse(
        job_id=str(job["id"]),
        status=job["status"],
        storage_path=storage_path,
    )


@app.get("/transcript/parse/{job_id}", response_model=JobStatusResponse)
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
    if job.get("job_type", "transcript") != "transcript":
        raise HTTPException(status_code=404, detail="Transcript parse job not found")

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


@app.get("/resume/parse/{job_id}", response_model=JobStatusResponse)
async def get_resume_parse_job_status(
    job_id: str,
    user: dict = Depends(get_current_user),
):
    """
    Get the status of a resume parse job.
    """
    job = await get_job_status(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.get("job_type") != "resume":
        raise HTTPException(status_code=404, detail="Resume parse job not found")
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


@app.get("/get_latest_transcript")
async def get_latest_transcript(user: dict = Depends(get_current_user)):
    """
    Get the current user's latest parsed transcript.

    Returns the contents of the user's latest transcript.json file.
    Only available for users with type='student'.
    """
    user_id = user["id"]

    # Get applicant record
    applicant = await get_applicant(user_id)
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant profile not found")

    # Check if user has a latest transcript
    latest_path = applicant.get("latest_repr_path")
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


@app.get("/transcript/detail")
async def get_my_transcript_detail(user: dict = Depends(get_current_user)):
    """
    Get the current user's detailed transcript data from applicants_detail table.
    """
    detail = await get_applicant_detail(user["id"])
    if not detail:
        raise HTTPException(status_code=404, detail="Transcript detail not found")
    return detail


@app.get("/transcript/detail/{user_id}")
async def get_user_transcript_detail(user_id: str, user: dict = Depends(get_current_user)):
    """
    Get a specific user's detailed transcript data.
    Only available for recruiters.
    """
    db_user = await get_user(user["id"])
    if not db_user or db_user.get("type") != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can access other users' details")
    
    detail = await get_applicant_detail(user_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Transcript detail not found")
    return detail


@app.get("/get_users")
async def get_users():
    """
    Get all users.

    Returns:
        List of user records or None if not found
    """
    return await get_all_users()

@app.get("/get_specific_transcript/{user_id}")
async def get_specific_transcript(user_id: str):
    """
    Get a list of a specific user's latest parsed transcript.

    Returns the contents of the user's latest transcript.json file.
    Only available for users with type='recruiter'.
    """
    # Get user record
    db_user = await get_applicant(user_id)
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

@app.get("/get_resume/{user_id}")
async def get_resume(user_id: str):
    """
    Get a specific user's resume file.
    
    Returns the resume PDF or DOCX file.
    Only available for recruiters.
    """
    # Get applicant profile
    applicant = await get_applicant(user_id)
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant not found")
    
    # Check if user has a resume
    resume_path = applicant.get("resume_path")
    if not resume_path:
        raise HTTPException(status_code=404, detail="No resume found")
    
    try:
        # Download and return the resume
        content = get_file_bytes(resume_path)
        
        # Determine content type based on file extension
        content_type = "application/pdf" if resume_path.endswith('.pdf') else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        
        return Response(
            content=content,
            media_type=content_type,
            headers={
                "Content-Disposition": f"inline; filename=resume_{user_id}.{resume_path.split('.')[-1]}"
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=404,
            detail=f"Resume file not found: {e}",
        )

@app.get("/profile", response_model=ApplicantProfile)
async def get_profile(user: dict = Depends(get_current_user)):
    """Get the current user's applicant profile."""
    applicant = await get_applicant(user["id"])
    if not applicant:
        raise HTTPException(status_code=404, detail="Profile not found")
    return applicant

@app.get("/get_school_from_email")
async def get_school_from_email(user: dict = Depends(get_current_user)):
    """Get school name based on user's email domain."""
    email = user.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="No email found")
    
    school_info = await get_school_by_email(email)
    
    if school_info:
        return school_info
    
    return {"school_name": None, "school_id": None}

@app.get("/get_specific_profile/{user_id}")
async def get_specific_profile(user_id: str):
    """Get a specific user's applicant profile.
    Only available for users with type='recruiter'.
    """
    applicant = await get_applicant(user_id)
    if not applicant:
        raise HTTPException(status_code=404, detail="Profile not found")
    return applicant

@app.post("/profile", response_model=ApplicantProfile)
async def update_profile(
    profile: ApplicantProfile,
    user: dict = Depends(get_current_user),
):
    """Update the current user's applicant profile and calculate completion."""
    user_id = user["id"]
    
    # Convert Pydantic model to dict, excluding None values
    update_data = profile.model_dump(exclude_unset=True)
    
    # Look up school_id if school name is provided
    if "school" in update_data and update_data["school"]:
        school_id = await get_school_id_by_name(update_data["school"])
        if school_id:
            update_data["school_id"] = school_id
    
    # Calculate is_complete
    # Required fields: first_name, last_name, email, major, graduation_year, gpa, skills
    # We also need a transcript (latest_repr_path) to be truly complete
    existing = await get_applicant(user_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Applicant profile not found")
    
    # Ensure email is preserved from existing record if not provided
    if "email" not in update_data and existing.get("email"):
        update_data["email"] = existing["email"]
    elif "email" not in update_data and user.get("email"):
        update_data["email"] = user["email"]

    merged = {**existing, **update_data}
    
    required_fields = [
        "first_name", "last_name", "email", "school", "major", 
        "graduation_year", "gpa", "skills", "latest_repr_path", "latest_report_path"
    ]
    
    is_complete = all(merged.get(f) for f in required_fields)
    # Special check for skills as it's a list
    if is_complete and not merged.get("skills"):
        is_complete = False
        
    update_data["is_complete"] = is_complete
    
    updated = await update_applicant(user_id, update_data)
    return updated

@app.post("/upload_resume")
async def upload_resume(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """Upload a resume file for the current user."""
    user_id = user["id"]
    
    # Validate file type
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    
    filename_lower = file.filename.lower()
    if not filename_lower.endswith('.pdf'):
        raise HTTPException(
            status_code=400, 
            detail="Only PDF files are supported"
        )
    
    # Determine content type
    content_type = "application/pdf"
    
    # Read file content
    content = await file.read()
    
    # Upload to storage: {user_id}/resumes/{timestamp}.{ext}
    ext = "pdf"
    timestamp = int(datetime.now().timestamp())
    storage_path = f"{user_id}/resumes/{timestamp}.{ext}"
    
    upload_bytes(
        content=content,
        dest_path=storage_path,
        content_type=content_type,
    )
    
    # Update applicant profile with resume path
    await update_applicant(user_id, {"resume_path": storage_path})
    
    return {"resume_path": storage_path, "message": "Resume uploaded successfully"}


@app.post("/chat/attachments")
async def upload_chat_attachment(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """
    Upload a generic chat attachment for the current user.

    The file is stored in Supabase Storage under:
      {user_id}/chat/{timestamp}_{original_filename}

    Returns storage_path and original filename, which the frontend can
    embed in a message as a clickable link.
    """
    user_id = user["id"]

    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    original_name = file.filename
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")

    ext = original_name.rsplit(".", 1)[-1].lower() if "." in original_name else "bin"
    timestamp = int(datetime.now().timestamp())
    safe_name = original_name.replace("/", "_")
    storage_path = f"{user_id}/chat/{timestamp}_{safe_name}"

    content_type = file.content_type or "application/octet-stream"

    upload_bytes(
        content=content,
        dest_path=storage_path,
        content_type=content_type,
    )

    return {"storage_path": storage_path, "filename": original_name}


@app.get("/chat/attachments/{attachment_path:path}")
async def get_chat_attachment(
    attachment_path: str,
    user: dict = Depends(get_current_user),
):
    """
    Download a previously uploaded chat attachment.

    Any authenticated user can access an attachment link; access control
    is handled at the application level by only sharing links with
    conversation participants.
    """
    try:
        content = get_file_bytes(attachment_path)
    except Exception as e:
        raise HTTPException(
            status_code=404,
            detail=f"Attachment not found: {e}",
        )

    ext = attachment_path.rsplit(".", 1)[-1].lower() if "." in attachment_path else ""
    if ext == "pdf":
        content_type = "application/pdf"
    elif ext in ("doc", "docx"):
        content_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    else:
        content_type = "application/octet-stream"

    filename = attachment_path.split("/")[-1]

    return Response(
        content=content,
        media_type=content_type,
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
        },
    )
