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
  const human=[...room.players.values()].find(p=>!p.isBot),a=human.assets;
  a.credits=20;a.shop[0]='aiden';const vacant=[0,1,2].flatMap(x=>[0,1,2].map(y=>({x,y}))).find(pos=>!a.owned.some(o=>o.location==='board'&&o.x===pos.x&&o.y===pos.y));
  const cmd={cmd:'buy-board',index:0,characterId:'aiden',...vacant};
  const result=await api('economy',cmd,token);assert.equal(result.status,200,JSON.stringify(result));
  assert.equal(a.credits,19);assert.equal(a.shop[0],null);assert.ok(human.team.some(o=>o.characterId==='aiden'&&o.x===vacant.x&&o.y===vacant.y));
  const snapshot=structuredClone(a);assert.equal((await api('economy',cmd,token)).status,409);assert.deepEqual(a,snapshot);
  room.game.phase='combat';assert.equal((await api('economy',{...cmd,index:1},token)).status,409);assert.deepEqual(a,snapshot);
  console.log('M11-03 BUY BOARD API PASS: real HTTP purchase, team sync, duplicate rejection and combat lock');
 }finally{client?.abort();await new Promise(resolve=>match.server.close(resolve));fs.rmSync(temp,{recursive:true,force:true});}
}
run().then(()=>process.exit(0)).catch(error=>{console.error(error);match.server.close();process.exit(1);});
