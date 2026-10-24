'use strict';
const assert=require('node:assert/strict');
const {rooms,server,advanceRoom,playerView}=require('../server.cjs');
const eco=require('../match-economy.cjs');
const rules=require('../round-rules.cjs');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const progress=()=>({exploration:{visited:[],stacks:0},infiltration:0,infiltrationRewards:0,bloodMoonGranted:false});
function fixture(n=3,round=1){
 const players=Array.from({length:n},(_,slot)=>{
  const assets=eco.makeInitial();
  return {id:'m8econ'+slot,token:'token-m8econ-'+slot,room:'M8ECON',name:'P'+slot,slot,ready:true,connected:true,roundReady:false,farmDone:false,assets,team:eco.ownTeam(assets),mastery:assets.level,progress:progress()};
 });
 const game={round,kind:rules.roundKind(round,rules.SPECIALS),phase:'prep',hp:Array(n).fill(100),schedule:[...rules.SPECIALS],pairs:[],version:1,endsAt:0,earlyEndsAt:null,seed:0,byeCounts:{},lastOpponents:{},previousByeSlot:null};
 const room={code:'M8ECON',maxPlayers:n,players:new Map(players.map(p=>[p.id,p])),messages:[],revision:0,started:true,game};
 rooms.set(room.code,room);
 return {room,players,game};
}
async function startPort(){
 for(let i=0;i<120&&!server.listening;i++)await sleep(25);
 assert(server.listening,'Server must start for API tests');
 return server.address().port;
}
async function api(port,token,endpoint,body){
 const r=await fetch(`http://127.0.0.1:${port}/api/${endpoint}`,{method:'POST',headers:{'content-type':'application/json','x-live-token':token},body:JSON.stringify(body||{})});
 return {status:r.status,payload:await r.json()};
}
(async()=>{
 const port=await startPort();
 try{
  for(const n of [2,3,4,5,6,7,8]){
   const {room,players,game}=fixture(n);
   assert.equal(room.players.size,n);
   for(const p of players){
    assert.equal(p.assets.credits,5);
    assert.equal(p.assets.owned.length,1);
    assert.equal(p.assets.shop.length,5);
    assert.equal(playerView(room,p).players.find(x=>x.slot===p.slot).assets.credits,5);
   }
   assert(!playerView(room,players[0]).players.find(x=>x.slot===players.at(-1).slot).assets,'Other users assets must be private');
   const buy=await api(port,players[0].token,'economy',{cmd:'buy',index:0});
   assert.equal(buy.status,200,JSON.stringify(buy.payload));
   assert.equal(players[0].assets.credits,5-eco.saleUnitValue({characterId:players[0].assets.owned[1]?.characterId||players[0].assets.owned[0].characterId,star:1})+(players[0].assets.owned[1]?0:0)) // match shop 1cost at L1
   const invalid=await api(port,players[0].token,'team',{team:[{ownedId:99999,characterId:'alex',star:3,x:1,y:1,items:['오토-암즈']}]});
   assert.equal(invalid.status,409,'Client may not forge combat equipment');
   assert(players[0].assets.credits>=0);
   rooms.delete(room.code);
  }
  let a=eco.makeInitial();
  a.credits=30;
  eco.action(a,'invest');assert.equal(a.credits,28);assert.equal(a.exp,2);
  const expenseBefore=a.credits;eco.action(a,'reroll');assert.equal(a.credits,expenseBefore-2);
  eco.giveItem(a,'검집');eco.giveItem(a,'금팔찌');
  eco.action(a,'craft',{index:0,otherIndex:1});
  assert(a.items.includes('블레이드 부츠'));
  const sellValue=eco.itemSellPrice('블레이드 부츠');assert.equal(sellValue,5);
  let prev=a.credits;eco.action(a,'sell-item',{index:0});assert.equal(a.credits,prev+sellValue);
  assert.equal(eco.itemSellPrice('검집'),2);
  eco.grant(a,{type:'credits',value:10},'round5:supply');
  const once=a.credits;
  assert.equal(eco.grant(a,{type:'credits',value:10},'round5:supply'),false);
  assert.equal(a.credits,once,'No duplicate reward');
  eco.grant(a,{type:'unit',value:'katja',star:2},'star2');
  assert(a.owned.some(x=>x.characterId==='katja'&&x.star===2));
  a.items=[];a.overflowItems=[];
  for(let i=0;i<13;i++)eco.giveItem(a,'검집');
  assert.equal(a.items.length,12);assert.equal(a.overflowItems.length,1);
  eco.action(a,'sell-item',{index:0});assert.equal(a.items.length,12);assert.equal(a.overflowItems.length,0);
  // Bye counts should differ by <=1, and consecutive byes are discouraged.
  for(const n of [3,5,7]){
   const players=Array.from({length:n},(_,slot)=>({slot})),hp=Array(n).fill(100);
   const history={byeCounts:{},previousByeSlot:null,lastOpponents:{}},seen=[];
   for(let i=0;i<150;i++){
    const {pairs,bye}=rules.pairSurvivors(players,hp,Math.random,history);
    assert(bye&&pairs.length===(n-1)/2);
    history.byeCounts[bye.slot]=(history.byeCounts[bye.slot]||0)+1;
    for(const [a,b] of pairs){history.lastOpponents[a.slot]=b.slot;history.lastOpponents[b.slot]=a.slot;}
    if(history.previousByeSlot===bye.slot)throw Error('Consecutive bye with other choices available');
    history.previousByeSlot=bye.slot;seen.push(bye.slot);
   }
   const counts=players.map(p=>history.byeCounts[p.slot]||0);
   assert(Math.max(...counts)-Math.min(...counts)<=1,'Bye fairness');
  }
  // Intro must complete before authoritative combat starts.
  const {room,players,game}=fixture(2);
  advanceRoom(room);
  assert.equal(game.phase,'intro','Start screen should gate combat');
  assert(!game.farmResults,'Farm simulation must not run behind the title');
  const a1=await api(port,players[0].token,'intro-complete',{round:1});
  assert.equal(a1.status,200);assert.equal(game.earlyEndsAt,null,'One client alone cannot start combat');
  const a2=await api(port,players[1].token,'intro-complete',{round:1});
  assert.equal(a2.status,200);
  assert(game.earlyEndsAt>0);
  game.endsAt=0;game.earlyEndsAt=null;
  advanceRoom(room);assert.equal(game.phase,'combat');
  assert(game.farmResults);
  const privatePvE=playerView(room,players[0]).game;
  assert.equal(privatePvE.seed,game.farmResults[0].seed,'Client PvE replay must use the server seed');
  assert(!('farmResults' in privatePvE),'Server PvE loot calculations are private');
  if(game.farmResults[0].time>0.5){
   const premature=await api(port,players[0].token,'farm-done',{round:1});
   assert.equal(premature.status,409,'Client must not finish farm before simulated combat ends');
  }
  const before=players[0].assets.items.length;
  game.endsAt=0;game.earlyEndsAt=null;advanceRoom(room);
  assert.equal(game.phase,'result');
  assert(players[0].assets.items.length>=before);
  game.endsAt=0;advanceRoom(room);assert.equal(game.round,2);
  assert.equal(players[0].assets.level,1);assert.equal(players[0].assets.exp,4);
  rooms.delete(room.code);
  console.log('M8-02 PASS: server wallet/unit/item shop, supply idempotency, inventory cap, ownership guard, 2–8 player authority, 3/5/7 fair byes, intro gate, farm payout');
 }finally{rooms.clear();server.closeAllConnections();server.close();setTimeout(()=>process.exit(process.exitCode||0),100);}
})().catch(e=>{console.error(e);rooms.clear();server.closeAllConnections();server.close();process.exitCode=1});
