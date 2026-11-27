/* M11-01: presentation-only DOM unit lifecycle. State is supplied per frame;
 * callbacks handle existing interaction intents. No economy or engine mutations. */
(function(root){'use strict';
 function create(view,callbacks){
 const {byId,esc,m904StarBadge,m7UnitStatus,equippedSlots,itemIconMarkup,bindItemTooltips,beginOwnedPointerDrag,showInspector,bindCharacterTip,normalizeVisuals,m1015AnimatePlacement,updateTooltip}=callbacks;
function unitMarkup(u,time){
 const r=byId[u.characterId]||(u.characterId==='nina'?{name:'니나',role:'소환수',implemented:true,asset:{sd:'assets/characters/nina.webp'}}:{name:u.name,role:u.role,implemented:true,asset:{}}),hp=Math.max(0,u.hp/u.maxHp*100),low=hp<=30,shield=Math.max(0,(u.skill?.shield||0)+(u.blueShields||[]).reduce((a,b)=>a+Math.max(0,b.amount||0),0)),shieldPct=Math.min(Math.max(0,100-hp),shield/u.maxHp*100);
 const visual=r.asset?.sd
  ? `<img class="sd-image" src="${esc(r.asset.sd)}" alt="${esc(u.name)}" decoding="async" draggable="false" onerror="this.parentElement.innerHTML='<div class=\\'sd-silhouette\\'><span>${esc(u.name.slice(0,1))}</span></div>'">`
  : `<div class="sd-silhouette"><span>${esc(u.name.slice(0,1))}</span></div>`;
 return `<div class="ground-ring"></div>
  <div class="sd-slot" data-asset="${esc(r.asset?.sd||"")}">${visual}</div>
  <div class="target-marker"></div><div class="hit-vfx"></div><div class="skill-vfx"></div>
  <div class="unit-hud compact-hud">
   <span class="hud-star star-${u.star}" aria-label="${u.star}성">${m904StarBadge(u.star)}</span>
   <div class="hpbar ${low?"low":""} ${(u.skill?.invulnUntil>time||u.skill?.immortalUntil>time)?"invincible-hp":""}" title="${shield>0?`체력 ${Math.ceil(u.hp)} / ${Math.ceil(u.maxHp)} · 보호막 ${Math.ceil(shield)}`:`체력 ${Math.ceil(u.hp)} / ${Math.ceil(u.maxHp)}`}"><i style="width:${hp}%"></i>${shield>0?`<em class="shield-overlay" style="left:${hp}%;width:${shieldPct}%"></em>`:""}</div>
  </div>${m7UnitStatus(u)}`;
}
function render(model){
 const {units,teams,owned,appMode,phase,running,hasBattle,time,placementOrigins,liveHitUntil,liveAttackUntil}=model;
 const existing=new Map([...view.units()].map(e=>[e.dataset.id,e]));
 const alive=new Set();
 for(const u of units){
  if(u.dead||u.hp<=0)continue;
  const cell=view.cellAt(u.x,u.y);if(!cell)continue;
  const id=String(u.id);alive.add(id);
  const placementUid=appMode==='game'&&u.team==='A'&&phase==='prep'
   ? teams.A.find(t=>t.ownedId!=null&&String(t.ownedId)===id.slice(id.lastIndexOf(':')+1))?.ownedId : null;
  let e=existing.get(id);
  if(!e){
   e=document.createElement('div');e.className=`unit ${u.team} star-${u.star}`;e.dataset.id=id;e.dataset.inspectCharacter=u.characterId;e.innerHTML=unitMarkup(u,time);
   const ownedEntry=appMode==='game'&&u.team==='A'?teams.A.find(x=>x.x===(u.initialX??u.x)&&x.y===(u.initialY??u.y)&&x.characterId===u.characterId&&x.star===u.star):null;
   if(u.purpleDummy||u.purpleGhost){e.classList.add('m1020-soldier-unit');e.setAttribute('aria-label',u.name);if(u.equipment?.length){e.insertAdjacentHTML('beforeend',`<span class="live-equip-slots"><span class="live-equip-slot" data-item-tooltip="${esc(u.equipment[0])}">${itemIconMarkup(u.equipment[0])}</span></span>`);bindItemTooltips(e)}}else if(appMode==='game'&&ownedEntry?.ownedId){const ownedUnit=owned.find(o=>o.uid===ownedEntry.ownedId);e.insertAdjacentHTML('beforeend',equippedSlots(ownedUnit));bindItemTooltips(e);e.draggable=false;e.dataset.ownedDrag=ownedEntry.ownedId;e.style.touchAction='none';e.addEventListener('pointerdown',ev=>beginOwnedPointerDrag(ev,ownedEntry.ownedId,e))}
   else{if(appMode==='game'&&u.team==='B'&&phase==='combat'){const foe=teams.B.find(t=>t.characterId===u.characterId&&t.star===u.star&&t.x===5-(u.initialX??u.x)&&t.y===(u.initialY??u.y))||teams.B.find(t=>t.characterId===u.characterId&&t.star===u.star);if(foe?.items?.length){e.insertAdjacentHTML('beforeend',equippedSlots({equipment:foe.items}));bindItemTooltips(e)}}e.draggable=!running&&!hasBattle;e.ondragstart=event=>event.dataTransfer.setData('text/plain',u.id)}
   if(appMode!=='game'){e.onmouseenter=()=>showInspector(e._liveUnit);e.onfocus=()=>showInspector(e._liveUnit)}
   e._liveUnit=u;bindCharacterTip(e,u);e.tabIndex=0;cell.appendChild(e);normalizeVisuals(e);
  }else{
   if(e.parentElement!==cell){
    const prev=e.getBoundingClientRect();e._liveMove?.cancel();cell.appendChild(e);
    if(!(placementUid!=null&&placementOrigins?.has(String(placementUid)))&&!document.hidden&&typeof e.animate==='function'&&!(document.body.dataset.liveMotion?document.body.dataset.liveMotion==='reduce':window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)){
     const next=e.getBoundingClientRect(),dx=prev.left+prev.width/2-next.left-next.width/2,dy=prev.bottom-next.bottom,scale=next.height?prev.height/next.height:1;
     if(dx||dy||Math.abs(scale-1)>.01){e._liveMove=e.animate([{transform:`translate(${dx}px,${dy}px) scale(${scale})`},{transform:'translate(0,0) scale(1)'}],{duration:190,easing:'ease-out'});}
    }
    normalizeVisuals(e);
   }
   const bar=e.querySelector('.hpbar'),hp=Math.max(0,u.maxHp?u.hp/u.maxHp*100:0);
   if(bar){bar.classList.toggle('low',hp<=30);bar.classList.toggle('invincible-hp',u.skill?.invulnUntil>time||u.skill?.immortalUntil>time);const shield=Math.max(0,(u.skill?.shield||0)+(u.blueShields||[]).reduce((v,b)=>v+Math.max(0,b.amount||0),0));bar.title=`체력 ${Math.ceil(u.hp)} / ${Math.ceil(u.maxHp)}${shield>0?' · 보호막 '+Math.ceil(shield):''}`;const fill=bar.querySelector('i');if(fill)fill.style.width=hp+'%';let overlay=bar.querySelector('.shield-overlay');if(shield>0){if(!overlay){overlay=document.createElement('em');overlay.className='shield-overlay';bar.appendChild(overlay)}overlay.style.left=hp+'%';overlay.style.width=Math.min(100-hp,shield/(u.maxHp||1)*100)+'%'}else overlay?.remove();}
   e.classList.toggle('cc',u.ccUntil>time);
   const states=m7UnitStatus(u),prev=e.querySelector('.m7-unit-states');if(states!==e._states){prev?.remove();if(states)e.insertAdjacentHTML('beforeend',states);e._states=states;}
  }
  e._liveUnit=u;
  if(placementUid!=null)m1015AnimatePlacement(e,placementUid,'board');
  updateTooltip(u);
  if(e.dataset.ownedDrag){const equipped=owned.find(o=>String(o.uid)===e.dataset.ownedDrag);if(equipped){const signature=JSON.stringify(equipped.equipment||[]);if(e._equipmentSignature!==signature){const changed=e._equipmentSignature!==undefined;const previous=e.querySelector('.live-equip-slots');if(previous)previous.outerHTML=equippedSlots(equipped);else e.insertAdjacentHTML('beforeend',equippedSlots(equipped));bindItemTooltips(e);e._equipmentSignature=signature;if(changed)root.LIVEHudMotion?.equip(e);}}}
  if((liveHitUntil.get(u.id)||0)>performance.now()){e.classList.add('live-hit-flash');if(!e.querySelector('.live-hit-spark')){const spark=document.createElement('span');spark.className='live-hit-spark';spark.textContent='✕';e.appendChild(spark)}}else{e.classList.remove('live-hit-flash');e.querySelector('.live-hit-spark')?.remove()}
  e.classList.toggle('live-attack-flash',(liveAttackUntil.get(u.id)||0)>performance.now());
 }
 for(const [id,e] of existing)if(!alive.has(id)){
  if(appMode==='game'&&['combat','result'].includes(phase)&&hasBattle)root.LIVEBattleMotion?.depart(e);
  e.remove();
 }

}

 return Object.freeze({render});
 }
 root.LIVEBoardRenderer=Object.freeze({create});
})(globalThis);
