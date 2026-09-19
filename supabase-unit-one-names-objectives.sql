-- ชื่อคำสั่ง: บทที่ 1 — ตั้งชื่อสถานการณ์และจุดประสงค์การเรียนรู้
-- ใช้ข้อมูลจากตารางหัวข้อย่อยและจุดประสงค์การเรียนรู้ของหน่วยที่ 1

begin;

insert into public.teacher_audit(actor, action, before_data)
select auth.uid(), 'curriculum:unit-one-names-objectives', data
from public.app_curriculum
where id = 'current';

update public.app_curriculum
set data = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                jsonb_set(data, '{lessons,0,situations,0,title}', to_jsonb('ความหมายและประเภทของ AI'::text), true),
                '{lessons,0,situations,0,objective}', to_jsonb('อธิบายความหมายและจำแนกประเภทของ Generative AI ได้'::text), true),
              '{lessons,0,situations,1,title}', to_jsonb('หลักการทำงานเบื้องต้นของ Generative AI'::text), true),
            '{lessons,0,situations,1,objective}', to_jsonb('อธิบายหลักการทำงานเบื้องต้นของ Generative AI ได้'::text), true),
          '{lessons,0,situations,2,title}', to_jsonb('ความแตกต่างระหว่าง AI กับเครื่องมือค้นหา'::text), true),
        '{lessons,0,situations,2,objective}', to_jsonb('เปรียบเทียบความแตกต่างระหว่าง Generative AI กับเครื่องมือค้นหาได้'::text), true),
      '{lessons,0,situations,3,title}', to_jsonb('ข้อจำกัดของ AI'::text), true),
    '{lessons,0,situations,3,objective}', to_jsonb('ระบุข้อจำกัดของ AI พร้อมยกตัวอย่างสถานการณ์ได้'::text), true),
  '{lessons,0,unitOneStructureRevision}', '1'::jsonb, true),
  updated_at = (extract(epoch from now()) * 1000)::bigint
where id = 'current';

commit;

select
  data #>> '{lessons,0,situations,0,title}' as situation_1_1,
  data #>> '{lessons,0,situations,1,title}' as situation_1_2,
  data #>> '{lessons,0,situations,2,title}' as situation_1_3,
  data #>> '{lessons,0,situations,3,title}' as situation_1_4
from public.app_curriculum
where id = 'current';
