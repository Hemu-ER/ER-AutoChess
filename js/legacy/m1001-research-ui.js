/* L.I.V.E. M10-01 / interactive research shop built from PixiJS scene objects.
 * Default OFF. Toggle in game or use ?m10ui=1 to preview the new renderer.
 * The M9-10 economy bridge remains the only authority for purchases.
 * Live character art comes from the existing roster; no generated text is baked in.
 */
(()=>{'use strict';
 const FLAG='live_m1001_optin';
 const $=(sel)=>document.querySelector(sel);
 const getBridge=()=>window.LIVEM10Bridge;
 const P=()=>window.PIXI;
 const query=new URLSearchParams(location.search);
 const forced=query.get('m10ui');
 let enabled=forced==='1'||(forced!=='0'&&(()=>{try{return localStorage.getItem(FLAG)==='1'}catch{return false}})());
 let app=null,appPending=false,mount=null,toggle=null,resizeObserver=null,rev=0,renderQueued=false;
 const textures=new Map();
 const PAL={base:0x0a141e,ink:0x12202d,navy:0x1c3040,edge:0x446b7c,cyan:0x77d5df,blue:0x96bccb,
  offwhite:0xe7f1f4,muted:0x8daab9,gold:0xf0ca80,violet:0xb59bdd,low:0x4a5261};
 const HEIGHT=220,MIN_WIDTH=606,PAD=8,GAP=7;
 function textNode(str,x,y,size=12,color=PAL.offwhite,weight='500',options={}){
  const t=new (P().Text)({text:String(str??''),style:{fontFamily:'"Noto Sans KR", "Malgun Gothic", system-ui, sans-serif',fontSize:size,fill:color,fontWeight:weight,
    wordWrap:!!options.wordWrap,wordWrapWidth:options.width||0,breakWords:true,align:options.align||'left'}});
  t.position.set(x,y);if(options.anchor!==undefined)t.anchor.set(options.anchor,0);
  return t;
 }
 function panel(x,y,w,h,r=8,fill=PAL.ink,alpha=1,stroke=PAL.edge){
  return new (P().Graphics)().roundRect(x,y,w,h,r).fill({color:fill,alpha}).roundRect(x+.5,y+.5,w-1,h-1,r).stroke({color:stroke,alpha:.75,width:1});
 }
 function line(x1,y1,x2,y2,color=PAL.cyan,a=.75,width=1){return new (P().Graphics)().moveTo(x1,y1).lineTo(x2,y2).stroke({color,alpha:a,width})}
 function asset(url){if(!textures.has(url))textures.set(url,P().Assets.load(url).catch(()=>null));return textures.get(url)}
 function addPortrait(container,src,x,y,w,h,revision){
  const crop=new (P().Container)();crop.position.set(x,y);container.addChild(crop);
  const bg=new (P().Graphics)().rect(0,0,w,h).fill({color:0x192a35});crop.addChild(bg);
  const mask=new (P().Graphics)().roundRect(0,0,w,h,4).fill({color:0xffffff});crop.addChild(mask);
  const sprite=new (P().Sprite)(P().Texture.EMPTY);sprite.anchor.set(.5,0);sprite.position.set(w/2,-2);sprite.mask=mask;crop.addChild(sprite);
  crop.addChild(line(0,h-1,w,h-1,PAL.cyan,.3));
  if(!src)return;
  asset(src).then(tex=>{
   if(!tex||revision!==rev||sprite.destroyed||!app)return;
   sprite.texture=tex;
   // Top-of-portrait crop for full-body transparent SD art (typically 832x1216).
   const scale=Math.max(w/Math.max(1,tex.width)*1.48,h/Math.max(1,tex.height)*2.75);
   sprite.scale.set(scale);sprite.position.set(w/2,-Math.max(0,tex.height*scale*.045));
  }).catch(()=>{});
 }
 function setActionCard(card,fn){
  card.eventMode='static';card.hitArea=new (P().Rectangle)(0,0,card.width,card.height);card.cursor='pointer';
  card.on('pointerover',()=>{card.alpha=1});card.on('pointerout',()=>{card.alpha=.92});
  card.on('pointertap',fn);
 }
 function card(offer,x,y,w,h,revision,phase){
  const g=new (P().Container)();g.position.set(x,y);g.alpha=.92;
  const empty=offer.empty===true;
  g.addChild(panel(0,0,w,h,6,empty?0x111c27:PAL.ink,1,empty?0x314b57:(offer.focused?PAL.gold:PAL.edge)));
  const shell=new (P().Sprite)(P().Texture.EMPTY);g.addChild(shell);
  asset('assets/m10/ui/card-shell.svg').then(tex=>{if(tex&&revision===rev&&!shell.destroyed){shell.texture=tex;shell.width=w;shell.height=h;}}).catch(()=>{});
  if(empty){g.addChild(textNode('SLOT '+String(offer.index+1).padStart(2,'0'),8,7,9,PAL.muted));
   g.addChild(textNode('등록 완료',w/2,h/2-9,12,PAL.muted,'600',{anchor:.5}));return g;}
  g.addChild(new (P().Graphics)().rect(7,21,w-14,h-77).fill({color:0x0c171f}));
  addPortrait(g,offer.portrait,7,21,w-14,h-77,revision);
  g.addChild(new (P().Graphics)().rect(7,h-60,w-14,1).fill({color:offer.focused?PAL.gold:PAL.cyan,alpha:.8}));
  g.addChild(textNode('S'+String(offer.index+1).padStart(2,'0'),8,5,9,offer.focused?PAL.gold:PAL.muted,'700'));
  g.addChild(textNode(offer.focused?'◆ LINK':'● READY',w-7,5,8,offer.focused?PAL.gold:PAL.cyan,'700',{anchor:1}));
  const fs=offer.name.length>8?10:12;
  g.addChild(textNode(offer.name,8,h-54,fs,PAL.offwhite,'700'));
  g.addChild(textNode(offer.role.slice(0,14)||'미분류',8,h-34,9,PAL.muted));
  g.addChild(textNode(`${offer.cost} C`,w-7,h-35,12,PAL.gold,'700',{anchor:1}));
  const affiliations=offer.affiliations?.slice(0,2).join(' / ')||'—';
  g.addChild(textNode(affiliations.slice(0,18),8,h-17,9,PAL.blue));
  if(offer.owned)g.addChild(textNode('×'+offer.owned,w-7,h-17,9,PAL.gold,'700',{anchor:1}));
  if(phase==='prep')setActionCard(g,()=>getBridge()?.buy(offer.index));
  else g.alpha=.55;
  return g;
 }
 function draw(snapshot){
  if(!app||!mount||!snapshot)return;
  const r=++rev, stage=app.stage;
  for(const obj of stage.removeChildren())obj.destroy({children:true});
  const cw=Math.max(MIN_WIDTH,Math.floor(mount.clientWidth||MIN_WIDTH));
  app.renderer.resize(cw,HEIGHT);
  const root=new (P().Container)();stage.addChild(root);
  root.addChild(panel(0,0,cw,HEIGHT,9,PAL.base,1,PAL.edge));
  const header=new (P().Sprite)(P().Texture.EMPTY);root.addChild(header);
  asset('assets/m10/ui/console-header.svg').then(tex=>{if(tex&&r===rev&&!header.destroyed){header.texture=tex;header.width=cw;header.height=29;}}).catch(()=>{});
  root.addChild(new (P().Graphics)().rect(0,0,4,HEIGHT).fill({color:PAL.cyan,alpha:.85}));
  root.addChild(textNode('L.I.V.E.   /   RESEARCH CONSOLE',32,8,11,PAL.cyan,'700'));
  const mark=new (P().Sprite)(P().Texture.EMPTY);mark.position.set(11,5);mark.width=17;mark.height=17;root.addChild(mark);
  asset('assets/m10/ui/research-mark.svg').then(tex=>{if(tex&&r===rev&&!mark.destroyed){mark.texture=tex;mark.width=17;mark.height=17}}).catch(()=>{});
  root.addChild(textNode(`R ${String(snapshot.round).padStart(2,'0')}  ·  ${snapshot.phase==='prep'?'편성 / 실험체 확보':'관측 대기'}`,cw-12,8,10,PAL.blue,'600',{anchor:1}));
  root.addChild(line(12,29,cw-12,29,PAL.cyan,.32));
  const offers=(snapshot.offers||[]).slice(0,5);
  const count=5,w=(cw-PAD*2-GAP*(count-1))/count;
  for(let i=0;i<count;i++)root.addChild(card(offers[i]||{index:i,empty:true},PAD+i*(w+GAP),34,w,176,r,snapshot.phase));
  root.addChild(textNode('검증된 상점 데이터 · 카드 클릭으로 구매',12,211,8,PAL.muted));
  root.addChild(textNode(`${snapshot.credits} C  ·  ${snapshot.shopLocked?'진열 고정':'일반 진열'}`,cw-12,211,9,PAL.gold,'600',{anchor:1}));
  if(!mount.querySelector('.m1001-sell-zone')){const sell=document.createElement('div');sell.className='m1001-sell-zone dock-shop';sell.textContent='실험체 · 아이템 판매';sell.title='실험체 또는 아이템을 이 영역으로 드래그해 판매';mount.appendChild(sell);}
  mount.querySelector('.m1001-screen-reader')?.remove();
  const a11y=document.createElement('div');a11y.className='m1001-screen-reader';
  for(const o of offers){if(o.empty)continue;const b=document.createElement('button');b.type='button';b.disabled=snapshot.phase!=='prep';
   b.textContent=`${o.name} 구매 · ${o.cost} 크레딧`;b.addEventListener('click',()=>getBridge()?.buy(o.index));a11y.appendChild(b);}
  mount.appendChild(a11y);
 }
 function activeShop(){return document.body.dataset.appMode==='game'&&!!$('#gameBottomDock .dock-shop')}
 function updateToggle(){
  if(!toggle){toggle=document.createElement('button');toggle.type='button';toggle.id='m1001ModeToggle';
   toggle.addEventListener('click',()=>{enabled=!enabled;try{localStorage.setItem(FLAG,enabled?'1':'0')}catch{}sync()});document.body.appendChild(toggle);}
  const can=activeShop();toggle.hidden=!can;toggle.dataset.active=String(can&&enabled&&document.body.classList.contains('m1001-active'));
  toggle.textContent=enabled?'M10 그래픽 상점 ●':'M10 그래픽 상점 ○';
  toggle.setAttribute('aria-pressed',String(!!(can&&enabled&&document.body.classList.contains('m1001-active'))));
 }
 function stop(){
  if(!mount&&!app&&!resizeObserver)return;
  document.body.classList.remove('m1001-active');rev++;
  resizeObserver?.disconnect();resizeObserver=null;
  if(mount){mount.remove();mount=null}
  if(app){try{app.destroy(true,{children:true})}catch{}app=null}
  appPending=false;
 }
 async function ensure(){
  if(!mount||app||appPending)return;
  if(!P()?.Application){enabled=false;stop();updateToggle();console.warn('[M10-01] PixiJS missing; M9-10 HTML shop preserved');return;}
  appPending=true;
  const target=mount;let instance=null;
  try{
   instance=new (P().Application)();await instance.init({width:Math.max(MIN_WIDTH,target.clientWidth||MIN_WIDTH),height:HEIGHT,
    backgroundAlpha:0,antialias:true,resolution:Math.min(2,window.devicePixelRatio||1),autoDensity:true,preference:'webgl'});
   if(!target.isConnected||!enabled||!activeShop()){instance.destroy(true,{children:true});return;}
   app=instance;app.canvas.setAttribute('role','img');app.canvas.setAttribute('aria-label','실험체 상점 카드 5개. 키보드로는 이어지는 구매 버튼 이용');
   app.canvas.style.height=HEIGHT+'px';app.canvas.style.display='block';target.prepend(app.canvas);
   resizeObserver=new ResizeObserver(()=>schedule());resizeObserver.observe(target);
   document.body.classList.add('m1001-active');schedule();
  }catch(e){console.warn('[M10-01] graphic shop failed, old shop restored',e);enabled=false;stop();updateToggle();
   if(instance&&instance!==app)try{instance.destroy(true,{children:true})}catch{}
  }finally{appPending=false;}
 }
 function sync(){
  if(!enabled||!activeShop()){stop();updateToggle();return;}
  const center=$('#gameBottomDock .dock-center'),shop=center?.querySelector('.dock-shop');
  if(!center||!shop){stop();updateToggle();return;}
  if(!mount){mount=document.createElement('div');mount.id='m1001CanvasMount';mount.setAttribute('aria-label','M10 실험체 확보 그래픽 상점');}
  if(mount.parentElement!==center)center.insertBefore(mount,shop);
  if(!app&&!appPending)ensure();
  else if(app){document.body.classList.add('m1001-active');schedule();}
  updateToggle();
 }
 function schedule(){if(renderQueued)return;renderQueued=true;requestAnimationFrame(()=>{renderQueued=false;
  if(!app||!enabled||!activeShop()||!mount?.isConnected)return;
  try{draw(getBridge()?.snapshot())}catch(e){console.warn('[M10-01] render fallback',e);enabled=false;stop();updateToggle();}
 })}
 window.LIVEM10UI=Object.freeze({get active(){return enabled&&!!app},enable(){enabled=true;sync()},disable(){enabled=false;sync()},refresh:sync});
 window.addEventListener('live:m10:economy',sync);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sync,{once:true});else sync();
})();
