const fs = require('fs');
const path = require('path');

const root = '/home/ubuntu/tmin-care-clone/public';
const source = path.join(root, 'assets', 'index-Hq9PQyPZ.js');
const targetName = 'index-supabase-pending-v1.js';
const target = path.join(root, 'assets', targetName);
const indexHtml = path.join(root, 'index.html');
const apiBase = 'https://eqiwbvzpxqfhtnantnge.supabase.co/functions/v1/starter-api';
const publishableKey = 'sb_publishable_9owRgMYcUOQmi-DtHi1Mvg_t_1i9hYP';

let bundle = fs.readFileSync(source, 'utf8');
const originalBootstrap = 'const St="https://tmn-kse-production.up.railway.app",te=ks(St);';
const replacementBootstrap = `const St="${apiBase}";Ee.defaults.headers.common.apikey="${publishableKey}";Ee.defaults.headers.common.Authorization="Bearer ${publishableKey}";const te={connected:!1,on:()=>{},off:()=>{},emit:()=>{}};`;

if (!bundle.includes(originalBootstrap)) {
  throw new Error('The expected API bootstrap string was not found. No bundle was changed.');
}
bundle = bundle.replace(originalBootstrap, replacementBootstrap);
if (!bundle.includes('Ee.get(St+"/")')) {
  throw new Error('The expected API health check was not found. No bundle was changed.');
}
bundle = bundle.replace('Ee.get(St+"/")', 'Ee.get(St+"/health")');
fs.writeFileSync(target, bundle);

let html = fs.readFileSync(indexHtml, 'utf8');
const originalScript = '/assets/index-Hq9PQyPZ.js';
const replacementScript = `/assets/${targetName}`;
if (!html.includes(originalScript)) {
  throw new Error('The expected entry-script reference was not found. No HTML was changed.');
}
html = html.replace(originalScript, replacementScript);
fs.writeFileSync(indexHtml, html);

console.log(JSON.stringify({ target, apiBase, sourceBytes: fs.statSync(source).size, targetBytes: fs.statSync(target).size }, null, 2));
