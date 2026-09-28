const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {roster,byId}=require('../roster.js');
const {CombatEngine,toCombatPosition}=require('../combat-engine.js');
const entry=(characterId,star=2,x=2,y=1)=>({characterId,star,x,y});
const config=(teamA=[entry('shurin')],teamB=[entry('marcus')])=>({teamA,teamB,masteryA:8,masteryB:8,seed:24004});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
let checks=0;
function check(name,fn){fn();checks++;console.log('PASS '+name)}
check('32 data entries, exactly six playable, correct cost distribution and immutable data',()=>{
 assert.equal(roster.length,32);assert.equal(roster.filter(r=>r.implemented).length,6);
 assert.deepEqual([1,2,3].map(c=>roster.filter(r=>r.cost===c).length),[11,11,10]);
 assert.equal(byId.shurin.cost,3);assert.equal(new Set(roster.map(r=>r.id)).size,32);
 for(const r of roster){assert.ok(Object.isFrozen(r.baseStats));assert.ok(r.affiliations.length);assert.ok(r.name&&r.role)}
});
check('free selection, one to three, cross-team same character and independent instance IDs',()=>{
 for(let count=1;count<=3;count++){
  const entries=['rio','shurin','yumin'].slice(0,count).map((id,i)=>entry(id,i+1,2,i));
  const engine=new CombatEngine(config(entries,entries));const units=engine.getResult().units;
  assert.equal(units.length,count*2);assert.equal(new Set(units.map(u=>u.id)).size,count*2);
  assert.equal(engine.run().battleOver,true);
 }
});
check('engine rejects unimplemented/unknown/duplicate/overflow/invalid star/cell/mastery',()=>{
 const bad=[config([entry('cathy')]),config([entry('unknown')]),config([entry('rio'),entry('rio',2,0,0)]),config([entry('rio'),entry('shurin'),entry('yumin'),entry('marcus')]),config([entry('rio',0)]),config([entry('rio',4)]),config([entry('rio',2,-1)]),config([entry('rio',2,3)]),config([entry('rio',2,1.5)]),config([entry('rio'),entry('shurin')]),{...config(),masteryA:21},{...config(),masteryB:0},{...config(),moveInterval:0}];
 for(const c of bad)assert.throws(()=>new CombatEngine(c));
 assert.throws(()=>new CombatEngine(config([],[])).run(),/최소 1명/);
 const empty=new CombatEngine(config([],[]));assert.equal(empty.getResult().units.length,0);
});
check('all A/B local 3x3 cells convert to mirrored 3x6 without changing y',()=>{
 const occupied=new Set();
 for(const team of ['A','B'])for(let x=0;x<3;x++)for(let y=0;y<3;y++){
  const p=toCombatPosition(team,x,y);assert.deepEqual(p,{x:team==='A'?x:5-x,y});occupied.add(p.x+','+p.y);
  const c=config([entry('rio',2,x,y)],[entry('rio',2,x,y)]),u=new CombatEngine(c).getResult().units.find(u=>u.team===team);
  assert.equal(u.x,p.x);assert.equal(u.y,y);
 }
 assert.equal(occupied.size,18);
});
check('all stars apply HP/ATK/AMP/DEF/AS growth, range fixed, mastery and role position',()=>{
 const growth={hp:[1,1.7,2.8],atk:[1,1.7,2.8],amp:[1,1.7,2.8],def:[1,1.15,1.4],as:[1,1.05,1.15]};
 for(const r of roster.filter(r=>r.implemented))for(const star of [1,2,3])for(const mastery of [1,8,20]){
  const e=new CombatEngine({...config([entry(r.id,star,0,0)]),masteryA:mastery});const u=e.getResult().units[0];
  for(const key of Object.keys(growth))near(u.base[key],r.baseStats[key]*growth[key][star-1]*(1+(mastery-1)*.01));
  assert.equal(u.range,r.baseStats.range);assert.equal(u.star,star);
 }
 const e=new CombatEngine({...config([entry('marcus',1,2,0)]),masteryA:1});e.start();near(e.getResult().units[0].maxHp,1260*1.2);
});
check('six characters use checkpoint skill coefficients at all three stars',()=>{
 const expected={shurin:{resolve:[1,1.5,2.5],aoe:[2,2.5,4.5]},marcus:{quake:[1.5,2,3],shock:[1.5,2,3.5]},yumin:{start:[1,1.5,2.5],windDot:[.4,.6,1],windExtra:[.75,1,2]},rio:{shot:[3,4,7],kaeyumiMax:[.3,.4,.7]},justina:{bomb:[.7,.95,1.7],boost:[.35,.5,.9]},nicky:{hot:[.2,.3,.5],guardChance:[.2,.2,.4],counter:[.75,1,2]}};
 for(const [id,values] of Object.entries(expected))for(const star of [1,2,3]){
  const engine=new CombatEngine(config([entry(id,star)]));const u=engine.runtime.units[0];
  for(const [key,arr] of Object.entries(values))assert.equal(u.coefficients[key],arr[star-1]);
  // Use the real skill paths with durable, non-countering targets.
  const rt=engine.runtime,t=rt.units[1];u.atk=100;u.amp=100;t.def=0;t.hp=t.maxHp=100000;rt.rng=()=>.99;
  if(id==='shurin'){for(let i=0;i<12;i++)rt.basicAttack(u,t);near(u.damageSources['결심응진'].raw,300*values.resolve[star-1]);near(u.damageSources['만검귀종'].raw,100*values.aoe[star-1])}
  if(id==='justina'){for(let i=0;i<3;i++)rt.basicAttack(u,t);near(u.damageSources['섬멸 포격'].raw,100*values.bomb[star-1]);near(u.damageSources['강화 기본 공격'].raw,100*values.boost[star-1])}
  if(id==='marcus'){t.name='dummy';rt.time=10;rt.periodicAndSkills();near(u.damageSources['지각변동'].raw,100*values.quake[star-1]);rt.basicAttack(u,t);near(u.damageSources['전사의 투지'].raw,100*values.shock[star-1])}
  if(id==='rio'){rt.time=8;rt.periodicAndSkills();assert.ok(u.channel);rt.time=8.5;rt.periodicAndSkills();near(u.damageSources['정사필중'].raw,100*values.shot[star-1]);rt.time=16;rt.periodicAndSkills();rt.applyCC(u,1);assert.equal(u.channel,null)}
  if(id==='yumin'){u.initialX=2;engine.start();near(u.damageSources['풍류운산'].raw,100*values.start[star-1]);for(let i=0;i<3;i++)rt.basicAttack(u,t);near(u.damageSources['바람 추가 피해'].raw,100*values.windExtra[star-1]);rt.time=1;rt.periodicAndSkills();near(u.damageSources['바람 지속 피해'].raw,100*values.windDot[star-1]);assert.equal(t.ccUntil,1.5)}
  if(id==='nicky'){u.def=0;rt.rng=()=>0;rt.damage(t,u,100,'basic');near(u.damageSources['가드&카운터'].raw,100*values.counter[star-1]);near(u.damageSources['가드&카운터'].targets[t.id].raw,100*values.counter[star-1]);u.hp=u.maxHp*.5;rt.damage(t,u,1,'basic');assert.equal(u.hot,true)}
 }
});
check('target statistics deduplicate activations, count hits, cap overkill and ignore dead targets',()=>{
 const e=new CombatEngine(config()),r=e.runtime,[a,b]=r.units;b.def=0;b.hp=25;
 r.activateSource(a,'test','skill');r.damage(a,b,10,'skill',false,{sourceName:'test'});r.damage(a,b,30,'skill',false,{sourceName:'test'});r.damage(a,b,999,'skill',false,{sourceName:'test'});
 assert.deepEqual({...a.damageSources.test.targets[b.id]},{activations:1,hits:2,raw:40,dealt:25});
 assert.equal(a.damageSources.test.hits,2);r.resetCombatState(a);assert.equal(a.damageSources.test,undefined);
});
check('AoE has one source activation and one activation for each distinct target',()=>{
 const e=new CombatEngine(config([entry('yumin')],[entry('rio',2,0,0),entry('marcus',2,2,2)]));e.start();
 const a=e.getResult().units[0],s=a.damageSources['풍류운산'];assert.equal(s.activations,1);assert.equal(s.hits,2);
 assert.equal(Object.keys(s.targets).length,2);for(const t of Object.values(s.targets)){assert.equal(t.activations,1);assert.equal(t.hits,1)}
 near(Object.values(s.targets).reduce((n,t)=>n+t.dealt,0),s.dealt);
});
check('target instrumentation on/off has identical per-step combat and RNG across 101 seeds',()=>{
 const normalize=e=>{const result=e.getResult();for(const u of result.units)for(const s of Object.values(u.damageSources))delete s.targets;return result};
 for(const seed of [24004,...Array.from({length:100},(_,i)=>i+1)]){
  const c={...config([entry('yumin',seed%3+1,0,2),entry('shurin',2,2,1),entry('nicky',3,2,0)],[entry('yumin',2,0,2),entry('rio',3,1,0),entry('justina',1,2,1)]),seed};
  const on=new CombatEngine(c),off=new CombatEngine({...c,targetStats:false});
  do{on.step();off.step();assert.deepEqual(normalize(on),normalize(off))}while(!on.getResult().battleOver);
  assert.equal(on.runtime.rng(),off.runtime.rng());
  for(const u of on.getResult().units)for(const s of Object.values(u.damageSources))for(const key of ['raw','dealt','hits'])near(Object.values(s.targets).reduce((n,t)=>n+t[key],0),s[key]);
 }
});
check('config and snapshots are detached; concurrent engine instances are isolated',()=>{
 const c=config(),a=new CombatEngine(c),b=new CombatEngine(c);c.teamA[0].star=3;
 const result=a.getResult();result.units[0].hp=0;assert.notEqual(a.getResult().units[0].hp,0);
 a.step();assert.equal(b.getResult().time,0);assert.equal(a.getResult().units[0].star,2);
 assert.deepEqual(a.run(),b.run());
});
check('current public engine preserves HEAD six-character results over 101 seeds',()=>{
 const source=fs.readFileSync(path.join(__dirname,'fixtures/head.game.js'),'utf8');
 const document={querySelector(){return {value:'8',innerHTML:'',textContent:''}}};const ctx=vm.createContext({document});
 vm.runInContext(source.replace(/buildBoard\(\);reset\(\);\s*$/,''),ctx);vm.runInContext('render=()=>{};flash=()=>{};silent=true;',ctx);
 const c=config([entry('shurin',2,2,1),entry('marcus',2,2,0),entry('yumin',2,0,2)],[entry('nicky',2,2,1),entry('rio',2,1,0),entry('justina',2,0,2)]);c.moveInterval=8;
 for(const seed of [24004,...Array.from({length:100},(_,i)=>i+1)]){
  const old=JSON.parse(vm.runInContext(`reset();rng=seeded(${seed});prepareBattle();while(!battleOver&&time<60)tick(.05);JSON.stringify({time,units:units.map(u=>({name:u.name,hp:u.hp,x:u.x,y:u.y,damage:u.damage,shurin:u.shurin})),rng:rng()})`,ctx));
  const engine=new CombatEngine({...c,seed});const r=engine.run();const now={time:r.time,units:r.units.map(u=>({name:u.name,hp:u.hp,x:u.x,y:u.y,damage:u.damage,shurin:u.shurin})),rng:engine.runtime.rng()};assert.deepEqual(now,old);
 }
});
console.log(checks+' sandbox checks passed');
