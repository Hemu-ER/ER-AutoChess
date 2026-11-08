'use strict';
const assert=require('node:assert/strict');
const {CombatEngine}=require('../combat-engine.js');
const A=[{characterId:'marcus',star:1,x:0,y:1,items:[]},{characterId:'kenneth',star:1,x:1,y:0,items:[]},{characterId:'cathy',star:1,x:1,y:2,items:[]}];
const B=[{characterId:'aya',star:1,x:0,y:1,items:[]},{characterId:'rio',star:1,x:1,y:0,items:[]},{characterId:'alex',star:1,x:1,y:2,items:[]}];
const prepare=(ids=[],more={})=>{const e=new CombatEngine({teamA:A,teamB:B,augmentsA:ids,round:16,seed:1337,...more});e.start();return e.getResult()};
let checks=0;
const base=prepare(),infect=prepare(['P12']);
const infected=infect.units.filter(u=>u.team==='B'&&u.purple?.infected?.active);assert.equal(infected.length,1);checks++;
const critBase=base.units.filter(u=>u.team==='A'),critResult=prepare(['P38']).units.filter(u=>u.team==='A');
for(let i=0;i<critBase.length;i++){assert(Math.abs((critResult[i].critChance||0)-(critBase[i].critChance||0)-.35)<1e-9);checks++}
const spend=prepare(['P31'],{purpleSpent:{A:20}}),nospend=prepare(['P31'],{purpleSpent:{A:0}});
for(const u of spend.units.filter(u=>u.team==='A')){const v=nospend.units.find(x=>x.id===u.id);assert(u.skill.shield-v.skill.shield >= u.maxHp*.1599,`P31 shield ${u.name}`);checks++}
const merged=prepare(['P33'],{teamA:[{characterId:'aya',star:1,x:0,y:0,items:[]},{characterId:'aya',star:1,x:0,y:1,items:[]},{characterId:'aya',star:1,x:0,y:2,items:[]}]});
assert.equal(merged.units.filter(x=>x.team==='A'&&!x.dead).length,1,'P33 merges three duplicates');checks++;
const leader=merged.units.find(x=>x.team==='A'&&!x.dead);assert.equal(leader.purpleSynergyCopies,3,'P33 three synergy contributions');checks++;
console.log('M9-07 PURPLE EFFECTS PASS:',checks,'behavioral invariants');
