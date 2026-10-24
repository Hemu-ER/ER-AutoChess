'use strict';
// M8-02. Authoritative, match-scoped economy. All mutations are server-only.
const crypto=require('node:crypto');
const {roster}=require('./roster.js');
const items=require('./items.js');
const playable=roster.filter(u=>!u.pveOnly&&[1,2,3].includes(u.cost));
const byId=new Map(playable.map(u=>[u.id,u]));
const COST_WEIGHTS=[
 [3,80,20,0],[6,70,30,0],[9,57,38,5],[12,43,45,12],
 [15,30,47,23],[18,20,43,37],[19,14,38,48],[20,10,30,60]
];
const EXP_TO_NEXT={1:5,2:5,3:6,4:6,5:7,6:7,7:8,8:8,9:9,10:9,11:9,12:10,13:10,14:11,15:11,16:12,17:13,18:14,19:15};
const POOL_CAP={1:18,2:15,3:12};
const pick=arr=>arr[crypto.randomInt(arr.length)];
const copyValue=o=>3**(o.star-1);
const isValidItem=id=>typeof id==='string'&&!!items.all[id];
const itemSellPrice=id=>isValidItem(id)?(items.all[id].basic?2:5):0;
const costOf=id=>byId.get(id)?.cost||0;
const saleUnitValue=o=>o.star===1?costOf(o.characterId):Math.ceil(costOf(o.characterId)*copyValue(o)/2);
const blank=()=>({credits:5,level:1,exp:0,shop:[],locked:false,owned:[],items:[],overflowItems:[],pendingUnits:[],nextUid:1,lastIncomeRound:1,settled:[],earned:[]});
function makeInitial(){
 const a=blank();
 const starter=pick(playable.filter(u=>u.cost===1));
 a.owned.push({uid:a.nextUid++,characterId:starter.id,star:1,location:'board',x:1,y:1,items:[]});
 refreshShop(a,true);
 return a;
}
function eligible(a){
 return playable.filter(u=>{
  let copies=a.owned.filter(o=>o.characterId===u.id).reduce((n,o)=>n+copyValue(o),0);
  copies+=a.pendingUnits.filter(o=>o.characterId===u.id).reduce((n,o)=>n+copyValue(o),0);
  copies+=a.shop.filter(id=>id===u.id).length;
  return copies<POOL_CAP[u.cost];
 });
}
function oneShop(a){
 const pool=eligible(a);if(!pool.length)return null;
 const row=COST_WEIGHTS.find(w=>a.level<=w[0])||COST_WEIGHTS.at(-1);
 const costs=[1,2,3].filter(k=>pool.some(u=>u.cost===k)&&row[k]>0);
 let roll=crypto.randomInt(costs.reduce((n,k)=>n+row[k],0)),cost=costs.at(-1);
 for(const k of costs){roll-=row[k];if(roll<0){cost=k;break}}
 return pick(pool.filter(u=>u.cost===cost)).id;
}
function refreshShop(a,free=false){
 if(!free){if(a.credits<2)throw Error('리롤 크레딧 부족');a.credits-=2}
 a.shop=[];
 for(let i=0;i<5;i++)a.shop.push(oneShop(a));
}
function addExp(a,n){
 if(!Number.isSafeInteger(n)||n<0)throw Error('잘못된 EXP');
 a.exp+=n;
 while(a.level<20&&a.exp>=(EXP_TO_NEXT[a.level]||Infinity)){
  a.exp-=EXP_TO_NEXT[a.level];a.level++;
 }
 if(a.level===20)a.exp=0;
}
function giveItem(a,id){
 if(!isValidItem(id))throw Error('알 수 없는 아이템');
 if(a.items.length<12)a.items.push(id);else a.overflowItems.push(id);
}
function flushOverflow(a){
 while(a.items.length<12&&a.overflowItems.length)a.items.push(a.overflowItems.shift());
}
function benchCount(a){return a.owned.filter(o=>o.location==='bench').length}
function tryMerge(a){
 // Return every absorbed unit's gear; preserve the deployed survivor and its slot.
 for(let steps=0;steps<30;steps++){
  const grouped=new Map();
  for(const o of a.owned.filter(x=>x.star<3)){
   const key=o.characterId+'|'+o.star;
   if(!grouped.has(key))grouped.set(key,[]);
   grouped.get(key).push(o);
  }
  const triple=[...grouped.values()].find(group=>group.length>=3)?.slice(0,3);
  if(!triple)break;
  const survivor=triple.find(o=>o.location==='board')||triple[0];
  for(const other of triple)if(other!==survivor){
   // Equipped items are returned even if inventory is full.
   for(const item of other.items||[])giveItem(a,item);
  }
  a.owned=a.owned.filter(o=>!triple.includes(o)||o===survivor);
  survivor.star++;
 }
}
function acceptPending(a){
 let changed=true;
 while(changed){
  changed=false;
  for(let i=0;i<a.pendingUnits.length;i++){
   const u=a.pendingUnits[i];
   const canMerge=a.owned.filter(o=>o.characterId===u.characterId&&o.star===u.star).length>=2&&u.star<3;
   if(benchCount(a)>=8&&!canMerge)continue;
   a.pendingUnits.splice(i,1);a.owned.push(u);tryMerge(a);changed=true;break;
  }
 }
 flushOverflow(a);
}
function grantUnit(a,id,star=1,gear=[]){
 if(!byId.has(id)||![1,2,3].includes(star))throw Error('잘못된 실험체 보상');
 if(!Array.isArray(gear)||gear.length>3||gear.some(x=>!isValidItem(x)))throw Error('잘못된 장비 보상');
 const o={uid:a.nextUid++,characterId:id,star,location:'bench',x:null,y:null,items:[...gear]};
 a.pendingUnits.push(o);acceptPending(a);
 return o.uid;
}
function grant(a,reward,key){
 if(a.settled.includes(key))return false;
 if(a.settled.length>400)a.settled.shift();
 // Validate before recording the idempotency key.
 switch(reward.type){
  case 'credits': if(!Number.isInteger(reward.value)||reward.value<0||reward.value>1000)throw Error('보상 크레딧 오류');a.credits+=reward.value;break;
  case 'exp': if(!Number.isInteger(reward.value)||reward.value<0||reward.value>1000)throw Error('보상 EXP 오류');addExp(a,reward.value);break;
  case 'complete': {
   const id=items.recipes[reward.value]?.[0];if(!id)throw Error('완성템 보상 오류');
   giveItem(a,id);break;
  }
  case 'basic':{const id=items.baseNames[reward.value];if(!id)throw Error('기본템 보상 오류');giveItem(a,id);break}
  case 'unit':{
   if(!byId.has(reward.value)||![1,2,3].includes(reward.star))throw Error('실험체 보상 오류');
   grantUnit(a,reward.value,reward.star);
   if(reward.bonusBasic!==undefined){
    const id=items.baseNames[reward.bonusBasic];if(!id)throw Error('추가 재료 오류');giveItem(a,id);
   }
   break;
  }
  case 'selection':{
   if(!isValidItem(reward.item))throw Error('선점 장비 오류');
   grantUnit(a,reward.characterId,reward.star||1,[reward.item]);break;
  }
  default:throw Error('알 수 없는 보상 유형');
 }
 a.settled.push(key);a.earned.push({key,reward});if(a.earned.length>40)a.earned.shift();
 return true;
}
function roundIncome(a,round){
 if(round<=a.lastIncomeRound)return false;
 const interest=Math.min(3,Math.floor(a.credits/10));
 a.credits+=5+interest;addExp(a,4);
 if(!a.locked)refreshShop(a,true);
 a.lastIncomeRound=round;acceptPending(a);
 return true;
}
function ownTeam(a){return a.owned.filter(o=>o.location==='board').map(o=>({characterId:o.characterId,star:o.star,x:o.x,y:o.y,items:o.items.slice()}))}
function action(a,cmd,body={}){
 // Calls are serialized in the single-process HTTP server. Validate first, mutate once.
 const locate=()=>{const o=a.owned.find(x=>x.uid===Number(body.uid));if(!o)throw Error('보유하지 않은 실험체');return o};
 if(cmd==='buy'){
  const i=Number(body.index);if(!Number.isInteger(i)||i<0||i>=5)throw Error('상점 위치 오류');
  const id=a.shop[i],cost=costOf(id);if(!id||!cost)throw Error('이미 팔린 상품');
  if(a.credits<cost)throw Error('크레딧 부족');
  const possibleMerge=a.owned.filter(o=>o.characterId===id&&o.star===1).length>=2;
  if(benchCount(a)>=8&&!possibleMerge)throw Error('벤치 부족');
  a.credits-=cost;a.shop[i]=null;grantUnit(a,id,1);
 }else if(cmd==='reroll')refreshShop(a);
 else if(cmd==='lock')a.locked=!a.locked;
 else if(cmd==='invest'){
  if(a.level===20||a.credits<2)throw Error('숙련도 투자 불가');
  a.credits-=2;addExp(a,2);
 }else if(cmd==='sell-unit'){
  const u=locate();a.credits+=saleUnitValue(u);
  for(const item of u.items||[])giveItem(a,item);
  a.owned.splice(a.owned.indexOf(u),1);acceptPending(a);
 }else if(cmd==='deploy'){
  const u=locate(),x=Number(body.x),y=Number(body.y);
  if(!Number.isInteger(x)||x<0||x>2||!Number.isInteger(y)||y<0||y>2)throw Error('좌표 오류');
  const existing=a.owned.find(o=>o!==u&&o.location==='board'&&o.x===x&&o.y===y);
  if(u.location!=='board'&&a.owned.filter(o=>o.location==='board').length>=3&&!existing)throw Error('출전 3명 제한');
  if(existing){existing.location='bench';existing.x=null;existing.y=null}
  u.location='board';u.x=x;u.y=y;acceptPending(a);
 }else if(cmd==='recall'){
  const u=locate();if(u.location!=='board')throw Error('배치되지 않은 유닛');
  if(benchCount(a)>=8)throw Error('벤치 부족');
  u.location='bench';u.x=null;u.y=null;acceptPending(a);
 }else if(cmd==='swap'){
  const a1=locate(),b1=a.owned.find(o=>o.uid===Number(body.otherUid));
  if(!b1)throw Error('다른 실험체를 찾을 수 없어');
  const pos1={location:a1.location,x:a1.x,y:a1.y},pos2={location:b1.location,x:b1.x,y:b1.y};
  Object.assign(a1,pos2);Object.assign(b1,pos1);
 }else if(cmd==='sell-item'){
  const i=Number(body.index);if(!Number.isInteger(i)||i<0||i>=a.items.length)throw Error('아이템 위치 오류');
  const item=a.items[i];a.credits+=itemSellPrice(item);a.items.splice(i,1);flushOverflow(a);
 }else if(cmd==='craft'){
  const i=Number(body.index),j=Number(body.otherIndex);
  if(!Number.isInteger(i)||!Number.isInteger(j)||i===j||i<0||j<0||i>=a.items.length||j>=a.items.length)throw Error('조합 선택 오류');
  const combined=items.craft(a.items[i],a.items[j]);if(!combined)throw Error('조합 불가');
  for(const index of [i,j].sort((x,y)=>y-x))a.items.splice(index,1);
  giveItem(a,combined);flushOverflow(a);
 }else if(cmd==='equip'){
  const u=locate(),i=Number(body.index),name=a.items[i];
  if(!Number.isInteger(i)||!isValidItem(name))throw Error('장비가 없어');
  if(items.bloodInfo?.(name)&&u.characterId!=='justina')throw Error('혈색반월은 유스티나 전용');
  const eq=u.items, blood=eq.findIndex(n=>items.bloodInfo?.(n));
  if(blood>=0){
   const absorb=items.craft(eq[blood],name);
   if(absorb){eq[blood]=absorb;a.items.splice(i,1);flushOverflow(a);return a;}
  }
  const j=items.all[name].basic?eq.findIndex(n=>items.all[n]?.basic):-1;
  if(j>=0){
   const made=items.craft(eq[j],name);if(!made)throw Error('장비 조합 실패');
   eq[j]=made;
  }else{if(eq.length>=3)throw Error('장비 슬롯 최대 3개');eq.push(name)}
  a.items.splice(i,1);flushOverflow(a);
 }else throw Error('알 수 없는 경제 명령');
 return a;
}
module.exports={makeInitial,action,roundIncome,grant,grantUnit,giveItem,ownTeam,addExp,itemSellPrice,saleUnitValue,EXP_TO_NEXT};
