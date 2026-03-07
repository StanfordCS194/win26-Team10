-- Add work authorization to applicants for profile/matching
alter table public.applicants
  add column if not exists work_authorization text;
