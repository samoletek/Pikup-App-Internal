-- Ensure chat tables are replicated by Supabase Realtime.
-- Safe/idempotent for environments where replication is already enabled.

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'messages'
    ) then
      execute 'alter publication supabase_realtime add table public.messages';
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'conversations'
    ) then
      execute 'alter publication supabase_realtime add table public.conversations';
    end if;
  end if;
end
$$;

-- Include full row images for update/delete realtime payloads.
alter table if exists public.messages replica identity full;
alter table if exists public.conversations replica identity full;
