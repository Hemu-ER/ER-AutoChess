'use strict';
const assert=require('node:assert/strict');
const {CombatEngine}=require('../combat-engine.js');
const A=[{characterId:'marcus',star:1,x:0,y:1,items:[]},{characterId:'kenneth',star:1,x:1,y:0,items:[]},{characterId:'cathy',star:1,x:1,y:2,items:[]}];
const B=A.map(u=>({...u}));
const reserve=[{characterId:'aya',star:1,items:[]},{characterId:'rio',star:1,items:[]},{characterId:'alex',star:1,items:[]}];
function battle(id,seed=22){const config={teamA:A,teamB:B,masteryA:1,masteryB:1,round:16,seed,augmentsA:[id],augmentsB:[],reservesA:reserve};const initial=JSON.stringify(config);const engine=new CombatEngine(config);const result=engine.run(),events=engine.drainEvents().filter(e=>e.type==='augment'&&e.team==='A'&&e.id===id);assert.equal(JSON.stringify(config),initial,`input mutation ${id}`);return {events,result}}
let checks=0;
for(const [id,first,period] of [['P07',1.5,7],['P13',3.5,null],['P17',3,null],['P18',1.5,3],['P44',4,null],['P48',3,4]]){
 const {events,result}=battle(id);assert(result.battleOver,`${id}: battle incomplete`);assert(events.length>0,`${id}: did not trigger before death`);
 assert(Math.abs(events[0].time-first)<.051,`${id}: triggered at ${events[0].time}, expected ${first}`);checks++;
 if(period&&events.length>1){assert(Math.abs((events[1].time-events[0].time)-period)<.051,`${id}: period incorrect`);checks++}
}
console.log(`M9-07 PURPLE TIMING PASS: ${checks} time and repeat assertions`);
