-- Part 135 / Part 91 operator directory for Skyledger
-- Run in Supabase SQL editor after enabling auth.

create table if not exists public.operators (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  callsign text,
  color text default '#1B2A41',
  cert text not null default '135' check (cert in ('135', '91')),
  bases text[] not null default '{}',
  hiring boolean not null default false,
  pay_rate integer not null default 2500,
  pay_note text default 'Per completed charter',
  tier text default 'taxi',
  fleet_count integer not null default 0,
  cash integer not null default 0,
  fleet_roster jsonb not null default '[]'::jsonb,
  pilots jsonb not null default '[]'::jsonb,
  applications jsonb not null default '[]'::jsonb,
  founded timestamptz,
  updated_at timestamptz not null default now(),
  unique (owner_id)
);

create index if not exists operators_hiring_idx on public.operators (hiring) where hiring = true;
create index if not exists operators_updated_idx on public.operators (updated_at desc);

-- If upgrading an existing operators table:
alter table public.operators add column if not exists fleet_roster jsonb not null default '[]'::jsonb;
alter table public.operators add column if not exists cash integer not null default 0;

alter table public.operators enable row level security;

create policy "operators_public_read"
  on public.operators for select
  using (true);

create policy "operators_owner_insert"
  on public.operators for insert
  with check (auth.uid() = owner_id);

create policy "operators_owner_update"
  on public.operators for update
  using (auth.uid() = owner_id);

create policy "operators_owner_delete"
  on public.operators for delete
  using (auth.uid() = owner_id);

-- Pilots can submit applications (update applications json on any row)
create policy "operators_pilot_apply"
  on public.operators for update
  using (true)
  with check (true);

-- Note: the broad pilot_apply policy allows any authenticated user to update any operator.
-- Tighten in production with a security definer RPC if needed.
