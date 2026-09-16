const assert=require('node:assert/strict');const runtime=require('./teacher-test-runtime.cjs');
(async()=>{
 const c=runtime(),copy=v=>JSON.parse(JSON.stringify(v));const d=c.teacherAdminTest.defaults;
 c.teacherAdminTest.validate(d);
 let cfg=copy(d),prev=copy(d);cfg.lessons.splice(1,1);cfg.modules.prompts.reverse();c.teacherAdminTest.align(cfg,prev);c.teacherAdminTest.validate(cfg);
 assert.equal(cfg.modules.badges.find(b=>b.id==='lesson3').index,1);assert(!cfg.modules.badges.some(b=>b.id==='lesson2'));
 assert.equal(cfg.modules.journey.nodes.length,cfg.lessons.length+cfg.modules.prompts.length+cfg.modules.scenarios.length+1);
 cfg.modules.scenarios[0].choices.find(x=>x.badge).badge.id='same';cfg.modules.scenarios[1].choices.find(x=>x.badge).badge.id='same';assert.throws(()=>c.teacherAdminTest.validate(cfg),/รหัสเหรียญ/);
 c.applyCurriculum(d);let stu=c.emptyStudentFromRoster({code:'alice',num:'1'});stu.badgeIds=['badge3'];stu.score=10;stu.unlockedLevel=5;c.sanitizeStudentRecord(stu);assert.deepEqual(copy(stu.badgeIds),['badge3']);
 let reset=c.teacherAdminTest.resetData(stu,'badges');c.sanitizeStudentRecord(reset);assert.equal(reset.badgeIds.length,0);assert.equal(reset.score,0);
 c.db={students:{roster_alice:stu},roster:[{code:'alice',num:'1'}]};c.saveDB();
 c.elements['tm-code']={value:'alice2'};c.elements['tm-num']={value:'2'};c.state.teacherEditingRoster=0;
 c.firebaseBackend={teacherManage:async()=>{throw new Error('offline')}};
 const before=copy(c.db);await c.teacherSaveRosterStudent();assert.deepEqual(copy(c.db),before);assert(c.alerts.at(-1).includes('offline'));
 let sent;let release;let pending=new Promise(resolve=>release=resolve);c.firebaseBackend.teacherManage=async(a,p)=>{sent={a,p};await pending;return {students:{roster_alice2:{...stu,code:'alice2',num:'2'}},roster:[{code:'alice2',num:'2'}]};};
 const save=c.teacherSaveRosterStudent();await c.teacherSaveRosterStudent();assert.equal(sent.p.operations.length,1);assert(c.db.students.roster_alice,'must wait for server confirmation');release();await save;assert(c.db.students.roster_alice2);assert(!c.db.students.roster_alice);
 assert.equal(sent.p.operations[0].id,'roster_alice');assert.equal(sent.p.operations[0].data.code,'alice2');
 console.log('PASS: module defaults, add/delete alignment, badge identity, scoped resets, offline rejection, wait for commit, duplicate-click lock, atomic rename payload');
})().catch(e=>{console.error(e);process.exit(1)});
