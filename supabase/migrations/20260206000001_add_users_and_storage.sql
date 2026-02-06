-- Users table for tracking user type and latest transcript
create table if not exists public.users (
    id uuid primary key references auth.users(id) on delete cascade,
    email text,
    type text not null default 'student' check (type in ('student', 'recruiter')),
    latest_repr_path text,  -- storage path to latest transcript.json
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Index for querying users by type
create index if not exists users_type_idx on public.users (type);

-- Enable RLS
alter table public.users enable row level security;

-- Users can read their own data
create policy "Users can read own data"
    on public.users
    for select
    using (auth.uid() = id);

-- Users can update their own data
create policy "Users can update own data"
    on public.users
    for update
    using (auth.uid() = id);

-- Service role has full access
create policy "Service role has full access to users"
    on public.users
    for all
    using (true)
    with check (true);

-- Add storage_path column to parse_jobs
alter table public.parse_jobs 
    add column if not exists storage_path text;

-- Auto-create user record when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
    insert into public.users (id, email)
    values (new.id, new.email);
    return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if exists and recreate
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();

-- Function to update updated_at timestamp
create or replace function public.update_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

-- Trigger to auto-update updated_at
drop trigger if exists users_updated_at on public.users;

create trigger users_updated_at
    before update on public.users
    for each row execute procedure public.update_updated_at();
