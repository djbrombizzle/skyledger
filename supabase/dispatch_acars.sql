-- ACARS Dispatch: active_trip snapshots, play_role, and real-time messaging
-- Skyledger project: run once in Supabase SQL editor (or via apply_migration).
-- Note: if profiles already has a "profiles readable" policy (qual = true),
-- dispatchers can already read all profiles — the active_trip column is what matters.

-- Profile extensions for dispatch board
alter table public.profiles add column if not exists active_trip jsonb;
alter table public.profiles add column if not exists play_role text default 'all';

update public.profiles set play_role = 'all' where play_role is null;

-- Dispatch messaging
create table if not exists public.dispatch_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id text not null,
  from_user_id uuid not null references auth.users(id) on delete cascade,
  from_role text not null check (from_role in ('pilot', 'dispatcher')),
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists dispatch_messages_thread_id_idx on public.dispatch_messages(thread_id, created_at desc);
create index if not exists profiles_active_trip_idx on public.profiles((active_trip is not null)) where active_trip is not null;

alter table public.dispatch_messages enable row level security;

-- Pilots read/write their own thread; dispatchers read/write all threads
drop policy if exists "dispatch_messages_select" on public.dispatch_messages;
create policy "dispatch_messages_select" on public.dispatch_messages for select using (
  auth.uid() = from_user_id
  or thread_id = 'pilot:' || auth.uid()::text
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.play_role, 'all') in ('dispatcher', 'all')
  )
);

drop policy if exists "dispatch_messages_insert" on public.dispatch_messages;
create policy "dispatch_messages_insert" on public.dispatch_messages for insert with check (
  auth.uid() = from_user_id
  and (
    thread_id = 'pilot:' || auth.uid()::text
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.play_role, 'all') in ('dispatcher', 'all')
    )
  )
);

-- Realtime for live pilot/dispatcher chat (safe to re-run)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'dispatch_messages'
  ) then
    alter publication supabase_realtime add table public.dispatch_messages;
  end if;
end $$;
