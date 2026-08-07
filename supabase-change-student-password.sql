-- Allow the currently signed-in student to change their classroom password.
-- Run once in Supabase Dashboard > SQL Editor.

create or replace function public.change_student_password(
  p_current_code text,
  p_new_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_code text := trim(coalesce(p_current_code, ''));
  v_new_code text := trim(coalesce(p_new_code, ''));
  v_old_id text;
  v_new_id text;
  v_data jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if v_new_code !~ '^[0-9A-Za-zก-๙_-]{4,20}$' then
    raise exception 'Invalid new password format';
  end if;

  select id, data
    into v_old_id, v_data
  from public.students
  where user_id = auth.uid()
    and coalesce(data->>'code', '') = v_current_code
  limit 1;

  if v_old_id is null then
    raise exception 'Current password is incorrect';
  end if;

  if v_new_code = v_current_code then
    raise exception 'New password must be different';
  end if;

  v_new_id := 'roster_' || v_new_code;
  if exists (
    select 1 from public.students
    where id = v_new_id
       or coalesce(data->>'code', '') = v_new_code
  ) then
    raise exception 'New password is already in use';
  end if;

  v_data := jsonb_set(v_data, '{code}', to_jsonb(v_new_code), true);
  v_data := jsonb_set(v_data, '{_updatedAt}', to_jsonb((extract(epoch from now()) * 1000)::bigint), true);

  update public.students
  set id = v_new_id,
      data = v_data,
      updated_at = (extract(epoch from now()) * 1000)::bigint
  where id = v_old_id
    and user_id = auth.uid();

  update public.app_settings
  set data = jsonb_set(
        data,
        '{items}',
        coalesce((
          select jsonb_agg(
            case
              when item->>'code' = v_current_code
                then jsonb_set(item, '{code}', to_jsonb(v_new_code), true)
              else item
            end
          )
          from jsonb_array_elements(coalesce(data->'items', '[]'::jsonb)) as item
        ), '[]'::jsonb),
        true
      ),
      updated_at = (extract(epoch from now()) * 1000)::bigint
  where id = 'roster';

  return jsonb_build_object('id', v_new_id, 'data', v_data);
end;
$$;

revoke all on function public.change_student_password(text, text) from public, anon;
grant execute on function public.change_student_password(text, text) to authenticated;
