const assert=require('node:assert/strict');
const fs=require('node:fs');
const c=require('./teacher-test-runtime.cjs')();
c.currentId='unit-test';c.state.currentLesson=0;c.state.slideIdx=0;c.state.view='lesson';c.state.lessonTab='mission';c.saveProgress=()=>{};c.stopSpeak=()=>{};c.markJourneyStep=()=>{};c.journeySteps=()=>0;
let delay;c.setTimeout=(fn,ms)=>{delay=ms;};
assert.equal(c.lessons[0].situations.length,4);assert.equal(c.lessons[0].quiz.length,8);
assert.match(c.unitOneHtml(c.lessons[0]),/ฐานที่ 1 ห้องแยกประเภท/);
c.unitOneMove(3);assert.equal(c.state.slideIdx,0);
c.unitOneAnswer(0);assert.equal(c.unitOneSession().answers.length,0);
c.unitOneBegin();assert.equal(c.unitOneFlow().stage,'media');
for(let n=0;n<4;n++){
 for(let j=0;j<4;j++)c.unitOneMediaNext();
 assert.equal(c.unitOneFlow().stage,'activity');
 c.unitOneStartAssessment();assert.equal(c.unitOneFlow().stage,'activity');
 if(n===0){
  c.unitOneCheck();assert.equal(c.unitOneSession().attempts,0);
  for(let r=0;r<3;r++){c.unitOneCards.forEach((_,i)=>c.unitOnePick(i,0));c.unitOneCheck();}
  assert.equal(c.unitOneSession().attempts,3);c.unitOnePick(0,1);assert.equal(c.unitOneSession().picks[0],0);
  c.unitOneRestart();c.unitOneCards.forEach((card,i)=>c.unitOnePick(i,card[1]));c.unitOneCheck();
 }else if(n===1){
  for(let i=0;i<c.unitOneConfig(n).outputs.length;i++)c.unitOneAsk();c.elements['unit-one-sentence']={value:'วันนี้อากาศร้อน ฉันจึงอยาก'};
  for(let i=0;i<5;i++)c.unitOneWord();assert.equal(c.unitOneSession().words.length,5);
  assert.match(c.unitOneActivity(n,c.unitOneSession()),/8 ช่อง/);
 }else if(n===2){
  c.unitOneSource('2566');assert.equal(c.unitOneSession().done,false);
  c.unitOneSource('open');c.unitOneSource('2569');assert.equal(c.unitOneSession().done,false);c.unitOneSource('2566');
 }else{[0,1,2].forEach((v,i)=>c.unitOnePick(i,v));c.unitOneCheck();}
 assert.equal(c.unitOneSession().done,true);
 c.unitOneStartAssessment();assert.equal(c.unitOneFlow().stage,'assessment');
 c.unitOneHtml(c.lessons[0]);assert.equal(delay,60000);assert.equal(c.state.hintReady,false);
 // Normalize round trip, as happens during save/load, must preserve activity progress.
 c.lessonProgress[0]=c.normalizeLessonProgress(JSON.parse(JSON.stringify(c.lessonProgress[0])));
 assert.equal(c.unitOneSession().done,true);
 for(let j=0;j<2;j++)c.unitOneAnswer(c.lessons[0].quiz[n*2+j].answer);
 assert.equal(c.unitOneFlow().stage,'feedback');c.unitOneMove(n);assert.equal(c.unitOneFlow().stage,'feedback');assert.match(c.unitOneHtml(c.lessons[0]),/เกร็ดความรู้/);
 c.unitOneAnswer(0);assert.equal(c.unitOneSession().answers.length,2);
 c.unitOneContinue();
}
assert.equal(c.lessonProgress[0].quizDone,true);assert.equal(c.lessonProgress[0].postScore,8);assert.equal(c.lessonProgress[0].postTotal,8);assert.equal(c.lessonProgress[0].stars,1);assert.equal(c.lessonRewardPoints(c.lessonProgress[0]),4);assert.equal(c.unitOneFlow().stage,'end');
assert.match(c.unitOneHtml(c.lessons[0]),/นักสำรวจ AI/);c.unitOneComplete();assert.equal(c.lessonProgress[0].stars,1);
c.unitOneReview();assert.match(c.unitOneHtml(c.lessons[0]),/โหมดทบทวน/);assert.equal(c.lessonProgress[0].postScore,8);assert.equal(c.lessonProgress[0].stars,1);
const old=c.curriculumSnapshot();delete old.lessons[0].unitOneRevision;old.lessons[1].title='ครูแก้บทที่ 2';c.applyCurriculum(old);assert.equal(c.lessons[0].unitOneRevision,1);assert.equal(c.lessons[1].title,'ครูแก้บทที่ 2');
assert.equal(fs.readFileSync('index.html','utf8'),fs.readFileSync('aware-ai-guardian-academy.html','utf8'));
console.log('PASS: sequential media/activity/questions/feedback, locks, 60s hints, retries, persisted resume, original reward totals and idempotent completion');
