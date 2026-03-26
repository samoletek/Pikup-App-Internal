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
  v_existing_updated_at timestamptz;
begin
  if v_day <> 25 then
    return jsonb_build_object(
      'success', true,
      'periodKey', v_period_key,
      'skipped', true,
      'reason', 'outside_monthly_window'
    );
  end if;

  if v_hour < 11 then
    return jsonb_build_object(
      'success', true,
      'periodKey', v_period_key,
      'skipped', true,
      'reason', 'before_monthly_window'
    );
  end if;

  select status, updated_at
  into v_existing_status, v_existing_updated_at
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

  if v_existing_status = 'dispatched'
     and coalesce(v_existing_updated_at, to_timestamp(0)) > (now() - interval '55 minutes') then
    return jsonb_build_object(
      'success', true,
      'periodKey', v_period_key,
      'skipped', true,
      'reason', 'dispatch_in_progress'
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
    jsonb_build_object('queuedBy', 'cron', 'queuedAt', now(), 'minute', v_minute)
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

grant execute on function public.run_monthly_payout_scheduler_tick() to service_role;
