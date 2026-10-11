/* L.I.V.E. M5-00/01: isolated image-based battlefield & exact 3x6 input model.
   Read-only prototype. No imports from, or mutations to, the live game state. */
(() => {
  'use strict';
  const W = 2100, H = 900, COLS = 6, ROWS = 3;
  const CW = W / COLS, CH = H / ROWS;
  const FLOOR_URL = 'assets/m5/floor/lab.png';
  const $ = id => document.getElementById(id);
  const state = { mode: 'combat', x: 0, y: 0, grid: true, points: true, engine: 'loading' };
  const root = $('stage'), wrap = $('stage-wrap');
  let renderer;
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const visibleCols = () => state.mode === 'prep' ? 3 : 6;
  const viewW = () => visibleCols() * CW;
  const label = () => `${state.x < 3 ? 'A' : 'B'} · ${state.x < 3 ? ['후열','중열','전열'][state.x] : ['전열','중열','후열'][state.x-3]} / ${['상단','중앙','하단'][state.y]}`;
  const middle = () => [Math.round((state.x + 0.5)*CW), Math.round((state.y+0.5)*CH)];
  function updateInformation() {
    $('cell-title').textContent = label();
    $('cell-code').textContent = `X ${String(state.x).padStart(2,'0')} / Y ${String(state.y).padStart(2,'0')}`;
    $('cell-position').textContent = middle().join(', ');
    $('mode-status').textContent = state.mode === 'prep' ? '준비 모드' : '전투 모드';
    $('renderer-status').textContent = state.engine === 'pixi' ? 'PixiJS 8.22.0' : state.engine === 'canvas' ? 'Canvas 대체 모드' : '엔진 초기화 중';
    $('stage').setAttribute('aria-label', `${visibleCols()}열 3행의 연구소 전장, 현재 ${label()} 칸 선택됨`);
    const index = state.y * 6 + state.x + 1;
    document.querySelector('.lab-index').textContent = `${String(index).padStart(2, '0')} / 18`;
    for(const [mode, id] of [['combat', 'mode-combat'], ['prep', 'mode-prep']]){
      const active = state.mode === mode;
      $(id).classList.toggle('mode-selected', active);
      $(id).setAttribute('aria-pressed', String(active));
    }
    for(const [key,id] of [['grid','toggle-grid'], ['points','toggle-points']]){
      $(id).setAttribute('aria-pressed',String(state[key]));
      $(id).querySelector('strong').textContent=state[key]?'ON':'OFF';
    }
    wrap.style.setProperty('--board-ratio', `${viewW()} / ${H}`);
    wrap.dataset.boardMode = state.mode;
    updateDisplaySize();
  }
  function updateDisplaySize() {
    // The *same* exact artwork coordinate system drives both rendering and layout.
    // Explicit pixel sizing avoids browser-specific CSS calc multiplication behavior.
    const space = document.querySelector('.lab-stage-space');
    const padding = window.innerWidth <= 760 ? 20 : 40;
    const maxWidth = Math.max(120, space.clientWidth - padding);
    const maxHeight = Math.max(250, Math.min(680, window.innerHeight - 280));
    const width = Math.min(maxWidth, maxHeight * viewW() / H);
    const height = width * H / viewW();
    wrap.style.width = `${(width + 2).toFixed(2)}px`;
    wrap.style.height = `${(height + 2).toFixed(2)}px`;
    $('viewport-status').textContent = `${Math.round(width)} × ${Math.round(height)}px`;
  }
  function selectCell(x,y) {
    if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=visibleCols()||y>=ROWS)return false;
    state.x=x;state.y=y;
    if(renderer)renderer.paint();
    updateInformation();return true;
  }
  function setMode(mode) {
    if(mode!=='prep'&&mode!=='combat')return false;
    state.mode=mode;
    if(state.x>=visibleCols())state.x=visibleCols()-1;
    if(renderer)renderer.mode();
    updateInformation();return true;
  }
  function toggle(key) {
    state[key]=!state[key];renderer?.paint();updateInformation();
  }
  function corner(g,x,y,w,h,color) {
    const d=28, pad=13;
    const paths=[
      [x+pad+d,y+pad,x+pad,y+pad,x+pad,y+pad+d],
      [x+w-pad-d,y+pad,x+w-pad,y+pad,x+w-pad,y+pad+d],
      [x+pad+d,y+h-pad,x+pad,y+h-pad,x+pad,y+h-pad-d],
      [x+w-pad-d,y+h-pad,x+w-pad,y+h-pad,x+w-pad,y+h-pad-d]
    ];
    for(const p of paths)g.moveTo(p[0],p[1]).lineTo(p[2],p[3]).lineTo(p[4],p[5]);
    g.stroke({width:5,color,alpha:0.95});
  }
  function gridPixi(g) {
    g.clear();
    if(state.grid) {
      for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
        const c=x<3?0x9bc5d2:0xd2adb9;
        g.rect(x*CW+2,y*CH+2,CW-4,CH-4).stroke({width:2.0,color:c,alpha:0.24});
      }
      g.moveTo(3*CW,0).lineTo(3*CW,H).stroke({width:5,color:0x9ebbc3,alpha:.46});
    }
    if(state.points){for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
      const px=(x+.5)*CW,py=(y+.5)*CH;
      g.circle(px,py,7).fill({color:x<3?0x86d7e7:0xe8a8b8,alpha:.68});
      g.circle(px,py,16).stroke({width:2,color:0xe6f4f6,alpha:.33});
    }}
  }
  function selectedPixi(g) {
    g.clear();
    const x=state.x*CW,y=state.y*CH;
    const color=state.x<3?0x8ae1eb:0xf2b8c9;
    g.rect(x+4,y+4,CW-8,CH-8).fill({color,alpha:.16});
    g.rect(x+5,y+5,CW-10,CH-10).stroke({width:3,color,alpha:.45});
    corner(g,x,y,CW,CH,color);
  }
  class PixiField {
    async init() {
      const P=window.PIXI;
      if(!P?.Application||!P?.Assets)throw new Error('PixiJS 라이브러리 로드 실패');
      this.P=P;
      this.app=new P.Application();
      await this.app.init({width:W,height:H,backgroundAlpha:0,antialias:true,autoDensity:false,preference:'webgl'});
      this.app.canvas.setAttribute('aria-label','PixiJS 전장 이미지');
      root.replaceChildren(this.app.canvas);
      const texture=await P.Assets.load(FLOOR_URL);
      if(Math.round(texture.width)!==W||Math.round(texture.height)!==H)throw new Error(`바닥 원본 규격 불일치: ${texture.width}×${texture.height}`);
      this.floor = new P.Sprite(texture);
      this.app.stage.addChild(this.floor);
      this.grid = new P.Graphics();this.selected = new P.Graphics();
      this.app.stage.addChild(this.grid,this.selected);
      this.inputs=new P.Container();this.app.stage.addChild(this.inputs);
      for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
        const hit=new P.Graphics().rect(x*CW,y*CH,CW,CH).fill({color:0xffffff,alpha:.00001});
        hit.eventMode='static';hit.cursor='crosshair';
        hit.on('pointerdown',()=>selectCell(x,y));
        this.inputs.addChild(hit);
      }
      this.mode();
    }
    mode(){this.app.renderer.resize(viewW(),H);this.paint();}
    paint(){gridPixi(this.grid);selectedPixi(this.selected);}
  }
  class CanvasField {
    async init(){
      this.canvas=document.createElement('canvas');
      this.canvas.width=W;this.canvas.height=H;
      this.canvas.setAttribute('aria-label','Canvas 연구소 전장');
      this.canvas.style.cursor='crosshair';
      root.replaceChildren(this.canvas);
      this.ctx=this.canvas.getContext('2d',{alpha:false});
      this.floor=new Image();this.floor.decoding='async';
      await new Promise((resolve,reject)=>{this.floor.onload=resolve;this.floor.onerror=()=>reject(new Error('연구소 이미지 로딩 실패'));this.floor.src=FLOOR_URL;});
      if(this.floor.naturalWidth!==W||this.floor.naturalHeight!==H)throw new Error('바닥 원본 규격 불일치');
      this.canvas.addEventListener('pointerdown',e=>{
        const rect=this.canvas.getBoundingClientRect();
        const x=Math.floor((e.clientX-rect.left)/rect.width*viewW()/CW);
        const y=Math.floor((e.clientY-rect.top)/rect.height*H/CH);
        selectCell(x,y);
      });
      this.mode();
    }
    mode(){this.canvas.width=viewW();this.canvas.height=H;this.paint();}
    paint(){
      const c=this.ctx;c.clearRect(0,0,viewW(),H);c.drawImage(this.floor,0,0);
      if(state.grid){for(let y=0;y<ROWS;y++)for(let x=0;x<visibleCols();x++){
        c.strokeStyle=x<3?'#a2cbd042':'#f1b4bc42';c.lineWidth=2;c.strokeRect(x*CW+2,y*CH+2,CW-4,CH-4);
      }c.beginPath();c.moveTo(3*CW,0);c.lineTo(3*CW,H);c.strokeStyle='#90b3b676';c.lineWidth=5;c.stroke();}
      if(state.points)for(let y=0;y<ROWS;y++)for(let x=0;x<visibleCols();x++){
        const px=(x+.5)*CW,py=(y+.5)*CH;
        c.beginPath();c.arc(px,py,7,0,Math.PI*2);c.fillStyle=x<3?'#87d5e3':'#e5b2c2';c.fill();
        c.beginPath();c.arc(px,py,16,0,Math.PI*2);c.strokeStyle='#e5eff366';c.lineWidth=2;c.stroke();
      }
      const x=state.x*CW,y=state.y*CH,color=state.x<3?'#8ae1eb':'#f2b8c9';
      c.fillStyle=state.x<3?'#8ae1eb29':'#f2b8c929';c.fillRect(x+4,y+4,CW-8,CH-8);
      c.strokeStyle=color;c.lineWidth=3;c.strokeRect(x+5,y+5,CW-10,CH-10);
      const d=28,p=13;c.lineWidth=5;
      const lines=[[[x+p+d,y+p],[x+p,y+p],[x+p,y+p+d]],[[x+CW-p-d,y+p],[x+CW-p,y+p],[x+CW-p,y+p+d]],[[x+p+d,y+CH-p],[x+p,y+CH-p],[x+p,y+CH-p-d]],[[x+CW-p-d,y+CH-p],[x+CW-p,y+CH-p],[x+CW-p,y+CH-p-d]]];
      for(const line of lines){c.beginPath();c.moveTo(...line[0]);c.lineTo(...line[1]);c.lineTo(...line[2]);c.stroke();}
    }
  }
  function reportError(err) {
    root.replaceChildren();const p=document.createElement('p');p.style.cssText='padding:40px;text-align:center;color:#f3c3c8;font-size:13px';p.textContent='전장 이미지를 표시하지 못했어: '+err.message;root.appendChild(p);$('renderer-status').textContent='로드 오류';
  }
  async function boot(){
    try{
      const attempt=new PixiField();await attempt.init();renderer=attempt;state.engine='pixi';
    }catch(err){
      console.warn('[L.I.V.E. M5] PixiJS 사용 불가, Canvas 전장으로 전환:',err);
      try{const fallback=new CanvasField();await fallback.init();renderer=fallback;state.engine='canvas';}
      catch(e){reportError(e);return;}
    }
    updateInformation();
  }
  $('mode-combat').addEventListener('click',()=>setMode('combat'));
  $('mode-prep').addEventListener('click',()=>setMode('prep'));
  $('toggle-grid').addEventListener('click',()=>toggle('grid'));
  $('toggle-points').addEventListener('click',()=>toggle('points'));
  $('select-next').addEventListener('click',()=>{
    const index=state.y*visibleCols()+state.x;
    const next=(index+1)%(visibleCols()*ROWS);
    selectCell(next%visibleCols(),Math.floor(next/visibleCols()));
  });
  document.addEventListener('keydown',e=>{
    if(e.target instanceof HTMLElement&&['INPUT','TEXTAREA','BUTTON'].includes(e.target.tagName))return;
    let x=state.x,y=state.y;
    if(e.key==='ArrowLeft')x--;
    else if(e.key==='ArrowRight')x++;
    else if(e.key==='ArrowUp')y--;
    else if(e.key==='ArrowDown')y++;
    else return;
    e.preventDefault();selectCell(clamp(x,0,visibleCols()-1),clamp(y,0,ROWS-1));
  });
  if(typeof ResizeObserver==='function')new ResizeObserver(updateDisplaySize).observe(document.querySelector('.lab-stage-space'));
  window.addEventListener('resize',updateDisplaySize,{passive:true});
  // Read-only QA interface, deliberately not integrated into the live engine.
  window.LIVEM5=Object.freeze({getState:()=>({...state,viewWidth:viewW(),cellWidth:CW,cellHeight:CH}),selectCell,setMode,toggleGrid:()=>toggle('grid')});
  updateInformation();boot();
})();
