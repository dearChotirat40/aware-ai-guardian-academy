(function () {
  'use strict';
  var active = null, busy = false, pending = null;
  function display(rows) {
    return rows.map(function(row) {
      return {role:row.role === 'user' ? 'me' : 'bot', text:row.role === 'user' ? row.content : escChat(row.content).replace(/\n/g,'<br>'), offline:!!row.offline};
    });
  }
  function status(message) {
    var node = document.getElementById('chat-save-status');
    if (node) node.textContent = message;
  }
  var oldRenderChat = renderChat;
  renderChat = function () {
    oldRenderChat();
    var bar = document.querySelector('.chatbar');
    if (bar) {
      var note = document.createElement('p');
      note.id = 'chat-save-status'; note.setAttribute('role','status');
      note.className = 'soft tiny'; note.style.padding = '8px 16px';
      note.textContent = pending && pending.account === currentId ? 'มีคำตอบที่ยังบันทึกไม่สำเร็จ กดประวัติเพื่อลองบันทึกอีกครั้ง' : 'ประวัติ 100 ข้อความล่าสุดของบัญชีนี้ · บันทึกในฐานข้อมูล · ไม่ส่งรหัสผ่านหรือข้อมูลส่วนตัวในแชท';
      bar.parentNode.insertBefore(note, bar);
    }
  };
  window.openChat = async function () {
    var id = currentId;
    if (!id || !firebaseBackend || !firebaseBackend.chatHistory) { alert('กรุณาเข้าสู่ระบบและรอการเชื่อมต่อ'); return; }
    if (active === id && busy) { changeView('chat'); return; }
    active = id; busy = true; state.chatBusy = true; state.chat = [];
    changeView('chat'); status('กำลังโหลดประวัติสนทนา…');
    try {
      var retry = pending && pending.account === id ? [pending.message] : [];
      var rows = await firebaseBackend.chatHistory(id, retry);
      if (currentId !== id || active !== id) return;
      if (retry.length) pending = null;
      state.chat = display(rows);
      if (!rows.length) state.chat = [{role:'bot',text:'สวัสดี เราคือน้องชวนคิด 😊 เราจะช่วยอธิบาย ยกตัวอย่าง และค่อย ๆ คิดไปด้วยกัน ไม่ต้องกลัวตอบผิดนะ วันนี้มีเรื่องไหนเกี่ยวกับ AI ที่สงสัยหรืออยากลองคิดด้วยกันบ้าง?'}];
    } catch (error) {
      if (currentId === id) state.chat = [{role:'bot',text:'โหลดประวัติไม่สำเร็จ กดปุ่มประวัติเพื่อลองใหม่ ข้อความเดิมยังอยู่ในฐานข้อมูล'}];
    } finally {
      if (active === id) { busy = false; if (currentId === id) {state.chatBusy = false;if (state.view === 'chat') render();} }
    }
  };
  window.sendChat = async function () {
    var input = document.getElementById('chat-inp');
    var text = String(input && input.value || '').trim().slice(0,300);
    var id = currentId;
    if (!text || busy || !id || !firebaseBackend) return;
    if (pending && pending.account === id) { alert('กรุณากดประวัติเพื่อบันทึกคำตอบก่อนส่งข้อความต่อ'); return; }
    busy = true; active = id; state.chatBusy = true;
    var userMessage = {id:crypto.randomUUID(),role:'user',content:text};
    var userSaved = false;
    state.chat.push({role:'me',text:text}); render();status('กำลังบันทึกคำถามและรอคำตอบ…');
    try {
      var rows = await firebaseBackend.chatHistory(id,[userMessage]); userSaved = true;
      if (currentId !== id || active !== id) return;
      state.chat = display(rows);
      var message = {id:crypto.randomUUID(),role:'assistant',content:'',offline:false};
      try {
        var response = await aiTutorRequest({action:'chat',messages:rows.slice(-10).map(function(row){return {role:row.role,content:row.content};})});
        if (!response || !response.reply) throw new Error('Empty reply');
        message.content = String(response.reply).slice(0,8000);
      } catch (error) {
        message.content = String(offlineBot(text)).replace(/<[^>]*>/g,''); message.offline = true;
      }
      pending = {account:id,message:message};
      var saved = await firebaseBackend.chatHistory(id,[message]);
      if (pending && pending.message.id === message.id) pending = null;
      if (currentId !== id || active !== id) return;
      state.chat = display(saved);
    } catch (error) {
      if (currentId !== id || active !== id) return;
      if (!userSaved) {
        state.chat.pop();
        alert('ยังบันทึกคำถามไม่ได้ กรุณาลองส่งอีกครั้ง');
      } else if (pending && pending.account === id) {
        state.chat.push(display([pending.message])[0]);
      }
    } finally {
      if (active === id) {
        busy = false;
        if (currentId === id) {
          state.chatBusy = false;
          if (state.view === 'chat') { render(); if (!userSaved) {var field=document.getElementById('chat-inp');if(field)field.value=text;} }
        }
      }
    }
  };
}());
