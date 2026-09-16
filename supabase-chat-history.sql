-- ประวัติแชทน้องชวนคิด — บันทึกแยกบัญชีและอ่าน 100 ข้อความล่าสุด
begin;
create table if not exists public.student_chat_messages (
 student_id text not null references public.students(id) on update cascade on delete cascade,
 message_id uuid not null,
 role text not null check(role in ('user','assistant')),
 content text not null check(length(content) between 1 and 8000),
 offline boolean not null default false,
 created_at timestamptz not null default clock_timestamp(),
 primary key(student_id,message_id)
);
create index if not exists student_chat_recent on public.student_chat_messages(student_id,created_at desc);
alter table public.student_chat_messages enable row level security;
revoke all on public.student_chat_messages from public,anon,authenticated;
create or replace function public.student_chat(p_student_id text,p_messages jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare item jsonb; result jsonb;
begin
 if auth.uid() is null or not public.owns_student(p_student_id) then raise exception 'Student access denied' using errcode='42501'; end if;
 if jsonb_typeof(p_messages) is distinct from 'array' or jsonb_array_length(p_messages)>2 then raise exception 'Invalid messages'; end if;
 for item in select value from jsonb_array_elements(p_messages) loop
  if item->>'role' not in ('user','assistant') or length(trim(coalesce(item->>'content',''))) not between 1 and 8000 then raise exception 'Invalid message'; end if;
  insert into public.student_chat_messages(student_id,message_id,role,content,offline)
   values(p_student_id,(item->>'id')::uuid,item->>'role',item->>'content',coalesce((item->>'offline')::boolean,false))
   on conflict(student_id,message_id) do nothing;
 end loop;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at,t.id),'[]'::jsonb) into result from (
  select message_id as id,role,content,offline,created_at from public.student_chat_messages
   where student_id=p_student_id order by created_at desc,message_id desc limit 100
 ) t;
 return result;
end; $$;
revoke all on function public.student_chat(text,jsonb) from public,anon;
grant execute on function public.student_chat(text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
