'use strict';
const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const os=require('node:os');const path=require('node:path');
const {makeCandidates}=require('../selection.cjs');
for(let n=2;n<=8;n++)for(const round of [7,9,11,13,15])for(let i=0;i<30;i++){
 const offers=makeCandidates(round,n);assert.equal(offers.length,n+2);assert.equal(new Set(offers.map(x=>x.characterId)).size,n+2);assert(offers.every(x=>x.star===1&&x.item));assert.equal(offers.filter(x=>x.itemTier==='complete').length,round>=15?Math.round((n+2)/2):round>=11?Math.round((n+2)*.25):0);
}
process.env.PORT='0';process.env.LIVE_DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'live-m8-selection-'));
const {server,rooms,advanceRoom,playerView}=require('../server.cjs');
async function ready(){if(server.listening)return;await new Promise(r=>server.once('listening',r))}
const progress=()=>({exploration:{visited:[],stacks:0},infiltration:0,infiltrationRewards:0,bloodMoonGranted:false});
const roster=require('../roster.js');const items=require('../items.js');
async function run(){
 await ready();const port=server.address().port;
 for(const n of [2,3,7,8]){
  const players=Array.from({length:n},(_,slot)=>({id:'P'+slot,token:'token'+slot,room:'SELECT',name:'P'+slot,slot,connected:true,team:[{characterId:'alex',star:1,x:0,y:0}],progress:progress(),roundReady:false}));
  const room={code:'SELECT',started:true,players:new Map(players.map(p=>[p.id,p])),messages:[],revision:1,game:{round:15,phase:'prep',schedule:['selection','boss','auction','shop','experiment'],endsAt:Date.now()-1,hp:players.map((_,i)=>90-i*5),version:1}};
  room.game.round=7;rooms.set(room.code,room);advanceRoom(room);const g=room.game;assert.equal(g.phase,'special');assert.equal(g.specialType,'selection');
  assert.equal(g.selection.candidates.length,n+2);
  const first=g.selection.order[0],outsider=g.selection.order.at(-1);
  const request=async(slot,choice)=>{const response=await fetch('http://127.0.0.1:'+port+'/api/selection-pick',{method:'POST',headers:{'content-type':'application/json','x-live-token':'token'+slot},body:JSON.stringify({choice})});return {status:response.status,data:await response.json()}};
  if(n>2){const wrong=await request(outsider,0);assert.equal(wrong.status,409,'cannot pick before turn')}
  assert.equal((await request(first,0)).status,200);
  assert.equal((await request(first,1)).status,409,'no duplicate player reward');
  const second=g.selection.order[1];assert.equal((await request(second,0)).status,409,'no duplicate candidate award');
  assert.equal((await request(second,1)).status,200);
  let guard=0;while(g.phase==='special'&&guard++<10){g.endsAt=Date.now()-1;advanceRoom(room)}
  assert.equal(g.phase,'result');assert.equal(Object.keys(g.selection.resolved).length,n);
  assert.equal(new Set(g.selection.candidates.filter(c=>c.claimedBy!==null).map(c=>c.claimedBy)).size,n);
  for(const p of players){const view=playerView(room,p);assert.equal(Object.values(view.game.selection.resolved).filter(Boolean).length,1,'never leak others rewards');const own=view.game.selection.resolved[p.slot];assert(roster.byId[own.characterId]);assert(items.all[own.item]);}
  rooms.delete('SELECT');
 }
 // Private 2-player bomb chat: other teams and bye must never receive messages.
 {
 const players=Array.from({length:5},(_,slot)=>({id:'Q'+slot,token:'bomb'+slot,room:'BOMB',name:'Q'+slot,slot,connected:true,team:[],progress:progress()}));
 const bombRoom={code:'BOMB',started:true,players:new Map(players.map(p=>[p.id,p])),messages:[],revision:1,game:{round:7,kind:'experiment',phase:'special',specialType:'experiment',experimentId:'bomb',hp:Array(5).fill(100),endsAt:Date.now()+60000,version:1,bombTeams:[{id:'T1',slots:[0,1],messages:[]},{id:'T2',slots:[2,3],messages:[]}],bombBye:4}};
 rooms.set(bombRoom.code,bombRoom);
 const r=await fetch('http://127.0.0.1:'+port+'/api/team-chat',{method:'POST',headers:{'content-type':'application/json','x-live-token':'bomb0'},body:JSON.stringify({text:'전선은 Ψ야'})});assert.equal(r.status,200);
 assert.equal(playerView(bombRoom,players[0]).game.teamMessages.length,1);
 assert.equal(playerView(bombRoom,players[1]).game.teamMessages.length,1);
 assert.equal(playerView(bombRoom,players[2]).game.teamMessages.length,0);
 assert.equal(playerView(bombRoom,players[4]).game.teamMessages.length,0);
 const spectator=await fetch('http://127.0.0.1:'+port+'/api/team-chat',{method:'POST',headers:{'content-type':'application/json','x-live-token':'bomb4'},body:JSON.stringify({text:'승객 간섭'})});assert.equal(spectator.status,403);
 rooms.delete('BOMB');
 }
 // QA LAB executes with synthetic DOM to verify actual action handlers, not only source text.
 const elements=new Map();function element(id){if(!elements.has(id))elements.set(id,{id,innerHTML:'',textContent:'',value:'',addEventListener(){},querySelectorAll(){return []}});return elements.get(id)}
 const dummy={getElementById:element,addEventListener(){},querySelectorAll(){return []},activeElement:{tagName:'BODY'}};
 const sandbox={window:{},document:dummy,Date,Math,console,setInterval(){return 1},ERRoster:roster,LIVEItems:items};vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(__dirname,'../qa.js'),'utf8'),sandbox);
 const lab=sandbox.window.LIVEQA;
 lab.select('stack');lab.act('contract','safe');lab.act('drop');assert.equal(lab.snapshot().game.players.A.contract,'safe');assert.equal(lab.snapshot().game.deadline>0,true);
 lab.select('bomb');const bomb=lab.snapshot().game;assert.equal(bomb.modules.length,2);assert.equal(bomb.deadline>0,true);
 lab.act('view','',bomb.operator);const wrong=bomb.modules[0].glyphs.findIndex(x=>x!==bomb.modules[0].answer[0]);lab.act('defuse',String(wrong));assert(lab.snapshot().game.finished,'one bomb mistake ends game');
 lab.select('quiz');assert.equal(lab.snapshot().game.players.A.questions.length,5);
 rooms.clear();server.close(()=>{console.log('M8 SELECTION + QA PASS: 2–8 choice rights, no duplicates, no private reward leaks, timed v3.0 minigame actions');process.exit(0)});
}
run().catch(err=>{console.error(err);rooms.clear();server.close(()=>process.exit(1));process.exitCode=1});
