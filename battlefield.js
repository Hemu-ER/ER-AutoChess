/* L.I.V.E. M4-14 — region-matched combat artwork, 3x6 scaling and curtain.
   Visual-only; no combat, inventory, or account state mutations. */
(() => {
  'use strict';
  const zones = [
    ['lab','연구소'], ['hotel','호텔'], ['beach','모래사장'],
    ['alley','골목길'], ['forest','숲'], ['police','경찰서'],
    ['church','성당'], ['temple','절'], ['cemetery','묘지'],
    ['estate','고급주택가']
  ];
  const board = document.querySelector('#board');
  const shell = document.querySelector('.board-shell');
  if (!board || !shell) return;
  let prevPhase = null;
  let prevMode = null;
  let selected = null;
  let visible = false;
  let curtain = null;
  let lastKey = '';
  let curtainRequest = 0;
  let fixedPreviewRegion = null;
  let appliedSize = "";
  const loading = new Map();
  const hash = value => {
    let n = 2166136261;
    for (const ch of String(value)) {
      n ^= ch.charCodeAt(0);
      n = Math.imul(n, 16777619);
    }
    return n >>> 0;
  };
  function urls(key) {
    return [
      `assets/battlefields/floor/${key}.png`,
      `assets/battlefields/decor/${key}.png`
    ];
  }
  function preload(key) {
    if (loading.has(key)) return;
    const images = urls(key).map(src => {
      const img = new Image();
      img.decoding = 'async';
      img.src = src;
      return img;
    });
    loading.set(key, images);
  }
  function roomSnapshot() {
    try { return window.LIVEMultiplayer?.getRoom?.() || null; }
    catch { return null; }
  }
  function localState() {
    try { return typeof roundState !== 'undefined' ? roundState : null; }
    catch { return null; }
  }
  function selectedRegion(round, roomCode) {
    if (fixedPreviewRegion && zones.some(z => z[0] === fixedPreviewRegion)) return fixedPreviewRegion;
    return zones[hash(`${roomCode || 'local'}:${round}`) % zones.length][0];
  }
  function setArtwork(key) {
    if (selected === key) return;
    selected = key;
    const [floor, decor] = urls(key);
    board.style.setProperty('--live-floor-url', `url("${floor}")`);
    board.style.setProperty('--live-decor-url', `url("${decor}")`);
    board.dataset.liveArenaRegion = key;
    preload(key);
  }
  function resizeBattlefield() {
    if (!visible || document.body.dataset.appMode !== 'game' && document.body.dataset.appMode !== 'test') {
      if (appliedSize) {
        board.style.removeProperty('width');
        board.style.removeProperty('height');
        appliedSize = '';
      }
      return;
    }
    const rect = shell.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const r = 1916 / 821;
    const limit = matchMedia('(max-width:850px)').matches ? rect.height :
      Math.min(rect.height, matchMedia('(max-height:800px)').matches ? 390 : 450);
    const width = Math.max(1, Math.floor(Math.min(rect.width, limit * r)));
    const height = width / r;
    const nextSize = `${width}x${height}`;
    if (nextSize === appliedSize) return;
    appliedSize = nextSize;
    board.style.setProperty('width', `${width}px`, 'important');
    board.style.setProperty('height', `${height}px`, 'important');
  }
  function soundCue() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      if (ctx.state === 'suspended') { ctx.close(); return; }
      const start = ctx.currentTime;
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = 'sine'; osc.frequency.setValueAtTime(310, start);
      osc.frequency.exponentialRampToValueAtTime(480, start + .12);
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.exponentialRampToValueAtTime(.035, start + .025);
      gain.gain.exponentialRampToValueAtTime(.0001, start + .2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start); osc.stop(start + .21);
      osc.onended = () => { ctx.close().catch(() => {}); };
    } catch { /* Audio is optional in restricted browsers. */ }
  }
  function showCurtain(round, kind, key) {
    if (!curtain) {
      curtain = document.createElement('div');
      curtain.id = 'liveArenaTransition';
      curtain.setAttribute('aria-hidden', 'true');
      curtain.innerHTML = '<div class="live-arena-title"><span class="live-arena-kicker">AGLAIA / L.I.V.E.</span><strong></strong><small></small></div>';
      document.body.appendChild(curtain);
      curtain.addEventListener('animationend', ev => {
        if (ev.target === curtain) curtain.classList.remove('live-animating');
      });
    }
    const token = ++curtainRequest;
    curtain.querySelector('strong').textContent = `ROUND ${round} · ${kind}`;
    curtain.querySelector('small').textContent = `${zones.find(z => z[0] === key)?.[1] || ''} 전장 진입`;
    curtain.classList.remove('live-animating');
    void curtain.offsetWidth;
    if (token === curtainRequest) curtain.classList.add('live-animating');
    soundCue();
  }
  function refresh() {
    const mode = document.body.dataset.appMode || '';
    const room = roomSnapshot();
    const game = room?.started ? room.game : null;
    const local = localState();
    const phase = game?.phase || local?.phase || (mode === 'test' ? 'combat' : 'idle');
    const round = Number(game?.round || local?.round || 1);
    const key = selectedRegion(round, room?.code);
    // Preload during preparation so there is no image flash on phase change.
    if (mode === 'game' && phase === 'prep') preload(key);
    const shouldShow = mode === 'test' || (mode === 'game' && (phase === 'combat' || phase === 'result'));
    if (shouldShow) setArtwork(key);
    if (shouldShow !== visible || mode !== prevMode) {
      visible = shouldShow;
      document.body.dataset.liveArenaVisible = shouldShow ? '1' : '0';
      board.dataset.liveArenaTest = mode === 'test' ? '1' : '0';
      if (!shouldShow && appliedSize) {
        board.style.removeProperty('width');
        board.style.removeProperty('height');
        appliedSize = '';
      }
    }
    if (shouldShow) resizeBattlefield();
    const currentKey = `${room?.code || 'local'}:${round}:${phase}`;
    if (mode === 'game' && phase === 'combat' && prevPhase === 'prep' && lastKey !== currentKey) {
      showCurtain(round, game?.pve || (!game && (round === 1 || round === 3)) ? '파밍' : '결투', key);
    }
    lastKey = currentKey;
    prevPhase = phase;
    prevMode = mode;
  }
  // Resizing also runs after server-side phase changes to avoid CSS-layout races.
  const observer = new ResizeObserver(() => { if (visible) resizeBattlefield(); });
  observer.observe(shell);
  window.addEventListener('resize', refresh, {passive:true});
  window.setInterval(refresh, 180);
  // QA-only manual preview override, e.g. LIVEBattlefield.setRegion('hotel').
  window.LIVEBattlefield = Object.freeze({
    zones: zones.map(([id,name]) => ({id,name})),
    setRegion(id) {
      if (!zones.some(z => z[0] === id)) return false;
      fixedPreviewRegion = id;
      selected = null;
      refresh();
      return true;
    },
    clearRegion() { fixedPreviewRegion = null; selected = null; refresh(); },
    getState() { return {region:selected,visible}; }
  });
  refresh();
})();
