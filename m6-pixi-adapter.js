/* M6-01: presentation-only PixiJS adapter for the existing M4 DOM board.
 * M4 game state, events, combat, lobby and networking remain authoritative.
 */
(()=>{'use strict';
 const board=document.getElementById('board');
 if(!board)return;
 const shell=board.closest('.board-shell');
 if(!shell)return;
 let app=null, layer=null, floorSprite=null, effects=null, ready=false, scheduled=false, busy=false;
 const FLOORS=['lab','alley','beach','cemetery','church','estate','forest','hotel','police','temple'];
 const params=new URLSearchParams(location.search);
 const chosen=params.get('m6floor');
 const floorId=FLOORS.includes(chosen)?chosen:'lab';
 const floorPath=`assets/m5/floor/${floorId}.png`;
 let activeFloor=false;
 const nodes=new Map(), loading=new Map();
 const hits=[], lastBasic=new Map(), motions=new Map();
 let motionFrame=0;
 const clock=()=>performance.now();
 function impact(e){if(!ready||!e?.unitId||!(Number(e.amount)>0))return;
  const at=clock();hits.push({id:String(e.unitId),amount:Number(e.amount),at,critical:!!e.critical});
  while(hits.length>65)hits.shift();motions.set(String(e.unitId),{kind:'hit',at});startMotion();
 }
 function combatSnapshot(units){if(!ready||!Array.isArray(units))return;
  const present=new Set();const at=clock();
  for(const u of units){const id=String(u.id);present.add(id);const n=Number(u.basicCount||0),old=lastBasic.get(id);
   if(old!==undefined&&n>old)motions.set(id,{kind:'attack',at});lastBasic.set(id,n);
  }
  for(const id of lastBasic.keys())if(!present.has(id))lastBasic.delete(id);
  startMotion();
 }
 function startMotion(){if(motionFrame||!ready)return;motionFrame=requestAnimationFrame(animateMotion)}
 function animateMotion(){motionFrame=0;if(!ready||!app)return;
  const now=clock();let active=false;
  for(const [id,entry] of nodes){const m=motions.get(id);let dx=0,dy=0;
   if(m){const age=now-m.at,duration=m.kind==='attack'?170:220;
    if(age<duration){const t=age/duration,k=Math.sin(Math.PI*t);dx=m.kind==='attack'?(entry.team==='B'?-1:1)*9*k:0;dy=m.kind==='hit'?4*k:0;
     entry.sprite.tint=m.kind==='hit'?0xffb9bf:0xffffff;active=true;
    }else{motions.delete(id);entry.sprite.tint=0xffffff;}}
   entry.container.position.set(entry.baseX+dx,entry.baseY+dy);
  }
  const gfx=app.stage.getChildByLabel?.('m6-floats');
  if(gfx){gfx.removeChildren().forEach(c=>c.destroy?.());for(const h of hits){const age=now-h.at;if(age>1050)continue;
   const ent=nodes.get(h.id);if(!ent)continue;active=true;
   const color=h.critical?0xffdc91:0xffb6bd;
   const t=new (P().Text)({text:Math.round(h.amount).toLocaleString('ko-KR'),style:{fontFamily:'Arial,sans-serif',fontSize:h.critical?24:19,fontWeight:'900',fill:color,stroke:{color:0x101016,width:4}}});
   t.anchor.set(.5,.5);const lane=hits.filter(v=>v.id===h.id&&Math.abs(v.at-h.at)<200).indexOf(h);
   t.position.set(ent.baseX+(lane%3-1)*17,ent.baseY-Math.max(32,ent.visualHeight*.85)-age*.055);t.alpha=Math.min(1,(1050-age)/360);gfx.addChild(t);
  }}
  for(let i=hits.length-1;i>=0;i--)if(now-hits[i].at>1050)hits.splice(i,1);
  if(active)startMotion();
 }

 const P=()=>window.PIXI;
 const queue=()=>{if(!scheduled){scheduled=true;requestAnimationFrame(()=>{scheduled=false;draw().catch(error=>{console.warn('[M6 Pixi] fallback:',error);fallback();});});}};
 function fallback(){ready=false;board.classList.remove('m6-pixi-active');delete shell.dataset.m6Pixi;document.getElementById('m6-field-label')?.remove();if(app){try{app.destroy(true,{children:true});}catch(_){ }app=null;}layer=null;floorSprite=null;effects=null;activeFloor=false;nodes.clear();loading.clear();hits.length=0;motions.clear();lastBasic.clear();if(motionFrame)cancelAnimationFrame(motionFrame);motionFrame=0;}
 async function init(){
  if(app||busy||!P()?.Application)return;
  busy=true;
  try{
   const px=P(),instance=new px.Application();
   await instance.init({width:Math.max(1,shell.clientWidth),height:Math.max(1,shell.clientHeight),backgroundAlpha:0,antialias:true,preference:'webgl'});
   instance.canvas.className='m6-pixi-canvas';instance.canvas.setAttribute('aria-hidden','true');
   shell.appendChild(instance.canvas);app=instance;
   const tex=await px.Assets.load(floorPath);
   floorSprite=new px.Sprite(tex);floorSprite.tint=0xb5b5b5;app.stage.addChild(floorSprite);
   effects=new px.Graphics();app.stage.addChild(effects);
   layer=new px.Container();app.stage.addChild(layer);const floats=new px.Container();floats.label="m6-floats";app.stage.addChild(floats);
   activeFloor=true;ready=true;queue();
   shell.dataset.m6Pixi='active';
   const tag=document.getElementById('m6-field-label')||document.createElement('div');
   tag.id='m6-field-label';tag.textContent=`L.I.V.E.  /  M6 PIXI FIELD  /  ${floorId.toUpperCase()}`;shell.appendChild(tag);
  }catch(e){console.warn('[M6 Pixi] init failed, M4 preserved',e);fallback();}finally{busy=false;}
 }
 async function texture(url){if(loading.has(url))return loading.get(url);const task=P().Assets.load(url);loading.set(url,task);return task;}
 async function draw(){
  if(!ready||!app||!layer)return;
  const w=Math.max(1,shell.clientWidth),h=Math.max(1,shell.clientHeight);
  if(app.renderer.width!==w||app.renderer.height!==h)app.renderer.resize(w,h);
  const outer=shell.getBoundingClientRect(),seen=new Set(),list=[];
  // The full M5 artwork lives in the Pixi stage, behind M4's interactive DOM cells.
  const cover=Math.max(w/Math.max(1,floorSprite.texture.width),h/Math.max(1,floorSprite.texture.height));
  floorSprite.width=floorSprite.texture.width*cover;floorSprite.height=floorSprite.texture.height*cover;
  floorSprite.position.set((w-floorSprite.width)/2,(h-floorSprite.height)/2);
  effects.clear();
  // Ground markers align to the *real* M4 cells; no replacement input/hit testing.
  for(const cell of board.querySelectorAll('.cell')){
    const r=cell.getBoundingClientRect();if(!r.width||!r.height||getComputedStyle(cell).display==='none')continue;
    const x=r.left-outer.left+r.width/2,y=r.bottom-outer.top-r.height*.08;
    const isB=cell.classList.contains('teamB');
    effects.ellipse(x,y,Math.max(10,r.width*.31),Math.max(4,r.height*.082)).fill({color:0x010811,alpha:.35});
    effects.ellipse(x,y,Math.max(10,r.width*.31),Math.max(4,r.height*.082)).stroke({width:2,color:isB?0xe8a7bd:0x83d9e4,alpha:.60});
  }
  for(const unit of board.querySelectorAll('.unit')){
   const img=unit.querySelector('.sd-slot img.sd-image');if(!img?.getAttribute('src'))continue;
   const cell=unit.closest('.cell');if(!cell||getComputedStyle(cell).display==='none')continue;
   const id=unit.dataset.id||String(list.length),src=img.getAttribute('src');
   const rect=cell.getBoundingClientRect(),slot=unit.querySelector('.sd-slot')?.getBoundingClientRect(),hud=unit.querySelector('.unit-hud')?.getBoundingClientRect();if(!rect.width||!rect.height)continue;
   list.push({id,src,rect,slot,hud,unit,cell});
  }
  // Only enable sprite substitution if every visible unit texture loaded.
  const loaded=await Promise.allSettled(list.map(v=>texture(v.src)));
  if(!ready||!app)return;
  if(loaded.some(x=>x.status!=='fulfilled')){board.classList.remove('m6-pixi-active');return;}
  list.forEach((v,i)=>{
   seen.add(v.id);let entry=nodes.get(v.id);const t=loaded[i].value;
   if(!entry){const container=new (P().Container)();const ring=new (P().Graphics)();const sprite=new (P().Sprite)(t);sprite.anchor.set(.5,1);container.addChild(ring,sprite);layer.addChild(container);entry={container,ring,sprite,src:v.src};nodes.set(v.id,entry);}
   if(entry.src!==v.src){entry.sprite.texture=t;entry.src=v.src;}
   const {container,sprite,ring}=entry,rect=v.rect;
   const footX=rect.left-outer.left+rect.width/2;
   // Keep sprite shoes on the M4 ground-ring line and place the health bar near the body, not in the feet.
   const footY=rect.bottom-outer.top-rect.height*.10;
   // Deliberately cap visual size below one grid cell: tall silhouettes must never cover the next row.
   const heightLimit=Math.min(rect.height*.92,(v.slot?.height||rect.height)*.84);
   const widthLimit=rect.width*.64;
   const scale=Math.min(heightLimit/Math.max(1,t.height),widthLimit/Math.max(1,t.width));
   sprite.scale.set(v.unit.classList.contains('B')?-scale:scale,scale);
   entry.baseX=footX;entry.baseY=footY;entry.visualHeight=t.height*scale;entry.team=v.unit.classList.contains('B')?'B':'A';
   // Sync HUD to the actual PIXI sprite's head, not to an arbitrary grid-cell percentage.
   // Read from unit coordinates because the HUD is absolutely positioned within .unit.
   const unitRect=v.unit.getBoundingClientRect();
   const spriteHead=footY-t.height*scale;
   const nextHudTop=Math.round(spriteHead-(unitRect.top-outer.top)-12);
   if(v.unit.style.getPropertyValue('--m6-hud-top')!==nextHudTop+'px')
     v.unit.style.setProperty('--m6-hud-top',nextHudTop+'px');
   if(!motions.has(v.id))container.position.set(footX,footY);container.zIndex=footY;
   container.alpha=v.unit.classList.contains('dead')?.3:1;
   ring.clear();
  });
  layer.sortableChildren=true;layer.sortChildren();
  for(const [id,entry] of nodes)if(!seen.has(id)){layer.removeChild(entry.container);entry.container.destroy({children:true});nodes.delete(id);}
  board.classList.add('m6-pixi-active');
 }
 // Catch geometry changes caused by CSS/round mode, without altering M4 game state.
 const resizeObserver=window.ResizeObserver?new ResizeObserver(queue):null;resizeObserver?.observe(shell);resizeObserver?.observe(board);
 const observer=new MutationObserver(queue);
 observer.observe(board,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style']});
 window.addEventListener('resize',queue,{passive:true});
 // PixiJS CDN failure must not affect M4. Stop polling after 10 seconds.
 let attempts=0;const begin=()=>{if(P()?.Application)init();else if(++attempts<30)setTimeout(begin,300);};
 begin();
 window.M6PixiAdapter={refresh:queue,disable:fallback,impact,combatSnapshot};
})();
