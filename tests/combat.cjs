const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = require('./runtime-source.cjs')();
const elements = new Map();
const context = vm.createContext({assert, console, document: {querySelector(selector) {
  if (!elements.has(selector)) elements.set(selector, {value: selector === '#moveInterval' ? '0.5' : '8', checked: true, textContent: '', innerHTML: ''});
  return elements.get(selector);
}}});
vm.runInContext(source.replace(/buildBoard\(\);reset\(\);\s*$/, ''), context);
vm.runInContext(`
silent=true;
let checks=0;
function check(name,fn){fn();checks++;console.log('PASS '+name)}
function setup(){time=0;units=[];stage={A:{},B:{}};shared={A:{swim:0},B:{swim:0}}}
function fighter(name,team,x,y){let u=makeUnit(name,1,[x,y]);u.team=team;u.aff=[];u.hp=u.maxHp=100000;u.atk=100;u.def=0;u.range=1;units.push(u);return u}
for(let team of ['A','B']){
 let mirror=x=>team==='A'?x:5-x,other=team==='A'?'B':'A';
 check(team+' forward first',()=>{setup();let u=fighter('마커스',team,mirror(0),0);fighter('유민',other,mirror(4),2);move(u);assert.equal(u.x,mirror(1));assert.equal(u.y,0)});
 check(team+' lateral at far edge',()=>{setup();let u=fighter('마커스',team,mirror(5),0);fighter('유민',other,mirror(5),2);move(u);assert.equal(u.x,mirror(5));assert.equal(u.y,1);assert.ok(target(u))});
 check(team+' blocked forward uses enemy lane',()=>{setup();let u=fighter('마커스',team,mirror(1),0);fighter('슈린',team,mirror(2),0);fighter('유민',other,mirror(4),2);move(u);assert.equal(u.x,mirror(1));assert.equal(u.y,1)});
 check(team+' occupied lateral does not move',()=>{setup();let u=fighter('마커스',team,mirror(5),0);fighter('슈린',team,mirror(5),1);fighter('유민',other,mirror(5),2);move(u);assert.equal(u.x,mirror(5));assert.equal(u.y,0)});
 check(team+' stops in range',()=>{setup();let u=fighter('마커스',team,mirror(2),0);fighter('유민',other,mirror(3),1);move(u);assert.equal(u.x,mirror(2));assert.equal(u.y,0)});
 check(team+' ignores dead enemies and occupancy',()=>{setup();let u=fighter('마커스',team,mirror(0),0);let dead=fighter('슈린',other,mirror(1),0);dead.dead=true;fighter('유민',other,mirror(4),2);move(u);assert.equal(u.x,mirror(1))});
 check(team+' pursues every opposing starting cell orthogonally',()=>{
  for(let x=0;x<3;x++)for(let y=0;y<3;y++)for(let ex=3;ex<6;ex++)for(let ey=0;ey<3;ey++){
   setup();let u=fighter('마커스',team,mirror(x),y);fighter('유민',other,mirror(ex),ey);
   for(let i=0;i<10&&!target(u);i++){let old={x:u.x,y:u.y};move(u);assert.equal(Math.abs(u.x-old.x)+Math.abs(u.y-old.y),1);assert.ok(u.x>=0&&u.x<6&&u.y>=0&&u.y<3)}
   assert.ok(target(u));
  }
 });
}
check('no live enemy means no movement',()=>{setup();let u=fighter('마커스','A',1,0);move(u);assert.equal(u.x,1);assert.equal(u.y,0)});
check('nearest enemy determines fallback lane',()=>{setup();let u=fighter('마커스','A',5,1);fighter('유민','B',2,0);fighter('유스티나','B',3,2);move(u);assert.equal(u.y,2);assert.equal(u.x,5)});
function shurinSetup(){setup();let u=fighter('슈린','A',2,1),t=fighter('유민','B',3,1);u.hp=1000;return {u,t}}
check('three normal basics then Resolve, healing only its extra damage',()=>{
 let {u,t}=shurinSetup();
 for(let i=0;i<3;i++)basicAttack(u,t);
 assert.equal(u.damage.basic,300);assert.equal(u.damage.passive,0);assert.equal(u.hp,1000);assert.equal(u.shurin.phase,'ready');
 basicAttack(u,t);assert.equal(u.damage.basic,400);assert.equal(u.damage.passive,150);assert.equal(u.hp,1075);assert.equal(u.shurin.normalAttacks,0);assert.equal(u.shurin.resolveUses,1);
 for(let i=0;i<3;i++)basicAttack(u,t);
 assert.equal(u.damage.passive,150);assert.equal(u.shurin.phase,'ready');
 basicAttack(u,t);assert.equal(u.damage.passive,300);assert.equal(u.shurin.resolveUses,2);
});
check('third Resolve triggers orthogonal AoE and three seconds of burst',()=>{
 let {u,t}=shurinSetup(),side=fighter('유스티나','B',2,0),diagonal=fighter('리오','B',3,0);
 for(let i=0;i<12;i++)basicAttack(u,t);
 assert.equal(u.damage.passive,450);assert.equal(u.damage.skill,500);assert.equal(side.hp,99750);assert.equal(diagonal.hp,100000);assert.equal(u.shurin.phase,'burst');assert.equal(u.shurin.burstUntil,3);
 let passive=u.damage.passive;
 for(let stamp of [0.5,1,1.5,2,2.5,2.999]){time=stamp;basicAttack(u,t)}
 assert.equal(u.damage.passive,passive+6*150);assert.equal(u.shurin.normalAttacks,0);assert.equal(u.shurin.resolveUses,0);assert.equal(u.damage.skill,500);
 time=3;basicAttack(u,t);assert.equal(u.damage.passive,passive+6*150);assert.equal(u.shurin.phase,'normal');assert.equal(u.shurin.normalAttacks,1);
 basicAttack(u,t);basicAttack(u,t);assert.equal(u.shurin.phase,'ready');basicAttack(u,t);assert.equal(u.damage.passive,passive+7*150);assert.equal(u.shurin.resolveUses,1);
});
check('Resolve heal uses mitigated damage capped at target remaining HP',()=>{
 let {u,t}=shurinSetup();u.shurin.phase='ready';t.def=100;t.hp=90;basicAttack(u,t);
 assert.equal(u.damage.basic,50);assert.equal(u.damage.passive,40);assert.equal(u.hp,1020);assert.ok(t.dead);
});
check('lethal basic consumes third Resolve and still triggers AoE',()=>{
 let {u,t}=shurinSetup(),side=fighter('유스티나','B',2,0);u.shurin.phase='ready';u.shurin.resolveUses=2;t.hp=50;basicAttack(u,t);
 assert.equal(u.damage.passive,0);assert.equal(u.hp,1000);assert.equal(side.hp,99750);assert.equal(u.shurin.phase,'burst');
});
check('combat reset clears the entire Shurin cycle',()=>{
 let {u,t}=shurinSetup();for(let i=0;i<12;i++)basicAttack(u,t);resetCombatState(u);
 assert.equal(u.shurin.phase,'normal');assert.equal(u.shurin.normalAttacks,0);assert.equal(u.shurin.resolveUses,0);assert.equal(u.shurin.burstUntil,0);
});
check('tick prevents movement and attacks during CC/channel',()=>{
 let {u,t}=shurinSetup();u.ccUntil=2;u.nextAttack=0;tick(.05);assert.equal(u.shurin.normalAttacks,0);u.ccUntil=0;u.channel={type:'test'};tick(.05);assert.equal(u.shurin.normalAttacks,0);
});
check('100 seeded full battles finish with valid states',()=>{
 for(let seed=1;seed<=100;seed++){
  silent=true;reset();rng=seeded(seed);prepareBattle();running=true;
  while(!battleOver&&time<60)tick(DT);
  assert.ok(battleOver);for(let u of units){assert.ok(Number.isFinite(u.hp));assert.ok(u.x>=0&&u.x<6&&u.y>=0&&u.y<3)}
  let live=units.filter(u=>!u.dead);assert.equal(new Set(live.map(u=>u.x+','+u.y)).size,live.length);
 }
});
console.log(checks+' checks passed');
`,context);

