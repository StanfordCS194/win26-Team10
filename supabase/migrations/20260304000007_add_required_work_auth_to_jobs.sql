-- Add required work authorization to jobs (hard requirement for matching)
alter table public.jobs
  add column if not exists required_work_authorization text;
