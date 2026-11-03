'use strict';
const assert=require('node:assert/strict'),{CombatEngine}=require('../combat-engine.js'),boss=require('../match-boss.cjs');
assert.deepEqual(boss.BOSSES.map(b=>b.buff),[{adaptive:1},{defFlat:4},{wickeline:40}]);
function config(id,buffs={}){return {teamA:[{characterId:id,star:1,x:0,y:1}],teamB:[{characterId:'boss_omega',star:1,x:2,y:1}],masteryA:1,masteryB:1,seed:17,boss:{id:'boss_omega',stats:{hp:100000,atk:1,def:0},interval:60},persistent:{A:{bossBuffs:buffs}}};}
for(const id of ['rio','sua']){const ea=new CombatEngine(config(id)),eb=new CombatEngine(config(id,{adaptive:1,defFlat:4}));const a=ea.runtime.units[0],b=eb.runtime.units[0];ea.runtime.resetCombatState(a);eb.runtime.resetCombatState(b);assert.equal(b.atk-a.atk,a.main==='atk'?3:0);assert.equal(b.amp-a.amp,a.main==='atk'?0:6);assert.equal(b.def-a.def,4);assert.equal(b.maxHp,a.maxHp);assert.equal(b.as,a.as);}
for(const id of ['rio','sua','alex','yumin','chloe']){
 const engine=new CombatEngine(config(id,{wickeline:40}));engine.run();const r=engine.getResult(),logs=engine.drainEvents().filter(e=>e.type==='log'&&e.message.includes('위클라인 충전'));
 assert(logs.length>0,id);for(let i=0;i<logs.length;i++){assert(logs[i].time>=6-1e-6);if(i)assert(logs[i].time-logs[i-1].time>=6-1e-6);}
 const src=r.units[0].damageSources['위클라인 충전'];assert.equal(src.kind,'skill');assert.equal(src.raw,40*src.activations);assert.equal(src.hits,src.activations);assert.equal(r.units.find(u=>u.characterId==='nina')?.wickelineDamage||0,0);
 const replay=new CombatEngine(config(id,{wickeline:40})).run();assert.deepEqual(replay,r,'same seed replay');
}
console.log('M8-06 BUFF PASS: adaptive main stat +3/+6, DEF+4, 6s first charge/recharge, raw skill 40, no summon proc, logs and deterministic replay');
