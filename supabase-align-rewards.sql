-- ให้ระดับอัญมณีบนกระดานอันดับใช้ดาวเดินทางเต็ม 12 ดวงเหมือนหน้าเว็บ
begin;

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
      coalesce(nullif(btrim(s.data->>'num'), ''), '–') as student_num,
      nullif(btrim(s.data->>'nickname'), '') as nickname,
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
    select *, row_number() over(order by rank_points desc, student_num, student_id) as position
    from scored
  )
  select
    position,
    coalesce(nickname, 'นักเรียนเลขที่ ' || student_num),
    rank_points,
    star_count,
    badge_count,
    case
      when star_count >= 12 then 'Diamond'
      when star_count >= 8 then 'Platinum'
      when star_count >= 4 then 'Gold'
      else 'Silver'
    end,
    public.owns_student(student_id)
  from ranked
  order by position;
$$;

grant execute on function public.safe_leaderboard() to authenticated;
notify pgrst, 'reload schema';

commit;
