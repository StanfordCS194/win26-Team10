-- Company model + recruiter memberships + jobs.company_id enforcement

create table if not exists public.companies (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    slug text unique,
    description text,
    website text,
    domains text[] not null default '{}',
    is_verified boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.company_memberships (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.users(id) on delete cascade,
    company_id uuid not null references public.companies(id) on delete cascade,
    role text not null default 'recruiter_member'
        check (role in ('recruiter_admin', 'recruiter_member')),
    status text not null default 'approved'
        check (status in ('pending', 'approved', 'rejected')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, company_id)
);

create index if not exists companies_slug_idx on public.companies (slug);
create index if not exists company_memberships_user_status_idx
    on public.company_memberships (user_id, status);
create index if not exists company_memberships_company_status_idx
    on public.company_memberships (company_id, status);

alter table public.companies enable row level security;
alter table public.company_memberships enable row level security;

create policy "Authenticated users can read companies"
    on public.companies
    for select
    using (auth.uid() is not null);

create policy "Users can read their memberships"
    on public.company_memberships
    for select
    using (auth.uid() = user_id);

create policy "Service role has full access to companies"
    on public.companies
    for all
    using (true)
    with check (true);

create policy "Service role has full access to memberships"
    on public.company_memberships
    for all
    using (true)
    with check (true);

alter table public.jobs add column if not exists company_id uuid
    references public.companies(id) on delete set null;

create index if not exists jobs_company_id_idx on public.jobs (company_id);

insert into public.companies (name, slug, description, website, domains, is_verified)
values
    ('Airbnb', 'airbnb', 'Online marketplace for stays and experiences.', 'https://www.airbnb.com', array['airbnb.com'], true),
    ('Google', 'google', 'Global technology company focused on search, cloud, and AI products.', 'https://about.google', array['google.com'], true),
    ('Meta', 'meta', 'Technology company building social platforms and AR/VR products.', 'https://about.meta.com', array['meta.com', 'fb.com'], true),
    ('Microsoft', 'microsoft', 'Technology company focused on cloud, productivity, and developer platforms.', 'https://www.microsoft.com', array['microsoft.com'], true),
    ('OpenAI', 'openai', 'AI research and deployment company building frontier AI systems.', 'https://openai.com', array['openai.com'], true),
    ('Stripe', 'stripe', 'Financial infrastructure platform for businesses on the internet.', 'https://stripe.com', array['stripe.com'], true)
on conflict (name) do update
set description = excluded.description,
    website = excluded.website,
    domains = excluded.domains,
    is_verified = excluded.is_verified;

update public.jobs j
set company_id = c.id
from public.companies c
where j.company_id is null
  and c.name = j.company;

drop policy if exists "Recruiters can insert their own jobs" on public.jobs;
drop policy if exists "Recruiters can update their own jobs" on public.jobs;
drop policy if exists "Recruiters can delete their own jobs" on public.jobs;

create policy "Recruiters can insert jobs for approved company"
    on public.jobs
    for insert
    with check (
        recruiter_id = auth.uid()
        and company_id is not null
        and exists (
            select 1
            from public.company_memberships cm
            where cm.user_id = auth.uid()
              and cm.company_id = jobs.company_id
              and cm.status = 'approved'
        )
    );

create policy "Recruiters can update their own jobs in approved company"
    on public.jobs
    for update
    using (
        recruiter_id = auth.uid()
        and exists (
            select 1
            from public.company_memberships cm
            where cm.user_id = auth.uid()
              and cm.company_id = jobs.company_id
              and cm.status = 'approved'
        )
    )
    with check (
        recruiter_id = auth.uid()
        and exists (
            select 1
            from public.company_memberships cm
            where cm.user_id = auth.uid()
              and cm.company_id = jobs.company_id
              and cm.status = 'approved'
        )
    );

create policy "Recruiters can delete their own jobs in approved company"
    on public.jobs
    for delete
    using (
        recruiter_id = auth.uid()
        and exists (
            select 1
            from public.company_memberships cm
            where cm.user_id = auth.uid()
              and cm.company_id = jobs.company_id
              and cm.status = 'approved'
        )
    );

create or replace function public.handle_recruiter_company_membership()
returns trigger
language plpgsql
security definer
as $$
declare
    v_domain text;
    v_company_id uuid;
    v_local_name text;
begin
    if new.type <> 'recruiter' or new.email is null then
        return new;
    end if;

    v_domain := lower(split_part(new.email, '@', 2));
    if v_domain is null or v_domain = '' then
        return new;
    end if;

    if v_domain = any (array['gmail.com','yahoo.com','outlook.com','hotmail.com','icloud.com','proton.me']) then
        return new;
    end if;

    select c.id into v_company_id
    from public.companies c
    where exists (
        select 1
        from unnest(c.domains) d
        where lower(d) = v_domain
    )
    limit 1;

    if v_company_id is null then
        v_local_name := initcap(replace(split_part(v_domain, '.', 1), '-', ' '));
        insert into public.companies (name, slug, domains, is_verified)
        values (v_local_name, split_part(v_domain, '.', 1), array[v_domain], true)
        on conflict (name) do update
            set domains = (
                select array_agg(distinct d)
                from unnest(public.companies.domains || excluded.domains) d
            )
        returning id into v_company_id;
    end if;

    insert into public.company_memberships (user_id, company_id, role, status)
    values (new.id, v_company_id, 'recruiter_member', 'approved')
    on conflict (user_id, company_id) do nothing;

    return new;
end;
$$;

drop trigger if exists on_recruiter_user_upsert_membership on public.users;
create trigger on_recruiter_user_upsert_membership
    after insert or update of type, email on public.users
    for each row execute procedure public.handle_recruiter_company_membership();

update public.users
set updated_at = now()
where type = 'recruiter';

drop trigger if exists companies_updated_at on public.companies;
create trigger companies_updated_at
    before update on public.companies
    for each row execute procedure public.update_updated_at();

drop trigger if exists company_memberships_updated_at on public.company_memberships;
create trigger company_memberships_updated_at
    before update on public.company_memberships
    for each row execute procedure public.update_updated_at();
