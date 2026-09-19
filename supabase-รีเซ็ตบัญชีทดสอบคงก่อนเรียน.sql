-- ชื่อคำสั่ง: บัญชีทดสอบ — คงผลก่อนเรียน รีเซ็ตกิจกรรมทั้งหมด และเติม 5 สิทธิ์สุ่ม BOT
-- ใช้กับบัญชีในโหมดทดสอบเท่านั้น เพื่อไม่แตะข้อมูลนักเรียนจริง
begin;

update public.students
set data = jsonb_build_object(
      'nickname', coalesce(data->>'nickname',''),
      'num', coalesce(data->>'num',''),
      'code', coalesce(data->>'code',''),
      '_testAccount', true,
      'lp', '[]'::jsonb,
      'score', 0,
      'unlockedLevel', 0,
      'badgeIds', '[]'::jsonb,
      'pStars', '[0,0,0]'::jsonb,
      'assessments', jsonb_build_object(
        'pre', coalesce(data #> '{assessments,pre}', jsonb_build_object('done',false,'score',0,'total',0,'answers','[]'::jsonb)),
        'post', jsonb_build_object('done',false,'score',0,'total',0,'answers','[]'::jsonb)
      ),
      'last', '-',
      '_updatedAt', (extract(epoch from clock_timestamp())*1000)::bigint,
      '_adminRevision', coalesce((data->>'_adminRevision')::bigint,0)+1
    ) || case when coalesce(data->>'profilePhoto','') <> '' then jsonb_build_object('profilePhoto',data->>'profilePhoto') else '{}'::jsonb end,
    updated_at = (extract(epoch from clock_timestamp())*1000)::bigint,
    rank_points = 0
where coalesce((data->>'_testAccount')::boolean,false) = true;

insert into public.cabinet_wallets(student_id,prizes,requests,bonus_tickets)
select id,'[]'::jsonb,'{}'::jsonb,5
from public.students
where coalesce((data->>'_testAccount')::boolean,false) = true
on conflict(student_id) do update
set prizes='[]'::jsonb,requests='{}'::jsonb,bonus_tickets=5,updated_at=now();

commit;

select s.id as "บัญชีทดสอบ",
       coalesce((s.data #>> '{assessments,pre,done}')::boolean,false) as "คงผลก่อนเรียน",
       w.bonus_tickets as "สิทธิ์สุ่มใหม่",
       jsonb_array_length(w.prizes) as "BOT ที่สุ่มแล้ว"
from public.students s
join public.cabinet_wallets w on w.student_id=s.id
where coalesce((s.data->>'_testAccount')::boolean,false) = true
order by s.id;
