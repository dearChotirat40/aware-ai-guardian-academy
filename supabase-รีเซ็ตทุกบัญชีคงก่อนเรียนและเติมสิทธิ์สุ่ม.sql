-- ชื่อคำสั่ง: ทุกบัญชี — คงผลก่อนเรียน รีเซ็ตส่วนอื่น และเติม 5 สิทธิ์สุ่ม BOT
begin;

update public.students
set data = jsonb_build_object(
      'code', coalesce(data->>'code', replace(id, 'roster_', '')),
      'num', coalesce(data->>'num', ''),
      'nickname', coalesce(data->>'nickname', ''),
      '_testAccount', coalesce((data->>'_testAccount')::boolean, false),
      'lp', '[]'::jsonb,
      'score', 0,
      'unlockedLevel', 0,
      'badgeIds', '[]'::jsonb,
      'pStars', '[0,0,0]'::jsonb,
      'assessments', jsonb_build_object(
        'pre', coalesce(
          data #> '{assessments,pre}',
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
      '_adminRevision', coalesce((data->>'_adminRevision')::bigint, 0) + 1
    ) || case
      when coalesce(data->>'profilePhoto', '') <> ''
        then jsonb_build_object('profilePhoto', data->>'profilePhoto')
      else '{}'::jsonb
    end,
    updated_at = (extract(epoch from clock_timestamp()) * 1000)::bigint,
    rank_points = 0;

insert into public.cabinet_wallets(student_id, prizes, requests, bonus_tickets)
select id, '[]'::jsonb, '{}'::jsonb, 5
from public.students
on conflict(student_id) do update
set prizes = '[]'::jsonb,
    requests = '{}'::jsonb,
    bonus_tickets = 5;

commit;

select
  s.id as "บัญชี",
  coalesce((s.data #>> '{assessments,pre,done}')::boolean, false) as "คงผลก่อนเรียน",
  coalesce((s.data #>> '{assessments,pre,score}')::integer, 0) as "คะแนนก่อนเรียน",
  w.bonus_tickets as "สิทธิ์สุ่ม",
  jsonb_array_length(w.prizes) as "BOT ที่สุ่มแล้ว"
from public.students s
join public.cabinet_wallets w on w.student_id = s.id
order by s.id;
