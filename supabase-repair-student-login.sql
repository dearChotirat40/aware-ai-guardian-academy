-- ซ่อมรหัสนักเรียน: คืนบัญชีทดสอบที่หายจากรายชื่อเดิม และรองรับหลายเครื่อง
-- ไม่เปลี่ยนรหัส ไม่ทับบัญชีที่มีอยู่ และไม่กู้คะแนนเก่าที่ไม่มีข้อมูลสำรอง
begin;
insert into public.students(id,data,updated_at,rank_points)
select 'roster_' || trim(item->>'code'), jsonb_build_object(
 'code',trim(item->>'code'),'num',coalesce(item->>'num',''),
 'gender',coalesce(item->>'gender','m'),'nickname','', '_testAccount',true,
 'score',0,'unlockedLevel',0,'badgeIds','[]'::jsonb,'pStars','[]'::jsonb,'lp','[]'::jsonb,
 '_updatedAt',(extract(epoch from now())*1000)::bigint
), (extract(epoch from now())*1000)::bigint,0
from public.app_settings cross join lateral jsonb_array_elements(data->'items') item
where id='test_roster' and length(trim(coalesce(item->>'code','')))>0
on conflict(id) do nothing;
create or replace function public.claim_student(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.students;
  v_test boolean := public.test_mode_enabled();
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select s.*
    into v_row
  from public.students s
  where s.id = 'roster_' || trim(coalesce(p_code, ''))
    and case when v_test
      then coalesce((s.data->>'_testAccount')::boolean, false) = true
      else coalesce((s.data->>'_testAccount')::boolean, false) = false
    end
  limit 1;

  if v_row.id is null then
    raise exception 'Invalid student password';
  end if;

  insert into public.student_sessions(user_id, student_id, claimed_at)
  values(auth.uid(), v_row.id, now())
  on conflict (user_id) do update
  set student_id = excluded.student_id,
      claimed_at = excluded.claimed_at;

  return jsonb_build_object('id', v_row.id, 'data', v_row.data);
end;
$$;

revoke all on function public.claim_student(text) from public, anon;
grant execute on function public.claim_student(text) to authenticated;


notify pgrst, 'reload schema';
commit;
