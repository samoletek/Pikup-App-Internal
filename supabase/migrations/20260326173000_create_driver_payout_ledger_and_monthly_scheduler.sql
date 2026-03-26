create table if not exists public.driver_payouts (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  kind text not null check (kind in ('instant', 'scheduled')),
  period_key text,
  transfer_id text not null,
  idempotency_key text not null,
  gross_amount numeric(10, 2) not null,
  fee_amount numeric(10, 2) not null default 0,
  net_amount numeric(10, 2) not null,
  currency text not null default 'usd',
  status text not null default 'processed',
  requested_by text,
  metadata jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint driver_payouts_amounts_non_negative check (
    gross_amount > 0 and fee_amount >= 0 and net_amount >= 0
  )
);

create unique index if not exists driver_payouts_transfer_id_uidx
  on public.driver_payouts(transfer_id);

create unique index if not exists driver_payouts_idempotency_key_uidx
  on public.driver_payouts(idempotency_key);

create index if not exists driver_payouts_driver_created_at_idx
  on public.driver_payouts(driver_id, created_at desc);

create index if not exists driver_payouts_period_key_idx
  on public.driver_payouts(period_key);

drop trigger if exists set_driver_payouts_updated_at on public.driver_payouts;
create trigger set_driver_payouts_updated_at
before update on public.driver_payouts
for each row execute function public.set_updated_at();

alter table public.driver_payouts enable row level security;

drop policy if exists driver_payouts_select_own on public.driver_payouts;
create policy driver_payouts_select_own
on public.driver_payouts
for select
to authenticated
using (auth.uid() = driver_id);

grant select on public.driver_payouts to authenticated;

create table if not exists public.driver_monthly_payout_runs (
  period_key text primary key,
  status text not null default 'queued',
  processed_count integer not null default 0,
  failed_count integer not null default 0,
  summary jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_driver_monthly_payout_runs_updated_at on public.driver_monthly_payout_runs;
create trigger set_driver_monthly_payout_runs_updated_at
before update on public.driver_monthly_payout_runs
for each row execute function public.set_updated_at();

alter table public.driver_monthly_payout_runs enable row level security;

create or replace function public.trigger_monthly_payout_worker(
  p_period_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period_key text := coalesce(
    nullif(trim(p_period_key), ''),
    to_char((now() at time zone 'America/New_York'), 'YYYY-MM')
  );
  v_project_url text;
  v_service_role_key text;
  v_monthly_secret text;
  v_request_id bigint;
  v_headers jsonb;
  v_body jsonb;
begin
  begin
    create extension if not exists pg_net with schema extensions;
  exception
    when others then
      return jsonb_build_object(
        'success', false,
        'periodKey', v_period_key,
        'error', 'pg_net extension unavailable'
      );
  end;

  begin
    select decrypted_secret into v_project_url
    from vault.decrypted_secrets
    where name = 'supabase_url'
    limit 1;
  exception
    when undefined_table or invalid_schema_name then
      v_project_url := null;
  end;

  begin
    select decrypted_secret into v_service_role_key
    from vault.decrypted_secrets
    where name = 'supabase_service_role_key'
    limit 1;
  exception
    when undefined_table or invalid_schema_name then
      v_service_role_key := null;
  end;

  begin
    select decrypted_secret into v_monthly_secret
    from vault.decrypted_secrets
    where name = 'monthly_payout_secret'
    limit 1;
  exception
    when undefined_table or invalid_schema_name then
      v_monthly_secret := null;
  end;

  if coalesce(v_project_url, '') = '' then
    return jsonb_build_object(
      'success', false,
      'periodKey', v_period_key,
      'error', 'Vault secret "supabase_url" is missing'
    );
  end if;

  if coalesce(v_service_role_key, '') = '' then
    return jsonb_build_object(
      'success', false,
      'periodKey', v_period_key,
      'error', 'Vault secret "supabase_service_role_key" is missing'
    );
  end if;

  if coalesce(v_monthly_secret, '') = '' then
    return jsonb_build_object(
      'success', false,
      'periodKey', v_period_key,
      'error', 'Vault secret "monthly_payout_secret" is missing'
    );
  end if;

  v_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || v_service_role_key,
    'x-monthly-payout-secret', v_monthly_secret
  );
  v_body := jsonb_build_object(
    'periodKey', v_period_key,
    'triggerReason', 'cron'
  );

  execute
    'select net.http_post(url := $1, headers := $2, body := $3)'
    into v_request_id
    using rtrim(v_project_url, '/') || '/functions/v1/run-monthly-payouts', v_headers, v_body;

  return jsonb_build_object(
    'success', true,
    'periodKey', v_period_key,
    'requestId', v_request_id
  );
end;
$$;

create or replace function public.run_monthly_payout_scheduler_tick()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ny_now timestamp := now() at time zone 'America/New_York';
  v_period_key text := to_char(v_ny_now, 'YYYY-MM');
  v_day integer := extract(day from v_ny_now);
  v_hour integer := extract(hour from v_ny_now);
  v_minute integer := extract(minute from v_ny_now);
  v_dispatch_result jsonb;
  v_existing_status text;
begin
  if v_day <> 25 or v_hour <> 11 or v_minute <> 0 then
    return jsonb_build_object(
      'success', true,
      'periodKey', v_period_key,
      'skipped', true,
      'reason', 'outside_monthly_window'
    );
  end if;

  select status
  into v_existing_status
  from public.driver_monthly_payout_runs
  where period_key = v_period_key;

  if v_existing_status = 'completed' then
    return jsonb_build_object(
      'success', true,
      'periodKey', v_period_key,
      'skipped', true,
      'reason', 'already_completed'
    );
  end if;

  insert into public.driver_monthly_payout_runs (
    period_key,
    status,
    started_at,
    summary
  )
  values (
    v_period_key,
    'queued',
    now(),
    jsonb_build_object('queuedBy', 'cron', 'queuedAt', now())
  )
  on conflict (period_key) do update
    set status = case
      when public.driver_monthly_payout_runs.status = 'completed' then public.driver_monthly_payout_runs.status
      else 'queued'
    end,
    started_at = coalesce(public.driver_monthly_payout_runs.started_at, excluded.started_at),
    summary = coalesce(public.driver_monthly_payout_runs.summary, '{}'::jsonb) || excluded.summary,
    updated_at = now();

  v_dispatch_result := public.trigger_monthly_payout_worker(v_period_key);

  update public.driver_monthly_payout_runs
  set
    status = case
      when coalesce((v_dispatch_result->>'success')::boolean, false) then 'dispatched'
      else 'failed'
    end,
    summary = coalesce(summary, '{}'::jsonb) || jsonb_build_object('dispatch', v_dispatch_result),
    updated_at = now()
  where period_key = v_period_key;

  return jsonb_build_object(
    'success', true,
    'periodKey', v_period_key,
    'dispatch', v_dispatch_result
  );
end;
$$;

do $$
declare
  v_job_id bigint;
begin
  begin
    create extension if not exists pg_cron with schema extensions;
  exception
    when others then
      raise notice 'Unable to ensure pg_cron extension: %', sqlerrm;
  end;

  begin
    for v_job_id in
      select jobid
      from cron.job
      where jobname = 'monthly_driver_payout_scheduler'
    loop
      perform cron.unschedule(v_job_id);
    end loop;

    perform cron.schedule(
      'monthly_driver_payout_scheduler',
      '0 * * * *',
      $cron$select public.run_monthly_payout_scheduler_tick();$cron$
    );
  exception
    when undefined_table or invalid_schema_name or undefined_function then
      raise notice 'pg_cron objects unavailable; monthly_driver_payout_scheduler was not scheduled';
  end;
end
$$;

grant execute on function public.trigger_monthly_payout_worker(text) to service_role;
grant execute on function public.run_monthly_payout_scheduler_tick() to service_role;
