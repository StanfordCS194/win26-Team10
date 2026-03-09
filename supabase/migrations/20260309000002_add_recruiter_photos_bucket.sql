-- Storage bucket for recruiter profile photos (public read, authenticated write to own path)
-- Date: 2026-03-09

insert into storage.buckets (id, name, public)
values ('recruiter-photos', 'recruiter-photos', true)
on conflict (id) do nothing;

-- Authenticated users can upload/update their own avatar (path: {user_id}/avatar.*)
drop policy if exists "Users can upload own recruiter photo" on storage.objects;
create policy "Users can upload own recruiter photo"
    on storage.objects
    for insert
    to authenticated
    with check (
        bucket_id = 'recruiter-photos'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

drop policy if exists "Users can update own recruiter photo" on storage.objects;
create policy "Users can update own recruiter photo"
    on storage.objects
    for update
    to authenticated
    using (
        bucket_id = 'recruiter-photos'
        and (storage.foldername(name))[1] = auth.uid()::text
    )
    with check (
        bucket_id = 'recruiter-photos'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

-- Public read (bucket is public)
drop policy if exists "Public read recruiter photos" on storage.objects;
create policy "Public read recruiter photos"
    on storage.objects
    for select
    to public
    using (bucket_id = 'recruiter-photos');

-- Users can delete their own file
drop policy if exists "Users can delete own recruiter photo" on storage.objects;
create policy "Users can delete own recruiter photo"
    on storage.objects
    for delete
    to authenticated
    using (
        bucket_id = 'recruiter-photos'
        and (storage.foldername(name))[1] = auth.uid()::text
    );
