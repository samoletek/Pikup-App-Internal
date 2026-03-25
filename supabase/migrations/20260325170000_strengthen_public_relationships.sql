-- Strengthen referential integrity for active public tables.
-- Use NOT VALID to avoid blocking on historical rows; new rows are still validated.

alter table if exists public.feedbacks
  add column if not exists trip_id uuid;

update public.feedbacks
set trip_id = request_id::uuid
where trip_id is null
  and request_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

create or replace function public.feedbacks_sync_trip_id_from_request_id()
returns trigger
language plpgsql
as $$
begin
  if new.trip_id is null
     and new.request_id is not null
     and new.request_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then
    new.trip_id := new.request_id::uuid;
  end if;

  return new;
end;
$$;

drop trigger if exists feedbacks_sync_trip_id_from_request_id_trg on public.feedbacks;
create trigger feedbacks_sync_trip_id_from_request_id_trg
before insert or update of request_id, trip_id
on public.feedbacks
for each row
execute function public.feedbacks_sync_trip_id_from_request_id();

create index if not exists conversations_customer_id_idx
  on public.conversations(customer_id);
create index if not exists conversations_driver_id_idx
  on public.conversations(driver_id);
create index if not exists messages_sender_id_idx
  on public.messages(sender_id);
create index if not exists feedbacks_user_id_idx
  on public.feedbacks(user_id);
create index if not exists feedbacks_target_user_id_idx
  on public.feedbacks(target_user_id);
create index if not exists feedbacks_driver_id_idx
  on public.feedbacks(driver_id);
create index if not exists feedbacks_trip_id_idx
  on public.feedbacks(trip_id);
create index if not exists driver_request_offers_driver_id_idx
  on public.driver_request_offers(driver_id);
create index if not exists driver_dispatch_idempotency_driver_id_idx
  on public.driver_dispatch_idempotency(driver_id);
create index if not exists claims_user_id_idx
  on public.claims(user_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'conversations_customer_id_fkey'
      and conrelid = 'public.conversations'::regclass
  ) then
    alter table public.conversations
      add constraint conversations_customer_id_fkey
      foreign key (customer_id)
      references public.customers(id)
      on delete set null
      not valid;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'conversations_driver_id_fkey'
      and conrelid = 'public.conversations'::regclass
  ) then
    alter table public.conversations
      add constraint conversations_driver_id_fkey
      foreign key (driver_id)
      references public.drivers(id)
      on delete set null
      not valid;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'messages_sender_id_fkey'
      and conrelid = 'public.messages'::regclass
  ) then
    alter table public.messages
      add constraint messages_sender_id_fkey
      foreign key (sender_id)
      references auth.users(id)
      on delete set null
      not valid;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'claims_user_id_fkey'
      and conrelid = 'public.claims'::regclass
  ) then
    alter table public.claims
      add constraint claims_user_id_fkey
      foreign key (user_id)
      references auth.users(id)
      on delete cascade
      not valid;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'driver_request_offers_driver_id_fkey'
      and conrelid = 'public.driver_request_offers'::regclass
  ) then
    alter table public.driver_request_offers
      add constraint driver_request_offers_driver_id_fkey
      foreign key (driver_id)
      references public.drivers(id)
      on delete cascade
      not valid;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'driver_dispatch_idempotency_driver_id_fkey'
      and conrelid = 'public.driver_dispatch_idempotency'::regclass
  ) then
    alter table public.driver_dispatch_idempotency
      add constraint driver_dispatch_idempotency_driver_id_fkey
      foreign key (driver_id)
      references public.drivers(id)
      on delete cascade
      not valid;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'feedbacks_user_id_fkey'
      and conrelid = 'public.feedbacks'::regclass
  ) then
    alter table public.feedbacks
      add constraint feedbacks_user_id_fkey
      foreign key (user_id)
      references auth.users(id)
      on delete cascade
      not valid;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'feedbacks_driver_id_fkey'
      and conrelid = 'public.feedbacks'::regclass
  ) then
    alter table public.feedbacks
      add constraint feedbacks_driver_id_fkey
      foreign key (driver_id)
      references public.drivers(id)
      on delete set null
      not valid;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'feedbacks_target_user_id_fkey'
      and conrelid = 'public.feedbacks'::regclass
  ) then
    alter table public.feedbacks
      add constraint feedbacks_target_user_id_fkey
      foreign key (target_user_id)
      references auth.users(id)
      on delete set null
      not valid;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'feedbacks_trip_id_fkey'
      and conrelid = 'public.feedbacks'::regclass
  ) then
    alter table public.feedbacks
      add constraint feedbacks_trip_id_fkey
      foreign key (trip_id)
      references public.trips(id)
      on delete set null
      not valid;
  end if;
end
$$;
