create table public.joseki_nodes (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.joseki_nodes (id) on delete cascade,
  board_size smallint not null default 19,
  move_type text not null,
  move_key text not null,
  player text,
  row smallint,
  col smallint,
  move_number integer not null,
  depth integer not null,
  created_by uuid references auth.users (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),

  constraint joseki_nodes_board_size check (board_size = 19),
  constraint joseki_nodes_move_type check (move_type in ('root', 'play', 'pass')),
  constraint joseki_nodes_player check (player in ('black', 'white')),
  constraint joseki_nodes_depth_nonnegative check (depth >= 0),
  constraint joseki_nodes_move_number_nonnegative check (move_number >= 0),
  constraint joseki_nodes_root_shape check (
    (
      move_type = 'root'
      and parent_id is null
      and player is null
      and row is null
      and col is null
      and move_number = 0
      and depth = 0
      and move_key = 'root'
    )
    or (
      move_type = 'play'
      and parent_id is not null
      and player is not null
      and row between 0 and 18
      and col between 0 and 18
      and move_number = depth
      and move_key = player || ':' || row::text || ',' || col::text
    )
    or (
      move_type = 'pass'
      and parent_id is not null
      and player is not null
      and row is null
      and col is null
      and move_number = depth
      and move_key = player || ':pass'
    )
  )
);

create unique index joseki_nodes_one_root_idx
  on public.joseki_nodes (board_size)
  where move_type = 'root';

create unique index joseki_nodes_unique_child_move_idx
  on public.joseki_nodes (parent_id, move_key)
  where parent_id is not null;

create index joseki_nodes_parent_created_at_idx
  on public.joseki_nodes (parent_id, created_at);

create index joseki_nodes_created_by_created_at_idx
  on public.joseki_nodes (created_by, created_at desc);

create table public.saved_joseki_lines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  terminal_node_id uuid not null references public.joseki_nodes (id) on delete cascade,
  visibility text not null default 'public',
  title text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),

  constraint saved_joseki_lines_visibility check (visibility in ('public', 'private')),
  constraint saved_joseki_lines_title_length check (
    title is null or char_length(trim(title)) between 1 and 120
  ),
  constraint saved_joseki_lines_notes_length check (
    notes is null or char_length(notes) <= 4000
  )
);

create unique index saved_joseki_lines_user_terminal_idx
  on public.saved_joseki_lines (user_id, terminal_node_id);

create index saved_joseki_lines_user_created_at_idx
  on public.saved_joseki_lines (user_id, created_at desc);

create index saved_joseki_lines_terminal_node_idx
  on public.saved_joseki_lines (terminal_node_id);

create index saved_joseki_lines_public_created_at_idx
  on public.saved_joseki_lines (created_at desc)
  where visibility = 'public';

insert into public.joseki_nodes (
  board_size,
  move_type,
  move_key,
  move_number,
  depth,
  metadata
)
values (
  19,
  'root',
  'root',
  0,
  0,
  '{"label":"19x19 root"}'::jsonb
)
on conflict do nothing;

do $$
declare
  sequence_record record;
  move_record jsonb;
  current_parent_id uuid;
  next_node_id uuid;
  root_node_id uuid;
  move_index integer;
  move_type_value text;
  player_value text;
  row_value smallint;
  col_value smallint;
  move_key_value text;
begin
  select id
    into root_node_id
    from public.joseki_nodes
    where board_size = 19 and move_type = 'root'
    limit 1;

  for sequence_record in
    select id, user_id, moves, created_at
      from public.sequences
      order by created_at, id
  loop
    current_parent_id := root_node_id;
    move_index := 0;

    for move_record in
      select value
        from jsonb_array_elements(sequence_record.moves)
    loop
      move_index := move_index + 1;
      move_type_value := move_record->>'type';
      player_value := move_record->>'player';
      row_value := null;
      col_value := null;

      if move_type_value = 'play' then
        row_value := ((move_record->'point'->>'row')::integer)::smallint;
        col_value := ((move_record->'point'->>'col')::integer)::smallint;
        move_key_value := player_value || ':' || row_value::text || ',' || col_value::text;
      elsif move_type_value = 'pass' then
        move_key_value := player_value || ':pass';
      else
        continue;
      end if;

      insert into public.joseki_nodes (
        parent_id,
        board_size,
        move_type,
        move_key,
        player,
        row,
        col,
        move_number,
        depth,
        created_by,
        created_at,
        updated_at,
        metadata
      )
      values (
        current_parent_id,
        19,
        move_type_value,
        move_key_value,
        player_value,
        row_value,
        col_value,
        move_index,
        move_index,
        sequence_record.user_id,
        sequence_record.created_at,
        sequence_record.created_at,
        jsonb_build_object('backfilled_from_sequence_id', sequence_record.id)
      )
      on conflict (parent_id, move_key) where parent_id is not null
      do nothing
      returning id into next_node_id;

      if next_node_id is null then
        select id
          into next_node_id
          from public.joseki_nodes
          where parent_id = current_parent_id
            and move_key = move_key_value
          limit 1;
      end if;

      current_parent_id := next_node_id;
      next_node_id := null;
    end loop;

    if current_parent_id is not null and current_parent_id <> root_node_id then
      insert into public.saved_joseki_lines (
        user_id,
        terminal_node_id,
        visibility,
        created_at,
        updated_at,
        metadata
      )
      values (
        sequence_record.user_id,
        current_parent_id,
        'public',
        sequence_record.created_at,
        sequence_record.created_at,
        jsonb_build_object('backfilled_from_sequence_id', sequence_record.id)
      )
      on conflict (user_id, terminal_node_id) do nothing;
    end if;
  end loop;
end $$;

alter table public.joseki_nodes enable row level security;

create policy "Joseki nodes are readable by everyone"
  on public.joseki_nodes
  for select
  to anon, authenticated
  using (true);

create policy "Users can create joseki nodes"
  on public.joseki_nodes
  for insert
  to authenticated
  with check ((select auth.uid()) = created_by);

alter table public.saved_joseki_lines enable row level security;

create policy "Public saved joseki lines are readable"
  on public.saved_joseki_lines
  for select
  to anon, authenticated
  using (visibility = 'public' or (select auth.uid()) = user_id);

create policy "Users can create their own saved joseki lines"
  on public.saved_joseki_lines
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own saved joseki lines"
  on public.saved_joseki_lines
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own saved joseki lines"
  on public.saved_joseki_lines
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
