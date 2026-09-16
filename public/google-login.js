/* Google proves identity; the existing student code links the classroom record once. */
(function () {
  'use strict';
  var originalRenderLogin = renderLogin;
  var originalLogout = logout;
  var originalReady = window.onFirebaseReady;
  var googleAccount = false;
  var busy = false;
  var message = '';
  function status(text) {
    message = text;
    var el = document.getElementById('google-login-status');
    if (el) el.textContent = text;
  }
  renderLogin = function () {
    originalRenderLogin();
    var card = document.querySelector('.login-card');
    if (!card) return;
    var box = document.createElement('div');
    box.style.cssText = 'margin-top:16px;border-top:1px solid #ddd;padding-top:14px';
    box.innerHTML = '<button id="google-login-button" type="button" class="btn whiteb" style="width:100%" onclick="loginWithGoogle()">เข้าสู่ระบบด้วย Google</button>' +
      '<p id="google-login-status" role="status" class="soft tiny center" style="margin-top:10px"></p>' +
      '<p class="soft tiny center" style="margin-top:8px">ครั้งแรกใช้รหัสจากครูเพื่อเชื่อมบัญชีเดิม คะแนนและของสะสมจะอยู่ครบ</p>' +
      (googleAccount ? '<button type="button" class="btn whiteb sm" onclick="signOutGoogle()">ออกจากบัญชี Google / เปลี่ยนบัญชี</button>' : '');
    card.appendChild(box);
    status(message);
    if (googleAccount) document.getElementById('google-login-button').hidden = true;
  };
  window.loginWithGoogle = async function () {
    if (busy) return;
    if (!firebaseBackend || !firebaseBackend.signInGoogle) { status('กำลังเชื่อมต่อ กรุณารอสักครู่'); return; }
    busy = true;
    status('กำลังเปิด Google เพื่อเข้าสู่ระบบ…');
    try { await firebaseBackend.signInGoogle(); }
    catch (error) {
      status(/provider|disabled|not enabled/i.test(String(error.message)) ? 'โรงเรียนยังไม่ได้เปิด Google Login กรุณาใช้รหัสนักเรียนได้ตามปกติ' : 'เปิด Google ไม่สำเร็จ กรุณาลองใหม่');
    } finally { busy = false; }
  };
  window.signOutGoogle = async function () {
    if (busy || !firebaseBackend) return;
    busy = true;
    try {
      await firebaseBackend.signOut();
      // A reload creates a fresh anonymous session for the code login option.
      window.location.replace(window.location.origin + window.location.pathname);
    } catch (error) { busy = false; status('ออกจากระบบไม่สำเร็จ กรุณาลองใหม่'); }
  };
  logout = function () {
    if (!googleAccount) return originalLogout();
    if (busy) return;
    busy = true;
    saveProgress();
    var id = currentId;
    var student = id && db.students[id];
    Promise.resolve(student ? firebaseBackend.saveStudent(id, student) : null).then(function () {
      return firebaseBackend.signOut();
    }).then(function () {
      window.location.replace(window.location.origin + window.location.pathname);
    }).catch(function () {
      busy = false;
      alert('บันทึกข้อมูลหรือออกจากระบบไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง');
    });
  };
  window.onFirebaseReady = function (backend) {
    googleAccount = !!backend.isGoogle;
    originalReady(backend);
    if (!googleAccount) {
      if (window.googleOAuthError) status('เข้าสู่ระบบ Google ไม่สำเร็จหรือถูกยกเลิก กรุณาลองใหม่ หรือใช้รหัสนักเรียน');
      return;
    }
    message = 'เข้าสู่ Google แล้ว กรุณากรอกรหัสนักเรียนจากครูเพื่อเชื่อมบัญชีครั้งแรก';
    if (state.view === 'login') render();
    backend.loadAll().then(function (cloud) {
      // Only rows allowed by owns_student(auth.uid()) are used. Never trust a cached ID/email.
      var ids = Object.keys(cloud.students || {});
      if (ids.length !== 1 || state.view !== 'login') return;
      var id = ids[0];
      db.students = {};
      db.students[id] = cloud.students[id];
      applyStudent(id);
      saveDB();
      changeView(hasNickname(cloud.students[id]) ? 'home' : 'nickname');
    }).catch(function () { status('โหลดบัญชีไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตแล้วโหลดหน้าใหม่'); });
  };
}());
