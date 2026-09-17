const assert=require('node:assert/strict');
const c=require('./teacher-test-runtime.cjs')();
const log={innerHTML:'old',scrollTop:100,scrollHeight:1000,clientHeight:300};
c.elements.chatlog=log;c.appEl={innerHTML:'preserved'};
c.state.chat=[{role:'me',text:'hello'}];c.state.chatBusy=false;
c.renderChat();assert.equal(log.scrollTop,100);assert.equal(c.appEl.innerHTML,'preserved');assert.match(log.innerHTML,/hello/);
log.scrollTop=700;c.state.chat.push({role:'me',text:'next'});c.renderChat();assert.equal(log.scrollTop,1000);
console.log('PASS: chat preserves page and reading position; follows new messages only near bottom');
