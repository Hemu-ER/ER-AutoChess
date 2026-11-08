'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
process.env.PORT='0';process.env.LIVE_DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'live-m901-'));
const {server,rooms,advanceRoom,playerView}=require('../server.cjs');
const economy=require('../match-economy.cjs');
const aug=require('../match-augment.cjs');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function run(){
 for(let i=0;i<120&&!server.listening;i++)await wait(20);assert(server.listening,'서버 미실행');
 const base=`http://127.0.0.1:${server.address().port}`;
 const post=async(action,data={},token='',session='')=>{const r=await fetch(base+'/api/'+action,{method:'POST',headers:{'content-type':'application/json','x-live-token':token,'x-live-session':session},body:JSON.stringify(data)});return {status:r.status,body:await r.json()}};
 let checks=0;
 try{
  const sessions=[];for(let i=0;i<2;i++){const rr=await post('register',{username:'m901tester'+i,password:'passwordtest123',nickname:'시험참가'+i});assert.equal(rr.status,200);sessions.push(rr.body.session);checks++;}
  const host=await post('create',{maxPlayers:2},'',sessions[0]);assert.equal(host.status,200);checks++;
  const code=host.body.room.code;const second=await post('join',{code},'',sessions[1]);assert.equal(second.status,200);checks++;
  const [a,b]=[host.body,second.body];const r=rooms.get(code);
  for(const u of [a,b]){const res=await post('ready',{ready:true},u.token);assert.equal(res.status,200);checks++}
  for(const p of r.players.values())p.connected=true; // SSE 연결된 실제 클라이언트 상태 재현
  const started=await post('start',{},a.token);assert.equal(started.status,200);checks++;
  assert.equal(r.game.phase,'augment');assert.equal(r.game.round,1);checks+=2;
  const [ap,bp]=[...r.players.values()];const aview=playerView(r,ap).game.augment,bview=playerView(r,bp).game.augment;
  assert.equal(aview.tier,bview.tier);assert.equal(aview.offers.length,3);assert.equal(bview.offers.length,3);
  assert.equal(aview.offersBySlot,undefined,'다른 참가자 후보 비공개');checks+=4;
  const wrongPhase=await post('round-ready',{ready:true},a.token);assert.equal(wrongPhase.status,409);checks++;
  const invalid=await post('augment-pick',{round:1,choice:3},a.token);assert.equal(invalid.status,409);checks++;
  // M9-09: 서버는 선택된 카드 위치만 재수신해야 한다. 위치 누락은 잘못된 요청이다.
  assert.equal((await post('augment-reroll',{round:1},a.token)).status,409);checks++;
  const beforeOffers=playerView(r,ap).game.augment.offers.map(o=>o.id);
  const re=await post('augment-reroll',{round:1,choice:2},a.token);assert.equal(re.status,200);checks++;
  const afterOffers=playerView(r,ap).game.augment.offers.map(o=>o.id);
  assert.equal(afterOffers[0],beforeOffers[0]);assert.equal(afterOffers[1],beforeOffers[1]);assert.notEqual(afterOffers[2],beforeOffers[2]);checks+=3;
  const re2=await post('augment-reroll',{round:1,choice:2},a.token);assert.equal(re2.status,409);checks++;
  const picked=await Promise.all([post('augment-pick',{round:1,choice:0},a.token),post('augment-pick',{round:1,choice:2},b.token)]);
  assert(picked.every(v=>v.status===200));assert(r.game.earlyEndsAt>Date.now());checks+=2;
  const double=await post('augment-pick',{round:1,choice:1},a.token);assert.equal(double.status,409);checks++;
  r.game.earlyEndsAt=Date.now()-1;advanceRoom(r);assert.equal(r.game.phase,'augment-sync');checks++;assert.equal((await post('augment-assets-ready',{round:1},a.token)).status,200);assert.equal(r.game.phase,'augment-sync');assert.equal(r.game.earlyEndsAt,null,'마지막 참가자 다운로드 전에는 준비로 넘어가지 않음');advanceRoom(r);assert.equal(r.game.phase,'augment-sync');assert.equal((await post('augment-assets-ready',{round:1},b.token)).status,200);checks+=5;r.game.earlyEndsAt=Date.now()-1;advanceRoom(r);assert.equal(r.game.phase,'prep');assert(r.game.endsAt>Date.now()+59000);checks+=2;
  assert.equal(ap.augments.length,1);assert.equal(bp.augments.length,1);checks+=2;
  assert.equal((await post('augment-reroll',{round:1},a.token)).status,409);checks++;
  // R6: Only AFTER supply R5 is resolved and round advances, and before R6 prep begins.
  r.game.phase='result';r.game.round=5;r.game.kind='supply';r.game.endsAt=0;r.game.earlyEndsAt=null;
  advanceRoom(r);assert.equal(r.game.round,6);assert.equal(r.game.phase,'augment');checks+=2;
  const r6Views=[playerView(r,ap).game.augment,playerView(r,bp).game.augment];assert.equal(r6Views[0].tier,r6Views[1].tier);checks++;
  const six=await post('augment-pick',{round:6,choice:1},a.token);assert.equal(six.status,200);checks++;
  r.game.endsAt=0;r.game.earlyEndsAt=null;advanceRoom(r);assert.equal(r.game.phase,'augment-sync');checks++;assert.equal((await post('augment-assets-ready',{round:6},a.token)).status,200);assert.equal((await post('augment-assets-ready',{round:6},b.token)).status,200);checks+=2;r.game.earlyEndsAt=Date.now()-1;advanceRoom(r);assert.equal(r.game.phase,'prep');assert.equal(ap.augments.length,2);assert.equal(bp.augments.length,2);checks+=3;
  // R16: after the five special rounds and immediately before R16 prep.
  r.game.phase='result';r.game.round=15;r.game.kind='selection';r.game.endsAt=0;r.game.earlyEndsAt=null;
  advanceRoom(r);assert.equal(r.game.phase,'augment');assert.equal(r.game.round,16);checks+=2;
  r.game.endsAt=0;advanceRoom(r);assert.equal(r.game.phase,'augment-sync');checks++;assert.equal((await post('augment-assets-ready',{round:16},a.token)).status,200);assert.equal((await post('augment-assets-ready',{round:16},b.token)).status,200);checks+=2;r.game.earlyEndsAt=Date.now()-1;advanceRoom(r);assert.equal(r.game.phase,'prep');assert.equal(ap.augments.length,3);assert.equal(bp.augments.length,3);checks+=3;
  // Broad 2–8-player server transition tests, odd counts included.
  for(let count=2;count<=8;count++)for(let round of [1,6,16]){
   const players=Array.from({length:count},(_,slot)=>({slot,id:`p${round}_${count}_${slot}`,token:`t${round}_${count}_${slot}`,name:`P${slot}`,connected:true,roundReady:false,ready:true,assets:economy.makeInitial(),team:[],progress:{},augments:[]}));
   const game={round,kind:'pvp',phase:'augment',endsAt:0,earlyEndsAt:null,hp:players.map(()=>100),version:1,pairs:[],byeCounts:{},lastOpponents:{},augment:aug.open(players,round),schedule:['shop','boss','auction','experiment','selection']};
   const x={code:`Q${round}${count}`,maxPlayers:count,players:new Map(players.map(p=>[p.id,p])),messages:[],started:true,game};rooms.set(x.code,x);
   advanceRoom(x);assert.equal(game.phase,'augment-sync');assert.equal(players.filter(p=>p.augments.length===1).length,count);checks+=2;for(const p of players)game.augment.downloads[p.slot]=true;game.earlyEndsAt=Date.now()-1;advanceRoom(x);assert.equal(game.phase,'prep');checks++;rooms.delete(x.code);
  }
  console.log('M9-01 ONLINE API QA PASS:',checks,'checks · 2~8 players / R1 R6 R16 / auth, privacy, reroll, autoselect, prep reset');
 }finally{rooms.clear();server.closeAllConnections();server.close();}
 process.exit(0);
}
run().catch(err=>{console.error(err);process.exit(1)});
