'use strict';
const assert=require('node:assert/strict');
const {CombatEngine}=require('../js/shared/combat-engine.js');
const {CARDS}=require('../js/server/match-augment.cjs');
const economy=require('../js/server/match-economy.cjs');
const gray=require('../js/server/gray-economy.cjs');
const unit=(characterId,x=1,y=1)=>({characterId,star:1,x,y,items:[]});
const A=[unit('aya')],B=[unit('rozzi')];
let checks=0;
const eq=(a,b,m)=>{assert.equal(a,b,m);checks++};
const near=(a,b,m)=>{assert.ok(Math.abs(a-b)<1e-6,`${m}: ${a} != ${b}`);checks++};
function start(a=[],b=[],cfg={}){const e=new CombatEngine({teamA:A,teamB:B,seed:123,round:16,augmentsA:a,augmentsB:b,...cfg});e.start();for(const u of e.runtime.units)u.critChance=0;return e}
const members=(e,t)=>e.runtime.units.filter(u=>u.team===t&&!u.dead);
function hit(e,s,d,raw,kind='basic'){return e.runtime.damage(s,d,raw,kind,true,{guardable:false})}
for(const t of ['A','B']){
 const other=t==='A'?'B':'A';
 let e=start(t==='A'?['P23']:[],t==='B'?['P23']:[]),a=members(e,t)[0],b=members(e,other)[0];near(hit(e,a,b,100),100,`P23 outgoing ${t}`);near(hit(e,b,a,100),90,`P23 incoming ${t}`);
 e=start(t==='A'?['P25']:[],t==='B'?['P25']:[],{purpleChoices:{A:{tiles:[[1,1],[0,0]]},B:{tiles:[[1,1],[0,0]]}}});a=members(e,t)[0];b=members(e,other)[0];near(hit(e,a,b,100),130,`P25 boost ${t}`);near(hit(e,b,a,100),0,`P25 immunity ${t}`);
 e=start(t==='A'?['P29']:[],t==='B'?['P29']:[]);a=members(e,t)[0];b=members(e,other)[0];b.hp=b.maxHp*.10;hit(e,a,b,1);eq(b.dead,true,'P29 execution');eq(b.deathEpoch,1,'P29 single death');
 e=start(t==='A'?['G028','G063']:[],t==='B'?['G028','G063']:[]);a=members(e,t)[0];b=members(e,other)[0];a.hp=40;a.skill.shield=10;hit(e,b,a,55);eq(a.dead,true,'G028/G063 lethal hit');
 e=start(t==='A'?['P20']:[],t==='B'?['P20']:[],{teamA:[unit('aya',0,0),unit('rozzi',1,1),unit('rio',2,2)],teamB:[unit('aya',0,0),unit('rozzi',1,1),unit('rio',2,2)]});a=members(e,t)[0];const foes=members(e,other);const depth=u=>u.team==='A'?u.initialX:5-u.initialX;const rear=foes.find(u=>depth(u)===0),mid=foes.find(u=>depth(u)===1);eq(e.runtime.target(a).id,rear.id,'P20 priority');near(hit(e,a,rear,100),120,'P20 rear');near(hit(e,a,mid,100),100,'P20 middle');
}
{
 const e=start(['P11'],[],{teamA:[unit('aya',0,0),unit('rozzi',1,1),unit('rio',2,2)]}),a=members(e,'A'),b=members(e,'B')[0];hit(e,b,a[0],200);const hp=a[0].hp;e.runtime.heal(a[0],100);assert(a[0].hp>hp,'P11 shared heal');checks++;const healed=a[0].hp;hit(e,b,a[1],1);assert(a[0].hp<healed&&a[0].hp>hp,'P11 heal persists');checks++;hit(e,b,a[1],100000);eq(a.filter(u=>u.dead).length,3,'P11 all members die');eq(a.every(u=>u.deathEpoch===1),true,'P11 unique deaths');
}
{
 const e=start(['P15']);const b=members(e,'B')[0];eq(e.runtime.activateSource(b,'test skill','skill'),false,'P15 first cast');eq(e.runtime.activateSource(b,'test skill','skill'),false,'P15 second cast');eq(e.runtime.activateSource(b,'test skill','skill'),true,'P15 third cast');eq(e.drainEvents().filter(x=>x.type==='augment'&&x.id==='P15').length,2,'P15 alerts');
}
{
 const e=start(['P42'],[],{teamB:[unit('aya',0,0),unit('rozzi',2,0),unit('rio',1,1)]});for(const u of members(e,'B'))eq(u.x,8-u.initialX,'P42 actual reversal');
}
{
 const a=economy.makeInitial();a.augmentIds=['G004','G015'];a.infusionIds=[...a.augmentIds];gray.settlePvP(a,{round:1,lost:true});gray.spend(a,10);economy.roundIncome(a,2);eq(gray.data(a).freeRerolls,2,'G004/G015 stack same prep');economy.roundIncome(a,3);eq(gray.data(a).freeRerolls,0,'G004/G015 expire');
}
// Focused coverage of formerly disconnected buffs and shield-only damage.
{
 const e=start(['P06'],[],{teamA:[unit('aya',0,0),unit('rozzi',1,1),unit('rio',2,2)]});near(hit(e,members(e,'A')[0],members(e,'B')[0],100,'skill'),140,'P06 diagonal spell boost');
}
{
 const e=start(['P48'],[],{teamA:[unit('aya',0,0),unit('rozzi',1,1)]});const a=members(e,'A'),b=members(e,'B')[0];for(const u of e.runtime.units){u.nextAttack=100;u.nextMove=100;u.ccUntil=100;}a[0].hp=a[0].maxHp*.5; e.runtime.tick(3.1);near(hit(e,b,a[0],100),55,'P48 45% mitigation');
}
{
 const e=start(['P41'],[],{purpleChoices:{A:{tactic:'long'}}});const a=members(e,'A')[0],b=members(e,'B')[0];for(const u of e.runtime.units){u.nextAttack=100;u.nextMove=100;u.ccUntil=100;} e.runtime.tick(3.1);near(hit(e,a,b,100,'skill'),108,'P41 first stack');
}
{
 const e=start(['G063']),a=members(e,'A')[0],b=members(e,'B')[0];a.hp=a.maxHp*.5;a.skill.shield=10;const old=a.hp;hit(e,b,a,10);near(a.hp,old+a.maxHp*.05,'G063 shield-only break');
}
// Runtime coverage is not a proof of each conditional card's advertised behavior.
let smoke=0;
assert.equal(Object.values(CARDS).flat().length,130);
for(const card of Object.values(CARDS).flat())for(const t of ['A','B']){
 const e=new CombatEngine({teamA:[unit('aya',0,0),unit('rozzi',1,1),unit('rio',2,2)],teamB:[unit('marcus',0,0),unit('kenneth',1,1),unit('cathy',2,2)],round:16,seed:777,augmentsA:t==='A'?[card.id]:[],augmentsB:t==='B'?[card.id]:[]});const r=e.run();assert(r.outcome&&Number.isFinite(r.time)&&r.units.every(u=>Number.isFinite(u.hp)&&Number.isFinite(u.maxHp)),`${card.id}/${t}`);smoke++;
}
console.log(`M10-20 REGRESSION PASS: ${checks} targeted assertions; ${smoke} card/team runtime scenarios`);
