'use strict';
const assert = require('node:assert/strict');
const {CombatEngine,coefficients} = require('../combat-engine.js');
const {byId} = require('../roster.js');
const items = require('../items.js');
const economy = require('../match-economy.cjs');
const experiment = require('../match-experiment.cjs');
const boss = require('../match-boss.cjs');
function c(id,star=2,x=2,y=1,gear=[]){return {characterId:id,star,x,y,items:gear}}
function fight(A,B,seed=17,extra={}){return new CombatEngine({teamA:A,teamB:B,masteryA:8,masteryB:8,seed,...extra}).run()}
// 1) All published balance values agree with approved design.
assert.equal(byId.rozzi.baseStats.atk,65);assert.equal(byId.rozzi.baseStats.as,.84);
assert.equal(byId.bernice.baseStats.as,.83);assert.equal(byId.bernice.baseStats.range,2);
assert.equal(byId.nadine.baseStats.atk,74);assert.equal(byId.haze.baseStats.amp,145);
assert.deepEqual(coefficients.irem.punch,[1.15,1.8,3.1]);
assert.deepEqual(coefficients.cathy.op,[1.4,1.9,2.9]);
assert.deepEqual(coefficients.johann.aura,[.08,.13,.22]);
assert.deepEqual(coefficients.yumin.start,[1,1.35,2.25]);
assert.deepEqual(coefficients.bernice.pellet,[1.05,1.05,1.05]);
assert.deepEqual(coefficients.bernice.scatter,[.60,.60,.60]);
for(const [id,field,value] of [['살라딘의 화살통','as',.32],['레가투스','as',.16],['레가투스','crit',.35],['블래스터 헬멧','as',.25],['레이더','as',.16],['팬텀 자켓','as',.18]])assert.equal(items.all[id].stats[field],value);
// 2) Aozai as both teams' equipment: no JSON circular references, deterministic battle.
for(const seed of [1,2,3,47,150]){
 const input={teamA:[c('marcus',3,2,1,['아오자이'])],teamB:[c('kenneth',3,2,1,['아오자이'])],masteryA:9,masteryB:9,seed};
 const x=new CombatEngine(input).run(),y=new CombatEngine(input).run();
 assert(x.battleOver);assert.deepEqual(x,y);
 for(const u of x.units)assert(Number.isFinite(u.hp));
}
// 3) Updated item policy: duplicates stack statistics but each unique effect fires once.
const one=new CombatEngine({teamA:[c('rio',2,0,1,['레가투스'])],teamB:[c('kenneth')],masteryA:1,masteryB:1,seed:7});
const two=new CombatEngine({teamA:[c('rio',2,0,1,['레가투스','레가투스'])],teamB:[c('kenneth')],masteryA:1,masteryB:1,seed:7});
one.start();two.start();
const oneUnit=one.runtime.units.find(x=>x.team==='A'),twoUnit=two.runtime.units.find(x=>x.team==='A');
assert(twoUnit.as>oneUnit.as);assert(twoUnit.critChance>oneUnit.critChance);
assert.deepEqual(Object.keys(twoUnit.itemEffects),['레가투스']);
const a=economy.makeInitial(),uid=a.owned[0].uid;
a.items.push('레가투스','레가투스');economy.action(a,'equip',{uid,index:a.items.length-2});
economy.action(a,'equip',{uid,index:a.items.length-1});
assert.equal(a.owned[0].items.filter(x=>x==='레가투스').length,2);
economy.ownTeam(a);assert.equal(a.owned[0].items.filter(x=>x==='레가투스').length,2);
// 4) No live virtual participant. Odd cooperative slot gets an immediate reward bye;
// personal minigame keeps solo player interactive and the unused seat inactive.
for(const n of [3,5,7])for(const kind of experiment.KINDS){
 const ps=Array.from({length:n},(_,i)=>({slot:i,team:[],assets:economy.makeInitial()}));
 const enc=experiment.open(ps,kind,5000),single=enc.groups.find(g=>g.slots[1]===null);
 assert(single);assert.equal(enc.groups.flatMap(g=>g.slots.filter(x=>x!==null)).length,n);
 assert(!('botAt' in single));
 if(kind==='divide'||kind==='bomb'){
  assert(single.bye);assert.equal(single.engine,null);
  assert.equal(single.reward.credits,4);assert.equal(single.reward.exp,kind==='divide'?4:2);
  assert.equal(single.reward.items.length,1);
  const v=experiment.view(enc,single.slots[0]);assert(v.bye);assert(!v.virtualPartner);
  assert.throws(()=>experiment.action(enc,single.slots[0],{seq:1,action:'chat',text:'hello'},5500),/부전승/);
 }else{
  assert(single.solo);assert(!single.bye);
  assert(single.engine.snapshot().game.players.B.done);
  assert(!experiment.view(enc,single.slots[0]).virtualPartner);
 }
}
// 5) Boss gating and per-round stats, with original odds after R7.
assert.equal(boss.choose(0,7).id,'boss_alpha');assert.equal(boss.choose(49,7).id,'boss_alpha');
assert.equal(boss.choose(50,7).id,'boss_omega');assert.equal(boss.choose(99,7).id,'boss_omega');
assert.equal(boss.choose(99,9).id,'boss_wickeline');
assert.equal(boss.publicInfo(boss.find('boss_omega'),7).health,8500);
assert.equal(boss.publicInfo(boss.find('boss_omega'),7).attack,128);
assert.equal(boss.publicInfo(boss.find('boss_wickeline'),9).health,Math.round(14200*1.24*.75));
// 6) Wickeline proc belongs to the same strike; shield fully absorbing damage still consumes it.
{
 const b=new CombatEngine({teamA:[c('rio')],teamB:[c('kenneth')],masteryA:1,masteryB:1,seed:120});
 b.start();b.drainEvents();const u=b.runtime.units.find(v=>v.team==='A'),e=b.runtime.units.find(v=>v.team==='B');
 u.wickelineDamage=70;u.wickelineReadyAt=0;e.skill.shield=100000;
 const beforeShield=e.skill.shield;
 const hit=b.runtime.damage(u,e,100,'basic');const after=b.runtime.time;
 assert.equal(hit,0);assert(e.skill.shield<beforeShield);
 assert.equal(u.wickelineReadyAt,after+6);assert.equal(u.damageSources['위클라인 충전'].activations,1);
 assert.equal(b.drainEvents().filter(x=>x.type==='damage').length,0);
 e.skill.shield=0;
 const again=b.runtime.damage(u,e,100,'basic');assert(again>0);
 assert.equal(u.damageSources['위클라인 충전'].activations,1);
}
// 7) Tactical team baseline smoke with varied characters and approved equipment.
let ran=0;
const heroes=Object.keys(byId).filter(x=>!byId[x].pveOnly && [1,2,3].includes(byId[x].cost));
for(let i=0;i<heroes.length;i++)for(let star of [1,2,3])for(let seed=0;seed<3;seed++){
 const a=[c(heroes[i],star,2,0,['살라딘의 화살통']),c('johann',star,0,1),c('yumin',star,0,2)];
 if(a.filter(x=>x.characterId==='johann').length>1 || a.filter(x=>x.characterId==='yumin').length>1){ // duplicate unit names are valid in game.
 }
 const b=[c('kenneth',star,2,0),c('cathy',star,2,1),c('haze',star,0,2)];
 const result=fight(a,b,6100+i*3+seed);
 assert(result.battleOver);assert(result.time<=60.05);assert(result.units.every(x=>Number.isFinite(x.hp)));
 ran++;
}
console.log('M8-07 PASS: balance constants, dual Aozai, duplicate completed item statistics / unique proc policy, odd-person byes, Wickeline shield, boss gating,',ran,'3v3 smoke combats');
