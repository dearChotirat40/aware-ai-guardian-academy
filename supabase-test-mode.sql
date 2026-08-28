-- Temporary two-student test mode.
-- The real roster and all real student rows remain untouched.

create or replace function public.test_mode_enabled()
returns boolean language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select (data->>'enabled')::boolean from public.app_settings where id='test_mode'),
    false
  );
$$;

insert into public.app_settings(id,data,updated_at)
values(
  'test_mode',
  jsonb_build_object('enabled',true,'student_count',2),
  extract(epoch from now())::bigint*1000
)
on conflict(id) do update set data=excluded.data,updated_at=excluded.updated_at;

insert into public.app_settings(id,data,updated_at)
values(
  'test_roster',
  jsonb_build_object('items',jsonb_build_array(
    jsonb_build_object('code','9001','name','ผู้ทดสอบ 1','room','ห้องทดสอบ','num','1','gender','m'),
    jsonb_build_object('code','9002','name','ผู้ทดสอบ 2','room','ห้องทดสอบ','num','2','gender','f')
  )),
  extract(epoch from now())::bigint*1000
)
on conflict(id) do update set data=excluded.data,updated_at=excluded.updated_at;

insert into public.students(id,data,updated_at,rank_points)
values
  ('roster_9001',jsonb_build_object(
    'code','9001','name','ผู้ทดสอบ 1','room','ห้องทดสอบ','num','1','gender','m',
    '_testAccount',true,'score',0,'unlockedLevel',0,'badgeIds','[]'::jsonb,
    'pStars','[]'::jsonb,'lp','[]'::jsonb,'_updatedAt',extract(epoch from now())::bigint*1000
  ),extract(epoch from now())::bigint*1000,0),
  ('roster_9002',jsonb_build_object(
    'code','9002','name','ผู้ทดสอบ 2','room','ห้องทดสอบ','num','2','gender','f',
    '_testAccount',true,'score',0,'unlockedLevel',0,'badgeIds','[]'::jsonb,
    'pStars','[]'::jsonb,'lp','[]'::jsonb,'_updatedAt',extract(epoch from now())::bigint*1000
  ),extract(epoch from now())::bigint*1000,0)
on conflict(id) do update set
  data=public.students.data || jsonb_build_object(
    'code',excluded.data->>'code','name',excluded.data->>'name','room',excluded.data->>'room',
    'num',excluded.data->>'num','gender',excluded.data->>'gender','_testAccount',true
  );

create or replace function public.claim_student(p_code text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_row public.students;
  v_test boolean := public.test_mode_enabled();
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  -- During testing, allow this browser to switch between the two test accounts.
  if v_test then
    update public.students set user_id=null
      where user_id=auth.uid()
        and coalesce((data->>'_testAccount')::boolean,false)=true
        and id <> 'roster_'||trim(p_code);
  elsif exists(select 1 from public.students where user_id=auth.uid() and id <> 'roster_'||trim(p_code)) then
    raise exception 'This device is already linked to another student';
  end if;

  update public.students set user_id=auth.uid()
    where id='roster_'||trim(p_code)
      and (user_id is null or user_id=auth.uid())
      and case when v_test
        then coalesce((data->>'_testAccount')::boolean,false)=true
        else coalesce((data->>'_testAccount')::boolean,false)=false
      end
    returning * into v_row;
  if v_row.id is null then raise exception 'Invalid or already claimed student code'; end if;
  return jsonb_build_object('id',v_row.id,'data',v_row.data);
end $$;

create or replace function public.my_rank()
returns table(rank bigint,total bigint) language sql stable security definer set search_path = public
as $$
  with mode as (select public.test_mode_enabled() as enabled),
  ranked as (
    select s.user_id,row_number() over(order by s.rank_points desc,s.id) as position,count(*) over() as total
    from public.students s cross join mode m
    where case when m.enabled
      then coalesce((s.data->>'_testAccount')::boolean,false)=true
      else coalesce((s.data->>'_testAccount')::boolean,false)=false
    end
  ) select position,total from ranked where user_id=auth.uid();
$$;

create or replace function public.safe_leaderboard()
returns table(
  rank bigint,alias text,points integer,stars integer,badges integer,gem text,is_me boolean
) language sql stable security definer set search_path = public
as $$
  with mode as (select public.test_mode_enabled() as enabled),
  scored as (
    select
      s.user_id,
      coalesce(nullif(s.data->>'num',''), '–') as student_num,
      s.rank_points,
      coalesce((s.data->>'_rankBadges')::integer,0) as badge_count,
      coalesce((s.data->>'_rankStars')::integer,0) as star_count
    from public.students s cross join mode m
    where case when m.enabled
      then coalesce((s.data->>'_testAccount')::boolean,false)=true
      else coalesce((s.data->>'_testAccount')::boolean,false)=false
    end
  ), ranked as (
    select *,row_number() over(order by rank_points desc,student_num) as position from scored
  )
  select
    position,
    'นักเรียนเลขที่ '||student_num,
    rank_points,
    star_count,
    badge_count,
    case
      when star_count>=30 then 'เพชร'
      when star_count>=20 then 'ทอง'
      when star_count>=10 then 'เงิน'
      else 'เริ่มต้น'
    end,
    user_id=auth.uid()
  from ranked order by position;
$$;

create or replace function public.teacher_load_all(p_pin text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  result jsonb;
  v_test boolean := public.test_mode_enabled();
begin
  if not coalesce(public.verify_teacher_pin(p_pin),false) then raise exception 'Invalid teacher PIN'; end if;
  select jsonb_build_object(
    'students',coalesce((
      select jsonb_object_agg(s.id,s.data) from public.students s
      where case when v_test
        then coalesce((s.data->>'_testAccount')::boolean,false)=true
        else coalesce((s.data->>'_testAccount')::boolean,false)=false
      end
    ),'{}'::jsonb),
    'roster',coalesce((
      select a.data->'items' from public.app_settings a
      where a.id=case when v_test then 'test_roster' else 'roster' end
    ),'[]'::jsonb),
    'testMode',v_test
  ) into result;
  return result;
end $$;

create or replace function public.teacher_save_student(p_pin text,p_id text,p_data jsonb,p_points integer)
returns void language plpgsql security definer set search_path = public
as $$
declare v_test boolean := public.test_mode_enabled();
begin
  if not coalesce(public.verify_teacher_pin(p_pin),false) then raise exception 'Invalid teacher PIN'; end if;
  update public.students set data=p_data,rank_points=coalesce(p_points,0),updated_at=extract(epoch from now())::bigint*1000
    where id=p_id and case when v_test
      then coalesce((data->>'_testAccount')::boolean,false)=true
      else coalesce((data->>'_testAccount')::boolean,false)=false
    end;
end $$;

create or replace function public.teacher_delete_student(p_pin text,p_id text)
returns void language plpgsql security definer set search_path = public
as $$
declare v_test boolean := public.test_mode_enabled();
begin
  if not coalesce(public.verify_teacher_pin(p_pin),false) then raise exception 'Invalid teacher PIN'; end if;
  delete from public.students where id=p_id and case when v_test
    then coalesce((data->>'_testAccount')::boolean,false)=true
    else coalesce((data->>'_testAccount')::boolean,false)=false
  end;
end $$;

create or replace function public.teacher_save_roster(p_pin text,p_roster jsonb)
returns void language plpgsql security definer set search_path = public
as $$
declare v_setting_id text := case when public.test_mode_enabled() then 'test_roster' else 'roster' end;
begin
  if not coalesce(public.verify_teacher_pin(p_pin),false) then raise exception 'Invalid teacher PIN'; end if;
  insert into public.app_settings(id,data,updated_at)
    values(v_setting_id,jsonb_build_object('items',p_roster),extract(epoch from now())::bigint*1000)
  on conflict(id) do update set data=excluded.data,updated_at=excluded.updated_at;
end $$;

grant execute on function public.test_mode_enabled() to authenticated;
grant execute on function public.claim_student(text) to authenticated;
grant execute on function public.my_rank() to authenticated;
grant execute on function public.safe_leaderboard() to authenticated;
grant execute on function public.teacher_load_all(text) to authenticated;
grant execute on function public.teacher_save_student(text,text,jsonb,integer) to authenticated;
grant execute on function public.teacher_delete_student(text,text) to authenticated;
grant execute on function public.teacher_save_roster(text,jsonb) to authenticated;

notify pgrst,'reload schema';
