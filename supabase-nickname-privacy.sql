-- Remove legacy identifying fields while preserving progress, scores and ranking.
-- Students keep only their classroom number, student ID/password and self-chosen nickname.

begin;

create or replace function public.scrub_student_private_fields()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_nickname text;
begin
  new.data := coalesce(new.data, '{}'::jsonb)
    - 'name' - 'room' - 'gender' - 'renamed';

  v_nickname := btrim(coalesce(new.data->>'nickname', ''));
  if v_nickname = ''
     or char_length(v_nickname) < 2
     or char_length(v_nickname) > 20
     or v_nickname !~ '^[0-9A-Za-zก-๙._ -]+$' then
    new.data := new.data - 'nickname';
  else
    new.data := jsonb_set(new.data, '{nickname}', to_jsonb(v_nickname), true);
  end if;

  return new;
end;
$$;

drop trigger if exists scrub_student_private_fields_trigger on public.students;
create trigger scrub_student_private_fields_trigger
before insert or update of data on public.students
for each row execute function public.scrub_student_private_fields();

-- Clean all existing student rows. These removals do not touch lesson progress,
-- assessments, scores, badges, rank points or device links.
update public.students
set data = coalesce(data, '{}'::jsonb)
  - 'name' - 'room' - 'gender' - 'renamed';

-- Keep only the two teacher-managed identity fields in both live and test rosters.
update public.app_settings a
set data = jsonb_set(
      coalesce(a.data, '{}'::jsonb),
      '{items}',
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'code', btrim(coalesce(item->>'code', '')),
            'num', btrim(coalesce(item->>'num', ''))
          )
        )
        from jsonb_array_elements(
          case
            when jsonb_typeof(a.data->'items') = 'array' then a.data->'items'
            else '[]'::jsonb
          end
        ) item
        where btrim(coalesce(item->>'code', '')) <> ''
      ), '[]'::jsonb),
      true
    ),
    updated_at = (extract(epoch from now()) * 1000)::bigint
where a.id in ('roster', 'test_roster');

create or replace function public.set_student_nickname(p_nickname text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_nickname text := regexp_replace(btrim(coalesce(p_nickname, '')), '[[:space:]]+', ' ', 'g');
  v_id text;
  v_data jsonb;
  v_now bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if char_length(v_nickname) < 2
     or char_length(v_nickname) > 20
     or v_nickname !~ '^[0-9A-Za-zก-๙._ -]+$' then
    raise exception 'Invalid nickname';
  end if;

  select s.id
    into v_id
  from public.students s
  where public.owns_student(s.id)
  limit 1;

  if v_id is null then
    raise exception 'Student session not found';
  end if;

  update public.students
  set data = jsonb_set(
        jsonb_set(
          coalesce(data, '{}'::jsonb) - 'name' - 'room' - 'gender' - 'renamed',
          '{nickname}',
          to_jsonb(v_nickname),
          true
        ),
        '{_updatedAt}',
        to_jsonb(v_now),
        true
      ),
      updated_at = v_now
  where id = v_id
  returning data into v_data;

  return jsonb_build_object('id', v_id, 'data', v_data);
end;
$$;

revoke all on function public.set_student_nickname(text) from public, anon;
grant execute on function public.set_student_nickname(text) to authenticated;

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
      when star_count >= 30 then 'เพชร'
      when star_count >= 20 then 'ทอง'
      when star_count >= 10 then 'เงิน'
      else 'เริ่มต้น'
    end,
    public.owns_student(student_id)
  from ranked
  order by position;
$$;

grant execute on function public.safe_leaderboard() to authenticated;

-- Server-side privacy guard for teacher saves.
create or replace function public.teacher_save_student(
  p_pin text,
  p_id text,
  p_data jsonb,
  p_points integer
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_test boolean := public.test_mode_enabled();
  v_clean jsonb := coalesce(p_data, '{}'::jsonb)
    - 'name' - 'room' - 'gender' - 'renamed';
begin
  if not coalesce(public.verify_teacher_pin(p_pin), false) then
    raise exception 'Invalid teacher PIN';
  end if;

  update public.students
  set data = v_clean,
      rank_points = coalesce(p_points, 0),
      updated_at = (extract(epoch from now()) * 1000)::bigint
  where id = p_id
    and case when v_test
      then coalesce((data->>'_testAccount')::boolean, false) = true
      else coalesce((data->>'_testAccount')::boolean, false) = false
    end;
end;
$$;

create or replace function public.teacher_save_roster(
  p_pin text,
  p_roster jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_setting_id text := case when public.test_mode_enabled() then 'test_roster' else 'roster' end;
  v_clean jsonb;
begin
  if not coalesce(public.verify_teacher_pin(p_pin), false) then
    raise exception 'Invalid teacher PIN';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'code', btrim(coalesce(item->>'code', '')),
      'num', btrim(coalesce(item->>'num', ''))
    )
  ), '[]'::jsonb)
  into v_clean
  from jsonb_array_elements(
    case when jsonb_typeof(p_roster) = 'array' then p_roster else '[]'::jsonb end
  ) item
  where btrim(coalesce(item->>'code', '')) <> '';

  insert into public.app_settings(id, data, updated_at)
  values(
    v_setting_id,
    jsonb_build_object('items', v_clean),
    (extract(epoch from now()) * 1000)::bigint
  )
  on conflict(id) do update
  set data = excluded.data,
      updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.teacher_save_student(text, text, jsonb, integer) from public, anon;
revoke all on function public.teacher_save_roster(text, jsonb) from public, anon;
grant execute on function public.teacher_save_student(text, text, jsonb, integer) to authenticated;
grant execute on function public.teacher_save_roster(text, jsonb) to authenticated;

notify pgrst, 'reload schema';

commit;
