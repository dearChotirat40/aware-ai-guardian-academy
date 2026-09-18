const assert=require('node:assert/strict'),fs=require('node:fs');
const c=require('./teacher-test-runtime.cjs')();c.currentId='chat-test';c.state.currentLesson=0;c.saveProgress=()=>{};c.stopSpeak=()=>{};c.unitOneReview();c.unitOneMove(2);
let fullRenders=0,sounds=[];c.render=()=>fullRenders++;c.playLearningSound=s=>sounds.push(s);
c.unitOneChatOpen();c.unitOneSession().chatDraft='ยังไม่ส่ง';c.unitOneChatNext();assert.equal(c.unitOneSession().chatDraft,'ยังไม่ส่ง');
c.elements['u1-chat-input']={value:'ปีไหน <script>'};c.unitOneChatSend();assert.equal(c.elements['u1-chat-input'].value,'');assert.equal(c.unitOneSession().chatReplies.length,2);assert.equal(fullRenders,0);
let html=c.unitOnePhoneHtml(c.lessons[0].situations[2],c.unitOneSession());assert(html.includes('u1-chat-transcript'));assert(html.includes('&lt;script&gt;'));assert(html.includes('id="u1-chat-continue"'));assert(!c.lessonProgress[0].quizDone);
for(let i=0;i<10;i++)c.unitOneChatNext();assert.equal(c.unitOneSession().frame,7);assert.equal(fullRenders,0);assert.equal(sounds.length,9);
assert.equal(fs.readFileSync('public/index.html','utf8'),fs.readFileSync('index.html','utf8').replaceAll('./public/','./'));
console.log('PASS: no full-page rerenders, drafts retained, input cleared, escaped transcript, stable continuation slot and preserved rewards');
