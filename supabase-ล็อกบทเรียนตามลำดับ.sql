-- ชื่อคำสั่ง: บทเรียน — เปิดทีละบทและผ่านโบนัสก่อนปลดล็อกบทถัดไป
begin;

update public.app_curriculum
set data = jsonb_set(
             jsonb_set(
               data,
               '{version}',
               '6'::jsonb,
               true
             ),
             '{lessons,0,flowSettings}',
             coalesce(data #> '{lessons,0,flowSettings}', '{}'::jsonb) || jsonb_build_object(
               'initialOpenLessons', 1,
               'requirePreviousCompletion', true,
               'requireBonusForNext', true
             ),
             true
           ),
    updated_at = timezone('utc', now())
where id = 'current';

commit;

select
  data->>'version' as "เวอร์ชันหลักสูตร",
  data #> '{lessons,0,flowSettings}' as "กติกาการปลดล็อกบทเรียน"
from public.app_curriculum
where id = 'current';
