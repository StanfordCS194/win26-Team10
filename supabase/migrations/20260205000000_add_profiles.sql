-- Create profiles table for auth (extends auth.users with role and profile data)
create table if not exists public.profiles (
    id uuid references auth.users(id) on delete cascade primary key,
    full_name text,
    email text,
    role text not null check (role in ('candidate', 'employer')),
    created_at timestamptz default now()
);

-- Enable Row-Level Security
alter table public.profiles enable row level security;

-- Policy: users can read and write their own profile only
create policy "Users can access own profile"
    on public.profiles
    for all
    using (auth.uid() = id)
    with check (auth.uid() = id);
