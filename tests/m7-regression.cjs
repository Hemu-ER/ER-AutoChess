'use strict';
const assert=require('node:assert/strict');
const {CombatEngine,coefficients}=require('../combat-engine.js');
const {roster,byId}=require('../roster.js');
const items=require('../items.js');
const newer=['katja','haze','aiden','elena','silvia','alex'];
for(const id of newer){assert(byId[id]&&byId[id].implemented,id+' must exist');assert(coefficients[id],id+' coefficients');}
assert.equal(newer.map(id=>byId[id].cost).join(','),'2,3,1,1,2,3');
const field=(ids)=>ids.map((characterId,i)=>({characterId,star:1,x:[2,0,1][i],y:i}));
const make=(a,b,opts={})=>new CombatEngine({teamA:field(a),teamB:field(b),seed:2468,arenaRegion:'lab',...opts});
const normal=make(['katja','haze','aiden'],['elena','silvia','alex']).run();
assert(normal.battleOver&&normal.time<=60);assert.equal(normal.synergies.A.affiliations['카페'].tier,3);assert.equal(normal.synergies.B.affiliations['페르소나'].tier,3);
for(const id of newer){const who=normal.units.find(u=>u.characterId===id);assert(who,'character missing '+id);assert(Object.values(who.damageSources).some(d=>d.activations>0&&d.kind==='skill'),id+' skill never fired');}
const single=make(['elena'],['marcus','garnet','mirka']);single.start();while(single.getResult().time<5.03&&!single.getResult().battleOver)single.step();assert(single.getResult().personaStacks.A<=1,'AoE disable should add one stack per ability action');
let moon='혈색반월';for(const name of ['검집','금팔찌','블레이드 부츠'])moon=items.craft(moon,name);
assert.equal(items.displayName(moon),'혈색반월 +3');assert.equal(items.all[moon].stats.atk,10);assert.equal(items.all[moon].stats.amp,25);assert.equal(items.craft(moon,'혈색반월'),null);
const power=make(['justina','aiden','alex'],['marcus','hyunwoo','garnet']);power.start();assert.equal(power.getResult().synergies.A.affiliations['에레보스'].tier,3);const justina=power.getResult().units.find(u=>u.characterId==='justina');assert(Math.abs(power.runtime.currentAmp(power.runtime.units.find(u=>u.characterId==='justina'))/justina.amp-1.2)<1e-7,'3 Erebus 20%');
assert.throws(()=>new CombatEngine({teamA:[{characterId:'alex',star:1,x:1,y:1,items:['혈색반월']}],teamB:field(['marcus'])}),/장비 데이터/);
const withMoon=new CombatEngine({teamA:[{characterId:'justina',star:1,x:0,y:1,items:[moon]}],teamB:field(['marcus','garnet','mirka']),seed:12}).run();
const targets=Object.keys(withMoon.units[0].damageSources['섬멸 포격'].targets);assert(targets.length>=2,'Blood Moon must extend skill targets');
const ids=roster.filter(x=>!x.pveOnly).map(x=>x.id);for(let i=0;i<150;i++){const a=Array.from({length:3},(_,j)=>({characterId:ids[(i*17+j*7)%ids.length],star:1+i%3,x:[2,0,1][j],y:j})),b=Array.from({length:3},(_,j)=>({characterId:ids[(i*19+j*11+7)%ids.length],star:1+(i+j)%3,x:[2,0,1][j],y:j}));const result=new CombatEngine({teamA:a,teamB:b,seed:i+10,arenaRegion:i%2?'hotel':'lab'}).run();assert(result.battleOver&&result.time<=60.05,'end time '+i);assert(result.units.every(u=>Number.isFinite(u.hp)&&Number.isFinite(u.atk)&&Number.isFinite(u.def)),'NaN '+i)}
console.log('M7 PASS: 6 skills, synergies, Persona AoE dedup, Blood Moon, 150 seeded 3v3 battles');
