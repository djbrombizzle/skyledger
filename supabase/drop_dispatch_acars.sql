-- Remove ACARS / dispatch schema from Skyledger (revert companion to PR #17)

drop policy if exists "dispatch_messages_select" on public.dispatch_messages;
drop policy if exists "dispatch_messages_insert" on public.dispatch_messages;

do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'dispatch_messages'
  ) then
    alter publication supabase_realtime drop table public.dispatch_messages;
  end if;
end $$;

drop table if exists public.dispatch_messages;

drop index if exists public.profiles_active_trip_idx;

alter table public.profiles drop column if exists active_trip;
alter table public.profiles drop column if exists play_role;
