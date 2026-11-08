'use strict';
const assert=require('node:assert/strict'),{CombatEngine}=require('../combat-engine.js'),{CARDS}=require('../purple-cards.js');
const ids=CARDS.map(c=>c.id),baseA=[{characterId:'rozzi',star:2,x:0,y:1,items:['오토-암즈']},{characterId:'aya',star:2,x:1,y:0,items:['요명월']},{characterId:'marcus',star:2,x:2,y:2,items:['가디언 슈트']}],baseB=[{characterId:'rio',star:2,x:2,y:0,items:['미스릴 퀴버']},{characterId:'kenneth',star:2,x:1,y:1,items:['레가투스']},{characterId:'cathy',star:2,x:1,y:2,items:['가디언 슈트']}];
let ok=0;
for(let i=0;i<120;i++){
 const a=Array.from({length:3},(_,k)=>ids[(i*11+k*13)%ids.length]),b=Array.from({length:3},(_,k)=>ids[(i*7+k*5+3)%ids.length]);
 const e=new CombatEngine({teamA:baseA,teamB:baseB,augmentsA:a,augmentsB:b,masteryA:2,masteryB:2,seed:i+321,round:16,purpleSpent:{A:a.includes('P31')?20:0,B:b.includes('P31')?20:0},purpleCredits:{A:30,B:25},purpleLosingStreak:{A:2,B:3},reservesA:[{characterId:'alex',star:2,items:[]}],reservesB:[{characterId:'katja',star:2,items:[]}],arenaRegion:'lab'});
 try{const r=e.run();assert(r.battleOver&&Number.isFinite(r.time),`not over ${i}`);assert(r.units.every(u=>Number.isFinite(u.maxHp)&&Number.isFinite(u.hp)),`invalid stats ${i}`);ok++}catch(err){throw Error(`combat ${i} [${a}] vs [${b}] ${err.stack}`)}
}
console.log(`M9-07 PURPLE COMBOS PASS: ${ok} battles with three random purple cards per team`);
