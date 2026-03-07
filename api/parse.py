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

from api.supabase import (
    claim_parse_job, 
    complete_job, 
    fail_job, 
    download_file, 
    upload_bytes,
    upsert_applicant_detail
)
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
        
        # Upload transcript.json and analysis_summary.json to storage if pipeline succeeded
        transcript_path = output_dir / "transcript.json"
        analysis_path = output_dir / "analysis_summary.json"
        
        transcript_storage_path = None
        analysis_storage_path = None

        if storage_path:
            # storage_path: "{user_id}/{job_id}"
            if transcript_path.exists():
                transcript_storage_path = f"{storage_path}/transcript.json"
                logger.info(f"Uploading transcript to {transcript_storage_path}")
                upload_bytes(
                    content=transcript_path.read_bytes(),
                    dest_path=transcript_storage_path,
                    content_type="application/json",
                )
            
            if analysis_path.exists():
                analysis_storage_path = f"{storage_path}/analysis_summary.json"
                logger.info(f"Uploading analysis summary to {analysis_storage_path}")
                upload_bytes(
                    content=analysis_path.read_bytes(),
                    dest_path=analysis_storage_path,
                    content_type="application/json",
                )
    
        # Update applicant record if we have a user_id
        user_id = job.get("user_id")
        if user_id and transcript_storage_path:
            from api.supabase import update_user_latest_repr
            logger.info(f"Updating applicant {user_id} with latest paths: repr={transcript_storage_path}, report={analysis_storage_path}")
            await update_user_latest_repr(
                user_id=user_id,
                storage_path=transcript_storage_path,
                report_path=analysis_storage_path
            )

            # Update applicants_detail table with raw and analyzed data
            detail_data = {
                "transcript_raw": artifacts.transcript,
                "transcript_stats": artifacts.outputs.get("applicants_detail_update", {}).get("transcript_stats")
            }
            # Also include qualitative analysis report if available
            if artifacts.outputs.get("analysis_report"):
                import json
                report_path = artifacts.outputs["analysis_report"]
                if report_path.exists():
                    report_data = json.loads(report_path.read_text())
                    detail_data["transcript_analysis"] = report_data

            logger.info(f"Upserting applicants_detail for {user_id}")
            await upsert_applicant_detail(user_id, detail_data)

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
