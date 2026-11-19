/* M6-01: presentation-only PixiJS adapter for the existing M4 DOM board.
 * M4 game state, events, combat, lobby and networking remain authoritative.
 */
(()=>{'use strict';
 const board=document.getElementById('board');
 if(!board)return;
 const shell=board.closest('.board-shell');
 if(!shell)return;
 let app=null, layer=null, floorSprite=null, effects=null, ready=false, scheduled=false, busy=false;
 // M7-03: invalidate stale asynchronous draws when units/rounds change.
 let drawing=false, dirty=false, drawVersion=0;
 const FLOORS=['lab','alley','beach','cemetery','church','estate','forest','hotel','police','temple'];
 const params=new URLSearchParams(location.search);
 const chosen=params.get('m6floor');
 let floorId=FLOORS.includes(chosen)?chosen:'lab';
 let floorPath=`assets/m5/floor/${floorId}.webp`;
 let floorRequest=0;
 function desiredFloor(){
  const net=window.LIVEMultiplayer?.getRoom?.()?.game;
  const playing=net?.phase==='combat' && !net.pve;
  const raw=playing?net.region:(net?null:(window.M6VisualRegion||null));
  return playing && FLOORS.includes(raw)?raw:null;
 }
 async function syncFloor(){
  if(!ready||!floorSprite)return;
  const desired=desiredFloor();
  const key=desired||'lab';
  if(floorId===key && activeFloor===(!!desired))return;
  const ticket=++floorRequest;
  if(desired){try{const tex=await texture(`assets/m5/floor/${key}.webp`);if(ticket!==floorRequest||!ready)return;floorSprite.texture=tex;floorSprite.visible=true;floorId=key;activeFloor=true;}
    catch(e){console.warn('[M6 Pixi] 지역 이미지 로드 실패',e);return;}}
  else{floorSprite.visible=false;floorId=key;activeFloor=false;}
  document.getElementById('m6-field-label')?.replaceChildren(document.createTextNode(desired?`전장 · ${desired.toUpperCase()}`:''));
 }
 
 let activeFloor=false;
 const nodes=new Map(), loading=new Map();
 const floats=[], pendingFloats=new Map(), skillLabels=new Map(), lastBasic=new Map(), motions=new Map();
 let motionFrame=0;
 const clock=()=>performance.now();
 function showDomIfFormation(formation){if(app?.canvas)app.canvas.style.visibility=formation?'hidden':'visible';if(formation){board.classList.remove('m6-pixi-active');if(layer)layer.visible=false;}}

 function floatFlavor(e){
  if(e?.type==='heal')return 'heal';
  const tags=new Set(Array.isArray(e?.tags)?e.tags:[]);
  if(tags.has('shared'))return 'shared';
  if(tags.has('delayed'))return 'delayed';
  if(tags.has('dot'))return 'dot';
  if(e?.kind==='skill')return 'skill';
  if(e?.kind==='passive'||e?.kind==='synergy')return 'effect';
  return 'basic';
 }
 function impact(e){if(!ready||!e?.unitId||!(Number(e.amount)>0))return;
  const at=clock(),id=String(e.unitId),flavor=floatFlavor(e),type=e.type==='heal'?'heal':'damage';
  const bucket=Math.floor(at/420),key=[type,id,flavor,bucket].join(':');
  const current=pendingFloats.get(key)||{id,amount:0,at,bucket,critical:false,flavor,type,sourceId:e.sourceId||null};
  current.amount+=Number(e.amount);current.critical ||= !!e.critical;current.sourceId=e.sourceId||current.sourceId||null;pendingFloats.set(key,current);
  if(type==='damage')motions.set(id,{kind:'hit',at});
  if(e.sourceId)motions.set(String(e.sourceId),{kind:'attack',at});
  startMotion();
 }
 function skillCast(e){if(!ready||!e?.unitId||!e?.skill)return;skillLabels.set(String(e.unitId),{text:String(e.skill),at:clock()});motions.set(String(e.unitId),{kind:'attack',at:clock()});startMotion()}
 function combatEvent(e){if(!e)return;if(e.type==='damage'||e.type==='heal')impact(e);else if(e.type==='skill')skillCast(e)}
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
  for(const [key,hit] of pendingFloats){if(now>=(hit.bucket+1)*420){floats.push({...hit,at:now});pendingFloats.delete(key);}else active=true;}
  while(floats.length>96)floats.shift();
  for(const [id,entry] of nodes){const m=motions.get(id);let dx=0,dy=0;
   if(m){const age=now-m.at,duration=m.kind==='attack'?170:220;
    if(age<duration){const t=age/duration,k=Math.sin(Math.PI*t);dx=m.kind==='attack'?(entry.team==='B'?-1:1)*9*k:0;dy=m.kind==='hit'?4*k:0;
     entry.sprite.tint=m.kind==='hit'?0xffc9ce:0xffffff;active=true;
    }else{motions.delete(id);entry.sprite.tint=0xffffff;}}
   entry.container.position.set(entry.baseX+dx,entry.baseY+dy);
  }
  const gfx=app.stage.getChildByLabel?.('m6-floats');
  if(gfx){gfx.removeChildren().forEach(c=>c.destroy?.());const damageLanes=new Map(),labelLanes=new Map();
   const styleFor=float=>{
    const styles={
      basic:{fill:0xffc0c8,size:19,fontStyle:'normal'},
      skill:{fill:0xffd39a,size:21,fontStyle:'italic'},
      effect:{fill:0xf8d3a3,size:18,fontStyle:'italic'},
      dot:{fill:0xffaa87,size:17,fontStyle:'italic'},
      delayed:{fill:0xd4bcff,size:18,fontStyle:'italic'},
      shared:{fill:0xbfc8ff,size:18,fontStyle:'italic'},
      heal:{fill:0x9ce8c7,size:19,fontStyle:'normal'}
    };return styles[float.flavor]||styles.basic;
   };
   for(const h of floats){const age=now-h.at;if(age>1100)continue;const ent=nodes.get(h.id);if(!ent)continue;active=true;
    const style=styleFor(h);const prefix=h.type==='heal'?'+':'';
    const t=new (P().Text)({text:`${prefix}${Math.round(h.amount).toLocaleString('ko-KR')}`,style:{fontFamily:'Arial,sans-serif',fontSize:h.critical?style.size+3:style.size,fontWeight:'900',fontStyle:style.fontStyle,fill:style.fill,stroke:{color:0x101016,width:4}}});
    t.anchor.set(.5,.5);const lane=(damageLanes.get(h.id)||0);damageLanes.set(h.id,lane+1);
    t.position.set(ent.baseX+Math.max(12,ent.visualHeight*.24)+(lane%4)*7,ent.baseY-Math.max(22,ent.visualHeight*.78)-(lane%5)*11-age*.046);t.alpha=Math.max(0,Math.min(1,(1100-age)/360));gfx.addChild(t);
   }
   for(const [id,label] of skillLabels){const age=now-label.at;if(age>650){skillLabels.delete(id);continue;}const ent=nodes.get(id);if(!ent)continue;active=true;
    const lane=(labelLanes.get(id)||0);labelLanes.set(id,lane+1);
    const t=new (P().Text)({text:label.text,style:{fontFamily:'Arial,sans-serif',fontSize:12,fontWeight:'800',fill:0xeef8fb,stroke:{color:0x091116,width:3},letterSpacing:0.2}});
    t.anchor.set(.5,1);t.position.set(ent.baseX,ent.baseY-ent.visualHeight-12-lane*14-age*.016);t.alpha=Math.max(0,Math.min(1,1-age/650));gfx.addChild(t);
   }
  }
  for(let i=floats.length-1;i>=0;i--)if(now-floats[i].at>1100)floats.splice(i,1);
  if(active)startMotion();
 }

 const P=()=>window.PIXI;
 const queue=()=>{drawVersion++;if(drawing){dirty=true;return;}if(!scheduled){scheduled=true;requestAnimationFrame(()=>{scheduled=false;draw().catch(error=>{console.warn('[M6 Pixi] fallback:',error);fallback();});});}};
 function fallback(){ready=false;drawing=false;dirty=false;drawVersion++;board.classList.remove('m6-pixi-active');delete shell.dataset.m6Pixi;document.getElementById('m6-field-label')?.remove();if(app){try{app.destroy(true,{children:true});}catch(_){ }app=null;}layer=null;floorSprite=null;effects=null;activeFloor=false;nodes.clear();loading.clear();floats.length=0;pendingFloats.clear();skillLabels.clear();motions.clear();lastBasic.clear();if(motionFrame)cancelAnimationFrame(motionFrame);motionFrame=0;}
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
   activeFloor=false;floorSprite.visible=false;ready=true;queue();
   shell.dataset.m6Pixi='active';
   const tag=document.getElementById('m6-field-label')||document.createElement('div');
   tag.id='m6-field-label';tag.textContent=`L.I.V.E.  /  M6 PIXI FIELD  /  ${floorId.toUpperCase()}`;shell.appendChild(tag);
  }catch(e){console.warn('[M6 Pixi] init failed, M4 preserved',e);fallback();}finally{busy=false;}
 }
 async function texture(url){if(loading.has(url))return loading.get(url);const task=P().Assets.load(url);loading.set(url,task);return task;}
 async function draw(){
  if(!ready||!app||!layer)return;
  if(board.classList.contains('formation-board')){showDomIfFormation(true);return;}
  if(drawing){dirty=true;return;}
  drawing=true;const revision=drawVersion;
  try{
  await syncFloor();
  if(!ready||revision!==drawVersion)return;
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
  // The DOM remains the safe fallback when no visible sprites exist (e.g. after a full wipe).
  if(!list.length){board.classList.remove('m6-pixi-active');layer.visible=false;for(const entry of nodes.values()){layer.removeChild(entry.container);entry.container.destroy({children:true})}nodes.clear();return;}
  // Only enable sprite substitution if every visible unit texture loaded.
  const loaded=await Promise.allSettled(list.map(v=>texture(v.src)));
  if(!ready||!app||revision!==drawVersion)return;
  if(loaded.some(x=>x.status!=='fulfilled')){board.classList.remove('m6-pixi-active');layer.visible=false;return;}
  layer.visible=true;
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
   container.alpha=1; // dead units are removed by M4 render() rather than translucent
   ring.clear();
  });
  layer.sortableChildren=true;layer.sortChildren();
  for(const [id,entry] of nodes)if(!seen.has(id)){layer.removeChild(entry.container);entry.container.destroy({children:true});nodes.delete(id);}
  board.classList.add('m6-pixi-active');
  }finally{
   drawing=false;
   if(ready&&(dirty||revision!==drawVersion)){dirty=false;queue();}
  }
 }
 // Catch geometry changes caused by CSS/round mode, without altering M4 game state.
 const resizeObserver=window.ResizeObserver?new ResizeObserver(queue):null;resizeObserver?.observe(shell);resizeObserver?.observe(board);
 const observer=new MutationObserver(queue);
 observer.observe(board,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style']});
 window.addEventListener('resize',queue,{passive:true});
 // PixiJS CDN failure must not affect M4. Stop polling after 10 seconds.
 let attempts=0;const begin=()=>{if(P()?.Application)init();else if(++attempts<30)setTimeout(begin,300);};
 begin();
 setInterval(()=>{if(ready && desiredFloor()!== (activeFloor?floorId:null))queue();},350);
 window.M6PixiAdapter={refresh:queue,disable:fallback,showDomIfFormation,impact,combatEvent,combatSnapshot};
})();
