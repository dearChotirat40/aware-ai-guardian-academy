-- ชื่อคำสั่ง: บทที่ 1 — คืนจุดประสงค์สถานการณ์ 1.1 และ 1.2

begin;

insert into public.teacher_audit(actor, action, before_data)
select auth.uid(), 'curriculum:restore-unit-one-objectives', data
from public.app_curriculum
where id = 'current';

update public.app_curriculum
set data = jsonb_set(
  jsonb_set(
    jsonb_set(data,
      '{lessons,0,situations,0,objective}',
      to_jsonb('อธิบายความหมายและจำแนกประเภทของ Generative AI ได้'::text), true),
    '{lessons,0,situations,1,objective}',
    to_jsonb('อธิบายหลักการทำงานเบื้องต้นของ Generative AI ได้'::text), true),
  '{lessons,0,unitOneStructureRevision}', '4'::jsonb, true),
  updated_at = (extract(epoch from now()) * 1000)::bigint
where id = 'current';

commit;
