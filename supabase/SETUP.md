# การเชื่อมฐานข้อมูล Supabase

## ตู้สุ่มที่ผูกกับบัญชีนักเรียน

รัน `../supabase-cabinet-wallet.sql` หลังติดตั้งระบบบัญชีหลายอุปกรณ์แล้ว และเผยแพร่ `public/cabinet-account.js` พร้อมไฟล์ HTML ทั้งสามชุดและ `public/ai-bot-random.html`

- 1 ตราสถานการณ์ (`badge1`–`badge5`) ให้ 1 สิทธิ์สุ่ม รางวัลไม่หักตราที่แสดงในความสำเร็จ
- ตาราง `cabinet_wallets` เก็บคอลเลกชันและประวัติคำขอแยกตาม `students.id`; เปลี่ยนรหัสนักเรียนแล้วข้อมูลย้ายตาม foreign key
- ฟังก์ชัน `cabinet_account` ตรวจ `owns_student` และล็อกแถวก่อนสุ่ม ป้องกันใช้สิทธิ์ซ้ำจากหลายอุปกรณ์ และคืนผลเดิมเมื่อส่ง request ID ซ้ำ
- เปิดตู้ภายในแอปที่เข้าสู่ระบบแล้ว ผลจะแสดงหลังฐานข้อมูลบันทึกสำเร็จ เปิดลิงก์ตู้โดยตรงต้องกลับไปเข้าสู่ระบบ ไม่มีเหรียญทดลองที่รีเซ็ตเอง
- คอลเลกชันเดิมใน `lp.clawPrizes` จะนำเข้าครั้งแรกต่อบัญชี ส่วนผลที่ไม่เคยบันทึกลงฐานข้อมูลจะไม่ถูกนำมาเพิ่มสิทธิ์
- หน้าแดชบอร์ดและตู้สุ่มตรวจข้อมูลใหม่ทุก 15 วินาทีขณะที่มองเห็น และเมื่อกลับมาโฟกัสแอป

ทดสอบหน้าเว็บด้วย `node tests/cabinet-client.test.cjs` และทดสอบ SQL ด้วย `tests/cabinet-db.test.cjs` (ต้องมีแพ็กเกจ `@electric-sql/pglite` ใน Node module path) การทดสอบใช้ฐานข้อมูลจำลอง ไม่แก้คะแนนของนักเรียนจริง

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

## เมนูครูที่บันทึกฐานข้อมูลจริง

ติดตั้ง `supabase-teacher-admin.sql` หลังไฟล์ PIN ครู, curriculum และ cabinet wallet
ตั้งชื่อ Query ว่า **เมนูครู — จัดการบัญชี ความคืบหน้า ตู้สุ่ม และเนื้อหา**
การติดตั้งเพิ่มฟังก์ชันและตัวตรวจข้อมูล ไม่เรียกการรีเซ็ตหรือลบนักเรียน

- `teacher_manage`: ตรวจ PIN และ session ก่อนทุกครั้ง จัดการบัญชี/รายชื่อ/ของสะสมในธุรกรรมเดียว แยกห้องจริงกับโหมดทดสอบ
- การเปลี่ยนรหัสย้าย student ID พร้อม session และ wallet ด้วย foreign-key cascade
- การแก้รายบุคคลตรวจเวอร์ชันข้อมูลและตู้สุ่ม ป้องกันเขียนทับกิจกรรมที่เพิ่งเกิดขึ้น; batch ที่ผิดพลาดยกเลิกทั้งชุด
- `_adminRevision` ป้องกันเครื่องนักเรียนส่งข้อมูลก่อนครูรีเซ็ตกลับมา; เครื่องที่เปิดอยู่ตรวจข้อมูลทุก 15 วินาที
- `teacher_save_curriculum` ใช้ `_key` ผูกผลเรียนกับบท/พรอมต์เดิม แม้เพิ่มหรือลบรายการ พร้อมคำนวณอันดับใหม่
- `teacher_audit` เก็บข้อมูลก่อนแก้/ลบ/รีเซ็ตไว้ตรวจสอบโดยผู้ดูแลฐานข้อมูล ไม่เปิดให้นักเรียนอ่าน และยังไม่มีหน้ากู้คืนอัตโนมัติ
- จำนวนดาวพรอมต์ 0–3; สิทธิ์ตู้สุ่ม = เหรียญภารกิจที่ยังอยู่ในหลักสูตร + สิทธิ์พิเศษ − จำนวนของสะสม

เข้าเมนูครู → **จัดการทุกหมวดในฐานข้อมูล** เพื่อแก้รายบุคคลหรือรีเซ็ตแยกหมวด
ใช้ **จัดการเนื้อหาทุกเมนู** เพื่อแก้/เพิ่ม/ลบเนื้อหา โดยต้องเหลือบทเรียน พรอมต์ ภารกิจ และข้อสอบอย่างน้อยหนึ่งรายการ
ปุ่มคืนค่าเดิมสร้างฉบับแก้ไข ต้องกด **บันทึกลงฐานข้อมูล** อีกครั้งจึงมีผล
ลิงก์ Google Sheet แก้ได้จากหมวดการเชื่อมต่อ แต่ผลบันทึก Apps Script แบบ no-cors ยังต้องตรวจในชีตเอง

ทดสอบ (ไม่มีการใช้งานบัญชีนักเรียนจริง):

```sh
node tests/cabinet-client.test.cjs
node tests/teacher-admin-client.test.cjs
NODE_PATH=/path/to/node_modules node tests/cabinet-db.test.cjs
NODE_PATH=/path/to/node_modules node tests/teacher-admin-db.test.cjs
```

การทดสอบฐานข้อมูลใช้ `@electric-sql/pglite` ในหน่วยความจำ ครอบคลุม PIN ผิด/ว่าง, CRUD, การย้ายบัญชี, ข้อมูลชนกัน, rollback, reset, สิทธิ์แยกบัญชี, เวอร์ชันเก่า, และการย้ายผลเรียนตามหลักสูตร

## Google Login — ทางเลือกเพิ่มเติมจากรหัสนักเรียน

แอปใช้ Supabase OAuth (PKCE) โดยไม่เก็บ Google Client Secret ในหน้าเว็บ
Google user ที่ยังไม่ผูกบัญชีต้องกรอกรหัสนักเรียนเดิมหนึ่งครั้งผ่าน `claim_student`.
`student_sessions.user_id` จะเชื่อมกับนักเรียนเดิม คะแนน/เหรียญ/ตู้สุ่มใช้แถวเดิมทั้งหมด.
ครั้งถัดไปโหลดเฉพาะนักเรียนที่ RLS `owns_student` อนุญาต ไม่ใช้การเทียบอีเมลหรือ ID จาก localStorage.
ไม่มี migration เพิ่มเติมสำหรับฟีเจอร์นี้.

### สิ่งที่เจ้าของ Google Cloud ต้องตั้งค่า

1. สร้าง OAuth Client แบบ Web application ใน Google Cloud / Google Auth Platform.
2. Authorized JavaScript origin: `https://dearchotirat40.github.io`.
3. Authorized redirect URI: `https://vpgndzdiwcnmnmipnith.supabase.co/auth/v1/callback`.
4. ตั้งค่า audience/consent ให้บัญชีนักเรียนเข้าใช้ได้จริง หากยังเป็น Testing ต้องเพิ่ม test users; ตรวจข้อจำกัด Google Workspace ของโรงเรียนด้วย.
5. ใน Supabase → Authentication → Sign In / Providers → Google ให้เจ้าของกรอก Client IDs และ Client Secret โดยตรง เปิด Enable Sign in with Google แล้ว Save. ไม่ส่ง secret ในแชตหรือ commit ลง Git.
6. Supabase → Authentication → URL Configuration เพิ่ม Redirect URL `https://dearchotirat40.github.io/aware-ai-guardian-academy/` และ `http://127.0.0.1:8765/` สำหรับทดสอบในเครื่อง (คงค่าเดิมที่ยังใช้งานไว้).
7. ทดสอบด้วยบัญชีนักเรียน: Google → กรอกรหัสเดิม → ตรวจคะแนน/ตู้สุ่ม → ออกจากระบบ → Google อีกครั้งต้องเข้าบัญชีเดิมได้.

สถานะตอนเพิ่มโค้ด: Google provider ยัง Disabled และยังไม่มี Client ID/Secret จึงยังยืนยัน OAuth แบบครบวงจรไม่ได้. ปุ่มจะแจ้งตามจริงเมื่อ provider ยังไม่พร้อม และรหัสนักเรียนยังใช้ได้.
อ้างอิง: https://supabase.com/docs/guides/auth/social-login/auth-google
