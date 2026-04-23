alter table public.driver_payout_locks enable row level security;

drop policy if exists driver_payout_locks_service_role_all on public.driver_payout_locks;
create policy driver_payout_locks_service_role_all
on public.driver_payout_locks
for all
to service_role
using (true)
with check (true);

revoke all on table public.driver_payout_locks from anon, authenticated;
grant select, insert, update, delete on table public.driver_payout_locks to service_role;
