/* L.I.V.E. M5-02 — independent sprite-placement lab.
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
    $('unit-help').textContent=state.mode==='prep'?'A팀 실험체를 끌어서 이동하거나 서로 위치를 바꿀 수 있어.':'전투 모드는 배치 확인용이야. 이동은 준비 단계에서 가능해.';
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
    if(mode!=='prep'&&mode!=='combat')return false;
    gesture=null;state.hover=null;state.mode=mode;
    if(state.x>=visibleCols())state.x=visibleCols()-1;
    renderer?.mode();render();return true;
  }
  function toggle(key){state[key]=!state[key];render();}
  function moveUnit(id,x,y){
    const unit=units.find(u=>u.id===id);
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
      if(picked&&picked.team==='A'&&state.mode==='prep'){
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
        sprite.scale.set(Math.min(250/(bb[3]-bb[1]),215/(bb[2]-bb[0])));
        sprite.position.set(0,0);node.addChild(sprite);
        const nameplate=new P.Text({text:meta.name,style:{fontFamily:'sans-serif',fontSize:30,fontWeight:'600',fill:units[i].team==='A'?0xc9faff:0xffcedc,stroke:{color:0x04121a,width:5}}});
        nameplate.anchor.set(.5,1);nameplate.position.set(0,-265);node.addChild(nameplate);
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
      rectanglePixi(this.markers,state.x,state.y,state.x<3?0x8ae1eb:0xf2b8c9,.10);
      if(state.hover)rectanglePixi(this.markers,state.hover.x,state.hover.y,0xa3ffcc,.14);
      for(const u of units){const obj=this.sprites.get(u.id);if(!obj)continue;
        const ring=obj.node.children[1];ring.alpha=state.activeUnitId===u.id?1:.60;
        obj.node.visible=state.mode==='combat'||u.team==='A';
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
      canvasRectangle(c,state.x,state.y,state.x<3?'#8ae1eb':'#f2b8c9');
      if(state.hover)canvasRectangle(c,state.hover.x,state.hover.y,'#a3ffcc');
      const ordered=units.filter(u=>state.mode==='combat'||u.team==='A').slice().sort((a,b)=>a.y-b.y||a.x-b.x);
      for(const u of ordered){const meta=portraits[u.id],bb=meta.bounds,im=this.images.get(u.id),p=foot(u.x,u.y);
        const shift=gesture?.moving&&gesture.id===u.id?{x:gesture.now.x-gesture.down.x,y:gesture.now.y-gesture.down.y}:{x:0,y:0};
        const cx=p.x+shift.x,cy=p.y+shift.y,scale=Math.min(250/(bb[3]-bb[1]),215/(bb[2]-bb[0]));
        c.save();if(gesture?.moving&&gesture.id===u.id)c.globalAlpha=.8;
        c.beginPath();c.ellipse(cx,cy-5,75,20,0,0,2*Math.PI);c.fillStyle='#020b128e';c.fill();
        c.beginPath();c.ellipse(cx,cy-7,84,23,0,0,2*Math.PI);c.strokeStyle=u.team==='A'?'#83d9e4a0':'#e8a7bda0';c.lineWidth=4;c.stroke();
        const mid=(bb[0]+bb[2])/2;
        c.drawImage(im,cx-mid*scale,cy-bb[3]*scale,im.width*scale,im.height*scale);
        c.font='600 30px sans-serif';c.textAlign='center';c.textBaseline='bottom';c.lineWidth=5;c.strokeStyle='#06121b';c.strokeText(meta.name,cx,cy-265);c.fillStyle=u.team==='A'?'#c9faff':'#ffcedc';c.fillText(meta.name,cx,cy-265);
        c.restore();
      }
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
    selectCell,setMode,moveUnit,resetUnits,toggleGrid:()=>toggle('grid')
  });
  updateInfo();boot();
})();
