'use strict';
// M8-04: authoritative sequential public auction. All bids reserve match credits.
const crypto=require('node:crypto');
const economy=require('./match-economy.cjs');
const {roster}=require('./roster.js');
const items=require('./items.js');
const play=roster.filter(r=>!r.pveOnly);
const pick=a=>a[crypto.randomInt(a.length)];
const CATEGORIES=Object.freeze(['complete','unit2','unit3','effect']);
const EFFECTS=Object.freeze([
 {id:'assault',name:'선봉의 기세',detail:'모든 PvP에서 아군 공격력 +10%',kind:'combat',stat:'atk',ratio:.10,duration:null},
 {id:'fortify',name:'강철의 전열',detail:'다음 PvP 3회 동안 아군 최대 체력 +12%',kind:'combat',stat:'hp',ratio:.12,duration:3},
 {id:'bastion',name:'요새화',detail:'다음 PvP 3회 동안 아군 방어력 +12',kind:'combat',stat:'def',ratio:12,duration:3},
 {id:'subsidy',name:'후원 협약',detail:'다음 라운드 시작 3회 동안 추가 +2C',kind:'income',amount:2,duration:3},
 {id:'research',name:'연구 장려금',detail:'다음 라운드 시작 3회 동안 추가 +3EXP',kind:'exp',amount:3,duration:3},
 {id:'bounty',name:'승전 포상',detail:'다음 PvP 승리 2회마다 +4C',kind:'winCredits',amount:4,duration:2},
 {id:'recovery',name:'응급 복구',detail:'다음 PvP 패배 시 플레이어 HP +8 회복(최대 100)',kind:'lossHeal',amount:8,duration:1},
 {id:'salvage',name:'승리의 전리품',detail:'다음 PvP 승리 2회마다 기본 아이템 1개',kind:'winItem',duration:2}
]);
const living=r=>[...r.players.values()].filter(p=>r.game?.hp[p.slot]>0);
const find=(r,slot)=>[...r.players.values()].find(p=>p.slot===slot);
function buildLots(){
 const kinds=[...CATEGORIES];
 for(let i=kinds.length-1;i>0;i--){const j=crypto.randomInt(i+1);[kinds[i],kinds[j]]=[kinds[j],kinds[i]];}
 return kinds.slice(0,3).map((kind,index)=>{
  let reward;
  if(kind==='complete')reward={type:'item',item:pick(items.recipes)[0]};
  if(kind==='unit2'||kind==='unit3')reward={type:'unit',characterId:pick(play.filter(x=>x.cost===(kind==='unit2'?2:3))).id,star:kind==='unit2'?2:1};
  if(kind==='effect')reward={type:'effect',effect:pick(EFFECTS).id};
  return {index,kind,reward,status:'upcoming',bid:0,bidderSlot:null,winnerSlot:null};
 });
}
function open(now=Date.now(),lots=buildLots()){
 if(lots.length!==3||new Set(lots.map(x=>x.kind)).size!==3)throw Error('경매에는 종류가 서로 다른 3개 매물이 필요해.');
 const a={lots:structuredClone(lots),index:0,endsAt:now+15000,revision:1,closed:false,lastResult:null};
 a.lots[0].status='bidding';return a;
}
function view(a){return {index:a.index,endsAt:a.endsAt,revision:a.revision,closed:a.closed,lastResult:a.lastResult,lots:a.lots.map(x=>({...x,reward:{...x.reward,...(x.reward.type==='effect'?{info:EFFECTS.find(e=>e.id===x.reward.effect)}:{})}}))};}
function bid(r,actor,amount,now=Date.now()){
 const a=r.game?.auction;
 if(!a||a.closed||r.game.phase!=='special'||r.game.specialType!=='auction'||now>=a.endsAt)throw Error('입찰할 수 있는 시간이 아니야.');
 if(!(r.game.hp[actor.slot]>0)||!actor.assets)throw Error('탈락자는 입찰할 수 없어.');
 if(typeof amount!=='number'||!Number.isSafeInteger(amount)||amount<1)throw Error('입찰액은 1 이상의 정확한 정수여야 해.');
 const lot=a.lots[a.index];
 if(!lot||lot.status!=='bidding'||amount<lot.bid+1)throw Error('현재 최고 입찰액보다 1C 이상 높아야 해.');
 const self=lot.bidderSlot===actor.slot;
 const delta=self?amount-lot.bid:amount;
 if(actor.assets.credits<delta)throw Error('잔액이 부족해. 예약된 입찰금은 사용 불가야.');
 const old=lot.bidderSlot===null?null:find(r,lot.bidderSlot);
 if(old&&!old.assets)throw Error('이전 입찰자의 정산 상태가 올바르지 않아.');
 if(!self&&old&&!Number.isSafeInteger(old.assets.credits+lot.bid))throw Error('환불 가능 크레딧 범위를 넘었어.');
 actor.assets.credits-=delta;
 if(!self&&old)old.assets.credits+=lot.bid;
 lot.bid=amount;lot.bidderSlot=actor.slot;
 if(a.endsAt-now<=3000)a.endsAt=now+5000;
 a.revision++;
 return {accepted:true,bid:amount,endsAt:a.endsAt,lotIndex:a.index};
}
function refundCurrent(r){
 const a=r.game?.auction,lot=a?.lots[a.index];if(!lot||lot.bidderSlot===null)return;
 const p=find(r,lot.bidderSlot);
 if(p?.assets)p.assets.credits+=lot.bid;
 lot.bid=0;lot.bidderSlot=null;a.revision++;
}
function playerLeft(r,slot){
 const a=r.game?.auction;
 if(!a||a.closed)return;
 if(a.lots[a.index]?.bidderSlot===slot)refundCurrent(r);
}
function grantEffect(p,id){const e=EFFECTS.find(x=>x.id===id);if(!e)throw Error('효과를 찾을 수 없어.');p.auctionEffects??=[];p.auctionEffects.push({id,remaining:e.duration});syncBuffs(p);}
function syncBuffs(p){const buff={atk:0,hp:0,def:0};for(const a of p.auctionEffects||[]){const e=EFFECTS.find(x=>x.id===a.id);if(e?.kind==='combat'&&(a.remaining===null||a.remaining>0))buff[e.stat]+=e.ratio;}p.progress??={};p.progress.auctionBuffs=buff;}
function settle(r,now=Date.now()){
 const a=r.game?.auction;if(!a||a.closed||now<a.endsAt)return false;
 const lot=a.lots[a.index];
 if(lot.bidderSlot!==null){
  const p=find(r,lot.bidderSlot);
  if(p?.assets&&r.game.hp[p.slot]>0){
   // Credits are already reserved. Only the winner receives the reward.
   if(lot.reward.type==='item')economy.giveItem(p.assets,lot.reward.item);
   else if(lot.reward.type==='unit')economy.grantUnit(p.assets,lot.reward.characterId,lot.reward.star);
   else if(lot.reward.type==='effect')grantEffect(p,lot.reward.effect);
   p.team=economy.ownTeam(p.assets);p.mastery=p.assets.level;
   lot.status='sold';lot.winnerSlot=p.slot;
  }else {refundCurrent(r);lot.status='unsold';}
 }else lot.status='unsold';
 a.lastResult={lotIndex:a.index,winnerSlot:lot.winnerSlot,price:lot.status==='sold'?lot.bid:0,status:lot.status};
 a.index++;
 if(a.index>=a.lots.length){a.closed=true;a.endsAt=now;a.revision++;return true;}
 a.lots[a.index].status='bidding';a.endsAt=now+15000;a.revision++;return true;
}
function onRoundIncome(p){for(const a of p.auctionEffects||[]){const e=EFFECTS.find(x=>x.id===a.id);if(a.remaining<=0||!['income','exp'].includes(e?.kind))continue;if(e.kind==='income')p.assets.credits+=e.amount;else economy.addExp(p.assets,e.amount);a.remaining--;}syncBuffs(p);}
function onPvP(r,slot,won,lost){const p=find(r,slot);if(!p?.assets)return;for(const a of p.auctionEffects||[]){const e=EFFECTS.find(x=>x.id===a.id);if(a.remaining===0||!e)continue;
 if(e.kind==='combat'&&a.remaining!==null)a.remaining--;
 if(won&&e.kind==='winCredits'){p.assets.credits+=e.amount;a.remaining--;}
 if(won&&e.kind==='winItem'){economy.giveItem(p.assets,pick(items.baseNames));a.remaining--;}
 if(lost&&e.kind==='lossHeal'){r.game.hp[slot]=Math.min(100,r.game.hp[slot]+e.amount);a.remaining--;}
 }syncBuffs(p);}
module.exports={CATEGORIES,EFFECTS,open,view,bid,settle,playerLeft,syncBuffs,onRoundIncome,onPvP,buildLots};
