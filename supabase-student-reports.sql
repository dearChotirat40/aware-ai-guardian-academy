-- รายงานนักเรียนทุกคน — เก็บฉบับล่าสุดอัตโนมัติและฉบับที่ส่งครูย้อนหลัง
begin;
create table if not exists public.student_reports (
 id uuid primary key default gen_random_uuid(),
 student_id text references public.students(id) on update cascade on delete set null,
 student_reference text not null,
 automatic boolean not null default false,
 created_at timestamptz not null default clock_timestamp(),
 snapshot jsonb not null
);
create unique index if not exists student_reports_latest on public.student_reports(student_id) where automatic;
create index if not exists student_reports_date on public.student_reports(created_at desc);
alter table public.student_reports enable row level security;
revoke all on public.student_reports from public,anon,authenticated;
create or replace function public.capture_student_report(p_id text,p_auto boolean default true)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare d jsonb; w jsonb; chats jsonb; result uuid;
begin
 select data into d from public.students where id=p_id;
 if d is null then return null; end if;
 select jsonb_build_object('prizes',prizes,'bonusTickets',bonus_tickets) into w from public.cabinet_wallets where student_id=p_id;
 select coalesce(jsonb_agg(jsonb_build_object('id',message_id,'role',role,'content',content,'offline',offline,'createdAt',created_at) order by created_at,message_id),'[]'::jsonb) into chats from public.student_chat_messages where student_id=p_id;
 if p_auto then
  insert into public.student_reports(student_id,student_reference,automatic,snapshot)
  values(p_id,p_id,true,jsonb_build_object('student',d,'cabinet',coalesce(w,'{}'::jsonb),'chat',chats))
  on conflict(student_id) where automatic do update set snapshot=excluded.snapshot,created_at=clock_timestamp(),student_reference=excluded.student_reference returning id into result;
 else
  insert into public.student_reports(student_id,student_reference,automatic,snapshot)
  values(p_id,p_id,false,jsonb_build_object('student',d,'cabinet',coalesce(w,'{}'::jsonb),'chat',chats)) returning id into result;
 end if;
 return result;
end; $$;
revoke all on function public.capture_student_report(text,boolean) from public,anon,authenticated;
create or replace function public.refresh_student_report() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_table_name='students' then
  perform public.capture_student_report(new.id,true);
 else
  perform public.capture_student_report(new.student_id,true);
 end if;
 return new;
end; $$;
revoke all on function public.refresh_student_report() from public,anon,authenticated;
drop trigger if exists report_after_student_save on public.students;
create trigger report_after_student_save after insert or update on public.students for each row execute function public.refresh_student_report();
drop trigger if exists report_after_cabinet_save on public.cabinet_wallets;
create trigger report_after_cabinet_save after insert or update on public.cabinet_wallets for each row execute function public.refresh_student_report();
drop trigger if exists report_after_chat_save on public.student_chat_messages;
create trigger report_after_chat_save after insert on public.student_chat_messages for each row execute function public.refresh_student_report();
create or replace function public.student_report_archive(p_student_id text default null,p_save boolean default false,p_report_id uuid default null,p_pin text default null,p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare teacher boolean; result jsonb; r public.student_reports; saved uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 teacher:=coalesce(public.verify_teacher_pin(p_pin),false);
 if not teacher and (p_student_id is null or not public.owns_student(p_student_id)) then raise exception 'Access denied' using errcode='42501'; end if;
 if p_report_id is not null then
  select * into r from public.student_reports where id=p_report_id;
  if r.id is null or (not teacher and r.student_id is distinct from p_student_id) then raise exception 'Report not found or access denied' using errcode='42501'; end if;
  return to_jsonb(r);
 end if;
 if p_save then
  if p_student_id is null then raise exception 'Student required'; end if;
  saved:=public.capture_student_report(p_student_id,false);
  if saved is null then raise exception 'Student not found'; end if;
 end if;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc,t.id),'[]'::jsonb) into result from (
  select id,student_id,student_reference,automatic,created_at,snapshot->'student'->>'nickname' as nickname,snapshot->'student'->>'num' as num
  from public.student_reports where p_student_id is null or student_id=p_student_id
  order by created_at desc,id limit 50 offset greatest(0,coalesce(p_offset,0))
 ) t;
 return jsonb_build_object('items',result,'savedId',saved);
end; $$;
revoke all on function public.student_report_archive(text,boolean,uuid,text,integer) from public,anon;
grant execute on function public.student_report_archive(text,boolean,uuid,text,integer) to authenticated;
select public.capture_student_report(id,true) from public.students;
notify pgrst,'reload schema';
commit;
