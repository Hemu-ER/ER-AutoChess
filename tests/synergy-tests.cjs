const assert=require('assert');
const {CombatEngine}=require('../combat-engine.js');
const {roster}=require('../roster.js');
const ent=(id,x=1,y=1,star=1)=>({characterId:id,star,x,y});
const eng=(A,B,seed=7)=>new CombatEngine({teamA:A,teamB:B,masteryA:1,masteryB:1,seed});
assert.equal(roster.length,32);
// All 32 must be legal combat entries even when skill-pending.
for(const r of roster){const e=eng([ent(r.id,1,1)],[ent(r.id==='hyunwoo'?'marcus':'hyunwoo',1,1)]);e.start();assert.equal(e.getResult().units.length,2)}
// Role: melee skill front/mid gets AMP/AS; rear does not.
let a=eng([ent('laura',2,1)],[ent('hyunwoo',2,1)]);a.start();let u=a.runtime.units[0];assert(u.amp>u.base.amp&&u.as>u.base.as);
a=eng([ent('laura',0,1)],[ent('hyunwoo',2,1)]);a.start();u=a.runtime.units[0];assert.equal(u.amp,u.base.amp);
// Support team buff.
a=eng([ent('leny',0,0),ent('hart',0,1)],[ent('hyunwoo',2,1)]);a.start();assert(a.runtime.units.find(x=>x.characterId==='hart').maxHp>a.runtime.units.find(x=>x.characterId==='hart').base.hp);
// New Year tiers and incoming hit removal.
a=eng([ent('isol',0,0),ent('chloe',0,1),ent('sua',1,2)],[ent('hyunwoo',2,1)]);a.start();u=a.runtime.units.find(x=>x.characterId==='isol');assert.equal(u.newYear.hitsLeft,30);let enemy=a.runtime.units.find(x=>x.team==='B');for(let i=0;i<30;i++)a.runtime.damage(enemy,u,1,'basic',true,{guardable:false});assert.equal(u.newYear.active,false);
// Prison tier 3: +2 per basic/skill damage event, trigger at 20, prison members halve CC.
a=eng([ent('laura',2,0),ent('bianca',0,1),ent('cathy',1,2)],[ent('hyunwoo',2,1)]);a.start();let src=a.runtime.units[0],dst=a.runtime.units.find(x=>x.team==='B');for(let i=0;i<10;i++)a.runtime.damage(src,dst,1,'basic',true,{guardable:false});assert.equal(dst.prisonStacks,0);assert(dst.ccUntil>0);
// Military band refresh on actual heal.
a=eng([ent('leny',0,0),ent('hart',0,1)],[ent('hyunwoo',2,1)]);a.start();u=a.runtime.units[0];u.hp-=100;a.runtime.heal(u,50);assert.equal(u.bandUntil,10);
// Pajama actually schedules sleep at 10 seconds if fight remains alive.
a=eng([ent('hyunwoo',0,0),ent('adela',0,1),ent('dailin',0,2)],[ent('marcus',2,1)]);a.start();for(let i=0;i<201&&!a.getResult().battleOver;i++)a.step();assert(a.drainEvents().some(x=>x.message&&x.message.includes('파자마')) || a.getResult().time<10.0);
// Demon Hunter produces synergy damage.
a=eng([ent('johann',0,0),ent('nadine',0,1),ent('bernice',0,2)],[ent('marcus',2,1)]);let r=a.run();assert(r.units.filter(x=>x.team==='A').some(x=>(x.damage.synergy||0)>0));
// Maid tier 3 shared cleaning reaches healing cycle in a long-enough fight.
a=eng([ent('rozzi',0,0),ent('aya',0,1),ent('mirka',2,2)],[ent('marcus',2,1)]);a.run();assert(a.drainEvents().some(x=>x.message&&x.message.includes('클리닝')));
// Love/Hate: Garnet gains stats when Kenneth is present on either side.
let solo=eng([ent('garnet',2,1)],[ent('hyunwoo',2,1)]);solo.start();let base=solo.runtime.units[0].amp;
let love=eng([ent('garnet',2,1)],[ent('kenneth',2,1)]);love.start();assert(love.runtime.units[0].amp>base);
// Healing Song hook: only a hook until Charlotte's Healing Light skill handler is implemented.
a=eng([ent('charlotte',0,0),ent('hyunwoo',2,1)],[ent('marcus',2,1)]);a.start();let ch=a.runtime.units.find(x=>x.characterId==='charlotte'),ally=a.runtime.units.find(x=>x.characterId==='hyunwoo');ally.hp-=100;let before=ally.hp;a.runtime.healingSong(ch);assert(ally.hp>before);
console.log('synergy-tests: PASS');
