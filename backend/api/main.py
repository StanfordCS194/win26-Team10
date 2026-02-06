"""
FastAPI application for the parse job queue API.
"""

import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional

from api.supabase import create_job, get_job_status

app = FastAPI(
    title="Parse API",
    description="API for submitting and tracking parse jobs",
    version="1.0.0",
)


class ParseJobRequest(BaseModel):
    """Request body for creating a parse job."""
    user_id: Optional[str] = None
    parsed_file_id: Optional[str] = None


class ParseJobResponse(BaseModel):
    """Response for a parse job."""
    job_id: str
    status: str


class JobStatusResponse(BaseModel):
    """Response for job status query."""
    job_id: str
    status: str
    error: Optional[str] = None
    created_at: Optional[str] = None
    started_at: Optional[str] = None
    finished_at: Optional[str] = None


@app.get("/")
async def health_check():
    """Health check endpoint for Railway."""
    return {"status": "healthy", "service": "api"}


@app.post("/parse", status_code=202, response_model=ParseJobResponse)
async def create_parse_job(request: ParseJobRequest = ParseJobRequest()):
    """
    Create a new parse job.
    
    Returns 202 Accepted immediately with the job ID.
    The job will be processed asynchronously by a worker.
    """
    job = await create_job(
        user_id=request.user_id,
        parsed_file_id=request.parsed_file_id,
    )
    
    return ParseJobResponse(
        job_id=str(job["id"]),
        status=job["status"],
    )


@app.get("/parse/{job_id}", response_model=JobStatusResponse)
async def get_parse_job_status(job_id: str):
    """
    Get the status of a parse job.
    
    Args:
        job_id: The UUID of the job to check
    
    Returns:
        The current status of the job
    """
    job = await get_job_status(job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return JobStatusResponse(
        job_id=str(job["id"]),
        status=job["status"],
        error=job.get("error"),
        created_at=job.get("created_at"),
        started_at=job.get("started_at"),
        finished_at=job.get("finished_at"),
    )
