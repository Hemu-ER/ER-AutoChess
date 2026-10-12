/* M5-04 isolated online beta. Uses the existing M4 HTTP/SSE room API without mutating M4 code. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  let session='';try{session=sessionStorage.getItem('live_session')||''}catch{};let token='',playerId='',room=null,stream=null;
  let currentVersion='',lastTeam='',pendingTeam=false,connected=false,previousChat='',appliedSupplyRound=0;
  let identity='',timer=null,joining=false,phasePending=Promise.resolve(),lastFarmReported=0;
  const names={prep:'준비',combat:'결투',result:'결과',supply:'보급',finished:'종료'};
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const notice=s=>{$('m5-online-notice').textContent=s;};
  const slot=()=>room?.players.find(p=>p.id===playerId)?.slot??0;
  const own=()=>room?.players.find(p=>p.id===playerId);
  const game=()=>room?.game;
  async function api(action,data={}){
    const response=await fetch('/api/'+action,{method:'POST',headers:{'content-type':'application/json','x-live-session':session,'x-live-token':token},body:JSON.stringify({...data,session})});
    const value=await response.json();if(!response.ok)throw Error(value.error||'서버 요청 실패');return value;
  }
  function stateView(){
    $('m5-auth').hidden=!!identity;
    $('m5-lobby').hidden=!identity||!!room;
    $('m5-room').hidden=!room;
    $('m5-connection').textContent=room?(connected?'● LIVE':'○ 재연결 중'):identity?`${identity} 로그인`:'오프라인';
    $('m5-region-select').disabled=!!room;
    if(!room)return;
    $('m5-room-title').textContent=`ROOM ${room.code}`;
    $('m5-room-members').textContent=room.players.map(p=>`${p.name}${p.id===playerId?' (나)':''} ${p.connected?'●':'○'} ${p.ready?'✓':''}`).join('  ·  ');
    const inGame=!!room.started,g=game(),me=own();
    $('m5-room-ready').hidden=inGame;
    $('m5-room-ready').textContent=me?.ready?'대기 취소':'방 준비 완료';
    $('m5-room-start').hidden=inGame||me?.slot!==0;
    $('m5-room-start').disabled=room.players.length!==2||!room.players.every(p=>p.connected&&p.ready);
    $('m5-round-ready').hidden=!inGame||g?.phase!=='prep';
    $('m5-round-ready').textContent=me?.roundReady?'라운드 준비 취소':'라운드 준비 완료';
    $('m5-farm-done').hidden=!inGame||g?.phase!=='combat'||!g.pve;
    $('m5-farm-done').disabled=!!me?.farmDone;
    $('m5-phase-info').textContent=g?`R${g.round} ${g.phase==='combat'&&g.pve?'파밍':names[g.phase]||g.phase} · 서버 동기화 ${g.remaining??'-'}초`:'방 대기 중';
    $('m5-room-code').value=room.code;
    window.LIVEM5?.updateOnlineHud?.(room,slot());
    supplyView();chatView();
  }
  function chatView(){
    const messages=room?.messages||[],marker=messages.map(x=>x.id||x.at).join(':');if(marker===previousChat)return;
    previousChat=marker;const root=$('m5-chat-log');root.replaceChildren();
    for(const msg of messages.slice(-40)){
      const el=document.createElement('div');
      if(msg.system){el.textContent=msg.text;el.className='m5-chat-system';}
      else{const name=document.createElement('b');name.textContent=(msg.name||'게스트')+': ';el.append(name,document.createTextNode(msg.text||''));}
      root.append(el);
    }root.scrollTop=root.scrollHeight;
  }
  function rewardName(r){
    if(!r)return '정보 없음';
    if(r.type==='credits')return '크레딧 +10';
    if(r.type==='exp')return '숙련도 EXP +10';
    if(r.type==='unit')return `${window.ERRoster?.byId?.[r.value]?.name||r.value} · 무료 영입`;
    if(r.type==='basic'||r.type==='complete'){
      const all=Object.entries(window.LIVEItems?.all||{}).filter(([,data])=>!!data.basic===(r.type==='basic')).map(([name])=>name);
      return all.length?`${r.type==='basic'?'기본':'완성'} 장비 · ${all[r.value%all.length]}`:`${r.type==='basic'?'기본':'완성'} 장비`;
    }return String(r.type);
  }
  function supplyView(){
    const g=game(),elem=$('m5-supply');
    elem.hidden=!(g?.phase==='supply'&&g.round===5);
    if(elem.hidden)return;
    const opts=g.supplyOptions?.[slot()]||[],picked=g.supplyResolved?.[slot()],root=$('m5-supply-choices');
    const stamp=JSON.stringify([opts,picked]);if(root.dataset.stamp===stamp)return;root.dataset.stamp=stamp;root.replaceChildren();
    for(let i=0;i<opts.length;i++){
      const b=document.createElement('button');b.textContent=`${i+1}. ${rewardName(opts[i])}`;
      b.disabled=!!picked;b.onclick=()=>api('supply-pick',{choice:i}).then(()=>notice('보급 선택 전송 완료')).catch(e=>notice(e.message));root.appendChild(b);
    }
    if(picked)notice('서버에서 보급 선택을 확정했어. M5는 아직 인벤토리를 별도로 운용하지 않아.');
  }
  function curtain(title,subtitle){
    let el=document.querySelector('#m5Curtain');if(!el){el=document.createElement('div');el.id='m5Curtain';el.className='m5-round-curtain';el.innerHTML='<div><strong></strong><small></small></div>';document.body.append(el)}
    el.querySelector('strong').textContent=title;el.querySelector('small').textContent=subtitle||'';
    el.classList.remove('on');void el.offsetWidth;el.classList.add('on');
  }
  async function onPhase(roomSnapshot){
    const g=roomSnapshot.game;if(!g||!window.LIVEM5)return;
    const selfSlot=slot();
    if(g.phase==='prep'){
      window.LIVEM5.onlineRoundPrep(roomSnapshot,selfSlot);
      // During preparation M5 uses the server's existing team roster.
      if(g.round!==1&&g.round!==3)await sendTeam();
      const region=window.ERCombat?.pickArenaRegion?.(roomSnapshot.code,g.round)||'lab';
      await window.LIVEM5.setRegion(region);
    }else if(g.phase==='combat'){
      curtain(`ROUND ${g.round} · ${g.pve?'파밍':'결투'}`,window.ERCombat?.ARENA_REGIONS?.[g.region]?.name||'전장 진입');
      await window.LIVEM5.onlineStart(roomSnapshot,selfSlot);
    }else if(g.phase==='result'){
      // Preserve the final image briefly; next prep resets the renderer.
      notice(`ROUND ${g.round} 종료 · 서버 결과 ${g.battle?.outcome||'파밍 종료'}`);
    }else if(g.phase==='supply'){
      curtain('ROUND 5 · 보급','지원 물자 도착');
      window.LIVEM5.onlineRoundPrep(roomSnapshot,selfSlot);
    }else if(g.phase==='finished'){
      const winner=g.winnerSlot;
      curtain(winner===null?'무승부':winner===selfSlot?'승리':'패배','MATCH COMPLETE');
    }
  }
  function serverEvent(next){
    room=next;stateView();
    if(!room?.started||!game())return;
    const g=game(),marker=`${g.round}:${g.version}:${g.phase}`;
    if(marker!==currentVersion){currentVersion=marker;phasePending=phasePending.then(()=>onPhase(next)).catch(e=>{notice('화면 재생 오류: '+e.message);console.error(e)});}
    if(g.phase==='combat'&&g.pve){
      const cs=window.LIVEM5?.getCombatState?.();
      if(cs?.battleOver&&cs.units.filter(u=>u.id.startsWith('B:')).every(u=>u.dead)&&lastFarmReported!==g.round){
        lastFarmReported=g.round;
        api('farm-done',{round:g.round}).catch(e=>{lastFarmReported=0;console.warn(e)});
      }
    }
  }
  async function sendTeam(force=false){
    if(!room||!token||pendingTeam||room.started&&game()?.phase!=='prep')return false;
    const team=window.LIVEM5?.onlineTeamForServer?.()||[];
    if(!team.length)return false;
    const stamp=JSON.stringify(team);if(!force&&stamp===lastTeam)return true;
    pendingTeam=true;
    try{await api('team',{team,mastery:1});lastTeam=stamp;return true;}
    catch(e){notice('배치 동기화 실패: '+e.message);return false}
    finally{pendingTeam=false}
  }
  async function join(action,payload){
    if(joining)return;joining=true;
    try{
      const j=await api(action,payload);token=j.token;playerId=j.playerId;room=j.room;
      lastTeam='';currentVersion='';previousChat='';lastFarmReported=0;
      window.LIVEM5?.onlineSetup?.(slot());
      // Each player initially controls a distinct fixed set for the beta.
      // The full M4 shop/bench inventory will be integrated in a later stage.
      if(slot()===0){
        window.LIVEM5?.resetUnits?.();
      }
      await sendTeam(true);
      stream=new EventSource('/api/events?token='+encodeURIComponent(token));
      stream.addEventListener('state',ev=>{connected=true;serverEvent(JSON.parse(ev.data));});
      stream.onerror=()=>{connected=false;stateView();notice('서버 연결을 다시 시도하는 중…')};
      stateView();notice('온라인 방에 접속했어. 두 명이 준비하면 시작할 수 있어.');
    }catch(e){notice(e.message)}finally{joining=false}
  }
  async function leave(){
    await api('leave').catch(()=>{});stream?.close();stream=null;token='';playerId='';room=null;connected=false;
    currentVersion='';lastTeam='';lastFarmReported=0;
    window.LIVEM5?.onlineLeave?.();stateView();notice('온라인 방에서 나왔어.');
  }
  const bind=(id,fn)=>{$(id).addEventListener('click',()=>Promise.resolve(fn()).catch(e=>notice(e.message)))};
  bind('m5-login',async()=>{
    const data=await api('login',{username:$('m5-username').value,password:$('m5-password').value});
    session=data.session;identity=data.nickname||data.username;sessionStorage.setItem('live_session',session);
    $('m5-password').value='';stateView();notice(`${identity} 계정으로 로그인했어.`);
  });
  bind('m5-logout',async()=>{await api('logout');session='';identity='';sessionStorage.removeItem('live_session');stateView()});
  bind('m5-create',()=>join('create',{maxPlayers:2}));
  bind('m5-join',()=>join('join',{code:$('m5-room-code').value.trim().toUpperCase()}));
  bind('m5-room-ready',async()=>{await sendTeam();await api('ready',{ready:!own()?.ready})});
  bind('m5-room-start',async()=>{await sendTeam();await api('start')});
  bind('m5-round-ready',async()=>{if(!own()?.roundReady)await sendTeam();await api('round-ready',{ready:!own()?.roundReady})});
  bind('m5-farm-done',async()=>{await api('farm-done',{round:game()?.round});lastFarmReported=game()?.round||0});
  bind('m5-leave',leave);
  const sendChat=async()=>{const v=$('m5-chat-input').value.trim();if(!v)return;await api('chat',{text:v});$('m5-chat-input').value=''};
  bind('m5-chat-send',sendChat);
  $('m5-chat-input').addEventListener('keydown',e=>{if(e.key==='Enter')sendChat().catch(err=>notice(err.message))});
  $('m5-password').addEventListener('keydown',e=>{if(e.key==='Enter')$('m5-login').click()});
  const code=new URLSearchParams(location.search).get('room');if(code)$('m5-room-code').value=code.toUpperCase();
  window.M5Online=Object.freeze({sendTeam,active:()=>!!room,room:()=>room,slot});
  if(session)api('me').then(u=>{identity=u.nickname||u.username;stateView()}).catch(()=>{session='';sessionStorage.removeItem('live_session');stateView()});
  stateView();
  timer=setInterval(()=>{
    if(!room||!game())return;
    const g=game(),remain=Math.max(0,Math.ceil(((g.earlyEndsAt&&g.earlyEndsAt<g.endsAt?g.earlyEndsAt:g.endsAt)-Date.now())/1000));
    $('m5-phase-info').textContent=`R${g.round} ${g.phase==='combat'&&g.pve?'파밍':names[g.phase]||g.phase} · ${remain}초`;
    window.LIVEM5?.updateOnlineHud?.(room,slot());
    if(g.phase==='combat'&&g.pve){const cs=window.LIVEM5?.getCombatState?.();if(cs?.battleOver&&lastFarmReported!==g.round){lastFarmReported=g.round;api('farm-done',{round:g.round}).catch(()=>{lastFarmReported=0})}}
  },400);
})();
