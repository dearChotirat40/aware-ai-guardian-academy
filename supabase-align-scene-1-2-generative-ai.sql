-- ชื่อคำสั่ง: บทที่ 1.2 — หลักการทำงานเบื้องต้นของ Generative AI
-- ปรับชื่อ จุดเน้น กิจกรรม และเกร็ดความรู้ของสถานการณ์ 1.2 โดยเก็บสำเนาหลักสูตรเดิมก่อนแก้ไข

begin;

insert into public.teacher_audit(actor, action, before_data)
select auth.uid(), 'curriculum:align-scene-1.2-generative-ai', data
from public.app_curriculum
where id = 'current';

update public.app_curriculum
set data = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(data,
          '{lessons,0,situations,1,title}',
          to_jsonb('หลักการทำงานเบื้องต้นของ Generative AI'::text), true),
        '{lessons,0,situations,1,issue}',
        to_jsonb('Generative AI สร้างคำตอบใหม่อย่างไร และเหตุใดคำถามเดิมจึงให้คำตอบต่างกันได้'::text), true),
      '{lessons,0,situations,1,learning}',
      to_jsonb('Generative AI เรียนรู้รูปแบบจากข้อมูลจำนวนมาก เมื่อได้รับข้อความ ระบบจะแบ่งข้อความเป็นหน่วยย่อยที่เรียกว่า token แล้วคำนวณความน่าจะเป็นของ token ถัดไปจากบริบท กระบวนการนี้ทำซ้ำต่อเนื่องจนเป็นคำตอบ จึงสร้างคำตอบได้หลายแบบ แต่ไม่ได้หมายความว่าระบบเข้าใจหรือรับรองข้อเท็จจริงทุกข้อความ'::text), true),
    '{lessons,0,situations,1,activity}',
    to_jsonb('ทดลองถามข้อความเดิม 3 ครั้ง แล้วเติมประโยคเดิม 5 ครั้ง เปรียบเทียบผลเพื่อสังเกตการทำนาย token ถัดไปตามบริบท'::text), true),
  '{lessons,0,situations,1,contentRevision}', '3'::jsonb, true),
  updated_at = (extract(epoch from now()) * 1000)::bigint
where id = 'current';

commit;

select
  data #>> '{lessons,0,situations,1,title}' as title,
  data #>> '{lessons,0,situations,1,contentRevision}' as content_revision
from public.app_curriculum
where id = 'current';
