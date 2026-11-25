/* M10-16: presentation-only combat feedback.
 * Engine results remain authoritative; this overlay never alters unit state,
 * combat timing, Pixi sprites, input hitboxes or network commands.
 */
(()=>{'use strict';
 const board=document.getElementById('board');
 const shell=board?.closest('.board-shell');
 if(!board||!shell)return;
 const layer=document.createElement('div');layer.className='m1016-vfx-layer';
 layer.setAttribute('aria-hidden','true');shell.appendChild(layer);
 const groups=new Map(),skillLabels=new Map(),lastImpacts=new Map(),timers=new Set();
 let generation=0;
 const now=()=>performance.now();
 const motionOff=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches||false;
 const active=()=>!document.hidden&&!board.classList.contains('formation-board')
  && ['game','test'].includes(document.body.dataset.appMode);
 function schedule(node,ms,done){
  const age=generation;
  const timer=setTimeout(()=>{timers.delete(timer);if(age!==generation)return;node.remove();done?.()},ms);
  timers.add(timer);
 }
 function clear(){generation++;for(const t of timers)clearTimeout(t);timers.clear();groups.clear();skillLabels.clear();lastImpacts.clear();layer.replaceChildren();}
 function locationOf(event,atHead=true){return boardView.eventAnchor(event,shell,atHead);}
 function makeNode(className,pos){
  const node=document.createElement('span');node.className=className;
  node.style.left=pos.x+'px';node.style.top=pos.y+'px';layer.appendChild(node);
  return node;
 }
 function kindOf(e){
  if(e.type==='vfx-heal')return 'heal';
  if(e.delayed)return 'delayed';
  if(e.dot)return 'dot';
  if(e.kind==='shared')return 'shared';
  if(e.critical)return 'critical';
  if(e.kind==='skill')return 'skill';
  if(e.kind==='basic')return 'basic';
  return 'effect';
 }
 function hitMark(e,pos){
  if(motionOff())return;
  const t=now(),id=String(e.unitId);
  if(t-(lastImpacts.get(id)||-1e5)<105)return;
  lastImpacts.set(id,t);
  const mark=makeNode('m1016-vfx-impact', {x:pos.x,y:Math.min(shell.clientHeight-12,pos.y+13)});
  for(let i=0;i<3;i++){const stroke=document.createElement('i');mark.appendChild(stroke)}
  schedule(mark,340);
 }
 function damageOrHeal(e){
  if(!(Number(e.amount)>0))return;
  const pos=locationOf(e);if(!pos)return;
  const type=kindOf(e),t=now(),key=String(e.unitId)+':'+type;
  let entry=groups.get(key);
  // Rolling grouping avoids splitting two hits on a clock-bucket boundary.
  if(entry&&t-entry.at>235)entry=null;
  if(!entry){
   const idx=[...groups.keys()].filter(k=>k.startsWith(String(e.unitId)+':')).length;
   // Offset unlike damage types around the target head, not over one another.
   const lanes=[[23,-2],[-29,-24],[27,-43],[-30,17],[30,19],[-5,-57]];
   const [dx,dy]=lanes[idx%lanes.length];
   const text=makeNode('m1016-vfx-number m1016-'+type,{x:Math.max(18,Math.min(shell.clientWidth-18,pos.x+dx)),y:Math.max(24,pos.y+dy)});
   entry={text,amount:0,at:t};groups.set(key,entry);
   schedule(text,930,()=>{if(groups.get(key)===entry)groups.delete(key)});
  }
  entry.amount+=Number(e.amount);
  entry.text.textContent=(type==='heal'?'+':'')+Math.round(entry.amount).toLocaleString('ko-KR');
  if(type!=='heal')hitMark(e,pos);
 }
 function skill(e){
  if(!e.name)return;
  const pos=locationOf(e);if(!pos)return;
  const t=now(),id=String(e.unitId),old=skillLabels.get(id);
  if(old&&t-old.at<180){old.text.textContent=String(e.name).slice(0,28);return;}
  const text=makeNode('m1016-vfx-skill-label',{x:pos.x,y:Math.max(20,pos.y-18)});
  text.textContent=String(e.name).slice(0,28);
  skillLabels.set(id,{text,at:t});
  schedule(text,780,()=>{if(skillLabels.get(id)?.text===text)skillLabels.delete(id)});
 }
 function emitBatch(events){
  if(!active()||!Array.isArray(events)||!events.length)return;
  for(const e of events.slice(-48)){
   if(e?.type==='vfx-skill')skill(e);
   else if(e?.type==='vfx-damage'||e?.type==='vfx-heal')damageOrHeal(e);
  }
  // Resource bound for long battles with many periodic hits.
  while(layer.childElementCount>72)layer.firstElementChild?.remove();
 }
 document.addEventListener('visibilitychange',()=>{if(document.hidden)clear()});
 window.LIVECombatVFX={emitBatch,clear};
})();
