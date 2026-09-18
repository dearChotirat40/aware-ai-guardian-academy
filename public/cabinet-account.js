/* The database is authoritative for tickets and prizes; no browser-local draws. */
(function () {
  'use strict';
  var wallet = null;
  var pendingRequest = null;
  var pendingAccount = null;
  var loading = null;
  var legacyCollected = window.randomBotCollectedPrizes;
  var originalApplyStudent = window.applyStudent;

  function forAccount() { return wallet && wallet.studentId === currentId ? wallet : null; }
  function accept(data, id) {
    if (currentId !== id || !data || data.studentId !== id) return false;
    wallet = data;
    return true;
  }
  function notify(type, extra) {
    var frame = randomBotFrame();
    if (!frame || !frame.contentWindow) return;
    var label = typeof currentStudent === 'function' && typeof studentAlias === 'function'
      ? studentAlias(currentStudent()) : 'บัญชีของฉัน';
    frame.contentWindow.postMessage(Object.assign(randomBotFrameData(type), { accountLabel: label }, extra || {}), location.origin);
  }
  function refresh() {
    var id = currentId;
    if (!id || !firebaseBackend || !firebaseBackend.cabinetAccount) return Promise.reject(new Error('Database unavailable'));
    return firebaseBackend.cabinetAccount(id).then(function(data) {
      var changed = JSON.stringify(wallet) !== JSON.stringify(data);
      if (accept(data, id)) {
        syncRandomBotFrame();
        if (changed && state.view === 'dashboard' && !state.clawPicking) render();
      }
      return data;
    });
  }
  var choosingBuddy = false;
  window.currentBuddyAvatar = function () {
    var active = forAccount();
    var student = currentStudent();
    return active && student && active.owned.indexOf(student.buddyAvatar) !== -1
      ? randomBotByName(student.buddyAvatar) : null;
  };
  window.openBuddyPicker = function () {
    if (!currentId || document.getElementById('buddy-picker')) return;
    var id = currentId;
    refresh().then(function () {
      if (currentId !== id) return;
      var panel = document.createElement('section');
      panel.id = 'buddy-picker';
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'true');
      panel.setAttribute('aria-label', 'เลือกตัวละครน้องชวนคิด');
      panel.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(20,40,60,.65);overflow:auto;padding:24px';
      var owned = randomBotUniquePrizes();
      var chosen = currentBuddyAvatar();
      var choices = owned.map(function(item) {
        var selected = chosen && chosen.name === item.name;
        return '<button type="button" class="random-toy-slot got' + (selected ? ' selected' : '') + '" onclick="chooseBuddyAvatar(\'' + item.name + '\')" aria-pressed="' + !!selected + '">' + randomBotImage(item, 90) + '<div class="toy-name">' + item.name + '</div><div class="toy-lesson">' + (selected ? '✓ กำลังใช้คุยกับเรา' : 'เลือกเป็นน้องชวนคิด') + '</div></button>';
      }).join('');
      var chooser = owned.length ? '<div class="random-toy-grid" style="margin:16px 0">' + choices + '</div>' : '<p style="padding:20px 0">ยังไม่มีหุ่นที่สุ่มได้ สะสมเหรียญตราแล้วไปสุ่มตัวละครก่อนนะ ตอนนี้ยังคุยกับน้องชวนคิดตัวเดิมได้</p>';
      panel.innerHTML = '<div style="max-width:760px;margin:auto;background:#fffdf5;padding:20px;border-radius:20px"><button class="btn whiteb sm" onclick="closeBuddyPicker()">ปิด ×</button><h2>เลือกตัวละครน้องชวนคิด</h2><p>เลือกได้จากหุ่นที่บัญชีนี้สะสมไว้ ตัวละครจะเปลี่ยนในแชทโดยยังคุยเรื่องเดิมต่อได้</p><p id="buddy-save-status" role="status"></p>' + chooser + '<button class="btn pinkb sm" onclick="openRandomCabinet()">🧸 ไปสุ่มตัวละครเพิ่ม</button></div>';
      document.body.appendChild(panel);
    }).catch(function () { alert('โหลดตัวละครจากบัญชีไม่สำเร็จ กรุณาลองใหม่'); });
  };
  window.closeBuddyPicker = function () {
    var panel = document.getElementById('buddy-picker');
    if (panel) panel.remove();
  };
  window.chooseBuddyAvatar = async function (name) {
    if (choosingBuddy || !currentId || !firebaseBackend) return;
    var id = currentId;
    choosingBuddy = true;
    var status = document.getElementById('buddy-save-status');
    if (status) status.textContent = 'กำลังบันทึกตัวละคร…';
    try {
      await refresh();
      if (currentId !== id) return;
      var active = forAccount();
      var avatar = randomBotByName(name);
      if (!active || !avatar || active.owned.indexOf(avatar.name) === -1) throw new Error('Not owned');
      var student = currentStudent();
      var payload = JSON.parse(JSON.stringify(student));
      payload.buddyAvatar = avatar.name;
      payload._updatedAt = Date.now();
      await firebaseBackend.saveStudent(id, payload);
      if (currentId !== id) return;
      student.buddyAvatar = avatar.name;
      student._updatedAt = payload._updatedAt;
      saveDB();
      closeBuddyPicker();
      render();
    } catch (error) {
      if (currentId !== id) return;
      var message = error.message === 'Not owned' ? 'เลือกได้เฉพาะตัวละครที่บัญชีนี้มีเท่านั้น' : 'ยังบันทึกตัวละครไม่สำเร็จ กรุณาลองใหม่';
      if (status) status.textContent = message;
      else alert(message);
    } finally { choosingBuddy = false; }
  };
  window.importRandomBotHandoff = function () { return false; };
  window.takeRandomBotDraw = function () { return null; };
  window.randomCabinetHtml = function () {
    return '<section class="random-cabinet cabinet-launcher"><p class="random-cabinet-title">ตู้สุ่มของฉัน</p><p class="cabinet-token">🏅 จบแต่ละบทได้ 1 เหรียญตรา · 1 เหรียญตรา = สุ่ม BOT 1 ครั้ง · ผลสุ่มบันทึกในบัญชี</p><button onclick="openRandomCabinet()" class="btn pinkb sm">เปิดตู้สุ่มของฉัน</button></section>';
  };
  window.randomBotCollectedPrizes = function () {
    var active = forAccount();
    return active ? active.owned.map(randomBotByName).filter(Boolean) : legacyCollected();
  };
  window.randomBotDrawRemaining = function () { var active = forAccount(); return active ? active.tickets : 0; };
  window.randomBotBadgeCount = function () { var active = forAccount(); return active ? active.badgeCount : state.badges.length; };
  window.applyStudent = function (id) {
    wallet = null;
    closeBuddyPicker();
    originalApplyStudent(id);
    refresh().then(function() { if (currentId === id) render(); }).catch(function() {});
  };
  window.syncRandomBotFrame = function () {
    notify('ai-bot-config', { accountId: currentId, ready: !!forAccount() && !loading });
  };
  window.requestRandomBotDraw = function () {
    if (state.clawPicking || loading || !forAccount()) return Promise.resolve();
    var id = currentId;
    if (!firebaseBackend || navigator.onLine === false) {
      notify('ai-bot-error', { message: 'ยังสุ่มไม่ได้ กรุณาเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่', canRetry: true });
      return Promise.resolve();
    }
    if (!pendingRequest || pendingAccount !== id) {
      var key = 'awareai_cabinet_request:' + id;
      try { pendingRequest = sessionStorage.getItem(key); } catch (e) {}
      if (!pendingRequest || pendingAccount && pendingAccount !== id) pendingRequest = crypto.randomUUID();
      pendingAccount = id;
      try { sessionStorage.setItem(key, pendingRequest); } catch (e) {}
    }
    state.clawPicking = true;
    return firebaseBackend.cabinetAccount(id, pendingRequest).then(function(data) {
      if (!accept(data, id)) return;
      try { sessionStorage.removeItem('awareai_cabinet_request:' + id); } catch (e) {}
      pendingRequest = null;
      notify('ai-bot-draw-result', { prize: randomBotByName(data.prize), accountId: id });
    }).catch(function(error) {
      if (currentId !== id) return;
      if (error && /No draw tickets remaining/.test(error.message || '')) {
        return refresh().then(function() {
          notify('ai-bot-error', { message: 'ใช้สิทธิ์สุ่มครบแล้ว ข้อมูลอัปเดตจากบัญชีล่าสุด', canRetry: false });
        }).catch(function() {
          notify('ai-bot-error', { message: 'โหลดสิทธิ์ล่าสุดไม่สำเร็จ กรุณาลองใหม่', canRetry: true });
        });
      }
      // Keep the request ID: retrying after a lost response cannot consume another ticket.
      notify('ai-bot-error', { message: 'ยังยืนยันผลสุ่มไม่ได้ กดลองใหม่ได้โดยไม่เสียสิทธิ์ซ้ำ', canRetry: true });
    }).finally(function() { state.clawPicking = false; });
  };
  window.openRandomCabinet = function () {
    if (!currentId) { alert('กรุณาเข้าสู่ระบบนักเรียนก่อนเปิดตู้สุ่ม'); return; }
    if (document.getElementById('account-cabinet-overlay')) return;
    closeBuddyPicker();
    state.randomCabinetOpen = false;
    var existing = randomBotFrame();
    if (existing) existing.closest('section').remove();
    var overlay = document.createElement('section');
    overlay.id = 'account-cabinet-overlay';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-label','ตู้สุ่มของบัญชีนักเรียน');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:#07577e';
    overlay.innerHTML = '<button class="btn" onclick="closeRandomCabinet()" style="position:absolute;right:14px;top:12px;z-index:2">กลับแอป ×</button><iframe id="ai-bot-random-frame" title="ตู้สุ่มของฉัน" style="width:100%;height:100%;border:0" src="' + randomBotPagePath() + '?embed=1" onload="syncRandomBotFrame()"></iframe>';
    document.body.appendChild(overlay);
    var id = currentId;
    wallet = null;
    clearTimeout(firebaseStudentTimer);
    loading = firebaseBackend ? firebaseBackend.saveStudent(id, db.students[id]).then(refresh) : Promise.reject(new Error('Database unavailable'));
    loading.then(function() {
      loading = null;
      if (currentId === id) syncRandomBotFrame();
    }).catch(function() {
      loading = null;
      if (currentId === id) notify('ai-bot-error', { message: 'เชื่อมฐานข้อมูลไม่สำเร็จ กรุณาปิดตู้แล้วเปิดใหม่', canRetry: false });
    });
  };
  window.closeRandomCabinet = function () {
    if (state.clawPicking) return;
    var overlay = document.getElementById('account-cabinet-overlay');
    if (overlay) overlay.remove();
    state.randomCabinetOpen = false;
    render();
  };
  window.addEventListener('focus', function () {
    if (currentId && !loading && !state.clawPicking) refresh().catch(function() {});
  });
  setInterval(function () {
    if (currentId && !document.hidden && !loading && !state.clawPicking &&
        (randomBotFrame() || state.view === 'dashboard')) refresh().catch(function() {});
  }, 15000);
})();
