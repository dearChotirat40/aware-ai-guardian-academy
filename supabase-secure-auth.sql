-- Secure student ownership and teacher access.

alter table public.students add column if not exists user_id uuid unique references auth.users(id) on delete set null;
alter table public.students add column if not exists rank_points integer not null default 0;

drop policy if exists "temporary anonymous student access" on public.students;
drop policy if exists "student reads own row" on public.students;
drop policy if exists "student updates own row" on public.students;
drop policy if exists "teacher manages students" on public.students;

revoke all on public.students from anon;
grant select, update, insert, delete on public.students to authenticated;

create or replace function public.is_teacher()
returns boolean language sql stable security definer set search_path = public
as $$
  select coalesce((auth.jwt()->>'is_anonymous')::boolean, true) is false
    and lower(coalesce(auth.jwt()->>'email','')) = 'cpaenathai@gmail.com';
$$;

create policy "student reads own row" on public.students for select to authenticated
using (user_id = auth.uid() or public.is_teacher());

create policy "student updates own row" on public.students for update to authenticated
using (user_id = auth.uid() or public.is_teacher())
with check (user_id = auth.uid() or public.is_teacher());

create policy "teacher manages students" on public.students for all to authenticated
using (public.is_teacher()) with check (public.is_teacher());

create or replace function public.claim_student(p_code text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_row public.students;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if exists(select 1 from public.students where user_id=auth.uid() and id <> 'roster_'||trim(p_code)) then
    raise exception 'This device is already linked to another student';
  end if;
  update public.students set user_id=auth.uid()
    where id='roster_'||trim(p_code) and (user_id is null or user_id=auth.uid())
    returning * into v_row;
  if v_row.id is null then raise exception 'Invalid or already claimed student code'; end if;
  return jsonb_build_object('id',v_row.id,'data',v_row.data);
end $$;

create or replace function public.my_rank()
returns table(rank bigint,total bigint) language sql stable security definer set search_path = public
as $$
  with ranked as (
    select user_id,row_number() over(order by rank_points desc,id) as position,count(*) over() as total
    from public.students
  ) select position,total from ranked where user_id=auth.uid();
$$;

grant execute on function public.claim_student(text) to authenticated;
grant execute on function public.my_rank() to authenticated;

-- กระดานแข่งขันแบบไม่เปิดเผยชื่อจริง ใช้เฉพาะเลขที่และสถิติในเกม
create or replace function public.safe_leaderboard()
returns table(
  rank bigint,
  alias text,
  points integer,
  stars integer,
  badges integer,
  gem text,
  is_me boolean
) language sql stable security definer set search_path = public
as $$
  with scored as (
    select
      user_id,
      coalesce(nullif(data->>'num',''), '–') as student_num,
      rank_points,
      coalesce((data->>'_rankBadges')::integer,0) as badge_count,
      coalesce((data->>'_rankStars')::integer,0) as star_count
    from public.students
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
    user_id = auth.uid()
  from ranked
  order by position;
$$;

grant execute on function public.safe_leaderboard() to authenticated;

alter table public.app_settings enable row level security;
drop policy if exists "temporary anonymous settings access" on public.app_settings;
drop policy if exists "teacher manages settings" on public.app_settings;
revoke all on public.app_settings from anon;
grant select,insert,update,delete on public.app_settings to authenticated;
create policy "teacher manages settings" on public.app_settings for all to authenticated
using (public.is_teacher()) with check (public.is_teacher());

notify pgrst, 'reload schema';
