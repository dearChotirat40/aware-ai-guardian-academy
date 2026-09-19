-- Add the official live air-quality source to scenario 1.3.
-- Student progress, rewards and teacher-authored content are preserved.
begin;

insert into public.teacher_audit(actor, action, before_data)
select auth.uid(), 'curriculum:add-real-source-1.3', data
from public.app_curriculum
where id = 'current';

update public.app_curriculum
set data = jsonb_set(
      jsonb_set(
        jsonb_set(
          data,
          '{lessons,0,situations,2,activityData,realSourceUrl}',
          to_jsonb('https://air4thai.pcd.go.th/'::text),
          true
        ),
        '{lessons,0,situations,2,activityData,realSourceLabel}',
        to_jsonb('Air4Thai · กรมควบคุมมลพิษ'::text),
        true
      ),
      '{lessons,0,situations,2,activityData,realSourceTask}',
      to_jsonb('เปิดข้อมูลจริง แล้วตรวจชื่อสถานี วันที่ และค่า PM2.5 ล่าสุดก่อนกลับมาตอบ ตัวเลขจริงเปลี่ยนตามเวลาและอาจไม่เท่ากับตัวเลขจำลองในเรื่อง'::text),
      true
    ),
    updated_at = (extract(epoch from now()) * 1000)::bigint
where id = 'current';

commit;

select
  data #>> '{lessons,0,situations,2,activityData,realSourceUrl}' as source_url,
  data #>> '{lessons,0,situations,2,activityData,realSourceLabel}' as source_label
from public.app_curriculum
where id = 'current';
