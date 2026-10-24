'use strict';
// M8-01: match format. Pure rules shared by server and regression QA.
const SPECIALS=Object.freeze(['shop','auction','boss','experiment','selection']);
const LABELS=Object.freeze({farm:'파밍',pvp:'결투',supply:'보급',shop:'상점',auction:'경매',boss:'보스',experiment:'번외 실험',selection:'선점'});
function shuffle(values,rng=Math.random){const out=[...values];for(let i=out.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[out[i],out[j]]=[out[j],out[i]]}return out}
function createSchedule(rng=Math.random){return shuffle(SPECIALS,rng)}
function roundKind(round,order){if(!Number.isInteger(round)||round<1)throw Error('잘못된 라운드');if(round===1||round===3)return 'farm';if(round===5)return 'supply';if(round<=6||round>=16||round%2===0)return 'pvp';return order[(round-7)/2]}
function pairSurvivors(players,hp,rng=Math.random,history=null){
 const active=shuffle(players.filter(p=>(hp[p.slot]??0)>0),rng);
 const counts=history?.byeCounts||{},previous=history?.previousByeSlot??null,lastOpp=history?.lastOpponents||{};
 let bye=null;
 if(active.length%2===1){
  const fewest=Math.min(...active.map(p=>counts[p.slot]||0));
  let eligible=active.filter(p=>(counts[p.slot]||0)===fewest);
  if(eligible.length>1&&eligible.some(p=>p.slot!==previous))eligible=eligible.filter(p=>p.slot!==previous);
  bye=eligible[Math.floor(rng()*eligible.length)];
  active.splice(active.indexOf(bye),1);
 }
 const pairs=[];
 while(active.length>1){
  const a=active.shift();
  let candidates=active.filter(b=>lastOpp[a.slot]!==b.slot&&lastOpp[b.slot]!==a.slot);
  if(!candidates.length)candidates=active;
  const b=candidates[Math.floor(rng()*candidates.length)];
  active.splice(active.indexOf(b),1);
  pairs.push([a,b]);
 }
 return {pairs,bye};
}
function draftOrder(players,hp){return [...players].filter(p=>(hp[p.slot]??0)>0).sort((a,b)=>(hp[a.slot]-hp[b.slot])||(a.slot-b.slot)).map(p=>p.slot)}
function selectionCandidates(count,rng=Math.random){if(count<2||count>8)throw Error('2~8인만 지원');return count+2}
module.exports={SPECIALS,LABELS,shuffle,createSchedule,roundKind,pairSurvivors,draftOrder,selectionCandidates};
