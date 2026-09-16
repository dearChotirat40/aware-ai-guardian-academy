-- เมนูครู: เพิ่ม แก้ไข ลบ และล้างประวัติแชท พร้อมเก็บรายงานก่อนเปลี่ยนแปลง
begin;
create or replace function public.refresh_student_report() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_op='DELETE' then perform public.capture_student_report(old.student_id,true); return old;
 elsif tg_table_name='students' then perform public.capture_student_report(new.id,true);
 else perform public.capture_student_report(new.student_id,true); end if;
 return new;
end; $$;
drop trigger if exists report_after_chat_save on public.student_chat_messages;
create trigger report_after_chat_save after insert or update or delete on public.student_chat_messages for each row execute function public.refresh_student_report();
create or replace function public.teacher_chat_manage(p_pin text,p_student_id text,p_action text default 'list',p_message_id uuid default null,p_content text default '',p_role text default 'assistant',p_expected text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare before_row public.student_chat_messages; result jsonb;
begin
 if auth.uid() is null or not coalesce(public.verify_teacher_pin(p_pin),false) then raise exception 'Teacher login required' using errcode='42501'; end if;
 if not exists(select 1 from public.students where id=p_student_id) then raise exception 'Student not found'; end if;
 if p_action not in ('list','create','update','delete','reset') then raise exception 'Invalid action'; end if;
 if p_action in ('create','update') and (length(trim(coalesce(p_content,''))) not between 1 and 8000 or p_role not in ('user','assistant')) then raise exception 'Invalid content'; end if;
 if p_action in ('update','delete') then
  select * into before_row from public.student_chat_messages where student_id=p_student_id and message_id=p_message_id for update;
  if before_row.message_id is null then raise exception 'Message not found'; end if;
  if p_expected is distinct from before_row.content then raise exception 'ข้อความเปลี่ยนแล้ว กรุณาโหลดข้อมูลล่าสุด'; end if;
 end if;
 if p_action<>'list' then
  perform public.capture_student_report(p_student_id,false);
  insert into public.teacher_audit(actor,action,before_data) values(auth.uid(),'chat_'||p_action,jsonb_build_object('student_id',p_student_id,'message',to_jsonb(before_row)));
 end if;
 if p_action='create' then
  insert into public.student_chat_messages(student_id,message_id,role,content) values(p_student_id,gen_random_uuid(),p_role,p_content);
 elsif p_action='update' then
  update public.student_chat_messages set content=p_content where student_id=p_student_id and message_id=p_message_id;
 elsif p_action='delete' then
  delete from public.student_chat_messages where student_id=p_student_id and message_id=p_message_id;
 elsif p_action='reset' then
  delete from public.student_chat_messages where student_id=p_student_id;
 end if;
 select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at,m.message_id),'[]'::jsonb) into result from public.student_chat_messages m where student_id=p_student_id;
 return result;
end; $$;
revoke all on function public.teacher_chat_manage(text,text,text,uuid,text,text,text) from public,anon;
grant execute on function public.teacher_chat_manage(text,text,text,uuid,text,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
