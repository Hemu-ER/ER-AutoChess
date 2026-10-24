'use strict';
const assert=require('node:assert/strict');
const eco=require('../match-economy.cjs');
const trade=require('../match-market.cjs');
const {server,rooms,advanceRoom,playerView}=require('../server.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const progress=()=>({exploration:{visited:[],stacks:0},infiltration:0,infiltrationRewards:0,bloodMoonGranted:false});
let nonce=0;
function fixture(count=3){
 const code='M803'+(nonce++);
 const players=Array.from({length:count},(_,slot)=>{
  const assets=eco.makeInitial();
  assets.credits=100;
  return {id:code+'p'+slot,token:code+'tok'+slot,room:code,name:'P'+slot,slot,ready:true,connected:true,assets,team:eco.ownTeam(assets),mastery:1,progress:progress()};
 });
 const game={round:7,kind:'shop',phase:'prep',hp:Array(count).fill(100),schedule:['shop','auction','boss','experiment','selection'],endsAt:0,earlyEndsAt:null,version:1,pairs:[],byeCounts:{},lastOpponents:{},previousByeSlot:null};
 const room={code,maxPlayers:count,players:new Map(players.map(p=>[p.id,p])),messages:[],revision:0,started:true,game};
 rooms.set(code,room);
 advanceRoom(room);
 assert.equal(game.phase,'special');
 assert.equal(game.specialType,'shop');
 assert(game.market);
 assert(game.endsAt>Date.now()+118000,'A shop event lasts 120 seconds');
 return {room,players,game};
}
async function port(){
 for(let i=0;i<120&&!server.listening;i++)await sleep(20);
 assert(server.listening,'Expected server listening');
 return server.address().port;
}
async function call(urlPort,p,cmd,payload={}){
 const resp=await fetch(`http://127.0.0.1:${urlPort}/api/market`,{method:'POST',headers:{'content-type':'application/json','x-live-token':p.token},body:JSON.stringify({cmd,...payload})});
 return {status:resp.status,data:await resp.json()};
}
(async()=>{
 const urlPort=await port();
 try{
  for(const count of [2,3,4,5,6,7,8]){
   const {room,players,game}=fixture(count);
   const [a,b,...others]=players;
   // Client cannot list another player's unit or fabricate item payloads.
   const badUnit=await call(urlPort,a,'list',{kind:'unit',uid:987654,price:1});
   assert.equal(badUnit.status,409);
   const badCost=await call(urlPort,a,'list',{kind:'unit',uid:a.assets.owned[0].uid,price:0});
   assert.equal(badCost.status,409);
   const badType=await call(urlPort,a,'list',{kind:'item',index:0,price:1, item:'레이더'});
   assert.equal(badType.status,409);
   assert.equal(a.assets.owned.length,1);

   // One unit with attached gear is escrowed directly from deployed board.
   const starter=a.assets.owned[0];
   const name=starter.characterId,star=starter.star,uid=starter.uid;
   starter.items=['검집','금팔찌'];
   a.team=eco.ownTeam(a.assets);
   const posted=await call(urlPort,a,'list',{kind:'unit',uid,price:11});
   assert.equal(posted.status,200,JSON.stringify(posted.data));
   assert.equal(a.assets.owned.length,0);
   assert.equal(a.team.length,0);
   const listingId=posted.data.listingId;
   const publicGame=playerView(room,b).game;
   assert.equal(publicGame.market.listings[0].unit.characterId,name);
   assert.deepEqual(publicGame.market.listings[0].unit.items,['검집','금팔찌']);
   assert(!('uid' in publicGame.market.listings[0].unit),'Buyer cannot see private owned uid');
   assert(!playerView(room,b).players.find(x=>x.slot===a.slot).assets,'Other player wallet remains private');
   const self=await call(urlPort,a,'buy',{listingId});
   assert.equal(self.status,409);
   const fundsBefore=a.assets.credits,buysBefore=b.assets.credits;
   const result=await Promise.all([call(urlPort,b,'buy',{listingId}),...others.map(p=>call(urlPort,p,'buy',{listingId}))]);
   assert.equal(result.filter(x=>x.status===200).length,1,'Exactly one concurrent buyer gets the unit');
   const winner=players.find(p=>p.slot!==a.slot&&p.assets.owned.some(u=>u.characterId===name&&u.items.includes('검집')));
   assert(winner,'Buyer receives the unit and gear as one bundle');
   assert.equal(winner.assets.credits,100-11);
   assert.equal(a.assets.credits,fundsBefore+11,'Seller gets 100% of the sale price');
   assert.equal(game.market.listings.find(l=>l.id===listingId).status,'sold');
   assert.equal((await call(urlPort,b,'buy',{listingId})).status,409);
   assert.equal((await call(urlPort,a,'cancel',{listingId})).status,409);

   // Another item can be offered and seller can revoke it.
   eco.giveItem(a.assets,'방탄 조끼');
   const listItem=await call(urlPort,a,'list',{kind:'item',index:0,price:5});
   assert.equal(listItem.status,200);
   const itemId=listItem.data.listingId;
   assert(!a.assets.items.includes('방탄 조끼'));
   const forbidCancel=await call(urlPort,b,'cancel',{listingId:itemId});
   assert.equal(forbidCancel.status,409);
   const canceled=await call(urlPort,a,'cancel',{listingId:itemId});
   assert.equal(canceled.status,200);
   assert(a.assets.items.includes('방탄 조끼'));
   // End of market returns every active escrow item.
   eco.giveItem(a.assets,'철사');
   const pending=await call(urlPort,a,'list',{kind:'item',index:a.assets.items.indexOf('철사'),price:99});
   assert.equal(pending.status,200);
   assert(!a.assets.items.includes('철사'));
   game.endsAt=0;game.earlyEndsAt=null;advanceRoom(room);
   assert.equal(game.phase,'result');
   assert(a.assets.items.includes('철사'),'Expired listing returns to the original owner');
   assert.equal(game.market.listings.find(x=>x.id===pending.data.listingId).status,'returned');
   assert.equal((await call(urlPort,b,'buy',{listingId:pending.data.listingId})).status,409);
   rooms.delete(room.code);
  }
  {
   const {room,players,game}=fixture(3);
   const [a,b,c]=players;
   const originalUid=a.assets.owned[0].uid;
   const post=await call(urlPort,a,'list',{kind:'unit',uid:originalUid,price:1});
   assert.equal(post.status,200);
   const back=await call(urlPort,a,'cancel',{listingId:post.data.listingId});
   assert.equal(back.status,200);
   const unit=a.assets.owned.find(x=>x.uid===originalUid);
   assert(unit&&unit.location==='board'&&unit.x===1&&unit.y===1,'Cancel restores board slot and original uid');
   assert.equal(a.team.length,1);
   const item=eco.grantUnit(a.assets,'katja',3,['검집']);
   const offer=await call(urlPort,a,'list',{kind:'unit',uid:item,price:40});
   assert.equal(offer.status,200);
   // Receiver has no bench room, must queue the purchased 3-star unit preserving equipment.
   b.assets.owned.push(...Array.from({length:8},(_,i)=>({uid:b.assets.nextUid++,characterId:'haze',star:3,location:'bench',x:null,y:null,items:[]})));
   const bought=await call(urlPort,b,'buy',{listingId:offer.data.listingId});
   assert.equal(bought.status,200);
   const queued=b.assets.pendingUnits.find(x=>x.characterId==='katja'&&x.star===3);
   assert(queued&&queued.items.includes('검집'),'Bought star 3 and gear remain in overflow queue');
   assert.equal(a.assets.credits,140);
   rooms.delete(room.code);
  }
  {
   const {room,players,game}=fixture(3);
   const [a,b,c]=players;
   // A player leaving an active market must not leave purchasable orphaned listings.
   eco.giveItem(a.assets,'검집');
   const posted=await call(urlPort,a,'list',{kind:'item',index:0,price:1});
   const resp=await fetch(`http://127.0.0.1:${urlPort}/api/leave`,{method:'POST',headers:{'content-type':'application/json','x-live-token':a.token},body:'{}'});
   assert.equal(resp.status,200);
   assert.equal(game.market.listings.find(l=>l.id===posted.data.listingId).status,'returned');
   assert.equal((await call(urlPort,b,'buy',{listingId:posted.data.listingId})).status,409);
   rooms.delete(room.code);
  }
  {
   const {room,players,game}=fixture(5);
   assert.equal((await call(urlPort,players[0],'ready',{ready:true})).status,200);
   assert.equal(game.earlyEndsAt,null,'One player cannot end the market alone');
   await Promise.all(players.slice(1).map(p=>call(urlPort,p,'ready',{ready:true})));
   assert(game.earlyEndsAt&&game.earlyEndsAt<=game.endsAt,'All ready -> early end within 3 seconds');
   const revoke=await call(urlPort,players[0],'ready',{ready:false});
   assert.equal(revoke.status,200);assert.equal(game.earlyEndsAt,null,'Revoking readiness cancels early finish');
   rooms.delete(room.code);
  }
  {
   const {room,players,game}=fixture(2);
   const [seller,buyer]=players;
   // Listing and selling the last deployed unit must not freeze R8 preparation forever.
   const last=seller.assets.owned[0].uid;
   const listing=await call(urlPort,seller,'list',{kind:'unit',uid:last,price:1});
   assert.equal(listing.status,200);
   assert.equal((await call(urlPort,buyer,'buy',{listingId:listing.data.listingId})).status,200);
   assert.equal(seller.team.length,0);
   game.endsAt=0;advanceRoom(room);assert.equal(game.phase,'result');
   game.endsAt=0;advanceRoom(room);assert.equal(game.phase,'prep');assert.equal(game.round,8);
   game.missingTeamGraceStartedAt=Date.now()-11000;game.endsAt=0;advanceRoom(room);
   assert.equal(game.phase,'intro','Empty team proceeds after 10s grace');
   game.endsAt=0;advanceRoom(room);
   assert.equal(game.phase,'combat');
   assert.equal(game.pairs[0].battle.auto,true);
   assert.equal(game.pairs[0].battle.outcome,game.pairs[0].a===seller.slot?'B팀 승리':'A팀 승리');
   game.endsAt=0;advanceRoom(room);
   assert.equal(game.phase,'result');
   assert(game.hp[seller.slot]<100,'No team means an automatic PvP loss, not infinite waiting');
   rooms.delete(room.code);
  }
  console.log('M8-03 PASS: 2–8 person listings, escrow, bundle ownership, price validation, atomic concurrent purchases, cancel/expire/leave returns, bench overflow, readiness');
 }finally{rooms.clear();server.closeAllConnections();server.close();setTimeout(()=>process.exit(process.exitCode||0),100);}
})().catch(e=>{console.error(e);rooms.clear();server.closeAllConnections();server.close();process.exitCode=1});
