'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
process.env.PORT='0';process.env.LIVE_DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'live-m904-'));
const {server,rooms}=require('../js/server/server.cjs');const items=require('../js/shared/items.js'),economy=require('../js/server/match-economy.cjs'),aug=require('../js/server/match-augment.cjs'),roster=require('../js/shared/roster.js');
async function check(){let num=0;for(let k=0;k<100&&!server.listening;k++)await new Promise(r=>setTimeout(r,10));assert(server.listening);
const base=`http://127.0.0.1:${server.address().port}`;
async function post(act,data={},token='',session=''){const r=await fetch(base+'/api/'+act,{method:'POST',headers:{'content-type':'application/json','x-live-token':token,'x-live-session':session},body:JSON.stringify(data)});return {status:r.status,body:await r.json()}};
try{
const s=[];for(let i=0;i<2;i++){const v=await post('register',{username:'m904qa'+i,password:'passwordtest123',nickname:'tester'+i});assert.equal(v.status,200);s.push(v.body.session);num++}
const a=await post('create',{maxPlayers:2},'',s[0]);assert.equal(a.status,200);const b=await post('join',{code:a.body.room.code},'',s[1]);assert.equal(b.status,200);num+=2;
const r=rooms.get(a.body.room.code),ap=[...r.players.values()][0];for(const u of [a,b])assert.equal((await post('ready',{ready:true},u.body.token)).status,200);for(const p of r.players.values())p.connected=true;assert.equal((await post('start',{},a.body.token)).status,200);ap.assets.items=['검집','금팔찌','사슬 갑옷'];ap.augments=['B013'];r.game={phase:'combat',kind:'pvp',pve:false,hp:[100,100],round:12,endsAt:Date.now()+100000,earlyEndsAt:null};
const before=JSON.stringify(ap.team),beforeOwned=JSON.stringify(ap.assets.owned),beforeCredits=ap.assets.credits;
for(const cmd of ['buy','reroll','lock','invest','sell-unit','equip','deploy','recall','swap']){const res=await post('economy',{cmd,index:0,uid:ap.assets.owned[0]?.uid,x:0,y:0},a.body.token);assert.equal(res.status,409,cmd+' must be blocked');num++}
assert.equal(JSON.stringify(ap.team),before);assert.equal(JSON.stringify(ap.assets.owned),beforeOwned);assert.equal(ap.assets.credits,beforeCredits);num+=3;
const craft=await post('economy',{cmd:'craft',index:0,otherIndex:1},a.body.token);assert.equal(craft.status,200,JSON.stringify(craft.body));assert(ap.assets.items.includes(items.craft('검집','금팔찌')));num+=2;
const ix=ap.assets.items.indexOf('블레이드 부츠');assert(ix>=0);const sell=await post('economy',{cmd:'sell-item',index:ix},a.body.token);assert.equal(sell.status,200);assert.equal(ap.assets.blueErebosSales,1);assert.equal(ap.assets.credits,beforeCredits+economy.itemSellPrice('블레이드 부츠')+1);num+=3;
assert.equal(JSON.stringify(ap.team),before,'combat team remains frozen');assert.equal(JSON.stringify(ap.assets.owned),beforeOwned);num+=2;
r.game.phase='result';assert.equal((await post('economy',{cmd:'sell-item',index:0},a.body.token)).status,409);num++;
r.game.phase='prep';assert.equal((await post('economy',{cmd:'reroll'},a.body.token)).status,200);num++;
const cat=JSON.parse(JSON.stringify(aug.CARDS));assert.equal(cat.blue.length,31);assert.equal(new Set(Object.values(cat).flat().map(x=>x.id)).size,Object.values(cat).flat().length);num+=2;
const human=roster.roster.filter(x=>!x.pveOnly);const game=fs.readFileSync(path.join(__dirname,'../game.js'),'utf8');for(const r of human)assert(game.includes(r.id+':{active:')||game.includes("'"+r.id+"':{active:"),`skill summary missing: ${r.id}`);num++;
for(const [f,name] of [['infusion-catalog.js','window.LIVEInfusionCatalog'],['qa-combat.html','qaInfA'],['qa-combat.js','qaCompare'],['index.html','m904-polish.css']]){assert(fs.readFileSync(path.join(__dirname,'..',f),'utf8').includes(name));num++}
console.log(`M9-04 QA PASS ${num} checks · combat-only inventory crafting/selling, blocked 9 commands, permanent bonus, codex coverage, catalog`);
}finally{rooms.clear();server.closeAllConnections();server.close()}}
check().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
