'use strict';
// M8-03: server-owned market escrow. No browser-submitted unit or item payloads.
const economy=require('./match-economy.cjs');
const {roster}=require('./roster.js');
const items=require('./items.js');
const byId=new Map(roster.filter(r=>!r.pveOnly).map(r=>[r.id,r]));

const participant=(room,slot)=>[...room.players.values()].find(p=>p.slot===slot)||null;
const available=room=>[...room.players.values()].filter(p=>room.game?.hp[p.slot]>0&&p.assets);

function open(){
 return {nextId:1,listings:[],ready:{},lastTrade:null,revision:1};
}
function getListing(market,id){
 if(!Number.isSafeInteger(id)||id<1)throw Error('매물 번호가 올바르지 않아.');
 const listing=market.listings.find(x=>x.id===id);
 if(!listing||listing.status!=='active')throw Error('이미 거래가 끝난 매물이야.');
 return listing;
}
function priceOf(input){
 // No arbitrary game-price cap. JS safe integers are required to avoid rounding/transferring phantom credits.
 if(typeof input!=='number'||!Number.isSafeInteger(input)||input<1)throw Error('가격은 1 이상의 정확한 정수 크레딧이어야 해.');
 return input;
}
function publicView(market){
 return {revision:market.revision,ready:{...market.ready},lastTrade:market.lastTrade,
  listings:market.listings.map(l=>({
   id:l.id,sellerSlot:l.sellerSlot,price:l.price,status:l.status,
   ...(l.kind==='item'?{kind:'item',item:l.item}:{kind:'unit',unit:{
    characterId:l.unit.characterId,star:l.unit.star,items:[...l.unit.items]
   }}),
   buyerSlot:l.buyerSlot??null
  }))};
}
function takeUnit(assets,uid){
 if(!Number.isSafeInteger(uid)||uid<1)throw Error('실험체 번호가 올바르지 않아.');
 const i=assets.owned.findIndex(o=>o.uid===uid);
 if(i<0)throw Error('이 실험체를 소유하고 있지 않아.');
 const unit=assets.owned[i];
 if(!byId.has(unit.characterId)||![1,2,3].includes(unit.star)||unit.items.some(x=>!items.all[x]))throw Error('거래할 수 없는 실험체야.');
 assets.owned.splice(i,1);
 return structuredClone(unit);
}
function takeItem(assets,index){
 if(!Number.isSafeInteger(index)||index<0||index>=assets.items.length)throw Error('아이템 위치가 잘못됐어.');
 const item=assets.items[index];
 if(!items.all[item])throw Error('거래할 수 없는 아이템이야.');
 assets.items.splice(index,1);
 // Already-owned overflow automatically becomes available, without copying the listed item.
 while(assets.items.length<12&&assets.overflowItems.length)assets.items.push(assets.overflowItems.shift());
 return item;
}
function restore(assets,listing){
 if(listing.kind==='item'){economy.giveItem(assets,listing.item);return;}
 const saved=structuredClone(listing.unit);
 const slotFree=saved.location==='board'&&
  !assets.owned.some(u=>u.location==='board'&&u.x===saved.x&&u.y===saved.y)&&
  assets.owned.filter(u=>u.location==='board').length<3;
 if(!slotFree){
  saved.location='bench';saved.x=null;saved.y=null;
  if(assets.owned.filter(u=>u.location==='bench').length>=8){assets.pendingUnits.push(saved);return;}
 }
 assets.owned.push(saved);
 // Original uid remains valid for restored units.
 // Other pending units can enter if the owned units merge.
 // No automatic merging on return: market escrow never silently consumes a listed 3-star unit.
}
function syncTeam(p){
 if(p?.assets){p.team=economy.ownTeam(p.assets);p.mastery=p.assets.level;}
}
function cancelOne(room,listing){
 if(listing.status!=='active')return false;
 const seller=participant(room,listing.sellerSlot);
 if(seller?.assets) {
  const cloned=structuredClone(seller.assets);
  restore(cloned,listing);
  seller.assets=cloned;syncTeam(seller);
 }
 listing.status='returned';
 room.game.market.revision++;
 return true;
}
function cancelSeller(room,slot){
 const m=room.game?.market;if(!m)return;
 for(const listing of m.listings)if(listing.sellerSlot===slot)cancelOne(room,listing);
 delete m.ready[slot];
}
function close(room){
 const m=room.game?.market;if(!m)return;
 for(const listing of m.listings)cancelOne(room,listing);
 m.closed=true;
}
function allReady(room){
 const m=room.game?.market;
 const survivors=available(room);
 return survivors.length>1&&survivors.every(p=>p.connected&&m.ready[p.slot]);
}
function act(room,actor,cmd,data={}){
 const g=room.game,m=g?.market;
 if(!g||g.phase!=='special'||g.specialType!=='shop'||!m||m.closed)throw Error('거래 상점 시간이 아니야.');
 if(Date.now()>=Math.min(g.endsAt,g.earlyEndsAt||Infinity))throw Error('거래 시간이 끝났어.');
 if(!(g.hp[actor.slot]>0)||!actor.assets)throw Error('탈락자는 거래할 수 없어.');
 if(cmd==='ready'){
  m.ready[actor.slot]=!!data.ready;
  m.revision++;
  return {ready:m.ready[actor.slot],allReady:allReady(room)};
 }
 if(cmd==='list'){
  const price=priceOf(data.price);
  if(m.listings.filter(l=>l.status==='active').length>=256)throw Error('동시 거래 매물 수 한도에 도달했어.');
  if(!['unit','item'].includes(data.kind))throw Error('매물 종류가 올바르지 않아.');
  const next=structuredClone(actor.assets);
  const obj=data.kind==='unit'?{unit:takeUnit(next,data.uid)}:{item:takeItem(next,data.index)};
  const listing={id:m.nextId++,sellerSlot:actor.slot,kind:data.kind,price,status:'active',...obj};
  actor.assets=next;syncTeam(actor);
  m.listings.push(listing);m.ready={};m.revision++;
  return {listingId:listing.id};
 }
 if(cmd==='cancel'){
  const l=getListing(m,Number(data.listingId));
  if(l.sellerSlot!==actor.slot)throw Error('내 매물만 취소할 수 있어.');
  cancelOne(room,l);m.ready={};
  return {canceled:l.id};
 }
 if(cmd==='buy'){
  const l=getListing(m,Number(data.listingId));
  if(l.sellerSlot===actor.slot)throw Error('자기 매물은 구매할 수 없어.');
  const seller=participant(room,l.sellerSlot);
  if(!seller?.assets||!(g.hp[seller.slot]>0))throw Error('판매자가 더 이상 거래에 참여하지 않아.');
  if(actor.assets.credits<l.price)throw Error('크레딧이 부족해.');
  // Stage all asset mutations, commit only after both sides have passed validation.
  const buyerAssets=structuredClone(actor.assets),sellerAssets=structuredClone(seller.assets);
  if(l.kind==='item')economy.giveItem(buyerAssets,l.item);
  else economy.grantUnit(buyerAssets,l.unit.characterId,l.unit.star,l.unit.items);
  buyerAssets.credits-=l.price;
  if(!Number.isSafeInteger(sellerAssets.credits+l.price))throw Error('판매자 크레딧 정산 범위 초과.');
  sellerAssets.credits+=l.price;
  actor.assets=buyerAssets;seller.assets=sellerAssets;
  syncTeam(actor);syncTeam(seller);
  l.status='sold';l.buyerSlot=actor.slot;
  m.lastTrade={listingId:l.id,sellerSlot:seller.slot,buyerSlot:actor.slot,price:l.price};
  m.ready={};m.revision++;
  return {bought:l.id,price:l.price};
 }
 throw Error('알 수 없는 거래 명령이야.');
}
module.exports={open,act,publicView,close,cancelSeller,allReady,restore};
