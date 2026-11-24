'use strict';
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net');
const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'live-m1019-'));
const reserve=()=>new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>resolve(port));})});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function main(){
 const port=await reserve();const base=`http://127.0.0.1:${port}`;
 const child=spawn(process.execPath,['js/server/server.cjs'],{cwd:path.resolve(__dirname,'..'),env:{...process.env,PORT:String(port),LIVE_DATA_DIR:dataDir},stdio:['ignore','pipe','pipe']});
 let out='';for(const stream of [child.stdout,child.stderr])stream.on('data',x=>out+=x);
 const controllers=[];
 async function api(url,body={},token='',session=''){
  const result=await fetch(base+'/api/'+url,{method:'POST',headers:{'content-type':'application/json',...(token?{'x-live-token':token}:{}),...(session?{'x-live-session':session}:{})},body:JSON.stringify(body)});
  return {status:result.status,...await result.json()};
 }
 async function connect(token){const controller=new AbortController();controllers.push(controller);const response=await fetch(base+'/api/events?token='+encodeURIComponent(token),{signal:controller.signal});assert.equal(response.status,200);return response;}
 try{
  for(let i=0;i<60;i++){try{const r=await fetch(base+'/health');if(r.ok)break;}catch{}await sleep(100);if(i===59)throw Error('server startup timeout '+out);}
  const user=await api('register',{username:'bot_qa_host',password:'qa-password-123',nickname:'테스트방장'});assert.equal(user.status,200,JSON.stringify(user));
  const created=await api('create',{roomName:'AI 봇 검증',maxPlayers:4},'',user.session);assert.equal(created.status,200,JSON.stringify(created));
  const hostToken=created.token,roomId=created.room.roomId;
  const added=await api('bot-add',{},hostToken);assert.equal(added.status,200);
  let joined=await api('rejoin',{},'',user.session);assert.equal(joined.room.players.filter(p=>p.isBot).length,1);
  assert.equal(joined.room.players.filter(p=>p.isBot)[0].connected,true);
  assert.equal(joined.room.players.filter(p=>p.isBot)[0].ready,true);
  const botId=joined.room.players.find(p=>p.isBot).id;
  const removed=await api('bot-remove',{botId},hostToken);assert.equal(removed.status,200);
  assert.equal((await api('rejoin',{},'',user.session)).room.players.some(p=>p.isBot),false);
  assert.equal((await api('bot-add',{},hostToken)).status,200);
  assert.equal((await api('bot-add',{},hostToken)).status,200);
  assert.equal((await api('bot-add',{},hostToken)).status,200);
  assert.equal((await api('bot-add',{},hostToken)).status,409,'room capacity enforced');
  const sse=await connect(hostToken);
  assert.equal((await api('ready',{ready:true},hostToken)).status,200);
  const started=await api('start',{},hostToken);assert.equal(started.status,200,JSON.stringify(started));
  assert.equal((await api('bot-add',{},hostToken)).status,409,'cannot modify running match');
  assert.equal((await api('bot-remove',{botId},hostToken)).status,409,'cannot remove running bot');
  const server=require('../js/server/match-bots.cjs');
  let found=false;
  for(let i=0;i<70;i++){
   await sleep(220);
   const view=await api('rejoin',{},'',user.session);
   const bots=view.room.players.filter(p=>p.isBot);
   if(bots.length===3&&bots.every(p=>p.infusionIds.length>=1&&p.roundReady&&p.team.length>0)){found=true;break;}
  }
  assert.ok(found,'all bots select infusion and complete first preparation');
  assert.ok(!out.includes('bot tick:')&&!out.includes('Unhandled'),out);
  const host=await api('leave',{},hostToken);assert.equal(host.status,200);
  const sessionNext=await api('rejoin',{},'',user.session);assert.equal(sessionNext.status,404,'room removed after last human leaves');
  sse.body?.cancel?.().catch(()=>{});
  console.log('M10-19 BOT INTEGRATION PASS: lobby slots, rights, ready, 3 bots infusion/prep, cleanup');
 }finally{for(const c of controllers)c.abort();child.kill('SIGTERM');fs.rmSync(dataDir,{recursive:true,force:true});}
}
main().catch(e=>{console.error('M10-19 BOT INTEGRATION FAIL:',e);process.exitCode=1});
