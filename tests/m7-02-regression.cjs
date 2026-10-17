'use strict';
// Focused regressions for renderer boot linkage, server phase guards, and M7 combat effects.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const x of ['m6-pixi-adapter.css','pixi.min.js','m6-pixi-adapter.js','m611-first-paint','m611-qa'])assert(html.includes(x),'Missing M6 presentation boot asset/guard: '+x);
assert(html.includes('L.I.V.E. M7-01'),'M7 content/build label lost');
assert(html.indexOf('pixi.min.js')<html.indexOf('m6-pixi-adapter.js'),'Pixi library must load before adapter');
const {CombatEngine}=require('../combat-engine.js');
const mk=(id,star=1)=>({characterId:id,star,x:0,y:1});
const target=()=>({characterId:'garnet',star:3,x:2,y:1});
const runTo=(battle,t)=>{battle.start();while(battle.getResult().time<t&&!battle.getResult().battleOver)battle.step();return battle.getResult()};
const alex=runTo(new CombatEngine({teamA:[mk('alex')],teamB:[target()],seed:8,arenaRegion:'lab'}),4);
const a=alex.units.find(u=>u.characterId==='alex');
assert.equal(a.damageSources['정밀 폭격'].activations,1,'Alex should start with one bombardment');
assert.equal(a.damageSources['정밀 폭격'].hits,6,'Alex first bombardment exactly six damage ticks');
let grenades=0;
for(let seed=1;seed<=25;seed++){
 const result=runTo(new CombatEngine({teamA:[mk('haze')],teamB:[target()],seed,arenaRegion:'lab'}),7.1);
 const h=result.units.find(u=>u.characterId==='haze');
 const g=h.damageSources['40mm 유탄'];
 if(g.activations){grenades+=g.activations;assert.equal(g.hits,g.activations,'Haze grenade should count one hit per actual target, not 2');}
}
assert(grenades>0,'Expected to sample grenades');
// Real server room advance uses an interval; force deadlines without waiting 60 seconds.
process.env.PORT=String(23000+(process.pid%10000));
process.env.LIVE_DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'live-m7-02-'));
const {server,rooms}=require('../server.cjs');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
 const progress=()=>({exploration:{visited:[],stacks:0},infiltration:0,infiltrationRewards:0,bloodMoonGranted:false});
 const players=[0,1].map(slot=>({id:'q'+slot,slot,name:'QA-'+slot,connected:true,team:slot===0?[]:[{characterId:'garnet',star:1,x:2,y:1,items:[]}],mastery:1,progress,farmDone:false,roundReady:false}));
 const room={code:'M7QA',started:true,players:new Map(players.map(x=>[x.id,x])),messages:[],revision:1,game:{round:2,phase:'prep',endsAt:Date.now()-5000,hp:[100,100],version:1,earlyEndsAt:null}};
 rooms.set(room.code,room);
 await delay(450);
 assert.equal(room.game.phase,'prep','Empty team must not start a combat');
 assert.match(room.game.prepNotice||'',/편성 없음/);
 players[0].team=[{characterId:'alex',star:1,x:2,y:1,items:[]}];
 room.game.endsAt=Date.now()-10;
 await delay(450);
 assert.equal(room.game.phase,'combat','Both valid teams must start combat');
 assert(room.game.battle&&room.game.battle.time>0&&room.game.battle.time<=60,'Authoritative combat result');
 assert(Number.isFinite(room.game.combatStartedAt),'Background replay needs combatStartedAt');
 assert(room.game.region,'PvP region was not set');
 // Invalid roster must stay in preparation instead of being silently counted as a draw.
 players[0].team=[{characterId:'not-a-unit',star:1,x:2,y:1,items:[]}];
 room.game={round:4,phase:'prep',endsAt:Date.now()-500, hp:[100,100],version:8,earlyEndsAt:null};
 await delay(450);
 assert.equal(room.game.phase,'prep','Invalid PvP config should retry preparation');
 assert.match(room.game.prepNotice||'',/재시도/);
 // PvE rounds must not incorrectly select a PvP arena region.
 players[0].team=[{characterId:'alex',star:1,x:2,y:1,items:[]}];
 room.game={round:1,phase:'prep',endsAt:Date.now()-500, hp:[100,100],version:14,earlyEndsAt:null};
 await delay(450);
 assert.equal(room.game.phase,'combat','Valid PvE should start');
 assert.equal(room.game.pve,true);
 assert.equal(room.game.region,null,'Farming combat should not inherit PvP region');
 rooms.delete(room.code);
 console.log('M7-02 PASS: Pixi boot links, intro guard, Alex 6 ticks, Haze single-hit grenade, server empty-team guard & valid-round start');
 server.close(()=>process.exit(0));
})().catch(e=>{console.error(e);rooms.clear();server.close(()=>process.exit(1));process.exitCode=1;});
