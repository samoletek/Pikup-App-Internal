/* UPDATE SCHEMA: Profiles, Feedback, and Chat */

-- 1. Update Profiles Table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS rating_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS is_online boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS completed_orders integer DEFAULT 0;

-- 2. Chat Tables
create table if not exists public.conversations (
  id uuid default gen_random_uuid() primary key,
  request_id uuid references public.trips(id),
  customer_id uuid references auth.users(id),
  driver_id uuid references auth.users(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  last_message text,
  last_message_at timestamp with time zone,
  unread_by_customer integer default 0,
  unread_by_driver integer default 0
);

create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade,
  sender_id uuid references auth.users(id),
  content text,
  message_type text default 'text',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  is_read boolean default false
);

-- 3. RLS for Chat
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Conversations Policies
create policy "Users can view their own conversations"
  on public.conversations for select
  using (auth.uid() = customer_id or auth.uid() = driver_id);

create policy "Users can insert conversations they are part of"
  on public.conversations for insert
  with check (auth.uid() = customer_id or auth.uid() = driver_id);

create policy "Users can update their own conversations"
  on public.conversations for update
  using (auth.uid() = customer_id or auth.uid() = driver_id);

-- Messages Policies
create policy "Users can view messages in their conversations"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversations
      where id = conversation_id
      and (customer_id = auth.uid() or driver_id = auth.uid())
    )
  );

create policy "Users can insert messages in their conversations"
  on public.messages for insert
  with check (
    exists (
      select 1 from public.conversations
      where id = conversation_id
      and (customer_id = auth.uid() or driver_id = auth.uid())
    )
  );
