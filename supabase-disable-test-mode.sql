-- Return the app to the preserved real roster.
-- Test accounts remain stored but are excluded from the production leaderboard.

update public.app_settings
set
  data=jsonb_set(coalesce(data,'{}'::jsonb),'{enabled}','false'::jsonb,true),
  updated_at=extract(epoch from now())::bigint*1000
where id='test_mode';

-- Release only the temporary test accounts from test devices.
update public.students
set user_id=null
where coalesce((data->>'_testAccount')::boolean,false)=true;

notify pgrst,'reload schema';
