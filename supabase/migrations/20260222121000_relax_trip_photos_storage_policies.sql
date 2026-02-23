-- Temporary unblock: allow any authenticated user to manage trip_photos objects.
-- We can tighten path-scoped policies again after upload stability is confirmed.
drop policy if exists trip_photos_insert_own on storage.objects;
drop policy if exists trip_photos_update_own on storage.objects;
drop policy if exists trip_photos_delete_own on storage.objects;
drop policy if exists trip_photos_insert_authenticated on storage.objects;
drop policy if exists trip_photos_update_authenticated on storage.objects;
drop policy if exists trip_photos_delete_authenticated on storage.objects;
drop policy if exists trip_photos_select_authenticated on storage.objects;

create policy trip_photos_insert_authenticated
on storage.objects
for insert
to authenticated
with check (bucket_id = 'trip_photos');

create policy trip_photos_update_authenticated
on storage.objects
for update
to authenticated
using (bucket_id = 'trip_photos')
with check (bucket_id = 'trip_photos');

create policy trip_photos_delete_authenticated
on storage.objects
for delete
to authenticated
using (bucket_id = 'trip_photos');

create policy trip_photos_select_authenticated
on storage.objects
for select
to authenticated
using (bucket_id = 'trip_photos');
