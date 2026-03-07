-- Jobs table for recruiter postings and student browsing
create table if not exists public.jobs (
    id uuid primary key default gen_random_uuid(),
    recruiter_id uuid references public.users(id) on delete set null,
    title text not null,
    company text not null,
    location text not null,
    type text not null check (type in ('Internship', 'Full-time', 'Part-time', 'Contract')),
    salary_display text,
    salary_min integer,
    description text not null,
    skills text[] not null default '{}',
    requirements text[] not null default '{}',
    benefits text[] not null default '{}',
    preferred_majors text[] not null default '{}',
    preferred_grad_years text[] not null default '{}',
    min_gpa numeric(3,2),
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists jobs_created_at_idx on public.jobs (created_at desc);
create index if not exists jobs_company_idx on public.jobs (company);
create index if not exists jobs_type_idx on public.jobs (type);
create index if not exists jobs_is_active_idx on public.jobs (is_active);

alter table public.jobs enable row level security;

-- Any authenticated app user can view active jobs
create policy "Authenticated users can read jobs"
    on public.jobs
    for select
    using (auth.uid() is not null);

-- Recruiters can create jobs only for themselves
create policy "Recruiters can insert their own jobs"
    on public.jobs
    for insert
    with check (
        recruiter_id = auth.uid()
        and exists (
            select 1
            from public.users u
            where u.id = auth.uid()
              and u.type = 'recruiter'
        )
    );

-- Recruiters can edit only jobs they created
create policy "Recruiters can update their own jobs"
    on public.jobs
    for update
    using (recruiter_id = auth.uid())
    with check (recruiter_id = auth.uid());

-- Recruiters can delete only jobs they created
create policy "Recruiters can delete their own jobs"
    on public.jobs
    for delete
    using (recruiter_id = auth.uid());

-- Service role has full access
create policy "Service role has full access to jobs"
    on public.jobs
    for all
    using (true)
    with check (true);

drop trigger if exists jobs_updated_at on public.jobs;
create trigger jobs_updated_at
    before update on public.jobs
    for each row execute procedure public.update_updated_at();
