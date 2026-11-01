'use strict';
const assert=require('node:assert/strict'),os=require('node:os'),fs=require('node:fs'),path=require('node:path');
process.env.PORT='0';process.env.LIVE_DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'m806-'));
const ex=require('../match-experiment.cjs'),eco=require('../match-economy.cjs'),{create}=require('../minigame-core.js'),items=require('../items.js'),roster=require('../roster.js');
const {server,rooms,advanceRoom,playerView}=require('../server.cjs');
const counts={};
function room(n,kind){const players=Array.from({length:n},(_,slot)=>({id:'p'+slot,token:'t'+slot,room:'TEST',slot,name:'P'+slot,connected:true,team:[],assets:eco.makeInitial(),progress:{}}));const g={round:7,kind:'experiment',phase:'special',specialType:'experiment',experimentId:kind,hp:players.map(()=>100),version:1,endsAt:0,experiment:ex.open(players,kind,1000)};return {code:'TEST',maxPlayers:n,players:new Map(players.map(p=>[p.id,p])),messages:[],revision:1,started:true,game:g}}
(async()=>{try{
 for(let n=2;n<=8;n++)for(const kind of ex.KINDS){const r=room(n,kind),enc=r.game.experiment;counts[kind]=(counts[kind]||0)+1;
  assert.equal(enc.groups.flatMap(g=>g.slots.filter(x=>x!==null)).length,n);assert.equal(new Set(enc.groups.flatMap(g=>g.slots.filter(x=>x!==null))).size,n);
  const pv=playerView(r,[...r.players.values()][0]).game.experiment;assert(pv.html);assert(!('groups'in pv));assert(!('seed'in pv));assert(!('answer'in pv));
  if(kind==='bomb'){const gr=enc.groups[0],g=gr.engine.snapshot().game;const expert=gr.slots[g.expert==='A'?0:1],operator=gr.slots[g.operator==='A'?0:1];assert(!ex.view(enc,expert).html.includes('SERIAL '+g.serial));assert(!ex.view(enc,operator).html.includes('홀수일 때 우선순위'));
   const wrong=g.modules[0].glyphs.findIndex(x=>x!==g.modules[0].answer[0]);ex.action(enc,operator,{seq:1,action:'defuse',value:wrong},1100);assert(g.finished);assert.equal(g.rewards.A.credits,0);
  }
  for(let t=2000;t<=100000;t+=1000)ex.tick(enc,t);
  assert(enc.groups.every(g=>g.bye||g.engine.snapshot().game.finished));assert(ex.settle(r));const saved=JSON.stringify([...r.players.values()].map(p=>p.assets));assert.equal(ex.settle(r),false);assert.equal(JSON.stringify([...r.players.values()].map(p=>p.assets)),saved);
 }
 // Replay identical seeds + actions; actual QA core is the same factory as the online engine.
 for(const kind of ex.KINDS){let now=0;const cfg={kind,seed:123,items,roster,clock:{now:()=>now}};const a=create(cfg),b=create(cfg);for(let i=0;i<40;i++){now=i*1000;for(const e of [a,b]){e.tick();e.auto('A');e.auto('B')}}assert.deepEqual(a.snapshot().game.rewards,b.snapshot().game.rewards);}
 {const r=room(2,'stack'),enc=r.game.experiment,s=enc.groups[0].slots[0];ex.action(enc,s,{seq:1,action:'contract',value:'safe'},1100);assert.throws(()=>ex.action(enc,s,{seq:1,action:'drop'},1200));assert.throws(()=>ex.action(enc,s,{seq:2,action:'view',value:'B'},1300));ex.disconnect(enc,s);assert(enc.groups[0].engine.snapshot().game.players.A.done);}
 {const r=room(3,'divide'),enc=r.game.experiment;const gr=enc.groups.find(g=>g.slots[1]===null);assert(gr.bye);assert.equal(gr.engine,null);assert.equal(gr.reward.credits,4);assert.equal(gr.reward.exp,4);assert.equal(gr.reward.items.length,1);assert(ex.view(enc,gr.slots[0]).bye);assert.throws(()=>ex.action(enc,gr.slots[0],{seq:1,action:'accept'},2000),/부전승/);}
 // Exercise real HTTP auth, round guard, private view, stale intent and round settlement.
 await new Promise(resolve=>server.listening?resolve():server.once('listening',resolve));const r=room(2,'quiz');r.game.experiment=ex.open([...r.players.values()],'quiz');rooms.set(r.code,r);const port=server.address().port;
 const post=async(body,token='t0')=>fetch('http://127.0.0.1:'+port+'/api/experiment',{method:'POST',headers:{'content-type':'application/json','x-live-token':token},body:JSON.stringify(body)});
 assert.equal((await post({round:6,seq:1,action:'quizAnswer',answer:'x'})).status,409);
 assert.equal((await post({round:7,seq:1,action:'quizAnswer',answer:'x'},'fake')).status,401);
 assert.equal((await post({round:7,seq:1,action:'quizAnswer',answer:'x'})).status,200);
 assert.equal((await post({round:7,seq:1,action:'quizAnswer',answer:'x'})).status,409);
 for(const gr of r.game.experiment.groups)gr.engine.snapshot().game.deadline=0;r.game.endsAt=0;advanceRoom(r);assert.equal(r.game.phase,'result');assert(r.game.experiment.settled);assert([...r.players.values()].every(p=>p.assets.exp>0||p.assets.level>1));
 // Explicit leave closes the corresponding cooperative group without touching other groups.
 const leaving=room(4,'bomb');leaving.game.experiment=ex.open([...leaving.players.values()],'bomb');rooms.set(leaving.code,leaving);const leavingGroup=leaving.game.experiment.groups.find(g=>g.slots.includes(0));
 assert.equal((await fetch('http://127.0.0.1:'+port+'/api/leave',{method:'POST',headers:{'content-type':'application/json','x-live-token':'t0'},body:'{}'})).status,200);
 assert(leavingGroup.engine.snapshot().game.finished);assert.equal(leavingGroup.engine.snapshot().game.rewards.A.credits,0);assert(!leaving.game.experiment.groups.find(g=>g!==leavingGroup).engine.snapshot().game.finished);
 rooms.clear();console.log('M8-06 PASS:',counts,'2–8 participants, bot-free byes, deadlines, hidden roles, mistakes, deterministic QA, HTTP guards, real EXP/assets, idempotent settlement');
 }catch(e){console.error(e);process.exitCode=1}finally{rooms.clear();server.close(()=>process.exit(process.exitCode||0))}})();
