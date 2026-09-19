-- Restore the three original test passwords without resetting progress.
-- Existing student JSON, scores, rewards, cabinet data, and sessions are preserved.

begin;

update public.app_settings
set data = jsonb_set(coalesce(data, '{}'::jsonb), '{student_count}', '3'::jsonb, true),
    updated_at = (extract(epoch from now()) * 1000)::bigint
where id = 'test_mode';

with required(code, num, gender) as (
  values
    ('9001'::text, '1'::text, 'm'::text),
    ('9002'::text, '2'::text, 'f'::text),
    ('9003'::text, '3'::text, 'm'::text)
), current_items as (
  select coalesce(data->'items', '[]'::jsonb) as items
  from public.app_settings
  where id = 'test_roster'
), repaired_items as (
  select jsonb_agg(
    coalesce(
      (
        select item
        from current_items,
             lateral jsonb_array_elements(items) item
        where trim(item->>'code') = required.code
        limit 1
      ),
      jsonb_build_object('code', code, 'num', num, 'gender', gender)
    ) || jsonb_build_object('code', code, 'num', num)
    order by num::integer
  ) as items
  from required
)
insert into public.app_settings(id, data, updated_at)
select 'test_roster', jsonb_build_object('items', items),
       (extract(epoch from now()) * 1000)::bigint
from repaired_items
on conflict(id) do update
set data = excluded.data,
    updated_at = excluded.updated_at;

with required(code, num, gender) as (
  values
    ('9001'::text, '1'::text, 'm'::text),
    ('9002'::text, '2'::text, 'f'::text),
    ('9003'::text, '3'::text, 'm'::text)
)
insert into public.students(id, data, updated_at, rank_points)
select
  'roster_' || code,
  jsonb_build_object(
    'code', code,
    'num', num,
    'gender', gender,
    'nickname', '',
    '_testAccount', true,
    'score', 0,
    'unlockedLevel', 0,
    'badgeIds', '[]'::jsonb,
    'pStars', '[]'::jsonb,
    'lp', '[]'::jsonb,
    '_updatedAt', (extract(epoch from now()) * 1000)::bigint
  ),
  (extract(epoch from now()) * 1000)::bigint,
  0
from required
on conflict(id) do update
set data = public.students.data || jsonb_build_object(
      'code', excluded.data->>'code',
      'num', excluded.data->>'num',
      '_testAccount', true
    ),
    updated_at = greatest(public.students.updated_at, excluded.updated_at);

create or replace function public.claim_student(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code text := trim(coalesce(p_code, ''));
  v_row public.students;
  v_test boolean := public.test_mode_enabled();
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select s.*
    into v_row
  from public.students s
  where s.id = 'roster_' || v_code
    and s.data->>'code' = v_code
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

select
  s.id,
  s.data->>'code' as code,
  s.data->>'num' as num,
  coalesce((s.data->>'_testAccount')::boolean, false) as is_test,
  s.rank_points,
  (select count(*) from public.student_sessions ss where ss.student_id = s.id) as sessions
from public.students s
where s.id in ('roster_9001', 'roster_9002', 'roster_9003')
order by s.id;
