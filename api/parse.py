"""
Parse worker process.

Polls the database for queued jobs and processes them.
Runs the parse pipeline for each job.
"""

import asyncio
import os
import uuid
import logging
from pathlib import Path

from api.supabase import claim_parse_job, complete_job, fail_job, download_file, upload_bytes
from api.pipeline import run_pipeline

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("worker-parse")

# Configuration from environment
POLL_SECONDS = float(os.getenv("WORKER_POLL_SECONDS", "2.0"))
LOCK_SECONDS = int(os.getenv("WORKER_LOCK_SECONDS", "900"))
WORKER_ID = f"worker-parse-{uuid.uuid4().hex[:8]}"


async def process_job(job: dict) -> None:
    """
    Process a single job by running the parse pipeline.
    
    Args:
        job: The job record from the database
    """
    job_id = job["id"]
    storage_path = job.get("storage_path", "")
    
    logger.info(f"Processing job {job_id}")
    
    try:
        # Set up output directory
        repo_root = Path(__file__).resolve().parents[1]
        output_dir = repo_root / "debug" / job_id
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Download PDF from storage
        pdf_path = output_dir / "input.pdf"
        if storage_path:
            # storage_path is like "{user_id}/{job_id}/source.pdf"
            source_file = f"{storage_path}/source.pdf"
            logger.info(f"Downloading {source_file} to {pdf_path}")
            download_file(source_file, pdf_path)
        
        # Run pipeline
        artifacts = run_pipeline(
            job_id=job_id,
            file_id=storage_path,  # Use storage_path as file_id for compatibility
            local_pdf_path=pdf_path if pdf_path.exists() else None,
            output_dir=output_dir,
        )
        
        if artifacts.errors:
            raise Exception("; ".join(artifacts.errors))
        
        # Upload transcript.json to storage if pipeline succeeded
        transcript_path = output_dir / "transcript.json"
        if storage_path and transcript_path.exists():
            dest_path = f"{storage_path}/transcript.json"
            logger.info(f"Uploading transcript to {dest_path}")
            upload_bytes(
                content=transcript_path.read_bytes(),
                dest_path=dest_path,
                content_type="application/json",
            )
        
        await complete_job(job_id)
        logger.info(f"Job {job_id} completed successfully")
        
    except Exception as e:
        logger.error(f"Job {job_id} failed: {e}")
        await fail_job(job_id, str(e))


async def worker_loop() -> None:
    """
    Main worker loop.
    
    Continuously polls for jobs and processes them.
    """
    logger.info(f"Starting worker {WORKER_ID}")
    logger.info(f"Poll interval: {POLL_SECONDS}s, Lock timeout: {LOCK_SECONDS}s")
    
    while True:
        try:
            # Try to claim a job
            job = await claim_parse_job(WORKER_ID, LOCK_SECONDS)
            
            if job:
                await process_job(job)
            else:
                # No jobs available, wait before polling again
                await asyncio.sleep(POLL_SECONDS)
                
        except Exception as e:
            logger.error(f"Error in worker loop: {e}")
            # Wait before retrying on error
            await asyncio.sleep(POLL_SECONDS)


def main() -> None:
    """Entry point for the worker process."""
    logger.info("Worker process starting...")
    asyncio.run(worker_loop())


if __name__ == "__main__":
    main()
