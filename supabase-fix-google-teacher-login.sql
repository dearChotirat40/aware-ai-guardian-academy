-- ชื่อคำสั่ง: เข้าสู่ระบบครู — แก้อีเมล Google ให้ตรงบัญชี
begin;

create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((auth.jwt()->>'is_anonymous')::boolean, true) is false
    and lower(coalesce(auth.jwt()->>'email', '')) = 'cpaenthai@gmail.com';
$$;

grant execute on function public.is_teacher() to authenticated;
notify pgrst, 'reload schema';

commit;
