create table if not exists public.driver_payout_locks (
  driver_id uuid primary key references public.drivers(id) on delete cascade,
  lock_token uuid not null,
  locked_until timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_driver_payout_locks_updated_at on public.driver_payout_locks;
create trigger set_driver_payout_locks_updated_at
before update on public.driver_payout_locks
for each row execute function public.set_updated_at();

create or replace function public.acquire_driver_payout_lock(
  p_driver_id uuid,
  p_lock_token uuid,
  p_ttl_seconds integer default 120
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_ttl_seconds integer := greatest(30, least(coalesce(p_ttl_seconds, 120), 900));
  v_locked_until timestamptz := v_now + make_interval(secs => v_ttl_seconds);
  v_rowcount integer := 0;
begin
  if p_driver_id is null or p_lock_token is null then
    return false;
  end if;

  insert into public.driver_payout_locks (
    driver_id,
    lock_token,
    locked_until,
    created_at,
    updated_at
  )
  values (
    p_driver_id,
    p_lock_token,
    v_locked_until,
    v_now,
    v_now
  )
  on conflict (driver_id) do update
  set
    lock_token = excluded.lock_token,
    locked_until = excluded.locked_until,
    updated_at = excluded.updated_at
  where
    public.driver_payout_locks.locked_until <= v_now
    or public.driver_payout_locks.lock_token = excluded.lock_token;

  get diagnostics v_rowcount = row_count;
  return v_rowcount > 0;
end;
$$;

create or replace function public.release_driver_payout_lock(
  p_driver_id uuid,
  p_lock_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rowcount integer := 0;
begin
  if p_driver_id is null or p_lock_token is null then
    return false;
  end if;

  delete from public.driver_payout_locks
  where driver_id = p_driver_id
    and lock_token = p_lock_token;

  get diagnostics v_rowcount = row_count;
  return v_rowcount > 0;
end;
$$;

grant execute on function public.acquire_driver_payout_lock(uuid, uuid, integer) to service_role;
grant execute on function public.release_driver_payout_lock(uuid, uuid) to service_role;
