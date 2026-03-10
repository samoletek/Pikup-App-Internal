alter table public.driver_dispatch_idempotency enable row level security;

drop policy if exists driver_dispatch_idempotency_select_own on public.driver_dispatch_idempotency;
create policy driver_dispatch_idempotency_select_own
on public.driver_dispatch_idempotency
for select
to authenticated
using (auth.uid() = driver_id);

drop policy if exists driver_dispatch_idempotency_insert_own on public.driver_dispatch_idempotency;
create policy driver_dispatch_idempotency_insert_own
on public.driver_dispatch_idempotency
for insert
to authenticated
with check (auth.uid() = driver_id);

drop policy if exists driver_dispatch_idempotency_update_own on public.driver_dispatch_idempotency;
create policy driver_dispatch_idempotency_update_own
on public.driver_dispatch_idempotency
for update
to authenticated
using (auth.uid() = driver_id)
with check (auth.uid() = driver_id);

grant select, insert, update on public.driver_dispatch_idempotency to authenticated;
