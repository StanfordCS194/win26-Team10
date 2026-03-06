-- Add EEO, location preference, and message to job applications
alter table public.job_applications
  add column if not exists eeo_response text,
  add column if not exists location_preference text,
  add column if not exists message_to_recruiter text;
