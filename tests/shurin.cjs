const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../game.js'), 'utf8');
const nodes = new Map();
const document = {
  querySelector(selector) {
    if (!nodes.has(selector)) nodes.set(selector, {
      value: selector === '#moveInterval' ? '0.5' : '8', checked: true,
      innerHTML: '', textContent: '', entries: [],
      prepend(child) { this.entries.unshift(child.innerHTML); }
    });
    return nodes.get(selector);
  },
  createElement() { return {innerHTML: ''}; }
};
const context = vm.createContext({assert, console, document});
// Keep combat, damage, logs and meters real; omit only page bootstrap/animation.
vm.runInContext(source.replace(/buildBoard\(\);reset\(\);\s*$/, ''), context);
vm.runInContext(`
render=()=>{};flash=()=>{};
let events=[],trace=[];
const originalDamage=damage,originalBasic=basicAttack;
damage=function(src,dst,raw,kind='basic',fixed=false,opt={}){
 const passiveBefore=src.damage.passive,hpBefore=dst.hp;
 const effective=originalDamage(src,dst,raw,kind,fixed,opt);
 events.push({attack:src.basicCount,kind,raw,effective,hpBefore,hpAfter:dst.hp,passiveBefore,passiveAfter:src.damage.passive});
 return effective;
};
basicAttack=function(u,t){
 const before={basicCount:u.basicCount,...u.shurin};
 originalBasic(u,t);
 if(u.name==='슈린')trace.push({attack:u.basicCount,before,after:{basicCount:u.basicCount,...u.shurin},passive:u.damage.passive,skill:u.damage.skill});
};
time=0;battleOver=false;silent=false;stage={A:{},B:{}};
let shurin=makeUnit('슈린',1,[2,1]);
shurin.atk=100;shurin.as=1;shurin.hp=100;shurin.nextAttack=1;
let dummy=makeUnit('유민',1,[3,1]);
dummy.name='훈련 표적';dummy.team='B';dummy.hp=dummy.maxHp=100000;dummy.def=0;
dummy.nextAttack=Infinity;dummy.nextMove=Infinity;
units=[shurin,dummy];
while(shurin.basicCount<12&&time<20&&!battleOver)tick(.05);
assert.equal(shurin.basicCount,12);
assert.deepEqual(trace.map(x=>x.after.normalAttacks),[1,2,3,0,1,2,3,0,1,2,3,0]);
assert.deepEqual(trace.map(x=>x.after.phase),['normal','normal','ready','normal','normal','normal','ready','normal','normal','normal','ready','burst']);
assert.deepEqual(trace.map(x=>x.before.basicCount),Array.from({length:12},(_,i)=>i));
const resolves=events.filter(e=>e.kind==='passive'),aoes=events.filter(e=>e.kind==='skill');
assert.deepEqual(resolves.map(e=>e.attack),[4,8,12]);
assert.deepEqual(resolves.map(e=>e.raw),[150,150,150]);
assert.deepEqual(resolves.map(e=>e.effective),[150,150,150]);
assert.ok(resolves.every(e=>e.passiveAfter-e.passiveBefore===150&&e.hpBefore-e.hpAfter===150));
assert.equal(aoes.length,1);assert.equal(aoes[0].attack,12);assert.equal(aoes[0].raw,250);assert.equal(aoes[0].effective,250);
assert.equal(shurin.damage.passive,450);assert.equal(shurin.damage.skill,250);assert.equal(shurin.hp,325);
const logs=document.querySelector('#log').entries;
console.log(JSON.stringify({trace,damageEvents:events.filter(e=>e.kind!=='basic'),resolveLogs:logs.filter(s=>s.includes('결심응진')).length,aoeLogs:logs.filter(s=>s.includes('만검귀종')).length,stats:shurin.shurin},null,2));
assert.equal(logs.filter(s=>s.includes('결심응진')).length,3,'Resolve must be logged on each actual use');
assert.equal(logs.filter(s=>s.includes('만검귀종')).length,1);
assert.equal(shurin.shurin.totalResolveUses,3);
assert.equal(shurin.shurin.totalAoeUses,1);
assert.match(document.querySelector('#meterA').innerHTML,/결심응진 3회/);
assert.match(document.querySelector('#meterA').innerHTML,/만검귀종 1회/);
// The burst's extra attacks must not prepare the next normal cycle.
while(shurin.basicCount<14&&time<20&&!battleOver)tick(.05);
assert.equal(shurin.shurin.normalAttacks,0);assert.equal(shurin.shurin.resolveUses,0);
assert.equal(shurin.shurin.totalResolveUses,5);assert.equal(shurin.shurin.totalAoeUses,1);
while(shurin.basicCount<18&&time<25&&!battleOver)tick(.05);
assert.equal(shurin.shurin.totalResolveUses,6);assert.equal(shurin.shurin.totalAoeUses,1);
assert.equal(shurin.shurin.normalAttacks,0);assert.equal(shurin.shurin.resolveUses,1);
resetCombatState(shurin);
assert.equal(shurin.shurin.totalResolveUses,0);assert.equal(shurin.shurin.totalAoeUses,0);
console.log('PASS: tick -> basicAttack -> shurinBasic -> real damage -> passive meter, log and lifetime counters; burst expiry and reset');
`, context, {timeout:5000});

