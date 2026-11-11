'use strict';
/* M10-10 structure migration smoke test: validates wiring, not visual parity. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const text=rel=>fs.readFileSync(path.join(root,rel),'utf8');
let checks=0;
const ok=(predicate,why)=>{assert(predicate,why);checks++};
const html=text('index.html');
const css=['base','battle','overlay','codex','formation','lobby'];
for(const c of css)ok(html.includes(`href="css/${c}.css"`),`${c} linked`);
for(const [name,rel] of [['m1003IndustrialSkin','css/skins/industrial.css'],['m1004GraphicSkin','css/skins/graphic.css'],['m1006VisualSkin','css/codex.css']]){
 ok(html.includes(`href="${rel}" id="${name}"`),`skin toggle ${name}`);
}
const required=['js/shared/roster.js','js/shared/items.js','js/shared/combat-engine.js','js/client/game.js','js/client/multiplayer.js','js/client/battlefield.js','js/client/live-intro.js'];
for(const p of required)ok(html.includes(`src="${p}"`),`classic script ${p}`);
for(const f of ['index.html','js/client/game.js','js/server/server.cjs','css/base.css','css/battle.css','css/overlay.css','css/codex.css','css/formation.css','css/lobby.css'])ok(fs.existsSync(path.join(root,f)),`exists ${f}`);
ok(!fs.existsSync(path.join(root,'game.js')),'no root game.js duplicate');
ok(!fs.existsSync(path.join(root,'m1010-refinement.css')),'no root milestone css duplicate');
ok(text('js/client/game.js').includes("script.src='js/client/m1007-client.js'"),'M10-07 runtime loaded');
ok(text('js/client/m1007-client.js').includes("const scriptName = 'js/client/m1006-ui-language.js'"),'M10-06 dynamic script path');
ok(text('js/client/multiplayer.js').includes('m1009TabBrowse'),'password-aware room browser kept');
ok(text('js/client/game.js').includes('m1010-battle-synergy'),'combat synergies kept');
ok(text('js/server/server.cjs').includes("path.resolve(__dirname, '../..')"),'root path migration');
ok(text('package.json').includes('node js/server/server.cjs'),'npm start migration');
ok(text('render.yaml').includes('node js/server/server.cjs'),'Render start migration');
for(const file of [...css.map(c=>`css/${c}.css`),'css/skins/industrial.css','css/skins/graphic.css']){
 const contents=text(file);
 const urls=[...contents.matchAll(/url\(\s*['"]?([^)'" ]+)/g)].map(m=>m[1]);
 for(const u of urls)if(!/^(?:https?:|data:|\/\/|#|\/)/.test(u))ok(fs.existsSync(path.resolve(root,path.dirname(file),u.split('?')[0])),`css url ${file}: ${u}`);
}
const roster=require('../js/shared/roster.js').roster;
ok(roster.some(x=>x.id==='hart'&&x.affiliations.includes('군악대')&&x.affiliations.includes('헌신')),'Hart M10-07 affiliation');
ok(roster.length>=38,'full roster');
const {CombatEngine}=require('../js/shared/combat-engine.js');
ok(typeof CombatEngine==='function','combat engine commonjs');
const p=path.join(root,'js/server/server.cjs');
ok(fs.statSync(p).size>10000,'live server not blank');
for(const page of ['index.html','qa.html','qa-combat.html','legacy/m5-preview.html']){
 const s=text(page);
 for(const [,u] of s.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+)"/g)){
  if(/^(?:https?:|\/\/|data:)/.test(u))continue;
  ok(fs.existsSync(path.resolve(root,path.dirname(page),u.split('?')[0])),`HTML ${page} -> ${u}`);
 }
}
(async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'live-refactor-smoke-'));
 process.env.PORT='0';process.env.LIVE_DATA_DIR=temp;
 const {server}=require('../js/server/server.cjs');
 try{
  for(let i=0;i<80&&!server.listening;i++)await new Promise(r=>setTimeout(r,20));
  ok(server.listening,'server listening');
  const url=`http://127.0.0.1:${server.address().port}`;
  const get=async p=>fetch(url+p);
  for(const file of ['/', '/health','/js/client/game.js','/js/client/m1007-client.js','/css/base.css','/css/formation.css','/css/lobby.css','/css/skins/industrial.css','/assets/m10/ui/m1007-board-engraving.svg','/qa-combat.html']){
   const r=await get(file);ok(r.ok,`GET ${file} ${r.status}`);await r.arrayBuffer();
  }
  const post=async (endpoint,body,session='')=>{
   const r=await fetch(url+'/api/'+endpoint,{method:'POST',headers:{'content-type':'application/json','x-live-session':session},body:JSON.stringify(body)});
   return {status:r.status,body:await r.json()};
  };
  const account1=await post('register',{username:'refactora',password:'samplepassword098',nickname:'검증1'});
  const account2=await post('register',{username:'refactorb',password:'samplepassword098',nickname:'검증2'});
  ok(account1.status===200&&account2.status===200,'register accounts');
  const created=await post('create',{maxPlayers:2,isPublic:false,password:'passcode987',title:'QA room'},account1.body.session);
  ok(created.status===200,'create protected room');
  const roomId=created.body.room?.roomId||created.body.room?.code;
  ok(!!roomId,'created room id');
  const wrong=await post('join',{roomId,password:'badpass'},account2.body.session);
  ok(wrong.status!==200,'reject wrong password');
  const joined=await post('join',{roomId,password:'passcode987'},account2.body.session);
  ok(joined.status===200,'join correct password');
  const codePath=await post('join',{code:roomId,password:'passcode987'},account2.body.session);
  ok(codePath.status!==200,'removed legacy code-only join');
  console.log(`REFACTOR SMOKE PASS: ${checks} checks`);
 }finally{
  server.closeAllConnections();server.close();
  fs.rmSync(temp,{recursive:true,force:true});
 }
})().then(()=>process.exit(0),e=>{console.error('REFACTOR SMOKE FAIL:',e);process.exit(1)});
