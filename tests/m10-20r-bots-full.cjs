'use strict';
// Accelerated, real server handlers and 7 bots + one scripted human. Not browser/network E2E.
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'m1020r-full-'));
process.env.PORT='0';process.env.LIVE_DATA_DIR=temp;
const realNow=Date.now;let virtual=realNow();Date.now=()=>virtual;
const match=require('../js/server/server.cjs');const bots=require('../js/server/match-bots.cjs');
const nap=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 let client;let requests=0,rejected=0;
 try{
  for(let i=0;i<100&&!match.server.listening;i++)await nap(10);
  assert(match.server.listening);const base=`http://127.0.0.1:${match.server.address().port}`;
  const api=async(endpoint,body={},token='',session='')=>{
   const res=await fetch(base+'/api/'+endpoint,{method:'POST',headers:{'content-type':'application/json','x-live-token':token,'x-live-session':session},body:JSON.stringify(body)});return {ok:res.ok,status:res.status,data:await res.json()};
  };
  const user=await api('register',{username:'full_qa_host',password:'samplepassword',nickname:'전체 검증'});assert(user.ok);
  const created=await api('create',{maxPlayers:8},'',user.data.session);assert(created.ok);const token=created.data.token,room=match.rooms.get(created.data.room.roomId);
  client=new AbortController();assert((await fetch(base+'/api/events?token='+token,{signal:client.signal})).ok);
  for(let i=0;i<7;i++)assert((await api('bot-add',{},token)).ok);
  assert((await api('ready',{ready:true},token)).ok);assert((await api('start',{},token)).ok);
  const human=[...room.players.values()].find(p=>!p.isBot),seen=new Set(),checked=new Map();
  const send=async(p,endpoint,body)=>{requests++;const result=await api(endpoint,body,p.token);if(!result.ok)rejected++;return result};
  for(let step=0;step<1500&&room.game.phase!=='finished';step++){
   const g=room.game;seen.add(`${g.phase}:${g.kind}`);
   // Real bot code runs at its usual 650ms cadence on a virtual clock. Script the human using the same policy.
   const phase=`${g.round}:${g.phase}:${g.version}`;
   for(let i=0;i<16&&room.game.phase!=='finished'&&`${g.round}:${g.phase}:${g.version}`===phase;i++){
    virtual+=750;human.lastSeen=virtual;
    await bots.tick(room,send);const action=bots.nextAction(room,human);if(action)await send(human,...action);
   }
   for(const p of room.players.values()){
    assert(Number.isFinite(p.assets.credits)&&p.assets.credits>=0,'nonnegative credits');
    const last=p.assets.grayState?.lastPvp;if(last){const old=checked.get(p.id);if(old&&old!==last)assert(Number(last.split(':')[1])>Number(old.split(':')[1]),'monotonic settlement round');checked.set(p.id,last)}
   }
   assert(Object.values(g.hp).every(x=>Number.isFinite(x)&&x>=0),'finite match HP');
   if(g.phase==='finished')break;
   virtual=Math.max(virtual,g.endsAt+1);g.earlyEndsAt=null;human.lastSeen=virtual;
   if(g.missingTeamGraceStartedAt)virtual=Math.max(virtual,g.missingTeamGraceStartedAt+10001);
   match.advanceRoom(room);
  }
  assert.equal(room.game.phase,'finished','match terminates');assert(room.game.winnerSlot!=null,'winner assigned');
  for(const phase of ['combat:farm','combat:pvp','supply:supply','special:boss','special:selection','special:shop','special:auction'])assert(seen.has(phase),`visited ${phase}`);
  console.log(`M10-20R FULL BOT MATCH PASS: round ${room.game.round}, winner ${room.game.winnerSlot}, ${requests} requests, ${rejected} rejected; 8 participants, accelerated server time`);
 }finally{Date.now=realNow;client?.abort();match.server.closeAllConnections?.();await new Promise(r=>match.server.close(r));fs.rmSync(temp,{recursive:true,force:true});}
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
