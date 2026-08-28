-- รันครั้งเดียวใน Supabase > SQL Editor เพื่อให้ครูแก้เนื้อหาแล้วส่งถึงนักเรียนทุกเครื่องได้
create table if not exists public.app_curriculum (
  id text primary key,
  data jsonb not null,
  updated_at bigint not null default 0
);

alter table public.app_curriculum enable row level security;
grant select on public.app_curriculum to anon, authenticated;

drop policy if exists "students can read curriculum" on public.app_curriculum;
create policy "students can read curriculum"
on public.app_curriculum for select to anon, authenticated using (id = 'current');

create or replace function public.get_curriculum()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select data from public.app_curriculum where id = 'current' limit 1;
$$;
grant execute on function public.get_curriculum() to anon, authenticated;

create or replace function public.teacher_save_curriculum(p_pin text, p_data jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.verify_teacher_pin(p_pin) then
    raise exception 'Teacher PIN is invalid';
  end if;
  insert into public.app_curriculum(id, data, updated_at)
  values ('current', p_data, (extract(epoch from clock_timestamp()) * 1000)::bigint)
  on conflict (id) do update
  set data = excluded.data, updated_at = excluded.updated_at;
  return true;
end;
$$;
grant execute on function public.teacher_save_curriculum(text, jsonb) to anon, authenticated;
