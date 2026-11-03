'use strict';
(()=>{
 const panel=document.createElement('section');panel.id='liveExperiment';panel.hidden=true;panel.className='qa-stage';panel.style.cssText='position:fixed;inset:0;z-index:25000;overflow:auto;background:#10191e;color:#e7f0ec;padding:32px;border:0;border-radius:0';document.body.appendChild(panel);
 let marker='',busy=false,seq=0;
 function render(){const room=window.LIVEMultiplayer?.getRoom(),g=room?.game,e=g?.experiment,active=g?.phase==='special'&&g.specialType==='experiment'&&!!e;panel.hidden=!active;if(!active){marker='';return}seq=Math.max(seq,e.seq||0);const key=g.round+':'+e.version;if(key===marker)return;marker=key;
 const values=[...panel.querySelectorAll('input')].map(el=>({id:el.id,name:el.name,value:el.value,checked:el.checked,focus:el===document.activeElement,start:el.selectionStart}));
 const scroll=panel.scrollTop;
 panel.innerHTML=`<h2>번외 실험 · ${e.kind}</h2><p>${e.bye?'부전승 · ':e.solo?'혼자 진행 · ':''}남은 시간 <b>${Math.max(0,Math.ceil((e.deadline-Date.now())/1000))}초</b></p>`+e.html;
 for(const v of values){const el=v.id?panel.querySelector('#'+v.id):[...panel.querySelectorAll('input')].find(x=>x.name===v.name&&x.value===v.value);if(!el)continue;el.value=v.value;el.checked=v.checked;if(v.focus){el.focus();if(el.type==='text'||!el.type)el.setSelectionRange?.(v.start,v.start)}}panel.scrollTop=scroll;
 }
 async function send(action,value=''){
 if(busy)return;const g=window.LIVEMultiplayer?.getRoom()?.game;if(!g?.experiment)return;busy=true;
 const read=id=>panel.querySelector('#'+id)?.value||'';
 const payload={round:g.round,seq:++seq,action,value,credits:Number(read('qaShare')),exp:Number(read('qaExp')),items:[...panel.querySelectorAll('input[name="qaGiveItem"]:checked')].map(e=>Number(e.value)),answer:read('qaQuizAnswer'),text:action==='search'?read('qaCodexSearch'):read('qaChatText')};
 try{const res=await fetch('/api/experiment',{method:'POST',headers:{'content-type':'application/json','x-live-token':window.LIVEMultiplayer.getToken()},body:JSON.stringify(payload)});const result=await res.json();if(!res.ok){let msg=panel.querySelector('.experiment-error');if(!msg){msg=document.createElement('p');msg.className='experiment-error';panel.prepend(msg)}msg.textContent=result.error}}finally{busy=false;}
 }
 panel.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b&&!b.disabled)send(b.dataset.action,b.dataset.val)});
 panel.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='qaQuizAnswer')send('quizAnswer');if(e.key==='Enter'&&e.target.id==='qaChatText')send('chat')});
 panel.addEventListener('input',e=>{if(e.target.id==='qaShare')panel.querySelector('#qaShareOut').textContent=e.target.value+'C';if(e.target.id==='qaExp')panel.querySelector('#qaExpOut').textContent=e.target.value+' EXP';});
 let searchTimer;panel.addEventListener('input',e=>{if(e.target.id==='qaCodexSearch'){clearTimeout(searchTimer);searchTimer=setTimeout(()=>send('search'),300)}});
 document.addEventListener('keydown',e=>{if(panel.hidden||e.target.matches('input,textarea,select'))return;const action={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'rotate',ArrowDown:'down',' ':'drop'}[e.key];if(action&&window.LIVEMultiplayer.getRoom().game.experiment.kind==='stack'){e.preventDefault();send(action)}});
 setInterval(render,100);
})();

/* M8-07: UI + local equipment uniqueness; integrated in existing module. */
/* L.I.V.E. M8-07 provisional presentation-only fix.
 * No authoritative combat or reward mechanics are changed here.
 */
(function () {
  'use strict';
  const ID = 'm807-combat-loading';
  let current = null;
  let lastRound = null;
  let adapterWrapped = false;
  let previousPvPFoeHp = null;
  let previousPvPRound = null;

  function onlineGame() {
    const room = window.LIVEMultiplayer?.getRoom?.();
    return room?.started ? room.game : null;
  }
  function getArena() { return document.querySelector('.arena-card'); }
  function ensureLoading() {
    let layer = document.getElementById(ID);
    if (!layer) {
      const arena = getArena();
      if (!arena) return null;
      layer = document.createElement('section');
      layer.id = ID;
      layer.className = 'm807-loading';
      layer.setAttribute('role', 'status');
      layer.setAttribute('aria-live', 'polite');
      layer.innerHTML = '<div class="m807-loading-content"><div class="m807-loading-mark" aria-hidden="true">⚔</div><b>전투 준비 중</b><p>대전 데이터를 동기화하고 있어</p><div class="m807-loading-track" aria-hidden="true"><i></i></div><small>준비가 완료되면 자동으로 시작해</small></div>';
      arena.appendChild(layer);
    }
    return layer;
  }
  function loadingOn(game) {
    const layer = ensureLoading();
    if (!layer) return;
    const loading = game.phase === 'intro' || (game.phase === 'combat' && game.kind === 'pvp' && !game.bye && !game.battle);
    layer.hidden = !loading;
    if (!loading) return;
    const title = document.querySelector('.round-center strong');
    if (title) title.textContent = '전투 준비 중';
    const status = document.getElementById('status');
    if (status) status.textContent = `ROUND ${game.round} · 전투 준비 중`;
    const p = layer.querySelector('p');
    if (p) p.textContent = game.phase === 'intro' ? '상대 편성과 전투 데이터를 동기화하고 있어' : '서버 전투 결과를 확인하고 있어';
  }
  function loadingOff() {
    const layer = document.getElementById(ID);
    if (layer) layer.hidden = true;
  }
  function makeDamageHud() {
    const arena = getArena();
    const parent = arena?.querySelector('.arena-top');
    if (!parent) return null;
    let hud = parent.querySelector('#m807-damage-hud');
    if (!hud) {
      hud = document.createElement('div');
      hud.id = 'm807-damage-hud';
      hud.className = 'm807-damage-hud';
      hud.innerHTML = '<span>준 피해 <strong data-dealt>0</strong></span><span>받은 피해 <strong data-taken>0</strong></span><span data-foe-loss hidden>상대 플레이어 HP <strong data-foe-loss-value></strong></span>';
      parent.appendChild(hud);
    }
    return hud;
  }
  function sumMeter(rootId, which) {
    const root = document.getElementById(rootId);
    if (!root) return 0;
    let total = 0;
    for (const node of root.querySelectorAll('.meter-numbers')) {
      if (which === 'dealt') total += Number(node.querySelector('b')?.textContent) || 0;
      else {
        const match = node.querySelector('small')?.textContent.match(/받은 피해\s+([\d,.]+)/);
        if (match) total += Number(match[1].replaceAll(',', '')) || 0;
      }
    }
    return Math.round(total);
  }
  function damageHud(game) {
    const hud = makeDamageHud();
    if (!hud) return;
    const active = ['combat','result'].includes(game?.phase) && game.kind === 'pvp' && !game.pve && !game.bye && !game.battle?.auto;
    hud.hidden = !active;
    if (!active) return;
    // The existing meter rows come from the live CombatEngine replay, not guessed HP differences.
    hud.querySelector('[data-dealt]').textContent = String(sumMeter('meterA', 'dealt'));
    hud.querySelector('[data-taken]').textContent = String(sumMeter('meterA', 'taken'));
    const lossBox = hud.querySelector('[data-foe-loss]');
    const opponentHp = Number.isInteger(game.opponentSlot) ? game.hp?.[game.opponentSlot] : undefined;
    if(game.phase === 'combat' && Number.isFinite(opponentHp)) {
      previousPvPFoeHp = opponentHp;
      previousPvPRound = game.round;
    }
    const showLoss = game.phase === 'result' && previousPvPRound === game.round && Number.isFinite(opponentHp) && Number.isFinite(previousPvPFoeHp);
    lossBox.hidden = !showLoss;
    if(showLoss)hud.querySelector('[data-foe-loss-value]').textContent = '-' + Math.max(0,previousPvPFoeHp - opponentHp);
  }
  function showDamage(event) {
    const game = onlineGame();
    if (!game || game.phase !== 'combat' || game.kind !== 'pvp' || game.bye || !(event?.amount > 0)) return;
    const board = document.getElementById('board');
    const shell = board?.closest('.board-shell');
    if (!shell) return;
    let unit = null;
    for (const element of board.querySelectorAll('.unit[data-id]')) {
      if (element.dataset.id === event.unitId) { unit = element; break; }
    }
    const cell = unit?.closest('.cell');
    if (!cell) return;
    const x = Number(cell.dataset.x), y = Number(cell.dataset.y);
    if (!Number.isInteger(x) || !Number.isInteger(y)) return;
    let layer = shell.querySelector('.m807-damage-layer');
    if (!layer) { layer = document.createElement('div'); layer.className = 'm807-damage-layer'; layer.setAttribute('aria-hidden', 'true'); shell.appendChild(layer); }
    if (layer.children.length > 24) layer.firstElementChild?.remove();
    const figure = document.createElement('span');
    figure.className = 'm807-damage-number ' + (event.unitId.startsWith('B:') ? 'm807-hit-enemy' : 'm807-hit-ally');
    figure.textContent = String(Math.max(1, Math.round(event.amount)));
    figure.style.left = `${(x + .5) * 100 / 6}%`;
    figure.style.top = `${(y + .25) * 100 / 3}%`;
    figure.style.setProperty('--offset', `${(layer.children.length % 5 - 2) * 9}px`);
    layer.appendChild(figure);
    figure.addEventListener('animationend', () => figure.remove(), {once: true});
    setTimeout(() => figure.remove(), 1600);
  }
  function wrapImpact() {
    if (adapterWrapped || !window.M6PixiAdapter || typeof window.M6PixiAdapter.impact !== 'function') return;
    const adapter = window.M6PixiAdapter;
    const old = adapter.impact;
    adapter.impact = function (event) { showDamage(event); return old.call(this, event); };
    adapterWrapped = true;
  }
  function update(game) {
    if (!game) { current = null; lastRound = null; previousPvPFoeHp = null; previousPvPRound = null; loadingOff(); damageHud(null); return; }
    if (lastRound !== game.round) {
      lastRound = game.round; previousPvPFoeHp = null; previousPvPRound = null;
      document.querySelector('.m807-damage-layer')?.replaceChildren();
    }
    current = game;
    loadingOn(game);
    damageHud(game);
    if (game.phase !== 'combat') document.querySelector('.m807-damage-layer')?.replaceChildren();
  }
  // Game phase updates are already delivered by the existing authoritative online handler.
  const original = window.LIVEApplyGame;
  if (typeof original === 'function') {
    window.LIVEApplyGame = function (game, slot, players) {
      const out = original.apply(this, arguments);
      update(game);
      return out;
    };
  }
  // Duplicate finished items are legal. Stats stack; CombatEngine keys unique effects once.
  // Old round display may briefly render `결투 · null초` in the intro.
  // Adjust the UI after each round render without creating a new game.js copy.
  const originalRenderRound = typeof window.renderRoundUI === 'function' ? window.renderRoundUI : null;
  if (originalRenderRound) {
    window.renderRoundUI = function () {
      const result = originalRenderRound.apply(this, arguments);
      if (roundState.phase === 'intro') {
        const caption = document.querySelector('#roundModePanel .round-center strong');
        if (caption) caption.textContent = '전투 준비 중';
      }
      return result;
    };
  }
  function boot() { wrapImpact(); update(onlineGame()); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once: true});
  else boot();
  window.LIVEM807UIQA = Object.freeze({update, wrapImpact, showDamage, sumMeter});
})();
