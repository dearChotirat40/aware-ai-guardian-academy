const assert=require('node:assert/strict');
(async()=>{
 const c=require('./teacher-test-runtime.cjs')();
 let tick, calls=0, resolveCurriculum, applied=0;
 c.setInterval=fn=>{tick=fn;return 1};c.clearInterval=()=>{};
 c.applyCurriculum=()=>{applied++;return false};c.saveDB=()=>{};
 const backend={saveStudent:async()=>{},loadCurriculum:async()=>null,loadAll:async()=>({students:{}}),watchStudents:()=>{}};
 c.onFirebaseReady(backend);await new Promise(r=>setImmediate(r));
 c.currentId='sample';c.state.view='lesson';
 backend.loadCurriculum=()=>{calls++;return new Promise(r=>{resolveCurriculum=r})};
 await tick();assert.equal(calls,0);assert.equal(c.state.view,'lesson');
 c.state.view='home';const pending=tick();assert.equal(calls,1);
 c.state.view='lesson';const baseline=applied;resolveCurriculum({updatedAt:9999999999999});await pending;
 assert.equal(applied,baseline);assert.equal(c.state.view,'lesson');
 console.log('PASS: active lesson defers background sync and ignores late curriculum response');
})().catch(e=>{console.error(e);process.exitCode=1});
