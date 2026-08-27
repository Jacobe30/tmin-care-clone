const fs = require('fs');
const path = require('path');

const root = '/home/ubuntu/tmin-care-clone/public';
const source = path.join(root, 'assets', 'index-supabase-pending-v1.js');
const targetName = 'index-supabase-activity-v2.js';
const target = path.join(root, 'assets', targetName);
const indexHtml = path.join(root, 'index.html');

let bundle = fs.readFileSync(source, 'utf8');
const socketStub = 'const te={connected:!1,on:()=>{},off:()=>{},emit:()=>{}};';
const activityTracker = `${socketStub}const Et=()=>{const a=sessionStorage.getItem("id");a&&Ee.post(St+"/activity/"+a,{page_path:window.location.pathname}).catch(()=>{})},Kt=history.pushState.bind(history);history.pushState=function(...a){const l=Kt(...a);return Et(),l};window.addEventListener("popstate",Et);`;

if (!bundle.includes(socketStub)) {
  throw new Error('The expected realtime stub was not found. No bundle was changed.');
}
bundle = bundle.replace(socketStub, activityTracker);
fs.writeFileSync(target, bundle);

let html = fs.readFileSync(indexHtml, 'utf8');
const originalScript = '/assets/index-supabase-pending-v1.js';
const replacementScript = `/assets/${targetName}`;
if (!html.includes(originalScript)) {
  throw new Error('The expected entry-script reference was not found. No HTML was changed.');
}
html = html.replace(originalScript, replacementScript);
fs.writeFileSync(indexHtml, html);

console.log(JSON.stringify({ target, sourceBytes: fs.statSync(source).size, targetBytes: fs.statSync(target).size }, null, 2));
