-- Allow one student password to sign in from multiple browsers/devices.
-- Each anonymous Supabase user is linked to one student, while one student
-- may have many linked users. Progress continues to use the same student row.

begin;

create table if not exists public.student_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  student_id text not null references public.students(id) on update cascade on delete cascade,
  claimed_at timestamptz not null default now()
);

create index if not exists student_sessions_student_id_idx
  on public.student_sessions(student_id);

alter table public.student_sessions enable row level security;
revoke all on public.student_sessions from public, anon, authenticated;

-- Preserve the device that was linked by the previous one-device design.
insert into public.student_sessions(user_id, student_id)
select user_id, id
from public.students
where user_id is not null
on conflict (user_id) do update
set student_id = excluded.student_id,
    claimed_at = now();

create or replace function public.owns_student(p_student_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.student_sessions ss
    where ss.user_id = auth.uid()
      and ss.student_id = p_student_id
  );
$$;

revoke all on function public.owns_student(text) from public, anon;
grant execute on function public.owns_student(text) to authenticated;

drop policy if exists "student reads own row" on public.students;
drop policy if exists "student updates own row" on public.students;

create policy "student reads own row"
on public.students for select to authenticated
using (public.owns_student(id) or public.is_teacher());

create policy "student updates own row"
on public.students for update to authenticated
using (public.owns_student(id) or public.is_teacher())
with check (public.owns_student(id) or public.is_teacher());

grant select, update on public.students to authenticated;

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

create or replace function public.my_rank()
returns table(rank bigint, total bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with mode as (
    select public.test_mode_enabled() as enabled
  ), ranked as (
    select
      s.id as student_id,
      row_number() over(order by s.rank_points desc, s.id) as position,
      count(*) over() as total
    from public.students s
    cross join mode m
    where case when m.enabled
      then coalesce((s.data->>'_testAccount')::boolean, false) = true
      else coalesce((s.data->>'_testAccount')::boolean, false) = false
    end
  )
  select position, total
  from ranked
  where public.owns_student(student_id);
$$;

create or replace function public.safe_leaderboard()
returns table(
  rank bigint,
  alias text,
  points integer,
  stars integer,
  badges integer,
  gem text,
  is_me boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with mode as (
    select public.test_mode_enabled() as enabled
  ), scored as (
    select
      s.id as student_id,
      coalesce(nullif(s.data->>'num', ''), '–') as student_num,
      s.rank_points,
      coalesce((s.data->>'_rankBadges')::integer, 0) as badge_count,
      coalesce((s.data->>'_rankStars')::integer, 0) as star_count
    from public.students s
    cross join mode m
    where case when m.enabled
      then coalesce((s.data->>'_testAccount')::boolean, false) = true
      else coalesce((s.data->>'_testAccount')::boolean, false) = false
    end
  ), ranked as (
    select *, row_number() over(order by rank_points desc, student_num) as position
    from scored
  )
  select
    position,
    'นักเรียนเลขที่ ' || student_num,
    rank_points,
    star_count,
    badge_count,
    case
      when star_count >= 30 then 'เพชร'
      when star_count >= 20 then 'ทอง'
      when star_count >= 10 then 'เงิน'
      else 'เริ่มต้น'
    end,
    public.owns_student(student_id)
  from ranked
  order by position;
$$;

grant execute on function public.my_rank() to authenticated;
grant execute on function public.safe_leaderboard() to authenticated;

notify pgrst, 'reload schema';

commit;
