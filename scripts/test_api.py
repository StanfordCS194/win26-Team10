#!/usr/bin/env python3
"""
Test the Parse API endpoints.

Usage:
    # First create a test user and get a token
    python scripts/create_test_user.py
    
    # Then run the API tests
    python scripts/test_api.py

    # Or specify a custom PDF
    python scripts/test_api.py --pdf path/to/file.pdf

    # Or specify a custom API URL
    python scripts/test_api.py --api-url http://localhost:8000
"""

import argparse
import json
import sys
import time
from pathlib import Path

import httpx

# Default values
DEFAULT_API_URL = "http://localhost:8000"
DEFAULT_PDF = Path(__file__).parent.parent / "transcripts" / "niall.pdf"
TOKEN_FILE = Path(__file__).parent / "test_token.txt"


def load_token() -> str:
    """Load the test token from file."""
    if not TOKEN_FILE.exists():
        print(f"Error: Token file not found: {TOKEN_FILE}")
        print("Run 'python scripts/create_test_user.py' first")
        sys.exit(1)
    return TOKEN_FILE.read_text().strip()


def test_health(client: httpx.Client, api_url: str) -> bool:
    """Test the health check endpoint."""
    print("\n[1/4] Testing health check...")
    
    response = client.get(f"{api_url}/")
    
    if response.status_code == 200:
        data = response.json()
        print(f"  ✓ Health check passed: {data}")
        return True
    else:
        print(f"  ✗ Health check failed: {response.status_code}")
        return False


def test_upload(client: httpx.Client, api_url: str, pdf_path: Path, token: str) -> str | None:
    """Test the parse upload endpoint."""
    print(f"\n[2/4] Testing PDF upload: {pdf_path}")
    
    if not pdf_path.exists():
        print(f"  ✗ PDF file not found: {pdf_path}")
        return None
    
    with open(pdf_path, "rb") as f:
        files = {"file": (pdf_path.name, f, "application/pdf")}
        response = client.post(
            f"{api_url}/parse",
            files=files,
            headers={"Authorization": f"Bearer {token}"},
        )
    
    if response.status_code == 202:
        data = response.json()
        print(f"  ✓ Upload accepted:")
        print(f"    Job ID: {data['job_id']}")
        print(f"    Status: {data['status']}")
        print(f"    Storage: {data['storage_path']}")
        return data["job_id"]
    else:
        print(f"  ✗ Upload failed: {response.status_code}")
        print(f"    Response: {response.text}")
        return None


def test_job_status(client: httpx.Client, api_url: str, job_id: str, token: str) -> bool:
    """Test the job status endpoint and poll until complete."""
    print(f"\n[3/4] Testing job status: {job_id}")
    
    max_attempts = 100
    attempt = 0
    
    while attempt < max_attempts:
        response = client.get(
            f"{api_url}/parse/{job_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        
        if response.status_code != 200:
            print(f"  ✗ Status check failed: {response.status_code}")
            print(f"    Response: {response.text}")
            return False
        
        data = response.json()
        status = data["status"]
        
        if status == "succeeded":
            print(f"  ✓ Job completed successfully!")
            print(f"    Created:  {data.get('created_at')}")
            print(f"    Started:  {data.get('started_at')}")
            print(f"    Finished: {data.get('finished_at')}")
            return True
        elif status == "failed":
            print(f"  ✗ Job failed: {data.get('error')}")
            return False
        else:
            attempt += 1
            print(f"    Status: {status} (attempt {attempt}/{max_attempts})")
            time.sleep(2)
    
    print(f"  ✗ Job did not complete within {max_attempts * 2} seconds")
    return False


def test_latest(client: httpx.Client, api_url: str, token: str) -> bool:
    """Test the latest transcript endpoint."""
    print("\n[4/4] Testing /get_latest_transcript endpoint...")
    
    response = client.get(
        f"{api_url}/get_latest_transcript",
        headers={"Authorization": f"Bearer {token}"},
    )
    
    if response.status_code == 200:
        # Try to parse as JSON
        try:
            data = json.loads(response.text)
            print(f"  ✓ Got latest transcript:")
            print(f"    Schema version: {data.get('schema_version')}")
            print(f"    Student: {data.get('student', {}).get('name')}")
            print(f"    Institution: {data.get('institution', {}).get('name')}")
            terms = data.get("terms", [])
            print(f"    Terms: {len(terms)}")
            return True
        except json.JSONDecodeError:
            print(f"  ✗ Response is not valid JSON")
            print(f"    Response: {response.text[:200]}...")
            return False
    elif response.status_code == 404:
        print(f"  ! No transcript found (expected if job hasn't completed)")
        print(f"    Response: {response.text}")
        return True  # Not a failure, just no data yet
    else:
        print(f"  ✗ Request failed: {response.status_code}")
        print(f"    Response: {response.text}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Test the Parse API")
    parser.add_argument(
        "--api-url",
        default=DEFAULT_API_URL,
        help=f"API URL (default: {DEFAULT_API_URL})",
    )
    parser.add_argument(
        "--pdf",
        type=Path,
        default=DEFAULT_PDF,
        help=f"PDF file to upload (default: {DEFAULT_PDF})",
    )
    parser.add_argument(
        "--token",
        help="JWT token (default: read from scripts/test_token.txt)",
    )
    parser.add_argument(
        "--skip-upload",
        action="store_true",
        help="Skip upload test, only test other endpoints",
    )
    args = parser.parse_args()
    
    # Load token
    token = args.token or load_token()
    
    print("=" * 60)
    print("PARSE API TEST")
    print("=" * 60)
    print(f"API URL: {args.api_url}")
    print(f"PDF:     {args.pdf}")
    print(f"Token:   {token[:20]}...{token[-10:]}")
    
    # Create HTTP client with timeout
    client = httpx.Client(timeout=60.0)
    
    results = []
    
    # Test 1: Health check
    results.append(("Health Check", test_health(client, args.api_url)))
    
    # Test 2: Upload
    job_id = None
    if not args.skip_upload:
        job_id = test_upload(client, args.api_url, args.pdf, token)
        results.append(("Upload", job_id is not None))
    
    # Test 3: Job status (only if upload succeeded)
    if job_id:
        results.append(("Job Status", test_job_status(client, args.api_url, job_id, token)))
    
    # Test 4: Latest transcript
    results.append(("Latest Transcript", test_latest(client, args.api_url, token)))
    
    # Summary
    print("\n" + "=" * 60)
    print("RESULTS")
    print("=" * 60)
    
    all_passed = True
    for name, passed in results:
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"  {status}: {name}")
        if not passed:
            all_passed = False
    
    print("=" * 60)
    
    sys.exit(0 if all_passed else 1)


if __name__ == "__main__":
    main()
