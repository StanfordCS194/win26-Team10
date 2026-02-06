-- Create profiles table
create table profiles (
    id uuid references auth.users(id) primary key,
    full_name text,
    role text not null check (role in ('candidate', 'employer')),
    created_at timestamp default now()
);

-- Enable Row-Level Security
alter table profiles enable row level security;

-- Policy: users can access their own profile only
create policy "self access" on profiles
for all
using (auth.uid() = id);
