'use strict';
// M8-01: account -> 2~8 player room -> server-controlled combat round and special scheduling.
(()=>{
  // QA 전투 / 로컬 라운드 테스트는 계정·방 API와 완전히 분리된다.
  if(['combat','round'].includes(new URLSearchParams(location.search).get('qa')))return;
  // Lobby styles are bundled into css/lobby.css and loaded by index.html.
  let lastFarmReportRound=0,roomTab='create',roomFilter='all',roomDirectory=[],pendingPrivateRoom=null;
  let session=sessionStorage.getItem('live_session')||'',username='',nickname='',token='',playerId='',room=null,events=null,poller=null,lastTeam='',openedGame=false,clock=null,lastGameVersion=0;
  const $=s=>document.querySelector(s), safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  document.body.classList.add('live-gated');
  const gate=document.createElement('section');gate.id='liveGate';gate.innerHTML=`<div class="live-gate-card">
   <div class="live-eyebrow">AGLAIA // L.I.V.E.</div><h1>LIVE</h1><p class="live-sub">Lumia Island Virtual Experiment</p>
   <div id="liveAuth" class="m1009-panel" aria-label="계정 인증">
    <div class="m1009-section-head"><span>ACCOUNT ACCESS</span><h2 id="authTitle">로그인</h2><p>계정으로 접속하면 현재 참가 중인 경기도 이어서 진행할 수 있습니다.</p></div>
    <label class="m1009-field">아이디<input id="authId" autocomplete="username" placeholder="아이디 3자 이상" maxlength="20"></label>
    <label class="m1009-field">비밀번호<input id="authPw" type="password" autocomplete="current-password" placeholder="비밀번호 8자 이상"></label>
    <div id="registerFields" hidden><label class="m1009-field">닉네임<input id="authNickname" placeholder="사용할 닉네임 (2~16자)" maxlength="16"></label></div>
    <div class="m1009-auth-actions"><button id="authLogin" class="live-primary">로그인</button><button id="authRegister" type="button">회원가입 화면</button><button id="authBack" type="button" hidden>로그인으로 돌아가기</button></div>
    <small class="m1009-fineprint">계정 데이터는 현재 연결된 서버에 저장됩니다.</small>
   </div>
   <div id="liveRooms" class="m1009-panel" hidden>
    <div class="m1009-account-row"><span><small>CONNECTED ACCOUNT</small><b id="liveAccount"></b></span><button id="liveLogout" type="button">로그아웃</button></div>
    <div class="m1009-nickname-row"><input id="liveNickname" maxlength="16" placeholder="닉네임 변경 (2~16자)" aria-label="닉네임 변경"><button id="liveNicknameSave">변경</button></div>
    <div class="m1009-section-head"><span>MATCH LOBBY / ONLINE</span><h2>멀티플레이 로비</h2><p>새로운 대기실을 만들거나 진행 전인 방을 찾아 입장할 수 있습니다.</p></div>
    <div class="m1009-tabs" role="tablist" aria-label="로비 메뉴">
      <button type="button" id="m1009TabCreate" role="tab" aria-selected="true" aria-controls="m1009CreatePanel">방 만들기</button>
      <button type="button" id="m1009TabBrowse" role="tab" aria-selected="false" aria-controls="m1009BrowsePanel">방 찾기</button>
    </div>
    <section id="m1009CreatePanel" role="tabpanel" aria-labelledby="m1009TabCreate">
      <div class="m1009-field-grid"><label class="m1009-field">방 제목<input id="liveRoomTitle" maxlength="32" placeholder="방 제목 (최대 32자)"></label>
      <label class="m1009-field">최대 참가 인원<select id="liveMaxPlayers" aria-label="최대 경기 인원"><option value="2" selected>2명</option><option value="3">3명</option><option value="4">4명</option><option value="5">5명</option><option value="6">6명</option><option value="7">7명</option><option value="8">8명</option></select></label></div>
      <label class="m1009-field">방 공개 방식<select id="liveRoomAccess"><option value="public">공개 방 · 비밀번호 없이 입장</option><option value="private">비밀번호 방 · 비밀번호를 알아야 입장</option></select></label>
      <label class="m1009-field" id="livePrivateCreateFields" hidden>방 비밀번호<input id="liveRoomPassword" type="password" autocomplete="new-password" minlength="4" maxlength="12" placeholder="비밀번호 4~12자"></label>
      <p class="m1009-hint">비밀번호 방은 방 찾기에 잠금 표시로 나타나며, 입장하려면 비밀번호가 필요합니다.</p>
      <button class="live-primary m1009-full-action" id="liveCreate">대기실 만들기</button>
    </section>
    <section id="m1009BrowsePanel" role="tabpanel" aria-labelledby="m1009TabBrowse" hidden>
      <div class="m910-room-browser"><div class="m910-room-browser-head"><b>참가 가능한 대기실</b><button id="liveRoomRefresh" type="button">새로고침 ↻</button></div>
      <div class="m1009-browse-filters" role="group" aria-label="방 필터"><button type="button" data-m1009-filter="all" aria-pressed="true">전체</button><button type="button" data-m1009-filter="public" aria-pressed="false">공개</button><button type="button" data-m1009-filter="private" aria-pressed="false">비밀번호</button></div>
      <div id="livePublicRooms" class="m910-room-results" role="list" aria-live="polite">방 목록을 확인하는 중입니다.</div></div>
    </section>
   </div>
   <div id="liveWaiting" class="m1009-panel" hidden><div class="live-line"><h2 id="liveRoomName"></h2><button id="liveLeave">퇴장</button></div><div class="m1009-room-state" id="m1009RoomAccessState"></div><p id="liveMemberList"></p><div class="live-line"><button id="liveReady" class="live-primary">준비하기</button><button id="liveStart" hidden>게임 시작 (방장)</button></div><p class="live-help">전원 준비 후 방장이 시작하면 게임 화면으로 이동합니다.</p></div>
   <div id="m1009PasswordDialog" class="m1009-password-mask" hidden><div class="m1009-password-card" role="dialog" aria-modal="true" aria-labelledby="m1009PasswordTitle"><span class="m1009-kicker">PRIVATE MATCH</span><h2 id="m1009PasswordTitle">비밀번호 방 입장</h2><p id="m1009PasswordRoomName"></p><label class="m1009-field">방 비밀번호<input id="m1009JoinPassword" type="password" autocomplete="off" minlength="4" maxlength="12" placeholder="비밀번호 4~12자"></label><p id="m1009PasswordError" class="m1009-dialog-error" role="alert" hidden></p><div class="live-line"><button id="m1009CancelPassword" type="button">취소</button><button id="m1009ConfirmPassword" type="button" class="live-primary">입장하기</button></div></div></div>
   <div class="live-qa-link" style="margin-top:18px;padding-top:14px;border-top:1px solid rgba(151,183,177,.2)"><a href="/qa.html" style="display:block;text-align:center;color:#9fdfc9;text-decoration:none;font-weight:700;font-size:.85rem;letter-spacing:.05em">◇ 오프라인 QA LAB · 전투 / 미니게임 시험 →</a><small style="display:block;text-align:center;margin-top:7px;opacity:.55">로그인 없이 실행 · 실제 계정·게임 결과와 분리</small></div>
   <p id="liveNotice" role="status"></p></div>`;document.body.appendChild(gate);
  const dock=document.createElement('aside');dock.id='liveGameChat';dock.hidden=true;dock.innerHTML=`<div class="live-chat-head" data-drag-handle><b>채팅</b><span id="liveGameMembers"></span><button type="button" class="live-chat-toggle" aria-label="채팅 접기">−</button></div><div class="live-chat-body"><div id="liveMessages" class="live-chat-log"></div><div class="live-chat-send"><input id="liveChatInput" maxlength="240" placeholder="채팅 입력"><button id="liveSend">전송</button></div></div>`;document.body.appendChild(dock);
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
  // The end overlay uses the server's final result, not independently simulated HP.
  const endScreen=document.createElement('section');endScreen.id='liveMatchEnd';endScreen.hidden=true;
  endScreen.innerHTML='<div class="live-end-card"><small>AGLAIA // MATCH COMPLETE</small><h2 id="liveEndTitle"></h2><p id="liveEndText"></p><button id="liveEndLeave" class="live-primary">로비로 돌아가기</button></div>';
  document.body.appendChild(endScreen);
  $('#liveEndLeave').onclick=async()=>{
   await api('leave').catch(()=>{});disconnect();openedGame=false;
   if(typeof returnToModeStart==='function')returnToModeStart();
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
  let registering=false;function authMode(isRegister){registering=isRegister;$('#authTitle').textContent=isRegister?'회원가입':'로그인';$('#registerFields').hidden=!isRegister;$('#authLogin').hidden=isRegister;$('#authRegister').textContent=isRegister?'계정 만들기':'회원가입 화면';$('#authBack').hidden=!isRegister;$('#authPw').autocomplete=isRegister?'new-password':'current-password'}
  async function api(action,data={}){const res=await fetch('/api/'+action,{method:'POST',headers:{'content-type':'application/json','x-live-token':token,'x-live-session':session},body:JSON.stringify({...data,session})});const obj=await res.json();if(!res.ok)throw Error(obj.error||'요청 실패');return obj}
  const display=(part)=>{
   gate.dataset.screen=part;$('#liveAuth').hidden=part!=='auth';$('#liveRooms').hidden=part!=='rooms';$('#liveWaiting').hidden=part!=='waiting';
   if(part==='rooms')showRoomTab(roomTab);else closePrivateJoin();
  };
  function showRoomTab(tab){
   roomTab=tab==='browse'?'browse':'create';
   for(const key of ['create','browse']){
    const active=roomTab===key,btn=$('#m1009Tab'+(key==='create'?'Create':'Browse'));
    btn.setAttribute('aria-selected',String(active));$('#m1009'+(key==='create'?'Create':'Browse')+'Panel').hidden=!active;
   }
   if(roomTab==='browse'&&session&&!$('#liveRooms').hidden)refreshPublicRooms();
  }
  $('#m1009TabCreate').addEventListener('click',()=>showRoomTab('create'));
  $('#m1009TabBrowse').addEventListener('click',()=>showRoomTab('browse'));
  function closePrivateJoin(){pendingPrivateRoom=null;$('#m1009PasswordDialog').hidden=true;$('#m1009JoinPassword').value='';$('#m1009PasswordError').hidden=true;$('#m1009PasswordError').textContent='';}
  $('#m1009CancelPassword').onclick=closePrivateJoin;
  $('#m1009PasswordDialog').addEventListener('click',e=>{if(e.target.id==='m1009PasswordDialog')closePrivateJoin()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#m1009PasswordDialog').hidden)closePrivateJoin()});
  function renderRoomDirectory(){
   const list=$('#livePublicRooms'),visible=roomDirectory.filter(r=>roomFilter==='all'||(roomFilter==='public'?r.isPublic:!r.isPublic));
   list.innerHTML=visible.length?visible.map(r=>`<article class="m910-room-result" role="listitem"><span><b>${safe(r.name)}</b><small>${r.isPublic?'공개 방':'🔒 비밀번호 방'} · ${safe(r.hostName)} · ${r.playerCount}/${r.maxPlayers}명</small></span><button type="button" data-room-id="${safe(r.roomId)}">${r.isPublic?'입장하기':'비밀번호 입력'}</button></article>`).join(''):'<p>현재 조건에 맞는 대기실이 없습니다. 다른 필터를 선택하거나 새 방을 만들어 보세요.</p>';
  }
  $('#m1009BrowsePanel').addEventListener('click',e=>{const b=e.target.closest('[data-m1009-filter]');if(!b)return;roomFilter=b.dataset.m1009Filter;document.querySelectorAll('[data-m1009-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));renderRoomDirectory()});
  function openPrivateJoin(r){pendingPrivateRoom=r.roomId;$('#m1009PasswordRoomName').textContent=r.name;$('#m1009PasswordDialog').hidden=false;$('#m1009JoinPassword').value='';$('#m1009PasswordError').hidden=true;$('#m1009PasswordError').textContent='';$('#m1009JoinPassword').focus()}
  $('#m1009ConfirmPassword').onclick=async()=>{if(!pendingPrivateRoom)return;const password=$('#m1009JoinPassword').value;const roomId=pendingPrivateRoom;if(password.length<4||password.length>12){$('#m1009PasswordError').textContent='비밀번호는 4~12자로 입력해.';$('#m1009PasswordError').hidden=false;return;}try{connectMatch(await api('join',{roomId,password}));closePrivateJoin()}catch(e){notice(e.message);$('#m1009PasswordError').textContent=e.message;$('#m1009PasswordError').hidden=false;$('#m1009JoinPassword').focus();$('#m1009JoinPassword').select()}};
  $('#m1009JoinPassword').addEventListener('keydown',e=>{if(e.key==='Enter')$('#m1009ConfirmPassword').click()});
  $('#liveRoomAccess').addEventListener('change',()=>{const privateRoom=$('#liveRoomAccess').value==='private';$('#livePrivateCreateFields').hidden=!privateRoom;$('#liveRoomPassword').required=privateRoom;if(!privateRoom)$('#liveRoomPassword').value='';});

  let roomListBusy=false;
  async function refreshPublicRooms(){
   if(roomListBusy||!session||$('#liveRooms').hidden||roomTab!=='browse')return;
   roomListBusy=true;const list=$('#livePublicRooms');
   try{const response=await api('rooms');roomDirectory=response.rooms||[];renderRoomDirectory();}
   catch(e){list.textContent='방 목록을 불러오지 못했습니다: '+e.message}finally{roomListBusy=false}
  }
  setInterval(()=>{if(session&&!$('#liveRooms').hidden&&roomTab==='browse')refreshPublicRooms()},6000);
  $('#liveRoomRefresh').onclick=refreshPublicRooms;
  $('#livePublicRooms').addEventListener('click',e=>{const b=e.target.closest('[data-room-id]');if(!b)return;const roomEntry=roomDirectory.find(r=>r.roomId===b.dataset.roomId);if(!roomEntry)return;if(!roomEntry.isPublic)openPrivateJoin(roomEntry);else join('join',{roomId:roomEntry.roomId});});
  function setIdentity(j){username=j.username;nickname=j.nickname||j.username;$('#liveAccount').textContent=nickname;$('#liveNickname').value=nickname;}
  function showRoom(){if(!room)return;display('waiting');$('#liveRoomName').textContent=(room.displayName||'대기실')+' · '+room.players.length+'/'+room.maxPlayers+'명';$('#m1009RoomAccessState').textContent=room.isPublic?'공개 대기실':'비밀번호로 보호된 대기실';const own=room.players.find(p=>p.id===playerId);$('#liveMemberList').innerHTML=room.players.map(p=>`<div class="live-member"><b>${safe(p.name)}${p.id===room.hostPlayerId?' · 방장':''}</b><span>${p.connected?'● 접속':'○ 연결 중'} · ${p.ready?'준비 완료':'대기'}</span></div>`).join('');$('#liveReady').textContent=own?.ready?'준비 취소':'준비하기';const ready=room.players.length>=2&&room.players.every(p=>p.ready&&p.connected);$('#liveStart').hidden=own?.id!==room.hostPlayerId;$('#liveStart').disabled=!ready;notice(ready?'모두 준비 완료! 방장이 게임을 시작할 수 있어.':'참가자 모두 준비해야 시작할 수 있어.');if(room.started)openGame();}
  function drawChat(){if(!room)return;$('#liveGameMembers').textContent=room.players.length+'/'+room.maxPlayers;$('#liveMessages').innerHTML=room.messages.map(m=>`<div>${m.system?'<i>시스템</i>':`<b>${safe(m.name)}</b>`}: ${safe(m.text)}</div>`).join('');$('#liveMessages').scrollTop=$('#liveMessages').scrollHeight;}
  function openGame(){if(openedGame)return;openedGame=true;document.body.classList.remove('live-gated');gate.hidden=true;dock.hidden=false;drawTeamChat();$('#devExit')?.setAttribute('hidden','');if(typeof enterAppMode==='function')enterAppMode('game');$('#devExit')?.setAttribute('hidden','');drawChat();lastTeam='';poller=setInterval(pushTeam,700);clock=setInterval(()=>{if(room?.game&&typeof window.LIVEApplyGame==='function')window.LIVEApplyGame(room.game,room.players.find(p=>p.id===playerId)?.slot||0,room.players);},250);pushTeam();}
  async function pushTeam(){if(!token||!room||!openedGame||room.game?.phase!=='prep'||room.game?.hp?.[room.players.find(p=>p.id===playerId)?.slot]<=0||typeof teams==='undefined'||!Array.isArray(teams.A))return;const team=teams.A.slice(0,3).map(x=>({ownedId:x.ownedId,characterId:x.characterId,x:x.x,y:x.y,star:x.star,items:[...(gameState.owned.find(o=>o.uid===x.ownedId)?.equipment||[])]}));const str=JSON.stringify([team,gameState.masteryLevel]);if(str===lastTeam)return;lastTeam=str;try{await api('team',{team,mastery:gameState.masteryLevel})}catch(e){lastTeam='';console.warn('배치 공유 실패',e)}}
  function disconnect(){endScreen.hidden=true;dock.hidden=true;teamDock.hidden=true;if(poller)clearInterval(poller);if(clock)clearInterval(clock);clock=null;poller=null;events?.close();events=null;token='';playerId='';room=null;lastTeam='';}
  function connectMatch(j){token=j.token;playerId=j.playerId;room=j.room;{const url=new URL(location.href);url.searchParams.delete('room');history.replaceState(null,'',url.pathname+url.search+url.hash);}showRoom();events=new EventSource('/api/events?token='+encodeURIComponent(token));events.addEventListener('state',e=>{room=JSON.parse(e.data);if(openedGame){drawChat();drawTeamChat();if(room.game&&typeof window.LIVEApplyGame==='function')window.LIVEApplyGame(room.game,room.players.find(p=>p.id===playerId)?.slot||0,room.players);showMatchEnd(room.game)}else showRoom()});events.onerror=()=>notice('서버 연결 재시도 중…');}
  async function join(action,payload){try{connectMatch(await api(action,payload));}catch(e){notice(e.message)}}
  async function recoverMatch(){try{const r=await api('rejoin');connectMatch(r);}catch(e){if(e.message!=='복귀할 참가 중인 방이 없어.')console.warn('경기 복귀 실패:',e.message)}}

  async function logIn(action){try{const j=await api(action,{username:$('#authId').value,password:$('#authPw').value,...(action==='register'?{nickname:$('#authNickname').value}:{})});session=j.session;setIdentity(j);sessionStorage.setItem('live_session',session);display('rooms');if(action==='login')recoverMatch();notice(action==='register'?'회원가입 및 로그인 완료!':'로그인 완료!')}catch(e){notice(e.message)}}
  $('#liveNicknameSave').onclick=async()=>{try{const j=await api('nickname',{nickname:$('#liveNickname').value});nickname=j.nickname;$('#liveAccount').textContent=nickname;notice('닉네임을 변경했어.')}catch(e){notice(e.message)}};
  $('#authLogin').onclick=()=>logIn('login');$('#authRegister').onclick=()=>registering?logIn('register'):authMode(true);$('#authBack').onclick=()=>authMode(false);$('#authPw').addEventListener('keydown',e=>{if(e.key==='Enter')(registering?$('#authRegister'):$('#authLogin')).click()});
  $('#liveLogout').onclick=async()=>{await api('logout').catch(()=>{});session='';username='';sessionStorage.removeItem('live_session');display('auth');notice('로그아웃했어.')};
  $('#liveCreate').onclick=()=>{
   const isPublic=$('#liveRoomAccess').value==='public',password=$('#liveRoomPassword').value;
   if(!isPublic&&(password.length<4||password.length>12)){notice('비밀번호 방은 4~12자 비밀번호를 설정해야 해.');$('#liveRoomPassword').focus();return;}
   join('create',{maxPlayers:Number($('#liveMaxPlayers').value),roomName:$('#liveRoomTitle').value,isPublic,...(!isPublic?{password}:{})});
  };
  $('#liveReady').onclick=async()=>{try{const own=room.players.find(p=>p.id===playerId);await api('ready',{ready:!own?.ready})}catch(e){notice(e.message)}};
  $('#liveStart').onclick=async()=>{try{await api('start')}catch(e){notice(e.message)}};
  $('#liveLeave').onclick=async()=>{await api('leave').catch(()=>{});disconnect();display('rooms');notice('방에서 퇴장했어.')};
  $('#liveTeamSend').onclick=async()=>{const text=$('#liveTeamChatInput').value.trim();if(!text)return;try{await api('team-chat',{text});$('#liveTeamChatInput').value=''}catch(e){notice(e.message)}};$('#liveTeamChatInput').addEventListener('keydown',e=>{if(e.key==='Enter')$('#liveTeamSend').click()});
  $('#liveSend').onclick=async()=>{const text=$('#liveChatInput').value.trim();if(!text)return;try{await api('chat',{text});$('#liveChatInput').value=''}catch(e){console.warn(e.message)}};$('#liveChatInput').addEventListener('keydown',e=>{if(e.key==='Enter')$('#liveSend').click()});
  if(session)api('me').then(j=>{setIdentity(j);display('rooms');recoverMatch()}).catch(()=>{session='';sessionStorage.removeItem('live_session');display('auth')});else display('auth');
  async function quitToLobby(){
   if(!openedGame||!token||!room)throw Error('진행 중인 경기가 없어.');
   await api('leave'); // server eliminates only this player and broadcasts to the others
   disconnect();openedGame=false;lastFarmReportRound=0;lastGameVersion=0;
   if(typeof returnToModeStart==='function')returnToModeStart();
   document.body.classList.add('live-gated');gate.hidden=false;display('rooms');
   notice('경기를 포기하고 로비로 돌아왔어.');
  }
  window.LIVEMultiplayer={quitToLobby,getRoom:()=>room,getPlayerId:()=>playerId,getToken:()=>token,economy:(cmd,payload={})=>api('economy',{cmd,...payload}),market:(cmd,payload={})=>api('market',{cmd,...payload}),auction:amount=>api('auction',{amount}),auctionChooseUnit:(choiceId,characterId)=>api('auction-unit-choice',{choiceId,characterId}),augmentPick:(round,choice)=>api('augment-pick',{round,choice}),augmentReroll:(round,choice)=>api('augment-reroll',{round,choice}),augmentAssetsReady:round=>api('augment-assets-ready',{round}),purpleConfig:(kind,value)=>api('purple-config',{kind,value}),introComplete:round=>api('intro-complete',{round}).catch(e=>console.warn('연출 완료 보고 실패',e.message)), setRoundReady:async ready=>api('round-ready',{ready}), reportBossDone:async round=>{try{await api('boss-done',{round})}catch(e){console.warn('보스 완료 보고 실패:',e.message)}},reportFarmDone:async round=>{
   if(lastFarmReportRound===round)return;
   lastFarmReportRound=round;
   const retry=async()=>{
    if(!room?.started||room.game?.round!==round||room.game?.kind!=='farm'||room.game?.phase!=='combat'){lastFarmReportRound=0;return}
    try{await api('farm-done',{round})}
    catch(e){
      // Authoritative simulation may take longer than the local visual replay.
      if(room?.game?.round===round&&room.game.phase==='combat'){
       setTimeout(retry,1400);
      }else{lastFarmReportRound=0}
    }
   };
   await retry();
  }};
})();
