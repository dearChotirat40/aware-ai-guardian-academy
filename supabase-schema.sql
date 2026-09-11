-- Run this file once in Supabase Dashboard > SQL Editor.
-- These temporary anonymous policies preserve the current app behavior.
-- Before using real student data, replace them with authenticated-user policies.

create table if not exists public.students (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at bigint not null default 0
);

-- If a table named students existed before this app, make its id compatible
-- with keys such as roster_41694. Existing numeric IDs are preserved as text.
alter table public.students alter column id type text using id::text;

create table if not exists public.app_settings (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at bigint not null default 0
);

alter table public.students enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists "temporary anonymous student access" on public.students;
create policy "temporary anonymous student access"
on public.students for all to anon
using (true) with check (true);

drop policy if exists "temporary anonymous settings access" on public.app_settings;
create policy "temporary anonymous settings access"
on public.app_settings for all to anon
using (true) with check (true);

grant select, insert, update, delete on public.students to anon;
grant select, insert, update, delete on public.app_settings to anon;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'students'
  ) then
    alter publication supabase_realtime add table public.students;
  end if;
end $$;
