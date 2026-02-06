-- Job queue table for parse jobs
create table if not exists public.parse_jobs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null,
    parsed_file_id uuid not null,
    status text not null default 'queued' 
        check (status in ('queued','running','succeeded','failed')),
    error text,
    attempts int not null default 0,
    created_at timestamptz not null default now(),
    started_at timestamptz,
    finished_at timestamptz,
    locked_at timestamptz,
    locked_by text
);

-- Indexes for efficient polling
create index if not exists parse_jobs_status_created_at_idx
    on public.parse_jobs (status, created_at);

create index if not exists parse_jobs_user_id_idx
    on public.parse_jobs (user_id);

-- CRITICAL: Atomic job claiming with SKIP LOCKED
-- This prevents worker contention when multiple workers poll simultaneously
create or replace function public.claim_parse_job(
    p_worker_id text,
    p_lock_seconds int default 900
)
returns json
language plpgsql
as $$
declare
    v_job public.parse_jobs%rowtype;
begin
    select * into v_job
    from public.parse_jobs
    where status = 'queued'
      and (locked_at is null 
           or locked_at < now() - make_interval(secs => p_lock_seconds))
    order by created_at asc
    limit 1
    for update skip locked;  -- KEY: prevents worker contention

    if not found then
        return null;
    end if;

    update public.parse_jobs
    set status = 'running',
        started_at = coalesce(started_at, now()),
        locked_at = now(),
        locked_by = p_worker_id,
        attempts = attempts + 1
    where id = v_job.id;

    return (select to_json(pj.*) from public.parse_jobs pj where pj.id = v_job.id);
end;
$$;

-- Enable RLS (Row Level Security) but allow service role full access
alter table public.parse_jobs enable row level security;

-- Policy for service role to have full access
create policy "Service role has full access to parse_jobs"
    on public.parse_jobs
    for all
    using (true)
    with check (true);
