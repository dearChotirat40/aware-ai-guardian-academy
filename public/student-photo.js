(function(){
 'use strict';
 var saving=false;
 window.chooseStudentPhoto=function(){var e=document.getElementById('student-photo-file');if(e)e.click();};
 async function persist(photo){
  if(saving||!currentId||!firebaseBackend)throw new Error('กรุณารอการเชื่อมต่อแล้วลองอีกครั้ง');
  saving=true;var id=currentId;
  try{
   saveProgress();clearTimeout(firebaseStudentTimer);
   var record=JSON.parse(JSON.stringify(db.students[id]));
   if(photo)record.profilePhoto=photo;else delete record.profilePhoto;
   record._updatedAt=Date.now();await firebaseBackend.saveStudent(id,record);
   if(currentId!==id)return;
   if(photo)db.students[id].profilePhoto=photo;else delete db.students[id].profilePhoto;
   db.students[id]._updatedAt=record._updatedAt;saveDB();render();
  }finally{saving=false;}
 }
 window.removeStudentPhoto=async function(){try{await persist(null);}catch(e){alert('ยังบันทึกไม่ได้ กรุณาลองใหม่');}};
 window.uploadStudentPhoto=async function(input){
  var file=input.files&&input.files[0],id=currentId;if(!file)return;
  input.value='';if(saving)return;
  if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>5*1024*1024){alert('เลือกรูป JPG, PNG หรือ WebP ขนาดไม่เกิน 5 MB');return;}
  var url=URL.createObjectURL(file);
  try{
   var img=new Image();await new Promise(function(resolve,reject){img.onload=resolve;img.onerror=reject;img.src=url;});
   if(currentId!==id)return;
   var canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
   var ctx=canvas.getContext('2d'),side=Math.min(img.naturalWidth,img.naturalHeight);
   ctx.fillStyle='#fff';ctx.fillRect(0,0,256,256);ctx.drawImage(img,(img.naturalWidth-side)/2,(img.naturalHeight-side)/2,side,side,0,0,256,256);
   var photo=canvas.toDataURL('image/jpeg',0.8);
   if(photo.length>87000)photo=canvas.toDataURL('image/jpeg',0.55);
   if(photo.length>87000)throw new Error('รูปใหญ่เกินไป');
   await persist(photo);
  }catch(e){alert('บันทึกรูปไม่สำเร็จ ลองเลือกรูปอื่นหรือตรวจการเชื่อมต่อ');}
  finally{URL.revokeObjectURL(url);}
 };
})();
