/* L.I.V.E. M5-09 — instant drag feedback and inspection UI, isolated from M4.
   PixiJS render path / Canvas fallback; neither changes the live M4 game. */
(() => {
  'use strict';
  const W = 2100, H = 900, COLS = 6, ROWS = 3, CW = W / COLS, CH = H / ROWS;
  let FLOOR_URL = 'assets/m5/floor/lab.png';
  // Dedicated 3×3 formation artwork is deliberately undecided; keep the 3×6 cropping adapter until an approved asset exists.
  const PREP_FLOOR_URL = null;
  const REGIONS=Object.freeze({lab:'연구소',hotel:'호텔',beach:'모래사장',alley:'골목길',forest:'숲',police:'경찰서',church:'성당',temple:'절',cemetery:'묘지',estate:'고급주택가'});
  const WILD={1:[['wild_boar',2,1],['wild_dog',1,0]],3:[['wild_wolf',2,0],['wild_wolf',2,2],['wild_boar',1,1]]};
  const OTHER_BOUNDS={bounds:[0,0,800,1200]};
  const $ = id => document.getElementById(id);
  // Visible alpha bounds measured from existing game PNGs. They make the feet,
  // rather than the centre of each transparent file, the authoritative anchor.
  const portraits = Object.freeze({
    aya:    {name:'아야',    bounds:[95,78,694,1182]},
    bianca: {name:'비앙카',  bounds:[121,39,700,1195]},
    isol:   {name:'아이솔',  bounds:[82,105,759,1170]},
    rozzi:  {name:'로지',    bounds:[160,68,730,1144]},
    hart:   {name:'하트',    bounds:[44,78,709,1158]},
    irem:   {name:'이렘',    bounds:[22,97,769,1163]},
    wild_boar:{name:'멧돼지',bounds:[0,0,800,1200]},wild_dog:{name:'들개',bounds:[0,0,800,1200]},
    wild_wolf:{name:'늑대',bounds:[59,57,829,1182]},wild_bear:{name:'곰',bounds:[72,111,764,1081]},
    'abigail':{bounds:[83, 29, 669, 1189]},
    'adela':{bounds:[114, 32, 719, 1203]},
    'bernice':{bounds:[66, 65, 708, 1195]},
    'cathy':{bounds:[178, 45, 629, 1204]},
    'charlotte':{bounds:[51, 44, 748, 1172]},
    'chloe':{bounds:[43, 47, 786, 1201]},
    'dailin':{bounds:[88, 82, 685, 1156]},
    'debi-marlene':{bounds:[27, 137, 825, 1129]},
    'garnet':{bounds:[69, 53, 760, 1174]},
    'hyunwoo':{bounds:[78, 44, 777, 1183]},
    'ian':{bounds:[59, 108, 749, 1183]},
    'jenny':{bounds:[78, 26, 685, 1195]},
    'johann':{bounds:[46, 0, 1100, 1353]},
    'justina':{bounds:[53, 30, 754, 1192]},
    'kenneth':{bounds:[112, 86, 626, 1159]},
    'laura':{bounds:[56, 114, 797, 1159]},
    'leny':{bounds:[30, 37, 804, 1188]},
    'marcus':{bounds:[163, 13, 867, 1494]},
    'mirka':{bounds:[79, 71, 721, 1172]},
    'nadine':{bounds:[25, 16, 803, 1172]},
    'nicky':{bounds:[107, 12, 666, 1186]},
    'nina':{bounds:[37, 25, 804, 1194]},
    'rio':{bounds:[20, 35, 810, 1182]},
    'shurin':{bounds:[64, 89, 806, 1188]},
    'sua':{bounds:[34, 58, 776, 1184]},
    'yuki':{bounds:[121, 90, 707, 1163]},
    'yumin':{bounds:[208, 105, 564, 1127]},
  });
  const originals = [
    {id:'aya',team:'A',x:0,y:0}, {id:'bianca',team:'A',x:1,y:1}, {id:'isol',team:'A',x:2,y:2},
    {id:'rozzi',team:'B',x:3,y:0}, {id:'hart',team:'B',x:4,y:1}, {id:'irem',team:'B',x:5,y:2}
  ];
  const units = originals.map(u => ({...u}));
  const charId = u => u.characterId || u.id;
  const src = id => `assets/characters/${id}.png`;
  const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
  const state = {brightness:.75, vfx:true, sound:false, mode:'prep', x:1, y:1, grid:false, points:false, engine:'loading', activeUnitId:'bianca', hover:null, onlineSlot:null, onlinePhase:'', round:0, region:'lab'};
  const root = $('stage'), wrap = $('stage-wrap');
  let renderer = null, gesture = null, toastTimer = 0;
  let combat = null, raf = null, lastFrame = 0, lag = 0, lastStatus = 0;
  let farmSession=null, boardGhost=null;
  const visual = new Map();
  const floaters = [], flashes = [], combatEffects=[];
  // A separate queue per actual combat unit. Nearby units must never share a
  // damage-number staircase, even if their sprites visually overlap.
  const damageLanes = new Map(), lastImpactFx = new Map();
  const FLOAT_MS = 970, CRIT_FLOAT_MS = 1180;
  const FX_LIMIT = 32;
  let audioContext=null,lastSound=0,recapRendered=false;
  function tuneSound(kind){
    if(!state.sound||nowMs()-lastSound<100)return;
    lastSound=nowMs();try{
      const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
      audioContext ||= new C();if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});
      const t=audioContext.currentTime,g=audioContext.createGain(),osc=audioContext.createOscillator();
      osc.type=kind==='crit'?'sawtooth':kind==='skill'?'triangle':'sine';
      const hz=kind==='crit'?190:kind==='skill'?420:kind==='kill'?125:310;
      osc.frequency.setValueAtTime(hz,t);osc.frequency.exponentialRampToValueAtTime(hz*.55,t+.14);
      g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(kind==='crit'?.035:.013,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+.16);
      osc.connect(g).connect(audioContext.destination);osc.start(t);osc.stop(t+.17);
    }catch{}
  }
  function fxBurst(kind,x,y,color='#b2ecf2',unitKey=null){
    if(!state.vfx)return;
    const now=nowMs();
    // Preserve every damage number; skip only decorative duplicate impact rings.
    if(kind==='hit'&&unitKey!==null){
      if(now-(lastImpactFx.get(unitKey)||-Infinity)<115)return;
      lastImpactFx.set(unitKey,now);
    }
    const duration=kind==='skill'?570:kind==='kill'?510:kind==='crit'?430:260;
    combatEffects.push({kind,x,y,at:now,color,duration});
    while(combatEffects.length>FX_LIMIT)combatEffects.shift();
  }
  function hpTop(u,p){
    const bb=(portraits[charId(u)]||OTHER_BOUNDS).bounds;
    const sc=Math.min(250/(bb[3]-bb[1]),215/(bb[2]-bb[0]))*(u.y===0?.78:1);
    return Math.max(18,p.y-(bb[3]-bb[1])*sc-32);
  }
  const battleActive = () => !!combat;
  const shownUnits = () => combat ? combat.snapshot.units.map(u => ({...u, id:u.characterId})) : units;
  const portraitFor = u => portraits[u.characterId || u.id];
  const viewX = x => state.onlineSlot===1 && state.onlinePhase!=='farm' ? 5-x : x;
  const worldX = x => state.onlineSlot===1 && state.onlinePhase!=='farm' ? 5-x : x;
  const ownTeam = () => state.onlineSlot===1 && state.onlinePhase!=='farm' ? 'B':'A';
  const isOwn = u => u.team===ownTeam();
  const visualTeam = u => state.onlineSlot===1 && state.onlinePhase!=='farm' ? (u.team==='A'?'B':'A') : u.team;
  const spritePoint = u => foot(viewX(u.x),u.y);
  const clamp01 = n => Math.max(0,Math.min(1,n));
  const nowMs = () => performance.now();
  function getDrawUnits(){
    return combat ? combat.snapshot.units.map(u=>({...u,drawKey:u.id,id:u.characterId})) : units.map(u=>({...u,drawKey:u.team+':'+u.id}));
  }
  const visibleCols = () => state.mode === 'prep' ? 3 : 6;
  const viewW = () => visibleCols()*CW;
  const foot = (x,y) => ({x:(x+.5)*CW, y:(y+.87)*CH});
  const label = () => `${state.x<3?'A':'B'} · ${state.x<3?['후열','중열','전열'][state.x]:['전열','중열','후열'][state.x-3]} / ${['상단','중앙','하단'][state.y]}`;
  const unitAt = (x,y) => units.find(u => viewX(u.x)===x&&u.y===y) || null;
  const selectedUnit = () => units.find(u => u.id===state.activeUnitId) || null;
  function feedback(s){
    const el=$('lab-feedback'); if(!el) return;
    el.textContent=s;el.classList.add('visible');clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>el.classList.remove('visible'),2200);
  }
  function updateSize(){
    const space=document.querySelector('.lab-stage-space');
    if(!space)return;
    const padding=window.innerWidth<=760?20:40;
    const maxWidth=Math.max(120,space.clientWidth-padding);
    const maxHeight=Math.max(270,Math.min(620,window.innerHeight-(window.innerWidth<=760?260:565)));
    const width=Math.min(maxWidth,maxHeight*viewW()/H);
    const height=width*H/viewW();
    wrap.style.width=`${(width+2).toFixed(2)}px`;
    wrap.style.height=`${(height+2).toFixed(2)}px`;
    $('viewport-status').textContent=`${Math.round(width)} × ${Math.round(height)}px`;
  }
  function updateInfo(){
    $('cell-title').textContent=label();
    $('cell-code').textContent=`X ${String(state.x).padStart(2,'0')} / Y ${String(state.y).padStart(2,'0')}`;
    $('cell-position').textContent=`${Math.round((state.x+.5)*CW)}, ${Math.round((state.y+.5)*CH)}`;
    $('mode-status').textContent=state.mode==='prep'?'준비 모드':'전투 모드';
    $('renderer-status').textContent=state.engine==='pixi'?'PixiJS 8.22.0':state.engine==='canvas'?'Canvas 대체 모드':'엔진 초기화 중';
    $('stage').setAttribute('aria-label',`${visibleCols()}열 3행 연구소 전장, ${label()} 칸 선택됨`);
    document.querySelector('.lab-index').textContent=`${String(state.y*6+state.x+1).padStart(2,'0')} / 18`;
    for(const [mode,id] of [['combat','mode-combat'],['prep','mode-prep']]){
      const el=$(id),active=state.mode===mode;
      el.classList.toggle('mode-selected',active);el.setAttribute('aria-pressed',String(active));
    }
    for(const [key,id] of [['grid','toggle-grid'],['points','toggle-points']]){
      $(id).setAttribute('aria-pressed',String(state[key]));
      $(id).querySelector('strong').textContent=state[key]?'ON':'OFF';
    }
    wrap.style.setProperty('--board-ratio',`${viewW()} / ${H}`);
    wrap.dataset.boardMode=state.mode;
    const picked=selectedUnit();
    $('unit-title').textContent=picked?`${(portraits[charId(picked)]?.name || window.ERRoster?.byId?.[charId(picked)]?.name || charId(picked))} ${'★'.repeat(picked.star||1)} · ${visualTeam(picked)}팀`:'실험체를 선택해 줘';
    $('unit-location').textContent=picked?`X ${viewX(picked.x)+1} / Y ${picked.y+1}`:'—';
    $('unit-help').textContent=combat?'실제 전투 엔진의 위치·체력·상태를 재생하는 중이야.':state.mode==='prep'?'A팀 실험체를 끌어서 이동하거나 서로 위치를 바꿀 수 있어.':'배치 확인 모드야. 전투 시작 버튼으로 실전을 재생해 봐.';
    document.querySelectorAll('[data-unit-id]').forEach(el=>{
      const id=el.dataset.unitId,u=units.find(e=>e.id===id || (state.onlineSlot===null && charId(e)===id));
      el.classList.toggle('picked',id===state.activeUnitId);
      el.querySelector('.unit-pos').textContent=u?`${viewX(u.x)+1}열 · ${u.y+1}행`:'전장 미배치';
    });
    updateSize();
  }
  function render(){renderer?.paint();updateInfo();}
  function selectCell(x,y){
    if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=visibleCols()||y>=ROWS)return false;
    state.x=x;state.y=y;
    const occupant=unitAt(x,y);
    if(occupant)state.activeUnitId=occupant.id;
    window.M5Economy?.syncSelection?.(occupant?.id||null);
    render();return true;
  }
  function setMode(mode){
    if(combat)return false;
    if(mode!=='prep'&&mode!=='combat')return false;
    gesture=null;state.hover=null;state.mode=mode;
    if(state.x>=visibleCols())state.x=visibleCols()-1;
    renderer?.mode();render();return true;
  }
  function toggle(key){state[key]=!state[key];render();}
  function moveUnit(id,x,y){
    const unit=units.find(u=>u.id===id);
    if(combat)return false;
    if(!unit||!isOwn(unit)||state.onlinePhase==='supply'||state.mode!=='prep'||!Number.isInteger(x)||!Number.isInteger(y)||x<0||x>=3||y<0||y>=ROWS)return false;
    const other=unitAt(x,y);
    if(other&&other.team!==unit.team)return false;
    const ox=unit.x,oy=unit.y;
    unit.x=worldX(x);unit.y=y;
    if(other&&other!==unit){other.x=ox;other.y=oy;}
    state.activeUnitId=id;state.x=x;state.y=y;
    renderer?.positions();render();
    if(state.onlineSlot!==null)window.M5Online?.sendTeam?.();
    else window.M5Economy?.syncBoardPositions?.(units.filter(u=>u.team==='A'));
    return true;
  }
  function resetUnits(){
    if(state.onlineSlot===null&&window.M5Economy?.enabled?.())return window.M5Economy.reset();
    if(combat){feedback('전투 중에는 배치를 초기화할 수 없어.');return false;}
    gesture=null;state.hover=null;
    units.splice(0,units.length,...originals.map(u=>({...u})));
    if(state.onlineSlot!==null)window.M5Online?.sendTeam?.();
    state.activeUnitId='bianca';state.x=1;state.y=1;
    renderer?.positions(true);render();feedback('기본 배치로 되돌렸어.');
    return true;
  }
  function pointerWorld(e){
    const rect=renderer.canvas.getBoundingClientRect();
    if(!rect.width||!rect.height)return null;
    const x=(e.clientX-rect.left)/rect.width*viewW(),y=(e.clientY-rect.top)/rect.height*H;
    return {x,y,cellX:Math.floor(x/CW),cellY:Math.floor(y/CH),valid:x>=0&&y>=0&&x<viewW()&&y<H};
  }
  function startInput(){
    const canvas=renderer.canvas;canvas.style.touchAction='none';
    canvas.addEventListener('pointerdown',e=>{
      if(e.button!==0&&e.pointerType==='mouse')return;
      const p=pointerWorld(e);if(!p?.valid)return;
      const unit=unitAt(p.cellX,p.cellY);
      // A selected bench unit must NOT steal pointerdown from a unit already on
      // the board. This was the reason board dragging regressed in M5-07.
      const picked=renderer.pick?.(p.x,p.y) || unit;
      if(!picked&&state.mode==='prep'&&!combat&&state.onlineSlot===null&&window.M5Economy?.onCellTap?.(p.cellX,p.cellY))return;
      selectCell(p.cellX,p.cellY);
      if(picked&&isOwn(picked)&&state.mode==='prep'&&!combat){
        state.activeUnitId=picked.id;state.x=picked.x;state.y=picked.y;render();
        gesture={id:picked.id,pointerId:e.pointerId,down:p,now:p,moving:false};
        canvas.classList.add('m5-unit-grabbed');
        try{canvas.setPointerCapture(e.pointerId);}catch{}
      }
    });
    const removeBoardGhost=()=>{boardGhost?.remove();boardGhost=null;document.body.classList.remove('m5-board-dragging');window.M5Economy?.clearSalePreview?.();};
    const moveBoardGhost=(unit,x,y)=>{
      if(!boardGhost){
        boardGhost=document.createElement('div');boardGhost.className='m5-drag-ghost m5-board-drag-ghost';
        const im=document.createElement('img');im.src=src(charId(unit));im.alt='';
        const label=document.createElement('span');label.textContent=portraits[charId(unit)]?.name||window.ERRoster?.byId?.[charId(unit)]?.name||charId(unit);
        boardGhost.append(im,label);document.body.appendChild(boardGhost);
        document.body.classList.add('m5-board-dragging');
      }
      boardGhost.style.left=x+'px';boardGhost.style.top=y+'px';
      const sale=state.onlineSlot===null&&window.M5Economy?.dragSalePreview?.(x,y,unit.id);
      boardGhost.classList.toggle('m5-over-sell',!!sale);
      const bench=$('m5-bench-cards')?.getBoundingClientRect();
      boardGhost.classList.toggle('m5-over-bench',!!(bench&&x>=bench.left&&x<=bench.right&&y>=bench.top&&y<=bench.bottom));
    };
    canvas.addEventListener('pointermove',e=>{
      if(!gesture||e.pointerId!==gesture.pointerId)return;
      const p=pointerWorld(e);if(!p)return;
      gesture.now=p;
      if(!gesture.moving&&Math.hypot(p.x-gesture.down.x,p.y-gesture.down.y)>8)gesture.moving=true;
      if(gesture.moving){state.hover=p.valid&&p.cellX<3?{x:p.cellX,y:p.cellY}:null;const chosen=units.find(u=>u.id===gesture.id);if(chosen)moveBoardGhost(chosen,e.clientX,e.clientY);renderer.drag(gesture);renderer.paint();}
    });
    const end=e=>{
      if(!gesture||e.pointerId!==gesture.pointerId)return;
      const g=gesture;const wasSell=!!(boardGhost&&window.M5Economy?.dragSalePreview?.(e.clientX,e.clientY,g.id));
      gesture=null;state.hover=null;canvas.classList.remove('m5-unit-grabbed');removeBoardGhost();
      if(g.moving&&wasSell&&state.onlineSlot===null&&window.M5Economy?.sellDraggedUnit?.(g.id)){renderer.positions();render();feedback('실험체 판매 완료');return;}
      const p=pointerWorld(e);
      if(g.moving){
        // Dropping an owned battlefield unit into the M4-style bench dock
        // recalls that exact UID, rather than whichever card was last clicked.
        const benchRect=$('m5-bench-cards')?.getBoundingClientRect();
        const onBench=benchRect&&e.clientX>=benchRect.left&&e.clientX<=benchRect.right&&e.clientY>=benchRect.top&&e.clientY<=benchRect.bottom;
        if(onBench&&state.onlineSlot===null&&window.M5Economy?.recallDraggedUnit?.(g.id)){
          renderer.positions();render();feedback('벤치로 회수했어.');return;
        }
        const valid=p?.valid&&p.cellX<3;
        const original=units.find(u=>u.id===g.id);
        const other=valid?unitAt(p.cellX,p.cellY):null;
        const result=valid&&moveUnit(g.id,p.cellX,p.cellY);
        if(result&&original){feedback(other&&other!==original?`${(portraits[charId(original)]?.name||window.ERRoster?.byId?.[charId(original)]?.name||charId(original))} ↔ ${(portraits[charId(other)]?.name||window.ERRoster?.byId?.[charId(other)]?.name||charId(other))} 자리 교환`:`${(portraits[charId(original)]?.name||window.ERRoster?.byId?.[charId(original)]?.name||charId(original))} 배치 이동 완료`);}
        else{renderer.positions();render();feedback('아군 3×3 안쪽으로만 배치할 수 있어.');}
      }else{renderer.positions();render();}
    };
    canvas.addEventListener('dragover',e=>{if(state.mode==='prep'&&!combat&&state.onlineSlot===null&&window.M5Economy?.hasDrag?.()){e.preventDefault();e.dataTransfer.dropEffect='move';}});
    canvas.addEventListener('drop',e=>{if(state.mode!=='prep'||combat||state.onlineSlot!==null)return;const p=pointerWorld(e);if(p?.valid&&p.cellX<3){e.preventDefault();window.M5Economy?.drop?.(p.cellX,p.cellY);}});
    canvas.addEventListener('pointerup',end);
    canvas.addEventListener('pointercancel',e=>{if(gesture&&e.pointerId===gesture.pointerId){removeBoardGhost();gesture=null;state.hover=null;canvas.classList.remove('m5-unit-grabbed');renderer.positions();render();}});
    canvas.addEventListener('lostpointercapture',e=>{if(gesture&&e.pointerId===gesture.pointerId){removeBoardGhost();gesture=null;state.hover=null;canvas.classList.remove('m5-unit-grabbed');renderer.positions();render();}});
  }
  function buildCombatConfig(seed){
    const toEntry=u=>({characterId:charId(u),star:u.star||1,x:u.team==='A'?u.x:5-u.x,y:u.y,items:state.onlineSlot===null&&$('m5-crit-demo')?.checked&&u.team==='A'&&charId(u)==='aya'?['운명의 주사위','레가투스']:u.items||[]});
    return {teamA:units.filter(u=>u.team==='A').map(toEntry),teamB:units.filter(u=>u.team==='B').map(toEntry),
      masteryA:state.onlineSlot===null?(window.M5Economy?.getState?.()?.level||1):1,masteryB:1,moveInterval:.5,seed,arenaRegion:state.region};
  }
  function updateTacticalHud(){
    const bar=$('m5-tactical-hud');if(!bar)return;
    bar.hidden=!combat;
    const list=combat?.snapshot.units||[];
    for(const [team,id] of [['A','ally'],['B','enemy']]){
      const pool=list.filter(u=>visualTeam(u)===team),alive=pool.filter(u=>!u.dead&&u.hp>0);
      $("m5-hud-"+id).textContent=alive.length+' / '+pool.length;
      const pct=100*pool.reduce((sum,u)=>sum+Math.max(0,u.hp),0)/Math.max(1,pool.reduce((sum,u)=>sum+u.maxHp,0));
      $("m5-hud-"+id+'-hp').style.width=Math.max(0,Math.min(100,pct)).toFixed(2)+'%';
    }
    $('m5-hud-phase').textContent=combat?.finished?'전투 종료':combat?.paused?'전투 일시정지':'COMBAT / 교전 중';
    $('m5-hud-counter').textContent=combat?.snapshot.time.toFixed(1)+' SEC' || '00:00';
  }
  function buildRecap(){
    if(!combat?.finished||recapRendered)return;
    recapRendered=true;
    const b=combat,all=b.snapshot.units.filter(u=>u.role!=='소환수'&&u.role!=='야생동물');
    const max=Math.max(1,...all.map(u=>Object.values(u.damage||{}).reduce((a,v)=>a+v,0)));
    $('m5-battle-roster').replaceChildren(...all.map(u=>{
      const dmg=Math.round(Object.values(u.damage||{}).reduce((a,v)=>a+v,0));
      const e=document.createElement('div');e.className='m5-battle-member'+(visualTeam(u)==='B'?' enemy':'');
      const head=document.createElement('div');head.className='head';
      const name=document.createElement('b');name.textContent=u.name;const val=document.createElement('span');val.textContent=dmg.toLocaleString('ko-KR');head.append(name,val);
      const track=document.createElement('div');track.className='damage';const fill=document.createElement('i');fill.style.width=(dmg/max*100).toFixed(1)+'%';track.append(fill);
      const foot=document.createElement('small');foot.textContent=`받은 피해 ${Math.round(u.damageTaken||0).toLocaleString('ko-KR')} · ${u.dead?'전투 불능':'생존'}`;
      e.append(head,track,foot);return e;
    }));
    $('m5-analysis-result').textContent=b.snapshot.outcome;
    $('m5-battle-analysis').hidden=false;
    const result=$('m5-battle-result');result.hidden=false;
    const ownWin=state.onlineSlot===1?'B팀 승리':'A팀 승리';
    const outcome=b.snapshot.outcome;
    const title=outcome==='무승부'?'DRAW / 무승부':outcome===ownWin?'VICTORY / 승리':'DEFEAT / 패배';
    $('m5-result-title').textContent=title;
    $('m5-result-sub').textContent=b.consistent?'전투 엔진 결과 일치 · 시드 '+b.config.seed:'전투 종료 · 검증 상태를 확인해 줘';
    $('m5-result-score').replaceChildren(...[
      ['전투 시간',b.snapshot.time.toFixed(1)+'초'],['치명타',String(b.critCount)+'회'],['생존 인원',String(b.snapshot.units.filter(u=>visualTeam(u)==='A'&&!u.dead).length)+'명']
    ].map(([name,value])=>{const e=document.createElement('span'),t=document.createElement('b');t.textContent=value;e.textContent=name;e.append(t);return e;}));
    $('m5-result-back').hidden=state.onlineSlot!==null;
    if(state.onlineSlot!==null)$('m5-result-sub').textContent+=' · 서버가 다음 라운드를 진행해';
  }
  function updateCombatUI(){
    const live=$('combat-live'), start=$('combat-start'), pause=$('combat-pause'), stop=$('combat-stop');
    if(!live)return;
    const b=combat;
    const label=b?(b.finished?`전투 종료 · ${b.snapshot.outcome}`:b.paused?'일시정지':'실제 전투 재생 중'):'배치 모드 · 준비 완료';
    live.textContent=b?`${label} / ${b.snapshot.time.toFixed(2)}초`:`${label} · 시작 시 실제 전투 엔진 실행`;
    $('combat-time').textContent=b?b.snapshot.time.toFixed(1)+'s':'0.0s';
    start.disabled=!!b||state.onlineSlot!==null;pause.disabled=!b||b.finished||state.onlineSlot!==null;stop.disabled=!b||state.onlineSlot!==null;$('combat-speed').disabled=!b||state.onlineSlot!==null;
    pause.textContent=b?.paused?'▶ 재개':'Ⅱ 일시정지';
    $('combat-result').textContent=b?.finished?`${b.snapshot.outcome} · ${b.consistent?'엔진 결과 일치 ✓':'결과 검증 불일치 ⚠'}${b.serverOutcome?' · 서버 '+(b.serverMatch?'일치 ✓':'불일치 ⚠'):''}`:'';
    $('combat-log').replaceChildren(...(b?.logs||[]).slice(-8).reverse().map(t=>{const li=document.createElement('li');li.textContent=t;return li;}));
    $('mode-combat').disabled=!!b||state.onlineSlot!==null;$('mode-prep').disabled=!!b||state.onlineSlot!==null;$('reset-units').disabled=!!b||state.onlineSlot!==null;
    $('combat-speed').textContent=`속도 ${b?.speed || 1}×`;
    updateTacticalHud();
    if(b?.finished)buildRecap();
    updateInfo();
  }
  function startCombat(override=null){
    if(combat)return false;
    if(!window.ERCombat?.CombatEngine){feedback('기존 전투 엔진 스크립트가 로드되지 않았어.');return false;}
    const rawSeed=Number($('combat-seed').value),seed=Number.isSafeInteger(rawSeed)&&rawSeed>=1&&rawSeed<=2147483646?rawSeed:123456;
    $('combat-seed').value=String(seed);
    const cfg=override||buildCombatConfig(seed);
    try {
      // Reference run uses the very same original engine and exact same config.
      const expected=new ERCombat.CombatEngine(cfg).run();
      const engine=new (window.M5Combat?.CombatEngine||ERCombat.CombatEngine)(cfg);
      engine.start();
      const snapshot=engine.getResult();
      combat={engine,config:cfg,expected,snapshot,paused:false,finished:false,consistent:null,speed:1,logs:[],critCount:0};
      window.M5Systems?.refreshSynergies?.();
      visual.clear();floaters.length=0;flashes.length=0;combatEffects.length=0;
      damageLanes.clear();lastImpactFx.clear();recapRendered=false;
      $('m5-battle-result').hidden=true;$('m5-battle-analysis').hidden=true;
      for(const u of snapshot.units){const p=spritePoint(u);visual.set(u.id,{x:p.x,y:p.y});}
      renderer?.prepareBattleSprites?.(snapshot.units);
      const events=engine.drainEvents();for(const e of events)if(e.type==='log') combat.logs.push(stripLog(e.message));
      state.mode='combat';state.hover=null;gesture=null;
      renderer.mode();
      lastFrame=nowMs();lag=0;lastStatus=0;
      updateCombatUI();
      if(raf!==null)cancelAnimationFrame(raf);
      raf=requestAnimationFrame(combatFrame);
      return true;
    } catch(err){console.error('[M5 combat]',err);feedback('전투 시작 실패: '+err.message);combat=null;return false;}
  }
  function stripLog(html){const el=document.createElement('div');el.innerHTML=html;return el.textContent||'';}
  function markFx(u,kind,text){
    if(!u)return;
    const p=visual.get(u.id)||spritePoint(u),now=nowMs();
    const duration=kind==='attack'?165:kind==='hit'?160:kind==='crit'?245:kind==='skill'?500:kind==='kill'?520:200;
    flashes.push({key:u.id,kind,at:now,until:now+duration});
    if(['hit','crit','skill','kill'].includes(kind))fxBurst(kind,p.x,p.y-102,
      kind==='crit'?'#ffd78c':kind==='hit'?'#ffadb6':kind==='kill'?'#d4e4eb':'#b1e9ff',u.id);
    if(kind==='crit'||kind==='skill'||kind==='kill')tuneSound(kind);
    if(text){
      const isDamage=kind==='hit'||kind==='crit';
      let slot=0;
      if(isDamage){
        const lane=damageLanes.get(u.id);
        slot=lane&&now-lane.at<510?Math.min(4,lane.slot+1):0;
        damageLanes.set(u.id,{slot,at:now});
      }
      // Small diagonal overlap, rather than fan-shaped scattering. Clamp the
      // entire staircase to the canvas, including the top and right edges.
      const px=isDamage?p.x+slot*27:p.x;
      const py=p.y-179-(isDamage?slot*19:0);
      floaters.push({targetId:u.id,kind,x:clamp(px,75,viewW()-92),
        y:clamp(py,54,H-45),text,
        color:kind==='crit'?'#ffe49e':kind==='hit'?'#ffb0b7':kind==='heal'?'#8bffcc':'#d1eafb',
        critical:kind==='crit',duration:kind==='crit'?CRIT_FLOAT_MS:FLOAT_MS,at:now});
    }
    while(floaters.length>36)floaters.shift();
  }
  function stepCombat(){
    const b=combat;if(!b||b.finished)return;
    const old=new Map(b.snapshot.units.map(u=>[u.id,u]));
    b.engine.step();
    b.snapshot=b.engine.getResult();
    for(const u of b.snapshot.units){
      const v=old.get(u.id);
      if(!visual.has(u.id)){const p=spritePoint(u);visual.set(u.id,{x:p.x,y:p.y});}
      if(!v)continue;
      if(u.basicCount>v.basicCount){
        markFx(u,'attack',null);
        const enemies=b.snapshot.units.filter(t=>t.team!==u.team&&!t.dead);
        enemies.sort((a,b)=>(a.x-u.x)**2+(a.y-u.y)**2-((b.x-u.x)**2+(b.y-u.y)**2));
        // Attacks are conveyed by sprite movement and target impact, not lines.
      }
      if(u.hp>v.hp+1.0)markFx(u,'heal','+'+Math.round(u.hp-v.hp).toLocaleString('ko-KR'));
      if(u.dead&&!v.dead)markFx(u,'kill','KO');
    }
    for(const e of b.engine.drainEvents()){
      if(e.type==='damage' && e.amount>0){
        const receiver=b.snapshot.units.find(u=>u.id===e.unitId);
        if(receiver){
          markFx(receiver,e.critical?'crit':'hit',Number(e.amount).toLocaleString('ko-KR'));
          if(e.critical)b.critCount++;
          // Long attacker-to-target lines intentionally removed.
        }
      }
      if(e.type!=='log')continue;
      const line=stripLog(e.message);b.logs.push(`[${e.time.toFixed(1)}] ${line}`);
      if(b.logs.length>70)b.logs.shift();
      if(line.includes('[스킬]')){
        const caster=b.snapshot.units.find(u=>line.includes(u.name));
        if(caster){markFx(caster,'skill',null);
          const name=line.split('→').slice(1).join('→').trim().slice(0,22);
          if(name){
            const p=visual.get(caster.id)||spritePoint(caster);
            floaters.push({targetId:caster.id,kind:'skill',x:clamp(p.x,90,viewW()-90),
              y:clamp(p.y-225,40,H-60),text:name,color:'#d6f5ff',critical:false,duration:920,at:nowMs()});
          }
        }
      }
    }
    if(b.snapshot.battleOver){
      b.finished=true;b.paused=true;
      const x=b.expected,y=b.snapshot;
      b.serverMatch=!b.serverOutcome||b.serverOutcome===y.outcome;
      b.consistent=x.outcome===y.outcome&&Math.abs(x.time-y.time)<1e-7&&x.units.length===y.units.length&&x.units.every((u,i)=>u.id===y.units[i].id&&Math.abs(u.hp-y.units[i].hp)<.001&&u.x===y.units[i].x&&u.y===y.units[i].y);
      b.logs.push(`[${y.time.toFixed(1)}] ${y.outcome} · 재현 검증 ${b.consistent?'일치':'불일치'}`);
      if(farmSession && !farmSession.paid && state.onlineSlot===null){
        farmSession.paid=true;
        const killed=y.units.filter(u=>u.team==='B'&&u.dead&&window.ERRoster?.byId?.[u.characterId]?.pveOnly);
        window.M5Systems?.rewardFarm?.(farmSession.round,killed);
      }
    }
  }
  function combatFrame(now){
    raf=null;
    if(!combat)return;
    const dt=Math.min(.1,(now-lastFrame)/1000);lastFrame=now;
    if(!combat.paused&&!combat.finished){
      lag+=dt*combat.speed;
      const step=ERCombat.DT;
      for(let i=0;lag+1e-9>=step&&i<20&&!combat.finished;i++){stepCombat();lag-=step;}
    }
    for(const u of combat.snapshot.units){const target=spritePoint(u),v=visual.get(u.id);if(!v)continue;v.x+=(target.x-v.x)*Math.min(1,dt*12);v.y+=(target.y-v.y)*Math.min(1,dt*12);}
    renderer?.paint();
    if(now-lastStatus>145||combat.finished&&lastStatus!==Infinity){updateCombatUI();lastStatus=combat.finished?Infinity:now;}
    if(!combat.finished||floaters.length||flashes.length||combatEffects.length){
      const t=nowMs();for(let i=floaters.length-1;i>=0;i--)if(t-floaters[i].at>floaters[i].duration)floaters.splice(i,1);
      for(let i=flashes.length-1;i>=0;i--)if(t>flashes[i].until)flashes.splice(i,1);
      for(let i=combatEffects.length-1;i>=0;i--)if(t-combatEffects[i].at>combatEffects[i].duration)combatEffects.splice(i,1);
      raf=requestAnimationFrame(combatFrame);
    }
  }
  function pauseCombat(){if(!combat||combat.finished)return false;combat.paused=!combat.paused;lastFrame=nowMs();updateCombatUI();if(raf===null)raf=requestAnimationFrame(combatFrame);return true;}
  function changeSpeed(){if(!combat)return false;combat.speed=combat.speed===1?2:1;updateCombatUI();return combat.speed;}
  function stopCombat(){
    if(!combat)return false;
    farmSession=null;
    if(raf!==null)cancelAnimationFrame(raf);raf=null;
    combat=null;lag=0;visual.clear();floaters.length=0;flashes.length=0;combatEffects.length=0;
    damageLanes.clear();lastImpactFx.clear();recapRendered=false;
    $('m5-battle-result').hidden=true;$('m5-battle-analysis').hidden=true;$('m5-tactical-hud').hidden=true;
    state.mode='prep';state.x=Math.min(state.x,2);
    renderer?.mode();renderer?.positions(true);
    updateCombatUI();return true;
  }
  function fxFor(key){return flashes.filter(f=>f.key===key);}
  function drawHpCanvas(c,u,p){
    const pct=clamp01(u.hp/Math.max(1,u.maxHp)),x=p.x-83,y=hpTop(u,p);
    c.fillStyle='#071117dd';c.fillRect(x-3,y-3,172,19);
    c.fillStyle='#2e3a40';c.fillRect(x,y,166,11);
    c.fillStyle=visualTeam(u)==='A'?'#73e0e7':'#f09aaf';c.fillRect(x,y,166*pct,11);
    if(u.skill?.shield>0){c.fillStyle='#9bd5f4';c.fillRect(x,y+13,166*clamp01(u.skill.shield/Math.max(1,u.maxHp)),3);}
    if(u.ccUntil>combat.snapshot.time||u.sleepUntil>combat.snapshot.time){c.fillStyle='#ffd888';c.fillRect(p.x-2,y-12,5,8);}
  }
  function drawFloatCanvas(c){
    const now=nowMs();
    for(const f of floaters){
      const t=clamp01((now-f.at)/f.duration),fade=t<.38?1:(1-t)/.62;
      const lift=f.critical?43:30,scale=f.critical?1.12-.12*Math.min(1,t*4):1;
      c.save();c.globalAlpha=fade;c.textAlign='center';c.textBaseline='alphabetic';
      c.translate(f.x,f.y-lift*t);c.scale(scale,scale);
      c.font=f.critical?'italic 900 48px sans-serif':f.kind==='skill'?'bold 26px sans-serif':'bold 31px sans-serif';
      c.strokeStyle='#061018';c.lineJoin='round';c.lineWidth=f.critical?7:5;
      c.strokeText(f.text,0,0);c.fillStyle=f.color;c.fillText(f.text,0,0);c.restore();
    }
  }
  function paintCinematicPixi(g){
    g.clear();if(!combat||!state.vfx)return;
    const now=nowMs();
    for(const e of combatEffects){
      const t=clamp01((now-e.at)/e.duration),a=1-t;
      const color=Number.parseInt(e.color.replace('#',''),16);
      // Restrained, local impact. Skills remain noticeably larger than hits.
      const radius=e.kind==='skill'?42+78*t:e.kind==='kill'?26+59*t:
        e.kind==='crit'?20+52*t:12+27*t;
      const alpha=(e.kind==='hit'?.25:e.kind==='crit'?.55:.45)*a;
      g.circle(e.x,e.y,radius).stroke({color,width:e.kind==='skill'?5:3,alpha});
      if(e.kind==='crit')g.circle(e.x,e.y,radius*.53).fill({color,alpha:alpha*.23});
    }
  }
  function paintCinematicCanvas(c){
    if(!combat||!state.vfx)return;
    const now=nowMs();c.save();c.globalCompositeOperation='screen';
    for(const e of combatEffects){
      const t=clamp01((now-e.at)/e.duration),a=1-t;
      c.globalAlpha=(e.kind==='hit'?.25:e.kind==='crit'?.55:.45)*a;
      c.strokeStyle=e.color;c.fillStyle=e.color;
      const r=e.kind==='skill'?42+78*t:e.kind==='kill'?26+59*t:e.kind==='crit'?20+52*t:12+27*t;
      c.lineWidth=e.kind==='skill'?5:3;c.beginPath();c.arc(e.x,e.y,r,0,Math.PI*2);c.stroke();
      if(e.kind==='crit'){c.globalAlpha*=.23;c.beginPath();c.arc(e.x,e.y,r*.53,0,Math.PI*2);c.fill();}
    }
    c.restore();
  }
  function rectGridPixi(g){
    g.clear();
    if(state.grid){
      for(let y=0;y<ROWS;y++)for(let x=0;x<visibleCols();x++){
        g.rect(x*CW+2,y*CH+2,CW-4,CH-4).stroke({width:2,color:x<3?0x9bc5d2:0xe0a9bf,alpha:.25});
      }
      if(state.mode==='combat')g.moveTo(3*CW,0).lineTo(3*CW,H).stroke({width:5,color:0x9ebbc3,alpha:.46});
    }
    if(state.points){
      for(let y=0;y<ROWS;y++)for(let x=0;x<visibleCols();x++){
        const p=foot(x,y);
        g.circle(p.x,p.y,6).fill({color:x<3?0x86d7e7:0xe8a8b8,alpha:.66});
        g.circle(p.x,p.y,13).stroke({width:2,color:0xe6f4f6,alpha:.3});
      }
    }
  }
  function rectanglePixi(g,x,y,color,alpha=.16){
    g.rect(x*CW+4,y*CH+4,CW-8,CH-8).fill({color,alpha});
    g.rect(x*CW+5,y*CH+5,CW-10,CH-10).stroke({width:3,color,alpha:.5});
    const sx=x*CW,sy=y*CH,d=28,p=13;
    const arr=[[[sx+p+d,sy+p],[sx+p,sy+p],[sx+p,sy+p+d]],[[sx+CW-p-d,sy+p],[sx+CW-p,sy+p],[sx+CW-p,sy+p+d]],[[sx+p+d,sy+CH-p],[sx+p,sy+CH-p],[sx+p,sy+CH-p-d]],[[sx+CW-p-d,sy+CH-p],[sx+CW-p,sy+CH-p],[sx+CW-p,sy+CH-p-d]]];
    for(const pts of arr)g.moveTo(pts[0][0],pts[0][1]).lineTo(pts[1][0],pts[1][1]).lineTo(pts[2][0],pts[2][1]);
    g.stroke({width:5,color,alpha:.95});
  }
  class PixiField {
    async init(){
      const P=window.PIXI;
      if(!P?.Application||!P?.Assets)throw Error('PixiJS를 불러오지 못했어');
      this.P=P;this.app=new P.Application();
      await this.app.init({width:W,height:H,backgroundAlpha:0,antialias:true,autoDensity:false,preference:'webgl'});
      this.canvas=this.app.canvas;this.canvas.setAttribute('aria-label','실험체 배치 가능한 PixiJS 전장');
      root.replaceChildren(this.canvas);
      const floor=await P.Assets.load(FLOOR_URL);
      if(Math.round(floor.width)!==W||Math.round(floor.height)!==H)throw Error('바닥 원본은 2100×900이어야 해');
      this.floorSprite=new P.Sprite(floor);this.app.stage.addChild(this.floorSprite);
      this.floorSprite.tint=0xbfbfbf;
      this.grid=new P.Graphics();this.markers=new P.Graphics();
      this.app.stage.addChild(this.grid,this.markers);
      this.pieces=new P.Container();this.pieces.sortableChildren=true;this.app.stage.addChild(this.pieces);
      this.fxLayer=new P.Graphics();this.app.stage.addChild(this.fxLayer);
      this.labels=new P.Container();this.app.stage.addChild(this.labels);this.textPool=[];
      this.sprites=new Map();this.textureCache=new Map();
      const initialUnits=units.map(u=>({...u}));
      const results=await Promise.allSettled(initialUnits.map(async u=>[charId(u),await P.Assets.load(src(charId(u)))]));
      for(let i=0;i<results.length;i++){
        if(results[i].status!=='fulfilled')throw Error(`${initialUnits[i].id} 캐릭터 PNG 불러오기 실패`);
        const [id,texture]=results[i].value,meta=portraits[id]||OTHER_BOUNDS,bb=meta.bounds;this.textureCache.set(id,texture);
        const node=new P.Container();
        const shadow=new P.Graphics().ellipse(0,-5,73,17).fill({color:0x02080e,alpha:.54});
        const ring=new P.Graphics().ellipse(0,-7,84,23).stroke({width:4,color:initialUnits[i].team==='A'?0x83d9e4:0xe8a7bd,alpha:.78});
        node.addChild(shadow,ring);
        const sprite=new P.Sprite(texture);
        const naturalWidth=texture.width,naturalHeight=texture.height;
        sprite.anchor.set((bb[0]+bb[2])/2/naturalWidth,bb[3]/naturalHeight);
        const sc=Math.min(250/(bb[3]-bb[1]),215/(bb[2]-bb[0]));
        sprite.scale.set(initialUnits[i].team==='B'?-sc:sc,sc);
        sprite.position.set(0,0);node.addChild(sprite);
        const hp=new P.Graphics();node.addChild(hp);
        this.pieces.addChild(node);this.sprites.set(initialUnits[i].team+':'+initialUnits[i].id,{node,sprite});
      }
      this.mode();
    }
    async setFloor(url){if(this.activeFloor===url)return;const texture=await this.P.Assets.load(url);if(this.activeFloor===url)return;this.activeFloor=url;this.floorSprite.texture=texture;this.paint();}
    async prepareBattleSprites(list){
      for(const u of list){
        if(this.sprites.has(u.id))continue;
        const cid=u.characterId,tex=this.textureCache.get(cid)||await this.P.Assets.load(src(cid)).catch(()=>null);
        if(!tex)continue;this.textureCache.set(cid,tex);
        const meta=portraits[cid]||OTHER_BOUNDS,bb=meta.bounds,P=this.P,node=new P.Container();
        const shadow=new P.Graphics().ellipse(0,-5,73,17).fill({color:0x02080e,alpha:.54});
        const ring=new P.Graphics().ellipse(0,-7,84,23).stroke({width:4,color:u.team==='A'?0x83d9e4:0xe8a7bd,alpha:.78});
        const sprite=new P.Sprite(tex);sprite.anchor.set((bb[0]+bb[2])/2/tex.width,bb[3]/tex.height);
        const sc=Math.min(250/(bb[3]-bb[1]),215/(bb[2]-bb[0]));sprite.scale.set(u.team==='B'?-sc:sc,sc);
        node.addChild(shadow,ring,sprite,new P.Graphics());this.pieces.addChild(node);
        this.sprites.set(u.id,{node,sprite});
      }
      this.paint();
    }
    mode(){this.app.renderer.resize(viewW(),H);this.positions(true);this.paint();}
    positions(){for(const u of units){const obj=this.sprites.get(u.team+':'+u.id);if(!obj)continue;const p=spritePoint(u);obj.node.position.set(p.x,p.y);obj.node.zIndex=p.y;obj.node.visible=state.mode==='combat'||isOwn(u);obj.node.alpha=1;}}
    drag(g){const o=this.sprites.get('A:'+g.id);if(!o)return;const u=units.find(x=>x.id===g.id),p=spritePoint(u);o.node.position.set(p.x+g.now.x-g.down.x,p.y+g.now.y-g.down.y);o.node.zIndex=2000;o.node.alpha=.8;}
    pick(x,y){
      // Hit regions follow the visible alpha bounds/ground-contact positions,
      // allowing the upper half of a sprite to be grabbed over an adjacent cell.
      return units.filter(u=>state.mode==='combat'||isOwn(u)).slice().reverse().find(u=>{
        const p=spritePoint(u),bb=(portraits[charId(u)]||OTHER_BOUNDS).bounds,scale=Math.min(250/(bb[3]-bb[1]),215/(bb[2]-bb[0]));
        return Math.abs(x-p.x)<(bb[2]-bb[0])*scale*.5 && y<=p.y+10 && y>=p.y-(bb[3]-bb[1])*scale;
      })||null;
    }
    paint(){
      const shade=Math.round(state.brightness*255);this.floorSprite.tint=(shade<<16)|(shade<<8)|shade;
      rectGridPixi(this.grid);this.markers.clear();
      if(!combat)rectanglePixi(this.markers,state.x,state.y,state.x<3?0x8ae1eb:0xf2b8c9,.10);
      if(state.hover)rectanglePixi(this.markers,state.hover.x,state.hover.y,0xa3ffcc,.14);
      const clock=nowMs(), drawn=getDrawUnits();
      for(const v of this.sprites.values())v.node.visible=false;
      for(const u of drawn){const obj=this.sprites.get(u.drawKey)||this.sprites.get(u.id);if(!obj)continue;
        const p=combat ? visual.get(u.drawKey)||spritePoint(u):spritePoint(u);
        let shift=0;const acting=fxFor(u.drawKey);
        const attack=acting.find(f=>f.kind==='attack');
        if(attack){const t=clamp01((clock-attack.at)/(attack.until-attack.at));
          shift=(visualTeam(u)==='A'?1:-1)*12*Math.sin(Math.PI*t);}
        const isGrabbed=!combat&&gesture?.moving&&gesture.id===u.id;
        const dragShift=isGrabbed?{x:gesture.now.x-gesture.down.x,y:gesture.now.y-gesture.down.y}:{x:0,y:0};
        obj.node.position.set(p.x+shift+dragShift.x,p.y+dragShift.y);
        obj.node.zIndex=isGrabbed?2000:p.y;
        obj.node.visible=state.mode==='combat'||isOwn(u);
        obj.node.alpha=isGrabbed?.83:u.dead?.22:1;
        obj.sprite.tint=acting.some(f=>f.kind==='hit'||f.kind==='crit')?0xffd8de:0xffffff;
        const bb=(portraits[charId(u)]||OTHER_BOUNDS).bounds,sc=Math.min(250/(bb[3]-bb[1]),215/(bb[2]-bb[0]))*(u.y===0?.78:1);obj.sprite.scale.set(visualTeam(u)==='B'?-sc:sc,sc);
        obj.node.children[1].alpha=combat?.35:state.activeUnitId===u.id?1:.60;const ring=obj.node.children[1];ring.clear().ellipse(0,-7,84,23).stroke({width:4,color:visualTeam(u)==='A'?0x83d9e4:0xe8a7bd,alpha:.78});
        const h=obj.node.children[3];h.clear();
        if(combat){
          const pct=clamp01(u.hp/Math.max(1,u.maxHp));
          h.roundRect(-87,hpTop(u,p)-p.y-3,174,17,3).fill({color:0x041018,alpha:.93});
          h.rect(-83,hpTop(u,p)-p.y,166,11).fill({color:0x26343c});
          h.rect(-83,hpTop(u,p)-p.y,166*pct,11).fill({color:visualTeam(u)==='A'?0x70dce5:0xe895ae});
          if(u.skill?.shield>0)h.rect(-83,hpTop(u,p)-p.y+14,166*clamp01(u.skill.shield/Math.max(1,u.maxHp)),3).fill({color:0x9dd8fa});
          // Skill activation is rendered once in the effect layer, not repeated on the HP bar.
          if(u.ccUntil>combat.snapshot.time||u.sleepUntil>combat.snapshot.time)h.circle(0,-240,10).fill({color:0xf8d18b});
        }
      }
      paintCinematicPixi(this.fxLayer);
      for(const label of this.textPool)label.visible=false;
      if(combat)for(let i=0;i<floaters.length;i++){
        const f=floaters[i],t=clamp01((clock-f.at)/f.duration);
        const fade=t<.38?1:(1-t)/.62;
        if(!this.textPool[i]){
          const label=new this.P.Text({text:'',style:{fontSize:28,fontWeight:'bold',fontFamily:'sans-serif',fill:0xffffff,stroke:{color:0x081015,width:4}}});
          label.anchor.set(.5,.5);this.labels.addChild(label);this.textPool[i]=label;
        }
        const label=this.textPool[i];label.visible=true;label.text=f.text;label.style.fill=f.color;
        label.position.set(f.x,f.y-t*(f.critical?43:30));label.alpha=fade;
        label.style.fontStyle=f.critical?'italic':'normal';
        label.style.fontWeight=f.critical?'900':'bold';label.style.fontSize=f.critical?48:f.kind==='skill'?26:31;
        label.scale.set(f.critical?1.12-.12*Math.min(1,t*4):1);
      }
    }
  }
  function canvasRectangle(c,x,y,color){
    c.fillStyle=color+'23';c.fillRect(x*CW+4,y*CH+4,CW-8,CH-8);
    c.strokeStyle=color;c.lineWidth=4;c.strokeRect(x*CW+8,y*CH+8,CW-16,CH-16);
  }
  class CanvasField {
    async init(){
      this.canvas=document.createElement('canvas');this.canvas.setAttribute('aria-label','실험체 배치 가능한 Canvas 전장');
      root.replaceChildren(this.canvas);
      this.ctx=this.canvas.getContext('2d',{alpha:false});
      const preloadIds=[...new Set(units.map(u=>charId(u)))];
      const files=await Promise.all([FLOOR_URL,...preloadIds.map(id=>src(id))].map(url=>new Promise((resolve,reject)=>{
        const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error(`이미지 로드 실패: ${url}`));im.src=url;
      })));
      this.floor=files.shift();if(this.floor.naturalWidth!==W||this.floor.naturalHeight!==H)throw Error('바닥 원본은 2100×900이어야 해');
      this.images=new Map(preloadIds.map((id,i)=>[id,files[i]]));
      this.mode();
    }
    async setFloor(url){if(this.activeFloor===url)return;const image=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=url});this.floor=image;this.activeFloor=url;this.paint();}
    async prepareBattleSprites(list){
      await Promise.all([...new Set(list.map(u=>u.characterId))].filter(id=>!this.images.has(id)).map(id=>new Promise(resolve=>{
        const im=new Image();im.onload=()=>{this.images.set(id,im);this.paint();resolve();};im.onerror=()=>resolve();im.src=src(id);
      })));
      this.paint();
    }
    mode(){this.canvas.width=viewW();this.canvas.height=H;this.paint();}
    positions(){this.paint();}
    drag(){this.paint();}
    pick(x,y){return units.filter(u=>state.mode==='combat'||isOwn(u)).slice().reverse().find(u=>{
      const p=spritePoint(u),bb=(portraits[charId(u)]||OTHER_BOUNDS).bounds,scale=Math.min(250/(bb[3]-bb[1]),215/(bb[2]-bb[0]));
      return Math.abs(x-p.x)<(bb[2]-bb[0])*scale*.5&&y<=p.y+10&&y>=p.y-(bb[3]-bb[1])*scale;
    })||null;}
    paint(){
      if(!this.ctx)return;const c=this.ctx;c.clearRect(0,0,viewW(),H);c.save();c.filter=`brightness(${state.brightness}) saturate(.88)`;c.drawImage(this.floor,0,0);c.restore();
      if(state.grid){for(let y=0;y<3;y++)for(let x=0;x<visibleCols();x++){
        c.strokeStyle=x<3?'#a2cbd04c':'#f1b4bc4c';c.lineWidth=2;c.strokeRect(x*CW+2,y*CH+2,CW-4,CH-4);
      }}
      if(state.points){for(let y=0;y<3;y++)for(let x=0;x<visibleCols();x++){
        const p=foot(x,y);c.beginPath();c.arc(p.x,p.y,7,0,Math.PI*2);c.fillStyle=x<3?'#87d5e3':'#e5b2c2';c.fill();
      }}
      if(!combat)canvasRectangle(c,state.x,state.y,state.x<3?'#8ae1eb':'#f2b8c9');
      if(state.hover)canvasRectangle(c,state.hover.x,state.hover.y,'#a3ffcc');
      const ordered=getDrawUnits().filter(u=>state.mode==='combat'||isOwn(u)).slice().sort((a,b)=>a.y-b.y||a.x-b.x);
      for(const u of ordered){const meta=portraits[charId(u)]||OTHER_BOUNDS,bb=meta.bounds,im=this.images.get(charId(u)),p=combat?visual.get(u.drawKey)||spritePoint(u):spritePoint(u);
        const shift=gesture?.moving&&gesture.id===u.id?{x:gesture.now.x-gesture.down.x,y:gesture.now.y-gesture.down.y}:{x:0,y:0};
        const acting=fxFor(u.drawKey),attack=acting.find(f=>f.kind==='attack');
        const bump=attack?(visualTeam(u)==='A'?1:-1)*12*Math.sin(Math.PI*clamp01((nowMs()-attack.at)/(attack.until-attack.at))):0;
        const cx=p.x+shift.x+bump,cy=p.y+shift.y,scale=Math.min(250/(bb[3]-bb[1]),215/(bb[2]-bb[0]))*(u.y===0?.78:1);
        c.save();if(gesture?.moving&&gesture.id===u.id)c.globalAlpha=.8;if(u.dead)c.globalAlpha=.22;
        c.beginPath();c.ellipse(cx,cy-5,75,20,0,0,2*Math.PI);c.fillStyle='#020b128e';c.fill();
        c.beginPath();c.ellipse(cx,cy-7,84,23,0,0,2*Math.PI);c.strokeStyle=visualTeam(u)==='A'?'#83d9e4a0':'#e8a7bda0';c.lineWidth=4;c.stroke();
        const mid=(bb[0]+bb[2])/2;
        c.save();c.translate(cx,cy);if(visualTeam(u)==='B')c.scale(-1,1);
        if(acting.some(f=>f.kind==='hit'||f.kind==='crit')){c.shadowColor='#ffb4c0';c.shadowBlur=9;c.filter='brightness(1.08)';}
        if(im?.complete&&im.naturalWidth>0)c.drawImage(im,-mid*scale,-bb[3]*scale,im.width*scale,im.height*scale);
        else {c.fillStyle='#acdce9ab';c.font='bold 19px sans-serif';c.textAlign='center';c.fillText('불러오는 중',0,-24);}
        c.restore();
        // Skill burst is drawn by paintCinematicCanvas: avoid a second overlapping ring.
        if(combat)drawHpCanvas(c,u,{x:cx,y:cy});
        c.restore();
      }
      if(combat){paintCinematicCanvas(c);drawFloatCanvas(c);}
    }
  }
  function fail(err){root.replaceChildren();const e=document.createElement('p');e.className='lab-error';e.textContent=`이미지를 표시하지 못했어: ${err.message}`;root.appendChild(e);$('renderer-status').textContent='로드 오류';}
  async function boot(){
    try{const pixi=new PixiField();await pixi.init();renderer=pixi;state.engine='pixi';}
    catch(err){console.warn('[L.I.V.E. M5] PixiJS 로딩/초기화 실패, Canvas 경로 사용:',err);
      try{const canvas=new CanvasField();await canvas.init();renderer=canvas;state.engine='canvas';}
      catch(e){fail(e);return;}
    }
    startInput();
    render();
  }
  // M5-09: visual director panel retired. Stage defaults remain brightness 75%, VFX ON.

  $('m5-result-back').addEventListener('click',()=>{if(state.onlineSlot===null)stopCombat();});
  $('m5-region-select').addEventListener('change',e=>setRegion(e.target.value).catch(err=>feedback('지역 이미지 로드 실패: '+err.message)));
  $('combat-start').addEventListener('click',()=>startCombat());
  $('combat-pause').addEventListener('click',pauseCombat);
  $('combat-stop').addEventListener('click',stopCombat);
  $('combat-speed').addEventListener('click',changeSpeed);
  $('mode-combat').addEventListener('click',()=>setMode('combat'));
  $('mode-prep').addEventListener('click',()=>setMode('prep'));
  $('toggle-grid').addEventListener('click',()=>toggle('grid'));
  $('toggle-points').addEventListener('click',()=>toggle('points'));
  $('select-next').addEventListener('click',()=>{
    const n=(state.y*visibleCols()+state.x+1)%(visibleCols()*ROWS);
    selectCell(n%visibleCols(),Math.floor(n/visibleCols()));
  });
  $('reset-units').addEventListener('click',resetUnits);
  document.querySelectorAll('[data-unit-id]').forEach(btn=>btn.addEventListener('click',()=>{
    const u=units.find(x=>x.id===btn.dataset.unitId || charId(x)===btn.dataset.unitId);if(!u)return;
    if(state.mode==='prep'&&!isOwn(u)){feedback('준비 모드에서는 내 팀만 선택할 수 있어.');return;}
    state.activeUnitId=u.id;state.x=viewX(u.x);state.y=u.y;render();
  }));
  document.addEventListener('keydown',e=>{
    if(e.target instanceof HTMLElement&&['INPUT','TEXTAREA','BUTTON'].includes(e.target.tagName))return;
    if(combat)return;
    let x=state.x,y=state.y;
    if(e.key==='ArrowLeft')x--;else if(e.key==='ArrowRight')x++;
    else if(e.key==='ArrowUp')y--;else if(e.key==='ArrowDown')y++;
    else return;
    e.preventDefault();selectCell(clamp(x,0,visibleCols()-1),clamp(y,0,2));
  });
  if(typeof ResizeObserver==='function')new ResizeObserver(updateSize).observe(document.querySelector('.lab-stage-space'));
  window.addEventListener('resize',updateSize,{passive:true});
  // Read-only M5 sandbox. No reference to LIVEApplyGame, server sessions or M4 globals.

  async function setRegion(id){
    if(!REGIONS[id])return false;
    state.region=id;$('m5-region-select').value=id;FLOOR_URL=`assets/m5/floor/${id}.png`;
    $('lab-region-name').textContent=REGIONS[id];
    $('lab-region-effect').textContent=window.ERCombat?.ARENA_REGIONS?.[id]?.detail||'지역 정보';
    await renderer?.setFloor?.(FLOOR_URL);
    window.M5Systems?.refreshSynergies?.();
    return true;
  }

  function startFarm(round){
    if(state.onlineSlot!==null||combat||![1,3].includes(round))return false;
    const own=units.filter(u=>u.team==='A').map(u=>({characterId:charId(u),x:u.x,y:u.y,star:u.star||1,items:u.items||[]}));
    if(!own.length){feedback('파밍할 실험체를 1명 이상 배치해.');return false;}
    const animals=(WILD[round]||[]).map(([characterId,x,y])=>({characterId,x,y,star:1}));
    farmSession={round,paid:false};
    const seed=Number($('combat-seed').value)||123456;
    const config={teamA:own,teamB:animals,masteryA:window.M5Economy?.getState?.()?.level||1,masteryB:1,moveInterval:.5,seed,arenaRegion:state.region};
    const active=startCombat(config);
    if(!active){farmSession=null;return false;}
    $('m5-farm-report').textContent=`R${round} 파밍 진행 중 · 야생동물 ${animals.length}마리 · 처치한 개체만 보상`;
    feedback(`R${round} 야생동물 파밍 시작`);return true;
  }
  $('m5-farm-r1')?.addEventListener('click',()=>startFarm(1));
  $('m5-farm-r3')?.addEventListener('click',()=>startFarm(3));
  async function sandboxApplyRoster(entries){
    if(state.onlineSlot!==null||combat)return false;
    const enemy=units.filter(u=>u.team==='B');
    const own=entries.map(o=>({id:'owned-'+o.uid,characterId:o.characterId,team:'A',x:o.x,y:o.y,star:o.star,items:[]}));
    units.splice(0,units.length,...own,...enemy);
    if(!units.some(u=>u.id===state.activeUnitId))state.activeUnitId=own[0]?.id||null;
    if(renderer){
      // Update the formation on this very frame; never wait for a new PNG request.
      renderer.positions();render();
      await renderer.prepareBattleSprites?.(own.map(u=>({id:'A:'+u.id,characterId:u.characterId,team:'A'})));
      renderer.positions();render();
    }
    return true;
  }

  function onlineSetup(slot){
    window.M5Economy?.setOnline?.(true);
    if(combat)stopCombat();
    state.onlineSlot=slot;state.onlinePhase='prep';
    state.mode='prep';state.x=1;state.y=1;state.activeUnitId=slot===1?'hart':'bianca';
    renderer?.mode();render();updateCombatUI();
  }
  function onlineSyncTeams(room){
    if(combat||!room?.players)return;
    const next=[];
    for(const p of room.players){
      for(const t of p.team||[]){
        if(!t.characterId)continue;
        next.push({id:t.characterId,team:p.slot===0?'A':'B',x:p.slot===0?t.x:5-t.x,y:t.y,star:t.star||1,items:t.items||[]});
      }
    }
    if(next.length){
      units.splice(0,units.length,...next);
      // Online formations may differ from the offline economy sandbox.
      // Load the actual synchronized sprites before presenting the stage.
      Promise.resolve(renderer?.prepareBattleSprites?.(next.map(u=>({
        id:u.team+':'+u.id,characterId:charId(u),team:u.team
      })))).then(()=>{renderer?.positions();render();}).catch(e=>feedback('온라인 스프라이트: '+e.message));
      renderer?.positions();render();
    }
  }
  function onlineTeamForServer(){
    const team=state.onlineSlot===1?'B':'A';
    return units.filter(u=>u.team===team).map(u=>({characterId:u.id,x:team==='A'?u.x:5-u.x,y:u.y,star:u.star||1,items:u.items||[]}));
  }
  function onlineConfig(room,slot){
    const g=room?.game;if(!g)return null;
    if(g.pve){
      state.onlinePhase='farm';
      const own=room.players.find(p=>p.slot===slot)?.team||[];
      const beasts=(WILD[g.round]||WILD[3]).map(([characterId,x,y])=>({characterId,star:1,x,y}));
      // Farming battles are individual: own side is simulation team A.
      units.splice(0,units.length,...own.map(u=>({id:u.characterId,team:'A',x:u.x,y:u.y,star:u.star||1,items:u.items||[]})),...beasts.map(u=>({id:u.characterId,team:'B',x:5-u.x,y:u.y,star:1})));
      return {teamA:own,teamB:beasts,seed:g.seed,masteryA:1,masteryB:1,moveInterval:.5,arenaRegion:g.region};
    }
    state.onlinePhase='pvp';
    const sorted=room.players.slice().sort((a,b)=>a.slot-b.slot);
    units.splice(0,units.length,...sorted.flatMap(p=>(p.team||[]).map(u=>({id:u.characterId,team:p.slot===0?'A':'B',x:p.slot===0?u.x:5-u.x,y:u.y,star:u.star||1,items:u.items||[]}))));
    return {teamA:sorted[0]?.team||[],teamB:sorted[1]?.team||[],seed:g.seed,masteryA:1,masteryB:1,moveInterval:.5,arenaRegion:g.region};
  }
  async function onlineStart(room,slot){
    if(!room?.game)return false;
    if(combat)stopCombat();
    const cfg=onlineConfig(room,slot);
    if(!cfg?.teamA.length||!cfg?.teamB.length){feedback('팀 편성이 부족해서 전투를 시작할 수 없어.');return false;}
    state.onlineSlot=slot;
    await setRegion(room.game.region||'lab');
    const started=startCombat(cfg);
    if(started && combat && room.game.battle?.outcome){combat.serverOutcome=room.game.battle.outcome;}
    if(started){state.mode='combat';renderer?.mode();render();}
    return started;
  }
  function onlineRoundPrep(room,slot){
    if(combat)stopCombat();
    state.onlineSlot=slot;state.onlinePhase=room?.game?.phase==='supply'?'supply':'prep';state.mode='prep';
    // Server teams are authoritative. Use only the current match roster.
    onlineSyncTeams(room);if(!selectedUnit())state.activeUnitId=units.find(isOwn)?.id||null;renderer?.mode();render();
  }
  function onlineLeave(){
    if(combat)stopCombat();state.onlineSlot=null;state.onlinePhase='';state.round=0;
    units.splice(0,units.length,...originals.map(u=>({...u})));
    state.mode='prep';renderer?.mode();renderer?.positions();render();
    // Restore the isolated sandbox AFTER resetting online units.
    window.M5Economy?.setOnline?.(false);
  }
  function updateOnlineHud(room,slot){
    const g=room?.game;const title=$('lab-round-state');if(!title)return;
    if(!g){title.textContent=room?'방 대기':'오프라인 실험실';return;}
    const phases={prep:'준비',combat:g.pve?'파밍':'결투',result:'결과',supply:'보급',finished:'게임 종료'};
    const seconds=Math.max(0,Math.ceil(((g.earlyEndsAt&&g.earlyEndsAt<g.endsAt?g.earlyEndsAt:g.endsAt)-Date.now())/1000));
    title.textContent=`ROUND ${g.round} · ${phases[g.phase]||g.phase} · ${seconds}초 · 나 ${g.hp?.[slot]??100} / 상대 ${g.hp?.[1-slot]??100}`;
  }
    window.LIVEM5=Object.freeze({
    sandboxApplyRoster,onlineSetup,onlineSyncTeams,onlineTeamForServer,onlineStart,onlineRoundPrep,onlineLeave,updateOnlineHud,setRegion,
    getState:()=>({...state,units:units.map(u=>({...u})),viewWidth:viewW(),cellWidth:CW,cellHeight:CH}),
    cellFromClient:(clientX,clientY)=>{if(!renderer?.canvas)return null;const p=pointerWorld({clientX,clientY});return p?.valid&&state.mode==='prep'&&!combat&&state.onlineSlot===null&&p.cellX<3?{x:p.cellX,y:p.cellY}:null;},
    dragPreviewAt:(clientX,clientY)=>{if(!renderer?.canvas||combat||state.mode!=='prep')return null;const p=pointerWorld({clientX,clientY});const target=p?.valid&&p.cellX<3?{x:p.cellX,y:p.cellY}:null;state.hover=target;renderer.paint();return target;},
    clearDragPreview:()=>{state.hover=null;renderer?.paint();},
    selectCell,setMode,moveUnit,resetUnits,toggleGrid:()=>toggle('grid'),
    startCombat,startFarm,stopCombat,pauseCombat,changeSpeed,
    getCombatState:()=>combat?{time:combat.snapshot.time,battleOver:combat.snapshot.battleOver,outcome:combat.snapshot.outcome,consistent:combat.consistent,serverMatch:combat.serverMatch,paused:combat.paused,criticalHits:combat.critCount,units:combat.snapshot.units.map(u=>({id:u.id,x:u.x,y:u.y,hp:u.hp,maxHp:u.maxHp,dead:u.dead}))}:null
  });
  const dockToggle=$('m5-dock-toggle');
  dockToggle?.addEventListener('click',()=>{
    const dock=$('m5-economy-panel'),collapsed=dock.classList.toggle('m5-dock-collapsed');
    dockToggle.setAttribute('aria-expanded',String(!collapsed));
    dockToggle.textContent=collapsed?'▴ 상점 펼치기':'▾ 상점 접기';
    requestAnimationFrame(updateSize);
  });
  updateInfo();updateCombatUI();boot();
})();
