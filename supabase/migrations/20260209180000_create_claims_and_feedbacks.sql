create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  booking_id text not null,
  claim_type text not null,
  loss_date date,
  loss_description text,
  estimated_value numeric(10, 2),
  claimant_name text,
  claimant_email text,
  status text not null default 'SUBMITTED',
  resolution text,
  document_types text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.feedbacks (
  id uuid primary key default gen_random_uuid(),
  request_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  driver_id uuid references auth.users(id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  tip_amount numeric(10, 2) not null default 0,
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists claims_user_id_idx on public.claims(user_id);
create index if not exists claims_booking_id_idx on public.claims(booking_id);
create index if not exists feedbacks_user_id_idx on public.feedbacks(user_id);
create index if not exists feedbacks_request_id_idx on public.feedbacks(request_id);
create index if not exists feedbacks_driver_id_idx on public.feedbacks(driver_id);

drop trigger if exists set_claims_updated_at on public.claims;
create trigger set_claims_updated_at
before update on public.claims
for each row execute function public.set_updated_at();

drop trigger if exists set_feedbacks_updated_at on public.feedbacks;
create trigger set_feedbacks_updated_at
before update on public.feedbacks
for each row execute function public.set_updated_at();

alter table public.claims enable row level security;
alter table public.feedbacks enable row level security;

drop policy if exists claims_select_own on public.claims;
create policy claims_select_own
on public.claims
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists claims_insert_own on public.claims;
create policy claims_insert_own
on public.claims
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists claims_update_own on public.claims;
create policy claims_update_own
on public.claims
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists claims_delete_own on public.claims;
create policy claims_delete_own
on public.claims
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists feedbacks_select_own on public.feedbacks;
create policy feedbacks_select_own
on public.feedbacks
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists feedbacks_insert_own on public.feedbacks;
create policy feedbacks_insert_own
on public.feedbacks
for insert
to authenticated
with check (auth.uid() = user_id);

grant select, insert, update, delete on public.claims to authenticated;
grant select, insert on public.feedbacks to authenticated;
