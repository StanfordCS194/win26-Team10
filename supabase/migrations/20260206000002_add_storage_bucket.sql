-- Create storage bucket for parsed files
insert into storage.buckets (id, name, public)
values ('parse-files', 'parse-files', true)
on conflict (id) do nothing;

-- Storage policies for parse-files bucket
-- Allow authenticated users to upload to their own folder
create policy "Users can upload to own folder"
    on storage.objects
    for insert
    to authenticated
    with check (
        bucket_id = 'parse-files' 
        and (storage.foldername(name))[1] = auth.uid()::text
    );

-- Allow users to read their own files
create policy "Users can read own files"
    on storage.objects
    for select
    to authenticated
    using (
        bucket_id = 'parse-files' 
        and (storage.foldername(name))[1] = auth.uid()::text
    );

-- Service role has full access
create policy "Service role has full storage access"
    on storage.objects
    for all
    to service_role
    using (bucket_id = 'parse-files')
    with check (bucket_id = 'parse-files');
