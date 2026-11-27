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
  const gate=document.createElement('section');gate.id='liveGate';gate.innerHTML=`<div class="live-gate-card m11-gate"><header class="m11-top"><div class="m11-brand">L.I.V.E.<small>LUMIA ISLAND VIRTUAL EXPERIMENT</small></div><div class="m11-topright"><span class="m11-status">● SYSTEM ONLINE</span><button id="m11Settings">환경설정</button></div></header><div class="m11-auth-layout"><div class="m11-auth-art"><div class="m11-kicker">AGLAIA RESEARCH DIVISION</div><div class="m11-display">L.I.V.E<span>.</span></div><h1>루미아섬 가상실험</h1><p>새로운 실험을 시작하십시오.</p><div class="m11-auth-foot"><span>VIRTUAL EXPERIMENT SYSTEM</span><span>ACCESS / 01</span></div></div><div aria-label="계정 인증" class="m1009-panel" id="liveAuth"><div class="m11-index">01 / ACCESS TERMINAL</div>
<div class="m1009-section-head"><span>ACCOUNT ACCESS</span><h2 id="authTitle">로그인</h2></div>
<label class="m1009-field">아이디<input autocomplete="username" id="authId" maxlength="20" placeholder="아이디 3자 이상"/></label>
<label class="m1009-field">비밀번호<input autocomplete="current-password" id="authPw" placeholder="비밀번호 8자 이상" type="password"/></label>
<div hidden="" id="registerFields"><label class="m1009-field">닉네임<input id="authNickname" maxlength="16" placeholder="사용할 닉네임 (2~16자)"/></label></div>
<div class="m1009-auth-actions"><button class="live-primary" id="authLogin">로그인</button><button id="authRegister" type="button">회원가입 화면</button><button hidden="" id="authBack" type="button">로그인으로 돌아가기</button></div>
<small class="m1009-fineprint">계정 정보는 접속한 서버에 저장됩니다.</small>
</div></div><div class="m1009-panel" hidden="" id="liveRooms"><div class="m11-shell"><nav class="m11-nav"><div class="m11-kicker">RESEARCH TERMINAL</div><button class="active" id="m11Home">개인 연구실</button><button id="m11Browse">실험실 목록</button><button data-future="실험체 분석">실험체 분석 <small>예정</small></button><button data-future="실험 기록">실험 기록 <small>예정</small></button><button data-future="업적 · 꾸미기">업적 · 꾸미기 <small>예정</small></button><div class="m11-nav-foot">AGLAIA / M11-07</div></nav><main class="m11-main"><div class="m11-heading"><div><div class="m11-kicker">RESEARCH DIVISION / PERSONAL</div><h1 id="m11PageTitle">개인 연구실</h1></div><span class="m11-status">● 연구원 접속 중</span></div><div class="m11-home-grid"><div class="m11-left"><section class="m11-hero"><div class="m11-kicker">EXPERIMENT ACCESS</div><h2>실험에 참여하기</h2><p>새로운 실험실을 개설하거나 다른 연구원의 실험에 참가합니다.</p><div class="m11-actions"><button class="live-primary" id="m11Create">실험실 개설 →</button><button id="m11Join">실험실 참가</button></div></section><section class="m11-panel m11-record"><div class="m11-kicker">EXPERIMENT LOG</div><h2>나의 연구 기록</h2><p>실험 기록과 성과가 이곳에 축적됩니다.</p><div class="research-stats"><div>완료한 실험 <b id="researchMatches">—</b></div><div>승리 <b id="researchWins">—</b></div><div>연구원 경험치 <b>—</b></div><small>경험치와 보상은 후속 개발 예정</small></div><div id="researchHistory" class="research-history"></div><div class="m11-kicker" style="margin-top:23px">연구 수집품</div><div class="research-shelf"><i>◇</i><i>·</i><i>·</i><i>·</i></div><p style="font-size:11px">기본 문장 · 추가 수집품은 개발 예정</p></section></div><section class="m11-panel m11-profile"><div class="m11-kicker">RESEARCHER IDENTIFICATION</div><div class="m11-id-art"><div class="id-face"><div class="id-serial"><span>AGLAIA</span><span>R / ID</span></div><svg viewBox="0 0 140 140" aria-hidden="true"><defs><linearGradient id="sigil" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#eefbff"/><stop offset="1" stop-color="currentColor"/></linearGradient></defs><path d="M70 8 124 39 124 101 70 132 16 101 16 39Z" fill="#0b202c" stroke="currentColor" stroke-width="1.2"/><path d="M70 17 116 44 116 96 70 123 24 96 24 44Z" fill="none" stroke="currentColor" stroke-width=".5" opacity=".5"/><circle cx="70" cy="70" r="31" fill="none" stroke="currentColor" stroke-width=".8" stroke-dasharray="2 5"/><path d="M70 30 99 70 70 110 41 70Z M70 45 87 70 70 95 53 70Z" fill="none" stroke="url(#sigil)" stroke-width="2.2"/><path d="M70 56 80 70 70 84 60 70Z" fill="url(#sigil)"/><path d="M29 70H39M101 70H111M70 20V28M70 112V120" stroke="currentColor"/></svg><div><div class="id-name" id="idDisplayName">RESEARCHER</div><div class="id-title">신입 연구원 · 기본 문장</div></div><div class="id-rank"><span>RESEARCH ID</span><span>01 / BASE</span></div></div></div><div id="m11LobbyIdentity"><div class="m1009-account-row"><span><small>CONNECTED ACCOUNT</small><b id="liveAccount"></b></span><button id="liveLogout" type="button">로그아웃</button></div></div><div id="m11Nick"><div class="m1009-nickname-row"><input aria-label="닉네임 변경" id="liveNickname" maxlength="16" placeholder="닉네임 변경 (2~16자)"/><button id="liveNicknameSave">변경</button></div></div><div class="m11-profile-note"><label for="m11CardFinish">인증체 재질 바꾸기</label><select id="m11CardFinish"><option value="cyan">청록 합금</option><option value="gold">샴페인 골드</option><option value="violet">자수정</option></select><small>계정에 저장 · 다른 연구원에게 표시 · 추가 해금은 추후 지원</small></div></section></div><section class="m11-panel m11-work" id="m11Work"><div id="m11Tabs"><div aria-label="로비 메뉴" class="m1009-tabs" role="tablist">
<button aria-controls="m1009CreatePanel" aria-selected="true" id="m1009TabCreate" role="tab" type="button">방 만들기</button>
<button aria-controls="m1009BrowsePanel" aria-selected="false" id="m1009TabBrowse" role="tab" type="button">방 찾기</button>
</div></div><div id="m11Forms"><section aria-labelledby="m1009TabCreate" id="m1009CreatePanel" role="tabpanel">
<div class="m1009-field-grid"><label class="m1009-field">방 제목<input id="liveRoomTitle" maxlength="32" placeholder="방 제목 (최대 32자)"/></label>
<label class="m1009-field">최대 참가 인원<select aria-label="최대 경기 인원" id="liveMaxPlayers"><option value="2">2명</option><option value="3">3명</option><option value="4">4명</option><option value="5">5명</option><option value="6">6명</option><option value="7">7명</option><option selected="" value="8">8명</option></select></label></div>
<label class="m1009-field">방 공개 방식<select id="liveRoomAccess"><option value="public">공개 방 · 비밀번호 없이 입장</option><option value="private">비밀번호 방 · 비밀번호를 알아야 입장</option></select></label>
<label class="m1009-field" hidden="" id="livePrivateCreateFields">방 비밀번호<input autocomplete="new-password" id="liveRoomPassword" maxlength="12" minlength="4" placeholder="비밀번호 4~12자" type="password"/></label>
<p class="m1009-hint">비밀번호 방은 방 찾기에 잠금 표시로 나타나며, 입장하려면 비밀번호가 필요합니다.</p>
<button class="live-primary m1009-full-action" id="liveCreate">실험실 개설</button>
</section><section aria-labelledby="m1009TabBrowse" hidden="" id="m1009BrowsePanel" role="tabpanel">
<div class="m910-room-browser"><div class="m910-room-browser-head"><b>참가 가능한 대기실</b><button id="liveRoomRefresh" type="button">새로고침 ↻</button></div>
<div aria-label="방 필터" class="m1009-browse-filters" role="group"><button aria-pressed="true" data-m1009-filter="all" type="button">전체</button><button aria-pressed="false" data-m1009-filter="public" type="button">공개</button><button aria-pressed="false" data-m1009-filter="private" type="button">비밀번호</button></div>
<div aria-live="polite" class="m910-room-results" id="livePublicRooms" role="list">방 목록을 확인하는 중입니다.</div></div>
</section></div></section></main></div></div><div class="m1009-panel" hidden="" id="liveWaiting"><main class="m11-wait session-deck"><div class="session-head"><div><div class="m11-kicker">AGLAIA / MULTI-RESEARCH SESSION</div><div id="m11WaitTitle"><h2 id="liveRoomName"></h2></div></div><div class="session-meta"><div id="m11Access"><div class="m1009-room-state" id="m1009RoomAccessState"></div></div><div id="m11Capacity"></div><button id="liveLeave">퇴장 ↗</button></div></div><div class="session-stage"><div class="session-core" aria-hidden="true"><div class="core-label">SYNCHRONIZATION</div><div class="core-orbit"><i></i><i></i><i></i><div class="core-crystal"></div></div><div class="core-meter" id="sessionMeter">00 / 00</div><div class="core-caption" id="sessionCaption">연구원 접속 대기</div><div class="core-base"></div></div><div class="m11-wait-grid"><section><div class="m11-roster-head"><h2>참가 연구원</h2><span id="m11ReadyCount"></span></div><div id="m11Slots"><div aria-label="대기실 참가 슬롯" class="m1019-slots" id="liveMemberList"></div></div></section></div></div><div class="m11-wait-footer" id="m11WaitActions"><div class="session-tools"><span class="m11-kicker">표준 가상실험</span><div id="m11Bots"><div class="m1019-bot-tools" hidden="" id="m1019BotTools"><button id="m1019AddBot" type="button">+ AI 봇 추가</button><small>방장 전용</small></div></div></div><div class="session-help"><p class="live-help">전원 준비 후 방장이 실험을 개시합니다.</p><div class="session-progress"><i id="sessionProgress"></i></div></div><div class="live-line"><button class="live-primary" id="liveReady">준비하기</button><button hidden="" id="liveStart">실험 개시</button></div></div></main></div><div class="m1009-password-mask" hidden="" id="m1009PasswordDialog"><div aria-labelledby="m1009PasswordTitle" aria-modal="true" class="m1009-password-card" role="dialog"><span class="m1009-kicker">PRIVATE MATCH</span><h2 id="m1009PasswordTitle">비밀번호 방 입장</h2><p id="m1009PasswordRoomName"></p><label class="m1009-field">방 비밀번호<input autocomplete="off" id="m1009JoinPassword" maxlength="12" minlength="4" placeholder="비밀번호 4~12자" type="password"/></label><p class="m1009-dialog-error" hidden="" id="m1009PasswordError" role="alert"></p><div class="live-line"><button id="m1009CancelPassword" type="button">취소</button><button class="live-primary" id="m1009ConfirmPassword" type="button">입장하기</button></div></div></div><div class="m11-bottom"><span>AGLAIA / RESEARCH NETWORK</span><p id="liveNotice" role="status"></p><a id="m11QA" href="/qa.html">QA LAB ↗</a></div></div>`;document.body.appendChild(gate);
  const dock=document.createElement('aside');dock.id='liveGameChat';dock.hidden=true;dock.innerHTML=`<div class="live-chat-head" data-drag-handle><b>채팅</b><span id="liveGameMembers"></span><button type="button" class="live-chat-toggle" aria-label="채팅 접기">−</button></div><div class="live-chat-body"><div id="liveMessages" class="live-chat-log"></div><div class="live-chat-send"><input id="liveChatInput" maxlength="240" placeholder="채팅 입력"><button id="liveSend">전송</button></div></div>`;document.body.appendChild(dock);
  const teamDock=document.createElement('aside');teamDock.id='liveTeamChat';teamDock.hidden=true;teamDock.innerHTML=`<div class="live-chat-head" data-drag-handle><b>AGLAIA · 폭발물 해체 전용 채팅</b><button type="button" class="live-chat-toggle" aria-label="채팅 접기">−</button></div><div class="live-chat-body"><div id="liveTeamMessages" class="live-chat-log"></div><div class="live-chat-send"><input id="liveTeamChatInput" maxlength="240" placeholder="조원에게만 전송"><button id="liveTeamSend">전송</button></div></div>`;document.body.appendChild(teamDock);
  function makeMovable(panel){
    let drag=null;const head=panel.querySelector('[data-drag-handle]');
    head.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('button'))return;const r=panel.getBoundingClientRect();drag={x:e.clientX-r.left,y:e.clientY-r.top};head.setPointerCapture?.(e.pointerId);e.preventDefault()});
    head.addEventListener('pointermove',e=>{if(!drag)return;panel.style.left=Math.max(0,Math.min(window.innerWidth-70,e.clientX-drag.x))+'px';panel.style.top=Math.max(0,Math.min(window.innerHeight-50,e.clientY-drag.y))+'px';panel.style.right='auto';panel.style.bottom='auto'});
    for(const evt of ['pointerup','pointercancel','lostpointercapture'])head.addEventListener(evt,()=>drag=null);
    panel.querySelector('.live-chat-toggle').addEventListener('click',()=>{const collapsed=panel.classList.toggle('live-chat-collapsed');panel.querySelector('.live-chat-toggle').textContent=collapsed?'+':'−'});
  }
  dock.querySelector('.live-chat-head').removeAttribute('data-drag-handle');dock.querySelector('.live-chat-toggle').addEventListener('click',()=>{const collapsed=dock.classList.toggle('live-chat-collapsed');dock.querySelector('.live-chat-toggle').textContent=collapsed?'+':'−'});makeMovable(teamDock);
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
   if(part==='rooms'){m11Page('home');showRoomTab(roomTab);refreshProfile();}else closePrivateJoin();
  };
  function m11Page(page){gate.dataset.page=page;$('#m11PageTitle').textContent=page==='home'?'개인 연구실':page==='create'?'실험실 개설':'실험실 목록';$('#m11Home').classList.toggle('active',page==='home'||page==='create');$('#m11Browse').classList.toggle('active',page==='browse');}
  $('#m11Home').onclick=()=>m11Page('home');$('#m11Create').onclick=()=>{m11Page('create');showRoomTab('create')};$('#m11Browse').onclick=$('#m11Join').onclick=()=>{m11Page('browse');showRoomTab('browse')};
  gate.querySelectorAll('[data-future]').forEach(b=>b.onclick=()=>notice(b.dataset.future+' 기능은 후속 개발 예정입니다.'));
  $('#m11Settings').onclick=()=>{if(typeof window.LIVEOpenSettings==='function')window.LIVEOpenSettings();else notice('게임 환경설정은 실제 클라이언트에서 확인할 수 있습니다.');};
  function showRoomTab(tab){
   roomTab=tab==='browse'?'browse':'create';if(gate.dataset.page!=='home')m11Page(roomTab);
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
  let profileEpoch=0;
  const finishes=['cyan','gold','violet'];
  const validFinish=value=>finishes.includes(value)?value:'cyan';
  function paintProfile(profile){
   const finish=validFinish(profile?.finish);$('#m11CardFinish').value=finish;gate.dataset.finish=finish;
   $('#researchMatches').textContent=profile?.matches??0;$('#researchWins').textContent=profile?.wins??0;
   const history=$('#researchHistory');history.replaceChildren();
   for(const match of (profile?.recent||[]).slice(0,3)){const line=document.createElement('span'),date=document.createElement('span'),result=document.createElement('b');date.textContent=new Date(match.endedAt).toLocaleDateString('ko-KR');result.textContent=match.outcome==='win'?'승리':match.outcome==='draw'?'무승부':'패배';line.append(date,result);history.append(line);}
  }
  function setIdentity(j){username=j.username;nickname=j.nickname||j.username;$('#liveAccount').textContent=nickname;$('#liveNickname').value=nickname;$('#idDisplayName').textContent=nickname;const epoch=++profileEpoch;paintProfile(j.profile);$('#m11CardFinish').disabled=false;
   if(!j.profile?.initialized){let local=null;try{local=localStorage.getItem('live.profile.finish.'+username)}catch{}if(finishes.includes(local)){$('#m11CardFinish').disabled=true;api('profile-finish',{finish:local,migrate:true}).then(r=>{if(epoch===profileEpoch)paintProfile(r.profile)}).catch(e=>{if(epoch===profileEpoch)notice(e.message)}).finally(()=>{if(epoch===profileEpoch)$('#m11CardFinish').disabled=false});}}
  }
  function refreshProfile(){const epoch=profileEpoch;if(!session)return;api('profile').then(j=>{if(epoch===profileEpoch&&!$('#m11CardFinish').disabled)paintProfile(j.profile)}).catch(e=>console.warn('연구원 정보 갱신 실패:',e.message));}
  $('#m11CardFinish').onchange=async()=>{const finish=validFinish($('#m11CardFinish').value),before=gate.dataset.finish,epoch=profileEpoch;$('#m11CardFinish').disabled=true;try{const j=await api('profile-finish',{finish});if(epoch===profileEpoch)paintProfile(j.profile)}catch(e){if(epoch===profileEpoch){$('#m11CardFinish').value=validFinish(before);notice(e.message)}}finally{if(epoch===profileEpoch)$('#m11CardFinish').disabled=false}};
  let lastRosterMarkup='';
  function showRoom(){
   if(!room)return;display('waiting');
   $('#liveRoomName').textContent=(room.displayName||'대기실')+' · '+room.players.length+'/'+room.maxPlayers+'명';
   $('#m1009RoomAccessState').textContent=room.isPublic?'공개 대기실':'비밀번호로 보호된 대기실';
   const own=room.players.find(p=>p.id===playerId),host=own?.id===room.hostPlayerId;
   const slots=Array.from({length:room.maxPlayers},(_,i)=>room.players.find(p=>p.slot===i));
   const roster=$('#liveMemberList');roster.dataset.capacity=room.maxPlayers;
   const sigil='<svg viewBox="0 0 140 140" aria-hidden="true"><path d="M70 8 124 39 124 101 70 132 16 101 16 39Z" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M70 17 116 44 116 96 70 123 24 96 24 44Z" fill="none" stroke="currentColor" stroke-width=".5" opacity=".5"/><circle cx="70" cy="70" r="31" fill="none" stroke="currentColor" stroke-width=".8" stroke-dasharray="2 5"/><path d="M70 30 99 70 70 110 41 70Z M70 45 87 70 70 95 53 70Z" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M70 56 80 70 70 84 60 70Z" fill="currentColor"/></svg>';
   const botSigil='<svg viewBox="0 0 140 140" aria-hidden="true"><path d="M70 13 119 42V98L70 127 21 98V42Z" fill="none" stroke="currentColor"/><path d="M44 45H96V91H44Z M35 55H44V81H35Z M96 55H105V81H96Z M70 45V31" fill="none" stroke="currentColor" stroke-width="2"/><path d="M54 62H64M76 62H86M56 79H84" stroke="currentColor" stroke-width="4"/></svg>';
   const markup=slots.map((p,i)=>{const slot=String(i+1).padStart(2,'0');const css=`--column:${[2,4,2,4,1,5,1,5][i]};--row:${[1,1,2,2,1,1,2,2][i]};--yaw:${[6,-6,6,-6,12,-12,12,-12][i]}deg`;if(!p)return `<div class="m1019-slot m1019-slot-empty" style="${css}"><div class="seat-empty-ring"></div><span class="seat-empty-label">${slot} / 미접속</span></div>`;const own=p.id===playerId,isHost=p.id===room.hostPlayerId,ready=p.ready&&p.connected;return `<div class="m1019-slot ${p.isBot?'m1019-slot-bot':''} ${own?'m11-own':''} ${ready?'m11-ready':''} ${isHost?'seat-host':''}" data-finish="${p.isBot?'bot':validFinish(p.researcherFinish)}" style="${css}"><div class="seat-card"><div class="seat-serial"><span>R / ${slot}</span><span>${isHost?'HOST':p.isBot?'AI':'RESEARCH'}</span></div><div class="m11-slot-art">${p.isBot?botSigil:sigil}</div><div class="m1019-slot-person"><b>${safe(p.name)}</b><small>${own?'내 인증체':p.isBot?'AI 실험 참가자':'연구원'}</small></div><div class="seat-state"><i></i>${!p.connected?'연결 중':ready?'준비 완료':'준비 대기'}</div>${host&&p.isBot?`<button type="button" data-bot-remove="${safe(p.id)}" aria-label="${safe(p.name)} 제거" class="seat-remove">×</button>`:''}</div><div class="seat-plinth"></div></div>`}).join('');
   if(markup!==lastRosterMarkup||!roster.children.length){const focused=document.activeElement?.dataset?.botRemove;roster.innerHTML=markup;lastRosterMarkup=markup;if(focused)[...roster.querySelectorAll('[data-bot-remove]')].find(b=>b.dataset.botRemove===focused)?.focus();}
   const nReady=room.players.filter(p=>p.ready&&p.connected).length;$('#m11ReadyCount').textContent='준비 '+nReady+' / '+room.players.length;$('#m11Capacity').textContent='정원 '+room.maxPlayers+'명';$('#sessionMeter').textContent=String(nReady).padStart(2,'0')+' / '+String(room.players.length).padStart(2,'0');$('#sessionCaption').textContent=nReady===room.players.length&&room.players.length>=2?'실험 개시 가능':'동기화 대기 중';$('#sessionProgress').style.width=(100*nReady/Math.max(1,room.players.length))+'%';$('#liveWaiting').classList.toggle('session-synced',nReady===room.players.length&&room.players.length>=2);
   $('#m1019BotTools').hidden=!host;
   $('#m1019AddBot').disabled=room.players.length>=room.maxPlayers;
   $('#liveReady').textContent=own?.ready?'준비 취소':'준비 완료';
   const ready=room.players.length>=2&&room.players.every(p=>p.ready&&p.connected);
   $('#liveStart').textContent='실험 개시';$('#liveStart').hidden=!host;$('#liveStart').disabled=!ready;
   notice(ready?'모두 준비 완료! 방장이 게임을 시작할 수 있습니다.':'참가자가 모두 준비하면 시작할 수 있습니다.');
   if(room.started)openGame();
  }
  $('#m1019AddBot').onclick=async()=>{try{await api('bot-add')}catch(e){notice(e.message)}};
  $('#liveMemberList').addEventListener('click',async e=>{const button=e.target.closest('[data-bot-remove]');if(!button)return;try{await api('bot-remove',{botId:button.dataset.botRemove})}catch(err){notice(err.message)}});
  function drawChat(){if(!room)return;$('#liveGameMembers').textContent=room.players.length+'/'+room.maxPlayers;$('#liveMessages').innerHTML=room.messages.map(m=>`<div>${m.system?'<i>시스템</i>':`<b>${safe(m.name)}</b>`}: ${safe(m.text)}</div>`).join('');$('#liveMessages').scrollTop=$('#liveMessages').scrollHeight;}
  function openGame(){if(openedGame)return;openedGame=true;document.body.classList.add('m1016-game-open');document.body.classList.remove('live-gated');gate.hidden=true;dock.hidden=false;drawTeamChat();$('#devExit')?.setAttribute('hidden','');if(typeof enterAppMode==='function')enterAppMode('game');$('#devExit')?.setAttribute('hidden','');drawChat();lastTeam='';poller=setInterval(pushTeam,700);clock=setInterval(()=>{if(room?.game&&typeof window.LIVEApplyGame==='function')window.LIVEApplyGame(room.game,room.players.find(p=>p.id===playerId)?.slot||0,room.players);},250);pushTeam();}
  async function pushTeam(){if(!token||!room||!openedGame||room.game?.phase!=='prep'||room.game?.hp?.[room.players.find(p=>p.id===playerId)?.slot]<=0||typeof teams==='undefined'||!Array.isArray(teams.A))return;const team=teams.A.slice(0,3).map(x=>({ownedId:x.ownedId,characterId:x.characterId,x:x.x,y:x.y,star:x.star,items:[...(gameState.owned.find(o=>o.uid===x.ownedId)?.equipment||[])]}));const str=JSON.stringify([team,gameState.masteryLevel]);if(str===lastTeam)return;lastTeam=str;try{await api('team',{team,mastery:gameState.masteryLevel})}catch(e){lastTeam='';console.warn('배치 공유 실패',e)}}
  function disconnect(){document.body.classList.remove('m1016-game-open');window.LIVECombatVFX?.clear?.();endScreen.hidden=true;dock.hidden=true;teamDock.hidden=true;if(poller)clearInterval(poller);if(clock)clearInterval(clock);clock=null;poller=null;events?.close();events=null;token='';playerId='';room=null;lastTeam='';}
  function connectMatch(j){token=j.token;playerId=j.playerId;room=j.room;{const url=new URL(location.href);url.searchParams.delete('room');history.replaceState(null,'',url.pathname+url.search+url.hash);}showRoom();events=new EventSource('/api/events?token='+encodeURIComponent(token));events.addEventListener('state',e=>{room=JSON.parse(e.data);if(openedGame){drawChat();drawTeamChat();if(room.game&&typeof window.LIVEApplyGame==='function')window.LIVEApplyGame(room.game,room.players.find(p=>p.id===playerId)?.slot||0,room.players);showMatchEnd(room.game)}else showRoom()});events.onerror=()=>notice('서버 연결 재시도 중…');}
  async function join(action,payload){try{connectMatch(await api(action,payload));}catch(e){notice(e.message)}}
  async function recoverMatch(){try{const r=await api('rejoin');connectMatch(r);}catch(e){if(e.message!=='복귀할 참가 중인 방이 없어.')console.warn('경기 복귀 실패:',e.message)}}

  async function logIn(action){try{const j=await api(action,{username:$('#authId').value,password:$('#authPw').value,...(action==='register'?{nickname:$('#authNickname').value}:{})});session=j.session;setIdentity(j);sessionStorage.setItem('live_session',session);display('rooms');if(action==='login')recoverMatch();notice(action==='register'?'회원가입 및 로그인 완료!':'로그인 완료!')}catch(e){notice(e.message)}}
  $('#liveNicknameSave').onclick=async()=>{try{const j=await api('nickname',{nickname:$('#liveNickname').value});nickname=j.nickname;$('#liveAccount').textContent=nickname;$('#idDisplayName').textContent=nickname;notice('닉네임을 변경했어.')}catch(e){notice(e.message)}};
  $('#authLogin').onclick=()=>logIn('login');$('#authRegister').onclick=()=>registering?logIn('register'):authMode(true);$('#authBack').onclick=()=>authMode(false);$('#authPw').addEventListener('keydown',e=>{if(e.key==='Enter')(registering?$('#authRegister'):$('#authLogin')).click()});
  $('#liveLogout').onclick=async()=>{await api('logout').catch(()=>{});session='';username='';profileEpoch++;sessionStorage.removeItem('live_session');display('auth');notice('로그아웃했어.')};
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
  // M10-17: release first-paint login guard only after the account UI and handlers exist.
  document.documentElement.classList.add('m1017-gate-ready');
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
