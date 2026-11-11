/* L.I.V.E. M10-02 — Full PixiJS preparation scene.
 * Original M9-10 UI and combat are left intact as a fallback.
 * All gameplay state/actions come from LIVEM10PrepBridge in game.js.
 */
(()=>{'use strict';
 const KEY='live_m1002_prep_enabled';
 const query=new URLSearchParams(location.search);
 let enabled=query.get('m10prep')==='1'||(query.get('m10prep')!=='0'&&(()=>{try{return localStorage.getItem(KEY)!=='0'}catch{return true}})());
 const P=()=>window.PIXI,bridge=()=>window.LIVEM10PrepBridge;
 const C={bg:0x070c12,panel:0x121a23,raised:0x1a2530,inner:0x101820,border:0x354a56,edge:0x5b7c8a,
  soft:0x273944,txt:0xe0e7eb,muted:0x9aabb5,dim:0x748896,teal:0x779da8,green:0x8ba99b,
  gold:0xb9a27b,red:0xb78286,blue:0x7594ad,selected:0xb0baa8};
 const BW=1600,BH=900,MAX_CARD=5;
 const L={board:{x:350,y:135,w:915,h:460},grid:{x:505,y:184,w:600,h:355},bench:{x:350,y:606,w:915,h:91},shop:{x:350,y:707,w:915,h:169},synergy:{x:45,y:135,w:288,h:285},economy:{x:45,y:430,w:288,h:446},inspect:{x:1282,y:135,w:273,h:373},items:{x:1282,y:518,w:273,h:358},ready:{x:1115,y:39,w:141,h:47},sell:{x:1148,y:545,w:99,h:38}};
 let app=null,mount=null,toggle=null,pending=false,resizeObserver=null,rev=0,lastSignature='',drawQueued=false,root=null,scale=1,origin={x:0,y:0},
  selectedUid=null,selectedItem=null,focusOpened=false,synergyPage=0,selectedSynergy=null,drag=null,ghost=null,lastError='',timeText=null,currentSnap=null,paintTimer=null;
 const assets=new Map();
 const fonts='"Noto Sans KR","Malgun Gothic",system-ui,sans-serif';
 const box=(x,y,w,h,{fill=C.panel,stroke=C.border,r=7,a=1,sw=1}={})=>new (P().Graphics)().roundRect(x,y,w,h,r).fill({color:fill,alpha:a}).roundRect(x+.5,y+.5,w-1,h-1,r).stroke({color:stroke,width:sw,alpha:.82});
 const line=(x,y,x2,y2,c=C.border,alpha=.8,width=1)=>new (P().Graphics)().moveTo(x,y).lineTo(x2,y2).stroke({color:c,alpha,width});
 function t(str,x,y,size=13,color=C.txt,weight='500',maxW=0){const node=new (P().Text)({text:String(str??''),style:{fontFamily:fonts,fontSize:size,fontWeight:weight,fill:color,
  wordWrap:!!maxW,wordWrapWidth:maxW||0,breakWords:true}});node.position.set(x,y);return node}
 function write(parent,str,x,y,size=13,color=C.txt,weight='500',maxW=0){const node=t(str,x,y,size,color,weight,maxW);parent.addChild(node);return node}
 function rect(parent,x,y,w,h,opt){const n=box(x,y,w,h,opt);parent.addChild(n);return n}
 function separator(parent,x,y,x2,y2,c,a){parent.addChild(line(x,y,x2,y2,c,a))}
 function group(){return new (P().Container)()}
 function chip(parent,label,x,y,w,color=C.edge){rect(parent,x,y,w,23,{fill:C.inner,stroke:color,r:4});write(parent,label,x+7,y+4,11,C.txt,'500')}
 function button(parent,label,x,y,w,h,fn,{primary=false,disabled=false,small=false,active=false}={}){
  const g=group();g.position.set(x,y);g.addChild(box(0,0,w,h,{fill:disabled?C.inner:primary?0x253d47:active?0x293941:C.raised,
   stroke:disabled?C.soft:primary?C.teal:C.border,r:6}));
  const a=t(label,0,0,small?11:13,disabled?C.dim:C.txt,'600');a.anchor.set(.5);a.position.set(w/2,h/2);g.addChild(a);
  if(!disabled){g.eventMode='static';g.hitArea=new (P().Rectangle)(0,0,w,h);g.cursor='pointer';
   g.on('pointerover',()=>{g.alpha=.8});g.on('pointerout',()=>{g.alpha=1});g.on('pointertap',()=>{if(!drag)try{fn()}catch(e){fail(e)}})}
  parent.addChild(g);return g;
 }
 function asset(path){if(!path)return Promise.resolve(null);if(!assets.has(path))assets.set(path,P().Assets.load(path).catch(()=>null));return assets.get(path)}
 function staticSprite(parent,path,x,y,w,h,r=rev){
  const sprite=new (P().Sprite)(P().Texture.EMPTY);sprite.position.set(x,y);parent.addChild(sprite);
  asset(path).then(tex=>{if(!tex||r!==rev||sprite.destroyed)return;sprite.texture=tex;sprite.width=w;sprite.height=h});
  return sprite
 }
 function portrait(parent,path,x,y,w,h,mode='head',r=rev){
  rect(parent,x,y,w,h,{fill:0x101a22,stroke:0x273943,r:3});
  const clip=group();clip.position.set(x,y);parent.addChild(clip);
  const mask=new (P().Graphics)().rect(0,0,w,h).fill(0xffffff);clip.addChild(mask);
  const sprite=new (P().Sprite)(P().Texture.EMPTY);sprite.mask=mask;clip.addChild(sprite);
  asset(path).then(tex=>{if(!tex||r!==rev||sprite.destroyed||!app)return;sprite.texture=tex;
   const tw=Math.max(1,tex.width),th=Math.max(1,tex.height);
   if(mode==='item'){const s=Math.min(w/tw*.9,h/th*.9);sprite.scale.set(s);sprite.position.set((w-tw*s)/2,(h-th*s)/2)}
   else if(mode==='full'){const s=Math.min(w/tw*.91,h/th*.98);sprite.scale.set(s);sprite.position.set((w-tw*s)/2,h-th*s)}
   else{const s=Math.max(w/tw*1.15,h/th*2.2);sprite.scale.set(s);sprite.position.set((w-tw*s)/2,-th*s*.07)}
  }).catch(()=>{});
  return clip;
 }
 function hr(parent,entry,x,y){write(parent,entry,x,y,12,C.muted);}
 function pct(n){return Math.max(0,Math.min(1,Number(n)||0))}
 function bar(parent,x,y,w,p,color=C.teal){rect(parent,x,y,w,6,{fill:C.soft,stroke:C.soft,r:2});if(p>0)parent.addChild(new (P().Graphics)().roundRect(x,y,Math.max(2,w*pct(p)),6,2).fill(color));}
 function cardUnitInfo(owned,s){return owned||s?.owned?.find(o=>o.uid===selectedUid)||null}
 function useSnap(){try{return bridge()?.snapshot()}catch(e){fail(e);return null}}
 function action(name,...args){try{bridge()?.[name]?.(...args)}catch(e){fail(e)}schedule()}
 function fail(e){lastError=String(e?.message||e);console.error('[M10-02] action/render failure',e);}
 function onUnitTap(uid){if(drag)return;if(selectedItem!==null){action('equip',uid,selectedItem);selectedItem=null;return}selectedUid=uid;schedule()}
 function startDrag(kind,id,event){if(event.button!==0)return;drag={kind,id,startX:event.global.x,startY:event.global.y,moved:false};if(event.stopPropagation)event.stopPropagation()}
 function draggable(surface,kind,id){surface.eventMode='static';surface.cursor='grab';surface.on('pointerdown',e=>startDrag(kind,id,e))}
 function pointerXY(e){const r=app?.canvas?.getBoundingClientRect();if(!r||!r.width||!r.height)return null;return {x:((e.clientX-r.left)*(app.renderer.width/r.width)-origin.x)/scale,
  y:((e.clientY-r.top)*(app.renderer.height/r.height)-origin.y)/scale}}
 const inside=(p,rect)=>p&&p.x>=rect.x&&p.x<rect.x+rect.w&&p.y>=rect.y&&p.y<rect.y+rect.h;
 function getBoardCell(p){const g=L.grid;if(!inside(p,g))return null;const col=Math.floor((p.x-g.x)/(g.w/3)),row=Math.floor((p.y-g.y)/(g.h/3));
  return col>=0&&col<3&&row>=0&&row<3?{x:col,y:row}:null}
 function getUnitAt(p,s){const cell=getBoardCell(p);if(cell)return s.formation.find(o=>o.x===cell.x&&o.y===cell.y)||null;
  const bench=s.bench;if(inside(p,L.bench)){const x=L.bench.x+14,start=L.bench.y+30,w=101,gap=6;
   for(let i=0;i<Math.min(8,bench.length);i++)if(p.x>=x+i*(w+gap)&&p.x<x+i*(w+gap)+w&&p.y>=start&&p.y<start+52)return bench[i]}
  return null}
 function getItemAt(p,s){const r=L.items;if(!inside(p,r))return null;const x=r.x+16,y=r.y+93,w=52,dx=61,dy=64;
  for(let i=0;i<s.items.length;i++){const cx=x+(i%4)*dx,cy=y+Math.floor(i/4)*dy;
   if(p.x>=cx&&p.x<cx+w&&p.y>=cy&&p.y<cy+53)return i}return null}
 function dragMove(e){if(!drag)return;const p=pointerXY(e);if(!p)return;
  if(!drag.moved){const start=drag.startX,sy=drag.startY;if(Math.hypot((p.x*scale+origin.x)-start,(p.y*scale+origin.y)-sy)<10)return;drag.moved=true;
   ghost=new (P().Container)();ghost.eventMode='none';ghost.alpha=.8;ghost.addChild(box(-49,-29,98,58,{fill:C.raised,stroke:C.selected,r:6}));
   write(ghost,drag.kind==='unit'?'실험체 이동':'아이템 이동',-42,-8,12,C.txt);root?.addChild(ghost)}
  if(ghost)ghost.position.set(p.x,p.y);
 }
 function dragFinish(e){if(!drag)return;const d=drag;drag=null;ghost?.destroy({children:true});ghost=null;
  if(!d.moved){if(d.kind==='unit')onUnitTap(d.id);else{selectedItem=d.id;schedule()}return}
  const p=pointerXY(e),s=useSnap();if(!p||!s)return;
  if(d.kind==='unit'){
   const cell=getBoardCell(p);if(cell){selectedUid=d.id;action('place',d.id,cell.x,cell.y)}
   else if(inside(p,L.bench))action('recall',d.id);
   else if(inside(p,L.sell))action('sellUnit',d.id);
  }else if(d.kind==='item'){
   const u=getUnitAt(p,s);const j=getItemAt(p,s);
   if(u){selectedUid=u.uid;selectedItem=null;action('equip',u.uid,d.id)}
   else if(j!==null&&j!==d.id){selectedItem=null;action('craft',d.id,j)}
   else if(inside(p,L.sell)){selectedItem=null;action('sellItem',d.id)}
  }schedule();
 }
 function header(parent,s){
  rect(parent,45,20,1510,100,{fill:C.panel,stroke:C.border,r:9});
  staticSprite(parent,'assets/m10/ui/prep-emblem.svg',62,39,35,35);
  write(parent,'L.I.V.E.',106,33,27,C.txt,'800');write(parent,'RESEARCH / PREPARATION',220,43,13,C.teal,'700');
  separator(parent,64,74,1536,74,C.border,.7);
  write(parent,`R${s.round} · 준비 단계`,65,85,14,C.txt,'700');
  const next=s.schedule?.slice(0,3).join('  ·  ')||'';
  write(parent,next,250,85,12,C.muted);
  write(parent,`HP ${s.hpA}`,735,38,15,C.txt,'700');bar(parent,735,63,175,s.hpA/100,C.green);
  write(parent,`상대 ${s.hpB}`,930,38,15,C.txt,'700');bar(parent,930,63,163,s.hpB/100,C.red);
  timeText=write(parent,`준비 ${Math.max(0,Math.ceil(s.remaining))}초`,1108,85,14,C.txt,'700');
  button(parent,s.readyLabel||'준비 완료',1303,39,131,42,()=>action('ready'),{primary:true,disabled:!s.readyAvailable});
  button(parent,'기존 UI',1444,39,92,42,()=>requestAnimationFrame(()=>setEnabled(false)),{small:true});
  button(parent,'채팅',1444,85,92,26,()=>document.body.classList.toggle('m1002-chat-open'),{small:true});
 }
 function drawBoard(parent,s){const a=L.board;rect(parent,a.x,a.y,a.w,a.h,{fill:C.inner,stroke:C.border,r:8});
  staticSprite(parent,'assets/m10/ui/prep-floor.webp',a.x+3,a.y+51,a.w-6,a.h-55);
  write(parent,'실험군 편성 / 3 × 3',a.x+21,a.y+18,15,C.txt,'700');
  write(parent,`${s.formation.length}/${s.maxUnits} 출전`,a.x+a.w-109,a.y+19,12,C.muted);
  separator(parent,a.x+18,a.y+49,a.x+a.w-18,a.y+49,C.border,.75);
  const g=L.grid,cw=g.w/3,ch=g.h/3;
  for(let col=0;col<3;col++)for(let row=0;row<3;row++){
   const x=g.x+col*cw,y=g.y+row*ch,entry=s.formation.find(o=>o.x===col&&o.y===row);
   rect(parent,x+3,y+3,cw-6,ch-6,{fill:entry?0x213039:0x19242d,stroke:entry?.uid===selectedUid?C.gold:C.border,r:5});
   write(parent,`0${row+1} - 0${col+1}`,x+14,y+9,10,C.dim);
   const hot=group();hot.position.set(x+4,y+4);hot.addChild(new (P().Graphics)().rect(0,0,cw-8,ch-8).fill({color:0xffffff,alpha:.001}));
   hot.eventMode='static';hot.hitArea=new (P().Rectangle)(0,0,cw-8,ch-8);hot.cursor='pointer';
   hot.on('pointertap',()=>{if(!drag&&selectedUid!==null&&(!entry||entry.uid!==selectedUid))action('place',selectedUid,col,row)});
   if(entry){portrait(parent,entry.portrait,x+41,y+13,cw-82,ch-29,'full');
    write(parent,entry.name.slice(0,12),x+12,y+ch-24,12,C.txt,'600');write(parent,'★'.repeat(entry.star),x+cw-47,y+11,11,C.gold);
    const hit=group();hit.position.set(x+5,y+5);hit.addChild(new (P().Graphics)().rect(0,0,cw-10,ch-10).fill({color:0xffffff,alpha:.001}));
    draggable(hit,'unit',entry.uid);parent.addChild(hit);
   }else parent.addChild(hot);
  }
  write(parent,'실험체를 벤치에서 끌어와 배치 · 드래그로 위치 변경',a.x+22,a.y+a.h-27,12,C.muted);
 }
 function drawSynergy(parent,s){const a=L.synergy;rect(parent,a.x,a.y,a.w,a.h);
  write(parent,'특성 / 시너지',a.x+17,a.y+15,16,C.txt,'700');
  const pages=Math.max(1,Math.ceil(s.synergies.length/5));synergyPage=Math.min(synergyPage,pages-1);
  if(pages>1){button(parent,'◀',a.x+a.w-90,a.y+9,30,28,()=>{synergyPage=(synergyPage+pages-1)%pages;schedule()},{small:true});
   write(parent,`${synergyPage+1}/${pages}`,a.x+a.w-55,a.y+15,11,C.muted);
   button(parent,'▶',a.x+a.w-33,a.y+9,27,28,()=>{synergyPage=(synergyPage+1)%pages;schedule()},{small:true});}
  separator(parent,a.x+16,a.y+46,a.x+a.w-16,a.y+46);
  if(!s.synergies.length)write(parent,'배치된 실험체의 특성이 여기에 표시돼.',a.x+18,a.y+80,12,C.muted,'500',a.w-38);
  s.synergies.slice(synergyPage*5,synergyPage*5+5).forEach((v,i)=>{const y=a.y+59+i*29;
   const row=rect(parent,a.x+14,y,a.w-28,25,{fill:i%2?C.panel:C.inner,stroke:selectedSynergy===v.name?C.teal:C.soft,r:4});
   write(parent,(v.label||v.name+' '+v.count).slice(0,23),a.x+24,y+4,12,v.active===false?C.dim:C.txt);
   const detail=v.description||'';
   if(detail){row.eventMode='static';row.hitArea=new (P().Rectangle)(a.x+14,y,a.w-28,25);row.cursor='pointer';
    row.on('pointertap',()=>{selectedSynergy=selectedSynergy===v.name?null:v.name;schedule()})}
  });
  if(selectedSynergy){const v=s.synergies.find(x=>x.name===selectedSynergy);
   if(v)write(parent,`${v.name}: ${v.description||'정보 없음'}`.slice(0,37),a.x+18,a.y+210,10,C.muted);}
  button(parent,`관심 시너지 ${s.focus.length}/3  ${focusOpened?'닫기':'관리'}`,a.x+15,a.y+a.h-44,a.w-30,29,()=>{focusOpened=!focusOpened;schedule()},{small:true});
 }
 function drawEconomy(parent,s){const a=L.economy;rect(parent,a.x,a.y,a.w,a.h);
  write(parent,'연구 자원 / 편성 관리',a.x+17,a.y+16,16,C.txt,'700');separator(parent,a.x+16,a.y+48,a.x+a.w-16,a.y+48);
  write(parent,'보유 크레딧',a.x+18,a.y+67,12,C.muted);write(parent,`${s.credits} C`,a.x+18,a.y+89,30,C.gold,'700');
  rect(parent,a.x+15,a.y+141,a.w-30,78,{fill:C.inner,stroke:C.soft,r:6});
  write(parent,`다음 정산 이자 +${s.interest} C`,a.x+26,a.y+152,14,C.green,'700');
  write(parent,'10C마다 +1C / 최대 +3C',a.x+26,a.y+179,11,C.muted);
  bar(parent,a.x+26,a.y+198,a.w-56,s.interest/3,C.green);
  button(parent,'↻ 리롤  ·  2 C',a.x+15,a.y+236,a.w-30,42,()=>action('reroll'),{primary:true});
  button(parent,s.shopLocked?'■ 상점 고정 중':'□ 상점 고정',a.x+15,a.y+289,a.w-30,41,()=>action('lock'),{active:s.shopLocked});
  write(parent,`숙련도 Lv.${s.level}`,a.x+18,a.y+349,14,C.txt,'700');write(parent,`${s.exp}/${s.expMax} EXP`,a.x+a.w-101,a.y+351,12,C.muted);
  bar(parent,a.x+18,a.y+379,a.w-36,s.expMax?s.exp/s.expMax:1,C.blue);
  button(parent,'숙련도 +2 EXP  ·  2 C',a.x+15,a.y+397,a.w-30,37,()=>action('invest'),{disabled:s.level>=20,small:true});
  // A graphics-object sell target: drop any unit or item here.
  rect(parent,L.sell.x,L.sell.y,L.sell.w,L.sell.h,{fill:0x34282b,stroke:C.red,r:5});
  write(parent,'판매 구역',L.sell.x+16,L.sell.y+12,12,C.txt,'700');
 }
 function drawBench(parent,s){const a=L.bench;rect(parent,a.x,a.y,a.w,a.h);write(parent,`벤치 / ${s.bench.length}명`,a.x+15,a.y+9,13,C.txt,'700');
  write(parent,'클릭 선택 · 드래그로 배치',a.x+160,a.y+11,11,C.muted);
  for(let i=0;i<8;i++){const x=a.x+14+i*107,y=a.y+30,owned=s.bench[i];
   rect(parent,x,y,101,53,{fill:C.inner,stroke:owned?.uid===selectedUid?C.gold:C.border,r:4});
   if(!owned){write(parent,'+',x+45,y+14,18,C.dim);continue}
   portrait(parent,owned.portrait,x+4,y+4,42,44,'head');
   write(parent,owned.name.slice(0,7),x+49,y+8,10,C.txt,'600');
   write(parent,'★'.repeat(owned.star),x+49,y+29,10,C.gold);
   const hit=group();hit.position.set(x,y);hit.addChild(new (P().Graphics)().rect(0,0,101,53).fill({color:0xffffff,alpha:.001}));
   draggable(hit,'unit',owned.uid);parent.addChild(hit);
  }
 }
 function drawShop(parent,s){const a=L.shop;rect(parent,a.x,a.y,a.w,a.h,{fill:C.panel,stroke:C.border,r:7});
  write(parent,'실험체 확보 / 상점',a.x+15,a.y+12,14,C.txt,'700');
  write(parent,s.shopLocked?'진열 고정':'확보 단계',a.x+a.w-92,a.y+13,12,C.muted);
  const w=(a.w-28-4*10)/5;
  for(let i=0;i<5;i++){const x=a.x+14+i*(w+10),y=a.y+39,o=s.offers[i];
   rect(parent,x,y,w,117,{fill:C.inner,stroke:o?.focused?C.gold:C.border,r:5});
   if(!o||o.empty){write(parent,'확보 완료',x+31,y+46,14,C.dim);continue}
   portrait(parent,o.portrait,x+3,y+3,w-6,68,'head');
   if(o.owned)write(parent,`보유 ${o.owned}`,x+7,y+5,10,C.gold,'700');
   write(parent,o.name.slice(0,12),x+9,y+74,12,C.txt,'700');write(parent,`${o.cost} C`,x+w-45,y+75,12,C.gold,'700');
   write(parent,`${o.role||''} · ${(o.affiliations||[]).slice(0,2).join('/')}`.slice(0,22),x+9,y+98,10,C.muted);
   const hit=group();hit.position.set(x,y);hit.addChild(new (P().Graphics)().rect(0,0,w,117).fill({color:0xffffff,alpha:.001}));
   hit.eventMode='static';hit.hitArea=new (P().Rectangle)(0,0,w,117);hit.cursor='pointer';
   hit.on('pointerover',()=>{hit.alpha=.75});hit.on('pointerout',()=>{hit.alpha=1});
   hit.on('pointertap',()=>{if(!drag)action('buy',o.index)});parent.addChild(hit);
  }
 }
 function drawInspect(parent,s){const a=L.inspect;rect(parent,a.x,a.y,a.w,a.h);write(parent,'선택 실험체',a.x+15,a.y+15,15,C.txt,'700');
  separator(parent,a.x+16,a.y+45,a.x+a.w-16,a.y+45);
  const o=s.owned.find(u=>u.uid===selectedUid);
  if(!o){write(parent,'실험체를 클릭해 선택',a.x+19,a.y+82,13,C.muted);write(parent,'장착할 아이템을 선택한 뒤',a.x+19,a.y+113,11,C.dim);
   write(parent,'실험체를 클릭해도 돼.',a.x+19,a.y+132,11,C.dim);return}
  portrait(parent,o.portrait,a.x+17,a.y+60,101,127,'head');
  write(parent,o.name.slice(0,12),a.x+128,a.y+66,17,C.txt,'700');
  write(parent,'★'.repeat(o.star),a.x+129,a.y+98,14,C.gold);
  write(parent,o.role.slice(0,14),a.x+128,a.y+122,11,C.muted);
  write(parent,o.affiliations.slice(0,2).join(' / ').slice(0,20),a.x+128,a.y+147,11,C.muted);
  separator(parent,a.x+16,a.y+199,a.x+a.w-16,a.y+199);
  const rows=[['체력',o.hp],['공격력',o.atk],['방어력',o.def],['공격 속도',o.as]];
  rows.forEach((r,i)=>{write(parent,r[0],a.x+18,a.y+214+i*26,12,C.muted);write(parent,String(r[1]??'-'),a.x+157,a.y+214+i*26,12,C.txt,'700')});
  write(parent,`장비: ${(o.equipment||[]).length?(o.equipment||[]).join(' · '):'없음'}`.slice(0,35),a.x+18,a.y+299,11,C.muted);
  if(o.location==='board')button(parent,'벤치로 복귀',a.x+17,a.y+320,a.w-34,36,()=>action('recall',o.uid),{small:true});
  else button(parent,'자동 배치',a.x+17,a.y+320,a.w-34,36,()=>action('deploy',o.uid),{primary:true,small:true});
 }
 function drawItems(parent,s){const a=L.items;rect(parent,a.x,a.y,a.w,a.h);
  write(parent,`장비 / 아이템 ${s.items.length}/12`,a.x+16,a.y+17,15,C.txt,'700');
  separator(parent,a.x+16,a.y+47,a.x+a.w-16,a.y+47);
  write(parent,selectedItem===null?'아이템을 선택해 장착·조합·판매':'아이템 선택됨 · 실험체 클릭 시 장착',a.x+16,a.y+62,11,C.muted);
  s.items.slice(0,12).forEach((v,i)=>{const x=a.x+16+(i%4)*61,y=a.y+93+Math.floor(i/4)*64;
   rect(parent,x,y,52,53,{fill:C.inner,stroke:selectedItem===i?C.gold:C.border,r:4});
   if(v.icon)portrait(parent,v.icon,x+5,y+4,42,42,'item');
   const hit=group();hit.position.set(x,y);hit.addChild(new (P().Graphics)().rect(0,0,52,53).fill({color:0xffffff,alpha:.001}));
   draggable(hit,'item',i);parent.addChild(hit);
  });
  separator(parent,a.x+16,a.y+298,a.x+a.w-16,a.y+298);
  const selected=s.items[selectedItem];
  write(parent,selected?selected.name.slice(0,21):'아이템을 드래그해 조합 가능',a.x+17,a.y+311,11,C.muted);
  if(selected)button(parent,'선택 아이템 판매',a.x+136,a.y+305,121,30,()=>{action('sellItem',selectedItem);selectedItem=null},{small:true});
 }
 function drawFocus(parent,s){if(!focusOpened)return;
  const x=365,y=150,w=875,h=540;const shade=rect(parent,x,y,w,h,{fill:C.bg,stroke:C.teal,r:8,a:.99});shade.eventMode='static';shade.hitArea=new (P().Rectangle)(x,y,w,h);
  write(parent,'관심 시너지 / 최대 3개 지정',x+20,y+17,18,C.txt,'700');
  button(parent,'닫기',x+w-90,y+12,70,34,()=>{focusOpened=false;schedule()},{small:true});
  write(parent,'관심 시너지는 상점 표시에만 적용돼. 등장 확률에는 영향을 주지 않아.',x+20,y+56,12,C.muted);
  const arr=s.focusOptions||[];
  arr.slice(0,56).forEach((name,i)=>{const cx=x+20+(i%6)*141,cy=y+92+Math.floor(i/6)*43;if(cy>y+h-40)return;
   button(parent,name.slice(0,10),cx,cy,130,33,()=>{action('focus',name)},{small:true,active:s.focus.includes(name)});
  });
 }
 function render(){if(!app||!mount)return;const s=useSnap();if(!s||s.phase!=='prep')return;currentSnap=s;
  if(selectedUid===null&&s.formation[0])selectedUid=s.formation[0].uid;
  if(selectedUid!==null&&!s.owned.some(o=>o.uid===selectedUid))selectedUid=s.formation[0]?.uid??null;
  if(selectedItem!==null&&!s.items[selectedItem])selectedItem=null;
  rev++;for(const obj of app.stage.removeChildren())obj.destroy({children:true});
  const {width:w,height:h}=app.renderer;scale=Math.min(w/BW,h/BH);origin={x:(w-BW*scale)/2,y:(h-BH*scale)/2};
  root=group();root.scale.set(scale);root.position.set(origin.x,origin.y);app.stage.addChild(root);
  root.addChild(new (P().Graphics)().rect(0,0,BW,BH).fill(C.bg));
  // Restrained scientific grid, mostly opaque panels; no bright neon bloom.
  for(let i=0;i<16;i++)separator(root,0,i*60,BW,i*60,C.soft,.16);
  for(let i=0;i<28;i++)separator(root,i*60,0,i*60,BH,C.soft,.10);
  header(root,s);drawBoard(root,s);drawSynergy(root,s);drawEconomy(root,s);drawBench(root,s);drawShop(root,s);drawInspect(root,s);drawItems(root,s);drawFocus(root,s);
  if(lastError){rect(root,395,110,805,29,{fill:0x342427,stroke:C.red,r:4});write(root,lastError.slice(0,110),405,116,12,C.txt)}
  else if(s.message){write(root,s.message.slice(0,105),430,112,11,C.muted)}
 }
 function schedule(){if(!app||drawQueued)return;drawQueued=true;requestAnimationFrame(()=>{drawQueued=false;
  if(app&&mount?.isConnected&&!drag)try{render()}catch(e){fail(e);console.error('[M10-02] render failure',e);fallback()}
 })}
 function active(){const s=useSnap();return document.body.dataset.appMode==='game'&&s?.phase==='prep'&&!!document.querySelector('#gameBottomDock')}
 function toggleButton(){if(!toggle){toggle=document.createElement('button');toggle.type='button';toggle.id='m1002Toggle';toggle.textContent='M10 준비화면';
  toggle.addEventListener('click',()=>setEnabled(!enabled));document.body.appendChild(toggle)}
  toggle.hidden=document.body.dataset.appMode!=='game';toggle.textContent=enabled?'M10 준비화면 ●':'M10 준비화면 ○';toggle.setAttribute('aria-pressed',String(enabled));
 }
 function setEnabled(next){enabled=!!next;try{localStorage.setItem(KEY,enabled?'1':'0')}catch{}sync()}
 function stop(){if(paintTimer)clearInterval(paintTimer);paintTimer=null;drag=null;ghost=null;lastSignature='';rev++;
  resizeObserver?.disconnect();resizeObserver=null;
  if(app){try{app.destroy(true,{children:true})}catch(e){console.warn(e)}app=null}
  mount?.remove();mount=null;root=null;timeText=null;document.body.classList.remove('m1002-prep-active','m1002-chat-open');
 }
 function fallback(){enabled=false;stop();toggleButton();}
 async function create(){if(pending||app||!active())return;
  if(!P()?.Application){console.warn('[M10-02] PixiJS unavailable; M9-10 UI remains active');enabled=false;toggleButton();return}
  pending=true;
  const target=document.createElement('section');target.id='m1002PrepMount';target.setAttribute('aria-label','L.I.V.E. 준비·편성 연구 콘솔');
  const canvasHost=document.createElement('div');canvasHost.className='m1002-viewport';target.appendChild(canvasHost);document.body.appendChild(target);mount=target;
  let instance=null;try{instance=new (P().Application)();await instance.init({width:Math.max(780,innerWidth),height:Math.max(500,innerHeight),
   resolution:Math.min(2,devicePixelRatio||1),autoDensity:true,antialias:true,backgroundColor:C.bg,preference:'webgl'});
   if(!target.isConnected||!enabled||!active()){instance.destroy(true,{children:true});target.remove();if(mount===target)mount=null;return}
   app=instance;app.canvas.className='m1002-canvas';app.canvas.setAttribute('aria-label','상점, 벤치, 3×3 배치판을 포함하는 연구 준비 화면');
   canvasHost.appendChild(app.canvas);const resize=()=>{if(!app)return;const r=canvasHost.getBoundingClientRect();app.renderer.resize(Math.max(780,Math.round(r.width)),Math.max(500,Math.round(r.height)));schedule()};
   resizeObserver=new ResizeObserver(resize);resizeObserver.observe(canvasHost);resize();
   window.LIVEM10UI?.disable?.();document.body.classList.add('m1002-prep-active');
   window.addEventListener('pointermove',dragMove);window.addEventListener('pointerup',dragFinish);window.addEventListener('pointercancel',dragFinish);
   paintTimer=setInterval(()=>{if(!app)return;const s=useSnap();if(s?.phase!=='prep'){sync();return}
    if(timeText)timeText.text=`준비 ${Math.max(0,Math.ceil(s.remaining))}초`;
    const signature=JSON.stringify({...s,remaining:0});if(signature!==lastSignature){lastSignature=signature;schedule()}
   },350);schedule();
  }catch(e){console.error('[M10-02] renderer unavailable: original layout restored',e);fallback();
   if(instance&&instance!==app)try{instance.destroy(true,{children:true})}catch{}
  }finally{pending=false}
 }
 function sync(){toggleButton();if(!enabled||!active()){if(app||mount)stop();return}if(!app&&!pending)create();else if(app)schedule()}
 const oldStop=stop;stop=function(){window.removeEventListener('pointermove',dragMove);window.removeEventListener('pointerup',dragFinish);window.removeEventListener('pointercancel',dragFinish);oldStop()};
 window.LIVEM10PrepUI=Object.freeze({enable:()=>setEnabled(true),disable:()=>setEnabled(false),get active(){return !!app},refresh:sync});
 window.addEventListener('live:m10:economy',sync);document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync()});
 document.addEventListener('DOMContentLoaded',sync,{once:true});if(document.readyState!=='loading')sync();
})();
