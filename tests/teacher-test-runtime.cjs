const fs=require('node:fs'),vm=require('node:vm');
module.exports=function(){
 const elements={};const alerts=[];const storage={};
 const c={location:{pathname:'/',origin:'http://localhost'},document:{addEventListener(){},getElementById(id){return elements[id] || null;},querySelector(){return null;},querySelectorAll(){return [];}},addEventListener(){},setTimeout(){},clearTimeout(){},setInterval(){},localStorage:{getItem(k){return storage[k] || null;},setItem(k,v){storage[k]=v;}},console,crypto:require('node:crypto').webcrypto,alert(v){alerts.push(v)},confirm(){return true}};
 c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync('index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1],c);vm.runInContext(fs.readFileSync('public/teacher-admin.js','utf8'),c);c.render=function(){};c.elements=elements;c.alerts=alerts;return c;
};
