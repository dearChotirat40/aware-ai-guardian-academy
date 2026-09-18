-- Query: เมนูครู — จัดการบัญชี ความคืบหน้า ตู้สุ่ม และเนื้อหาแบบธุรกรรม
-- Run after supabase-teacher-pin.sql, supabase-curriculum-setup.sql and supabase-cabinet-wallet.sql.
-- Installing this migration does not reset or delete student data.
begin;
alter table public.students add column if not exists rank_points integer not null default 0;
alter table public.students add column if not exists updated_at bigint not null default 0;
alter table public.cabinet_wallets add column if not exists bonus_tickets integer not null default 0 check (bonus_tickets >= 0);
-- Some earlier table recreations removed the relationship constraints. Keep any orphaned legacy rows.
do $$
begin
 if not exists(select 1 from pg_constraint where conrelid='public.student_sessions'::regclass and conname='student_sessions_student_id_fkey') then
  alter table public.student_sessions add constraint student_sessions_student_id_fkey foreign key(student_id) references public.students(id) on update cascade on delete cascade not valid;
 end if;
 if not exists(select 1 from pg_constraint where conrelid='public.cabinet_wallets'::regclass and conname='cabinet_wallets_student_id_fkey') then
  alter table public.cabinet_wallets add constraint cabinet_wallets_student_id_fkey foreign key(student_id) references public.students(id) on update cascade on delete cascade not valid;
 end if;
 if not exists(select 1 from public.student_sessions ss left join public.students s on s.id=ss.student_id where s.id is null) then
  alter table public.student_sessions validate constraint student_sessions_student_id_fkey;
 end if;
 if not exists(select 1 from public.cabinet_wallets w left join public.students s on s.id=w.student_id where s.id is null) then
  alter table public.cabinet_wallets validate constraint cabinet_wallets_student_id_fkey;
 end if;
end $$;
-- Restore ownership policies removed by an earlier students table recreation.
alter table public.students enable row level security;
drop policy if exists "temporary anonymous student access" on public.students;
drop policy if exists "student reads own row" on public.students;
drop policy if exists "student updates own row" on public.students;
create policy "student reads own row" on public.students for select to authenticated using(public.owns_student(id));
create policy "student updates own row" on public.students for update to authenticated using(public.owns_student(id)) with check(public.owns_student(id));
revoke all on public.students from anon;
revoke insert,delete on public.students from authenticated;
grant select,update on public.students to authenticated;
create table if not exists public.teacher_audit (
 id bigint generated always as identity primary key,
 created_at timestamptz not null default now(), actor uuid, action text not null,
 before_data jsonb not null
);
alter table public.teacher_audit enable row level security;
revoke all on public.teacher_audit from public,anon,authenticated;

create or replace function public.guard_student_admin_revision()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if current_user in ('anon','authenticated') and
   coalesce(new.data->>'_adminRevision','0') <> coalesce(old.data->>'_adminRevision','0') then
   raise exception 'ADMIN_CHANGED: โหลดข้อมูลล่าสุดหลังครูแก้ไขก่อนบันทึกอีกครั้ง' using errcode='40001';
 end if;
 return new;
end $$;
drop trigger if exists guard_student_admin_revision on public.students;
create trigger guard_student_admin_revision before update on public.students
 for each row execute function public.guard_student_admin_revision();

create or replace function public.teacher_manage(p_pin text,p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 mode boolean := coalesce((select (data->>'enabled')::boolean from public.app_settings where id='test_mode'),false);
 setting_id text; roster jsonb; op jsonb; old_row public.students; d jsonb;
 old_id text; new_id text; code text; num text; stamp bigint; prev jsonb; prizes jsonb;
 catalog text[] := array['Sky Blue','Strawberry Pink','Mint Green','Sunny Yellow','Lavender','Peach Orange','Ocean Teal','Chocolate Brown','Cloud White','Rainbow Pastel','Rainbow Secret'];
begin
 if auth.uid() is null or not coalesce(public.verify_teacher_pin(p_pin),false) then
  raise exception 'Invalid teacher PIN' using errcode='42501';
 end if;
 if p_action not in ('load','batch') then raise exception 'Unknown teacher action'; end if;
 perform pg_advisory_xact_lock(73625101);
 setting_id := case when mode then 'test_roster' else 'roster' end;
 roster := coalesce((select data->'items' from public.app_settings where id=setting_id),'[]'::jsonb);
 if p_action='batch' then
  if jsonb_typeof(p_payload->'operations') is distinct from 'array' or jsonb_array_length(p_payload->'operations')>1000 then raise exception 'Invalid operations'; end if;
  for op in select value from jsonb_array_elements(p_payload->'operations') loop
   if op->>'kind' not in ('create','edit','reset','delete','wallet') or op->>'kind' is null then raise exception 'Invalid operation'; end if;
   old_id := op->>'id';
   select * into old_row from public.students where id=old_id for update;
   if op->>'kind'='create' then
    if found then raise exception 'Student code already exists'; end if;
    d := coalesce(op->'data','{}'::jsonb);
   else
    if not found then raise exception 'Student not found'; end if;
    if coalesce((old_row.data->>'_testAccount')::boolean,false) <> mode then raise exception 'Student belongs to another classroom mode'; end if;
    if op ? 'expected' and coalesce((op->>'expected')::bigint,0) <> coalesce(old_row.updated_at,0) then
     raise exception 'CONFLICT: นักเรียนมีข้อมูลใหม่ กรุณาโหลดข้อมูลแล้วแก้อีกครั้ง' using errcode='40001';
    end if;
    d := old_row.data;
   end if;
   if op ? 'expectedWallet' and op->'expectedWallet' is distinct from coalesce((select jsonb_build_object('prizes',cw.prizes,'bonus_tickets',cw.bonus_tickets) from public.cabinet_wallets cw where cw.student_id=old_id),'null'::jsonb) then
    raise exception 'CONFLICT: ตู้สุ่มมีข้อมูลใหม่ กรุณาโหลดข้อมูลอีกครั้ง' using errcode='40001';
   end if;
   prev := jsonb_build_object('student',to_jsonb(old_row),'wallet',(select to_jsonb(w) from public.cabinet_wallets w where student_id=old_id),'roster',roster);
   insert into public.teacher_audit(actor,action,before_data) values(auth.uid(),op->>'kind',prev);
   stamp := greatest((extract(epoch from clock_timestamp())*1000)::bigint,coalesce(old_row.updated_at,0)+1);
   if op->>'kind'='delete' then
    delete from public.students where id=old_id;
    select coalesce(jsonb_agg(r),'[]'::jsonb) into roster from jsonb_array_elements(roster) r where 'roster_'||(r->>'code') <> old_id;
    continue;
   end if;
   if op->>'kind' in ('edit','reset') then
    if jsonb_typeof(op->'data') is distinct from 'object' then raise exception 'Invalid student data'; end if;
    if op->>'kind'='reset' and coalesce(op->>'scope','all') <> 'all' then
     d := old_row.data || case op->>'scope'
      when 'lessons' then jsonb_build_object('lp',op->'data'->'lp')
      when 'prompts' then jsonb_build_object('pStars',op->'data'->'pStars')
      when 'assessments' then jsonb_build_object('assessments',op->'data'->'assessments')
      when 'badges' then jsonb_build_object('badgeIds','[]'::jsonb,'score',0,'unlockedLevel',0)
      when 'chat' then jsonb_build_object('chatQuestions','[]'::jsonb)
      when 'cabinet' then jsonb_build_object('buddyAvatar','')
      else '{}'::jsonb end;
    else d := op->'data'; end if;
   end if;
   code := trim(coalesce(d->>'code','')); num := trim(coalesce(d->>'num',''));
   if code !~ '^[0-9A-Za-zก-๙_-]{3,20}$' then raise exception 'Invalid student code'; end if;
   new_id := 'roster_'||code;
   if op->>'kind'='wallet' then new_id := old_id; end if;
   if op->>'kind' in ('create','edit','reset') then
    if jsonb_typeof(d->'lp') is distinct from 'array' or jsonb_typeof(d->'badgeIds') is distinct from 'array' or jsonb_typeof(d->'pStars') is distinct from 'array' then raise exception 'Invalid progress'; end if;
   end if;
   d := (d - 'name' - 'room' - 'gender') || jsonb_build_object('code',code,'num',num,'_testAccount',mode,
     '_updatedAt',stamp,'_adminRevision',coalesce((old_row.data->>'_adminRevision')::bigint,0)+1);
   if op->>'kind'='create' then
    insert into public.students(id,data,updated_at,rank_points) values(new_id,d,stamp,coalesce((op->>'points')::integer,0));
   else
    update public.students set id=new_id,data=d,updated_at=stamp,rank_points=coalesce((op->>'points')::integer,old_row.rank_points,0) where id=old_id;
   end if;
   select coalesce(jsonb_agg(r),'[]'::jsonb) into roster from jsonb_array_elements(roster) r where 'roster_'||(r->>'code') not in (old_id,new_id);
   roster := roster || jsonb_build_array(jsonb_build_object('code',code,'num',num));
   if op ? 'wallet' then
    prizes := op->'wallet'->'prizes';
    if jsonb_typeof(prizes) is distinct from 'array' or jsonb_array_length(prizes)>1000 or
     exists(select 1 from jsonb_array_elements_text(prizes) p where not(p=any(catalog))) then raise exception 'Invalid cabinet prizes'; end if;
    insert into public.cabinet_wallets(student_id,prizes,requests,bonus_tickets)
     values(new_id,prizes,'{}'::jsonb,coalesce((op->'wallet'->>'bonus_tickets')::integer,0))
     on conflict(student_id) do update set prizes=excluded.prizes,requests='{}'::jsonb,bonus_tickets=excluded.bonus_tickets;
   end if;
  end loop;
  insert into public.app_settings(id,data,updated_at) values(setting_id,jsonb_build_object('items',roster),(extract(epoch from clock_timestamp())*1000)::bigint)
   on conflict(id) do update set data=excluded.data,updated_at=excluded.updated_at;
 end if;
 return jsonb_build_object(
  'students',coalesce((select jsonb_object_agg(id,data || jsonb_build_object('_updatedAt',updated_at)) from public.students where coalesce((data->>'_testAccount')::boolean,false)=mode),'{}'::jsonb),
  'wallets',coalesce((select jsonb_object_agg(w.student_id,jsonb_build_object('prizes',w.prizes,'bonus_tickets',w.bonus_tickets)) from public.cabinet_wallets w join public.students s on s.id=w.student_id where coalesce((s.data->>'_testAccount')::boolean,false)=mode),'{}'::jsonb),
  'roster',roster,'testMode',mode);
end $$;
revoke all on function public.teacher_manage(text,text,jsonb) from public,anon;
grant execute on function public.teacher_manage(text,text,jsonb) to authenticated;

-- Old clients also receive a real, atomic upsert; no UPDATE-to-missing-row success.
create or replace function public.teacher_save_student(p_pin text,p_id text,p_data jsonb,p_points integer)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform public.teacher_manage(p_pin,'batch',jsonb_build_object('operations',jsonb_build_array(jsonb_build_object(
  'kind',case when exists(select 1 from public.students where id=p_id) then 'edit' else 'create' end,
  'id',p_id,'data',p_data,'points',p_points,'expected',coalesce((p_data->>'_updatedAt')::bigint,0)))));
end $$;
create or replace function public.teacher_delete_student(p_pin text,p_id text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform public.teacher_manage(p_pin,'batch',jsonb_build_object('operations',jsonb_build_array(jsonb_build_object('kind','delete','id',p_id))));
end $$;

revoke all on function public.teacher_save_student(text,text,jsonb,integer) from public,anon;
revoke all on function public.teacher_delete_student(text,text) from public,anon;
grant execute on function public.teacher_save_student(text,text,jsonb,integer) to authenticated;
grant execute on function public.teacher_delete_student(text,text) to authenticated;

-- Compute ranking from saved progress, including teacher edits and custom reward rules.
create or replace function public.recompute_student_rank()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare c jsonb; d jsonb:=new.data; x jsonb; stars integer:=0; pts integer:=0;
 badges integer:=0; bonus integer:=0; unit integer:=4; done boolean; n integer;
begin
 select data into c from public.app_curriculum where id='current';
 unit:=coalesce((c->'modules'->>'unitPoints')::integer,4);
 for x in select value from jsonb_array_elements(coalesce(d->'lp','[]'::jsonb)) loop
  done:=coalesce((x->>'quizAttempted')::boolean,false) or coalesce((x->>'quizDone')::boolean,false) or coalesce((x->>'postScore')::numeric,0)>0;
  if done then
   stars:=stars+1;
   pts:=pts+least(unit,round(coalesce((x->>'postScore')::numeric,0)/coalesce(nullif((x->>'postTotal')::numeric,0),5)*unit)::integer);
  end if;
 end loop;
 for x in select value from jsonb_array_elements(coalesce(d->'pStars','[]'::jsonb)) loop
  if x::numeric>0 then stars:=stars+1; end if;
  pts:=pts+greatest(0,x::integer)*5;
 end loop;
 n:=jsonb_array_length(coalesce(d->'badgeIds','[]'::jsonb));stars:=stars+n;pts:=pts+n*2;
 if jsonb_typeof(c->'modules'->'gems')='array' then
  select coalesce((g->>'bonus')::integer,0) into bonus from jsonb_array_elements(c->'modules'->'gems') g
   where (g->>'min')::integer<=stars order by (g->>'min')::integer desc limit 1;
 else bonus:=case when stars>=13 then 15 when stars>=8 then 10 when stars>=4 then 5 else 0 end;
 end if;
 if jsonb_typeof(c->'modules'->'badges')='array' then
  for x in select value from jsonb_array_elements(c->'modules'->'badges') loop
   done:=case x->>'type'
    when 'pre' then coalesce((d->'assessments'->'pre'->>'done')::boolean,false)
    when 'lesson' then coalesce((d->'lp'->((x->>'index')::integer)->>'quizDone')::boolean,false) or coalesce((d->'lp'->((x->>'index')::integer)->>'quizAttempted')::boolean,false)
    when 'prompt' then coalesce((d->'pStars'->>((x->>'index')::integer))::integer,0)>0
    when 'scenario' then coalesce(d->'badgeIds','[]'::jsonb) ? (x->>'badgeId') else false end;
   if done then badges:=badges+1; end if;
  end loop;
 else badges:=stars+case when coalesce((d->'assessments'->'pre'->>'done')::boolean,false) then 1 else 0 end;
 end if;
 new.data:=d||jsonb_build_object('_rankStars',stars,'_rankBadges',badges);
 new.rank_points:=pts+coalesce(bonus,0);
 return new;
end $$;
drop trigger if exists recompute_student_rank on public.students;
create trigger recompute_student_rank before insert or update on public.students for each row execute function public.recompute_student_rank();

-- Content changes preserve lesson/prompt progress by stable key rather than array position.
create or replace function public.teacher_save_curriculum(p_pin text,p_data jsonb)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare prev jsonb; r record; d jsonb; lp jsonb; ps jsonb; changed boolean; stamp bigint;
begin
 if auth.uid() is null or not coalesce(public.verify_teacher_pin(p_pin),false) then raise exception 'Invalid teacher PIN' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(73625101);
 select data into prev from public.app_curriculum where id='current' for update;
 if p_data ? 'baseUpdatedAt' and coalesce((p_data->>'baseUpdatedAt')::bigint,0) <> coalesce((prev->>'updatedAt')::bigint,0) then raise exception 'CONFLICT: เนื้อหามีเวอร์ชันใหม่ กรุณาโหลดใหม่'; end if;
 if jsonb_typeof(p_data->'lessons') is distinct from 'array' or jsonb_array_length(p_data->'lessons')<1 or
  jsonb_typeof(p_data->'modules'->'prompts') is distinct from 'array' or jsonb_array_length(p_data->'modules'->'prompts')<1 or
  jsonb_typeof(p_data->'modules'->'scenarios') is distinct from 'array' or jsonb_array_length(p_data->'modules'->'scenarios')<1 then raise exception 'Invalid curriculum'; end if;
 if exists(select 1 from jsonb_array_elements(p_data->'lessons') x where coalesce(x->>'_key','')='') or
  (select count(*)<>count(distinct x->>'_key') from jsonb_array_elements(p_data->'lessons') x) then raise exception 'Invalid lesson keys'; end if;
 insert into public.teacher_audit(actor,action,before_data) values(auth.uid(),'curriculum',jsonb_build_object('curriculum',prev));
 -- The client sends the previous default key order for an installation with no saved content.
 prev := coalesce(prev,p_data->'previous');
 changed := coalesce(prev->'lessons','[]'::jsonb) <> p_data->'lessons' or coalesce(prev->'modules','{}'::jsonb) <> p_data->'modules';
 if changed then
  for r in select * from public.students order by id for update loop
   d := r.data;
   select coalesce(jsonb_agg(coalesce(d->'lp'->(o.n::integer-1),'{}'::jsonb) order by n.n),'[]'::jsonb) into lp
    from jsonb_array_elements(p_data->'lessons') with ordinality n(v,n)
    left join jsonb_array_elements(coalesce(prev->'lessons',p_data->'previous'->'lessons')) with ordinality o(v,n)
    on coalesce(o.v->>'_key','lesson-'||o.n)=n.v->>'_key';
   select coalesce(jsonb_agg(coalesce(d->'pStars'->(o.n::integer-1),'0'::jsonb) order by n.n),'[]'::jsonb) into ps
    from jsonb_array_elements(p_data->'modules'->'prompts') with ordinality n(v,n)
    left join jsonb_array_elements(coalesce(prev->'modules'->'prompts',p_data->'previous'->'modules'->'prompts')) with ordinality o(v,n)
    on coalesce(o.v->>'_key','prompt-'||o.n)=n.v->>'_key';
   stamp := greatest((extract(epoch from clock_timestamp())*1000)::bigint,coalesce(r.updated_at,0)+1);
   d := d || jsonb_build_object('lp',lp,'pStars',ps,'_updatedAt',stamp,'_adminRevision',coalesce((d->>'_adminRevision')::bigint,0)+1);
   select d || jsonb_build_object('badgeIds',coalesce(jsonb_agg(b),'[]'::jsonb)) into d from jsonb_array_elements(coalesce(d->'badgeIds','[]'::jsonb)) b
    where exists(select 1 from jsonb_array_elements(p_data->'modules'->'scenarios') sc cross join lateral jsonb_array_elements(sc->'choices') c where c->'badge'->>'id'=b#>>'{}');
   d := d || jsonb_build_object('score',jsonb_array_length(d->'badgeIds')*2,'unlockedLevel',jsonb_array_length(d->'badgeIds'));
   update public.students set data=d,updated_at=stamp where id=r.id;
  end loop;
 end if;
 stamp := greatest((extract(epoch from clock_timestamp())*1000)::bigint,coalesce((prev->>'updatedAt')::bigint,0)+1);
 insert into public.app_curriculum(id,data,updated_at) values('current',(p_data-'previous'-'baseUpdatedAt')||jsonb_build_object('updatedAt',stamp),stamp)
  on conflict(id) do update set data=excluded.data,updated_at=excluded.updated_at;
 update public.students set data=data; -- refresh ranks using the newly saved reward rules
 return true;
end $$;
revoke all on function public.teacher_save_curriculum(text,jsonb) from public,anon;
grant execute on function public.teacher_save_curriculum(text,jsonb) to authenticated;
create or replace function public.cabinet_account(p_student_id text, p_request_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  d jsonb; w public.cabinet_wallets; earned integer; picked text;
  legacy jsonb; lp jsonb; item text;
  catalog text[] := array['Sky Blue','Strawberry Pink','Mint Green','Sunny Yellow','Lavender','Peach Orange','Ocean Teal','Chocolate Brown','Cloud White','Rainbow Pastel','Rainbow Secret'];
begin
  if auth.uid() is null or not public.owns_student(p_student_id) then
    raise exception 'Student account required' using errcode = '42501';
  end if;
  select data into d from public.students where id = p_student_id for update;
  if not found then raise exception 'Student not found'; end if;
  select count(distinct b) into earned
    from jsonb_array_elements_text(coalesce(d->'badgeIds','[]'::jsonb)) b
    where case when exists(select 1 from public.app_curriculum where id='current' and data->'modules' ? 'scenarios') then
      exists(select 1 from public.app_curriculum ac cross join lateral jsonb_array_elements(ac.data->'modules'->'scenarios') sc
       cross join lateral jsonb_array_elements(sc->'choices') c where ac.id='current' and c->'badge'->>'id'=b)
      else b in ('badge1','badge2','badge3','badge4','badge5') end;
  -- Each completed lesson earns one draw, including previously completed lessons.
  -- Derive entitlement from progress, so revisiting the end screen never adds another ticket.
  select earned + count(*) into earned
    from jsonb_array_elements(coalesce(d->'lp','[]'::jsonb)) with ordinality as progress(value, idx)
    where idx <= coalesce((select jsonb_array_length(data->'lessons') from public.app_curriculum where id='current'),5)
      and value->>'quizDone' = 'true';
  select * into w from public.cabinet_wallets where student_id = p_student_id for update;
  if not found then
    legacy := '[]'::jsonb;
    for lp in select value from jsonb_array_elements(coalesce(d->'lp','[]'::jsonb)) loop
      for item in select value from jsonb_array_elements_text(
        case when jsonb_typeof(lp->'clawPrizes') = 'array' and jsonb_array_length(lp->'clawPrizes') > 0
          then lp->'clawPrizes'
          when coalesce(lp->>'clawPrize','') <> '' then jsonb_build_array(lp->>'clawPrize')
          else '[]'::jsonb end) limit 2 loop
        item := case item when 'น้องชวนคิด สีฟ้า' then 'Sky Blue'
          when 'น้องชวนคิด สีชมพู' then 'Strawberry Pink' when 'น้องชวนคิด สีเขียว' then 'Mint Green'
          when 'น้องชวนคิด สีเหลือง' then 'Sunny Yellow' when 'น้องชวนคิด สีม่วง' then 'Lavender' else item end;
        if item = any(catalog) then legacy := legacy || jsonb_build_array(item); end if;
      end loop;
    end loop;
    insert into public.cabinet_wallets(student_id,prizes) values(p_student_id,legacy) returning * into w;
  end if;
  if p_request_id is not null then
    picked := w.requests->>p_request_id::text;
    if picked is null then
      if jsonb_array_length(w.prizes) >= earned + w.bonus_tickets then raise exception 'No draw tickets remaining'; end if;
      select name into picked from unnest(catalog) name
        where not (w.prizes ? name) order by random() limit 1;
      if picked is null then picked := catalog[1 + floor(random()*array_length(catalog,1))::integer]; end if;
      update public.cabinet_wallets set prizes = prizes || jsonb_build_array(picked),
        requests = requests || jsonb_build_object(p_request_id::text,picked)
        where student_id = p_student_id returning * into w;
    end if;
  end if;
  return jsonb_build_object('studentId',p_student_id,'badgeCount',earned,
    'tickets',greatest(0,earned+w.bonus_tickets-jsonb_array_length(w.prizes)), 'owned',w.prizes,'prize',picked);
end;
$$;
revoke all on function public.cabinet_account(text,uuid) from public, anon;
grant execute on function public.cabinet_account(text,uuid) to authenticated;

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
    coalesce((select g->>'name' from public.app_curriculum ac cross join lateral jsonb_array_elements(ac.data->'modules'->'gems') g
      where ac.id='current' and (g->>'min')::integer<=star_count order by (g->>'min')::integer desc limit 1),
      case when star_count>=13 then 'Diamond' when star_count>=8 then 'Platinum' when star_count>=4 then 'Gold' else 'Silver' end),
    public.owns_student(student_id)
  from ranked
  order by position;
$$;

grant execute on function public.safe_leaderboard() to authenticated;

-- Backfill only derived ranking fields; preserve all progress and timestamps.
update public.students set rank_points=rank_points;
notify pgrst,'reload schema';
commit;
