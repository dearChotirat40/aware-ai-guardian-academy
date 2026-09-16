-- Account-scoped cabinet ledger. Existing lesson prizes are imported once.
begin;
create table if not exists public.cabinet_wallets (
  student_id text primary key references public.students(id) on update cascade on delete cascade,
  prizes jsonb not null default '[]'::jsonb,
  requests jsonb not null default '{}'::jsonb
);
alter table public.cabinet_wallets enable row level security;
revoke all on public.cabinet_wallets from public, anon, authenticated;

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
    where b in ('badge1','badge2','badge3','badge4','badge5');
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
      if jsonb_array_length(w.prizes) >= earned then raise exception 'No draw tickets remaining'; end if;
      select name into picked from unnest(catalog) name
        where not (w.prizes ? name) order by random() limit 1;
      if picked is null then picked := catalog[1 + floor(random()*array_length(catalog,1))::integer]; end if;
      update public.cabinet_wallets set prizes = prizes || jsonb_build_array(picked),
        requests = requests || jsonb_build_object(p_request_id::text,picked)
        where student_id = p_student_id returning * into w;
    end if;
  end if;
  return jsonb_build_object('studentId',p_student_id,'badgeCount',earned,
    'tickets',greatest(0,earned-jsonb_array_length(w.prizes)), 'owned',w.prizes,'prize',picked);
end;
$$;
revoke all on function public.cabinet_account(text,uuid) from public, anon;
grant execute on function public.cabinet_account(text,uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
