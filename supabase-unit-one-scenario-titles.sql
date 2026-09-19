-- ชื่อคำสั่ง: บทที่ 1 — ชื่อสถานการณ์ก่อนและจุดประสงค์ด้านล่าง

begin;

insert into public.teacher_audit(actor, action, before_data)
select auth.uid(), 'curriculum:unit-one-scenario-titles', data
from public.app_curriculum
where id = 'current';

update public.app_curriculum
set data = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(data, '{lessons,0,situations,0,title}', to_jsonb('แอปไหนคือ AI กันแน่'::text), true),
        '{lessons,0,situations,1,title}', to_jsonb('ถามเหมือนเดิม แต่ตอบไม่เหมือนเดิม'::text), true),
      '{lessons,0,situations,2,title}', to_jsonb('ถามแชทบอท หรือพิมพ์ค้นหา ต่างกันตรงไหน'::text), true),
    '{lessons,0,situations,3,title}', to_jsonb('หนังสือที่ไม่มีในห้องสมุด'::text), true),
  '{lessons,0,unitOneStructureRevision}', '2'::jsonb, true),
  updated_at = (extract(epoch from now()) * 1000)::bigint
where id = 'current';

commit;

select data #> '{lessons,0,situations}' as unit_one_situations
from public.app_curriculum
where id = 'current';
