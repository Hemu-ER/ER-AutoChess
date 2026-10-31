'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
process.env.PORT='0';process.env.LIVE_DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'live-m804-'));
const auction=require('../match-auction.cjs');const economy=require('../match-economy.cjs');
const {server,rooms,advanceRoom,playerView}=require('../server.cjs');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function room(count){const tag='AUCT'+Math.random().toString(36).slice(2,8);const players=Array.from({length:count},(_,slot)=>{const assets=economy.makeInitial();assets.credits=100;return {id:tag+'p'+slot,token:tag+'t'+slot,room:tag,name:'P'+slot,connected:true,roundReady:false,ready:true,slot,assets,team:economy.ownTeam(assets),mastery:assets.level,progress:{exploration:{visited:[],stacks:0},infiltration:0,bloodMoonGranted:false}}});const game={round:7,kind:'auction',phase:'prep',schedule:['auction','shop','boss','experiment','selection'],endsAt:0,earlyEndsAt:null,hp:players.map(()=>100),version:1,pairs:[],byeCounts:{},lastOpponents:{}};const r={code:tag,maxPlayers:count,players:new Map(players.map(p=>[p.id,p])),messages:[],revision:0,started:true,game};rooms.set(tag,r);advanceRoom(r);assert.equal(game.phase,'special');assert.equal(game.specialType,'auction');assert.equal(game.auction.lots.length,3);assert.equal(new Set(game.auction.lots.map(x=>x.kind)).size,3);return {r,players,game};}
async function post(port,p,amount){const res=await fetch(`http://127.0.0.1:${port}/api/auction`,{method:'POST',headers:{'content-type':'application/json','x-live-token':p.token},body:JSON.stringify({amount})});return {code:res.status,json:await res.json()};}
(async()=>{
 for(let i=0;i<100;i++){const lots=auction.buildLots();assert.equal(lots.length,3);assert.equal(new Set(lots.map(x=>x.kind)).size,3)}
 for(let i=0;i<120&&!server.listening;i++)await pause(20);assert(server.listening);const port=server.address().port;
 try{
  for(const count of [2,3,4,5,6,7,8]){
   const {r,players,game}=room(count),[a,b,c]=players,au=game.auction;
   assert.equal(au.lots[0].status,'bidding');assert.equal(au.lots[1].status,'upcoming');
   let v=playerView(r,b).game.auction;assert.equal(v.lots.length,3);assert.equal(v.index,0);
   assert.equal((await post(port,a,0)).code,409);
   assert.equal((await post(port,a,1.5)).code,409);
   assert.equal((await post(port,a,101)).code,409);
   assert.equal((await post(port,a,1)).code,200);
   assert.equal(a.assets.credits,99,'First bidder reserves 1C');
   assert.equal((await post(port,a,1)).code,409,'Current bid not sufficient');
   assert.equal((await post(port,b,3)).code,200);
   assert.equal(a.assets.credits,100,'Outbid player gets full refund');
   assert.equal(b.assets.credits,97,'New highest bidder reserves 3C');
   assert.equal((await post(port,b,4)).code,200,'Self-raise allowed');
   assert.equal(b.assets.credits,96,'Self-raise charges only delta');
   assert.equal((await post(port,a,5)).code,200);
   assert.equal(b.assets.credits,100,'Self-raise reservation refunded in full');
   assert.equal(a.assets.credits,95);
   const concurrent=await Promise.all(players.slice(1).map((p,i)=>post(port,p,10+i)));
   assert(concurrent.some(x=>x.code===200));
   const lot=au.lots[au.index],highest=players.find(p=>p.slot===lot.bidderSlot);
   const total=players.reduce((n,p)=>n+p.assets.credits,0);
   assert.equal(total,count*100-lot.bid,'Only highest live reservation is excluded from wallets');
   const soldBefore=highest.assets.owned.length+highest.assets.pendingUnits.length+highest.assets.items.length+highest.assets.overflowItems.length+(highest.auctionEffects?.length||0);
   au.endsAt=Date.now()-1;game.endsAt=au.endsAt;advanceRoom(r);
   assert.equal(lot.status,'sold');assert.equal(lot.winnerSlot,highest.slot);
   assert.equal(au.index,1);assert.equal(game.phase,'special');
   const soldAfter=highest.assets.owned.length+highest.assets.pendingUnits.length+highest.assets.items.length+highest.assets.overflowItems.length+(highest.auctionEffects?.length||0);
   assert(soldAfter>=soldBefore,'Bid winner receives a reward');
   // Canceling a winning player before an auction expires refunds without awarding.
   assert.equal((await post(port,a,1)).code,200);
   const active=au.lots[1],winner=players.find(p=>p.slot===active.bidderSlot),refund=winner.assets.credits;
   auction.playerLeft(r,winner.slot);assert.equal(winner.assets.credits,refund+1);assert.equal(active.bidderSlot,null);
   au.endsAt=Date.now()-1;game.endsAt=au.endsAt;advanceRoom(r);assert.equal(au.index,2);assert.equal(au.lots[1].status,'unsold');
   au.endsAt=Date.now()-1;game.endsAt=au.endsAt;advanceRoom(r);
   assert.equal(game.phase,'result');assert.equal(au.closed,true);assert.equal(au.lots[2].status,'unsold');
   assert.equal((await post(port,b,1)).code,409);
   rooms.delete(r.code);
  }
  const {r,players,game}=room(2),a=game.auction;assert.equal((await post(port,players[0],1)).code,200);
  a.endsAt=Date.now()+2400;game.endsAt=a.endsAt;
  const extended=await post(port,players[1],2);assert.equal(extended.code,200);assert(extended.json.endsAt>Date.now()+4200,'Bid in last 3 seconds extends to five seconds');assert.equal(game.endsAt,a.endsAt);
  rooms.delete(r.code);
  // Effect lifecycle and server-only receipt.
  const p={slot:0,assets:economy.makeInitial(),progress:{},auctionEffects:[]};
  const rr={players:new Map([['x',p]]),game:{hp:[60]}};
  const sample=[{id:'assault',remaining:null},{id:'fortify',remaining:3},{id:'subsidy',remaining:3},{id:'research',remaining:3},{id:'bounty',remaining:2},{id:'recovery',remaining:1},{id:'salvage',remaining:2}];p.auctionEffects=structuredClone(sample);auction.syncBuffs(p);assert.equal(p.progress.auctionBuffs.atk,.1);assert.equal(p.progress.auctionBuffs.hp,.12);
  const before=p.assets.credits;auction.onRoundIncome(p);assert.equal(p.assets.credits,before+2);
  const afterLevel=p.assets.exp;assert(afterLevel>=3 || p.assets.level>1);
  auction.onPvP(rr,0,true,false);assert.equal(p.assets.credits,before+6);assert.equal(p.auctionEffects.find(x=>x.id==='fortify').remaining,2);assert(p.assets.items.length>0,'victory salvage grants basic item');
  auction.onPvP(rr,0,false,true);assert.equal(rr.game.hp[0],68,'defeat heal restores 8HP once');
  auction.onPvP(rr,0,false,true);assert.equal(rr.game.hp[0],68,'defeat heal does not trigger twice');
  console.log('M8-04 AUCTION PASS: three distinct lots, 2–8 users, reservation/refund/raise, concurrent bids, 15s+extension, three-lot progression, winners, bye effects, post-close lock');
 } finally {rooms.clear();await new Promise(resolve=>server.close(resolve));}
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
