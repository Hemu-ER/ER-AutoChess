'use strict';
// M4 network foundation: single-process, memory-only authoritative rooms.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {CombatEngine}=require('./combat-engine.js');
const root = __dirname;
const PORT = Number(process.env.PORT || 3000);
const rooms = new Map();
const clients = new Map();
const DATA_DIR = process.env.LIVE_DATA_DIR || root;
fs.mkdirSync(DATA_DIR, {recursive:true});
const accountFile = path.join(DATA_DIR, '.live-users.json');
let accounts = {};
try { accounts = JSON.parse(fs.readFileSync(accountFile, 'utf8')); } catch {}
const sessions = new Map();
const saveAccounts = () => { fs.writeFileSync(accountFile, JSON.stringify(accounts, null, 2), {mode:0o600}); };
const passwordHash = (password, salt) => crypto.scryptSync(password, salt, 64).toString('hex');
const authAccount = (req, body) => sessions.get(String(req.headers['x-live-session'] || body?.session || ''));

const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.cjs':'text/plain; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ttf':'font/ttf','.woff2':'font/woff2','.json':'application/json'};
const reply=(res,status,obj)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(obj));};
const id=()=>crypto.randomBytes(18).toString('hex');
const cleanName=v=>String(v||'').trim().normalize('NFC');
const validNickname=v=>{const n=cleanName(v);return n.length>=2&&n.length<=16&&!/[\x00-\x1f\x7f<>]/.test(n)?n:null};
const nickOf=username=>accounts[username]?.nickname||username;
const publicRoom=r=>({code:r.code,maxPlayers:r.maxPlayers,revision:r.revision,players:[...r.players.values()].map(p=>({id:p.id,name:p.name,slot:p.slot,ready:p.ready,roundReady:!!p.roundReady,farmDone:!!p.farmDone,connected:p.connected,team:p.team})),messages:r.messages.slice(-60),started:!!r.started,game:r.game?{...r.game,remaining:Math.max(0,Math.ceil(((r.game.earlyEndsAt&&r.game.earlyEndsAt<r.game.endsAt?r.game.earlyEndsAt:r.game.endsAt)-Date.now())/1000))}:null});
function broadcast(r){r.revision++;const msg=`event: state\ndata: ${JSON.stringify(publicRoom(r))}\n\n`;for(const p of r.players.values()){const s=clients.get(p.id);if(s&&!s.destroyed)try{s.write(msg)}catch{}}}
function cleanupRoom(r){if(r.players.size===0)rooms.delete(r.code)}
function removePlayer(p){const r=rooms.get(p.room);if(!r)return;r.players.delete(p.id);const s=clients.get(p.id);clients.delete(p.id);if(s&&!s.destroyed)s.end();r.messages.push({system:true,text:`${p.name} 퇴장`,at:Date.now()});broadcast(r);cleanupRoom(r)}
const getPlayer=(req,body)=>{const token=String(req.headers['x-live-token']||body?.token||'');for(const r of rooms.values())for(const p of r.players.values())if(p.token===token)return {p,r};return null};
const readBody=req=>new Promise((resolve,reject)=>{let size=0,buf='';req.on('data',c=>{size+=c.length;if(size>16384){reject(new Error('요청 크기 초과'));req.destroy();return}buf+=c});req.on('end',()=>{try{resolve(JSON.parse(buf||'{}'))}catch{reject(new Error('잘못된 JSON'))}});req.on('error',reject)});
function handleAction(req,res,body){const url=new URL(req.url,'http://localhost');if(url.pathname==='/api/register' || url.pathname==='/api/login'){
const username = String(body.username||'').trim().toLowerCase(), password=String(body.password||'');
if(!/^[a-z0-9_]{3,20}$/.test(username) || password.length<8 || password.length>128)return reply(res,400,{error:'아이디는 영문·숫자·_ 3~20자, 비밀번호는 8~128자로 입력해.'});
if(url.pathname==='/api/register'){
 const nickname=validNickname(body.nickname);if(!nickname)return reply(res,400,{error:'닉네임은 2~16자로 입력해.'});
 if(accounts[username])return reply(res,409,{error:'이미 사용 중인 아이디야.'});
 const salt=crypto.randomBytes(16).toString('hex');accounts[username]={salt,hash:passwordHash(password,salt),nickname};saveAccounts();
}else{const acc=accounts[username];if(!acc)return reply(res,401,{error:'아이디 또는 비밀번호를 확인해.'});const expected=Buffer.from(acc.hash,'hex'),actual=Buffer.from(passwordHash(password,acc.salt),'hex');if(expected.length!==actual.length||!crypto.timingSafeEqual(expected,actual))return reply(res,401,{error:'아이디 또는 비밀번호를 확인해.'})}
const session=id();sessions.set(session,username);return reply(res,200,{session,username,nickname:nickOf(username)});
}
if(url.pathname==='/api/me'){const username=authAccount(req,body);return username?reply(res,200,{username,nickname:nickOf(username)}):reply(res,401,{error:'로그인이 필요해.'})}
if(url.pathname==='/api/nickname'){const username=authAccount(req,body);if(!username)return reply(res,401,{error:'로그인이 필요해.'});const nickname=validNickname(body.nickname);if(!nickname)return reply(res,400,{error:'닉네임은 2~16자로 입력해.'});accounts[username].nickname=nickname;saveAccounts();for(const r of rooms.values()){let modified=false;for(const p of r.players.values())if(p.username===username){p.name=nickname;modified=true}if(modified)broadcast(r)}return reply(res,200,{nickname})}
if(url.pathname==='/api/logout'){sessions.delete(String(req.headers['x-live-session']||body.session||''));return reply(res,200,{ok:true})}
if(url.pathname==='/api/create'){if(!authAccount(req,body))return reply(res,401,{error:'먼저 로그인해.'});const code=crypto.randomBytes(3).toString('hex').toUpperCase();const r={code,maxPlayers:Math.min(8,Math.max(2,Number(body.maxPlayers)||2)),players:new Map(),messages:[],revision:0};rooms.set(code,r);return join(r,res,body)}
if(url.pathname==='/api/join'){if(!authAccount(req,body))return reply(res,401,{error:'먼저 로그인해.'});const r=rooms.get(String(body.code||'').trim().toUpperCase());if(!r)return reply(res,404,{error:'방을 찾을 수 없어.'});if(r.started)return reply(res,409,{error:'이미 시작한 방이야.'});if(r.players.size>=r.maxPlayers)return reply(res,409,{error:'방이 가득 찼어.'});return join(r,res,body)}
const auth=getPlayer(req,body);if(!auth)return reply(res,401,{error:'인증되지 않은 참가자야.'});const {r,p}=auth;
if(url.pathname==='/api/leave'){removePlayer(p);return reply(res,200,{ok:true})}
if(url.pathname==='/api/ready'){if(r.started)return reply(res,409,{error:'이미 게임이 시작됐어.'});p.ready=!!body.ready;broadcast(r);return reply(res,200,{ok:true})}
if(url.pathname==='/api/round-ready'){if(!r.game||r.game.phase!=='prep')return reply(res,409,{error:'준비 단계가 아니야.'});p.roundReady=!!body.ready;refreshEarlyFinish(r);broadcast(r);return reply(res,200,{ok:true})}
if(url.pathname==='/api/farm-done'){if(!r.game||r.game.phase!=='combat'||!r.game.pve)return reply(res,409,{error:'파밍 단계가 아니야.'});if(Number(body.round)!==r.game.round)return reply(res,409,{error:'지난 라운드 보고야.'});p.farmDone=true;refreshEarlyFinish(r);broadcast(r);return reply(res,200,{ok:true})}
if(url.pathname==='/api/start'){if(p.slot!==0)return reply(res,403,{error:'방장만 시작할 수 있어.'});if(r.started)return reply(res,409,{error:'이미 시작했어.'});if(r.players.size<2||!([...r.players.values()].every(x=>x.ready&&x.connected)))return reply(res,409,{error:'최소 2명 접속 및 전원 준비가 필요해.'});r.started=true;r.game={round:1,phase:"prep",endsAt:Date.now()+60000,hp:[100,100],version:1,seed:0,battle:null,earlyEndsAt:null};for(const member of r.players.values()){member.roundReady=false;member.farmDone=false}broadcast(r);return reply(res,200,{ok:true})}
if(url.pathname==='/api/chat'){const text=String(body.text||'').trim().slice(0,240);if(!text)return reply(res,400,{error:'빈 메시지'});const now=Date.now();if(now-(p.lastChat||0)<350)return reply(res,429,{error:'채팅을 너무 빠르게 보냈어.'});p.lastChat=now;r.messages.push({id:id(),playerId:p.id,name:p.name,text,at:now});r.messages=r.messages.slice(-60);broadcast(r);return reply(res,200,{ok:true})}
if(url.pathname==='/api/advance'){return reply(res,403,{error:'라운드 변경은 서버가 관리해.'})}
if(url.pathname==='/api/team'){const rows=body.team;if(!Array.isArray(rows)||rows.length>3)return reply(res,400,{error:'배치 최대 3명'});const used=new Set();for(const u of rows){if(typeof u.characterId!=='string'||!/^[a-z-]{1,32}$/.test(u.characterId)||!Number.isInteger(u.x)||u.x<0||u.x>2||!Number.isInteger(u.y)||u.y<0||u.y>2||!Number.isInteger(u.star)||u.star<1||u.star>3)return reply(res,400,{error:'잘못된 배치'});const key=`${u.x},${u.y}`;if(used.has(key))return reply(res,400,{error:'중복 배치'});used.add(key);if(u.items!==undefined&&(!Array.isArray(u.items)||u.items.length>3))return reply(res,400,{error:'장비 초과'})}if(r.game&&r.game.phase!=='prep')return reply(res,409,{error:'준비 시간에만 배치 변경 가능'});p.team=rows.map(({characterId,x,y,star,items})=>({characterId,x,y,star,items:Array.isArray(items)?items.slice(0,3):[]}));p.mastery=Number.isInteger(body.mastery)?Math.min(20,Math.max(1,body.mastery)):1;p.ready=false;if(r.game?.phase==='prep'){p.roundReady=false;refreshEarlyFinish(r)}broadcast(r);return reply(res,200,{ok:true})}
return reply(res,404,{error:'요청 없음'});
}
function join(r,res,body){const slot=Array.from({length:r.maxPlayers},(_,i)=>i).find(i=>![...r.players.values()].some(p=>p.slot===i));const username=authAccount({headers:{'x-live-session':body.session}},body);const p={id:id(),token:id(),room:r.code,username,name:nickOf(username),slot,ready:false,connected:false,team:[]};r.players.set(p.id,p);r.messages.push({system:true,text:`${p.name} 입장`,at:Date.now()});broadcast(r);reply(res,200,{token:p.token,playerId:p.id,room:publicRoom(r)})}

// Early transition only when EVERY connected participant has completed this phase.
// The 60s deadline stays authoritative; a five-second early countdown never extends it.
function refreshEarlyFinish(r){
 const g=r.game;if(!g||!['prep','combat'].includes(g.phase))return;
 const players=[...r.players.values()];
 const eligible=players.length>=2&&players.every(p=>p.connected&&(g.phase==='prep'?p.roundReady:(g.pve&&p.farmDone)));
 if(eligible){if(!g.earlyEndsAt)g.earlyEndsAt=Date.now()+5000;}
 else g.earlyEndsAt=null;
}
// Single-process, room-authoritative clock and deterministic PvP result.
function advanceRoom(r){const g=r.game;if(!g||g.phase==='finished'||Date.now()<Math.min(g.endsAt,g.earlyEndsAt||Infinity))return;
 if(g.phase==='prep'){
  const players=[...r.players.values()].sort((a,b)=>a.slot-b.slot);
  if(players.length!==2){g.phase='finished';g.endsAt=Date.now();broadcast(r);return}
  const seed=crypto.randomInt(1,2147483647),pve=g.round===1;
  const a=players[0],b=players[1];let battle=null,duration=3;
  if(!pve){try{const cfg={teamA:a.team,teamB:b.team,masteryA:a.mastery||1,masteryB:b.mastery||1,seed,moveInterval:.5};const result=new CombatEngine(cfg).run();battle={outcome:result.outcome,time:result.time};duration=Math.max(3,Math.min(60,Math.ceil(result.time)+2));}catch(e){battle={outcome:'무승부',time:0,error:String(e.message)};duration=3}}
  g.phase='combat';g.seed=seed;g.battle=battle;g.combatId=g.version;g.pve=pve;g.earlyEndsAt=null;for(const member of r.players.values())member.farmDone=false;g.endsAt=Date.now()+(pve?60:duration)*1000;g.version++;broadcast(r);return;
 }
 if(g.phase==='combat'){
  if(!g.pve){const damage=Math.min(25,5+Math.floor((g.round-1)/3)*2);if(g.battle?.outcome==='A팀 승리')g.hp[1]=Math.max(0,g.hp[1]-damage);else if(g.battle?.outcome==='B팀 승리')g.hp[0]=Math.max(0,g.hp[0]-damage)}
  g.phase='result';g.earlyEndsAt=null;g.endsAt=Date.now()+4000;g.version++;broadcast(r);return;
 }
 if(g.phase==='result'){
  if(g.hp.some(x=>x<=0)){g.phase='finished';g.endsAt=Date.now();}else{g.round++;g.phase='prep';g.endsAt=Date.now()+60000;g.battle=null;g.seed=0;g.pve=false;g.earlyEndsAt=null;for(const member of r.players.values()){member.roundReady=false;member.farmDone=false}}
  g.version++;broadcast(r);
 }
}
const gameClock=setInterval(()=>{for(const r of rooms.values())try{advanceRoom(r)}catch(e){console.error('room timer:',e)}},250);
const server=http.createServer(async(req,res)=>{const u=new URL(req.url,'http://localhost');if(u.pathname==='/api/events'&&req.method==='GET'){const auth=getPlayer(req,{token:u.searchParams.get('token')});if(!auth)return reply(res,401,{error:'인증 실패'});const {p,r}=auth;const previous=clients.get(p.id);if(previous&&!previous.destroyed)previous.end();res.writeHead(200,{'content-type':'text/event-stream; charset=utf-8','cache-control':'no-cache, no-transform','connection':'keep-alive','x-accel-buffering':'no'});clients.set(p.id,res);p.connected=true;broadcast(r);const heartbeat=setInterval(()=>{if(!res.destroyed)res.write(': heartbeat\n\n')},18000);req.on('close',()=>{clearInterval(heartbeat);if(clients.get(p.id)===res){clients.delete(p.id);p.connected=false;refreshEarlyFinish(r);broadcast(r)}});return}
if(u.pathname==='/health')return reply(res,200,{ok:true});
if(u.pathname.startsWith('/api/')){if(req.method!=='POST')return reply(res,405,{error:'POST 요청 필요'});try{return handleAction(req,res,await readBody(req))}catch(e){if(!res.destroyed)reply(res,400,{error:e.message})}return}
if(req.method!=='GET'&&req.method!=='HEAD')return reply(res,405,{error:'Method not allowed'});let pathname;try{pathname=decodeURIComponent(u.pathname)}catch{return res.writeHead(400).end()};if(pathname==='/'||pathname==='')pathname='/index.html';const file=path.resolve(root,'.'+pathname);if(pathname.includes('/.') || !(file===root||file.startsWith(root+path.sep))||file.endsWith('.cjs')||file.endsWith('.md')||file.endsWith('.json')||file.includes('/tests/')||file.includes('node_modules'))return res.writeHead(403).end();fs.stat(file,(err,stat)=>{if(err||!stat.isFile())return res.writeHead(404).end();res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream','cache-control':'no-cache'});if(req.method==='HEAD')return res.end();fs.createReadStream(file).pipe(res)})});
server.listen(PORT,'0.0.0.0',()=>console.log(`L.I.V.E. 멀티 서버: http://localhost:${PORT}`));
module.exports={server,rooms};
