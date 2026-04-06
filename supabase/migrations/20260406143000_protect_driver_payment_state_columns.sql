begin;

create or replace function public.block_untrusted_driver_payment_state_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  request_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
  actor_role text := coalesce(current_user, '');
  protected_metadata_changed boolean := false;
begin
  if request_role in ('service_role', 'supabase_admin') or actor_role in ('postgres', 'supabase_admin') then
    return new;
  end if;

  protected_metadata_changed :=
    (coalesce(new.metadata, '{}'::jsonb)->'connectAccountId' is distinct from coalesce(old.metadata, '{}'::jsonb)->'connectAccountId')
    or (coalesce(new.metadata, '{}'::jsonb)->'onboardingComplete' is distinct from coalesce(old.metadata, '{}'::jsonb)->'onboardingComplete')
    or (coalesce(new.metadata, '{}'::jsonb)->'canReceivePayments' is distinct from coalesce(old.metadata, '{}'::jsonb)->'canReceivePayments')
    or (coalesce(new.metadata, '{}'::jsonb)->'onboardingStatus' is distinct from coalesce(old.metadata, '{}'::jsonb)->'onboardingStatus')
    or (coalesce(new.metadata, '{}'::jsonb)->'onboardingRequirements' is distinct from coalesce(old.metadata, '{}'::jsonb)->'onboardingRequirements')
    or (coalesce(new.metadata, '{}'::jsonb)->'onboardingRequirementsByBucket' is distinct from coalesce(old.metadata, '{}'::jsonb)->'onboardingRequirementsByBucket')
    or (coalesce(new.metadata, '{}'::jsonb)->'onboardingDisabledReason' is distinct from coalesce(old.metadata, '{}'::jsonb)->'onboardingDisabledReason')
    or (coalesce(new.metadata, '{}'::jsonb)->'transfersCapability' is distinct from coalesce(old.metadata, '{}'::jsonb)->'transfersCapability')
    or (coalesce(new.metadata, '{}'::jsonb)->'payoutsEnabled' is distinct from coalesce(old.metadata, '{}'::jsonb)->'payoutsEnabled')
    or (coalesce(new.metadata, '{}'::jsonb)->'detailsSubmitted' is distinct from coalesce(old.metadata, '{}'::jsonb)->'detailsSubmitted');

  if
    new.stripe_account_id is distinct from old.stripe_account_id
    or new.onboarding_complete is distinct from old.onboarding_complete
    or new.can_receive_payments is distinct from old.can_receive_payments
    or protected_metadata_changed
  then
    raise exception 'Updating protected payment onboarding fields is not allowed from client context'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists tr_block_untrusted_driver_payment_state_updates on public.drivers;

create trigger tr_block_untrusted_driver_payment_state_updates
before update on public.drivers
for each row
execute function public.block_untrusted_driver_payment_state_updates();

comment on function public.block_untrusted_driver_payment_state_updates()
is 'Blocks client-context writes to protected Stripe onboarding payout fields on public.drivers.';

commit;
