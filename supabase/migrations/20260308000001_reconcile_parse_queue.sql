-- Reconcile parse queue schema/function after manual DB edits.
-- Keeps production aligned with the worker code path.

alter table if exists public.parse_jobs
    add column if not exists storage_path text,
    add column if not exists locked_at timestamptz,
    add column if not exists locked_by text,
    add column if not exists attempts int not null default 0,
    add column if not exists started_at timestamptz,
    add column if not exists finished_at timestamptz,
    add column if not exists error text;

create index if not exists parse_jobs_status_created_at_idx
    on public.parse_jobs (status, created_at);

create index if not exists parse_jobs_user_id_idx
    on public.parse_jobs (user_id);

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
      and (
        locked_at is null
        or locked_at < now() - make_interval(secs => p_lock_seconds)
      )
    order by created_at asc
    limit 1
    for update skip locked;

    if not found then
        return null;
    end if;

    update public.parse_jobs
    set status = 'running',
        started_at = coalesce(started_at, now()),
        locked_at = now(),
        locked_by = p_worker_id,
        attempts = coalesce(attempts, 0) + 1
    where id = v_job.id;

    return (
        select to_json(pj.*)
        from public.parse_jobs pj
        where pj.id = v_job.id
    );
end;
$$;

grant execute on function public.claim_parse_job(text, int) to anon, authenticated, service_role;
