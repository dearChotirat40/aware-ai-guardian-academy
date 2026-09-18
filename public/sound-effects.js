/* Quiet, locally synthesized effects. No downloads or autoplay. */
(function(){
 'use strict';
 var key='awareai_sound_enabled',enabled=true,ctx=null,last=0;
 try{enabled=localStorage.getItem(key)!=='off';}catch(e){}
 var tunes={chat:[[880,0,.07],[1175,.085,.12]],tap:[[520,0,.045]],correct:[[660,0,.09],[880,.1,.14]],retry:[[330,0,.1],[262,.11,.14]],complete:[[523,0,.1],[659,.12,.1],[784,.24,.1],[1047,.36,.22]],draw:[[440,0,.07],[554,.09,.07],[659,.18,.07]],prize:[[659,0,.1],[784,.12,.1],[1047,.24,.28]]};
 function stop(){if(ctx&&ctx.state==='running')ctx.suspend().catch(function(){});}
 function play(name){
  if(!enabled||document.hidden)return;
  var now=Date.now();if(name==='tap'&&now-last<90)return;last=now;
  try{
   var Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
   if(!ctx)ctx=new Audio();
   if(ctx.state==='suspended')ctx.resume().catch(function(){});
   var start=ctx.currentTime;
   (tunes[name]||tunes.tap).forEach(function(n){var o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.value=n[0];g.gain.setValueAtTime(0,start+n[1]);g.gain.linearRampToValueAtTime(.065,start+n[1]+.008);g.gain.exponentialRampToValueAtTime(.001,start+n[1]+n[2]);o.connect(g);g.connect(ctx.destination);o.start(start+n[1]);o.stop(start+n[1]+n[2]+.02);o.onended=function(){o.disconnect();g.disconnect();};});
  }catch(e){} // Audio failure must never block learning or saving.
 }
 window.playLearningSound=play;
 var button=document.createElement('button');button.id='learning-sound-toggle';button.type='button';
 button.style.cssText='position:fixed;left:12px;bottom:8px;z-index:10002;border:1px solid #adc4d4;border-radius:20px;background:#fffdf5;color:#244e70;padding:7px 12px;font-size:13px;min-height:36px;box-shadow:0 2px 5px #0002';
 function label(){button.textContent=enabled?'🔊 เสียงเอฟเฟกต์':'🔇 เสียงปิด';button.setAttribute('aria-label',enabled?'ปิดเสียงเอฟเฟกต์':'เปิดเสียงเอฟเฟกต์');button.setAttribute('aria-pressed',String(enabled));}
 button.onclick=function(){enabled=!enabled;try{localStorage.setItem(key,enabled?'on':'off');}catch(e){}label();if(enabled)play('correct');else stop();};label();document.body.appendChild(button);
 document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('button');if(b&&b!==button&&!b.disabled)play('tap');},true);
 document.addEventListener('change',function(e){if(e.target.tagName==='SELECT')play('tap');});
 document.addEventListener('visibilitychange',function(){if(document.hidden)stop();});
 function wrap(name,before,after){var original=window[name];if(typeof original!=='function')return;window[name]=function(){var snapshot=before();var result=original.apply(this,arguments);after(snapshot,arguments);return result;};}
 ['unitOneCheck','unitOneWord','unitOneSource'].forEach(function(name){wrap(name,function(){var a=unitOneSession();return {done:a.done,attempts:a.attempts,feedback:a.feedback};},function(old){var a=unitOneSession();if(a.done&&!old.done)play('correct');else if(a.attempts>old.attempts||a.feedback!==old.feedback)play('retry');});});
 wrap('unitOneComplete',function(){return lessonProgress[0].quizDone;},function(done){if(!done&&lessonProgress[0].quizDone)play('complete');});
 wrap('pickAnswer',function(){return lessonProgress[state.currentLesson].quizDone;},function(done){if(!done&&lessonProgress[state.currentLesson].quizDone)play('complete');});
 // Assessment answers intentionally use the same neutral tap until feedback is shown.
})();
