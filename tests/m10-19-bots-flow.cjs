'use strict';
// Accelerated server-stage smoke: shortens timers only inside the test process.
// This does NOT establish real-time E2E, network resilience, or browser behavior.
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'m1019-flow-'));
process.env.PORT='0';process.env.LIVE_DATA_DIR=temp;
const match=require('../js/server/server.cjs');
const bots=require('../js/server/match-bots.cjs');
const nap=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function run(){
 let client;
 try{
  for(let i=0;i<100&&!match.server.listening;i++)await nap(20);
  assert.ok(match.server.listening,'server listening');
  const base=`http://127.0.0.1:${match.server.address().port}`;
  const api=async(endpoint,body={},token='',session='')=>{
   const res=await fetch(base+'/api/'+endpoint,{method:'POST',headers:{'content-type':'application/json','x-live-token':token,'x-live-session':session},body:JSON.stringify(body)});
   return {ok:res.ok,status:res.status,data:await res.json()};
  };
  const account=await api('register',{username:'flow_test',password:'samplepassword',nickname:'흐름검증'});
  assert.equal(account.status,200);
  const created=await api('create',{maxPlayers:3},'',account.data.session);assert.equal(created.status,200);
  const token=created.data.token,room=match.rooms.get(created.data.room.roomId);
  const abort=new AbortController();client=abort;
  const response=await fetch(base+'/api/events?token='+token,{signal:abort.signal});assert.equal(response.status,200);
  assert.equal((await api('bot-add',{},token)).status,200);
  assert.equal((await api('bot-add',{},token)).status,200);
  assert.equal((await api('ready',{ready:true},token)).status,200);
  assert.equal((await api('start',{},token)).status,200);
  const seen=new Set();let botChoices=0;
  for(let step=0;step<240&&room.game.round<8&&room.game.phase!=='finished';step++){
   const g=room.game;seen.add(`${g.round}:${g.phase}:${g.kind}`);
   // Execute the real bot policy via the same HTTP endpoint the human uses.
   for(let i=0;i<5;i++){
    await bots.tick(room,async(bot,endpoint,body)=>api(endpoint,body,bot.token));
    await nap(5);
   }
   botChoices=Math.max(botChoices,...[...room.players.values()].filter(x=>x.isBot).map(x=>x.augments?.length||0));
   // Skip server-owned clocks, without changing any economic/round code paths.
   g.endsAt=Date.now()-1;g.earlyEndsAt=null;
   match.advanceRoom(room);
  }
  assert.ok(room.game.round>=7||room.game.phase==='finished','advanced through rounds');
  assert.ok(seen.has('1:prep:farm')&&seen.has('1:combat:farm'),'R1 farm visited');
  assert.ok([...seen].some(x=>x.includes(':combat:pvp')),'PvP combat visited');
  assert.ok([...seen].some(x=>x.includes(':supply:supply')),'supply phase visited');
  assert.ok(botChoices>=1,'bot selected a real infusion');
  console.log('M10-19 BOT FLOW PASS: real API bot policy + accelerated farm/PvP/supply stages');
 }finally{client?.abort();await new Promise(resolve=>match.server.close(resolve));fs.rmSync(temp,{recursive:true,force:true});}
}
run().then(()=>process.exit(0)).catch(error=>{console.error('M10-19 BOT FLOW FAIL:',error);match.server.close();process.exit(1);});
