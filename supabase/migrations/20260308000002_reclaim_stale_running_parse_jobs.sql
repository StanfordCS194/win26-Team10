-- Reclaim parse jobs that were left in "running" after worker restarts/crashes.
-- This intentionally prioritizes stale running jobs before fresh queued jobs.

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
    where (
        status = 'queued'
        or (
            status = 'running'
            and locked_at is not null
            and locked_at < now() - make_interval(secs => p_lock_seconds)
        )
    )
    and (
        locked_at is null
        or locked_at < now() - make_interval(secs => p_lock_seconds)
    )
    order by
        case when status = 'running' then 0 else 1 end,
        created_at asc
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
