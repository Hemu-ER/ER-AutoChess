'use strict';
const crypto=require('node:crypto');
const {roster}=require('./roster.js');
const items=require('./items.js');
const pool=roster.filter(x=>!x.pveOnly&&[1,2,3].includes(x.cost));
const complete=items.recipes.map(x=>x[0]);
const pick=a=>a[crypto.randomInt(a.length)];
function makeCandidates(round,count){
 if(!Number.isInteger(count)||count<2||count>8)throw Error('선점 참가 인원은 2~8명');
 const completeCount=round>=15?Math.round((count+2)*0.5):round>=11?Math.round((count+2)*0.25):0;
 const candidates=[];const unused=[...pool];
 for(let i=0;i<count+2;i++){
  const weights=round>=15?[0,40,60]:round>=11?[10,55,35]:[20,60,20];
  const roll=crypto.randomInt(100);const cost=roll<weights[0]?1:roll<weights[0]+weights[1]?2:3;
  const matching=unused.filter(x=>x.cost===cost),r=pick(matching.length?matching:unused);
  unused.splice(unused.indexOf(r),1);
  candidates.push({id:i,characterId:r.id,star:1,item:i<completeCount?pick(complete):pick(items.baseNames),itemTier:i<completeCount?'complete':'basic',claimedBy:null});
 }
 // Shuffle reward positions: complete items must not always appear first.
 for(let i=candidates.length-1;i>0;i--){const j=crypto.randomInt(i+1);[candidates[i],candidates[j]]=[candidates[j],candidates[i]]}
 candidates.forEach((o,i)=>o.id=i);
 return candidates;
}
module.exports={makeCandidates};
