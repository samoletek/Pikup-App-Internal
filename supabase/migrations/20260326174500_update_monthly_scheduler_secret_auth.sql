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

  if coalesce(v_monthly_secret, '') = '' then
    return jsonb_build_object(
      'success', false,
      'periodKey', v_period_key,
      'error', 'Vault secret "monthly_payout_secret" is missing'
    );
  end if;

  v_headers := jsonb_build_object(
    'Content-Type', 'application/json',
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

grant execute on function public.trigger_monthly_payout_worker(text) to service_role;
