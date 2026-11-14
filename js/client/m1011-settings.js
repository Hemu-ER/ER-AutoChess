'use strict';
/* M10-11 · In-game Escape menu. No server-side timer mutation: forfeiture only
 * submits /api/leave after a cancellable 5-second grace period. */
(() => {
  if (['combat','round'].includes(new URLSearchParams(location.search).get('qa'))) return;
  const STORAGE_KEY='live_m1011_settings_v1';
  const defaults={volume:100,muted:false,uiScale:100};
  let saved={};
  try { saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')||{}; } catch (_) {}
  const bounded=(n,min,max,fallback)=>Number.isFinite(Number(n))?Math.max(min,Math.min(max,Number(n))):fallback;
  const settings={
    volume:bounded(saved.volume,0,100,100),
    muted:!!saved.muted,
    uiScale:bounded(saved.uiScale,80,120,100)
  };
  window.LIVEAudioSettings=settings;
  const persist=()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(settings))}catch(_){}};
  function applySettings(){
    document.documentElement.style.setProperty('--live-ui-scale',String(settings.uiScale/100));
    if(volume)volume.value=String(settings.volume);
    if(volumeValue)volumeValue.textContent=settings.volume+'%';
    if(mute)mute.checked=settings.muted;
    if(scale)scale.value=String(settings.uiScale);
    if(scaleValue)scaleValue.textContent=settings.uiScale+'%';
  }
  const overlay=document.createElement('section');
  overlay.id='liveSettingsOverlay';overlay.hidden=true;
  overlay.innerHTML=`<div class="m1011-settings-card" role="dialog" aria-modal="true" aria-labelledby="m1011SettingsTitle">
    <div class="m1011-settings-header"><div><small>AGLAIA / TERMINAL OPTIONS</small><h2 id="m1011SettingsTitle">환경설정</h2></div><button type="button" id="m1011Close" aria-label="환경설정 닫기">✕</button></div>
    <section class="m1011-settings-section" aria-label="사운드 설정">
      <div class="m1011-setting-row"><label for="m1011Volume">효과음 음량</label><output id="m1011VolumeValue">100%</output></div>
      <input type="range" id="m1011Volume" min="0" max="100" step="5" value="100">
      <label class="m1011-toggle"><input type="checkbox" id="m1011Mute"> 음소거</label>
    </section>
    <section class="m1011-settings-section" aria-label="화면 설정">
      <div class="m1011-setting-row"><label for="m1011UiScale">인터페이스 크기</label><output id="m1011ScaleValue">100%</output></div>
      <input type="range" id="m1011UiScale" min="80" max="120" step="5" value="100">
      <button type="button" class="m1011-screen-btn" id="m1011Fullscreen">전체 화면 전환</button>
    </section>
    <div class="m1011-settings-footer"><small>설정은 이 브라우저에 저장돼. ESC로 게임에 돌아갈 수 있어.</small><button type="button" id="m1011Back">게임으로 돌아가기</button></div>
    <section class="m1011-forfeit" id="m1011Forfeit" aria-label="게임 포기">
      <div><b>경기 포기</b><small>5초 동안 취소할 수 있고, 이후 서버에 퇴장이 전달돼.</small></div>
      <button type="button" class="m1011-forfeit-button" id="m1011ForfeitStart">포기하기</button>
      <div id="m1011ForfeitConfirm" class="m1011-forfeit-confirm" hidden><span id="m1011ForfeitCountdown" role="status">5초 후 로비로 이동</span><button type="button" id="m1011ForfeitCancel">취소</button></div>
      <p id="m1011SettingsError" role="alert" hidden></p>
    </section>
  </div>`;
  document.body.appendChild(overlay);
  const get=id=>overlay.querySelector('#'+id);
  const volume=get('m1011Volume'),volumeValue=get('m1011VolumeValue'),mute=get('m1011Mute');
  const scale=get('m1011UiScale'),scaleValue=get('m1011ScaleValue');
  const forfeitSection=get('m1011Forfeit'),confirmBox=get('m1011ForfeitConfirm');
  const forfeitStart=get('m1011ForfeitStart'),forfeitCancel=get('m1011ForfeitCancel');
  const forfeitCountdown=get('m1011ForfeitCountdown'),error=get('m1011SettingsError');
  let graceTimer=null,graceDeadline=0,submitting=false,previousFocus=null;
  const gameOpen=()=>document.body.dataset.appMode==='game'&&!document.body.classList.contains('live-gated');
  const onlineMatch=()=>Boolean(window.LIVEMultiplayer?.getRoom?.()?.started);
  function clearGrace(){
    if(graceTimer!==null){clearInterval(graceTimer);graceTimer=null;}
    graceDeadline=0;confirmBox.hidden=true;forfeitStart.hidden=false;
  }
  function close(){
    if(submitting)return;
    clearGrace();overlay.hidden=true;document.body.classList.remove('live-settings-open');
    if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});
  }
  function open(){
    if(!gameOpen())return;
    if(!overlay.hidden)return;
    previousFocus=document.activeElement;
    error.hidden=true;error.textContent='';
    clearGrace();forfeitSection.hidden=!onlineMatch();overlay.hidden=false;
    document.body.classList.add('live-settings-open');
    applySettings();get('m1011Close').focus({preventScroll:true});
  }
  function tickGrace(){
    if(overlay.hidden||!gameOpen()||!onlineMatch()) {clearGrace();return;}
    const remaining=Math.max(0,Math.ceil((graceDeadline-Date.now())/1000));
    forfeitCountdown.textContent=remaining>0?`${remaining}초 후 경기를 포기하고 로비로 이동`:'서버에 퇴장을 요청하는 중…';
    if(remaining>0||submitting)return;
    clearInterval(graceTimer);graceTimer=null;submitting=true;forfeitCancel.disabled=true;
    window.LIVEMultiplayer.quitToLobby().then(()=>{
      submitting=false;forfeitCancel.disabled=false;clearGrace();overlay.hidden=true;document.body.classList.remove('live-settings-open');
    }).catch(e=>{
      submitting=false;forfeitCancel.disabled=false;clearGrace();
      error.hidden=false;error.textContent='경기 포기에 실패했어: '+(e?.message||'서버 오류')+' · 다시 시도해 줘.';
    });
  }
  get('m1011Close').addEventListener('click',close);
  get('m1011Back').addEventListener('click',close);
  overlay.addEventListener('pointerdown',e=>{if(e.target===overlay)close()});
  volume.addEventListener('input',()=>{settings.volume=Number(volume.value);persist();applySettings()});
  mute.addEventListener('change',()=>{settings.muted=mute.checked;persist();applySettings()});
  scale.addEventListener('input',()=>{settings.uiScale=Number(scale.value);persist();applySettings()});
  get('m1011Fullscreen').addEventListener('click',async()=>{
    try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}
    catch(e){error.hidden=false;error.textContent='전체 화면을 사용할 수 없어: '+(e?.message||'브라우저 제한');}
  });
  forfeitStart.addEventListener('click',()=>{
    if(!onlineMatch()||submitting)return;
    error.hidden=true;error.textContent='';graceDeadline=Date.now()+5000;
    forfeitStart.hidden=true;confirmBox.hidden=false;tickGrace();graceTimer=setInterval(tickGrace,150);
    forfeitCancel.focus({preventScroll:true});
  });
  forfeitCancel.addEventListener('click',()=>{if(!submitting)clearGrace()});
  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape'||e.repeat||!gameOpen())return;
    if(e.target?.closest?.('#liveCodex:not([hidden]),#liveSettingsOverlay')&&overlay.hidden)return;
    e.preventDefault();e.stopPropagation();
    if(overlay.hidden)open();else close();
  },true);
  window.addEventListener('pagehide',clearGrace);
  applySettings();
})();
