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
  const n=prep?3:6,spacing=prep?164:101,depth=prep?115:108,perspective=2/27;
  function raw(x,y){const d=y-1.5,k=1/(1-d*perspective);return {x:(x-n/2)*spacing*k,y:d*depth*k,k};}
  const a=raw(0,0),b=raw(n,3),back=raw(.5,.5);
  const left=-b.x-24,right=b.x+24,top=Math.min(a.y-20,back.y-218*back.k-40,raw(.5,1.5).y-248*raw(.5,1.5).k,raw(.5,2.5).y-248*raw(.5,2.5).k),bottom=b.y+12*b.k+35;
  const fit=Math.max(0,Math.min(width/(right-left),height/(bottom-top)));
  const ox=width/2,oy=offsetY+(height-(bottom-top)*fit)/2-top*fit;
  function point(x,y){const p=raw(x,y);return {x:ox+p.x*fit,y:oy+p.y*fit,k:p.k,scale:p.k*fit};}
  function polygon(x,y){return [point(x,y),point(x+1,y),point(x+1,y+1),point(x,y+1)];}
  function locate(px,py){if(!fit)return null;const yy=(py-oy)/fit,den=depth+perspective*yy;if(den<=0)return null;const d=yy/den,y=d+1.5,k=1/(1-d*perspective),x=(px-ox)/(spacing*k*fit)+n/2;const eps=1e-7;if(x< -eps||x>n+eps||y< -eps||y>ROWS+eps)return null;return {x:Math.min(n-1,Math.max(0,Math.floor(x+eps))),y:Math.min(ROWS-1,Math.max(0,Math.floor(y+eps)))};}
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
   // Reserve a viewport-derived stage, never measure an open menu or moving HUD.
   const game=doc.body.dataset.appMode==='game';
   const top=game?Math.round(h*.035):0,bottom=game?Math.round(h*.965):h;
   const key=`${w}:${h}:${prep}:${top}:${bottom}`;if(!force&&key===layoutKey)return;layoutKey=key;layout=projection(w,bottom-top,prep,top);
   const outline=layout.outline,down=p=>({x:p.x,y:p.y+12*p.scale});
   ground.setAttribute('viewBox',`0 0 ${w} ${h}`);
   ground.querySelector('.live-floor-top').setAttribute('points',points(outline));
   ground.querySelector('.live-floor-shade').setAttribute('points',points(outline));
   const marks=[];for(const [x,y,dx,dy] of [[0,0,1,1],[layout.n,0,-1,1],[layout.n,3,-1,-1],[0,3,1,-1]]){const a=layout.point(x+dx*.08,y+dy*.08),b=layout.point(x+dx*.42,y+dy*.08),c=layout.point(x+dx*.08,y+dy*.42);marks.push(`M${b.x},${b.y}L${a.x},${a.y}L${c.x},${c.y}`);}ground.querySelector('.live-floor-marks').setAttribute('d',marks.join(' '));
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
    style.setProperty('--tile-poly',poly);style.setProperty('--foot-x',px(p.x-l));style.setProperty('--foot-y',px(p.y-t));style.setProperty('--actor-h',px(218*p.scale));style.setProperty('--actor-w',px(186*p.scale));style.setProperty('--ring-w',px(64*p.scale));style.setProperty('--ring-h',px(20*p.scale));style.setProperty('--hud-w',px(Math.max(60,Math.min(150,92*layout.fit))));
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
  function build(onDrop){board.innerHTML='';board.classList.add('live-perspective');ground=doc.createElementNS('http://www.w3.org/2000/svg','svg');ground.classList.add('live-floor');ground.setAttribute('aria-hidden','true');const defs=doc.createElementNS('http://www.w3.org/2000/svg','defs');defs.innerHTML='<linearGradient id="liveFloorTexture" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#152a36" stop-opacity=".94"/><stop offset=".6" stop-color="#203b47" stop-opacity=".92"/><stop offset="1" stop-color="#284753" stop-opacity=".92"/></linearGradient><linearGradient id="liveFloorShade" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#9ed4e7" stop-opacity=".05"/><stop offset=".5" stop-color="#0c293c" stop-opacity=".05"/><stop offset="1" stop-color="#85e6ec" stop-opacity=".08"/></linearGradient><linearGradient id="liveFloorSide" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#79c8da" stop-opacity=".65"/><stop offset=".15" stop-color="#173749"/><stop offset="1" stop-color="#091923" stop-opacity=".88"/></linearGradient>';ground.appendChild(defs);for(const name of ['left','right','front','top','shade']){const p=doc.createElementNS('http://www.w3.org/2000/svg','polygon');p.setAttribute('class',`live-floor-${name}`);ground.appendChild(p);}for(const name of ['grid','divider','marks']){const p=doc.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('class',`live-floor-${name}`);ground.appendChild(p);}board.appendChild(ground);
   for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){const c=doc.createElement('div');c.className='cell '+(x<TEAM_COLS?'teamA':'teamB')+(x===TEAM_COLS?' divider':'');c.dataset.x=x;c.dataset.y=y;c.innerHTML=`<div class="live-tile" aria-label="${x<TEAM_COLS?'A':'B'} ${['왼','중앙','오른'][y]} · ${['후열','중열','전열','전열','중열','후열'][x]}"></div><span class="coord">${x<TEAM_COLS?'A':'B'} ${['왼','중앙','오른'][y]} · ${['후열','중열','전열','전열','중열','후열'][x]}</span>`;c.ondragover=e=>e.preventDefault();c.ondrop=e=>onDrop(e,coord(cellFromPoint(e.clientX,e.clientY,e.target))||{x,y});board.appendChild(c);}
   layoutBoard(true);
  }
  function setFormation(value){prep=!!value;board.classList.toggle('formation-board',prep);board.classList.toggle('combat-board',!prep);layoutBoard(true);}
  if(doc.defaultView?.ResizeObserver)new doc.defaultView.ResizeObserver(()=>layoutBoard()).observe(board);
  return Object.freeze({cells,units,cellAt,coord,cellFromHit,cellFromPoint,unitAt,hitAt,rect,visibleCellRect,center,eventAnchor,build,setFormation,layoutBoard});
 }
 const api=Object.freeze({COLS,ROWS,TEAM_COLS,valid,localToGlobal,globalToLocal,projection,create});if(typeof module==='object'&&module.exports)module.exports=api;else root.LIVEBoardView=api;
})(globalThis);
