-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- PROFILES TABLE
-- Extends the built-in auth.users table
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  user_type text check (user_type in ('customer', 'driver')),
  first_name text,
  last_name text,
  phone_number text,
  profile_image_url text,
  push_token text,
  rating float default 5.0,
  stripe_customer_id text,
  stripe_account_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for profiles
alter table public.profiles enable row level security;

-- Policies for profiles
create policy "Public profiles are viewable by everyone"
  on profiles for select
  using ( true );

create policy "Users can insert their own profile"
  on profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile"
  on profiles for update
  using ( auth.uid() = id );

-- TRIPS TABLE
create table public.trips (
  id uuid default uuid_generate_v4() primary key,
  customer_id uuid references public.profiles(id) not null,
  driver_id uuid references public.profiles(id),
  status text check (status in ('pending', 'accepted', 'pickup_en_route', 'arrived_pickup', 'picked_up', 'dropoff_en_route', 'arrived_dropoff', 'completed', 'cancelled')) default 'pending',
  pickup_location jsonb not null,
  dropoff_location jsonb not null,
  price numeric(10,2),
  distance_miles numeric(10,2),
  vehicle_type text,
  items jsonb default '[]'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  scheduled_time timestamp with time zone,
  stripe_payment_intent_id text
);

-- Enable RLS for trips
alter table public.trips enable row level security;

-- Policies for trips
create policy "Users can view their own trips (as customer or driver)"
  on trips for select
  using ( auth.uid() = customer_id or auth.uid() = driver_id );

create policy "Drivers can view pending trips"
  on trips for select
  using ( status = 'pending' and exists (select 1 from profiles where id = auth.uid() and user_type = 'driver') );

create policy "Customers can create trips"
  on trips for insert
  with check ( auth.uid() = customer_id );

create policy "Participants can update trips"
  on trips for update
  using ( auth.uid() = customer_id or auth.uid() = driver_id )
  with check ( auth.uid() = customer_id or auth.uid() = driver_id );

-- FEEDBACK TABLE
create table public.feedback (
  id uuid default uuid_generate_v4() primary key,
  trip_id uuid references public.trips(id) not null,
  from_user_id uuid references public.profiles(id) not null,
  to_user_id uuid references public.profiles(id) not null,
  rating int check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for feedback
alter table public.feedback enable row level security;

create policy "Feedback viewable by involved parties"
  on feedback for select
  using ( auth.uid() = from_user_id or auth.uid() = to_user_id );

create policy "Users can insert feedback"
  on feedback for insert
  with check ( auth.uid() = from_user_id );

-- STORAGE POLICIES (Not executable in SQL Editor directly, but conceptually defined)
-- Bucket 'avatars' -> Public
-- Bucket 'trip_photos' -> Authenticated only

-- TRIGGER: Auto-create profile on signup
-- Note: This is optional. We are handling profile creation in the App logic usually, 
-- but a trigger is safer for ensuring data integrity.
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, email, user_type)
  values (new.id, new.email, new.raw_user_meta_data->>'user_type');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger is disabled by default to avoid conflicts with manual creation logic
-- create trigger on_auth_user_created
--   after insert on auth.users
--   for each row execute procedure public.handle_new_user();
