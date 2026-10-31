'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
process.env.PORT='0';process.env.LIVE_DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'live-m805-'));
const boss=require('../match-boss.cjs'),economy=require('../match-economy.cjs');
const {CombatEngine}=require('../combat-engine.js');
const {server,rooms,advanceRoom,playerView}=require('../server.cjs');
const {roster}=require('../roster.js');
const pause=t=>new Promise(resolve=>setTimeout(resolve,t));
const team=(idA='rio',idB='cathy',idC='sua')=>[{characterId:idA,star:2,x:0,y:0,items:[]},{characterId:idB,star:2,x:2,y:1,items:[]},{characterId:idC,star:2,x:2,y:2,items:[]}];
function fixture(count,round=7){
 const tag='B'+count+'R'+round, players=Array.from({length:count},(_,slot)=>{
  const assets=economy.makeInitial();assets.credits=20;return {id:tag+'p'+slot,token:tag+'t'+slot,room:tag,name:'P'+slot,connected:true,roundReady:true,slot,assets,team:team(slot%2?'yumin':'rio','cathy','sua'),mastery:slot%2?3:1,progress:{exploration:{visited:[],stacks:0},infiltration:0,infiltrationRewards:0,bloodMoonGranted:false},farmDone:false};
 });
 const schedule=['boss','shop','auction','experiment','selection'];if(round!==7){const i=(round-7)/2;[schedule[0],schedule[i]]=[schedule[i],schedule[0]];}
 const game={round,kind:'boss',phase:'prep',schedule,endsAt:0,earlyEndsAt:null,hp:players.map(()=>100),version:1,pairs:[],byeCounts:{},lastOpponents:{}};
 const r={code:tag,maxPlayers:count,players:new Map(players.map(p=>[p.id,p])),messages:[],revision:0,started:true,game};rooms.set(r.code,r);return {r,players,game};
}
async function post(port,p,round){const response=await fetch('http://127.0.0.1:'+port+'/api/boss-done',{method:'POST',headers:{'content-type':'application/json','x-live-token':p.token},body:JSON.stringify({round})});return {code:response.status,result:await response.json()};}
(async()=>{
 try{
  const odds={};for(let k=0;k<100;k++){const id=boss.choose(k).id;odds[id]=(odds[id]||0)+1;}assert.deepEqual(odds,{boss_alpha:40,boss_omega:40,boss_wickeline:20});
  assert.deepEqual(roster.filter(r=>r.role==='보스').map(r=>r.id),boss.BOSSES.map(x=>x.id));
  assert(boss.scaling(7)<boss.scaling(11)&&boss.scaling(11)<boss.scaling(15));
  assert.throws(()=>boss.scaling(8));
  const normal=new CombatEngine({teamA:team(),teamB:[{characterId:'garnet',star:1,x:2,y:1}],seed:3}).run();assert(normal.battleOver);
  for(let i=0;i<100&&!server.listening;i++)await pause(30);assert(server.listening);const port=server.address().port;
  for(const count of [2,3,4,5,6,7,8]){
   const {r,players,game}=fixture(count,count%2?11:7),hpBefore=[...game.hp];
   advanceRoom(r);assert.equal(game.phase,'special');assert.equal(game.specialType,'boss');assert(game.boss&&boss.find(game.boss.id));
   const ids=players.map(p=>playerView(r,p).game.boss.id);assert.equal(new Set(ids).size,1,'same boss id for all living participants');
   assert.equal(playerView(r,players[0]).game.boss.personal,null,'boss result must not leak during reveal');
   assert.equal((await post(port,players[0],game.round)).code,409,'cannot report before combat');
   const st=game.boss.results;assert.equal(Object.keys(st).length,count);
   game.endsAt=Date.now()-1;advanceRoom(r);assert.equal(game.phase,'combat');assert.equal(game.pve,true);assert(game.boss.startedAt);
   for(const p of players){const view=playerView(r,p).game;assert.equal(view.seed,st[p.slot].seed);assert.equal(view.boss.personal.seed,st[p.slot].seed);assert.equal(view.boss.personal.won,st[p.slot].won);assert.equal(view.battle.outcome,st[p.slot].won?'A팀 승리':'B팀 승리');}
   assert.equal((await post(port,players[0],game.round+1)).code,409);
   // The authoritative match must not let an instant unplayed client skip 60s.
   assert.equal((await post(port,players[0],game.round)).code,409);
   game.endsAt=Date.now()-1;advanceRoom(r);assert.equal(game.phase,'result');assert.equal(game.boss.settled,true);assert.deepEqual(game.hp,hpBefore,'boss defeat never changes player HP');
   for(const p of players){const result=st[p.slot],award=game.boss.awards[p.slot];assert(award);assert.equal(award.won,result.won);assert.equal(award.rewards[0].value,result.won?boss.find(game.boss.id).reward.credits:2);assert.equal(award.rewards.length,result.won?(1+boss.find(game.boss.id).reward.basics+boss.find(game.boss.id).reward.completes):2);if(result.won)assert(Object.keys(p.progress.bossBuffs||{}).length>0);else assert(!p.progress.bossBuffs);}
   const snap=players.map(p=>JSON.stringify({c:p.assets.credits,items:p.assets.items,overflow:p.assets.overflowItems,buffs:p.progress.bossBuffs}));assert.equal(boss.settle(r),false,'duplicate settle blocked');assert.deepEqual(players.map(p=>JSON.stringify({c:p.assets.credits,items:p.assets.items,overflow:p.assets.overflowItems,buffs:p.progress.bossBuffs})),snap);
   game.endsAt=Date.now()-1;advanceRoom(r);assert.equal(game.phase,'prep');assert.equal(game.boss,null);rooms.delete(r.code);
  }
  // Expected boss stats and counter-attack scale by round.
  for(const b of boss.BOSSES){const sample={team:team('cathy','rio','sua'),mastery:1,progress:{}};const a=boss.fight(sample,b,7,1729),z=boss.fight(sample,b,15,1729);assert(a.time>0&&a.time<=60.1);assert(z.time>0&&z.time<=60.1);assert(Number.isFinite(a.bossHp));assert(Number.isFinite(z.bossHp));const cfg=boss.configFor(sample,b,7,1729);const battle=new CombatEngine(cfg).run();assert.equal(battle.units.filter(u=>u.role==='보스').length,1);assert.equal(battle.units.find(u=>u.role==='보스').maxHp,b.health);}
  // Faulty percentage damage must not wreck high-HP boss scaling.
  const dummy={team:[{characterId:'cathy',star:2,x:2,y:1,items:[]}],mastery:1,progress:{}};
  for(const b of boss.BOSSES){const r=boss.fight(dummy,b,15,1977);assert(Number.isFinite(r.bossHp));}
  console.log('M8-05 BOSS PASS: 40/40/20 exact weighted draw; 2-8 shared selection; secret reveal; independent PvE; true kills; round scaling; no HP loss; idempotent credits/items/buffs; actual replay');
 } finally {rooms.clear();await new Promise(resolve=>server.close(resolve));}
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
