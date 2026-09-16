const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function runtime(backend) {
 const status={textContent:''};
 const c={window:null,renderLogin(){},logout(){},onFirebaseReady(){},document:{getElementById(){return status},querySelector(){return null}},firebaseBackend:backend,render(){},state:{view:'login'},db:{students:{stale:{}}},currentId:null,applyStudent(id){c.currentId=id},saveDB(){},changeView(v){c.state.view=v},hasNickname(s){return !!s.nickname},saveProgress(){},alert(){},location:{origin:'https://school.example',pathname:'/app/',replace(url){c.replaced=url}}};
 c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync('public/google-login.js','utf8'),c);return {c,status};
}
const tick=()=>new Promise(r=>setImmediate(r));
test('Google resumes only server-authorized student and discards stale cached account',async()=>{
 const b={isGoogle:true,loadAll:async()=>({students:{roster_123:{nickname:'star'}}})};const {c}=runtime(b);c.onFirebaseReady(b);await tick();assert.equal(c.currentId,'roster_123');assert.equal(c.state.view,'home');assert.deepEqual(Object.keys(c.db.students),['roster_123']);
});
test('unlinked Google account stays at code-link screen',async()=>{
 const b={isGoogle:true,loadAll:async()=>({students:{}})};const {c}=runtime(b);c.onFirebaseReady(b);await tick();assert.equal(c.currentId,null);assert.equal(c.state.view,'login');
});
test('OAuth double click is locked and disabled provider has honest fallback',async()=>{
 let reject,calls=0;const {c,status}=runtime({signInGoogle:()=>{calls++;return new Promise((_,r)=>reject=r)}});const pending=c.loginWithGoogle();await c.loginWithGoogle();assert.equal(calls,1);reject(new Error('provider not enabled'));await pending;assert.match(status.textContent,/ยังไม่ได้เปิด/);
});
test('Google logout waits for progress save before revoking session',async()=>{
 const calls=[];const b={isGoogle:true,loadAll:async()=>({students:{}}),saveStudent:async()=>calls.push('save'),signOut:async()=>calls.push('signout')};const {c}=runtime(b);c.onFirebaseReady(b);c.currentId='a';c.db.students.a={};c.logout();await tick();assert.deepEqual(calls,['save','signout']);assert.equal(c.replaced,'https://school.example/app/');
});
