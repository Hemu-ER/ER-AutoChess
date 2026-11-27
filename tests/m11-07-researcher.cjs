'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'live-researcher-'));process.env.LIVE_DATA_DIR=dir;process.env.PORT='0';delete process.env.UPSTASH_REDIS_REST_URL;delete process.env.UPSTASH_REDIS_REST_TOKEN;
const salt='a1b2c3';const hash=crypto.scryptSync('samplepassword',salt,64).toString('hex');const accountFile=path.join(dir,'.live-users.json');fs.writeFileSync(accountFile,JSON.stringify({legacy_user:{salt,hash,nickname:'기존 연구원'}}));
const match=require('../js/server/server.cjs');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function run(){const streams=[];try{
 for(let i=0;i<100&&!match.server.listening;i++)await sleep(20);assert.ok(match.server.listening);
 const base='http://127.0.0.1:'+match.server.address().port;
 async function api(endpoint,body={},session='',token=''){const r=await fetch(base+'/api/'+endpoint,{method:'POST',headers:{'content-type':'application/json','x-live-session':session,'x-live-token':token},body:JSON.stringify(body)});return {status:r.status,...await r.json()};}
 const login=await api('login',{username:'legacy_user',password:'samplepassword'});assert.equal(login.status,200);assert.equal(login.profile.finish,'cyan');assert.equal(login.profile.initialized,false);const session=login.session;
 assert.equal((await api('profile-finish',{finish:'gold'})).status,401);assert.equal((await api('profile-finish',{finish:'forged'},session)).status,400);
 assert.equal((await api('profile-finish',{finish:'gold',migrate:true},session)).profile.finish,'gold');assert.equal((await api('profile-finish',{finish:'violet',migrate:true},session)).profile.finish,'gold');
 const login2=await api('login',{username:'legacy_user',password:'samplepassword'});assert.equal(login2.profile.finish,'gold');
 const disk=JSON.parse(fs.readFileSync(accountFile));assert.equal(disk.legacy_user.hash,hash);assert.equal(disk.legacy_user.salt,salt);assert.equal(disk.legacy_user.researcher.finish,'gold');
 const b=await api('register',{username:'other_user',password:'samplepassword',nickname:'다른 연구원'});assert.equal(b.status,200);assert.equal(b.profile.matches,0);
 const created=await api('create',{maxPlayers:2,roomName:'연구실 테스트',isPublic:false,password:'1234'},session);assert.equal(created.status,200);assert.equal(created.room.displayName,'연구실 테스트');assert.equal(created.room.players[0].researcherFinish,'gold');
 const joined=await api('join',{roomId:created.room.roomId,password:'1234'},b.session);assert.equal(joined.status,200);assert.equal(joined.room.players.find(p=>p.id===created.playerId).researcherFinish,'gold');assert.equal(joined.room.players.find(p=>p.id===created.playerId).username,undefined);
 for(const info of [created,joined]){const abort=new AbortController();streams.push(abort);const res=await fetch(base+'/api/events?token='+info.token,{signal:abort.signal});assert.equal(res.status,200);}
 assert.equal((await api('ready',{ready:true},session,created.token)).status,200);assert.equal((await api('ready',{ready:true},b.session,joined.token)).status,200);assert.equal((await api('start',{},session,created.token)).status,200);
 const room=match.rooms.get(created.room.roomId);const other=room.players.get(joined.playerId);room.game.hp[other.slot]=0;for(let i=0;i<30&&room.game.phase!=='finished';i++)await sleep(50);assert.equal(room.game.phase,'finished');await sleep(300);
 const first=(await api('profile',{},session)).profile,second=(await api('profile',{},b.session)).profile;assert.equal(first.matches,1);assert.equal(first.wins,1);assert.equal(second.matches,1);assert.equal(second.wins,0);assert.equal(second.recent[0].outcome,'loss');
 await api('leave',{},b.session,joined.token);assert.equal((await api('profile',{},session)).profile.matches,1);const saved=JSON.parse(fs.readFileSync(accountFile));assert.equal(Object.keys(saved.legacy_user.researcher.history).length,1);assert.equal(Object.keys(saved.other_user.researcher.history).length,1);
 console.log('M11-07 RESEARCHER PASS: legacy account, auth/validation, finish migration, cross-session persistence, private lobby public finish, completed result, duplicate prevention');
 }finally{for(const a of streams)a.abort();await new Promise(r=>match.server.close(r));fs.rmSync(dir,{recursive:true,force:true});}}
run().then(()=>process.exit(0)).catch(e=>{console.error(e);match.server.close();process.exit(1)});
