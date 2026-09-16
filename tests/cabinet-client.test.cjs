const vm = require('node:vm');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const tick = () => new Promise(r=>setImmediate(r));
(async () => {
  for (const file of ['index.html','public/index.html','aware-ai-guardian-academy.html','public/ai-bot-random.html']) {
    const html = fs.readFileSync(file,'utf8');
    for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) new vm.Script(match[1]);
  }
  const messages = [], requests = [], storage = new Map();
  let performDraw = async()=>({studentId:'alice',tickets:0,badgeCount:1,owned:['Sky Blue'],prize:'Sky Blue'});
  const context = {
    currentId:'alice', state:{badges:[],view:'home'}, location:{origin:'http://localhost'},
    navigator:{onLine:true}, crypto,
    sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
    randomBotCollectedPrizes:()=>[], applyStudent:id=>{context.currentId=id},
    randomBotByName:name=>name?{name,file:'test.png'}:null,
    randomBotFrame:()=>({contentWindow:{postMessage:(data,origin)=>messages.push({data,origin})}}),
    randomBotFrameData:type=>({type}), render(){}, setInterval(){}, addEventListener(){}, document:{hidden:false},
    firebaseBackend:{cabinetAccount:async(id,request)=>{
      if(request){requests.push(request);return performDraw()}
      return {studentId:id,tickets:1,badgeCount:1,owned:[]};
    }}
  };
  context.window=context;vm.createContext(context);
  vm.runInContext(fs.readFileSync('public/cabinet-account.js','utf8'),context);
  context.applyStudent('alice');await tick();assert.equal(context.randomBotDrawRemaining(),1);
  performDraw=async()=>{throw Error('lost response')};await context.requestRandomBotDraw();
  assert.equal(messages.at(-1).data.type,'ai-bot-error');assert.equal(storage.size,1);
  let complete;performDraw=()=>new Promise(r=>complete=r);
  const pending=context.requestRandomBotDraw();await context.requestRandomBotDraw();
  assert.equal(requests.length,2);assert.equal(requests[0],requests[1]);
  complete({studentId:'alice',tickets:0,badgeCount:1,owned:['Sky Blue'],prize:'Sky Blue'});await pending;
  assert.equal(context.randomBotDrawRemaining(),0);assert.equal(storage.size,0);
  assert.equal(context.randomBotCollectedPrizes()[0].name,'Sky Blue');
  assert(messages.every(m=>m.origin==='http://localhost'));
  context.applyStudent('bob');assert.equal(context.randomBotDrawRemaining(),0);await tick();
  assert.equal(context.randomBotCollectedPrizes().length,0);
  context.navigator.onLine=false;const before=requests.length;await context.requestRandomBotDraw();assert.equal(requests.length,before);
  assert.equal(context.takeRandomBotDraw('Sky Blue'),null);assert.equal(context.importRandomBotHandoff(),false);
  console.log('PASS: script syntax, pending request retry, duplicate clicks, confirmed rewards, account switch, offline lock, origin restriction, legacy local draw disabled');
})().catch(e=>{console.error(e);process.exitCode=1});
