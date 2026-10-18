'use strict';
// M8-01: account -> 2~8 player room -> server-controlled combat round and special scheduling.
(()=>{
  // QA 전투 / 로컬 라운드 테스트는 계정·방 API와 완전히 분리된다.
  if(['combat','round'].includes(new URLSearchParams(location.search).get('qa')))return;
  let lastFarmReportRound=0;
  let session=sessionStorage.getItem('live_session')||'',username='',nickname='',token='',playerId='',room=null,events=null,poller=null,lastTeam='',openedGame=false,clock=null,lastGameVersion=0;
  const $=s=>document.querySelector(s), safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  document.body.classList.add('live-gated');
  const gate=document.createElement('section');gate.id='liveGate';gate.innerHTML=`<div class="live-gate-card">
   <div class="live-eyebrow">AGLAIA // L.I.V.E.</div><h1>LIVE</h1><p class="live-sub">Lumia Island Virtual Experiment</p>
   <div id="liveAuth"><h2 id="authTitle">로그인</h2><input id="authId" autocomplete="username" placeholder="아이디 (영문·숫자 3~20자)" maxlength="20"><input id="authPw" type="password" autocomplete="current-password" placeholder="비밀번호 (8자 이상)"><div id="registerFields" hidden><input id="authNickname" placeholder="닉네임 (2~16자)" maxlength="16"></div><div class="live-line"><button id="authLogin" class="live-primary">로그인</button><button id="authRegister">회원가입 화면</button><button id="authBack" hidden>로그인으로</button></div><small>계정은 현재 실행 중인 서버에 저장돼. 공개 인터넷 배포용 인증 시스템은 아니야.</small></div>
   <div id="liveRooms" hidden><div class="live-line"><b id="liveAccount"></b><button id="liveLogout">로그아웃</button></div><div class="live-line"><input id="liveNickname" maxlength="16" placeholder="닉네임 변경 (2~16자)"><button id="liveNicknameSave">변경</button></div><h2>멀티플레이 로비</h2><label class="live-room-count">경기 인원 <select id="liveMaxPlayers" aria-label="최대 경기 인원"><option value="2" selected>2명</option><option value="3">3명</option><option value="4">4명</option><option value="5">5명</option><option value="6">6명</option><option value="7">7명</option><option value="8">8명</option></select></label><button class="live-primary" id="liveCreate">새 방 만들기</button><div class="live-line"><input id="liveCode" maxlength="6" placeholder="6자리 방 코드"><button id="liveJoin">방 참가</button></div></div>
   <div id="liveWaiting" hidden><div class="live-line"><h2 id="liveRoomName"></h2><button id="liveLeave">퇴장</button></div><p id="liveMemberList"></p><div class="live-line"><button id="liveReady" class="live-primary">준비하기</button><button id="liveStart" hidden>게임 시작 (방장)</button></div><p class="live-help">전원 준비 후 방장이 시작하면 게임 화면으로 이동해.</p></div>
   <div class="live-qa-link" style="margin-top:18px;padding-top:14px;border-top:1px solid rgba(151,183,177,.2)"><a href="/qa.html" style="display:block;text-align:center;color:#9fdfc9;text-decoration:none;font-weight:700;font-size:.85rem;letter-spacing:.05em">◇ 오프라인 QA LAB · 전투 / 미니게임 시험 →</a><small style="display:block;text-align:center;margin-top:7px;opacity:.55">로그인 없이 실행 · 실제 계정·게임 결과와 분리</small></div>
   <p id="liveNotice" role="status">로그인 후 방을 생성하거나 참가해.</p></div>`;document.body.appendChild(gate);
  const dock=document.createElement('aside');dock.id='liveGameChat';dock.hidden=true;dock.innerHTML=`<div class="live-chat-head" data-drag-handle><b>LIVE · ROOM <span id="liveGameCode"></span></b><span id="liveGameMembers"></span><button type="button" class="live-chat-toggle" aria-label="채팅 접기">−</button></div><div class="live-chat-body"><div id="liveMessages" class="live-chat-log"></div><div class="live-chat-send"><input id="liveChatInput" maxlength="240" placeholder="채팅 입력"><button id="liveSend">전송</button></div></div>`;document.body.appendChild(dock);
  const teamDock=document.createElement('aside');teamDock.id='liveTeamChat';teamDock.hidden=true;teamDock.innerHTML=`<div class="live-chat-head" data-drag-handle><b>AGLAIA · 폭발물 해체 전용 채팅</b><button type="button" class="live-chat-toggle" aria-label="채팅 접기">−</button></div><div class="live-chat-body"><div id="liveTeamMessages" class="live-chat-log"></div><div class="live-chat-send"><input id="liveTeamChatInput" maxlength="240" placeholder="조원에게만 전송"><button id="liveTeamSend">전송</button></div></div>`;document.body.appendChild(teamDock);
  function makeMovable(panel){
    let drag=null;const head=panel.querySelector('[data-drag-handle]');
    head.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('button'))return;const r=panel.getBoundingClientRect();drag={x:e.clientX-r.left,y:e.clientY-r.top};head.setPointerCapture?.(e.pointerId);e.preventDefault()});
    head.addEventListener('pointermove',e=>{if(!drag)return;panel.style.left=Math.max(0,Math.min(window.innerWidth-70,e.clientX-drag.x))+'px';panel.style.top=Math.max(0,Math.min(window.innerHeight-50,e.clientY-drag.y))+'px';panel.style.right='auto';panel.style.bottom='auto'});
    for(const evt of ['pointerup','pointercancel','lostpointercapture'])head.addEventListener(evt,()=>drag=null);
    panel.querySelector('.live-chat-toggle').addEventListener('click',()=>{const collapsed=panel.classList.toggle('live-chat-collapsed');panel.querySelector('.live-chat-toggle').textContent=collapsed?'+':'−'});
  }
  makeMovable(dock);makeMovable(teamDock);
  function drawTeamChat(){const g=room?.game,active=g?.phase==='special'&&g.specialType==='experiment'&&g.experimentId==='bomb'&&!!g.bombTeamId;teamDock.hidden=!active;if(!active)return;$('#liveTeamMessages').innerHTML=(g.teamMessages||[]).map(m=>`<div><b>${safe(m.name)}</b>: ${safe(m.text)}</div>`).join('');$('#liveTeamMessages').scrollTop=$('#liveTeamMessages').scrollHeight}

  const notice=t=>{$('#liveNotice').textContent=t};
  const battlePanel=document.createElement('aside');battlePanel.id='liveCombatLogPanel';battlePanel.hidden=true;battlePanel.innerHTML='<div class="live-combat-head">전투 로그 <button type="button" id="liveClearCombat">지우기</button></div><div id="liveCombatLines" role="log" aria-live="off"></div>';document.body.appendChild(battlePanel);
  // Keep only events confidently attributed to a friendly unit.
  // If names overlap between teams, omit ambiguous character logs rather than leak enemy events.
  function ownBattleLogLine(raw){
   if(typeof units==='undefined'||!Array.isArray(units))return false;
   const strip=s=>String(s).replace(/<[^>]*>/g,'').replace(/^\[\d+(?:\.\d+)?\]\s*/, '');
   const txt=strip(raw);
   if(/(?:A팀|B팀)\s*(?:시너지|·)/.test(txt))return /A팀\s*(?:시너지|·)/.test(txt);
   if(/^(?:A팀 승리|B팀 승리|무승부)/.test(txt))return false; // server supplies the result
   const own=new Set(units.filter(u=>u.team==='A').map(u=>u.name));
   const enemy=new Set(units.filter(u=>u.team==='B').map(u=>u.name));
   const names=[...new Set([...own,...enemy])].sort((a,b)=>b.length-a.length);
   const hit=names.find(n=>txt.includes(n));
   if(!hit||!own.has(hit)||enemy.has(hit))return false;
   // Suppress minor periodic buffs/ticks. Keep major combat events only.
   if(!/(스킬|처치|부활|소환|시너지|행동 불능|생명 공유|무적|처형|기절|수면|Peacemaker|정신 집중)/.test(txt))return false;
   return true;
  }
  let lastLogMarker='';function addCombatLine(message){const el=document.createElement('div');el.textContent=message;$('#liveCombatLines').prepend(el);while($('#liveCombatLines').children.length>48)$('#liveCombatLines').lastElementChild.remove()}
  $('#liveClearCombat').onclick=()=>$('#liveCombatLines').replaceChildren();
  const legacyLog=document.querySelector('#log');if(legacyLog){let lastLines=new Set();new MutationObserver(()=>{const lines=[...legacyLog.children].slice(0,20);for(const el of lines.reverse()){const line=el.textContent.trim();if(line&&!lastLines.has(line)&&ownBattleLogLine(line))addCombatLine(line)}lastLines=new Set([...legacyLog.children].slice(0,80).map(x=>x.textContent.trim()))}).observe(legacyLog,{childList:true,subtree:false})}

  // The end overlay uses the server's final result, not independently simulated HP.
  const endScreen=document.createElement('section');endScreen.id='liveMatchEnd';endScreen.hidden=true;
  endScreen.innerHTML='<div class="live-end-card"><small>AGLAIA // MATCH COMPLETE</small><h2 id="liveEndTitle"></h2><p id="liveEndText"></p><button id="liveEndLeave" class="live-primary">로비로 돌아가기</button></div>';
  document.body.appendChild(endScreen);
  $('#liveEndLeave').onclick=async()=>{
   await api('leave').catch(()=>{});disconnect();openedGame=false;
   endScreen.hidden=true;document.body.classList.add('live-gated');gate.hidden=false;
   display('rooms');notice('게임이 종료됐어. 새 방을 만들거나 참가할 수 있어.');
  };
  function showMatchEnd(g){
   if(!g||g.phase!=='finished'||!openedGame){endScreen.hidden=true;return;}
   const slot=room?.players.find(p=>p.id===playerId)?.slot;
   const winner=Number.isInteger(g.winnerSlot)?g.winnerSlot:null;
   const draw=winner===null;
   $('#liveEndTitle').textContent=draw?'무승부':winner===slot?'승리':'패배';
   $('#liveEndText').textContent=g.endReason==='opponent_left'?'상대 플레이어가 나가 게임이 종료되었습니다.':draw?'생존자가 없어 무승부로 종료됐어.':winner===slot?'마지막까지 살아남았어!':'상대 플레이어가 최후의 생존자야.';
   endScreen.hidden=false;
  }
  function observeCombat(g){if(!openedGame||!g)return;const marker=g.round+':'+g.phase+':'+g.version;if(marker===lastLogMarker)return;lastLogMarker=marker;const label=g.phase==='combat'?(g.pve?'야생동물 파밍 시작':g.bye?'부전승 · 전투 없음':'플레이어 대전 시작'):g.phase==='special'?'특수 라운드 · '+({shop:'상점',auction:'경매',boss:'보스',experiment:'번외 실험',selection:'선점'}[g.specialType]||g.specialType):g.phase==='supply'?'보급 선택':g.phase==='prep'?'준비 단계':g.phase==='result'?'라운드 종료':g.phase==='finished'?'게임 종료':g.phase;addCombatLine('R'+g.round+' · '+label);if(g.phase==='result'&&g.battle?.outcome){
   const slot=room?.players.find(p=>p.id===playerId)?.slot||0;
   const ownWin='A팀 승리';
   addCombatLine('결과: '+(g.battle.outcome==='무승부'?'무승부':g.battle.outcome===ownWin?'승리':'패배'));
  }}

  let registering=false;function authMode(isRegister){registering=isRegister;$('#authTitle').textContent=isRegister?'회원가입':'로그인';$('#registerFields').hidden=!isRegister;$('#authLogin').hidden=isRegister;$('#authRegister').textContent=isRegister?'계정 만들기':'회원가입 화면';$('#authBack').hidden=!isRegister;$('#authPw').autocomplete=isRegister?'new-password':'current-password'}
  async function api(action,data={}){const res=await fetch('/api/'+action,{method:'POST',headers:{'content-type':'application/json','x-live-token':token,'x-live-session':session},body:JSON.stringify({...data,session})});const obj=await res.json();if(!res.ok)throw Error(obj.error||'요청 실패');return obj}
  const display=(part)=>{ $('#liveAuth').hidden=part!=='auth';$('#liveRooms').hidden=part!=='rooms';$('#liveWaiting').hidden=part!=='waiting'; };
  function setIdentity(j){username=j.username;nickname=j.nickname||j.username;$('#liveAccount').textContent=nickname;$('#liveNickname').value=nickname;}
  function showRoom(){if(!room)return;display('waiting');$('#liveRoomName').textContent='ROOM '+room.code+' · '+room.players.length+'/'+room.maxPlayers+'명';const own=room.players.find(p=>p.id===playerId);$('#liveMemberList').innerHTML=room.players.map(p=>`<div class="live-member"><b>${safe(p.name)}</b><span>${p.connected?'● 접속':'○ 연결 중'} · ${p.ready?'준비 완료':'대기'}</span></div>`).join('');$('#liveReady').textContent=own?.ready?'준비 취소':'준비하기';const ready=room.players.length>=2&&room.players.every(p=>p.ready&&p.connected);$('#liveStart').hidden=own?.slot!==0;$('#liveStart').disabled=!ready;notice(ready?'모두 준비 완료! 방장이 게임을 시작할 수 있어.':'참가자 모두 준비해야 시작할 수 있어.');if(room.started)openGame();}
  function drawChat(){if(!room)return;$('#liveGameCode').textContent=room.code;$('#liveGameMembers').textContent=room.players.length+'/'+room.maxPlayers;$('#liveMessages').innerHTML=room.messages.map(m=>`<div>${m.system?'<i>시스템</i>':`<b>${safe(m.name)}</b>`}: ${safe(m.text)}</div>`).join('');$('#liveMessages').scrollTop=$('#liveMessages').scrollHeight;}
  function openGame(){if(openedGame)return;openedGame=true;document.body.classList.remove('live-gated');gate.hidden=true;dock.hidden=false;battlePanel.hidden=false;drawTeamChat();$('#devExit')?.setAttribute('hidden','');if(typeof enterAppMode==='function')enterAppMode('game');$('#devExit')?.setAttribute('hidden','');drawChat();lastTeam='';poller=setInterval(pushTeam,700);clock=setInterval(()=>{if(room?.game&&typeof window.LIVEApplyGame==='function')window.LIVEApplyGame(room.game,room.players.find(p=>p.id===playerId)?.slot||0,room.players);},250);pushTeam();}
  async function pushTeam(){if(!token||!room||!openedGame||room.game?.hp?.[room.players.find(p=>p.id===playerId)?.slot]<=0||typeof teams==='undefined'||!Array.isArray(teams.A))return;const team=teams.A.slice(0,3).map(x=>({characterId:x.characterId,x:x.x,y:x.y,star:x.star,items:[...(gameState.owned.find(o=>o.uid===x.ownedId)?.equipment||[])]}));const str=JSON.stringify([team,gameState.masteryLevel]);if(str===lastTeam)return;lastTeam=str;try{await api('team',{team,mastery:gameState.masteryLevel})}catch(e){lastTeam='';console.warn('배치 공유 실패',e)}}
  function disconnect(){endScreen.hidden=true;dock.hidden=true;teamDock.hidden=true;battlePanel.hidden=true;if(poller)clearInterval(poller);if(clock)clearInterval(clock);clock=null;poller=null;events?.close();events=null;token='';playerId='';room=null;lastTeam='';}
  async function join(action,payload){try{const j=await api(action,payload);token=j.token;playerId=j.playerId;room=j.room;history.replaceState(null,'',location.pathname+'?room='+room.code);showRoom();events=new EventSource('/api/events?token='+encodeURIComponent(token));events.addEventListener('state',e=>{room=JSON.parse(e.data);if(openedGame){drawChat();drawTeamChat();if(room.game&&typeof window.LIVEApplyGame==='function')window.LIVEApplyGame(room.game,room.players.find(p=>p.id===playerId)?.slot||0,room.players);observeCombat(room.game);showMatchEnd(room.game)}else showRoom()});events.onerror=()=>notice('서버 연결 재시도 중…');}catch(e){notice(e.message)}}
  async function logIn(action){try{const j=await api(action,{username:$('#authId').value,password:$('#authPw').value,...(action==='register'?{nickname:$('#authNickname').value}:{})});session=j.session;setIdentity(j);sessionStorage.setItem('live_session',session);display('rooms');notice(action==='register'?'회원가입 및 로그인 완료!':'로그인 완료!')}catch(e){notice(e.message)}}
  $('#liveNicknameSave').onclick=async()=>{try{const j=await api('nickname',{nickname:$('#liveNickname').value});nickname=j.nickname;$('#liveAccount').textContent=nickname;notice('닉네임을 변경했어.')}catch(e){notice(e.message)}};
  $('#authLogin').onclick=()=>logIn('login');$('#authRegister').onclick=()=>registering?logIn('register'):authMode(true);$('#authBack').onclick=()=>authMode(false);$('#authPw').addEventListener('keydown',e=>{if(e.key==='Enter')$('#authLogin').click()});
  $('#liveLogout').onclick=async()=>{await api('logout').catch(()=>{});session='';username='';sessionStorage.removeItem('live_session');display('auth');notice('로그아웃했어.')};
  $('#liveCreate').onclick=()=>join('create',{maxPlayers:Number($('#liveMaxPlayers').value)});$('#liveJoin').onclick=()=>join('join',{code:$('#liveCode').value});
  $('#liveReady').onclick=async()=>{try{const own=room.players.find(p=>p.id===playerId);await api('ready',{ready:!own?.ready})}catch(e){notice(e.message)}};
  $('#liveStart').onclick=async()=>{try{await api('start')}catch(e){notice(e.message)}};
  $('#liveLeave').onclick=async()=>{await api('leave').catch(()=>{});disconnect();display('rooms');notice('방에서 퇴장했어.')};
  $('#liveTeamSend').onclick=async()=>{const text=$('#liveTeamChatInput').value.trim();if(!text)return;try{await api('team-chat',{text});$('#liveTeamChatInput').value=''}catch(e){notice(e.message)}};$('#liveTeamChatInput').addEventListener('keydown',e=>{if(e.key==='Enter')$('#liveTeamSend').click()});
  $('#liveSend').onclick=async()=>{const text=$('#liveChatInput').value.trim();if(!text)return;try{await api('chat',{text});$('#liveChatInput').value=''}catch(e){console.warn(e.message)}};$('#liveChatInput').addEventListener('keydown',e=>{if(e.key==='Enter')$('#liveSend').click()});
  const code=new URLSearchParams(location.search).get('room');if(code)$('#liveCode').value=code.toUpperCase();
  if(session)api('me').then(j=>{setIdentity(j);display('rooms')}).catch(()=>{session='';sessionStorage.removeItem('live_session');display('auth')});else display('auth');
  window.LIVEMultiplayer={getRoom:()=>room,getPlayerId:()=>playerId,getToken:()=>token, setRoundReady:async ready=>api('round-ready',{ready}), reportFarmDone:async round=>{if(lastFarmReportRound===round)return;lastFarmReportRound=round;try{await api('farm-done',{round})}catch(e){lastFarmReportRound=0;console.warn('파밍 완료 보고 실패:',e)}}};
})();
