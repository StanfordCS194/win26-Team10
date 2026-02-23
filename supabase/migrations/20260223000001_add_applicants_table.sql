-- Migration to add applicants table and move latest_repr_path from users
-- Date: 2026-02-23

-- 1. Create applicants table
create table if not exists public.applicants (
    id uuid primary key references public.users(id) on delete cascade,
    first_name text,
    last_name text,
    email text,
    major text,
    graduation_year text,
    gpa numeric(3,2),
    skills text[] default '{}',
    latest_repr_path text,
    is_complete boolean not null default false,
    updated_at timestamptz not null default now()
);

-- 2. Move existing latest_repr_path data from users to applicants
insert into public.applicants (id, email, latest_repr_path)
select id, email, latest_repr_path from public.users
where type = 'student'
on conflict (id) do update
set latest_repr_path = excluded.latest_repr_path;

-- 3. Remove latest_repr_path from users table
alter table public.users drop column if exists latest_repr_path;

-- 4. Enable RLS on applicants
alter table public.applicants enable row level security;

-- 5. RLS Policies for applicants
create policy "Applicants can read own profile"
    on public.applicants
    for select
    using (auth.uid() = id);

create policy "Applicants can update own profile"
    on public.applicants
    for update
    using (auth.uid() = id);

-- 6. Trigger to auto-create applicant record for students
create or replace function public.handle_new_applicant()
returns trigger as $$
begin
    if new.type = 'student' then
        insert into public.applicants (id, email)
        values (new.id, new.email)
        on conflict (id) do nothing;
    end if;
    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_user_created_applicant on public.users;
create trigger on_user_created_applicant
    after insert on public.users
    for each row execute procedure public.handle_new_applicant();

-- 7. Trigger for updated_at on applicants
create trigger applicants_updated_at
    before update on public.applicants
    for each row execute procedure public.update_updated_at();

-- 8. Index for searching
create index if not exists applicants_major_idx on public.applicants (major);
create index if not exists applicants_is_complete_idx on public.applicants (is_complete);
