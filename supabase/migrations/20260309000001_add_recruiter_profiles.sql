-- Recruiter profiles: one row per recruiter, editable only by that user (RLS)
-- Date: 2026-03-09

create table if not exists public.recruiter_profiles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    full_name text,
    job_title text,
    location text,
    bio text,
    linkedin_url text,
    profile_photo_path text,
    specializations text[] not null default '{}',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.recruiter_profiles enable row level security;

-- Users can read only their own profile
create policy "Users can read own recruiter profile"
    on public.recruiter_profiles
    for select
    using (auth.uid() = user_id);

-- Users can insert only their own profile
create policy "Users can insert own recruiter profile"
    on public.recruiter_profiles
    for insert
    with check (auth.uid() = user_id);

-- Users can update only their own profile
create policy "Users can update own recruiter profile"
    on public.recruiter_profiles
    for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- Trigger to auto-update updated_at
drop trigger if exists recruiter_profiles_updated_at on public.recruiter_profiles;
create trigger recruiter_profiles_updated_at
    before update on public.recruiter_profiles
    for each row execute procedure public.update_updated_at();
