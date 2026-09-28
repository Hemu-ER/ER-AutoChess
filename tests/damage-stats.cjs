const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const current=require('./runtime-source.cjs')();
const baseline=fs.readFileSync(path.join(__dirname,'fixtures/pre-stats.game.js'),'utf8');
function runtime(source){
 const nodes=new Map();
 const document={querySelector(s){
  if(!nodes.has(s))nodes.set(s,{value:s==='#moveInterval'?'0.5':'8',innerHTML:'',textContent:'',checked:true,entries:[],prepend(x){this.entries.push(x.innerHTML)},querySelector(){return {focus(){}}}});
  return nodes.get(s);
 },createElement(){return {innerHTML:''}}};
 const ctx=vm.createContext({assert,console,document});
 vm.runInContext(source.replace(/buildBoard\(\);reset\(\);\s*$/,''),ctx);
 vm.runInContext('render=()=>{};flash=()=>{};silent=true;',ctx);
 return {ctx,nodes,run(code){return vm.runInContext(code,ctx,{timeout:30000})}};
}
const r=runtime(current);
const report=r.run(`
function near(a,b){assert.ok(Math.abs(a-b)<1e-8,a+' != '+b)}
function init(){units=[];time=0;battleOver=false;stage={A:{},B:{}};shared={A:{swim:0},B:{swim:0}}}
function unit(name,team,x,y){let u=makeUnit(name,1,[x,y]);u.team=team;u.atk=100;u.def=0;u.hp=u.maxHp=100000;u.nextAttack=Infinity;u.nextMove=Infinity;units.push(u);return u}
init();let a=unit('슈린','A',2,1),b=unit('유민','B',3,1);b.name='표적';b.def=100;b.hp=30;
activateSource(a,'시험 피해','skill');damage(a,b,100,'skill',false,{sourceName:'시험 피해'});
assert.equal(a.damageSources['시험 피해'].raw,100);assert.equal(a.damageSources['시험 피해'].dealt,30);assert.equal(a.damageSources['시험 피해'].hits,1);
damage(a,b,100,'skill',false,{sourceName:'시험 피해'});assert.equal(a.damageSources['시험 피해'].hits,1);assert.equal(a.damageSources['시험 피해'].raw,100);
activateSource(a,'시험 버프','passive');assert.deepEqual({...a.damageSources['시험 버프']},{kind:'passive',activations:1,hits:0,raw:0,dealt:0,targets:Object.create(null)});
init();a=unit('슈린','A',2,1);b=unit('니키','B',3,1);a.def=100;b.def=100;b.amp=100;rng=()=>0;
damage(a,b,100,'basic',false,{sourceName:'기본 공격'});
assert.equal(a.damageSources['기본 공격'].raw,100);assert.equal(a.damageSources['기본 공격'].dealt,10);
assert.equal(b.damageSources['가드&카운터'].raw,100);assert.equal(b.damageSources['가드&카운터'].dealt,50);assert.equal(b.damageSources['가드&카운터'].activations,1);assert.equal(b.damageSources['가드&카운터'].hits,1);
// A single Shurin attacks; inactive allies supply 3-swimsuit, two passive dummies survive.
init();a=unit('슈린','A',2,1);a.as=1;a.nextAttack=1;
unit('마커스','A',0,0).name='비활성 아군1';unit('유민','A',0,2).name='비활성 아군2';
b=unit('유민','B',3,1);b.name='표적1';b.def=50;
let c=unit('유민','B',2,0);c.name='표적2';c.def=50;
stage.A.수영복=3;let history=[];
while(a.basicCount<12&&time<20&&!battleOver){let n=a.basicCount;tick(.05);if(a.basicCount!==n)history.push({attack:a.basicCount,phase:a.shurin.phase,normal:a.shurin.normalAttacks,resolve:a.damageSources['결심응진'].activations})}
assert.equal(a.basicCount,12);
assert.deepEqual(history.map(x=>x.resolve),[0,0,0,1,1,1,1,2,2,2,2,3]);
assert.deepEqual(history.map(x=>x.normal),[1,2,3,0,1,2,3,0,1,2,3,0]);
assert.equal(a.damageSources['결심응진'].hits,3);near(a.damageSources['결심응진'].raw,450);near(a.damageSources['결심응진'].dealt,300);
assert.equal(a.damageSources['만검귀종'].activations,1);assert.equal(a.damageSources['만검귀종'].hits,2);near(a.damageSources['만검귀종'].raw,500);near(a.damageSources['만검귀종'].dealt,500/1.5);
while(a.basicCount<14&&time<20&&!battleOver)tick(.05);
assert.equal(a.damageSources['결심응진'].activations,5);assert.equal(a.damageSources['결심응진'].hits,5);assert.equal(a.shurin.normalAttacks,0);assert.equal(a.shurin.resolveUses,0);assert.equal(a.damageSources['만검귀종'].activations,1);
while(a.basicCount<15&&time<20&&!battleOver)tick(.05);
assert.equal(a.basicCount,15);assert.equal(a.shurin.normalAttacks,1);
assert.equal(a.damageSources['수영복'].activations,1);assert.equal(a.damageSources['수영복'].hits,2);near(a.damageSources['수영복'].dealt,10000);
near(a.damageSources['기본 공격'].raw,1500);near(a.damageSources['기본 공격'].dealt,1000);near(a.damageSources['결심응진'].dealt,500);
let result=JSON.parse(JSON.stringify({history,sources:a.damageSources,total:Object.values(a.damage).reduce((a,b)=>a+b,0)}));
silent=false;meters();
let meter=document.querySelector('#meterA');assert.match(meter.innerHTML,/aria-expanded="false"/);
meter.onclick({target:{closest(){return {dataset:{unit:a.id}}}}});
assert.ok(expandedMeters.has(a.id));assert.match(meter.innerHTML,/aria-expanded="true"/);
meters();assert.match(meter.innerHTML,/aria-expanded="true"/);
meter.onclick({target:{closest(){return {dataset:{unit:a.id}}}}});assert.ok(!expandedMeters.has(a.id));
assert.ok(meter.innerHTML.includes('만검귀종</th><td>1회</td><td>2회'));
resetCombatState(a);assert.equal(a.damageSources['결심응진'].activations,0);assert.equal(a.damageSources['기본 공격'].dealt,0);
result;
`);
console.log('PASS damage/raw/overkill/dead targets, activation-only, guard/counter, Shurin cycle/burst/AoE, swimsuit, UI expand persistence and reset');
// Compare every damage event and every tick, including HP, counters, targets, RNG and final result.
const scenario=`
silent=true;
let hits=[],frames=[];
const realDamage=damage;
damage=function(...args){let value=realDamage(...args);hits.push([time,args[0].id,args[1].id,args[2],args[3],value,units.map(u=>u.hp)]);return value};
function snapshot(){return units.map(u=>({id:u.id,hp:u.hp,dead:u.dead,x:u.x,y:u.y,basicCount:u.basicCount,damage:u.damage,shurin:u.shurin,ccUntil:u.ccUntil,nextAttack:u.nextAttack,channel:u.channel}))}
function trial(seed,mastery){
 $('#masteryA').value=String(mastery);$('#masteryB').value=String(mastery);
 reset();rng=seeded(seed);hits=[];frames=[];prepareBattle();running=true;
 frames.push(JSON.stringify(snapshot()));
 while(!battleOver&&time<60){tick(.05);frames.push(JSON.stringify(snapshot()))}
 return JSON.stringify({hits,frames,result:$('#status').textContent,time,rngNext:rng(),totals:units.map(u=>u.damage)});
}
`;
const old=runtime(baseline),now=runtime(current);old.run(scenario);now.run(scenario);
let coverage=new Set();
for(const seed of [24004,...Array.from({length:100},(_,i)=>i+1)]){
 const mastery=seed%3===0?1:seed%3===1?8:20;
 assert.equal(now.run(`trial(${seed},${mastery})`),old.run(`trial(${seed},${mastery})`),'Combat changed: seed '+seed);
 const summaries=JSON.parse(now.run('JSON.stringify(units.map(u=>({damage:u.damage,sources:u.damageSources})))'));
 for(const u of summaries){
  for(const kind of ['basic','skill','passive','synergy']){
   const sum=Object.values(u.sources).filter(s=>s.kind===kind).reduce((n,s)=>n+s.dealt,0);
   assert.ok(Math.abs(sum-u.damage[kind])<1e-7,`seed ${seed} ${kind} totals mismatch`);
  }
  for(const [name,s] of Object.entries(u.sources))if(s.activations>0)coverage.add(name);
 }
}
console.log('PASS 101 seeds: every damage event, every tick HP/state, RNG continuation and winner exactly unchanged; source sums match all four categories');
console.log('Sources exercised: '+[...coverage].join(', '));
console.log('SHURIN_REPORT '+JSON.stringify(report,null,2));
