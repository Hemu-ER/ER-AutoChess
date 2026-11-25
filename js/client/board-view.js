/* M11-02 — fixed frontal perspective. Logical x/y and team orientation are unchanged.
 * One projection supplies ground polygons, actor feet/scale, pointer targets and VFX.
 */
(function(root){'use strict';
 const COLS=6,ROWS=3,TEAM_COLS=3;
 const valid=(x,y)=>Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&x<COLS&&y>=0&&y<ROWS;
 function localToGlobal(team,x,y){if(!['A','B'].includes(team)||!valid(x,y)||x>=TEAM_COLS)return null;return {x:team==='A'?x:COLS-1-x,y};}
 function globalToLocal(team,x,y){if(!['A','B'].includes(team)||!valid(x,y)||(team==='A'?x>=TEAM_COLS:x<TEAM_COLS))return null;return {x:team==='A'?x:COLS-1-x,y};}
 // V4 projection, with a shared fit that reserves room for upright sprites and HUD.
 function projection(width,height,prep,offsetY=0){
  const n=prep?3:6,spacing=prep?164:101,depth=prep?118:105;
  function raw(x,y){const d=y-1.5,k=1/(1-d*.205);return {x:(x-n/2)*spacing*k,y:d*depth*k,k};}
  const a=raw(0,0),b=raw(n,3),back=raw(.5,.5);
  const left=-b.x-24,right=b.x+24,top=Math.min(a.y-20,back.y-161*back.k-40),bottom=b.y+24*b.k+35;
  const fit=Math.max(0,Math.min(width/(right-left),height/(bottom-top)));
  const ox=width/2,oy=offsetY+(height-(bottom-top)*fit)/2-top*fit;
  function point(x,y){const p=raw(x,y);return {x:ox+p.x*fit,y:oy+p.y*fit,k:p.k,scale:p.k*fit};}
  function polygon(x,y){return [point(x,y),point(x+1,y),point(x+1,y+1),point(x,y+1)];}
  function locate(px,py){if(!fit)return null;const yy=(py-oy)/fit,den=depth+.205*yy;if(den<=0)return null;const d=yy/den,y=d+1.5,k=1/(1-d*.205),x=(px-ox)/(spacing*k*fit)+n/2;const eps=1e-7;if(x< -eps||x>n+eps||y< -eps||y>ROWS+eps)return null;return {x:Math.min(n-1,Math.max(0,Math.floor(x+eps))),y:Math.min(ROWS-1,Math.max(0,Math.floor(y+eps)))};}
  return {n,fit,point,polygon,locate,outline:[point(0,0),point(n,0),point(n,3),point(0,3)]};
 }
 function create(board){
  if(!board)throw Error('Board required');const doc=board.ownerDocument;
  const cells=()=>board.querySelectorAll('.cell'),units=()=>board.querySelectorAll('.unit[data-id]');
  const cellAt=(x,y)=>valid(x,y)?board.querySelector(`.cell[data-x="${x}"][data-y="${y}"]`):null;
  let prep=false,layout=null,layoutKey='',ground=null;
  function coord(cell){if(!cell||!board.contains(cell)||!cell.matches('.cell'))return null;const x=Number(cell.dataset.x),y=Number(cell.dataset.y);return valid(x,y)?{x,y}:null;}
  function cellFromHit(hit){const cell=hit?.closest?.('.cell');return coord(cell)?cell:null;}
  function unitAt(id){for(const unit of units())if(unit.dataset.id===String(id))return unit;return null;}
  function hitAt(x,y){return doc.elementFromPoint(x,y);}
  function rect(el){return el?.getBoundingClientRect()||null;}
  const px=n=>`${n.toFixed(3)}px`;
  const points=ps=>ps.map(p=>`${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
  function layoutBoard(force=false){
   const w=board.clientWidth,h=board.clientHeight;if(!ground||!w||!h)return;
   let top=0,bottom=h;
   if(doc.body.dataset.appMode==='game'){
    const b=rect(board),read=selector=>{const el=doc.querySelector(selector),r=rect(el);return el&&!el.hidden&&r?.width&&r.height&&doc.defaultView.getComputedStyle(el).visibility!=='hidden'?r:null;};
    for(const sel of ['#roundModePanel','#roundModePanel .round-actions']){const r=read(sel);if(r)top=Math.max(top,r.bottom-b.top+8);}
    for(const sel of ['#gameBottomDock','#gameBottomDock .dock-toggle','#liveBattleDeck',...(w<700?['#currentSynergyPanel']:[])]){const r=read(sel);if(r&&r.top>b.top)bottom=Math.min(bottom,r.top-b.top-8);}
   }
   top=Math.max(0,Math.min(h-1,Math.round(top)));bottom=Math.max(top+1,Math.min(h,Math.round(bottom)));
   const key=`${w}:${h}:${prep}:${top}:${bottom}`;if(!force&&key===layoutKey)return;layoutKey=key;layout=projection(w,bottom-top,prep,top);
   const outline=layout.outline,down=p=>({x:p.x,y:p.y+24*p.scale});
   ground.setAttribute('viewBox',`0 0 ${w} ${h}`);
   ground.querySelector('.live-floor-top').setAttribute('points',points(outline));
   ground.querySelector('.live-floor-front').setAttribute('points',points([outline[3],outline[2],down(outline[2]),down(outline[3])]));
   ground.querySelector('.live-floor-left').setAttribute('points',points([outline[0],outline[3],down(outline[3]),down(outline[0])]));
   ground.querySelector('.live-floor-right').setAttribute('points',points([outline[1],outline[2],down(outline[2]),down(outline[1])]));
   const line=(a,b)=>`M${a.x},${a.y}L${b.x},${b.y}`;
   const lines=[];for(let x=1;x<layout.n;x++)lines.push(line(layout.point(x,0),layout.point(x,3)));for(let y=1;y<ROWS;y++)lines.push(line(layout.point(0,y),layout.point(layout.n,y)));
   ground.querySelector('.live-floor-grid').setAttribute('d',lines.join(' '));ground.querySelector('.live-floor-divider').setAttribute('d',prep?'':line(layout.point(3,0),layout.point(3,3)));
   for(const c of cells()){
    const {x,y}=coord(c);c.hidden=x>=layout.n;if(c.hidden)continue;
    const ps=layout.polygon(x,y),l=Math.min(...ps.map(p=>p.x)),r=Math.max(...ps.map(p=>p.x)),t=ps[0].y,b=ps[2].y,p=layout.point(x+.5,y+.5);
    const style=c.style,poly=`polygon(${ps.map(q=>`${px(q.x-l)} ${px(q.y-t)}`).join(',')})`;
    Object.assign(style,{left:px(l),top:px(t),width:px(r-l),height:px(b-t),zIndex:String(10+y*10+x)});
    style.setProperty('--tile-poly',poly);style.setProperty('--foot-x',px(p.x-l));style.setProperty('--foot-y',px(p.y-t));style.setProperty('--actor-h',px(161*p.scale));style.setProperty('--actor-w',px(139*p.scale));style.setProperty('--ring-w',px(64*p.scale));style.setProperty('--ring-h',px(20*p.scale));style.setProperty('--hud-w',px(Math.max(40,Math.min(84,70*layout.fit))));
    c._liveProjection={foot:p,polygon:ps};
   }
  }
  function cellFromPoint(x,y,hit=hitAt(x,y)){
   // Overlay controls must win. When the pointer is on the board, use ground inverse
   // rather than a sprite's tall rectangle; a sprite outside the floor remains a target.
   if(!hit||!board.contains(hit))return null;const b=rect(board);const p=layout?.locate(x-b.left,y-b.top);return p?cellAt(p.x,p.y):cellFromHit(hit);
  }
  function visibleCellRect(cell){const r=rect(cell);return !cell?.hidden&&r?.width&&r.height&&doc.defaultView.getComputedStyle(cell).display!=='none'?r:null;}
  function center(x,y){const c=cellAt(x,y),r=visibleCellRect(c),b=rect(board),p=c?._liveProjection?.foot;return r&&p?{x:b.left+p.x,y:b.top+p.y}:null;}
  function eventAnchor(event,shell,atHead=true){const unit=unitAt(event.unitId),r=rect(unit),p=center(event.x,event.y),bounds=rect(shell);if(!bounds||(!r?.width&&!p))return null;const bar=rect(unit?.querySelector('.unit-hud .hpbar'));const x=r?.width?r.left+r.width*.5:p.x,y=r?.width?(atHead?(bar?.top??r.top):r.top+r.height*.48):p.y;return {x:Math.max(16,Math.min(bounds.width-16,x-bounds.left)),y:Math.max(24,Math.min(bounds.height-12,y-bounds.top))};}
  function build(onDrop){board.innerHTML='';board.classList.add('live-perspective');ground=doc.createElementNS('http://www.w3.org/2000/svg','svg');ground.classList.add('live-floor');ground.setAttribute('aria-hidden','true');for(const name of ['left','right','front','top']){const p=doc.createElementNS('http://www.w3.org/2000/svg','polygon');p.setAttribute('class',`live-floor-${name}`);ground.appendChild(p);}for(const name of ['grid','divider']){const p=doc.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('class',`live-floor-${name}`);ground.appendChild(p);}board.appendChild(ground);
   for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){const c=doc.createElement('div');c.className='cell '+(x<TEAM_COLS?'teamA':'teamB')+(x===TEAM_COLS?' divider':'');c.dataset.x=x;c.dataset.y=y;c.innerHTML=`<div class="live-tile" aria-label="${x<TEAM_COLS?'A':'B'} ${['왼','중앙','오른'][y]} · ${['후열','중열','전열','전열','중열','후열'][x]}"></div><span class="coord">${x<TEAM_COLS?'A':'B'} ${['왼','중앙','오른'][y]} · ${['후열','중열','전열','전열','중열','후열'][x]}</span>`;c.ondragover=e=>e.preventDefault();c.ondrop=e=>onDrop(e,coord(cellFromPoint(e.clientX,e.clientY,e.target))||{x,y});board.appendChild(c);}
   layoutBoard(true);
  }
  function setFormation(value){prep=!!value;board.classList.toggle('formation-board',prep);board.classList.toggle('combat-board',!prep);layoutBoard(true);}
  if(doc.defaultView?.ResizeObserver)new doc.defaultView.ResizeObserver(()=>layoutBoard()).observe(board);
  return Object.freeze({cells,units,cellAt,coord,cellFromHit,cellFromPoint,unitAt,hitAt,rect,visibleCellRect,center,eventAnchor,build,setFormation,layoutBoard});
 }
 const api=Object.freeze({COLS,ROWS,TEAM_COLS,valid,localToGlobal,globalToLocal,projection,create});if(typeof module==='object'&&module.exports)module.exports=api;else root.LIVEBoardView=api;
})(globalThis);
