'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const os=require('node:os');
const {SPECIALS,createSchedule,roundKind,pairSurvivors,draftOrder,selectionCandidates}=require('../round-rules.cjs');
// M9-01: five midgame slots = four unique specials + one ordinary duel, never a minigame.
const appeared=new Set();
for(let i=0;i<1000;i++){
 const schedule=createSchedule();assert.equal(schedule.length,5);
 assert.deepEqual([...schedule].sort(),[...SPECIALS,'pvp'].sort());
 assert(!schedule.includes('experiment'));
 const expected=['farm','pvp','farm','pvp','supply','pvp'];
 assert.deepEqual(Array.from({length:6},(_,j)=>roundKind(j+1,schedule)),expected);
 for(let j=7;j<=15;j++){
  const kind=roundKind(j,schedule);
  assert.equal(kind,j===10?'farm':j%2===0?'pvp':schedule[(j-7)/2]);
  assert.notEqual(kind,'experiment');
  if(j%2===1&&kind==='pvp')appeared.add(j);
 }
 for(let j=16;j<=60;j++)assert.equal(roundKind(j,schedule),'pvp');
}
assert.deepEqual([...appeared].sort((a,b)=>a-b),[7,9,11,13,15]);
assert.equal(roundKind(7,['experiment','boss','shop','auction','selection']),'pvp','legacy schedules cannot start a minigame');
for(let n=2;n<=8;n++){const players=Array.from({length:n},(_,slot)=>({slot})),hp=players.map(()=>100);const {pairs,bye}=pairSurvivors(players,hp);assert.equal(pairs.length,Math.floor(n/2));assert.equal(Number(Boolean(bye)),n%2);assert.equal(new Set([...pairs.flat(),...(bye?[bye]:[])].map(x=>x.slot)).size,n);assert.equal(selectionCandidates(n),n+2)}
assert.deepEqual(draftOrder([{slot:0},{slot:1},{slot:2}],[30,10,20]),[1,2,0]);
process.env.PORT='0';process.env.LIVE_DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'live-m8-01-'));
const {server,rooms,advanceRoom,playerView}=require('../server.cjs');
function makeRoom(n,round=8){const players=Array.from({length:n},(_,slot)=>({id:'p'+slot,slot,name:'P'+slot,connected:true,team:[{characterId:'alex',x:1,y:1,star:1,items:[]}],mastery:1,progress:{exploration:{visited:[],stacks:0},infiltration:0,infiltrationRewards:0,bloodMoonGranted:false},roundReady:false,farmDone:false}));return {code:'M8TEST',started:true,players:new Map(players.map(p=>[p.id,p])),messages:[],revision:0,game:{round,phase:'prep',schedule:createSchedule(),hp:Array(n).fill(100),version:1,endsAt:Date.now()-1}}}
for(let n=2;n<=8;n++){
 const room=makeRoom(n);rooms.set(room.code,room);advanceRoom(room);const g=room.game;assert.equal(g.phase,'combat','PvP 2-8 player combat');assert.equal(g.pairs.length,Math.floor(n/2),'each participant paired at most once');assert.equal(g.byeSlot===undefined||g.byeSlot===null,n%2===0);
 for(const p of room.players.values()){const snap=playerView(room,p);assert.equal(snap.game.pairs,undefined,'no other player pair info leaked');assert.equal(snap.game.bye,n%2===1&&p.slot===g.byeSlot);if(!snap.game.bye)assert(Number.isInteger(snap.game.opponentSlot));}
 const before=[...g.hp];g.endsAt=Date.now()-1;advanceRoom(room);assert.equal(g.phase,'result');for(const [i,h] of g.hp.entries())assert(h<=before[i]);if(g.byeSlot!==null&&g.byeSlot!==undefined)assert.equal(g.hp[g.byeSlot],100,'bye health must be unchanged');
 rooms.delete(room.code);
}
// The former minigame slot must enter normal combat for odd party sizes, with no bot.
const converted=makeRoom(7,7);converted.game.schedule=['pvp','boss','shop','auction','selection'];rooms.set(converted.code,converted);
advanceRoom(converted);assert.equal(converted.game.phase,'combat');assert.equal(converted.game.kind,'pvp');assert.equal(converted.game.pairs.length,3);assert(Number.isInteger(converted.game.byeSlot));
converted.game.pairs=[{a:0,b:1,battle:{outcome:'A팀 승리',personaTierA:0,personaTierB:0}}];converted.game.endsAt=0;
advanceRoom(converted);assert.equal(converted.game.phase,'result');assert.equal(converted.game.hp[1],88,'R7 duel does not use the late-game fallback HP damage');
rooms.delete(converted.code);
// Check that every possible replacement round works for 2–8 real participants.
for(const oddRound of [7,9,11,13,15])for(let n=2;n<=8;n++){
 const r=makeRoom(n,oddRound);const schedule=['shop','boss','auction','selection','pvp'];
 [schedule[4],schedule[(oddRound-7)/2]]=[schedule[(oddRound-7)/2],schedule[4]];
 r.game.schedule=schedule;r.code='ODD'+oddRound+'N'+n;rooms.set(r.code,r);
 advanceRoom(r);
 assert.equal(r.game.phase,'combat','converted special must be a normal PvP combat');
 assert.equal(r.game.pve,false);assert.equal(r.game.experiment,undefined);
 assert.equal(r.game.pairs.length,Math.floor(n/2));
 assert.equal(Number.isInteger(r.game.byeSlot),n%2===1,'no bot / correct bye count');
 r.game.endsAt=0;advanceRoom(r);assert.equal(r.game.phase,'result');
 rooms.delete(r.code);
}
// M4 privacy fix: one player's supplies must not appear in another player's snapshot.
const priv=makeRoom(3,5);priv.game.supplyOptions={0:[{type:'credits',value:7}],1:[{type:'credits',value:10}],2:[{type:'credits',value:9}]};priv.game.supplyResolved={0:{type:'credits',value:7}};const v=playerView(priv,[...priv.players.values()][1]);assert.deepEqual(Object.keys(v.game.supplyOptions),['1']);assert.deepEqual(Object.keys(v.game.supplyResolved),['1']);
const multiplayer=fs.readFileSync(path.join(__dirname,'../multiplayer.js'),'utf8');for(const bit of ['id="liveMaxPlayers"','makeMovable(dock)'])assert(multiplayer.includes(bit),'Chat/multi UI missing '+bit);
rooms.clear();server.close(()=>{console.log('M9-01 MIDGAME PASS: no minigame ×1000, 2–8 pairs, odd-player duel, HP curve, private supply choices');process.exit(0)});
