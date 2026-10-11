/* L.I.V.E. M5-03 — independent engine-driven combat laboratory.
   PixiJS render path / Canvas fallback; neither changes the live M4 game. */
(() => {
  'use strict';
  const W = 2100, H = 900, COLS = 6, ROWS = 3, CW = W / COLS, CH = H / ROWS;
  const FLOOR_URL = 'assets/m5/floor/lab.png';
  const $ = id => document.getElementById(id);
  // Visible alpha bounds measured from existing game PNGs. They make the feet,
  // rather than the centre of each transparent file, the authoritative anchor.
  const portraits = Object.freeze({
    aya:    {name:'아야',    bounds:[95,78,694,1182]},
    bianca: {name:'비앙카',  bounds:[121,39,700,1195]},
    isol:   {name:'아이솔',  bounds:[82,105,759,1170]},
    rozzi:  {name:'로지',    bounds:[160,68,730,1144]},
    hart:   {name:'하트',    bounds:[44,78,709,1158]},
    irem:   {name:'이렘',    bounds:[22,97,769,1163]}
  });
  const originals = [
    {id:'aya',team:'A',x:0,y:0}, {id:'bianca',team:'A',x:1,y:1}, {id:'isol',team:'A',x:2,y:2},
    {id:'rozzi',team:'B',x:3,y:0}, {id:'hart',team:'B',x:4,y:1}, {id:'irem',team:'B',x:5,y:2}
  ];
  const units = originals.map(u => ({...u}));
  const src = id => `assets/characters/${id}.png`;
  const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
  const state = {mode:'prep', x:1, y:1, grid:false, points:false, engine:'loading', activeUnitId:'bianca', hover:null};
  const root = $('stage'), wrap = $('stage-wrap');
  let renderer = null, gesture = null, toastTimer = 0;
  let combat = null, raf = null, lastFrame = 0, lag = 0, lastStatus = 0;
  const visual = new Map();
  const floaters = [], flashes = [];
  const battleActive = () => !!combat;
  const shownUnits = () => combat ? combat.snapshot.units.map(u => ({...u, id:u.characterId})) : units;
  const portraitFor = u => portraits[u.characterId || u.id];
  const spritePoint = u => foot(u.x,u.y);
  const clamp01 = n => Math.max(0,Math.min(1,n));
  const nowMs = () => performance.now();
  function getDrawUnits(){
    return combat ? combat.snapshot.units.map(u=>({...u,drawKey:u.id,id:u.characterId})) : units.map(u=>({...u,drawKey:u.team+':'+u.id}));
  }
  const visibleCols = () => state.mode === 'prep' ? 3 : 6;
  const viewW = () => visibleCols()*CW;
  const foot = (x,y) => ({x:(x+.5)*CW, y:(y+.87)*CH});
  const label = () => `${state.x<3?'A':'B'} · ${state.x<3?['후열','중열','전열'][state.x]:['전열','중열','후열'][state.x-3]} / ${['상단','중앙','하단'][state.y]}`;
  const unitAt = (x,y) => units.find(u => u.x===x&&u.y===y) || null;
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
    const maxHeight=Math.max(250,Math.min(680,window.innerHeight-280));
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
    $('unit-title').textContent=picked?`${portraits[picked.id].name} · ${picked.team}팀`:'실험체를 선택해 줘';
    $('unit-location').textContent=picked?`X ${picked.x+1} / Y ${picked.y+1}`:'—';
    $('unit-help').textContent=combat?'실제 전투 엔진의 위치·체력·상태를 재생하는 중이야.':state.mode==='prep'?'A팀 실험체를 끌어서 이동하거나 서로 위치를 바꿀 수 있어.':'배치 확인 모드야. 전투 시작 버튼으로 실전을 재생해 봐.';
    document.querySelectorAll('[data-unit-id]').forEach(el=>{
      const id=el.dataset.unitId,u=units.find(e=>e.id===id);
      el.classList.toggle('picked',id===state.activeUnitId);
      el.querySelector('.unit-pos').textContent=`${u.x+1}열 · ${u.y+1}행`;
    });
    updateSize();
  }
  function render(){renderer?.paint();updateInfo();}
  function selectCell(x,y){
    if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=visibleCols()||y>=ROWS)return false;
    state.x=x;state.y=y;
    const occupant=unitAt(x,y);
    if(occupant)state.activeUnitId=occupant.id;
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
    if(!unit||unit.team!=='A'||state.mode!=='prep'||!Number.isInteger(x)||!Number.isInteger(y)||x<0||x>=3||y<0||y>=ROWS)return false;
    const other=unitAt(x,y);
    if(other&&other.team!==unit.team)return false;
    const ox=unit.x,oy=unit.y;
    unit.x=x;unit.y=y;
    if(other&&other!==unit){other.x=ox;other.y=oy;}
    state.activeUnitId=id;state.x=x;state.y=y;
    renderer?.positions();render();
    return true;
  }
  function resetUnits(){
    if(combat){feedback('전투 중에는 배치를 초기화할 수 없어.');return false;}
    gesture=null;state.hover=null;
    for(let i=0;i<units.length;i++)Object.assign(units[i],originals[i]);
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
      selectCell(p.cellX,p.cellY);
      // To make a drag possible even when the player grabs the head extending
      // past a cell, prefer a nearby sprite's actual visible rectangle.
      const picked=renderer.pick?.(p.x,p.y) || unit;
      if(picked&&picked.team==='A'&&state.mode==='prep'&&!combat){
        state.activeUnitId=picked.id;state.x=picked.x;state.y=picked.y;render();
        gesture={id:picked.id,pointerId:e.pointerId,down:p,now:p,moving:false};
        try{canvas.setPointerCapture(e.pointerId);}catch{}
      }
    });
    canvas.addEventListener('pointermove',e=>{
      if(!gesture||e.pointerId!==gesture.pointerId)return;
      const p=pointerWorld(e);if(!p)return;
      gesture.now=p;
      if(!gesture.moving&&Math.hypot(p.x-gesture.down.x,p.y-gesture.down.y)>22)gesture.moving=true;
      if(gesture.moving){state.hover=p.valid&&p.cellX<3?{x:p.cellX,y:p.cellY}:null;renderer.drag(gesture);renderer.paint();}
    });
    const end=e=>{
      if(!gesture||e.pointerId!==gesture.pointerId)return;
      const g=gesture;gesture=null;state.hover=null;
      const p=pointerWorld(e);
      if(g.moving){
        const valid=p?.valid&&p.cellX<3;
        const original=units.find(u=>u.id===g.id);
        const other=valid?unitAt(p.cellX,p.cellY):null;
        const result=valid&&moveUnit(g.id,p.cellX,p.cellY);
        if(result&&original){feedback(other&&other!==original?`${portraits[original.id].name} ↔ ${portraits[other.id].name} 자리 교환`:`${portraits[original.id].name} 배치 이동 완료`);}
        else{renderer.positions();render();feedback('아군 3×3 안쪽으로만 배치할 수 있어.');}
      }else{renderer.positions();render();}
    };
    canvas.addEventListener('pointerup',end);
    canvas.addEventListener('pointercancel',e=>{if(gesture&&e.pointerId===gesture.pointerId){gesture=null;state.hover=null;renderer.positions();render();}});
    canvas.addEventListener('lostpointercapture',e=>{if(gesture&&e.pointerId===gesture.pointerId){gesture=null;state.hover=null;renderer.positions();render();}});
  }
  function buildCombatConfig(seed){
    const toEntry=u=>({characterId:u.id,star:1,x:u.team==='A'?u.x:5-u.x,y:u.y});
    return {teamA:units.filter(u=>u.team==='A').map(toEntry),teamB:units.filter(u=>u.team==='B').map(toEntry),
      masteryA:1,masteryB:1,moveInterval:.5,seed,arenaRegion:'lab'};
  }
  function updateCombatUI(){
    const live=$('combat-live'), start=$('combat-start'), pause=$('combat-pause'), stop=$('combat-stop');
    if(!live)return;
    const b=combat;
    const label=b?(b.finished?`전투 종료 · ${b.snapshot.outcome}`:b.paused?'일시정지':'실제 전투 재생 중'):'배치 모드 · 준비 완료';
    live.textContent=b?`${label} / ${b.snapshot.time.toFixed(2)}초`:`${label} · 시작 시 실제 전투 엔진 실행`;
    $('combat-time').textContent=b?b.snapshot.time.toFixed(1)+'s':'0.0s';
    start.disabled=!!b;pause.disabled=!b||b.finished;stop.disabled=!b;$('combat-speed').disabled=!b;
    pause.textContent=b?.paused?'▶ 재개':'Ⅱ 일시정지';
    $('combat-result').textContent=b?.finished?`${b.snapshot.outcome} · ${b.consistent?'동일 시드 엔진 결과 일치 ✓':'결과 검증 불일치 ⚠'}`:'';
    $('combat-log').replaceChildren(...(b?.logs||[]).slice(-8).reverse().map(t=>{const li=document.createElement('li');li.textContent=t;return li;}));
    $('mode-combat').disabled=!!b;$('mode-prep').disabled=!!b;$('reset-units').disabled=!!b;
    $('combat-speed').textContent=`속도 ${b?.speed || 1}×`;
    updateInfo();
  }
  function startCombat(){
    if(combat)return false;
    if(!window.ERCombat?.CombatEngine){feedback('기존 전투 엔진 스크립트가 로드되지 않았어.');return false;}
    const rawSeed=Number($('combat-seed').value),seed=Number.isSafeInteger(rawSeed)&&rawSeed>=1&&rawSeed<=2147483646?rawSeed:123456;
    $('combat-seed').value=String(seed);
    const cfg=buildCombatConfig(seed);
    try {
      // Reference run uses the very same original engine and exact same config.
      const expected=new ERCombat.CombatEngine(cfg).run();
      const engine=new ERCombat.CombatEngine(cfg);
      engine.start();
      const snapshot=engine.getResult();
      combat={engine,config:cfg,expected,snapshot,paused:false,finished:false,consistent:null,speed:1,logs:[]};
      visual.clear();floaters.length=0;flashes.length=0;
      for(const u of snapshot.units){const p=spritePoint(u);visual.set(u.id,{x:p.x,y:p.y});}
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
    flashes.push({key:u.id,kind,until:now+(kind==='skill'?760:kind==='hit'?380:240)});
    if(text)floaters.push({x:p.x+(Math.random()-.5)*35,y:p.y-205,text,color:kind==='hit'?'#ff9ba6':'#c3eeff',at:now});
    while(floaters.length>45)floaters.shift();
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
      const diff=Math.max(0,v.hp-u.hp);
      if(diff>.4)markFx(u,'hit',Math.ceil(diff).toLocaleString('ko-KR'));
      if(u.basicCount>v.basicCount)markFx(u,'attack',null);
      if(u.dead&&!v.dead)markFx(u,'hit','KO');
    }
    for(const e of b.engine.drainEvents())if(e.type==='log'){
      const line=stripLog(e.message);b.logs.push(`[${e.time.toFixed(1)}] ${line}`);
      if(b.logs.length>70)b.logs.shift();
      if(line.includes('[스킬]')){
        const caster=b.snapshot.units.find(u=>line.includes(u.name));
        if(caster)markFx(caster,'skill','SKILL');
      }
    }
    if(b.snapshot.battleOver){
      b.finished=true;b.paused=true;
      const x=b.expected,y=b.snapshot;
      b.consistent=x.outcome===y.outcome&&Math.abs(x.time-y.time)<1e-7&&x.units.length===y.units.length&&x.units.every((u,i)=>u.id===y.units[i].id&&Math.abs(u.hp-y.units[i].hp)<.001&&u.x===y.units[i].x&&u.y===y.units[i].y);
      b.logs.push(`[${y.time.toFixed(1)}] ${y.outcome} · 재현 검증 ${b.consistent?'일치':'불일치'}`);
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
    if(!combat.finished||floaters.length||flashes.length){
      const t=nowMs();for(let i=floaters.length-1;i>=0;i--)if(t-floaters[i].at>1100)floaters.splice(i,1);
      for(let i=flashes.length-1;i>=0;i--)if(t>flashes[i].until)flashes.splice(i,1);
      raf=requestAnimationFrame(combatFrame);
    }
  }
  function pauseCombat(){if(!combat||combat.finished)return false;combat.paused=!combat.paused;lastFrame=nowMs();updateCombatUI();if(raf===null)raf=requestAnimationFrame(combatFrame);return true;}
  function changeSpeed(){if(!combat)return false;combat.speed=combat.speed===1?2:1;updateCombatUI();return combat.speed;}
  function stopCombat(){
    if(!combat)return false;
    if(raf!==null)cancelAnimationFrame(raf);raf=null;
    combat=null;lag=0;visual.clear();floaters.length=0;flashes.length=0;
    state.mode='prep';state.x=Math.min(state.x,2);
    renderer?.mode();renderer?.positions(true);
    updateCombatUI();return true;
  }
  function fxFor(key){return flashes.filter(f=>f.key===key);}
  function drawHpCanvas(c,u,p){
    const pct=clamp01(u.hp/Math.max(1,u.maxHp)),x=p.x-83,y=p.y-209;
    c.fillStyle='#071117dd';c.fillRect(x-3,y-3,172,19);
    c.fillStyle='#2e3a40';c.fillRect(x,y,166,11);
    c.fillStyle=u.team==='A'?'#73e0e7':'#f09aaf';c.fillRect(x,y,166*pct,11);
    if(u.skill?.shield>0){c.fillStyle='#9bd5f4';c.fillRect(x,y+13,166*clamp01(u.skill.shield/Math.max(1,u.maxHp)),3);}
    if(u.ccUntil>combat.snapshot.time||u.sleepUntil>combat.snapshot.time){c.fillStyle='#ffd888';c.fillRect(p.x-2,y-12,5,8);}
  }
  function drawFloatCanvas(c){const now=nowMs();for(const f of floaters){const t=clamp01((now-f.at)/1100);c.save();c.globalAlpha=1-t;c.textAlign='center';c.font='bold 31px sans-serif';c.strokeStyle='#061018';c.lineWidth=5;c.strokeText(f.text,f.x,f.y-48*t);c.fillStyle=f.color;c.fillText(f.text,f.x,f.y-48*t);c.restore();}}
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
      this.app.stage.addChild(new P.Sprite(floor));
      this.grid=new P.Graphics();this.markers=new P.Graphics();
      this.app.stage.addChild(this.grid,this.markers);
      this.pieces=new P.Container();this.pieces.sortableChildren=true;this.app.stage.addChild(this.pieces);
      this.fxLayer=new P.Graphics();this.app.stage.addChild(this.fxLayer);
      this.labels=new P.Container();this.app.stage.addChild(this.labels);this.textPool=[];
      this.sprites=new Map();
      const results=await Promise.allSettled(units.map(async u=>[u.id,await P.Assets.load(src(u.id))]));
      for(let i=0;i<results.length;i++){
        if(results[i].status!=='fulfilled')throw Error(`${units[i].id} 캐릭터 PNG 불러오기 실패`);
        const [id,texture]=results[i].value,meta=portraits[id],bb=meta.bounds;
        const node=new P.Container();
        const shadow=new P.Graphics().ellipse(0,-5,73,17).fill({color:0x02080e,alpha:.54});
        const ring=new P.Graphics().ellipse(0,-7,84,23).stroke({width:4,color:units[i].team==='A'?0x83d9e4:0xe8a7bd,alpha:.78});
        node.addChild(shadow,ring);
        const sprite=new P.Sprite(texture);
        const naturalWidth=texture.width,naturalHeight=texture.height;
        sprite.anchor.set((bb[0]+bb[2])/2/naturalWidth,bb[3]/naturalHeight);
        const sc=Math.min(250/(bb[3]-bb[1]),215/(bb[2]-bb[0]));
        sprite.scale.set(units[i].team==='B'?-sc:sc,sc);
        sprite.position.set(0,0);node.addChild(sprite);
        const hp=new P.Graphics();node.addChild(hp);
        this.pieces.addChild(node);this.sprites.set(id,{node,sprite});
      }
      this.mode();
    }
    mode(){this.app.renderer.resize(viewW(),H);this.positions(true);this.paint();}
    positions(){for(const u of units){const obj=this.sprites.get(u.id);if(!obj)continue;const p=foot(u.x,u.y);obj.node.position.set(p.x,p.y);obj.node.zIndex=p.y;obj.node.visible=state.mode==='combat'||u.team==='A';obj.node.alpha=1;}}
    drag(g){const o=this.sprites.get(g.id);if(!o)return;const u=units.find(x=>x.id===g.id),p=foot(u.x,u.y);o.node.position.set(p.x+g.now.x-g.down.x,p.y+g.now.y-g.down.y);o.node.zIndex=2000;o.node.alpha=.8;}
    pick(x,y){
      // Hit regions follow the visible alpha bounds/ground-contact positions,
      // allowing the upper half of a sprite to be grabbed over an adjacent cell.
      return units.filter(u=>state.mode==='combat'||u.team==='A').slice().reverse().find(u=>{
        const p=foot(u.x,u.y),bb=portraits[u.id].bounds,scale=Math.min(250/(bb[3]-bb[1]),215/(bb[2]-bb[0]));
        return Math.abs(x-p.x)<(bb[2]-bb[0])*scale*.5 && y<=p.y+10 && y>=p.y-(bb[3]-bb[1])*scale;
      })||null;
    }
    paint(){
      rectGridPixi(this.grid);this.markers.clear();
      if(!combat)rectanglePixi(this.markers,state.x,state.y,state.x<3?0x8ae1eb:0xf2b8c9,.10);
      if(state.hover)rectanglePixi(this.markers,state.hover.x,state.hover.y,0xa3ffcc,.14);
      const clock=nowMs(), drawn=getDrawUnits();
      for(const u of drawn){const obj=this.sprites.get(u.id);if(!obj)continue;
        const p=combat ? visual.get(u.drawKey)||spritePoint(u):spritePoint(u);
        let shift=0;const acting=fxFor(u.drawKey);
        if(acting.some(f=>f.kind==='attack'))shift=u.team==='A'?16:-16;
        obj.node.position.set(p.x+shift,p.y);obj.node.zIndex=p.y;
        obj.node.visible=state.mode==='combat'||u.team==='A';
        obj.node.alpha=u.dead?.22:1;
        obj.sprite.tint=acting.some(f=>f.kind==='hit')?0xff9399:0xffffff;
        obj.node.children[1].alpha=combat?.35:state.activeUnitId===u.id?1:.60;
        const h=obj.node.children[3];h.clear();
        if(combat){
          const pct=clamp01(u.hp/Math.max(1,u.maxHp));
          h.roundRect(-87,-214,174,17,3).fill({color:0x041018,alpha:.93});
          h.rect(-83,-211,166,11).fill({color:0x26343c});
          h.rect(-83,-211,166*pct,11).fill({color:u.team==='A'?0x70dce5:0xe895ae});
          if(u.skill?.shield>0)h.rect(-83,-197,166*clamp01(u.skill.shield/Math.max(1,u.maxHp)),3).fill({color:0x9dd8fa});
          if(acting.some(f=>f.kind==='skill'))h.circle(0,-115,90).stroke({width:9,color:0x9cddff,alpha:.75});
          if(u.ccUntil>combat.snapshot.time||u.sleepUntil>combat.snapshot.time)h.circle(0,-240,10).fill({color:0xf8d18b});
        }
      }
      this.fxLayer.clear();
      if(combat)for(const f of flashes.filter(f=>f.kind==='skill')){
        const u=combat.snapshot.units.find(x=>x.id===f.key);if(!u)continue;
        const p=visual.get(f.key)||spritePoint(u),t=1-clamp01((f.until-clock)/760);
        this.fxLayer.circle(p.x,p.y-110,85+90*t).stroke({width:7,color:0xb3e8ff,alpha:(1-t)*.55});
      }
      for(const label of this.textPool)label.visible=false;
      if(combat)for(let i=0;i<floaters.length;i++){
        const f=floaters[i],t=clamp01((clock-f.at)/1100);
        if(!this.textPool[i]){
          const label=new this.P.Text({text:'',style:{fontSize:28,fontWeight:'bold',fontFamily:'sans-serif',fill:0xffffff,stroke:{color:0x081015,width:4}}});
          label.anchor.set(.5,.5);this.labels.addChild(label);this.textPool[i]=label;
        }
        const label=this.textPool[i];label.visible=true;label.text=f.text;label.style.fill=f.color;
        label.position.set(f.x,f.y-t*48);label.alpha=1-t;
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
      const files=await Promise.all([FLOOR_URL,...units.map(u=>src(u.id))].map(url=>new Promise((resolve,reject)=>{
        const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error(`이미지 로드 실패: ${url}`));im.src=url;
      })));
      this.floor=files.shift();if(this.floor.naturalWidth!==W||this.floor.naturalHeight!==H)throw Error('바닥 원본은 2100×900이어야 해');
      this.images=new Map(units.map((u,i)=>[u.id,files[i]]));
      this.mode();
    }
    mode(){this.canvas.width=viewW();this.canvas.height=H;this.paint();}
    positions(){this.paint();}
    drag(){this.paint();}
    pick(x,y){return units.filter(u=>state.mode==='combat'||u.team==='A').slice().reverse().find(u=>{
      const p=foot(u.x,u.y),bb=portraits[u.id].bounds,scale=Math.min(250/(bb[3]-bb[1]),215/(bb[2]-bb[0]));
      return Math.abs(x-p.x)<(bb[2]-bb[0])*scale*.5&&y<=p.y+10&&y>=p.y-(bb[3]-bb[1])*scale;
    })||null;}
    paint(){
      if(!this.ctx)return;const c=this.ctx;c.clearRect(0,0,viewW(),H);c.drawImage(this.floor,0,0);
      if(state.grid){for(let y=0;y<3;y++)for(let x=0;x<visibleCols();x++){
        c.strokeStyle=x<3?'#a2cbd04c':'#f1b4bc4c';c.lineWidth=2;c.strokeRect(x*CW+2,y*CH+2,CW-4,CH-4);
      }}
      if(state.points){for(let y=0;y<3;y++)for(let x=0;x<visibleCols();x++){
        const p=foot(x,y);c.beginPath();c.arc(p.x,p.y,7,0,Math.PI*2);c.fillStyle=x<3?'#87d5e3':'#e5b2c2';c.fill();
      }}
      if(!combat)canvasRectangle(c,state.x,state.y,state.x<3?'#8ae1eb':'#f2b8c9');
      if(state.hover)canvasRectangle(c,state.hover.x,state.hover.y,'#a3ffcc');
      const ordered=getDrawUnits().filter(u=>state.mode==='combat'||u.team==='A').slice().sort((a,b)=>a.y-b.y||a.x-b.x);
      for(const u of ordered){const meta=portraits[u.id],bb=meta.bounds,im=this.images.get(u.id),p=combat?visual.get(u.drawKey)||spritePoint(u):spritePoint(u);
        const shift=gesture?.moving&&gesture.id===u.id?{x:gesture.now.x-gesture.down.x,y:gesture.now.y-gesture.down.y}:{x:0,y:0};
        const acting=fxFor(u.drawKey),bump=acting.some(f=>f.kind==='attack')?(u.team==='A'?16:-16):0;
        const cx=p.x+shift.x+bump,cy=p.y+shift.y,scale=Math.min(250/(bb[3]-bb[1]),215/(bb[2]-bb[0]));
        c.save();if(gesture?.moving&&gesture.id===u.id)c.globalAlpha=.8;if(u.dead)c.globalAlpha=.22;
        c.beginPath();c.ellipse(cx,cy-5,75,20,0,0,2*Math.PI);c.fillStyle='#020b128e';c.fill();
        c.beginPath();c.ellipse(cx,cy-7,84,23,0,0,2*Math.PI);c.strokeStyle=u.team==='A'?'#83d9e4a0':'#e8a7bda0';c.lineWidth=4;c.stroke();
        const mid=(bb[0]+bb[2])/2;
        c.save();c.translate(cx,cy);if(u.team==='B')c.scale(-1,1);
        if(acting.some(f=>f.kind==='hit')){c.shadowColor='#ff8c9b';c.shadowBlur=26;c.filter='brightness(1.23)';}
        c.drawImage(im,-mid*scale,-bb[3]*scale,im.width*scale,im.height*scale);c.restore();
        if(acting.some(f=>f.kind==='skill')){c.strokeStyle='#b4e6ffe0';c.lineWidth=8;c.beginPath();c.arc(cx,cy-105,90,0,Math.PI*2);c.stroke();}
        if(combat)drawHpCanvas(c,u,{x:cx,y:cy});
        c.restore();
      }
      if(combat)drawFloatCanvas(c);
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
  $('combat-start').addEventListener('click',startCombat);
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
    const u=units.find(x=>x.id===btn.dataset.unitId);if(!u)return;
    if(state.mode==='prep'&&u.team==='B'){feedback('B팀은 전투 모드에서 확인할 수 있어.');return;}
    state.activeUnitId=u.id;state.x=u.x;state.y=u.y;render();
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
  window.LIVEM5=Object.freeze({
    getState:()=>({...state,units:units.map(u=>({...u})),viewWidth:viewW(),cellWidth:CW,cellHeight:CH}),
    selectCell,setMode,moveUnit,resetUnits,toggleGrid:()=>toggle('grid'),
    startCombat,stopCombat,pauseCombat,changeSpeed,
    getCombatState:()=>combat?{time:combat.snapshot.time,battleOver:combat.snapshot.battleOver,outcome:combat.snapshot.outcome,consistent:combat.consistent,paused:combat.paused,units:combat.snapshot.units.map(u=>({id:u.id,x:u.x,y:u.y,hp:u.hp,maxHp:u.maxHp,dead:u.dead}))}:null
  });
  updateInfo();updateCombatUI();boot();
})();
