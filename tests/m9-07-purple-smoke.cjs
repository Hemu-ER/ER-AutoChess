'use strict';
const assert=require('node:assert/strict');
const {CombatEngine}=require('../combat-engine.js');
const cards=require('../purple-cards.js').CARDS;
const {roster}=require('../roster.js');
assert.equal(cards.length,46);
const ids=new Set(cards.map(c=>c.id));
assert(!ids.has('P16')&&!ids.has('P47')&&!ids.has('P45')&&!ids.has('P50'));
const teamA=[{characterId:'rozzi',star:2,x:0,y:1,items:[]},{characterId:'aya',star:2,x:1,y:0,items:[]},{characterId:'marcus',star:2,x:1,y:2,items:[]}];
const teamB=[{characterId:'rio',star:2,x:2,y:0,items:[]},{characterId:'kenneth',star:2,x:1,y:1,items:[]},{characterId:'cathy',star:2,x:1,y:2,items:[]}];
let passed=0,triggered=0;
for(const c of cards){
 const cfg={teamA,teamB,masteryA:2,masteryB:2,seed:15151,arenaRegion:'lab',round:16,augmentsA:[c.id],augmentsB:[],purpleSpent:{A:20,B:0},purpleCredits:{A:30,B:20},reservesA:[{characterId:'alex',star:2,items:[]},{characterId:'katja',star:2,items:[]},{characterId:'haze',star:2,items:[]}],purpleChoices:{A:{},B:{}},purpleLosingStreak:{A:3,B:0}};
 try{
  const e=new CombatEngine(cfg);const r=e.run();assert(r&&r.outcome);assert(Number.isFinite(r.time));assert(r.units.every(u=>Number.isFinite(u.hp)&&Number.isFinite(u.maxHp)));const events=e.drainEvents();if(events.some(e=>e.type==='augment'&&e.id===c.id))triggered++;passed++;
 }catch(error){throw new Error(`${c.id} ${c.name}: ${error.stack||error}`)}
}
console.log(`M9-07 PURPLE SMOKE: ${passed}/${cards.length} runtime, ${triggered} triggered in standard 3v3`);
