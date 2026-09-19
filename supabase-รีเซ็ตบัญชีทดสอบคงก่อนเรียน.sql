-- ชื่อคำสั่ง: บัญชีทดสอบ — กู้บัญชี คงผลก่อนเรียน รีเซ็ตส่วนอื่น และเติม 5 สิทธิ์สุ่ม BOT
-- กู้ผลก่อนเรียนล่าสุดจาก student_reports แม้แถว students เดิมถูกลบไปแล้ว
begin;

insert into public.app_settings(id, data, updated_at)
values (
  'test_mode',
  jsonb_build_object('enabled', true, 'student_count', 3),
  (extract(epoch from now()) * 1000)::bigint
)
on conflict(id) do update
set data = coalesce(public.app_settings.data, '{}'::jsonb)
      || jsonb_build_object('enabled', true, 'student_count', 3),
    updated_at = excluded.updated_at;

insert into public.app_settings(id, data, updated_at)
values (
  'test_roster',
  jsonb_build_object('items', jsonb_build_array(
    jsonb_build_object('code', '9001', 'num', '1', 'gender', 'm'),
    jsonb_build_object('code', '9002', 'num', '2', 'gender', 'f'),
    jsonb_build_object('code', '9003', 'num', '3', 'gender', 'm')
  )),
  (extract(epoch from now()) * 1000)::bigint
)
on conflict(id) do update
set data = excluded.data,
    updated_at = excluded.updated_at;

with required(code, num, gender) as (
  values
    ('9001'::text, '1'::text, 'm'::text),
    ('9002'::text, '2'::text, 'f'::text),
    ('9003'::text, '3'::text, 'm'::text)
), latest as (
  select distinct on (student_reference)
    student_reference,
    snapshot->'student' as old_student
  from public.student_reports
  where student_reference in ('roster_9001', 'roster_9002', 'roster_9003')
  order by student_reference, created_at desc
)
insert into public.students(id, data, updated_at, rank_points)
select
  'roster_' || r.code,
  jsonb_build_object(
    'code', r.code,
    'num', r.num,
    'gender', r.gender,
    'nickname', coalesce(l.old_student->>'nickname', ''),
    '_testAccount', true,
    'lp', '[]'::jsonb,
    'score', 0,
    'unlockedLevel', 0,
    'badgeIds', '[]'::jsonb,
    'pStars', '[0,0,0]'::jsonb,
    'assessments', jsonb_build_object(
      'pre', coalesce(
        l.old_student #> '{assessments,pre}',
        jsonb_build_object('done', false, 'score', 0, 'total', 10)
      ),
      'post', jsonb_build_object(
        'done', false,
        'score', 0,
        'total', 10,
        'answers', '[]'::jsonb
      )
    ),
    'last', '-',
    '_updatedAt', (extract(epoch from clock_timestamp()) * 1000)::bigint,
    '_adminRevision', 1
  ) || case
    when coalesce(l.old_student->>'profilePhoto', '') <> ''
      then jsonb_build_object('profilePhoto', l.old_student->>'profilePhoto')
    else '{}'::jsonb
  end,
  (extract(epoch from clock_timestamp()) * 1000)::bigint,
  0
from required r
left join latest l on l.student_reference = 'roster_' || r.code
on conflict(id) do update
set data = excluded.data,
    updated_at = excluded.updated_at,
    rank_points = 0;

insert into public.cabinet_wallets(student_id, prizes, requests, bonus_tickets)
select id, '[]'::jsonb, '{}'::jsonb, 5
from public.students
where id in ('roster_9001', 'roster_9002', 'roster_9003')
on conflict(student_id) do update
set prizes = '[]'::jsonb,
    requests = '{}'::jsonb,
    bonus_tickets = 5;

commit;

select
  s.id as "บัญชีทดสอบ",
  coalesce((s.data #>> '{assessments,pre,done}')::boolean, false) as "คงผลก่อนเรียน",
  coalesce((s.data #>> '{assessments,pre,score}')::integer, 0) as "คะแนนก่อนเรียน",
  coalesce((s.data->>'score')::integer, 0) as "คะแนนบทเรียนหลังรีเซ็ต",
  w.bonus_tickets as "สิทธิ์สุ่มใหม่",
  jsonb_array_length(w.prizes) as "BOT ที่สุ่มแล้ว"
from public.students s
join public.cabinet_wallets w on w.student_id = s.id
where s.id in ('roster_9001', 'roster_9002', 'roster_9003')
order by s.id;
