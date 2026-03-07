-- Create applicants_detail table
create table if not exists public.applicants_detail (
    id uuid primary key references public.applicants(id) on delete cascade,
    transcript_raw jsonb,
    transcript_stats jsonb,
    transcript_analysis jsonb,
    resume_raw jsonb,
    resume_analysis jsonb,
    updated_at timestamptz default now()
);

-- Enable Row Level Security
alter table public.applicants_detail enable row level security;

-- RLS Policies
-- 1. Students can read their own details
create policy "Users can read own detail"
    on public.applicants_detail
    for select
    using (auth.uid() = id);

-- 2. Recruiters can read all details
create policy "Recruiters can read all details"
    on public.applicants_detail
    for select
    using (
        exists (
            select 1 from public.users
            where id = auth.uid()
            and type = 'recruiter'
        )
    );

-- 3. Service role can do everything (implied by Supabase defaults, but good to be explicit for our worker)
create policy "Service role can manage all details"
    on public.applicants_detail
    for all
    using (true)
    with check (true);

-- Trigger to update updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger on_applicants_detail_updated
    before update on public.applicants_detail
    for each row
    execute function public.handle_updated_at();
