const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
(async()=>{
 const c=require('./teacher-test-runtime.cjs')(),copy=v=>JSON.parse(JSON.stringify(v));
 c.elements['teacher-admin-editor']={innerHTML:'',scrollIntoView(){}};
 const keys=['lessons','prompts','scenarios','assessment','badges','gems','unitPoints','journey','sheet'];
 const initial=c.curriculumSnapshot();let writes=0,stored=copy(initial),fail=true;
 c.firebaseBackend={saveCurriculum:async data=>{writes++;if(fail)throw Error('offline test');stored=copy(data);stored.updatedAt=10;},loadCurriculum:async()=>copy(stored),teacherManage:async()=>({students:{},roster:[]})};
 for(const key of keys)c.teacherAdminContent(key);
 // A numeric field in the current menu gets staged through the same handler as the UI.
 c.teacherAdminContent('unitPoints');let html=c.elements['teacher-admin-editor'].innerHTML;
 let match=html.match(/type="number"[^>]+oninput="teacherAdminValue\((\d+),this\)"/);assert(match);c.teacherAdminValue(+match[1],{value:'6'});
 c.teacherAdminContent('lessons');html=c.elements['teacher-admin-editor'].innerHTML;
 match=html.match(/type="url"[^>]+oninput="teacherAdminValue\((\d+),this\)"/);c.teacherAdminValue(+match[1],{value:'https://example.com/saved.mp4'});
 await c.teacherAdminSaveAll();assert.equal(writes,1);assert.equal(c.UNIT_POINTS,4);assert(c.alerts.at(-1).includes('offline test'));
 const draft=JSON.parse(c.localStorage.getItem('awareai_teacher_content_drafts_v1'));assert.equal(Object.keys(draft.items).length,9);assert.equal(draft.items.unitPoints.value,6);
 // Re-create the controller to model closing/reopening the teacher page.
 vm.runInContext(fs.readFileSync('public/teacher-admin.js','utf8'),c);
 c.teacherAdminContent('unitPoints');assert.match(c.elements['teacher-admin-editor'].innerHTML,/value="6"/);
 fail=false;await c.teacherAdminSaveAll();assert.equal(writes,2);assert.equal(c.UNIT_POINTS,6);assert.equal(c.lessons[0].situations[0].videoUrl,'https://example.com/saved.mp4');
 assert.equal(Object.keys(JSON.parse(c.localStorage.getItem('awareai_teacher_content_drafts_v1')).items).length,0);
 assert.deepEqual(copy(stored.modules.scenarios),copy(initial.modules.scenarios));
 // Never report success/clear a draft when the reload returns stale content.
 c.teacherAdminContent('unitPoints');html=c.elements['teacher-admin-editor'].innerHTML;match=html.match(/type="number"[^>]+oninput="teacherAdminValue\((\d+),this\)"/);c.teacherAdminValue(+match[1],{value:'7'});
 c.firebaseBackend.saveCurriculum=async()=>{};await c.teacherAdminSaveAll();assert.equal(c.UNIT_POINTS,6);assert(c.alerts.at(-1).includes('ไม่ตรง'));assert.equal(JSON.parse(c.localStorage.getItem('awareai_teacher_content_drafts_v1')).items.unitPoints.value,7);
 console.log('PASS: all nine menus staged, failed save retains drafts, reopen restores edits, one save persists all, stale readback cannot claim success');
})().catch(e=>{console.error(e);process.exitCode=1;});
