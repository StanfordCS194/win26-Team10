-- Add job_type so parse worker can route transcript vs resume jobs.
alter table public.parse_jobs
    add column if not exists job_type text not null default 'transcript'
    check (job_type in ('transcript', 'resume'));

-- Ensure legacy rows have an explicit type.
update public.parse_jobs
set job_type = 'transcript'
where job_type is null;
