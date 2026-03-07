# Parse API Documentation

This document describes the Parse API endpoints, authentication, and how frontend clients should integrate.

## Overview

The Parse API allows authenticated users to:
1. Upload PDF transcripts for parsing
2. Check job status
3. Retrieve their latest parsed transcript

## Authentication

All endpoints (except health check) require authentication via Supabase JWT.

### Getting a Token

The frontend should use Supabase Auth to authenticate users. After login, you get an access token:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password'
})

// Get the access token
const token = data.session?.access_token
```

### Using the Token

Include the token in the `Authorization` header for all API requests:

```typescript
  const response = await fetch(`${API_URL}/transcript/parse`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  })
```

## Endpoints

### Health Check

```
GET /
```

No authentication required. Returns API status.

**Response:**
```json
{
  "status": "healthy",
  "service": "api"
}
```

---

### Upload Transcript

```
POST /transcript/parse
```

Upload a PDF transcript for parsing. The file is stored and a background job is queued.

**Request:**
- Content-Type: `multipart/form-data`
- Body: `file` (PDF file)

**Example (TypeScript):**
```typescript
async function uploadTranscript(file: File, token: string) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${API_URL}/transcript/parse`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`)
  }

  return response.json()
}
```

**Response (202 Accepted):**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "storage_path": "user-uuid/job-uuid"
}
```

**Errors:**
- `400` - Invalid file (not a PDF)
- `401` - Missing or invalid token

---

### Get Job Status

```
GET /transcript/parse/{job_id}
```

Check the status of a parse job. Users can only view their own jobs.

**Example:**
```typescript
async function getJobStatus(jobId: string, token: string) {
  const response = await fetch(`${API_URL}/transcript/parse/${jobId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  return response.json()
}
```

**Response:**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "succeeded",
  "storage_path": "user-uuid/job-uuid",
  "error": null,
  "created_at": "2026-02-06T10:00:00Z",
  "started_at": "2026-02-06T10:00:05Z",
  "finished_at": "2026-02-06T10:00:30Z"
}
```

**Job Statuses:**
| Status | Description |
|--------|-------------|
| `queued` | Job is waiting to be processed |
| `running` | Job is currently being processed |
| `succeeded` | Job completed successfully |
| `failed` | Job failed (check `error` field) |

**Errors:**
- `401` - Missing or invalid token
- `403` - Job belongs to another user
- `404` - Job not found

---

### Get Latest Transcript

```
GET /get_latest_transcript
```

Get the current user's most recently parsed transcript. Only available for users with type `student`.

**Example:**
```typescript
async function getLatestTranscript(token: string) {
  const response = await fetch(`${API_URL}/get_latest_transcript`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to get transcript: ${response.statusText}`)
  }

  return response.json()
}
```

**Response:**
Returns the full transcript JSON (see [TRANSCRIPT_SCHEMA.md](TRANSCRIPT_SCHEMA.md) for schema).

**Errors:**
- `401` - Missing or invalid token
- `404` - User not found or no transcript available

## Frontend Integration Example

Here's a complete React example showing the typical flow:

```tsx
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
const API_URL = 'https://your-api.railway.app'

function TranscriptUploader() {
  const [status, setStatus] = useState<string>('')
  const [jobId, setJobId] = useState<string | null>(null)

  async function handleUpload(file: File) {
    // Get current session
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setStatus('Please sign in first')
      return
    }

    const token = session.access_token

    // Upload file
    setStatus('Uploading...')
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${API_URL}/transcript/parse`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    })

    const data = await response.json()
    setJobId(data.job_id)
    setStatus('Processing...')

    // Poll for completion
    pollJobStatus(data.job_id, token)
  }

  async function pollJobStatus(jobId: string, token: string) {
    const response = await fetch(`${API_URL}/transcript/parse/${jobId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })

    const job = await response.json()

    if (job.status === 'succeeded') {
      setStatus('Complete!')
      // Fetch the transcript
      const transcript = await fetch(`${API_URL}/get_latest_transcript`, {
        headers: { 'Authorization': `Bearer ${token}` },
      }).then(r => r.json())
      console.log('Transcript:', transcript)
    } else if (job.status === 'failed') {
      setStatus(`Failed: ${job.error}`)
    } else {
      // Still processing, poll again
      setTimeout(() => pollJobStatus(jobId, token), 2000)
    }
  }

  return (
    <div>
      <input
        type="file"
        accept=".pdf"
        onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
      />
      <p>Status: {status}</p>
    </div>
  )
}
```

## User Types

Users are automatically created in the `users` table when they sign up via Supabase Auth.

| Type | Description |
|------|-------------|
| `student` | Can upload transcripts, has `latest_repr_path` updated |
| `recruiter` | Can upload transcripts, no `latest_repr_path` tracking |

To change a user's type, update the `users` table directly or create an admin endpoint.

## Storage Structure

Files are stored in Supabase Storage with the following structure:

```
parse-files/
└── {user_id}/
    └── {job_id}/
        ├── source.pdf        # Uploaded PDF
        ├── text.txt          # Extracted text
        ├── transcript.json   # Standardized transcript
        └── standardize/
            ├── request.json  # LLM request
            └── response.json # LLM response
```

## Environment Variables

The API requires these environment variables:

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-side only) |
| `SUPABASE_JWT_SECRET` | JWT secret for token verification |
| `OPENROUTER_API_KEY` | OpenRouter API key for LLM |

## Error Handling

All errors follow this format:

```json
{
  "detail": "Error message here"
}
```

Common HTTP status codes:
- `400` - Bad request (invalid input)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (accessing another user's resource)
- `404` - Not found
- `500` - Server error
