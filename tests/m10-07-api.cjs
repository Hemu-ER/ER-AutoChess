'use strict';
// Full authenticated HTTP route regression for user-selected auction rewards.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
process.env.PORT='0';process.env.LIVE_DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'live-m1007-'));
const {server,rooms,playerView}=require('../server.cjs');
const econ=require('../match-economy.cjs');
async function main(){
 for(let i=0;i<100&&!server.listening;i++)await new Promise(r=>setTimeout(r,20));
 assert.ok(server.listening);
 const url=`http://127.0.0.1:${server.address().port}`,post=async(path,data={},token='',session='')=>{const r=await fetch(url+'/api/'+path,{method:'POST',headers:{'content-type':'application/json','x-live-token':token,'x-live-session':session},body:JSON.stringify(data)});return [r.status,await r.json()]};
 let n=0;const check=(condition,message)=>{assert.ok(condition,message);n++};
 try{
  const registration=await Promise.all([0,1].map(i=>post('register',{username:'m1007test'+i,password:'passwordtest123',nickname:'M10 테스트 '+i})));check(registration.every(x=>x[0]===200),'register');
  const roomResult=await post('create',{maxPlayers:2},'',registration[0][1].session);check(roomResult[0]===200,'create');
  const host=roomResult[1],join=await post('join',{code:host.room.code},'',registration[1][1].session);check(join[0]===200,'join');
  const r=rooms.get(host.room.code),first=[...r.players.values()][0],second=[...r.players.values()][1];
  r.started=true;first.assets=econ.makeInitial();second.assets=econ.makeInitial();r.game={round:11,phase:'special',hp:[100,100],version:3,specialType:'auction'};
  first.assets.auctionChoices=[{id:'r11-lot0',cost:2,star:1}];
  check(playerView(r,first).players.find(p=>p.id===first.id).assets.auctionChoices.length===1,'choice visible only to owner');
  check(!playerView(r,second).players.find(p=>p.id===first.id).assets,'opponent cannot see asset choices');
  const oldStock=JSON.stringify(first.assets.shop||[]),unit2=require('../roster.js').roster.find(c=>c.cost===2&&!c.pveOnly);check(!!unit2,'valid 2 cost');
  const bad=await post('auction-unit-choice',{choiceId:'r11-lot0',characterId:'aiden'},host.token);check(bad[0]===409,'invalid cost blocked');
  const unauthorized=await post('auction-unit-choice',{choiceId:'r11-lot0',characterId:unit2.id},join[1].token);check(unauthorized[0]===409,'other player cannot claim');
  const accepted=await post('auction-unit-choice',{choiceId:'r11-lot0',characterId:unit2.id},host.token);check(accepted[0]===200&&accepted[1].characterId===unit2.id,'owner claim accepted');
  check(!first.assets.auctionChoices.length,'choice removed');check(JSON.stringify(first.assets.shop||[])===oldStock,'shop unchanged');
  check(first.assets.owned.some(o=>o.characterId===unit2.id&&o.star===1)||first.assets.pendingUnits.some(o=>o.characterId===unit2.id&&o.star===1),'unit granted');
  const duplicate=await post('auction-unit-choice',{choiceId:'r11-lot0',characterId:unit2.id},host.token);check(duplicate[0]===409,'duplicate refused');
  console.log('M10-07 ONLINE HTTP QA PASS',n,'authenticated checks');
 }finally{rooms.clear();server.closeAllConnections();server.close()}
 process.exit(0);
}
main().catch(e=>{console.error(e);process.exitCode=1;server.close()});
