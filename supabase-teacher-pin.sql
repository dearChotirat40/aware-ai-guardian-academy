-- Teacher dashboard access using a server-verified PIN (no email login).
create extension if not exists pgcrypto;

insert into public.app_settings(id, data, updated_at)
values (
  'teacher_security',
  jsonb_build_object('pin_hash', extensions.crypt('TeacherAI01', extensions.gen_salt('bf', 10))),
  extract(epoch from now())::bigint * 1000
)
on conflict (id) do update set
  data = jsonb_build_object('pin_hash', extensions.crypt('TeacherAI01', extensions.gen_salt('bf', 10))),
  updated_at = extract(epoch from now())::bigint * 1000;

create or replace function public.verify_teacher_pin(p_pin text)
returns boolean language sql stable security definer set search_path = public
as $$
  select length(coalesce(p_pin,'')) >= 8 and
    extensions.crypt(p_pin, data->>'pin_hash') = data->>'pin_hash'
  from public.app_settings where id='teacher_security';
$$;

create or replace function public.teacher_load_all(p_pin text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare result jsonb;
begin
  if not coalesce(public.verify_teacher_pin(p_pin),false) then raise exception 'Invalid teacher PIN'; end if;
  select jsonb_build_object(
    'students', coalesce(jsonb_object_agg(s.id,s.data),'{}'::jsonb),
    'roster', coalesce((select a.data->'items' from public.app_settings a where a.id='roster'),'[]'::jsonb)
  ) into result from public.students s;
  return result;
end $$;

create or replace function public.teacher_save_student(p_pin text,p_id text,p_data jsonb,p_points integer)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not coalesce(public.verify_teacher_pin(p_pin),false) then raise exception 'Invalid teacher PIN'; end if;
  update public.students set data=p_data,rank_points=coalesce(p_points,0),updated_at=extract(epoch from now())::bigint*1000 where id=p_id;
end $$;

create or replace function public.teacher_delete_student(p_pin text,p_id text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not coalesce(public.verify_teacher_pin(p_pin),false) then raise exception 'Invalid teacher PIN'; end if;
  delete from public.students where id=p_id;
end $$;

create or replace function public.teacher_save_roster(p_pin text,p_roster jsonb)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not coalesce(public.verify_teacher_pin(p_pin),false) then raise exception 'Invalid teacher PIN'; end if;
  insert into public.app_settings(id,data,updated_at) values('roster',jsonb_build_object('items',p_roster),extract(epoch from now())::bigint*1000)
  on conflict(id) do update set data=excluded.data,updated_at=excluded.updated_at;
end $$;

revoke all on function public.verify_teacher_pin(text) from public,anon;
revoke all on function public.teacher_load_all(text) from public,anon;
revoke all on function public.teacher_save_student(text,text,jsonb,integer) from public,anon;
revoke all on function public.teacher_delete_student(text,text) from public,anon;
revoke all on function public.teacher_save_roster(text,jsonb) from public,anon;
grant execute on function public.verify_teacher_pin(text) to authenticated;
grant execute on function public.teacher_load_all(text) to authenticated;
grant execute on function public.teacher_save_student(text,text,jsonb,integer) to authenticated;
grant execute on function public.teacher_delete_student(text,text) to authenticated;
grant execute on function public.teacher_save_roster(text,jsonb) to authenticated;

notify pgrst, 'reload schema';
