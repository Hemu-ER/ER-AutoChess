'use strict';
// M4 network foundation: single-process, memory-only authoritative rooms.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {CombatEngine,pickArenaRegion}=require('./combat-engine.js');
const {roster:supplyRoster}=require('./roster.js');
const {createSchedule,roundKind,pairSurvivors,draftOrder,LABELS}=require('./round-rules.cjs');
const {makeCandidates}=require('./selection.cjs');
const economy=require('./match-economy.cjs');
const m7Roster=Object.fromEntries(supplyRoster.map(r=>[r.id,r]));
const FARM_LINEUPS={
 1:[{characterId:'wild_boar',star:1,x:2,y:1},{characterId:'wild_dog',star:1,x:1,y:0}],
 3:[{characterId:'wild_wolf',star:1,x:2,y:0},{characterId:'wild_wolf',star:1,x:2,y:2},{characterId:'wild_boar',star:1,x:1,y:1}]
};
// M7-03: three different reward CATEGORIES chosen by weighted sampling without replacement.
// 1-cost and 2-cost subjects are distinct categories. These are first-draw weights.
const SUPPLY_ODDS=Object.freeze([['complete',5],['credits',30],['exp',20],['unit1',25],['unit2',20]]);
const SUPPLY_UNITS={1:supplyRoster.filter(r=>!r.pveOnly&&r.cost===1).map(r=>r.id),2:supplyRoster.filter(r=>!r.pveOnly&&r.cost===2).map(r=>r.id)};
if(!SUPPLY_UNITS[1].length||!SUPPLY_UNITS[2].length)throw Error('보급용 1·2코스트 실험체 풀이 비어 있어.');
function drawSupplyReward(kind){
 if(!kind){const total=SUPPLY_ODDS.reduce((n,[,weight])=>n+weight,0);let roll=crypto.randomInt(total);for(const [name,weight] of SUPPLY_ODDS){if(roll<weight){kind=name;break}roll-=weight}}
 if(kind==='credits'||kind==='exp')return {type:kind,value:crypto.randomInt(7,11)};
 if(kind==='complete')return {type:'complete',value:crypto.randomInt(28)};
 if(kind!=='unit1'&&kind!=='unit2')throw Error('알 수 없는 보급 유형: '+kind);
 const cost=kind==='unit1'?1:2,units=SUPPLY_UNITS[cost];
 return {type:'unit',cost,value:units[crypto.randomInt(units.length)],star:2,
  ...(cost===1?{bonusBasic:crypto.randomInt(7)}:{})};
}
function drawSupplyChoices(){
 const pool=SUPPLY_ODDS.map(([kind,weight])=>({kind,weight})),cards=[];
 for(let i=0;i<3;i++){
  const total=pool.reduce((n,e)=>n+e.weight,0);let roll=crypto.randomInt(total),chosen=0;
  for(let j=0;j<pool.length;j++){if(roll<pool[j].weight){chosen=j;break}roll-=pool[j].weight}
  const [{kind}]=pool.splice(chosen,1);cards.push(drawSupplyReward(kind));
 }
 return cards;
}

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
// Optional durable account store (Upstash Redis REST). Free Render instances have ephemeral disks.
const remoteUrl=(process.env.UPSTASH_REDIS_REST_URL||'').replace(/\/$/,'');
const remoteToken=process.env.UPSTASH_REDIS_REST_TOKEN||'';
const durable=Boolean(remoteUrl&&remoteToken);
async function remote(command){const response=await fetch(remoteUrl,{method:'POST',headers:{authorization:`Bearer ${remoteToken}`,'content-type':'application/json'},body:JSON.stringify(command)});if(!response.ok)throw Error('계정 저장소 요청 실패: '+response.status);const json=await response.json();if(json.error)throw Error('계정 저장소 오류: '+json.error);return json.result}
async function loadAccounts(){if(!durable){console.warn('WARNING: NO DURABLE ACCOUNT STORAGE CONFIGURED. Render deployments may erase users.');return;}const raw=await remote(['GET','live:accounts:v1']);accounts=raw?JSON.parse(raw):{};console.log('Loaded persistent accounts:',Object.keys(accounts).length)}
async function saveAccounts(){if(durable){await remote(['SET','live:accounts:v1',JSON.stringify(accounts)])}else fs.writeFileSync(accountFile, JSON.stringify(accounts,null,2),{mode:0o600})}

const passwordHash = (password, salt) => crypto.scryptSync(password, salt, 64).toString('hex');
const authAccount = (req, body) => sessions.get(String(req.headers['x-live-session'] || body?.session || ''));

const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.cjs':'text/plain; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ttf':'font/ttf','.woff2':'font/woff2','.json':'application/json'};
const reply=(res,status,obj)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(obj));};
const id=()=>crypto.randomBytes(18).toString('hex');
const cleanName=v=>String(v||'').trim().normalize('NFC');
const validNickname=v=>{const n=cleanName(v);return n.length>=2&&n.length<=16&&!/[\x00-\x1f\x7f<>]/.test(n)?n:null};
const nickOf=username=>accounts[username]?.nickname||username;
const living=r=>[...r.players.values()].filter(p=>r.game?.hp[p.slot]>0);
function playerView(r,p){
 const g=r.game?{...r.game,remaining:Math.max(0,Math.ceil(((r.game.earlyEndsAt&&r.game.earlyEndsAt<r.game.endsAt?r.game.earlyEndsAt:r.game.endsAt)-Date.now())/1000))}:null;
 if(g){
  // Never expose another player's private supply options or hidden special choice.
  if(g.selection){g.selection={...g.selection,resolved:{[p.slot]:g.selection.resolved[p.slot]||null}}}
  if(g.supplyOptions)g.supplyOptions=Object.fromEntries([[p.slot,r.game.supplyOptions[p.slot]]]);
  if(g.supplyResolved)g.supplyResolved=Object.fromEntries([[p.slot,r.game.supplyResolved[p.slot]]]);
  const pair=g.pairs?.find(x=>x.a===p.slot||x.b===p.slot);
  g.opponentSlot=pair?(pair.a===p.slot?pair.b:pair.a):null;
  g.bye=!!(g.kind==='pvp'&&['combat','result'].includes(g.phase)&&!pair&&g.hp[p.slot]>0);
  if(pair){
   g.seed=pair.seed;
   const original=pair.battle;
   g.battle=original?{...original,outcome:pair.b===p.slot?(original.outcome==='A팀 승리'?'B팀 승리':original.outcome==='B팀 승리'?'A팀 승리':original.outcome):original.outcome,personaTierA:pair.b===p.slot?original.personaTierB:original.personaTierA,personaTierB:pair.b===p.slot?original.personaTierA:original.personaTierB}:null;
  }else if(g.kind==='pvp'){g.battle=null;g.seed=0}
  // Do not reveal hidden pair results; they are only visible when each participant's fight starts.
  // Each participant receives only their own deterministic PvE seed and loot data remains server-private.
  if(g.pve&&g.farmResults?.[p.slot])g.seed=g.farmResults[p.slot].seed;
  delete g.farmResults;
  if(g.experimentId==='bomb'&&g.bombTeams){const team=g.bombTeams.find(t=>t.slots.includes(p.slot));g.bombTeamId=team?.id||null;g.teamMessages=team?.messages?.slice(-60)||[];}delete g.bombTeams;
  if(g.farmResults){g.farmKills=g.farmResults[p.slot]?.killed||0;g.seed=g.farmResults[p.slot]?.seed||0;delete g.farmResults;}
  delete g.pairs;
 }
 return {code:r.code,maxPlayers:r.maxPlayers,revision:r.revision,players:[...r.players.values()].map(x=>({id:x.id,name:x.name,slot:x.slot,ready:x.ready,roundReady:!!x.roundReady,farmDone:!!x.farmDone,connected:x.connected,...(x.id===p.id?{assets:x.assets||null}:{}),eliminated:!!(g&&g.hp[x.slot]<=0),team:x.team,progress:x.progress})),messages:r.messages.slice(-60),started:!!r.started,game:g};
}
const publicRoom=r=>({code:r.code,maxPlayers:r.maxPlayers,revision:r.revision,players:[...r.players.values()].map(p=>({id:p.id,name:p.name,slot:p.slot,ready:p.ready,connected:p.connected})),messages:r.messages.slice(-60),started:!!r.started,game:r.game?{round:r.game.round,phase:r.game.phase,kind:r.game.kind,hp:r.game.hp,schedule:r.game.schedule}:null});
function broadcast(r){r.revision++;for(const p of r.players.values()){const res=clients.get(p.id);if(res&&!res.destroyed)try{res.write(`event: state\ndata: ${JSON.stringify(playerView(r,p))}\n\n`)}catch{}}}
function cleanupRoom(r){if(r.players.size===0)rooms.delete(r.code)}
// In 2–8-player games an intentional leave eliminates only the leaver.
function finishAbandonedMatch(r,reason='opponent_left',explicitWinnerSlot=null){
 const g=r.game;if(!r.started||!g||g.phase==='finished')return;
 if(explicitWinnerSlot===null)return;
 const survivors=living(r);
 if(survivors.length!==1||survivors[0].slot!==explicitWinnerSlot)return;
 g.winnerSlot=explicitWinnerSlot;g.endReason=reason;g.phase='finished';g.endsAt=Date.now();g.earlyEndsAt=null;g.version++;broadcast(r);
}
function removePlayer(p){
 const r=rooms.get(p.room);if(!r)return;
 if(r.started&&r.game&&r.game.phase!=='finished')r.game.hp[p.slot]=0;
 r.players.delete(p.id);const s=clients.get(p.id);clients.delete(p.id);if(s&&!s.destroyed)s.end();
 r.messages.push({system:true,text:`${p.name} 퇴장`,at:Date.now()});
 if(r.started&&r.game&&r.game.phase!=='finished'){const remain=living(r);if(remain.length<=1){r.game.phase='finished';r.game.winnerSlot=remain[0]?.slot??null;r.game.endReason='opponent_left';r.game.endsAt=Date.now();r.game.version++}else refreshEarlyFinish(r)}
 broadcast(r);cleanupRoom(r);
}
const getPlayer=(req,body)=>{const token=String(req.headers['x-live-token']||body?.token||'');for(const r of rooms.values())for(const p of r.players.values())if(p.token===token)return {p,r};return null};
const readBody=req=>new Promise((resolve,reject)=>{let size=0,buf='';req.on('data',c=>{size+=c.length;if(size>16384){reject(new Error('요청 크기 초과'));req.destroy();return}buf+=c});req.on('end',()=>{try{resolve(JSON.parse(buf||'{}'))}catch{reject(new Error('잘못된 JSON'))}});req.on('error',reject)});
async function handleAction(req,res,body){const url=new URL(req.url,'http://localhost');if(url.pathname==='/api/register' || url.pathname==='/api/login'){
const username = String(body.username||'').trim().toLowerCase(), password=String(body.password||'');
if(!/^[a-z0-9_]{3,20}$/.test(username) || password.length<8 || password.length>128)return reply(res,400,{error:'아이디는 영문·숫자·_ 3~20자, 비밀번호는 8~128자로 입력해.'});
if(url.pathname==='/api/register'){
 const nickname=validNickname(body.nickname);if(!nickname)return reply(res,400,{error:'닉네임은 2~16자로 입력해.'});
 if(accounts[username])return reply(res,409,{error:'이미 사용 중인 아이디야.'});
 const salt=crypto.randomBytes(16).toString('hex');accounts[username]={salt,hash:passwordHash(password,salt),nickname};await saveAccounts();
}else{const acc=accounts[username];if(!acc)return reply(res,401,{error:'아이디 또는 비밀번호를 확인해.'});const expected=Buffer.from(acc.hash,'hex'),actual=Buffer.from(passwordHash(password,acc.salt),'hex');if(expected.length!==actual.length||!crypto.timingSafeEqual(expected,actual))return reply(res,401,{error:'아이디 또는 비밀번호를 확인해.'})}
const session=id();sessions.set(session,username);return reply(res,200,{session,username,nickname:nickOf(username)});
}
if(url.pathname==='/api/me'){const username=authAccount(req,body);return username?reply(res,200,{username,nickname:nickOf(username)}):reply(res,401,{error:'로그인이 필요해.'})}
 if(url.pathname==='/api/rejoin'){
  const username=authAccount(req,body);
  if(!username)return reply(res,401,{error:'로그인이 필요해.'});
  const matches=[...rooms.values()].filter(r=>r.started&&r.game?.phase!=='finished');
  const code=String(body.code||'').trim().toUpperCase();
  const found=matches.flatMap(r=>[...r.players.values()].filter(p=>p.username===username&&r.game.hp[p.slot]>0&&(!code||r.code===code)).map(p=>({r,p})))[0];
  if(!found)return reply(res,404,{error:'복귀할 진행 중 경기가 없어.'});
  return reply(res,200,{token:found.p.token,playerId:found.p.id,room:playerView(found.r,found.p)});
 }
if(url.pathname==='/api/nickname'){const username=authAccount(req,body);if(!username)return reply(res,401,{error:'로그인이 필요해.'});const nickname=validNickname(body.nickname);if(!nickname)return reply(res,400,{error:'닉네임은 2~16자로 입력해.'});accounts[username].nickname=nickname;await saveAccounts();for(const r of rooms.values()){let modified=false;for(const p of r.players.values())if(p.username===username){p.name=nickname;modified=true}if(modified)broadcast(r)}return reply(res,200,{nickname})}
if(url.pathname==='/api/logout'){sessions.delete(String(req.headers['x-live-session']||body.session||''));return reply(res,200,{ok:true})}
if(url.pathname==='/api/create'){if(!authAccount(req,body))return reply(res,401,{error:'먼저 로그인해.'});const code=crypto.randomBytes(3).toString('hex').toUpperCase();const r={code,maxPlayers:Math.min(8,Math.max(2,Number(body.maxPlayers)||2)),players:new Map(),messages:[],revision:0};rooms.set(code,r);return join(r,res,body)}
if(url.pathname==='/api/join'){if(!authAccount(req,body))return reply(res,401,{error:'먼저 로그인해.'});const r=rooms.get(String(body.code||'').trim().toUpperCase());if(!r)return reply(res,404,{error:'방을 찾을 수 없어.'});if(r.started)return reply(res,409,{error:'이미 시작한 방이야.'});if(r.players.size>=r.maxPlayers)return reply(res,409,{error:'방이 가득 찼어.'});return join(r,res,body)}
const auth=getPlayer(req,body);if(!auth)return reply(res,401,{error:'인증되지 않은 참가자야.'});const {r,p}=auth;
if(url.pathname==='/api/leave'){removePlayer(p);return reply(res,200,{ok:true})}
if(url.pathname==='/api/ready'){if(r.started)return reply(res,409,{error:'이미 게임이 시작됐어.'});p.ready=!!body.ready;broadcast(r);return reply(res,200,{ok:true})}
if(url.pathname==='/api/round-ready'){if(!r.game||r.game.phase!=='prep'||r.game.hp[p.slot]<=0)return reply(res,409,{error:'준비 단계가 아니야.'});p.roundReady=!!body.ready;refreshEarlyFinish(r);broadcast(r);return reply(res,200,{ok:true})}
 if(url.pathname==='/api/intro-complete'){
  const g=r.game;
  if(!g||g.phase!=='intro'||g.round!==Number(body.round)||g.hp[p.slot]<=0)return reply(res,409,{error:'라운드 연출 단계가 아니야.'});
  g.introReady??={};g.introReady[p.slot]=true;
  if(living(r).every(x=>g.introReady[x.slot]))g.earlyEndsAt=Math.max(Date.now()+100,g.introStartedAt+1850);
  broadcast(r);return reply(res,200,{ok:true});
 }
if(url.pathname==='/api/supply-pick'){
 if(!r.game||r.game.round!==5||!['supply','result'].includes(r.game.phase))return reply(res,409,{error:'보급 선택 시간이 아니야.'});
 const slot=p.slot, choice=Number(body.choice), options=r.game.supplyOptions?.[slot];
  if(r.game.hp[slot]<=0)return reply(res,409,{error:'탈락자는 선택할 수 없어.'});
 if(r.game.supplyResolved?.[slot])return reply(res,409,{error:'보상을 이미 선택했어.'});
 if(!options||!Number.isInteger(choice)||choice<0||choice>=3)return reply(res,400,{error:'잘못된 보상 선택'});
 r.game.supplyResolved[slot]=options[choice];if(p.assets){economy.grant(p.assets,options[choice],`r${r.game.round}:supply:${slot}`);p.team=economy.ownTeam(p.assets);p.mastery=p.assets.level;}refreshEarlyFinish(r);broadcast(r);return reply(res,200,{ok:true});
}
if(url.pathname==='/api/farm-done'){if(!r.game||r.game.phase!=='combat'||!r.game.pve||r.game.hp[p.slot]<=0)return reply(res,409,{error:'파밍 단계가 아니야.'});if(Number(body.round)!==r.game.round)return reply(res,409,{error:'지난 라운드 보고야.'});const expected=r.game.farmResults?.[p.slot]?.time;if(Number.isFinite(expected)&&Date.now()-r.game.combatStartedAt<Math.min(60,expected)*1000-250)return reply(res,409,{error:'파밍 전투가 아직 끝나지 않았어.'});p.farmDone=true;refreshEarlyFinish(r);broadcast(r);return reply(res,200,{ok:true})}
if(url.pathname==='/api/start'){if(p.slot!==0)return reply(res,403,{error:'방장만 시작할 수 있어.'});if(r.started)return reply(res,409,{error:'이미 시작했어.'});if(r.players.size<2||!([...r.players.values()].every(x=>x.ready&&x.connected)))return reply(res,409,{error:'최소 2명 접속 및 전원 준비가 필요해.'});r.started=true;for(const member of r.players.values()){member.assets=economy.makeInitial();member.team=economy.ownTeam(member.assets);member.mastery=member.assets.level;}for(const member of r.players.values())member.progress={exploration:{visited:[],stacks:0},infiltration:0,infiltrationRewards:0,bloodMoonGranted:false};r.game={round:1,kind:'farm',phase:'prep',endsAt:Date.now()+60000,hp:Array.from({length:r.maxPlayers},(_,i)=>[...r.players.values()].some(p=>p.slot===i)?100:0),schedule:createSchedule(),byeCounts:{},previousByeSlot:null,lastOpponents:{},version:1,seed:0,battle:null,pairs:[],earlyEndsAt:null};for(const member of r.players.values()){member.roundReady=false;member.farmDone=false}broadcast(r);return reply(res,200,{ok:true})}
if(url.pathname==='/api/chat'){const text=String(body.text||'').trim().slice(0,240);if(!text)return reply(res,400,{error:'빈 메시지'});const now=Date.now();if(now-(p.lastChat||0)<350)return reply(res,429,{error:'채팅을 너무 빠르게 보냈어.'});p.lastChat=now;r.messages.push({id:id(),playerId:p.id,name:p.name,text,at:now});r.messages=r.messages.slice(-60);broadcast(r);return reply(res,200,{ok:true})}
if(url.pathname==='/api/selection-pick'){
 const g=r.game,sel=g?.selection;if(g?.phase!=='special'||g.specialType!=='selection'||!sel)return reply(res,409,{error:'선점 진행 중이 아니야.'});
 const wave=sel.order.slice(sel.wave*2,sel.wave*2+2);
 if(!wave.includes(p.slot)||g.hp[p.slot]<=0||sel.resolved[p.slot])return reply(res,409,{error:'현재 선점 차례가 아니야.'});
 const choice=Number(body.choice),candidate=sel.candidates[choice];if(!Number.isInteger(choice)||!candidate||candidate.claimedBy!==null)return reply(res,409,{error:'이미 선택됐거나 존재하지 않는 후보야.'});
 candidate.claimedBy=p.slot;sel.resolved[p.slot]={characterId:candidate.characterId,star:1,item:candidate.item};if(p.assets){economy.grant(p.assets,{type:'selection',...sel.resolved[p.slot]},`r${g.round}:selection:${p.slot}`);p.team=economy.ownTeam(p.assets);p.mastery=p.assets.level;}
 if(wave.every(slot=>!!sel.resolved[slot]))g.endsAt=Date.now();broadcast(r);return reply(res,200,{ok:true});
 }
 if(url.pathname==='/api/team-chat'){
 const g=r.game;if(g?.phase!=='special'||g.specialType!=='experiment'||g.experimentId!=='bomb')return reply(res,409,{error:'폭발물 해체 채팅 중이 아니야.'});
 const team=g.bombTeams?.find(x=>x.slots.includes(p.slot));if(!team)return reply(res,403,{error:'배정된 팀이 없어.'});
 const message=String(body.text||'').trim().slice(0,240);if(!message)return reply(res,400,{error:'빈 메시지'});
 const now=Date.now();if(now-(p.lastTeamChat||0)<350)return reply(res,429,{error:'채팅 전송 간격을 지켜 줘.'});p.lastTeamChat=now;
 team.messages.push({name:p.name,slot:p.slot,text:message,at:now});team.messages=team.messages.slice(-60);broadcast(r);return reply(res,200,{ok:true});
 }
 if(url.pathname==='/api/advance'){return reply(res,403,{error:'라운드 변경은 서버가 관리해.'})}
if(url.pathname==='/api/economy'){
  if(!r.game||r.game.phase!=='prep'||r.game.hp[p.slot]<=0||!p.assets)return reply(res,409,{error:'준비 단계에서만 경제 동작을 할 수 있어.'});
  const allowed=['buy','reroll','lock','invest','sell-unit','sell-item','craft','equip','deploy','recall','swap'];
  if(!allowed.includes(body.cmd))return reply(res,400,{error:'경제 명령이 올바르지 않아.'});
  try{economy.action(p.assets,body.cmd,body);p.team=economy.ownTeam(p.assets);p.mastery=p.assets.level;p.roundReady=false;refreshEarlyFinish(r);}catch(e){return reply(res,409,{error:e.message})}
  broadcast(r);return reply(res,200,{ok:true});
 }
 if(url.pathname==='/api/team'&&p.assets){
  if(!r.game||r.game.phase!=='prep'||r.game.hp[p.slot]<=0)return reply(res,409,{error:'배치 변경은 준비 단계에서만 가능해.'});
  const rows=body.team;
  if(!Array.isArray(rows)||rows.length>3)return reply(res,400,{error:'배치 최대 3명'});
  const used=new Set(),uidSet=new Set(),updates=[];
  for(const unit of rows){
   const uid=Number(unit.ownedId),mine=p.assets.owned.find(o=>o.uid===uid);
   if(!mine||uidSet.has(uid)||mine.characterId!==unit.characterId||mine.star!==unit.star
    ||JSON.stringify(mine.items)!==JSON.stringify(unit.items)||!Number.isInteger(unit.x)||unit.x<0||unit.x>2
    ||!Number.isInteger(unit.y)||unit.y<0||unit.y>2||used.has(unit.x+','+unit.y))return reply(res,409,{error:'소유하지 않거나 잘못된 배치야.'});
   uidSet.add(uid);used.add(unit.x+','+unit.y);updates.push({mine,x:unit.x,y:unit.y});
  }
  if(p.assets.owned.filter(o=>!uidSet.has(o.uid)).length>8)return reply(res,409,{error:'벤치가 가득 찼어.'});
  for(const o of p.assets.owned){o.location='bench';o.x=null;o.y=null}
  for(const {mine,x,y} of updates){mine.location='board';mine.x=x;mine.y=y}
  p.team=economy.ownTeam(p.assets);p.mastery=p.assets.level;p.roundReady=false;refreshEarlyFinish(r);
  broadcast(r);return reply(res,200,{ok:true});
 }
 if(url.pathname==='/api/team'){const rows=body.team;if(!Array.isArray(rows)||rows.length>3)return reply(res,400,{error:'배치 최대 3명'});const used=new Set();for(const u of rows){if(typeof u.characterId!=='string'||!/^[a-z-]{1,32}$/.test(u.characterId)||!Number.isInteger(u.x)||u.x<0||u.x>2||!Number.isInteger(u.y)||u.y<0||u.y>2||!Number.isInteger(u.star)||u.star<1||u.star>3)return reply(res,400,{error:'잘못된 배치'});const key=`${u.x},${u.y}`;if(used.has(key))return reply(res,400,{error:'중복 배치'});used.add(key);if(u.items!==undefined&&(!Array.isArray(u.items)||u.items.length>3))return reply(res,400,{error:'장비 초과'})}if(r.game&&r.game.phase!=='prep')return reply(res,409,{error:'준비 시간에만 배치 변경 가능'});if(r.game&&r.game.hp[p.slot]<=0)return reply(res,409,{error:'탈락자는 배치할 수 없어.'});p.team=rows.map(({characterId,x,y,star,items})=>({characterId,x,y,star,items:Array.isArray(items)?items.slice(0,3):[]}));p.mastery=Number.isInteger(body.mastery)?Math.min(20,Math.max(1,body.mastery)):1;p.ready=false;if(r.game?.phase==='prep'){p.roundReady=false;refreshEarlyFinish(r)}broadcast(r);return reply(res,200,{ok:true})}
return reply(res,404,{error:'요청 없음'});
}
function join(r,res,body){const slot=Array.from({length:r.maxPlayers},(_,i)=>i).find(i=>![...r.players.values()].some(p=>p.slot===i));const username=authAccount({headers:{'x-live-session':body.session}},body);const p={id:id(),token:id(),room:r.code,username,name:nickOf(username),slot,ready:false,connected:false,team:[],progress:{exploration:{visited:[],stacks:0},infiltration:0,infiltrationRewards:0,bloodMoonGranted:false}};r.players.set(p.id,p);r.messages.push({system:true,text:`${p.name} 입장`,at:Date.now()});broadcast(r);reply(res,200,{token:p.token,playerId:p.id,room:playerView(r,p)})}

// Early transition only when EVERY connected participant has completed this phase.
// The 60s deadline stays authoritative; a five-second early countdown never extends it.
function refreshEarlyFinish(r){
 const g=r.game;if(!g||!['prep','combat','supply'].includes(g.phase))return;
 const players=living(r);
 const eligible=players.length>=2&&players.every(p=>p.connected&&(g.phase==='prep'?p.roundReady:g.phase==='supply'?!!g.supplyResolved?.[p.slot]:(g.pve&&p.farmDone)));
 if(eligible){if(!g.earlyEndsAt)g.earlyEndsAt=Date.now()+(g.phase==='supply'?250:5000);}
 else g.earlyEndsAt=null;
}
// Room-authoritative, variable-population match loop. A PvP phase pairs every living player;
// one unmatched player receives a bye (no health loss).
function finishGameIfNeeded(r){const g=r.game,alive=living(r);if(alive.length>1)return false;g.phase='finished';g.endsAt=Date.now();g.earlyEndsAt=null;g.endReason='elimination';g.winnerSlot=alive[0]?.slot??null;g.version++;broadcast(r);return true}
function advanceRoom(r){
 const g=r.game;if(!g||g.phase==='finished'||Date.now()<Math.min(g.endsAt,g.earlyEndsAt||Infinity))return;
 if(g.phase==='prep'){
  const players=living(r).sort((a,b)=>a.slot-b.slot);
  if(finishGameIfNeeded(r))return;
  g.kind=roundKind(g.round,g.schedule);
  if(g.kind==='supply'){
   g.supplyOptions=Object.fromEntries(players.map(p=>[p.slot,drawSupplyChoices()]));g.supplyResolved={};g.phase='supply';g.earlyEndsAt=null;g.endsAt=Date.now()+30000;g.version++;broadcast(r);return;
  }
  if(!['farm','pvp'].includes(g.kind)){
   // Stage 1: explicit integration boundary. Later patches implement server-validated
   // trades, bids, boss combat, minigames and draft before currency is credited.
   g.phase='special';g.specialType=g.kind;
   if(g.kind==='selection'){
    g.selection={candidates:makeCandidates(g.round,players.length),order:draftOrder(players,g.hp),wave:0,resolved:{}};
    g.earlyEndsAt=null;g.endsAt=Date.now()+8000;g.version++;broadcast(r);return;
   }
   if(g.kind==='experiment'){
    g.experimentId=['stack','zones','divide','bomb','quiz'][crypto.randomInt(5)];
    if(g.experimentId==='bomb'){
     const order=pairSurvivors(players,g.hp),teams=order.pairs.map(([a,b],i)=>({id:'B'+i,slots:[a.slot,b.slot],operator:a.slot,expert:b.slot,messages:[]}));
     // An unpaired survivor receives a bye. They never join a different team's private chat.
     g.bombBye=order.bye?.slot??null;g.bombTeams=teams;
    }
   }
   g.specialNotice='특수 라운드 서버 판정 연동 대기 · 이번 패치에서는 보상을 지급하지 않아.';
   g.earlyEndsAt=null;g.endsAt=Date.now()+(g.kind==='experiment'&&g.experimentId==='bomb'?60000:15000);g.version++;broadcast(r);return;
  }
  const missing=players.filter(player=>!Array.isArray(player.team)||!player.team.length);
  if(missing.length){g.earlyEndsAt=null;g.endsAt=Date.now()+10000;g.prepNotice='전투 대기 · '+missing.map(p=>p.name+' 편성 없음').join(', ');g.version++;broadcast(r);return}
  if(players.every(p=>p.assets)){
   g.phase='intro';g.introReady={};g.introStartedAt=Date.now();g.earlyEndsAt=null;
   g.endsAt=Date.now()+5000;g.version++;broadcast(r);return;
  }
 }
 if(g.phase==='intro'||(g.phase==='prep'&&living(r).some(p=>!p.assets))){
  const players=living(r).sort((a,b)=>a.slot-b.slot);
  g.introReady=null;g.introStartedAt=null;
  g.prepNotice=null;
  const pve=g.kind==='farm';g.region=pve?null:pickArenaRegion(r.code,g.round);
  for(const ply of players){
   const ids=new Set((ply.team||[]).map(e=>e.characterId));const affiliations=n=>[...ids].filter(id=>m7Roster[id]?.affiliations?.includes(n)).length;
   if(affiliations('에레보스')>=3&&!ply.progress.bloodMoonGranted){ply.progress.bloodMoonGranted=true;if(ply.assets)economy.giveItem(ply.assets,'혈색반월');}
   if(!pve&&g.region&&ids.has('silvia')&&!ply.progress.exploration.visited.includes(g.region)){ply.progress.exploration.visited.push(g.region);ply.progress.exploration.stacks=Math.min(10,ply.progress.exploration.stacks+1)}
  }
  g.pairs=[];g.farmResults=null;let duration=pve?60:3;
  if(pve){
   g.farmResults={};
   for(const ply of players){
    try{
     const seed=crypto.randomInt(1,2147483647);
     const result=new CombatEngine({teamA:ply.team,teamB:FARM_LINEUPS[g.round]||FARM_LINEUPS[3],masteryA:ply.mastery||1,masteryB:1,seed,moveInterval:.5,persistent:{A:ply.progress,B:{}}}).run();
     g.farmResults[ply.slot]={seed,time:result.time,killed:(result.units||[]).filter(u=>u.team==='B'&&u.dead&&m7Roster[u.characterId]?.pveOnly).length};
    }catch(e){console.warn('PvE server simulation failed',e);g.farmResults[ply.slot]={seed:0,time:60,killed:0};}
   }
  }
  if(!pve){
   g.byeCounts??={};g.lastOpponents??={};const {pairs,bye}=pairSurvivors(players,g.hp,Math.random,{byeCounts:g.byeCounts,previousByeSlot:g.previousByeSlot,lastOpponents:g.lastOpponents});
    g.byeSlot=bye?.slot??null;
   for(const [a,b] of pairs){
    const seed=crypto.randomInt(1,2147483647);let battle;
    try{const result=new CombatEngine({teamA:a.team,teamB:b.team,masteryA:a.mastery||1,masteryB:b.mastery||1,seed,moveInterval:.5,arenaRegion:g.region,persistent:{A:a.progress,B:b.progress}}).run();battle={outcome:result.outcome,time:result.time,personaTierA:result.synergies?.A?.affiliations?.['페르소나']?.tier||0,personaTierB:result.synergies?.B?.affiliations?.['페르소나']?.tier||0}}catch(e){battle={outcome:'무승부',time:0,error:String(e.message)}}
    if(battle.error||!Number.isFinite(battle.time)||battle.time<=0){g.endsAt=Date.now()+10000;g.prepNotice='전투 계산 재시도 대기 · 서버 전투 오류';g.earlyEndsAt=null;g.version++;console.warn('[M8-01] PvP invalid',{room:r.code,round:g.round,a:a.slot,b:b.slot,battle});broadcast(r);return}
    duration=Math.max(duration,Math.min(60,Math.ceil(battle.time)+2));g.pairs.push({a:a.slot,b:b.slot,seed,battle});
     g.lastOpponents[a.slot]=b.slot;g.lastOpponents[b.slot]=a.slot;
   }
  }
  if(!pve&&g.byeSlot!==null){g.byeCounts[g.byeSlot]=(g.byeCounts[g.byeSlot]||0)+1;g.previousByeSlot=g.byeSlot;}
   g.phase='combat';g.combatStartedAt=Date.now();g.pve=pve;g.battle=players.length===2?g.pairs[0]?.battle||null:null;g.seed=players.length===2?g.pairs[0]?.seed||0:0;g.earlyEndsAt=null;for(const member of players)member.farmDone=false;g.endsAt=Date.now()+duration*1000;g.version++;broadcast(r);return;
 }
 if(g.phase==='supply'){
  for(const p of living(r))if(!g.supplyResolved[p.slot]){g.supplyResolved[p.slot]=g.supplyOptions[p.slot][crypto.randomInt(3)];if(p.assets){economy.grant(p.assets,g.supplyResolved[p.slot],`r${g.round}:supply:${p.slot}`);p.team=economy.ownTeam(p.assets);p.mastery=p.assets.level;}}g.phase='result';g.earlyEndsAt=null;g.endsAt=Date.now()+4000;g.version++;broadcast(r);return;
 }
 if(g.phase==='special'){
  if(g.specialType==='selection'&&g.selection){
   const sel=g.selection,wave=sel.order.slice(sel.wave*2,sel.wave*2+2);
   for(const slot of wave)if(!sel.resolved[slot]){
    const remaining=sel.candidates.filter(c=>c.claimedBy===null);if(!remaining.length)throw Error('선점 후보 부족');
    const candidate=remaining[crypto.randomInt(remaining.length)];candidate.claimedBy=slot;sel.resolved[slot]={characterId:candidate.characterId,star:1,item:candidate.item};const who=[...r.players.values()].find(p=>p.slot===slot);if(who?.assets){economy.grant(who.assets,{type:'selection',...sel.resolved[slot]},`r${g.round}:selection:${slot}`);who.team=economy.ownTeam(who.assets);who.mastery=who.assets.level;}
   }
   sel.wave++;if(sel.wave*2<sel.order.length){g.endsAt=Date.now()+8000;g.version++;broadcast(r);return;}
  }
  g.phase='result';g.earlyEndsAt=null;g.endsAt=Date.now()+4000;g.version++;broadcast(r);return;
 }
 if(g.phase==='combat'){
  if(g.pve){
   for(const ply of living(r)){
    if(!ply.assets)continue;
    const n=Math.min(3,g.farmResults?.[ply.slot]?.killed||0);
    for(let i=0;i<n;i++){
     economy.grant(ply.assets,{type:'basic',value:crypto.randomInt(7)},`r${g.round}:farm:${ply.slot}:${i}:base`);
     if(crypto.randomInt(100)<5)economy.grant(ply.assets,{type:'basic',value:crypto.randomInt(7)},`r${g.round}:farm:${ply.slot}:${i}:bonus`);
    }
   }
  }
  for(const ply of living(r)){const ids=new Set((ply.team||[]).map(e=>e.characterId));const count=[...ids].filter(id=>m7Roster[id]?.affiliations?.includes('에레보스')).length;ply.progress.infiltration+=count;while(ply.progress.infiltration>=5){ply.progress.infiltration-=5;ply.progress.infiltrationRewards++;if(ply.assets)economy.grant(ply.assets,{type:'basic',value:crypto.randomInt(7)},`infiltration:${ply.slot}:${ply.progress.infiltrationRewards}`)}}
  if(!g.pve){
   const damage=Math.min(25,5+Math.floor((g.round-1)/3)*2);
   for(const pair of g.pairs||[]){const outcome=pair.battle.outcome;
    if(outcome==='A팀 승리')g.hp[pair.b]=Math.max(0,g.hp[pair.b]-damage-(pair.battle.personaTierA>=3?2:pair.battle.personaTierA>=2?1:0));
    if(outcome==='B팀 승리')g.hp[pair.a]=Math.max(0,g.hp[pair.a]-damage-(pair.battle.personaTierB>=3?2:pair.battle.personaTierB>=2?1:0));
   }
  }
  g.phase='result';g.earlyEndsAt=null;g.endsAt=Date.now()+4000;g.version++;broadcast(r);return;
 }
 if(g.phase==='result'){
  if(finishGameIfNeeded(r))return;
  g.round++;for(const player of living(r))if(player.assets){economy.roundIncome(player.assets,g.round);player.mastery=player.assets.level;player.team=economy.ownTeam(player.assets)}g.kind=roundKind(g.round,g.schedule);g.phase='prep';g.endsAt=Date.now()+60000;g.battle=null;g.pairs=[];g.seed=0;g.pve=false;g.region=null;g.earlyEndsAt=null;g.specialType=null;g.specialNotice=null;g.introReady=null;g.introStartedAt=null;g.experimentId=null;g.bombTeams=null;g.bombBye=null;g.supplyOptions=null;g.supplyResolved=null;g.farmResults=null;g.selection=null;for(const member of r.players.values()){member.roundReady=false;member.farmDone=false}
  g.version++;broadcast(r);
 }
}
const gameClock=setInterval(()=>{for(const r of rooms.values())try{
 if(r.started&&r.game?.phase!=='finished'){
  for(const p of r.players.values())if(r.game.hp[p.slot]>0&&!p.connected&&p.disconnectedAt&&Date.now()-p.disconnectedAt>15000){r.game.hp[p.slot]=0;r.messages.push({system:true,text:`${p.name} 연결 종료 · 탈락`,at:Date.now()});r.game.version++;broadcast(r)}
  if(!finishGameIfNeeded(r))advanceRoom(r);
 }
}catch(e){console.error('room timer:',e)}},250);
const server=http.createServer(async(req,res)=>{const u=new URL(req.url,'http://localhost');if(u.pathname==='/api/events'&&req.method==='GET'){const auth=getPlayer(req,{token:u.searchParams.get('token')});if(!auth)return reply(res,401,{error:'인증 실패'});const {p,r}=auth;const previous=clients.get(p.id);if(previous&&!previous.destroyed)previous.end();res.writeHead(200,{'content-type':'text/event-stream; charset=utf-8','cache-control':'no-cache, no-transform','connection':'keep-alive','x-accel-buffering':'no'});clients.set(p.id,res);p.connected=true;p.disconnectedAt=null;broadcast(r);const heartbeat=setInterval(()=>{if(!res.destroyed)res.write(': heartbeat\n\n')},18000);req.on('close',()=>{clearInterval(heartbeat);if(clients.get(p.id)===res){clients.delete(p.id);p.connected=false;p.disconnectedAt=Date.now();refreshEarlyFinish(r);broadcast(r)}});return}
if(u.pathname==='/health')return reply(res,200,{ok:true,durableAccounts:durable});
if(u.pathname.startsWith('/api/')){if(req.method!=='POST')return reply(res,405,{error:'POST 요청 필요'});try{return await handleAction(req,res,await readBody(req))}catch(e){if(!res.destroyed)reply(res,400,{error:e.message})}return}
if(req.method!=='GET'&&req.method!=='HEAD')return reply(res,405,{error:'Method not allowed'});let pathname;try{pathname=decodeURIComponent(u.pathname)}catch{return res.writeHead(400).end()};if(pathname==='/'||pathname==='')pathname='/index.html';const file=path.resolve(root,'.'+pathname);if(pathname.includes('/.') || !(file===root||file.startsWith(root+path.sep))||file.endsWith('.cjs')||file.endsWith('.md')||file.endsWith('.json')||file.includes('/tests/')||file.includes('node_modules'))return res.writeHead(403).end();fs.stat(file,(err,stat)=>{if(err||!stat.isFile())return res.writeHead(404).end();res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream','cache-control':'no-cache'});if(req.method==='HEAD')return res.end();fs.createReadStream(file).pipe(res)})});
loadAccounts().then(()=>server.listen(PORT,'0.0.0.0',()=>console.log(`L.I.V.E. 멀티 서버: http://localhost:${PORT}`))).catch(e=>{console.error('Persistent account load failed, refusing startup:',e);process.exitCode=1});
module.exports={server,rooms,drawSupplyReward,drawSupplyChoices,SUPPLY_ODDS,advanceRoom,playerView};
