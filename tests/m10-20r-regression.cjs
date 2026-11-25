'use strict';
const assert=require('node:assert/strict');
const {CombatEngine}=require('../js/shared/combat-engine.js');
const {CARDS}=require('../js/server/match-augment.cjs');
const gray=require('../js/server/gray-economy.cjs');
const economy=require('../js/server/match-economy.cjs');
const unit=(characterId,x=1,y=1,star=1,items=[])=>({characterId,star,x,y,items});
let checks=0;
function eq(a,b,m){assert.equal(a,b,m);checks++}
function ok(a,m){assert.ok(a,m);checks++}
function near(a,b,m){ok(Math.abs(a-b)<1e-6,`${m}: ${a} vs ${b}`)}
function make(a=[],b=[],cfg={}){const e=new CombatEngine({teamA:[unit('aya')],teamB:[unit('rozzi')],seed:123,round:16,augmentsA:a,augmentsB:b,...cfg});e.start();for(const u of e.runtime.units)u.critChance=0;return e}
const team=(e,t)=>e.runtime.units.filter(u=>u.team===t&&u.role!=='소환수');
const hit=(e,a,b,n,k='basic')=>e.runtime.damage(a,b,n,k,true,{guardable:false});
for(const t of ['A','B']){
 const o=t==='A'?'B':'A';
 for(const cards of [[],['P23'],['P48'],['P23','P48']]){
  const e=make(t==='A'?['P29']:cards,t==='B'?['P29']:cards);const a=team(e,t)[0],b=team(e,o)[0];b.hp=b.maxHp*.10;b.purple??={};if(cards.includes('P48'))b.purple.swap={until:10};b.skill.shield=0;
  hit(e,a,b,1);eq(b.dead,true,`${t} P29 ${cards}`);eq(b.deathEpoch,1,'one death');ok(a.purpleExecutorUntil>0,'successful execution buff');eq(e.drainEvents().filter(x=>x.type==='execute').length,1,'single execute event');
  // Garnet and P29 share the exact execute resolver.
  const g=make(t==='A'?[]:cards,t==='B'?[]:cards);const src=team(g,t)[0],dst=team(g,o)[0];dst.hp=100;dst.skill.shield=300;if(cards.includes('P48')){dst.purple??={};dst.purple.swap={until:10}}
  eq(g.runtime.executeTarget(src,dst,'처형식','skill'),true,'Garnet execute resolver');eq(dst.dead,true,'bypass shields and reduction');
 }
 for(const mode of ['invulnUntil','immortalUntil']){
  const e=make(t==='A'?['P29']:[],t==='B'?['P29']:[]);const a=team(e,t)[0],b=team(e,o)[0];b.hp=b.maxHp*.10;b.skill[mode]=10;
  eq(e.runtime.executeTarget(a,b,'집행자의 명령'),false,mode);hit(e,a,b,1);eq(b.dead,false,'protected target');ok(!a.purpleExecutorUntil,'no reward on failed execute');
 }
 const e=make(t==='A'?['P29']:[],t==='B'?['P29']:[],{[o==='A'?'teamA':'teamB']:[unit('jenny')]});const a=team(e,t)[0],b=team(e,o)[0];b.hp=b.maxHp*.1;hit(e,a,b,1);ok(b.hp>0&&!b.dead&&b.skill.revived,'Jenny revival');ok(!a.purpleExecutorUntil,'no reward on revival');
 const p=make(t==='A'?[]:['P25'],t==='B'?[]:['P25'],{purpleChoices:{A:{tiles:[[1,1],[0,0]]},B:{tiles:[[1,1],[0,0]]}}});eq(p.runtime.executeTarget(team(p,t)[0],team(p,o)[0],'처형식','skill'),false,'P25 immunity');
 for(const survivor of ['jenny','ian','aya','hart']){
  const e=make(t==='A'?['P11']:[],t==='B'?['P11']:[],{[t==='A'?'teamA':'teamB']:[unit(survivor,0,0),unit('rio',1,1),unit('rozzi',2,2)]});const a=team(e,t),b=team(e,o)[0];if(survivor==='aya')a[0].skill.immortalUntil=10;
  hit(e,b,a[1],1e6);ok(!a[0].dead&&a[0].hp>0,`${survivor} survives shared depletion ${t}`);ok(a.every(u=>u.dead?u.hp===0:u.hp>0),'consistent life state');ok(a.every(u=>!u.purple.heart.active),'pool dissolved');
  if(survivor!=='hart')eq(a.filter(u=>u.dead).length,2,'only protected member survives');
 }
 const shared=make(t==='A'?['P29']:['P11'],t==='B'?['P29']:['P11'],{[o==='A'?'teamA':'teamB']:[unit('aya',0,0),unit('rio',1,1),unit('rozzi',2,2)]});const a2=team(shared,t)[0],members=team(shared,o);hit(shared,a2,members[0],members.reduce((n,u)=>n+u.maxHp,0)*1.5*.9,'synergy');hit(shared,a2,members[0],1);eq(members[0].dead,true,'execute one shared member');ok(members.slice(1).every(u=>!u.dead&&u.hp>0&&u.purple.heart.active),'others remain in pool');
 const c=make(t==='A'?['P15']:[],t==='B'?['P15']:[]);const caster=team(c,o)[0];for(const n of ['Peacemaker','생명 공유','해방'])eq(c.runtime.activateSource(caster,n,'skill'),true,'automatic survival is not censored');eq(c.runtime.activateSource(caster,'active 1','skill'),false,'censor 1');eq(c.runtime.activateSource(caster,'active 2','skill'),false,'censor 2');eq(c.runtime.activateSource(caster,'active 3','skill'),true,'censor exhausted');
}
// Verify actual Garnet skill branch, not only the shared execute helper.
for(const t of ['A','B'])for(const cards of [[],['P23'],['P48'],['P23','P48']]){
 const o=t==='A'?'B':'A';const e=make(t==='A'?[]:cards,t==='B'?[]:cards,{[t==='A'?'teamA':'teamB']:[unit('garnet')],[o==='A'?'teamA':'teamB']:[unit('rio')]});const a=team(e,t)[0],b=team(e,o)[0];b.hp=b.maxHp*.09;b.skill.shield=b.maxHp*.30;if(cards.includes('P48')){b.purple??={};b.purple.swap={until:10}}e.runtime.periodicAndSkills();eq(b.dead,true,`Garnet actual cast ${t} ${cards}`);eq(b.deathEpoch,1,'Garnet single death');eq(e.drainEvents().filter(x=>x.type==='execute'&&x.unitId===b.id).length,1,'Garnet actual execution event');
}
{
 const e=make(['P11','P05'],[],{teamA:[unit('aya',0,0),unit('rio',1,1),unit('rozzi',2,2)]});const a=team(e,'A'),b=team(e,'B')[0];hit(e,b,a[1],1e6);ok(a.every(u=>!u.dead&&u.hp>0&&u.deathEpoch===1),'P05 full revival after shared depletion');hit(e,b,a[0],1e6);eq(a[0].deathEpoch,2,'legitimate second death after revival');
 const v=make(['P11'],[],{teamA:[unit('aya',0,0),unit('rio',1,1),unit('rozzi',2,2)]});const va=team(v,'A'),vb=team(v,'B')[0];va[0].skill.invulnUntil=10;hit(v,vb,va[1],1e6);ok(!va[0].dead&&va[0].hp===1,'shared depletion respects immunity');
}
// Count-based haste alters charge only, not the number or damage of basic hits.
for(const [id,skill,attacks] of [['katja','조준 사격',8],['rozzi','셈텍스탄 Mk-II',12],['kenneth','업화',15],['abigail','바이너리 스핀',12],['cathy','이머전시OP',8],['irem','냥냥 펀치',8],['mirka','크래시 해머',30]]){
 const results=[];
 for(const mode of ['base','haste','refund']){
  const e=make(mode==='haste'?['P06']:mode==='refund'?['P15']:[],[],{teamA:[unit(id,0,0),unit('aya',1,1),unit('rio',2,2)]});const a=team(e,'A')[0],b=team(e,'B')[0];b.maxHp=b.hp=1e9;b.def=0;a.atk=10;a.amp=10;
  if(mode==='refund'){e.runtime.activateSource(b,'enemy skill','skill');e.runtime.activateSource(b,'enemy skill','skill')}
  for(let i=0;i<attacks;i++){e.runtime.basicAttack(a,b);if(id==='mirka')e.runtime.periodicAndSkills()}
  results.push({casts:a.damageSources[skill]?.activations||0,hits:a.damageSources['기본 공격'].activations});
 }
 ok(results[1].casts>results[0].casts,`${id} haste ${JSON.stringify(results)}`);eq(results[1].hits,results[0].hits,`${id} no extra basic attacks`);ok(results[2].casts>=results[0].casts,`${id} refund does not reduce casts`);
}
// B009 healing reduction and G055 eligible sale/reset.
{
 const e=make(),a=team(e,'A')[0];a.hp=a.maxHp*.1;a.blueSealUntil=10;near(e.runtime.heal(a,100),65,'B009 35% heal reduction');
 const assets=economy.makeInitial();assets.augmentIds=['G055'];gray.data(assets).boughtUids=['fresh'];let c=assets.credits;gray.afterSell(assets,{uid:'fresh'});eq(assets.credits,c,'fresh purchase excluded');gray.afterSell(assets,{uid:'old'});eq(assets.credits,c+1,'first eligible sale');gray.afterSell(assets,{uid:'old2'});eq(assets.credits,c+1,'only one eligible bonus');gray.afterIncome(assets,2,0);gray.afterSell(assets,{uid:'old3'});eq(assets.credits,c+2,'eligible sale resets');
}
// Real simulation sweep checks terminal HP and deterministic result, not merely termination.
let simulations=0;
const cards=CARDS.purple.map(c=>c.id);
for(const card of cards)for(const t of ['A','B'])for(let seed=1;seed<=6;seed++){
 const cfg={teamA:[unit('jenny',0,0),unit('ian',1,1),unit('garnet',2,2)],teamB:[unit('hart',0,0),unit('rozzi',1,1),unit('aya',2,2)],seed,round:16,augmentsA:t==='A'?['P11',card]:['P29'],augmentsB:t==='B'?['P11',card]:['P29']};
 const e=new CombatEngine(cfg);const r=e.run();assert(r.outcome&&Number.isFinite(r.time)&&r.time<=60.1,`${card}/${t}/${seed} result`);
 for(const u of r.units){assert(Number.isFinite(u.hp)&&Number.isFinite(u.maxHp)&&u.maxHp>0,`${card}/${t}/${seed} finite ${u.name}`);assert(u.dead?u.hp===0:u.hp>0,`${card}/${t}/${seed} life state ${u.name}: ${u.hp}`)}
 const deaths=e.drainEvents().filter(x=>x.type==='execute');for(const x of deaths)assert(r.units.some(u=>u.id===x.unitId&&u.deathEpoch>=1),'execute event backed by death');simulations++;
}
console.log(`M10-20R REGRESSION PASS: ${checks} targeted assertions, ${simulations} shared-life/execute simulations`);
