create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  day_joined date not null default current_date,
  created_at timestamp with time zone not null default now(),

  constraint username_length check (char_length(trim(username)) between 3 and 32),
  constraint username_format check (username ~ '^[A-Za-z0-9_]+$')
);

alter table public.users enable row level security;

create policy "Users can read their own profile"
  on public.users
  for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "Users can create their own profile"
  on public.users
  for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "Users can update their own profile"
  on public.users
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
