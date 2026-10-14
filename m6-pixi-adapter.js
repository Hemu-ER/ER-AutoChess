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
 const P=()=>window.PIXI;
 const queue=()=>{if(!scheduled){scheduled=true;requestAnimationFrame(()=>{scheduled=false;draw().catch(error=>{console.warn('[M6 Pixi] fallback:',error);fallback();});});}};
 function fallback(){ready=false;board.classList.remove('m6-pixi-active');delete shell.dataset.m6Pixi;document.getElementById('m6-field-label')?.remove();if(app){try{app.destroy(true,{children:true});}catch(_){ }app=null;}layer=null;floorSprite=null;effects=null;activeFloor=false;nodes.clear();loading.clear();}
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
   layer=new px.Container();app.stage.addChild(layer);
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
   const rect=cell.getBoundingClientRect();if(!rect.width||!rect.height)continue;
   list.push({id,src,rect,unit,cell});
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
   const footX=rect.left-outer.left+rect.width/2,footY=rect.bottom-outer.top-rect.height*.10;
   const scale=Math.min(rect.height*1.78/Math.max(1,t.height),rect.width*1.35/Math.max(1,t.width));
   sprite.scale.set(v.unit.classList.contains('B')?-scale:scale,scale);
   container.position.set(footX,footY);container.zIndex=footY;
   container.alpha=v.unit.classList.contains('dead')?.3:1;
   ring.clear();
  });
  layer.sortableChildren=true;layer.sortChildren();
  for(const [id,entry] of nodes)if(!seen.has(id)){layer.removeChild(entry.container);entry.container.destroy({children:true});nodes.delete(id);}
  board.classList.add('m6-pixi-active');
 }
 const observer=new MutationObserver(queue);
 observer.observe(board,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style']});
 window.addEventListener('resize',queue,{passive:true});
 // PixiJS CDN failure must not affect M4. Stop polling after 10 seconds.
 let attempts=0;const begin=()=>{if(P()?.Application)init();else if(++attempts<30)setTimeout(begin,300);};
 begin();
 window.M6PixiAdapter={refresh:queue,disable:fallback};
})();
