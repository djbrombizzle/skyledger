-- ACARS Dispatch: active_trip snapshots, play_role, and real-time messaging
-- Run in Supabase SQL editor (or via migration tooling) on the Skyledger project.

-- Profile extensions for dispatch board
alter table profiles add column if not exists active_trip jsonb;
alter table profiles add column if not exists play_role text default 'all';

-- Dispatch messaging
create table if not exists dispatch_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id text not null,
  from_user_id uuid not null references auth.users(id) on delete cascade,
  from_role text not null check (from_role in ('pilot', 'dispatcher')),
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists dispatch_messages_thread_id_idx on dispatch_messages(thread_id, created_at desc);
create index if not exists profiles_active_trip_idx on profiles((active_trip is not null)) where active_trip is not null;

alter table dispatch_messages enable row level security;

-- Pilots read/write their own thread; dispatchers read/write all threads
create policy "dispatch_messages_select" on dispatch_messages for select using (
  auth.uid() = from_user_id
  or thread_id = 'pilot:' || auth.uid()::text
  or exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and coalesce(p.play_role, 'all') in ('dispatcher', 'all')
  )
);

create policy "dispatch_messages_insert" on dispatch_messages for insert with check (
  auth.uid() = from_user_id
  and (
    thread_id = 'pilot:' || auth.uid()::text
    or exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and coalesce(p.play_role, 'all') in ('dispatcher', 'all')
    )
  )
);

-- Profiles: users update own row; dispatchers can read active trips
create policy "profiles_select_active_trips" on profiles for select using (
  auth.uid() = id
  or active_trip is not null
);

-- Enable realtime (run once per table in dashboard or via API)
-- alter publication supabase_realtime add table dispatch_messages;
