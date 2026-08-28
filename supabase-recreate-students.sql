-- Run once in Supabase Dashboard > SQL Editor.
-- The old student rows were intentionally removed before this migration.

drop table if exists public.students cascade;

create table public.students (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at bigint not null default 0
);

alter table public.students enable row level security;

create policy "temporary anonymous student access"
on public.students for all to anon
using (true) with check (true);

grant select, insert, update, delete on public.students to anon;

alter publication supabase_realtime add table public.students;

notify pgrst, 'reload schema';
