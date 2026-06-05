create table public.sequences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  board_size smallint not null default 19,
  moves jsonb not null,
  move_path text not null,
  move_count integer not null,
  board_hash text not null,
  created_at timestamp with time zone not null default now(),

  constraint sequences_board_size check (board_size = 19),
  constraint sequences_moves_array check (jsonb_typeof(moves) = 'array'),
  constraint sequences_move_count_matches check (
    jsonb_typeof(moves) = 'array'
    and move_count = jsonb_array_length(moves)
  ),
  constraint sequences_has_moves check (move_count between 1 and 500),
  constraint sequences_move_path_not_empty check (char_length(move_path) > 0),
  constraint sequences_board_hash_not_empty check (char_length(board_hash) > 0)
);

create index sequences_user_created_at_idx
  on public.sequences (user_id, created_at desc);

create index sequences_move_path_prefix_idx
  on public.sequences (move_path text_pattern_ops);

create index sequences_board_hash_idx
  on public.sequences (board_hash);

alter table public.sequences enable row level security;

create policy "Sequences are readable by everyone"
  on public.sequences
  for select
  to anon, authenticated
  using (true);

create policy "Users can create their own sequences"
  on public.sequences
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own sequences"
  on public.sequences
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own sequences"
  on public.sequences
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
