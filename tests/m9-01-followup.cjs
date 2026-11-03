'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
process.env.PORT='0';process.env.LIVE_DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'live-m901follow-'));
const {server,rooms,advanceRoom,playerView}=require('../server.cjs');
const {roundKind,pvpHpDamage}=require('../round-rules.cjs');
const boss=require('../match-boss.cjs');
const {CombatEngine}=require('../combat-engine.js');
const economy=require('../match-economy.cjs');
let checks=0;
const ck=(condition,message)=>{assert(condition,message);checks++};
const team=id=>[{characterId:id,star:2,x:2,y:1,items:[]}];
function fixture(n,round,kind,phase='result'){
 const list=Array.from({length:n},(_,slot)=>({id:'p'+slot,token:'t'+slot,slot,name:'PLAYER'+slot,connected:true,ready:true,roundReady:false,assets:economy.makeInitial(),mastery:2,team:team(slot%2?'rio':'kenneth'),progress:{exploration:{visited:[],stacks:0},infiltration:0,infiltrationRewards:0,bloodMoonGranted:false},augments:[]}));
 const g={round,kind,phase,endsAt:0,earlyEndsAt:null,hp:list.map(()=>100),version:1,pairs:[],nextPairs:undefined,byeCounts:{},previousByeSlot:null,lastOpponents:{},schedule:['shop','boss','auction','pvp','selection']};
 const r={code:'F'+n+round+kind,players:new Map(list.map(p=>[p.id,p])),maxPlayers:n,messages:[],started:true,revision:0,game:g};rooms.set(r.code,r);return {r,g,list};
}
(async()=>{
 try {
  for(let i=0;i<100&&!server.listening;i++)await new Promise(resolve=>setTimeout(resolve,15));
  ck(server.listening,'server listening');
  for(const round of [1,3,10])ck(roundKind(round,['boss','shop','auction','pvp','selection'])==='farm','farm schedule');
  for(const [r,damage] of [[2,8],[4,11],[6,11],[7,12],[8,14],[9,15],[11,16],[12,17],[13,19],[14,20],[15,22],[16,23]])ck(pvpHpDamage(r)===damage,'pvp damage '+r);
  ck(pvpHpDamage(18)>pvpHpDamage(16),'late game damage rise');
  const wick=boss.find('boss_wickeline');ck(wick.reward.credits===9&&wick.reward.basics===2&&wick.reward.completes===1&&wick.buff.wickeline===40,'Wickeline nerf');
  for(const n of [2,3,4,5,6,7,8]){
   // Each room advances from R1 farm results into announced R2 pairings.
   const {r,g,list}=fixture(n,1,'farm');advanceRoom(r);
   ck(g.round===2&&g.kind==='pvp'&&g.phase==='prep','R2 prep');
   ck(g.nextPairs.length===Math.floor(n/2),'predeclared pair count '+n);
   const slots=g.nextPairs.flatMap(p=>[p.a,p.b]);if(n%2)slots.push(g.nextByeSlot);
   ck(new Set(slots).size===n,'exactly once assignment '+n);
   for(const p of list){const view=playerView(r,p).game,existing=g.nextPairs.find(x=>x.a===p.slot||x.b===p.slot);
    ck(view.opponentSlot===(existing?(existing.a===p.slot?existing.b:existing.a):null),'public opponent slot '+n);
    ck(view.bye===!existing,'bye preview '+n);
   }
   g.endsAt=0;advanceRoom(r);ck(g.phase==='intro','prep->intro '+n);
   g.endsAt=0;advanceRoom(r);ck(g.phase==='combat','intro->combat '+n);
   ck(g.pairs.length===g.nextPairs.length,'combat pair count '+n);
   ck(g.pairs.every(x=>g.nextPairs.some(pair=>pair.a===x.a&&pair.b===x.b)),'announced pair is real combat pair '+n);
   rooms.delete(r.code);
  }
  // Dedicated midgame farm must process as a PvE encounter with rewards (not a duel).
  {const {r,g}=fixture(3,10,'farm','prep');g.nextPairs=[];g.endsAt=0;advanceRoom(r);ck(g.phase==='intro','R10 prep -> intro');g.endsAt=0;advanceRoom(r);ck(g.phase==='combat'&&g.pve===true,'R10 has PvE combat');ck(Object.keys(g.farmResults||{}).length===3,'R10 farm rewards per active player');rooms.delete(r.code);}
  // Player damage must use the new table, not the old 5+2/3 formula.
  {const {r,g}=fixture(2,12,'pvp','combat');g.pve=false;g.pairs=[{a:0,b:1,battle:{outcome:'A팀 승리',personaTierA:0,personaTierB:0}}];g.endsAt=0;advanceRoom(r);ck(g.hp[1]===83&&g.hp[0]===100,'R12 17 HP damage');rooms.delete(r.code);}
  // Heart triggers on a *different* allied lethal target; both teams are immortal, still take damage.
  {const cfg={teamA:[{characterId:'hart',star:1,x:0,y:1,items:[]},{characterId:'rio',star:1,x:2,y:1,items:[]}],teamB:[{characterId:'kenneth',star:1,x:2,y:1,items:[]}],masteryA:1,masteryB:1,seed:127};
   const eng=new CombatEngine(cfg);eng.start();const hart=eng.runtime.units.find(u=>u.characterId==='hart'),ally=eng.runtime.units.find(u=>u.characterId==='rio'),foe=eng.runtime.units.find(u=>u.team==='B');ck(hart&&ally&&foe,'test combat actors');
   eng.runtime.damage(foe,ally,100000,'skill',true,{guardable:false,skipHooks:true});
   ck(ally.hp===1&&!ally.dead,'lethal teammate prevented');ck(hart.skill.hartUsed===true,'hart used on teammate');
   ck(hart.skill.immortalUntil>0&&ally.skill.immortalUntil>0&&foe.skill.immortalUntil>0,'immortality both sides');
   const before=foe.hp;eng.runtime.damage(ally,foe,45,'skill',true,{skipHooks:true});ck(foe.hp<before,'immortality does not block damage');
  }
  // Duplicate item stats stack, but proc state is unique and not duplicated.
  {const one=new CombatEngine({teamA:[{characterId:'rio',star:1,x:1,y:1,items:['레가투스']}],teamB:team('kenneth'),seed:23});
   const two=new CombatEngine({teamA:[{characterId:'rio',star:1,x:1,y:1,items:['레가투스','레가투스']}],teamB:team('kenneth'),seed:23});one.start();two.start();const a=one.runtime.units.find(x=>x.team==='A'),b=two.runtime.units.find(x=>x.team==='A');ck(b.critChance>a.critChance,'two copies base crit stacks');ck(b.as>a.as,'two copies AS stacks');ck(Object.keys(b.itemEffects).length===1,'one unique proc state');}
  console.log('M9-01 FOLLOWUP PASS:',checks,'checks · 2-8 player preview/duels, R10 farm, HP damage, Hart immortality, unique item proc');
 }finally {rooms.clear();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));process.exit(0);}
})().catch(e=>{console.error(e);process.exitCode=1});
