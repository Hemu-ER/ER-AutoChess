/* M11 — visual actions, independent of damage and logical coordinates. */
(()=>{'use strict';
 let layer=null;const active=new Set(),timers=new Set(),casts=new Map();
 const reduced=()=>document.hidden||document.body.dataset.liveMotion==='reduce';
 function clear(){for(const a of active)a.cancel();active.clear();for(const t of timers)clearTimeout(t);timers.clear();layer?.replaceChildren();casts.clear();}
 function anim(el,frames,duration){if(!el||reduced()||!el.animate)return;const a=el.animate(frames,{duration,easing:'cubic-bezier(.2,.65,.25,1)'});active.add(a);a.onfinish=a.oncancel=()=>active.delete(a);return a;}
 function ensureLayer(){if(!layer){layer=document.createElement('div');layer.id='m11BattleMotionLayer';layer.setAttribute('aria-hidden','true');document.body.append(layer);}return layer;}
 function effect(x,y,frames,duration,cls){if(reduced())return;ensureLayer();const el=document.createElement('i');el.className=cls;el.style.left=x+'px';el.style.top=y+'px';layer.append(el);anim(el,frames,duration);const t=setTimeout(()=>{timers.delete(t);el.remove()},duration+30);timers.add(t);while(layer.childElementCount>64)layer.firstElementChild.remove();}
 function emit(e){if(!e||reduced()||!['game','test'].includes(document.body.dataset.appMode))return;const u=boardView.unitAt(e.unitId),sprite=u?.querySelector('.sd-slot');const a=boardView.center(e.x,e.y),b=boardView.center(e.toX,e.toY);if(!a)return;
  if(e.type==='execute'){effect(a.x,a.y-20,[{opacity:1,scale:'.6'},{opacity:0,scale:'1.5'}],420,'m11-execute');return;}
  if(e.type==='vfx-skill'){if(sprite){sprite._m11Cast?.cancel();sprite._m11Cast=anim(sprite,[{filter:'brightness(1)'},{filter:'brightness(1.8)',offset:.25},{filter:'brightness(1)'}],340);}return;}
  if(!b)return;const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,melee=(u?._liveUnit?.range??99)<=1||/전사|탱커|암살자|근거리/.test(u?._liveUnit?.role||'');const skill=e.type==='skill-target';const key=e.unitId+':'+e.time+':'+e.type;
  if(!casts.has(key)&&sprite){casts.set(key,performance.now());const step=melee?Math.min((u.clientHeight||120)*.33,d*.38,65):-Math.min((u.clientHeight||120)*.13,24);sprite._m11Attack?.cancel();sprite._m11Attack=anim(sprite,[{transform:'translate(0,0)'},{transform:`translate(${dx/d*step}px,${dy/d*step}px)`,offset:.32},{transform:'translate(0,0)'}],skill?350:melee?310:230);}
  for(const [k,t] of casts)if(performance.now()-t>1000)casts.delete(k);
  const h=u?.clientHeight||100;const sy=a.y-h*.46,ey=b.y-h*.35;
  if(!melee||skill){const angle=Math.atan2(ey-sy,dx)*180/Math.PI;effect(a.x,sy,[{transform:`translate(0,0) rotate(${angle}deg)`,opacity:1},{transform:`translate(${dx}px,${ey-sy}px) rotate(${angle}deg)`,opacity:.1}],skill?290:200,skill?'m11-projectile skill':'m11-projectile');}
  else effect(b.x,ey,[{opacity:0,scale:'.5'},{opacity:1,scale:'1',offset:.35},{opacity:0,scale:'1.4'}],290,'m11-slash');
 }
 function depart(el){if(reduced())return;const img=el.querySelector('.sd-image');if(!img?.src)return;const r=img.getBoundingClientRect();if(!r.width||!r.height)return;ensureLayer();const copy=document.createElement('img');copy.src=img.src;copy.alt='';copy.className='m11-departing';Object.assign(copy.style,{position:'absolute',left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px',objectFit:'contain',pointerEvents:'none'});layer.append(copy);anim(copy,[{opacity:1,filter:'brightness(1)'},{opacity:.7,filter:'brightness(1.8)',offset:.25},{opacity:0,scale:'.86',filter:'brightness(1.3)'}],330);const t=setTimeout(()=>{timers.delete(t);copy.remove()},370);timers.add(t);}
 document.addEventListener('visibilitychange',()=>{if(document.hidden)clear()});window.LIVEBattleMotion={emit,clear,depart};
})();
