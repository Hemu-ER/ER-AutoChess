'use strict';
// M4 network foundation: single-process, memory-only authoritative rooms.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = __dirname;
const PORT = Number(process.env.PORT || 3000);
const rooms = new Map();
const clients = new Map();
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.cjs':'text/plain; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ttf':'font/ttf','.woff2':'font/woff2','.json':'application/json'};
const reply=(res,status,obj)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(obj));};
const id=()=>crypto.randomBytes(18).toString('hex');
const cleanName=v=>String(v||'플레이어').trim().slice(0,18)||'플레이어';
const publicRoom=r=>({code:r.code,maxPlayers:r.maxPlayers,revision:r.revision,players:[...r.players.values()].map(p=>({id:p.id,name:p.name,slot:p.slot,ready:p.ready,connected:p.connected,team:p.team})),messages:r.messages.slice(-60)});
function broadcast(r){r.revision++;const msg=`event: state\ndata: ${JSON.stringify(publicRoom(r))}\n\n`;for(const p of r.players.values()){const s=clients.get(p.id);if(s&&!s.destroyed)try{s.write(msg)}catch{}}}
function cleanupRoom(r){if(r.players.size===0)rooms.delete(r.code)}
function removePlayer(p){const r=rooms.get(p.room);if(!r)return;r.players.delete(p.id);const s=clients.get(p.id);clients.delete(p.id);if(s&&!s.destroyed)s.end();r.messages.push({system:true,text:`${p.name} 퇴장`,at:Date.now()});broadcast(r);cleanupRoom(r)}
const getPlayer=(req,body)=>{const token=String(req.headers['x-live-token']||body?.token||'');for(const r of rooms.values())for(const p of r.players.values())if(p.token===token)return {p,r};return null};
const readBody=req=>new Promise((resolve,reject)=>{let size=0,buf='';req.on('data',c=>{size+=c.length;if(size>16384){reject(new Error('요청 크기 초과'));req.destroy();return}buf+=c});req.on('end',()=>{try{resolve(JSON.parse(buf||'{}'))}catch{reject(new Error('잘못된 JSON'))}});req.on('error',reject)});
function handleAction(req,res,body){const url=new URL(req.url,'http://localhost');if(url.pathname==='/api/create'){const code=crypto.randomBytes(3).toString('hex').toUpperCase();const r={code,maxPlayers:Math.min(8,Math.max(2,Number(body.maxPlayers)||2)),players:new Map(),messages:[],revision:0};rooms.set(code,r);return join(r,res,body)}
if(url.pathname==='/api/join'){const r=rooms.get(String(body.code||'').trim().toUpperCase());if(!r)return reply(res,404,{error:'방을 찾을 수 없어.'});if(r.players.size>=r.maxPlayers)return reply(res,409,{error:'방이 가득 찼어.'});return join(r,res,body)}
const auth=getPlayer(req,body);if(!auth)return reply(res,401,{error:'인증되지 않은 참가자야.'});const {r,p}=auth;
if(url.pathname==='/api/leave'){removePlayer(p);return reply(res,200,{ok:true})}
if(url.pathname==='/api/ready'){p.ready=!!body.ready;broadcast(r);return reply(res,200,{ok:true})}
if(url.pathname==='/api/chat'){const text=String(body.text||'').trim().slice(0,240);if(!text)return reply(res,400,{error:'빈 메시지'});const now=Date.now();if(now-(p.lastChat||0)<350)return reply(res,429,{error:'채팅을 너무 빠르게 보냈어.'});p.lastChat=now;r.messages.push({id:id(),playerId:p.id,name:p.name,text,at:now});r.messages=r.messages.slice(-60);broadcast(r);return reply(res,200,{ok:true})}
if(url.pathname==='/api/team'){const rows=body.team;if(!Array.isArray(rows)||rows.length>3)return reply(res,400,{error:'배치 최대 3명'});const used=new Set();for(const u of rows){if(typeof u.characterId!=='string'||!/^[a-z-]{1,32}$/.test(u.characterId)||!Number.isInteger(u.x)||u.x<0||u.x>2||!Number.isInteger(u.y)||u.y<0||u.y>2||!Number.isInteger(u.star)||u.star<1||u.star>3)return reply(res,400,{error:'잘못된 배치'});const key=`${u.x},${u.y}`;if(used.has(key))return reply(res,400,{error:'중복 배치'});used.add(key)}p.team=rows.map(({characterId,x,y,star})=>({characterId,x,y,star}));p.ready=false;broadcast(r);return reply(res,200,{ok:true})}
return reply(res,404,{error:'요청 없음'});
}
function join(r,res,body){const slot=Array.from({length:r.maxPlayers},(_,i)=>i).find(i=>![...r.players.values()].some(p=>p.slot===i));const p={id:id(),token:id(),room:r.code,name:cleanName(body.name),slot,ready:false,connected:false,team:[]};r.players.set(p.id,p);r.messages.push({system:true,text:`${p.name} 입장`,at:Date.now()});broadcast(r);reply(res,200,{token:p.token,playerId:p.id,room:publicRoom(r)})}
const server=http.createServer(async(req,res)=>{const u=new URL(req.url,'http://localhost');if(u.pathname==='/api/events'&&req.method==='GET'){const auth=getPlayer(req,{token:u.searchParams.get('token')});if(!auth)return reply(res,401,{error:'인증 실패'});const {p,r}=auth;const previous=clients.get(p.id);if(previous&&!previous.destroyed)previous.end();res.writeHead(200,{'content-type':'text/event-stream; charset=utf-8','cache-control':'no-cache, no-transform','connection':'keep-alive','x-accel-buffering':'no'});clients.set(p.id,res);p.connected=true;broadcast(r);const heartbeat=setInterval(()=>{if(!res.destroyed)res.write(': heartbeat\n\n')},18000);req.on('close',()=>{clearInterval(heartbeat);if(clients.get(p.id)===res){clients.delete(p.id);p.connected=false;broadcast(r)}});return}
if(u.pathname.startsWith('/api/')){if(req.method!=='POST')return reply(res,405,{error:'POST 요청 필요'});try{return handleAction(req,res,await readBody(req))}catch(e){if(!res.destroyed)reply(res,400,{error:e.message})}return}
if(req.method!=='GET'&&req.method!=='HEAD')return reply(res,405,{error:'Method not allowed'});let pathname;try{pathname=decodeURIComponent(u.pathname)}catch{return res.writeHead(400).end()};if(pathname==='/'||pathname==='')pathname='/index.html';const file=path.resolve(root,'.'+pathname);if(!(file===root||file.startsWith(root+path.sep))||file.endsWith('.cjs')||file.endsWith('.md')||file.endsWith('.json')||file.includes('/tests/')||file.includes('node_modules'))return res.writeHead(403).end();fs.stat(file,(err,stat)=>{if(err||!stat.isFile())return res.writeHead(404).end();res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream','cache-control':'no-cache'});if(req.method==='HEAD')return res.end();fs.createReadStream(file).pipe(res)})});
server.listen(PORT,'0.0.0.0',()=>console.log(`L.I.V.E. 멀티 서버: http://localhost:${PORT}`));
module.exports={server,rooms};
