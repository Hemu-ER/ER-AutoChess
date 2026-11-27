'use strict';
const assert=require('node:assert/strict');const {CombatEngine}=require('../js/shared/combat-engine.js');
const u=(characterId,x,y)=>({characterId,x,y,star:1});
const build=()=>{const e=new CombatEngine({seed:125,round:2,teamA:[u('kenneth',2,1)],teamB:[u('marcus',2,1)]});e.start();e.drainEvents();const a=e.runtime.units.find(x=>x.team==='A'),b=e.runtime.units.find(x=>x.team==='B');a.critChance=0;return {e,a,b}};
for(const mode of ['normal','shield','invulnerable']){const {e,a,b}=build();if(mode==='shield')b.skill.shield=100000;if(mode==='invulnerable')b.skill.invulnUntil=100;const hp=b.hp;e.runtime.basicAttack(a,b);const events=e.drainEvents();assert.equal(events.filter(x=>x.type==='attack'&&x.unitId===a.id&&x.targetId===b.id).length,1,mode+' action');if(mode!=='normal'){assert.equal(b.hp,hp,mode+' health unchanged');assert.ok(events.some(x=>x.type==='vfx-block'&&x.unitId===b.id),mode+' feedback');}else assert.ok(b.hp<hp);}
{const {e,a,b}=build();b.skill.invulnUntil=100;e.runtime.damage(a,b,100,'skill',false,{sourceName:'테스트 스킬'});const ev=e.drainEvents();assert.ok(ev.some(x=>x.type==='skill-target'&&x.unitId===a.id));assert.ok(ev.some(x=>x.type==='vfx-block'&&x.unitId===b.id));}
console.log('M11-05R3 ACTION PASS: ordinary, fully shielded and invulnerable basic attacks; blocked direct skill');
