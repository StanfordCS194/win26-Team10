-- Add work authorization, disability, and veteran status to job applications
alter table public.job_applications
  add column if not exists work_authorization text,
  add column if not exists disability_status text,
  add column if not exists veteran_status text;
