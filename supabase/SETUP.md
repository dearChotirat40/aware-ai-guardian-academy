# การเชื่อมฐานข้อมูล Supabase

หน้าเว็บตั้งค่าโปรเจกต์ Supabase และ Google Sheet ไว้แล้วในตัวแปร `SUPABASE_CONFIG` และ `GOOGLE_SHEET` ของไฟล์เว็บทั้งสามชุด (`index.html`, `aware-ai-guardian-academy.html`, และ `public/index.html`) โดยใช้ Supabase เป็นฐานข้อมูลกลางของบัญชี ความคืบหน้า อันดับ และเนื้อหา ส่วน Google Sheet รับเฉพาะรายงานความคืบหน้าของนักเรียน

## Supabase (ตั้งค่าครั้งเดียว)

สำหรับโปรเจกต์ใหม่ ให้รัน SQL ใน Supabase Dashboard > SQL Editor ตามลำดับนี้ โดยรันทีละไฟล์และตรวจว่าไม่มีข้อผิดพลาดก่อนทำไฟล์ถัดไป:

1. `../supabase-schema.sql` — สร้างตาราง `students` และ `app_settings`
2. `../supabase-secure-auth.sql` — เปลี่ยนจากสิทธิ์ชั่วคราวเป็นการยืนยันตัวตนนักเรียนและสิทธิ์ครู
3. `../supabase-teacher-pin.sql` — สร้างฟังก์ชันรายงานครู แล้วรัน `select public.configure_teacher_pin('รหัสครูที่เป็นส่วนตัว');` ใน SQL Editor
4. `../supabase-multi-device-login.sql` — ให้รหัสนักเรียนใช้ได้หลายอุปกรณ์
5. `../supabase-nickname-privacy.sql` — เก็บเฉพาะเลขประจำตัว เลขที่ และชื่อเล่นที่นักเรียนตั้งเอง
6. `../supabase-change-student-password.sql` — เปิดให้เปลี่ยนรหัสผ่าน
7. `../supabase-curriculum-setup.sql` — ให้ครูแก้สื่อ/เนื้อหาแล้วส่งถึงผู้เรียน
8. `../supabase-align-rewards.sql` — จัดคะแนน ดาว เหรียญ และอันดับให้ตรงกับหน้าเว็บ

จากนั้นตั้งค่า Secret สำหรับผู้ช่วย AI:

```text
GEMINI_API_KEY = คีย์ Gemini ของคุณ
GEMINI_MODEL = gemini-2.5-flash
```

แล้ว deploy Edge Function:

```bash
supabase functions deploy super-function
```

ห้ามวาง Gemini API key ไว้ใน HTML หรือ GitHub — คีย์ต้องอยู่ใน Supabase Secrets เท่านั้น

## Google Sheet (รับเฉพาะรายงานนักเรียน)

1. เปิด Google Sheet ที่จะใช้รายงาน แล้วเลือก **ส่วนขยาย > Apps Script**
2. วางโค้ดจาก `../google-apps-script/Code.gs`
3. Deploy เป็น **Web app** โดยเลือก Execute as: **Me** และ Who has access: **Anyone**
4. คัดลอก URL ที่ลงท้ายด้วย `/exec` แล้วใส่ที่ `GOOGLE_SHEET.webAppUrl` หากสร้างชีตใหม่

เว็บจะส่งรายงานขึ้นแถวเดิมโดยใช้เลขประจำตัวนักเรียนเป็นกุญแจ จึงไม่สร้างแถวซ้ำ และการเปิด URL `/exec` ด้วยเบราว์เซอร์จะแสดงสถานะ `ok` แทนข้อผิดพลาดจากการกด Run `doPost` ตรง ๆ
