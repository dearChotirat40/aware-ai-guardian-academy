(function(){
 'use strict';
 var page=0, selected=null, currentReport=null, saving=false, generation=0;
 function esc(v){return escChat(String(v == null ? '' : v)).replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
 function date(v){return new Date(v).toLocaleString('th-TH');}
 function status(text){var e=document.getElementById('report-status');if(e)e.textContent=text;}
 function host(){return document.getElementById('report-content');}
 window.closeReportArchive=function(){generation++;var e=document.getElementById('report-archive');if(e)e.remove();currentReport=null;};
 window.openReportArchive=async function(teacher){
  if(!firebaseBackend)return;
  closeReportArchive();page=0;selected=teacher?null:currentId;
  var panel=document.createElement('section');panel.id='report-archive';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','รายงานรายบุคคล');panel.style.cssText='position:fixed;inset:0;z-index:10010;background:#fffdf5;overflow:auto;padding:24px';
  var select=teacher?'<label>เลือกนักเรียน <select class="inp" onchange="selectReportStudent(this.value)"><option value="">ทุกคน รวมรายงานบัญชีที่ถูกลบ</option>'+Object.keys(db.students).map(function(id){return '<option value="'+esc(id)+'">'+esc(studentAlias(db.students[id]))+'</option>';}).join('')+'</select></label>':'';
  panel.innerHTML='<div style="max-width:960px;margin:auto"><button class="btn whiteb sm" onclick="closeReportArchive()">ปิด ×</button><h2>📁 รายงานรายบุคคล</h2><p>ฉบับล่าสุดบันทึกอัตโนมัติ ส่วนฉบับที่ส่งครูเก็บย้อนหลังโดยไม่ทับกัน</p>'+select+'<p id="report-status" role="status"></p><div id="report-content"></div></div>';
  document.body.appendChild(panel);await loadReports();
 };
 window.selectReportStudent=function(id){selected=id||null;page=0;loadReports();};
 window.reportPage=function(delta){page=Math.max(0,page+delta);loadReports();};
 async function loadReports(){
  var ticket=++generation;currentReport=null;status('กำลังโหลดรายงาน…');
  try{var data=await firebaseBackend.reportArchive(selected,false,null,page*50);if(ticket!==generation||!host())return;
   var items=data.items||[];status('หน้า '+(page+1)+' · '+items.length+' รายงาน');
   host().innerHTML=items.map(function(r){return '<article class="innerbox" style="margin:12px 0"><b>'+esc(r.nickname||('นักเรียนเลขที่ '+(r.num||'-')))+'</b><p>'+esc(date(r.created_at))+' · '+(r.automatic?'ฉบับล่าสุดอัตโนมัติ':'ฉบับที่ส่งครู')+'</p><button class="btn blueb sm" onclick="viewSavedReport(\''+r.id+'\')">เปิดรายงาน</button></article>';}).join('')+(items.length?'':'<p>ยังไม่มีรายงานในหน้านี้</p>')+'<button class="btn whiteb sm" onclick="reportPage(-1)" '+(page?'':'disabled')+'>ก่อนหน้า</button> <button class="btn whiteb sm" onclick="reportPage(1)" '+(items.length===50?'':'disabled')+'>ถัดไป</button>';
  }catch(e){if(ticket===generation)status('โหลดรายงานไม่สำเร็จ กรุณาเข้าสู่ระบบใหม่หรือลองอีกครั้ง');}
 }
 window.viewSavedReport=async function(id){
  var ticket=++generation;status('กำลังโหลดรายละเอียด…');
  try{var r=await firebaseBackend.reportArchive(selected,false,id,0);if(ticket!==generation||!host())return;currentReport=r;var x=r.snapshot||{},s=x.student||{},a=s.assessments||{},w=x.cabinet||{};
   function section(title,items){return '<details open style="margin:18px 0"><summary><b>'+title+'</b></summary>'+items+'</details>';}
   var lp=(s.lp||[]).map(function(p,i){return '<article class="innerbox"><b>บทที่ '+(i+1)+'</b><p>ข้อสอบ: '+(p.quizDone?'ทำแล้ว':'ยังไม่เสร็จ')+' · คะแนน '+esc(p.postScore||0)+'/'+esc(p.postTotal||0)+' · ดาว '+esc(p.stars||0)+'</p><details><summary>รายละเอียดกิจกรรมทั้งหมด</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere">'+esc(JSON.stringify(p,null,2))+'</pre></details></article>';}).join('');
   var chats=(x.chat||[]).map(function(m){return '<article class="innerbox" style="margin:8px 0"><b>'+ (m.role==='user'?'นักเรียน':'น้องชวนคิด')+'</b> · '+esc(date(m.createdAt))+(m.offline?' · คำตอบสำรอง':'')+'<p style="white-space:pre-wrap">'+esc(m.content)+'</p></article>';}).join('');
   host().innerHTML='<button class="btn whiteb sm" onclick="reportPage(0)">← รายการรายงาน</button> <button class="btn blueb sm" onclick="downloadSavedReport()">ดาวน์โหลดข้อมูลครบถ้วน (.json)</button><h3>'+esc(s.nickname||('นักเรียนเลขที่ '+(s.num||'-')))+'</h3><p>บันทึกเมื่อ '+esc(date(r.created_at))+'</p>'+section('🧭 แบบทดสอบก่อน–หลังเรียน',['pre','post'].map(function(k){var v=a[k]||{};return '<p>'+(k==='pre'?'ก่อนเรียน':'หลังเรียน')+': '+(v.done?esc(v.score)+'/'+esc(v.total):'ยังไม่ทำ')+'</p>';}).join(''))+section('📚 บทเรียน',lp||'<p>ยังไม่มีผลบทเรียน</p>')+section('✍️ พรอมต์',(s.pStars||[]).map(function(n,i){return '<p>โจทย์ '+(i+1)+': '+esc(n)+'/3 ดาว</p>';}).join('')||'<p>ยังไม่มีผลพรอมต์</p>')+section('🏅 ภารกิจและเหรียญตรา','<p>คะแนนภารกิจ '+esc(s.score||0)+' · เหรียญ '+esc((s.badgeIds||[]).join(', ')||'ยังไม่มี')+'</p>')+section('🤖 ตัวละครและตู้สุ่ม','<p>ตัวละครที่ใช้: '+esc(s.buddyAvatar||'น้องชวนคิดตัวเดิม')+'</p><p>ของสะสม: '+esc((w.prizes||[]).join(', ')||'ยังไม่มี')+'</p><p>สิทธิ์สุ่มเพิ่มเติม: '+esc(w.bonusTickets||0)+'</p>')+section('💬 ประวัติสนทนาทั้งหมด ณ เวลาบันทึก',chats||'<p>ยังไม่มีประวัติสนทนา</p>');status(r.automatic?'ข้อมูลล่าสุดที่ระบบบันทึก':'รายงานย้อนหลัง ณ เวลาส่ง');
  }catch(e){if(ticket===generation)status('เปิดรายงานไม่สำเร็จ กรุณาลองใหม่');}
 };
 window.downloadSavedReport=function(){if(!currentReport)return;var u=URL.createObjectURL(new Blob([JSON.stringify(currentReport,null,2)],{type:'application/json'}));var a=document.createElement('a');a.href=u;a.download='student-report-'+currentReport.id+'.json';a.click();setTimeout(function(){URL.revokeObjectURL(u);},1000);};
 window.submitStudentReport=async function(){
  if(saving||!currentId||!firebaseBackend)return;saving=true;var id=currentId;var e=document.getElementById('student-report-status');if(e)e.textContent='กำลังบันทึกและส่งรายงาน…';
  try{saveProgress();clearTimeout(firebaseStudentTimer);await firebaseBackend.saveStudent(id,db.students[id]);await firebaseBackend.reportArchive(id,true,null,0);if(currentId===id&&e)e.textContent='ส่งรายงานแล้ว ครูเปิดดูในคลังรายงานได้ทันที';}
  catch(err){if(e)e.textContent='ยังส่งรายงานไม่สำเร็จ กรุณาลองใหม่';}finally{saving=false;}
 };
 window.renderSendReport=function(){appEl.innerHTML='<div class="hdr"><h2>📄 ส่งรายงานให้ครู</h2><button class="btn whiteb sm" onclick="changeView(\'dashboard\')">กลับความคืบหน้า</button></div><div class="body-area"><section class="pcard mint"><h3>รายงานของฉัน</h3><p>รวมบทเรียน แบบทดสอบ พรอมต์ เหรียญตรา ของสะสม ตัวละคร และประวัติสนทนาที่บันทึกไว้ทั้งหมด</p><p>ข้อมูลล่าสุดเก็บอัตโนมัติ กดส่งเพื่อเก็บฉบับรายงานย้อนหลังให้ครู</p><p id="student-report-status" role="status"></p><button class="btn pinkb" onclick="submitStudentReport()">ส่งรายงานและเก็บฉบับย้อนหลัง</button> <button class="btn whiteb" onclick="openReportArchive(false)">ดูรายงานของฉัน</button></section></div>';};
 var oldLogout=logout; logout=function(){closeReportArchive();return oldLogout();};
 var oldApply=applyStudent; applyStudent=function(id){if(id!==currentId)closeReportArchive();return oldApply(id);};
 var teacherRender=renderTeacher;
 renderTeacher=function(){teacherRender();var h=document.querySelector('.body-area');if(h)h.insertAdjacentHTML('afterbegin','<section class="pcard blue" style="margin-bottom:16px"><h3>📁 คลังรายงานรายบุคคล</h3><p>ข้อมูลล่าสุดของทุกคนและรายงานย้อนหลัง รวมประวัติสนทนา</p><button class="btn blueb" onclick="openReportArchive(true)">เปิดรายงานนักเรียนทุกคน</button></section>');};
}());
