create table if not exists public.stripe_event_log (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now(),
  payload jsonb not null
);

create index if not exists stripe_event_log_event_type_processed_idx
  on public.stripe_event_log(event_type, processed_at desc);

alter table public.stripe_event_log enable row level security;
