-- Allow authenticated users to manage files in trip_photos under their own folder.
drop policy if exists trip_photos_insert_own on storage.objects;
create policy trip_photos_insert_own
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'trip_photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists trip_photos_update_own on storage.objects;
create policy trip_photos_update_own
on storage.objects
for update
to authenticated
using (
  bucket_id = 'trip_photos'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'trip_photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists trip_photos_delete_own on storage.objects;
create policy trip_photos_delete_own
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'trip_photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
