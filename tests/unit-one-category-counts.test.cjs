const assert=require('node:assert/strict');
const c=require('./teacher-test-runtime.cjs')();c.saveProgress=()=>{};c.state.currentLesson=0;c.state.slideIdx=0;c.unitOneFlow().stage='activity';
assert.match(c.unitOneGroupHtml(0,0,c.unitOneSession()),/รอตรวจคำตอบ/);
c.unitOneCardList().forEach((_,i)=>c.unitOnePick(i,0));c.unitOneCheck();
let html=c.unitOneGroupHtml(0,0,c.unitOneSession());assert.match(html,/ถูก 3 ใบ/);assert.match(html,/ผิด 6 ใบ/);
assert.match(c.unitOneGroupHtml(0,1,c.unitOneSession()),/ถูก 0 ใบ/);
c.elements['u1-group-0']={innerHTML:''};c.unitOnePick(3,1);assert.match(c.elements['u1-group-0'].innerHTML,/แก้ไขแล้ว กรุณาตรวจใหม่/);assert.match(c.elements['u1-group-0'].innerHTML,/ผิด 6 ใบ/);
c.unitOneCheck();assert.match(c.unitOneGroupHtml(0,0,c.unitOneSession()),/ผิด 5 ใบ/);assert.match(c.unitOneGroupHtml(0,1,c.unitOneSession()),/ถูก 1 ใบ/);
c.unitOneCardList().forEach((card,i)=>c.unitOnePick(i,card[1]));c.unitOneCheck();for(let i=0;i<3;i++){html=c.unitOneGroupHtml(0,i,c.unitOneSession());assert.match(html,/ถูก 3 ใบ/);assert.match(html,/ผิด 0 ใบ/);}
console.log('PASS: per-category checked totals, zero counts, changed-answer label and dropdown refresh');
