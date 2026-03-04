-- Persist student applications to jobs
create table if not exists public.job_applications (
    id uuid primary key default gen_random_uuid(),
    job_id uuid not null references public.jobs(id) on delete cascade,
    student_id uuid not null references public.users(id) on delete cascade,
    created_at timestamptz not null default now(),
    unique (job_id, student_id)
);

create index if not exists job_applications_job_id_idx
    on public.job_applications (job_id);
create index if not exists job_applications_student_id_idx
    on public.job_applications (student_id);

alter table public.job_applications enable row level security;

create policy "Students can read their own applications"
    on public.job_applications
    for select
    using (student_id = auth.uid());

create policy "Students can create their own applications"
    on public.job_applications
    for insert
    with check (
        student_id = auth.uid()
        and exists (
            select 1
            from public.users u
            where u.id = auth.uid()
              and u.type = 'student'
        )
    );

create policy "Recruiters can read applications for their company jobs"
    on public.job_applications
    for select
    using (
        exists (
            select 1
            from public.jobs j
            join public.company_memberships cm
              on cm.company_id = j.company_id
            where j.id = job_applications.job_id
              and cm.user_id = auth.uid()
              and cm.status = 'approved'
        )
    );

create policy "Service role has full access to job_applications"
    on public.job_applications
    for all
    using (true)
    with check (true);

create policy "Recruiters can read applicants for screening"
    on public.applicants
    for select
    using (
        exists (
            select 1
            from public.users u
            where u.id = auth.uid()
              and u.type = 'recruiter'
        )
    );
