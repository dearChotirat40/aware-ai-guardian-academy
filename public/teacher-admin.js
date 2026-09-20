/* Teacher actions commit to Supabase before changing the classroom shown locally. */
(function () {
  'use strict';
  var copy = function (v) { return JSON.parse(JSON.stringify(v)); };
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  function keyed(items, prefix) { return items.map(function (x,i) { x=copy(x); x._key=x._key || prefix+'-'+(i+1); return x; }); }
  var defaults = {
    version: CURRICULUM_VERSION, lessons:keyed(DEFAULT_LESSONS,'lesson'), videos:DEFAULT_VIDEO_LINKS.slice(),
    modules:{prompts:keyed(PROMPT_CHALLENGES,'prompt'),scenarios:keyed(scenarios,'scenario'),assessment:copy(ASSESSMENT_QUESTIONS),
      badges:copy(ACHIEVEMENT_BADGES),gems:copy(GEM_LEVELS),unitPoints:UNIT_POINTS,
      journey:{nodes:copy(JOURNEY_NODES),points:copy(JOURNEY_PTS),events:copy(JOURNEY_EVENTS)},
      sheet:{webAppUrl:GOOGLE_SHEET.webAppUrl || '',sheetUrl:GOOGLE_SHEET.sheetUrl || ''}}
  };
  var draftKey='awareai_teacher_content_drafts_v1', contentDrafts={};
  try{var storedDrafts=JSON.parse(localStorage.getItem(draftKey)||'null');if(storedDrafts&&storedDrafts.version===CURRICULUM_VERSION)contentDrafts=storedDrafts.items||{};}catch(e){}
  function storeDrafts(){try{localStorage.setItem(draftKey,JSON.stringify({version:CURRICULUM_VERSION,items:contentDrafts}));}catch(e){notice='เก็บฉบับร่างในเครื่องไม่ได้ กรุณาบันทึกลงฐานข้อมูลก่อนออก';}}
  function stageDraft(){if(edit&&edit.type==='content'){contentDrafts[edit.key]={value:copy(edit.value),base:copy(edit.base)};storeDrafts();}}
  function draftNotice(){return Object.keys(contentDrafts).length?'มีฉบับร่างรอบันทึก '+Object.keys(contentDrafts).length+' เมนู: '+Object.keys(contentDrafts).map(function(k){return moduleNames[k]||k;}).join(' · '):'ไม่มีฉบับร่างรอบันทึก';}
  var version = 0, wallets = {}, busy = false, notice = '', edit = null, paths = [];
  var moduleNames = {lessons:'บทเรียน สไลด์ สถานการณ์ในบท ข้อสอบ และสื่อ',prompts:'ฝึกเขียนพรอมต์',scenarios:'เกมภารกิจและเหรียญตรา',assessment:'แบบทดสอบก่อน–หลังเรียน',badges:'ตราสัญลักษณ์สะสม',gems:'ระดับอัญมณีและโบนัสอันดับ',unitPoints:'คะแนนเต็มต่อบทเรียน',journey:'แผนที่เส้นทางและข้อความรางวัล',sheet:'การเชื่อม Google Sheet'};
  var labels = {mediaType:'รูปแบบสื่อ (chat = แชท)',imageUrl:'ลิงก์ภาพสื่อสถานการณ์',imageAlt:'คำอธิบายภาพ',flowSettings:'การตั้งค่าฐาน',welcomeTitle:'ชื่อหน้าต้อนรับ',welcomeText:'ข้อความต้อนรับ',awardTitle:'ชื่อประกาศเกียรติคุณ',hintSeconds:'เวลารอก่อนแสดงปุ่มคำใบ้ (วินาที)',storyScenes:'ฉากเล่าเรื่อง',speaker:'ชื่อตัวละคร',activityData:'ข้อมูลกิจกรรม',groups:'ชื่อช่องสำหรับจัดหมวด',cards:'การ์ดกิจกรรม',maxAttempts:'จำนวนครั้งที่ตรวจได้ (0 = ไม่จำกัด)',passCount:'จำนวนการ์ดที่ต้องถูกเพื่อผ่าน',criteriaText:'ข้อความเกณฑ์ผ่านที่แสดงให้นักเรียน',trackWrongCards:'บันทึกการ์ดที่ตอบผิดในรายงานครู',prompt:'พรอมต์ที่ใช้ทดลอง',sentence:'ประโยคตั้งต้น',outputs:'ผลตัวอย่างจากการถามซ้ำ',words:'คำตัวอย่างสำหรับเติมประโยค',note:'คำแนะนำ',summary:'ข้อความสรุป AI จำลอง',sourceTitle:'ชื่อหน้าต้นทาง',published:'วันที่และข้อมูลที่เผยแพร่',comparison:'ข้อมูลสำหรับเปรียบเทียบ',question:'คำถามตรวจต้นทาง',options:'ตัวเลือกคำตอบ',correctValue:'คำตอบที่ถูกต้อง (ต้องตรงกับตัวเลือก)',success:'ข้อความเมื่อตอบถูก',retry:'ข้อความเมื่อให้ลองใหม่',videoUrl:'ลิงก์วิดีโอสถานการณ์ (เว้นว่างเพื่อใช้สื่อเล่าเรื่อง)',code:'รหัสเข้าสู่ระบบนักเรียน',num:'เลขที่',title:'ชื่อ / หัวข้อ',short:'ชื่อย่อ',mission:'ภารกิจ',simulation:'สถานการณ์จำลอง',videoDesc:'คำอธิบายวิดีโอ',slides:'สไลด์',quiz:'ข้อสอบ',situations:'สถานการณ์',media:'สื่อเพิ่มเติม',emoji:'อีโมจิ',text:'ข้อความ',q:'คำถาม',choices:'ตัวเลือก',answer:'เฉลย (เริ่มนับจาก 0)',hint:'คำใบ้',explain:'คำอธิบายเฉลย',url:'ลิงก์',type:'ประเภท',context:'บริบท',task:'งานที่ให้ทำ',thought:'คำถามชวนคิด',best:'ตัวเลือกที่เหมาะสม (เริ่มนับจาก 0)',category:'หมวด',character:'ตัวละคร',dialogue:'บทสนทนา',points:'คะแนน',feedback:'ข้อความตอบกลับ',badge:'เหรียญตรา',id:'รหัสรายการ',name:'ชื่อ',icon:'ไอคอน',color:'สี',isCorrect:'คำตอบถูก',mode:'รูปแบบกิจกรรม',level:'ระดับ',keywords:'คำสำคัญ',pieces:'ชิ้นส่วนพรอมต์',templateParts:'ส่วนของแม่แบบ',missingLabels:'หัวข้อช่องว่าง',missingPlaceholders:'ข้อความตัวอย่างในช่องว่าง',better:'ตัวอย่างคำตอบที่ดี',criterion:'เกณฑ์รับตรา',index:'ลำดับกิจกรรม (เริ่มนับจาก 0)',badgeId:'รหัสเหรียญภารกิจ',x:'ตำแหน่งรูปแนวนอน (0–3)',y:'ตำแหน่งรูปแนวตั้ง (0–2)',th:'ชื่อภาษาไทย',cls:'รูปแบบสี',min:'ดาวขั้นต่ำ',next:'ดาวระดับถัดไป',bonus:'โบนัสอันดับ',nodes:'จุดบนแผนที่',pointsMap:'พิกัด',events:'เหตุการณ์บนเส้นทาง',ic:'ไอคอน',lb:'ป้ายชื่อ',obstacle:'สิ่งที่ต้องทำ',reward:'ข้อความรางวัล',webAppUrl:'URL Apps Script ที่ลงท้าย /exec',sheetUrl:'URL Google Sheet',nickname:'ชื่อเล่น',lp:'ความคืบหน้ารายบท',pStars:'ดาวพรอมต์ (0–3)',assessments:'แบบทดสอบรวม',pre:'ก่อนเรียน',post:'หลังเรียน',done:'ทำแล้ว',score:'คะแนน',total:'คะแนนเต็ม',answers:'คำตอบ',chatQuestions:'คำถามที่ถามผู้ช่วย AI',question:'คำถาม',askedAt:'เวลาที่ถาม (มิลลิวินาที)',buddyAvatar:'บอตประจำตัว',preDone:'ทำก่อนเรียนแล้ว',preScore:'คะแนนก่อนเรียน',scenarioAnswered:'ตอบสถานการณ์แล้ว',scenarioChoice:'ตัวเลือกสถานการณ์ (-1 คือยังไม่ตอบ)',scenarioDone:'ผ่านสถานการณ์แล้ว',videoDone:'ดูวิดีโอแล้ว',slideSeen:'สไลด์ที่ดูแล้ว',slidesDone:'ดูสไลด์ครบ',quizAttempted:'ทำข้อสอบแล้ว',quizDone:'ผ่านข้อสอบแล้ว',postScore:'คะแนนหลังเรียน',postTotal:'คะแนนเต็มหลังเรียน',stars:'ดาว',date:'วันที่',at:'เวลา'};
  function snapshot() {
    return {version:CURRICULUM_VERSION,lessons:keyed(lessons,'lesson'),videos:VIDEO_LINKS.slice(),updatedAt:version,
      modules:{prompts:keyed(PROMPT_CHALLENGES,'prompt'),scenarios:keyed(scenarios,'scenario'),assessment:copy(ASSESSMENT_QUESTIONS),badges:copy(ACHIEVEMENT_BADGES),gems:copy(GEM_LEVELS),unitPoints:UNIT_POINTS,journey:{nodes:copy(JOURNEY_NODES),points:copy(JOURNEY_PTS),events:copy(JOURNEY_EVENTS)},sheet:copy(GOOGLE_SHEET)}};
  }
  window.curriculumSnapshot = snapshot;
  window.applyCurriculum = function (data) {
    if (!data || data.version !== CURRICULUM_VERSION || !Array.isArray(data.lessons) || !data.lessons.length) return false;
    lessons=keyed(data.lessons,'lesson');
    if (!lessons[0].unitOneRevision) ['title','mission','situations','simulation','quiz','unitOneRevision'].forEach(function(k){ lessons[0][k]=copy(defaults.lessons[0][k]); });
    enrichLessonCMS(lessons);
    VIDEO_LINKS=(data.videos || []).slice(); while(VIDEO_LINKS.length<lessons.length) VIDEO_LINKS.push('');
    var m=Object.assign(copy(defaults.modules),data.modules || {});
    PROMPT_CHALLENGES=keyed(m.prompts,'prompt'); scenarios=keyed(m.scenarios,'scenario'); ASSESSMENT_QUESTIONS=copy(m.assessment);
    ACHIEVEMENT_BADGES=copy(m.badges); GEM_LEVELS=copy(m.gems); UNIT_POINTS=Number(m.unitPoints);
    var journey=m.journey; JOURNEY_NODES=copy(journey.nodes); JOURNEY_PTS=copy(journey.points); JOURNEY_EVENTS=copy(journey.events);
    GOOGLE_SHEET=Object.assign({},GOOGLE_SHEET,m.sheet); version=Number(data.updatedAt)||0;
    return true;
  };
  function accept(data) {
    db.students=data.students || {}; db.roster=data.roster || []; db.rosterUpdatedAt=Date.now(); wallets=data.wallets || {};
    Object.keys(db.students).forEach(function(id){ sanitizeStudentRecord(db.students[id]); });
    saveDB(); firebaseStatus='ready';
  }
  async function run(work, message) {
    if (busy) return false;
    if (!firebaseBackend || !firebaseBackend.teacherManage) { alert('ยังเชื่อมต่อฐานข้อมูลไม่ได้ กรุณารอแล้วลองใหม่'); return false; }
    busy=true; notice='กำลังบันทึกในฐานข้อมูล…'; status();
    try { await work(); notice=message || 'บันทึกในฐานข้อมูลแล้ว'; return true; }
    catch(e) { notice='ยังบันทึกไม่สำเร็จ: '+String(e.message || e); alert(notice); return false; }
    finally { busy=false; status(); }
  }
  function status() {
    var el=document.getElementById('teacher-admin-status'); if(el) { el.textContent=notice; el.setAttribute('role','status'); }
    document.querySelectorAll('[data-admin-action],#teacher-admin-editor input,#teacher-admin-editor textarea,#teacher-admin-editor select').forEach(function(b){ b.disabled=busy; });
    document.querySelectorAll('[data-teacher-save-status]').forEach(function(el){el.textContent=(notice?notice+' · ':'')+draftNotice();});
  }
  function enrich(d) {
    sanitizeStudentRecord(d); d.lp=(d.lp || []).map(normalizeLessonProgress);
    d._rankStars=studentJourneyStars(d); d._rankBadges=earnedAchievementBadges(d).length; return d;
  }
  function operation(id,d,kind,extra) {
    d=enrich(copy(d)); return Object.assign({kind:kind || 'edit',id:id,data:d,points:rankPoints(d)},extra || {});
  }
  async function batch(ops, message) {
    return run(async function(){
      var result=await firebaseBackend.teacherManage('batch',{operations:ops});
      accept(result); state.teacherEditingRoster=null; state.teacherDetailId=null; edit=null; render();
    },message);
  }
  window.refreshTeacherSupabaseDashboard = async function () {
    if(edit && !confirm('โหลดใหม่และยกเลิกข้อความที่ยังไม่บันทึก?')) return;
    await run(async function(){
      var results=await Promise.all([firebaseBackend.teacherManage('load',{}),firebaseBackend.loadCurriculum()]);
      if(results[1]) {applyCurriculum(results[1]);saveCurriculumLocal();} accept(results[0]); edit=null; render();
    },'โหลดข้อมูลล่าสุดจากฐานข้อมูลแล้ว');
  };
  window.teacherSaveRosterStudent = async function () {
    var code=document.getElementById('tm-code').value.trim(),num=document.getElementById('tm-num').value.trim();
    if(!/^[0-9A-Za-zก-๙_-]{3,20}$/.test(code)) {alert('รหัสต้องมี 3–20 ตัว: ไทย อังกฤษ ตัวเลข _ หรือ -');return;}
    var idx=state.teacherEditingRoster,old=typeof idx==='number' && activeRoster()[idx];
    var id='roster_'+(old ? old.code:code),existing=db.students[id];
    if(activeRoster().some(function(r){return r.code===code && (!old || old.code!==code);})) {alert('รหัสนี้มีอยู่แล้ว');return;}
    var d=existing ? copy(existing):emptyStudentFromRoster({code:code,num:num});d.code=code;d.num=num;
    await batch([operation(id,d,existing?'edit':'create',existing?{expected:existing._updatedAt || 0}:{})],'บันทึกบัญชีและรหัสนักเรียนแล้ว');
  };
  window.teacherSetStudentPassword = async function () {
    var select=document.getElementById('admin-student-select'),input=document.getElementById('admin-new-password');
    var id=select&&select.value,newCode=(input&&input.value||'').trim(),student=id&&db.students[id];
    if(!student){alert('กรุณาเลือกบัญชีนักเรียน');return;}
    if(!/^[0-9A-Za-zก-๙_-]{4,20}$/.test(newCode)){alert('รหัสใหม่ต้องมี 4–20 ตัว ใช้ภาษาไทย อังกฤษ ตัวเลข _ หรือ -');return;}
    if(newCode===String(student.code||'')){alert('รหัสใหม่ต้องไม่ซ้ำกับรหัสเดิม');return;}
    if(db.students['roster_'+newCode]){alert('รหัสใหม่นี้มีบัญชีอื่นใช้อยู่แล้ว');return;}
    if(!confirm('ตั้งรหัสใหม่ให้ '+studentAlias(student)+' เป็น “'+newCode+'” ?\nคะแนน ชื่อเล่น ผลก่อนเรียน และของสะสมจะคงเดิม'))return;
    var updated=copy(student);updated.code=newCode;
    await batch([operation(id,updated,'edit',{expected:student._updatedAt||0})],'ตั้งรหัสใหม่แล้ว นักเรียนใช้รหัส '+newCode+' เข้าสู่ระบบได้ทันที');
  };
  window.teacherRemoveRosterStudent = function (index) {
    var r=activeRoster()[index]; if(!r || !confirm('ลบบัญชีรหัส '+r.code+' พร้อมความคืบหน้าและของสะสมจากฐานข้อมูล?')) return;
    return batch([{kind:'delete',id:'roster_'+r.code}],'ลบบัญชีจากฐานข้อมูลแล้ว');
  };
  function resetData(d,scope) {
    var fresh=emptyStudentFromRoster(d); fresh.nickname=d.nickname || '';d=copy(d);
    var keptPre=d.assessments && d.assessments.pre && d.assessments.pre.done ? copy(d.assessments.pre) : null;
    if(scope==='all') {
      d=Object.assign(d,fresh,{chatQuestions:[],buddyAvatar:''});
      if(keptPre) d.assessments.pre=keptPre;
    }
    if(scope==='lessons') d.lp=fresh.lp;
    if(scope==='prompts') d.pStars=fresh.pStars;
    if(scope==='assessments') d.assessments=fresh.assessments;
    if(scope==='badges') {d.badgeIds=[];d.score=0;d.unlockedLevel=0;}
    if(scope==='chat') d.chatQuestions=[];
    if(scope==='cabinet' || scope==='all') {
      d.buddyAvatar=''; d.lp=(d.lp || []).map(function(p){return Object.assign({},p,{clawPlayed:false,clawPrize:'',clawPlays:0,clawPrizes:[]});});
    }
    return d;
  }
  window.teacherAdminReset = function (scope, all) {
    var id=document.getElementById('admin-student-select');id=id && id.value;
    var ids=all?Object.keys(db.students):(id?[id]:[]);
    if(!ids.length){alert('ยังไม่มีนักเรียนให้จัดการ');return;}
    if(!confirm('รีเซ็ต '+scopeLabel(scope)+' ของ '+(all?'นักเรียนทุกคน ('+ids.length+' คน)':'บัญชีที่เลือก')+' ในฐานข้อมูล?'))return;
    var ops=ids.map(function(id){return operation(id,resetData(db.students[id],scope),'reset',Object.assign({scope:scope},scope==='all'?{wallet:{prizes:[],bonus_tickets:5}}:scope==='cabinet'?{wallet:{prizes:[],bonus_tickets:0}}:{}));});
    return batch(ops,'รีเซ็ต '+scopeLabel(scope)+' จำนวน '+ids.length+' บัญชีแล้ว');
  };
  var scopes={all:'ความคืบหน้าทั้งหมดและตู้สุ่ม',lessons:'บทเรียน คะแนน และดาว',prompts:'ผลฝึกพรอมต์',assessments:'แบบทดสอบก่อน–หลังเรียน',badges:'เหรียญภารกิจและคะแนนภารกิจ',cabinet:'ของสะสมและสิทธิ์พิเศษตู้สุ่ม',chat:'รายการคำถามเก่า (ก่อนระบบประวัติแชท)'};
  function scopeLabel(s){return scopes[s] || s;}
  window.teacherResetAllProgress=function(){return teacherAdminReset('all',true);};
  window.teacherResetRoster=function(){
    var ids=Object.keys(db.students);if(!ids.length)return;
    if(!confirm('ลบบัญชีทั้งหมด '+ids.length+' คน พร้อมผลเรียนและของสะสมจากฐานข้อมูล?'))return;
    return batch(ids.map(function(id){return {kind:'delete',id:id};}),'ลบบัญชีทั้งหมดแล้ว');
  };
  window.delStudent=function(id){
    if(!db.students[id] || !confirm('รีเซ็ตความคืบหน้าและตู้สุ่มของบัญชีนี้?'))return;
    return batch([operation(id,resetData(db.students[id],'all'),'reset',{wallet:{prizes:[],bonus_tickets:0}})],'รีเซ็ตบัญชีนี้แล้ว');
  };
  window.importRosterCSV=async function(input){
    var file=input && input.files && input.files[0];if(!file)return;
    try{
      var rows=parseRosterCSV(await file.text()),headers=(rows.shift() || []).map(function(v){return v.toLowerCase().replace(/[\s–—_()（）]/g,'');});
      function col(names){return headers.findIndex(function(h){return names.indexOf(h)!==-1;});}
      var ci=col(['เลขประจำตัวนักเรียน','รหัสประจำตัวนักเรียน','รหัสเข้าเรียน','รหัสผ่าน','studentid','id','code']),ni=col(['เลขที่','number','no']);
      if(ci<0 || !rows.length)throw new Error('ไฟล์ต้องมีคอลัมน์เลขประจำตัวนักเรียน และข้อมูลอย่างน้อย 1 คน');
      var seen={}; var ops=rows.map(function(row,i){
        var code=(row[ci] || '').trim();if(!/^[0-9A-Za-zก-๙_-]{3,20}$/.test(code) || seen[code])throw new Error('รหัสไม่ถูกต้องหรือซ้ำที่แถว '+(i+2));seen[code]=true;
        var id='roster_'+code,old=db.students[id],d=old?copy(old):emptyStudentFromRoster({code:code,num:''});d.num=ni<0?d.num:row[ni];
        return operation(id,d,old?'edit':'create',old?{expected:old._updatedAt || 0}:{});
      });
      await batch(ops,'นำเข้า '+ops.length+' บัญชีในฐานข้อมูลแล้ว');
    }catch(e){alert('ยังไม่นำเข้าข้อมูล: '+e.message);}finally{input.value='';}
  };
  function button(label,action,cls){return '<button type="button" data-admin-action class="btn '+(cls||'whiteb')+' sm" onclick="'+action+'">'+label+'</button>';}
  window.teacherJumpTo=function(id){var el=document.getElementById(id);if(el)el.scrollIntoView({behavior:'smooth',block:'start'});};
  function panel(){
    var count=Object.keys(db.students).length;
    return '<section class="pcard mint noprint teacher-control-center" id="teacher-admin-panel"><div class="teacher-control-head"><div><span class="teacher-eyebrow">TEACHER CONTROL</span><h2>🧑‍🏫 เมนูครู</h2><p>เลือกงานที่ต้องการได้ทันที · มีนักเรียนในฐานข้อมูล '+count+' บัญชี</p></div>'+button('↻ โหลดข้อมูลล่าสุด','refreshTeacherSupabaseDashboard()','whiteb')+'</div>'+
      '<div class="teacher-quick-grid">'+
        '<button type="button" class="teacher-quick report" onclick="openReportArchive(true)"><span>📊</span><b>รายงานทั้งหมด</b><small>ผลเรียน กิจกรรม แชท และรางวัล</small></button>'+
        '<button type="button" class="teacher-quick students" onclick="teacherJumpTo(\'teacher-roster-panel\')"><span>👥</span><b>จัดการนักเรียน</b><small>เพิ่ม แก้ไข และนำเข้ารายชื่อ</small></button>'+
        '<button type="button" class="teacher-quick content" onclick="teacherJumpTo(\'teacher-content-menu\')"><span>✏️</span><b>แก้เนื้อหา</b><small>บทเรียน สื่อ คำถาม และรางวัล</small></button>'+
        '<button type="button" class="teacher-quick criteria" onclick="teacherAdminUnitOneCriteria()"><span>🎯</span><b>เกณฑ์กิจกรรม 1.4</b><small>ข้อความ จำนวนข้อผ่าน และจำนวนครั้ง</small></button>'+
        '<button type="button" class="teacher-quick rewards" onclick="teacherJumpTo(\'teacher-reset-tools\')"><span>🔑</span><b>รหัสผ่านนักเรียน</b><small>ตั้งรหัสใหม่</small></button>'+
      '</div><p id="teacher-admin-status" class="teacher-save-status" role="status">'+esc(notice || 'ฐานข้อมูลพร้อมใช้งาน เลือกเมนูด้านบนได้เลย')+'</p>'+
      '<div id="teacher-reset-tools" class="teacher-tool-box"><h3>🔑 รหัสผ่านและรางวัล</h3><div class="teacher-tool-row"><label><span>เลือกบัญชี</span><select class="inp" id="admin-student-select">'+Object.keys(db.students).map(function(id){return '<option value="'+esc(id)+'">'+esc(studentAlias(db.students[id])+' · '+db.students[id].code)+'</option>';}).join('')+'</select></label>'+button('เปิดข้อมูลบัญชี','teacherAdminStudent()','blueb')+'</div>'+
      '<div class="teacher-tool-row teacher-password-reset"><label><span>ตั้งรหัสผ่านใหม่ให้นักเรียน</span><div class="password-wrap"><input id="admin-new-password" class="inp" type="password" minlength="4" maxlength="20" autocomplete="new-password" placeholder="รหัสใหม่ 4–20 ตัว"><button type="button" class="password-eye" aria-label="ดูรหัสผ่าน" aria-pressed="false" onclick="togglePasswordVisibility(\'admin-new-password\',this)">👁️</button></div></label>'+button('🔑 บันทึกรหัสใหม่','teacherSetStudentPassword()','blueb')+'</div></div><div id="teacher-admin-editor"></div></section>';
  }
  window.rewardCriteriaHtml=function(){return '<section class="pcard plain"><h3>เกณฑ์คะแนนและรางวัลปัจจุบัน</h3><p>บทเรียน '+lessons.length+' บท · คะแนนเต็มบทละ '+UNIT_POINTS+' · รวม '+maxLessonPoints()+' คะแนน</p><p>พรอมต์ '+PROMPT_CHALLENGES.length+' โจทย์ · โจทย์ละ 0–3 ดาว · ดาวพรอมต์ × 5 คะแนนอันดับ</p><p>ภารกิจ '+scenarios.length+' ด่าน · ด่านละ 2 คะแนนและ 1 เหรียญ · 1 เหรียญ = 1 สิทธิ์สุ่ม</p><p>เส้นทางรวม '+journeyTotal()+' ดาว · '+GEM_LEVELS.map(function(g){return esc(g.name)+' เริ่ม '+g.min+' ดาว โบนัส '+g.bonus;}).join(' · ')+'</p><p>เหรียญรายบท: ทอง 80% ขึ้นไป · เงิน 60–79% · ทองแดงต่ำกว่า 60%</p></section>';};
  var originalRender=window.renderTeacher;
  window.renderTeacher=function(){ originalRender();var host=document.querySelector('.body-area');if(host)host.insertAdjacentHTML('afterbegin',panel());if(edit)drawEditor();status();};
  window.teacherContentEditorHtml=function(){
    return '<section class="pcard blue noprint" id="teacher-content-menu" style="margin-bottom:20px"><h3>แก้ไขเนื้อหา</h3><div class="innerbox" style="padding:12px;margin:12px 0"><p data-teacher-save-status role="status">'+esc(draftNotice())+'</p>'+button('💾 บันทึกทุกเมนู','teacherAdminSaveAll()','mintb')+'</div><div style="display:flex;gap:8px;flex-wrap:wrap">'+Object.keys(moduleNames).map(function(k){return button(moduleNames[k],"teacherAdminContent('"+k+"')");}).join('')+'</div></section>';
  };
  function selectDraft(next){if(busy)return;if(edit&&edit.type==='student'&&!confirm('ข้อมูลนักเรียนยังเปิดแก้ไขอยู่ ยกเลิกการแก้ไขนี้แล้วเปิดเมนูใหม่?'))return;stageDraft();if(next.type==='content'&&contentDrafts[next.key]){next.value=copy(contentDrafts[next.key].value);next.base=copy(contentDrafts[next.key].base);}edit=next;drawEditor();var el=document.getElementById('teacher-admin-editor');if(el)el.scrollIntoView({behavior:'smooth',block:'start'});}
  window.teacherAdminContent=function(key){
    var s=snapshot();enrichLessonCMS(s.lessons);var value=key==='lessons'?s.lessons:s.modules[key];
    if(key==='lessons')value.forEach(function(l,i){l.video=VIDEO_LINKS[i] || '';l.media=l.media || [];(l.situations || []).forEach(function(s){s.videoUrl=s.videoUrl || '';});});
    selectDraft({type:'content',key:key,value:copy(value),base:s});
  };
  window.teacherAdminUnitOneCriteria=function(){
    var s=snapshot();enrichLessonCMS(s.lessons);
    var value=copy(s.lessons);value.forEach(function(l,i){l.video=VIDEO_LINKS[i] || '';l.media=l.media || [];});
    selectDraft({type:'content',key:'lessons',value:value,base:s,focus:'unit-one-criteria'});
  };
  window.teacherAdminCriteriaValue=function(key,input){
    if(busy||!edit||edit.key!=='lessons')return;
    var a=edit.value[0].situations[3].activityData;
    a[key]=input.type==='checkbox'?input.checked:(input.type==='number'?Number(input.value):input.value);
    stageDraft();status();
  };
  window.teacherAdminStudent=async function(){
    var id=document.getElementById('admin-student-select').value;if(!id)return;
    await run(async function(){
      accept(await firebaseBackend.teacherManage('load',{}));var s=db.students[id];if(!s)throw new Error('ไม่พบบัญชีนี้แล้ว');
      selectDraft({type:'student',id:id,base:copy(s),value:{code:s.code || id.replace(/^roster_/,''),num:s.num || '',nickname:s.nickname || '',lp:lessons.map(function(_,i){return normalizeLessonProgress((s.lp || [])[i]);}),pStars:PROMPT_CHALLENGES.map(function(_,i){return (s.pStars || [])[i] || 0;}),assessments:s.assessments || newAssessments(),chatQuestions:s.chatQuestions || [],buddyAvatar:s.buddyAvatar || ''},badges:(s.badgeIds || []).slice(),wallet:copy(wallets[id] || legacyWallet(s)),baseWallet:copy(wallets[id] || null)});
    },'โหลดข้อมูลบัญชีล่าสุดแล้ว');
  };
  function legacyWallet(s){
    var rename={'น้องชวนคิด สีฟ้า':'Sky Blue','น้องชวนคิด สีชมพู':'Strawberry Pink','น้องชวนคิด สีเขียว':'Mint Green','น้องชวนคิด สีเหลือง':'Sunny Yellow','น้องชวนคิด สีม่วง':'Lavender'};
    var prizes=(s.lp || []).flatMap(function(p){return (p.clawPrizes && p.clawPrizes.length?p.clawPrizes:p.clawPrize?[p.clawPrize]:[]).slice(0,2).map(function(n){return rename[n] || n;});}).filter(function(n){return botNames.indexOf(n)>=0;});
    return {prizes:prizes,bonus_tickets:0};
  }
  function pathIndex(path){paths.push(path);return paths.length-1;}
  function get(path){return path.reduce(function(v,k){return v[k];},edit.value);}
  function put(path,value){if(!path.length){edit.value=value;return;}var p=get(path.slice(0,-1));p[path[path.length-1]]=value;}
  function field(value,path,label){
    var id=pathIndex(path),key=String(path[path.length-1] || ''),html='';
    if(key==='contentRevision' || key==='unitOneRevision' || key==='unitOneFlow' || key==='_key' || /^claw/.test(key) || key==='justEarnedBadge' || key==='lastAwardedPoints')return '';
    if(Array.isArray(value)){
      var fixed=edit.type==='student' && ['lp','pStars'].indexOf(key)>=0;
      html='<details '+(!path.length?'open':'')+' class="innerbox" style="padding:10px;margin:8px 0"><summary><b>'+esc(label)+' ('+value.length+')</b></summary>';
      value.forEach(function(v,i){
        var title=(v && typeof v==='object' && (v.title || v.q || v.name)) || (key==='lp'?lessons[i].title:(key==='pStars'?PROMPT_CHALLENGES[i].title:'รายการ '+(i+1)));
        html+='<div style="border-left:3px solid #b7d9ed;padding:8px;margin:8px 0">'+field(v,path.concat(i),title)+(fixed?'':button('ลบรายการนี้',"teacherAdminArray("+id+",'remove',"+i+")",'pinkb'))+'</div>';
      });
      html+=(fixed?'':button('＋ เพิ่มรายการ',"teacherAdminArray("+id+",'add')",'mintb'))+'</details>';return html;
    }
    if(value && typeof value==='object'){
      return '<details class="innerbox" '+(!path.length?'open':'')+' style="padding:10px;margin:8px 0"><summary><b>'+esc(label)+'</b></summary>'+Object.keys(value).map(function(k){return field(value[k],path.concat(k),labels[k] || k);}).join('')+'</details>';
    }
    if(value===null)return '';
    var change='teacherAdminValue('+id+',this)';
    if(edit.type==='student' && key==='buddyAvatar')return '<label style="display:block;margin:12px 0">ตัวละครน้องชวนคิด<select class="inp" onchange="'+change+'"><option value="">น้องชวนคิดตัวเดิม</option>'+Array.from(new Set(edit.wallet.prizes)).map(function(n){return '<option value="'+esc(n)+'" '+(value===n?'selected':'')+'>'+esc(n)+'</option>';}).join('')+'</select></label>';
    if(typeof value==='boolean')return '<label style="display:block;margin:9px"><input type="checkbox" '+(value?'checked':'')+' onchange="'+change+'"> '+esc(label)+'</label>';
    html='<label style="display:block;margin:9px 0">'+esc(label);
    if(key==='videoUrl')html+='<input class="inp" type="url" placeholder="https://www.youtube.com/watch?v=…" style="width:100%" value="'+esc(value)+'" oninput="'+change+'">';
    else if(typeof value==='number')html+='<input class="inp" type="number" value="'+esc(value)+'" oninput="'+change+'">';
    else html+='<textarea class="inp" rows="'+(String(value).length>100?3:1)+'" style="width:100%;resize:vertical" oninput="'+change+'">'+esc(value)+'</textarea>';
    return html+'</label>';
  }
  function drawEditor(){
    var host=document.getElementById('teacher-admin-editor');if(!host)return;if(!edit){host.innerHTML='';return;}
    paths=[];var h='<h3 style="margin-top:16px">'+esc(edit.type==='student'?'แก้ข้อมูลบัญชี '+edit.base.code:moduleNames[edit.key])+'</h3><p class="soft tiny">การแก้ไขยังไม่ส่งถึงนักเรียนจนกดบันทึก</p><p data-teacher-save-status role="status">'+esc(draftNotice())+'</p>';
    if(edit.type==='content'&&edit.focus==='unit-one-criteria'){
      var criteria=edit.value[0].situations[3].activityData;
      h+='<section class="innerbox teacher-criteria-editor" style="padding:18px;margin:14px 0"><h3>🎯 เกณฑ์ผ่านกิจกรรม 1.4</h3>'+
        '<label style="display:block;margin:12px 0">ข้อความที่นักเรียนเห็น<textarea class="inp" rows="3" style="width:100%;resize:vertical" oninput="teacherAdminCriteriaValue(\'criteriaText\',this)">'+esc(criteria.criteriaText||'')+'</textarea></label>'+
        '<div class="teacher-tool-row"><label><span>ตอบถูกอย่างน้อยกี่ใบ</span><input class="inp" type="number" min="1" max="'+criteria.cards.length+'" value="'+esc(criteria.passCount)+'" oninput="teacherAdminCriteriaValue(\'passCount\',this)"></label>'+
        '<label><span>ตรวจได้กี่ครั้ง</span><input class="inp" type="number" min="1" max="100" value="'+esc(criteria.maxAttempts)+'" oninput="teacherAdminCriteriaValue(\'maxAttempts\',this)"></label></div>'+
        '<label style="display:block;margin:12px 0"><input type="checkbox" '+(criteria.trackWrongCards?'checked':'')+' onchange="teacherAdminCriteriaValue(\'trackWrongCards\',this)"> บันทึกการ์ดที่นักเรียนตอบผิดในรายงานครู</label>'+
        '<p class="soft small">กิจกรรมนี้มี '+criteria.cards.length+' การ์ด ระบบจะใช้ตัวเลขที่บันทึกเพื่อตรวจผ่านจริง</p></section>';
    } else if(edit.type==='student'){
      h+='<details open class="innerbox"><summary>เหรียญภารกิจ (มีผลต่อสิทธิ์สุ่ม)</summary>'+scenarios.map(function(sc,i){var b=sc.choices.find(function(c){return c.badge;}).badge;return '<label style="display:block;margin:8px"><input type="checkbox" '+(edit.badges.indexOf(b.id)>=0?'checked':'')+' onchange="teacherAdminBadge('+i+',this.checked)"> '+esc(b.name)+'</label>';}).join('')+'</details>';
      h+='<details open class="innerbox"><summary>ตู้สุ่มและของสะสม</summary><label>สิทธิ์พิเศษเพิ่มเติม <input class="inp" min="0" max="1000" type="number" value="'+edit.wallet.bonus_tickets+'" oninput="teacherAdminBonus(this.value)"></label><ul>'+edit.wallet.prizes.map(function(p,i){return '<li>'+esc(p)+' '+button('ลบ',"teacherAdminPrize('remove',"+i+")",'pinkb')+'</li>';}).join('')+'</ul><select class="inp" id="admin-prize">'+botNames.map(function(n){return '<option>'+esc(n)+'</option>';}).join('')+'</select>'+button('เพิ่มของสะสม',"teacherAdminPrize('add')",'mintb')+'</details>';
    }
    if(edit.type==='student') {
      h+='<div class="teacher-field-groups">'+Object.keys(edit.value).map(function(k){return '<section class="teacher-field-group">'+field(edit.value[k],[k],labels[k] || k)+'</section>';}).join('')+'</div>';
    } else if(edit.focus!=='unit-one-criteria') {
      if(edit.key==='lessons'){
        h+='<section class="innerbox" style="padding:18px;margin:16px 0"><h3>🎬 วิดีโอแยกสถานการณ์ · ทุกฐาน</h3><p>วางลิงก์ YouTube, Google Drive หรือไฟล์ .mp4 / .webm (https://) แล้วกด “บันทึกลงฐานข้อมูล” เพื่อบันทึกทุกฐานในครั้งเดียว</p><p class="soft small">เว้นว่างเพื่อใส่คลิปภายหลัง · ขยายรายการบทเรียนด้านล่างเพื่อแก้เนื้อเรื่อง กิจกรรม คำถาม เฉลย คำใบ้ และ Did you know?</p>';
        edit.value.forEach(function(l,li){h+='<details '+(li===0?'open':'')+'><summary>'+esc(l.title)+'</summary>';(l.situations || []).forEach(function(s,i){h+=field(s.videoUrl,[li,'situations',i,'videoUrl'],s.id+' '+s.title);});h+='</details>';});
        h+='</section>';
      }
      h+=field(edit.value,[],moduleNames[edit.key]);
    }
    h+='<div style="display:flex;gap:8px;flex-wrap:wrap;margin:14px 0">'+button('บันทึกลงฐานข้อมูล','teacherAdminSave()','mintb')+(edit.type==='content'?button('💾 บันทึกทุกเมนูที่แก้ไข','teacherAdminSaveAll()','blueb'):'')+button('ยกเลิก','teacherAdminCancel()')+(edit.type==='content'?button('คืนค่าเดิมของหมวดนี้',"teacherAdminDefault()",'pinkb'):'')+'</div>';
    host.innerHTML=h;status();
  }
  var botNames=['Sky Blue','Strawberry Pink','Mint Green','Sunny Yellow','Lavender','Peach Orange','Ocean Teal','Chocolate Brown','Cloud White','Rainbow Pastel','Rainbow Secret'];
  window.teacherAdminValue=function(i,input){if(busy)return;var old=get(paths[i]);put(paths[i],typeof old==='boolean'?input.checked:typeof old==='number'?Number(input.value):input.value);stageDraft();status();};
  window.teacherAdminBadge=function(i,checked){var id=scenarios[i].choices.find(function(c){return c.badge;}).badge.id;edit.badges=edit.badges.filter(function(b){return b!==id;});if(checked)edit.badges.push(id);};
  window.teacherAdminBonus=function(value){edit.wallet.bonus_tickets=Number(value);};
  window.teacherAdminPrize=function(action,i){if(action==='add')edit.wallet.prizes.push(document.getElementById('admin-prize').value);else edit.wallet.prizes.splice(i,1);drawEditor();};
  window.teacherAdminCancel=function(){if(busy)return;if(edit&&edit.type==='content'){delete contentDrafts[edit.key];storeDrafts();}edit=null;drawEditor();status();};
  window.teacherAdminDefault=function(){if(!confirm('คืนค่าเริ่มต้นของหมวดนี้ในฉบับแก้ไข? ต้องกดบันทึกอีกครั้งจึงมีผล'))return;edit.value=copy(edit.key==='lessons'?defaults.lessons:defaults.modules[edit.key]);if(edit.key==='lessons')edit.value.forEach(function(l,i){l.video=defaults.videos[i] || '';l.media=l.media || [];(l.situations || []).forEach(function(s){s.videoUrl=s.videoUrl || '';});});stageDraft();drawEditor();};
  window.teacherAdminArray=function(i,action,n){
    var path=paths[i],arr=get(path);if(!Array.isArray(arr))return;
    if(action==='remove')arr.splice(n,1);
    else{
      var sample=arr[0];
      if(sample===undefined){
        var k=path[path.length-1];sample=k==='media'?{title:'สื่อใหม่',type:'ลิงก์',url:'https://'}:k==='chatQuestions'?{question:'คำถามใหม่',askedAt:Date.now()}:k==='slides'?{emoji:'📚',title:'สไลด์ใหม่',text:'เนื้อหา'}:k==='quiz'?{q:'คำถามใหม่',choices:['ตัวเลือก 1','ตัวเลือก 2'],answer:0,hint:'',explain:''}:'';
        if(!path.length && edit.type==='content')sample=(edit.key==='lessons'?defaults.lessons:defaults.modules[edit.key])[0];
      }
      var v=copy(sample);
      if(v && typeof v==='object' && !Array.isArray(v)){
        if(v._key)v._key=edit.key+'-'+crypto.randomUUID();
        if(v.id)v.id='item-'+crypto.randomUUID();
        if(v.title)v.title='รายการใหม่ · '+v.title;
        if(!path.length && edit.key==='scenarios')v.choices.forEach(function(c){if(c.badge)c.badge.id='badge-'+crypto.randomUUID();});
      }
      arr.push(v);
    }
    stageDraft();drawEditor();
  };
  function checkNumbers(v){if(typeof v==='number' && !Number.isFinite(v))throw new Error('ตัวเลขไม่ถูกต้อง');if(v && typeof v==='object')Object.values(v).forEach(checkNumbers);}
  function assert(ok,message){if(!ok)throw new Error(message);}
  function validate(c){
    var m=c.modules;checkNumbers(c);
    var unit=c.lessons[0];
    if(unit && unit.unitOneRevision){
      assert(unit.situations.length===4 && unit.quiz.length===8,'ฐานที่ 1 ใช้ 4 สถานการณ์และ 8 คำถาม กรุณาแก้เนื้อหาโดยคงจำนวนรายการ');
      assert(unit.flowSettings && unit.flowSettings.welcomeTitle && unit.flowSettings.awardTitle && Number.isFinite(unit.flowSettings.hintSeconds) && unit.flowSettings.hintSeconds>=1 && unit.flowSettings.hintSeconds<=3600,'กรอกชื่อฐาน ชื่อประกาศ และเวลาคำใบ้ 1–3600 วินาที');
      unit.situations.forEach(function(s,i){
        assert(Array.isArray(s.storyScenes)&&s.storyScenes.length>0&&s.storyScenes.every(function(x){return x.speaker&&x.text&&x.emoji;}),'ฉากเล่าเรื่องต้องมีตัวละคร บทพูด และอีโมจิ');
        var a=s.activityData;assert(a,'ข้อมูลกิจกรรมไม่ครบ');
        if(i===0||i===3){assert(Array.isArray(a.groups)&&a.groups.length>0&&a.groups.every(function(x){return typeof x==='string'&&x.trim();})&&Array.isArray(a.cards)&&a.cards.length>0,'กรอกชื่อช่องและการ์ดกิจกรรม');assert(Number.isInteger(a.maxAttempts)&&a.maxAttempts>=0&&a.maxAttempts<=100,'จำนวนครั้งที่ตรวจได้ต้องอยู่ระหว่าง 0–100');if(i===3){assert(Number.isInteger(a.passCount)&&a.passCount>=1&&a.passCount<=a.cards.length,'จำนวนการ์ดที่ต้องถูกต้องอยู่ระหว่าง 1 ถึงจำนวนการ์ดทั้งหมด');assert(typeof a.criteriaText==='string'&&a.criteriaText.trim(),'กรอกข้อความเกณฑ์ผ่านที่แสดงให้นักเรียน');}a.cards.forEach(function(x){assert(x.text&&Number.isInteger(x.answer)&&x.answer>=0&&x.answer<a.groups.length,'เฉลยการ์ดต้องอ้างถึงหมายเลขช่องที่มีอยู่ เริ่มนับจาก 0');});}
        if(i===1)assert(a.prompt&&a.sentence&&Array.isArray(a.outputs)&&a.outputs.length>0&&a.outputs.every(function(x){return typeof x==='string'&&x.trim();})&&Array.isArray(a.words)&&a.words.length>0&&a.words.every(function(x){return typeof x==='string'&&x.trim();}),'กรอกพรอมต์ ประโยค ผลตัวอย่าง และคำเติมให้ครบ');
        if(i===2)assert(a.summary&&a.sourceTitle&&a.published&&a.question&&Array.isArray(a.options)&&a.options.length>=2&&a.options.indexOf(a.correctValue)>=0,'แหล่งข้อมูลจำลองต้องมีข้อความ วันที่ คำถาม และเฉลยที่ตรงกับตัวเลือก');
      });
    }

    c.lessons.forEach(function(l){(l.situations || []).forEach(function(s){s.videoUrl=String(s.videoUrl || '').trim();assert(!s.videoUrl || unitOneVideoSource(s.videoUrl),'วิดีโอ '+(s.id || '')+': ใช้ลิงก์ YouTube, Google Drive หรือไฟล์ .mp4 / .webm แบบ https:// หรือเว้นว่าง');});});
    assert(c.lessons.length>0 && c.lessons.length<=30,'ต้องมีบทเรียน 1–30 บท');
    function questions(list){assert(Array.isArray(list)&&list.length>0,'ต้องมีข้อสอบอย่างน้อย 1 ข้อ');list.forEach(function(q){assert(q.q && Array.isArray(q.choices)&&q.choices.length>=2&&Number.isInteger(q.answer)&&q.answer>=0&&q.answer<q.choices.length,'ตรวจคำถาม ตัวเลือก และหมายเลขเฉลย');});}
    c.lessons.forEach(function(l){assert(l.title && l.short && Array.isArray(l.slides)&&l.slides.length && l.simulation && l.simulation.context,'บทเรียนต้องมีชื่อ ชื่อย่อ สไลด์ และสถานการณ์');questions(l.quiz);(l.media || []).forEach(function(x){assert(/^https:\/\//.test(x.url),'สื่อต้องใช้ลิงก์ https://');});});
    assert(m.prompts.length>0 && m.prompts.length<=30,'ต้องมีพรอมต์ 1–30 รายการ');
    m.prompts.forEach(function(p){assert(p.title&&p.mode&&Array.isArray(p.keywords),'ข้อมูลพรอมต์ไม่ครบ');});
    assert(m.scenarios.length>0 && m.scenarios.length<=30,'ต้องมีภารกิจ 1–30 ด่าน');var ids=[];
    m.scenarios.forEach(function(sc){assert(sc.title&&Array.isArray(sc.choices)&&sc.choices.length>=2,'ภารกิจต้องมีชื่อและตัวเลือกอย่างน้อย 2 ข้อ');var rewards=sc.choices.filter(function(c){return c.isCorrect&&c.badge;});assert(rewards.length===1,'แต่ละภารกิจต้องมีคำตอบถูกพร้อมเหรียญ 1 ข้อ');sc.choices.forEach(function(c){assert(!c.badge||c.isCorrect,'เหรียญต้องอยู่กับคำตอบถูกเท่านั้น');if(c.isCorrect)c.points=2;});var id=rewards[0].badge.id;assert(id&&ids.indexOf(id)<0,'รหัสเหรียญต้องไม่ซ้ำกัน');ids.push(id);});
    questions(m.assessment);assert(m.gems.length>0 && m.gems.some(function(g){return g.min===0;}),'อัญมณีต้องมีระดับเริ่มต้น 0 ดาว');
    m.gems.sort(function(a,b){return a.min-b.min;});m.gems.forEach(function(g){assert(g.name && g.min>=0 && g.bonus>=0 && ['silver','gold','platinum','diamond'].indexOf(g.cls)>=0,'ข้อมูลระดับอัญมณีไม่ถูกต้อง');});
    assert(Number.isInteger(m.unitPoints)&&m.unitPoints>0&&m.unitPoints<=100,'คะแนนต่อบทต้องเป็นจำนวนเต็ม 1–100');
    var seen={};m.badges.forEach(function(b){assert(b.id&&!seen[b.id],'รหัสตราสะสมต้องไม่ซ้ำ');seen[b.id]=true;assert(['pre','lesson','prompt','scenario'].indexOf(b.type)>=0,'ประเภทตราต้องเป็น pre, lesson, prompt หรือ scenario');if(b.type==='lesson'||b.type==='prompt')assert(Number.isInteger(b.index)&&b.index>=0&&b.index<(b.type==='lesson'?c.lessons:m.prompts).length,'ตราสะสมอ้างถึงกิจกรรมที่ไม่มีอยู่');if(b.type==='scenario')assert(ids.indexOf(b.badgeId)>=0,'ตราสะสมอ้างถึงเหรียญภารกิจที่ไม่มีอยู่');assert(b.x>=0&&b.x<=3&&b.y>=0&&b.y<=2,'พิกัดภาพตราไม่ถูกต้อง');});
    var total=c.lessons.length+m.prompts.length+m.scenarios.length;
    assert(m.journey.nodes.length===total+1&&m.journey.points.length===total+1&&m.journey.events.length===total+1,'แผนที่ต้องมีจุดและเหตุการณ์ '+(total+1)+' รายการตามจำนวนภารกิจ');
    m.journey.points.forEach(function(p){assert(p.length===2&&p.every(function(n){return Number.isFinite(n)&&n>=0&&n<=100;}),'พิกัดแผนที่ต้องเป็น x,y ระหว่าง 0–100');});
    assert(!m.sheet.webAppUrl || /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(m.sheet.webAppUrl),'Apps Script ต้องเป็น URL Web app ที่ลงท้าย /exec');
    assert(!m.sheet.sheetUrl || /^https:\/\/docs\.google\.com\/spreadsheets\//.test(m.sheet.sheetUrl),'ลิงก์ชีตต้องมาจาก docs.google.com/spreadsheets');
  }
  function align(c,previous){
    ['lesson','prompt'].forEach(function(type){var old=type==='lesson'?previous.lessons:previous.modules.prompts,now=type==='lesson'?c.lessons:c.modules.prompts;
      c.modules.badges=c.modules.badges.filter(function(b){if(b.type!==type)return true;var key=old[b.index] && old[b.index]._key;var i=now.findIndex(function(x){return x._key===key;});if(i<0)return false;b.index=i;return true;});
    });
    var badgeIds=c.modules.scenarios.flatMap(function(sc){return sc.choices.filter(function(ch){return ch.badge;}).map(function(ch){return ch.badge.id;});});
    c.modules.badges=c.modules.badges.filter(function(b){return b.type!=='scenario'||badgeIds.indexOf(b.badgeId)>=0;});
    var total=c.lessons.length+c.modules.prompts.length+c.modules.scenarios.length,j=c.modules.journey;
    if(total!==previous.lessons.length+previous.modules.prompts.length+previous.modules.scenarios.length){
      j.nodes=Array.from({length:total+1},function(_,i){return {ic:i===0?'🏠':i===total?'🏆':'⭐',lb:i===0?'เริ่มต้น':'ภารกิจ '+i};});
      j.points=j.nodes.map(function(_,i){return [10+(i%5)*20,15+Math.floor(i/5)*70/Math.max(1,Math.floor(total/5))];});
      j.events=j.nodes.map(function(_,i){return {title:'เส้นทาง '+i+'/'+total,obstacle:'ทำกิจกรรมเพื่อสะสมดาว',reward:'ดาวสะสม '+i+'/'+total};});
      c.modules.gems.forEach(function(g){if(g.min===previous.lessons.length+previous.modules.prompts.length+previous.modules.scenarios.length)g.min=total;if(g.next>total)g.next=total;});
    }
  }
  window.teacherAdminSave=async function(){
    if(!edit||busy)return;
    if(edit.type==='student'){
      try{
        checkNumbers(edit.value);assert(/^[0-9A-Za-zก-๙_-]{3,20}$/.test(edit.value.code),'รหัสต้องมี 3–20 ตัว: ไทย อังกฤษ ตัวเลข _ หรือ -');assert(!edit.value.nickname||cleanNickname(edit.value.nickname),'ชื่อเล่นต้องมี 2–20 ตัวอักษร');
        assert(edit.value.pStars.every(function(n){return Number.isInteger(n)&&n>=0&&n<=3;}),'ดาวพรอมต์ต้องเป็นจำนวนเต็ม 0–3');
        edit.value.lp.forEach(function(p){assert(p.postScore>=0&&p.postTotal>=0&&p.postScore<=p.postTotal,'คะแนนหลังเรียนต้องไม่เกินคะแนนเต็ม');});
        assert(Number.isInteger(edit.wallet.bonus_tickets)&&edit.wallet.bonus_tickets>=0&&edit.wallet.bonus_tickets<=1000,'สิทธิ์พิเศษต้องเป็นจำนวนเต็ม 0–1000');
        assert(!edit.value.buddyAvatar||edit.wallet.prizes.indexOf(edit.value.buddyAvatar)>=0,'บอตประจำตัวต้องเป็นของสะสมที่บัญชีนี้มี');
        var d=Object.assign(copy(edit.base),copy(edit.value),{badgeIds:edit.badges.slice(),score:edit.badges.length*2,unlockedLevel:edit.badges.length});
        var extra={expected:edit.base._updatedAt || 0};
        if(JSON.stringify(edit.wallet)!==JSON.stringify(edit.baseWallet || legacyWallet(edit.base))) {extra.wallet=edit.wallet;extra.expectedWallet=edit.baseWallet;}
        await batch([operation(edit.id,d,'edit',extra)],'บันทึกผลเรียน เหรียญ และตู้สุ่มแล้ว');
      }catch(e){alert('ตรวจข้อมูลก่อนบันทึก: '+e.message);}return;
    }
    stageDraft();return saveContentDrafts([edit.key]);
  };
  function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object'){var out={};Object.keys(value).sort().forEach(function(k){out[k]=canonical(value[k]);});return out;}return value;}
  function matchesSaved(a,b){return JSON.stringify(canonical(a))===JSON.stringify(canonical(b));}
  async function saveContentDrafts(keys){
    if(!keys.length){notice='ไม่มีรายการแก้ไขที่ต้องบันทึก';status();return false;}
    return run(async function(){
      var baseline=contentDrafts[keys[0]].base,c=copy(baseline);
      keys.forEach(function(key){var draft=contentDrafts[key];assert((draft.base.updatedAt||0)===(baseline.updatedAt||0),'ฉบับร่างมาจากคนละรุ่น กรุณาบันทึกแยกเมนูและตรวจข้อมูลล่าสุด');
        if(key==='lessons'){c.lessons=copy(draft.value);c.videos=c.lessons.map(function(l){var v=l.video||'';delete l.video;return v;});}
        else c.modules[key]=copy(draft.value);
      });
      align(c,baseline);validate(c);c.baseUpdatedAt=baseline.updatedAt||0;c.previous=defaults;
      await firebaseBackend.saveCurriculum(c);
      var results=await Promise.all([firebaseBackend.loadCurriculum(),firebaseBackend.teacherManage('load',{})]);
      assert(results[0]&&keys.every(function(key){return key==='lessons'?matchesSaved(c.lessons,results[0].lessons)&&matchesSaved(c.videos,results[0].videos):matchesSaved(c.modules[key],(results[0].modules||{})[key]);}),'ข้อมูลที่โหลดกลับไม่ตรงกับฉบับที่ส่ง ยังเก็บฉบับร่างไว้ กรุณาโหลดข้อมูลล่าสุดเพื่อตรวจสอบ');
      assert(results[0]&&applyCurriculum(results[0]),'ส่งข้อมูลแล้ว แต่ยังยืนยันฉบับที่บันทึกไม่ได้ กรุณาโหลดข้อมูลล่าสุดก่อนลองอีกครั้ง');
      saveCurriculumLocal();accept(results[1]);keys.forEach(function(key){delete contentDrafts[key];});
      // Rebase remaining drafts only when their original base matches this successful save.
      Object.keys(contentDrafts).forEach(function(key){if((contentDrafts[key].base.updatedAt||0)===(baseline.updatedAt||0))contentDrafts[key].base=snapshot();});
      storeDrafts();if(edit&&edit.type==='content'&&keys.indexOf(edit.key)>=0)edit=null;render();
    },'บันทึกและโหลดกลับจากฐานข้อมูลแล้ว '+keys.length+' เมนู');
  }
  window.teacherAdminSaveAll=function(){if(busy)return;if(edit&&edit.type==='student'){alert('กรุณาบันทึกข้อมูลนักเรียนด้วยปุ่มบันทึกในฟอร์มก่อนบันทึกเนื้อหาทุกเมนู');return;}stageDraft();return saveContentDrafts(Object.keys(contentDrafts));};
  // Disable the obsolete fire-and-forget content handlers for cached UI events.
  window.saveTeacherLessonContent=function(){teacherAdminContent('lessons');};
  window.resetTeacherLessonContent=function(){teacherAdminContent('lessons');};

  // A teacher reset outranks a later browser timestamp. Apply all live state together.
  var originalMerge=window.mergeFirebaseStudents;
  window.mergeFirebaseStudents=function(remote){
    var active=currentId,reset=active&&remote[active]&&Number(remote[active]._adminRevision || 0)>Number((db.students[active] || {})._adminRevision || 0);
    if(reset){clearTimeout(firebaseStudentTimer);db.students[active]=copy(remote[active]);saveDB();applyStudent(active);state.view='dashboard';notice='ข้อมูลได้รับการแก้ไขโดยครู';}
    return originalMerge(remote)||!!reset;
  };
  var studentSyncTimer=null;
  var studentSyncBusy=false;
  function learningInProgress(){return ['lesson','quiz','quizresult','assessment','assessmentresult','promptwork','chat','scenario','feedback'].indexOf(state.view)!==-1;}
  var previousReady=window.onFirebaseReady;
  window.onFirebaseReady=function(backend){
    var save=backend.saveStudent;
    backend.saveStudent=function(id,data){return save(id,data).catch(async function(e){
      if(/ADMIN_CHANGED|40001/.test(String(e.message || e))){var latest=await backend.loadAll();mergeFirebaseStudents(latest.students || {});render();alert('คุณครูแก้ไขข้อมูลบัญชีนี้แล้ว โหลดข้อมูลล่าสุดให้แล้ว กรุณาทำรายการใหม่');}throw e;
    });};
    previousReady(backend);
    if(studentSyncTimer)clearInterval(studentSyncTimer);
    studentSyncTimer=setInterval(async function(){
      if(studentSyncBusy || learningInProgress() || document.hidden || busy || state.view==='teacher' || !currentId)return;
      studentSyncBusy=true;
      var syncAccount=currentId;
      try{
        var c=await backend.loadCurriculum();
        if(currentId!==syncAccount || learningInProgress())return;if(c && Number(c.updatedAt)>version){clearTimeout(firebaseStudentTimer);applyCurriculum(c);saveCurriculumLocal();var all=await backend.loadAll();if(currentId!==syncAccount || learningInProgress())return;mergeFirebaseStudents(all.students || {});if(all.students[currentId])applyStudent(currentId);render();}
        else {var cloud=await backend.loadAll();if(currentId!==syncAccount || learningInProgress())return;if(!cloud.students[currentId]){clearTimeout(firebaseStudentTimer);currentId=null;state.view='login';db.students={};saveDB();render();}else if(mergeFirebaseStudents(cloud.students)){if(['lesson','quiz','assessment','promptwork','chat','scenario'].indexOf(state.view)===-1)render();else updateRankStrip();}}
      }catch(e){/* Retry on the next interval; never send cached data as recovery. */}finally{studentSyncBusy=false;}
    },15000);
  };
  window.teacherAdminTest={validate:validate,align:align,defaults:copy(defaults),resetData:resetData};
})();
