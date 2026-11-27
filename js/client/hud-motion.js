/* M11-04: shared non-blocking HUD interaction feedback. No game-state mutation. */
(function(root){'use strict';
 const media=root.matchMedia?.('(prefers-reduced-motion: reduce)');let mode='on';function setMode(v){mode=v||'on';document.body.dataset.liveMotion=mode==='reduce'||(mode==='auto'&&media?.matches)?'reduce':'on';}media?.addEventListener?.('change',()=>setMode(mode));setMode(mode);const reduced=()=>document.hidden||document.body.dataset.liveMotion==='reduce';
 const play=(el,frames,duration=160)=>{if(!el||reduced()||!el.animate)return;try{el._liveHudAnim?.cancel();el._liveHudAnim=el.animate(frames,{duration,easing:'cubic-bezier(.2,.7,.3,1)'});}catch(_){/* optional presentation only */}};
 const appear=el=>play(el,[{opacity:.15,scale:'.94'},{opacity:1,scale:'1'}],260);
 function togglePanel(el,closing,done){el?._livePanelAnimation?.cancel();if(!el||reduced()||!el.animate){done?.();return;}if(closing){const a=el.animate([{opacity:1,scale:'1'},{opacity:0,scale:'.94'}],{duration:210,easing:'ease-in',fill:'forwards'});el._livePanelAnimation=a;a.onfinish=()=>{el._livePanelAnimation=null;a.cancel();done?.();};a.oncancel=()=>{if(el._livePanelAnimation===a)el._livePanelAnimation=null;};}else{done?.();appear(el);}}
 const flash=el=>play(el,[{filter:'brightness(1.6)'},{filter:'brightness(1)'}],220);
 const equip=el=>{flash(el.querySelector('.ground-ring'));appear(el.querySelector('.live-equip-slots'));};
 function ghost(el,cell){if(!el)return;const s=cell?._liveProjection?.foot?.scale;el.style.width=s?`${Math.max(50,186*s)}px`:'58px';el.style.height=s?`${Math.max(65,218*s)}px`:'74px';}
 let lastShop=null,lastOwned=null;
 function economy(dock,shop,owned){
  const prev=lastShop,prior=lastOwned;lastShop=shop.slice();lastOwned=new Map(owned.map(o=>[String(o.uid),{star:o.star,equipment:JSON.stringify(o.equipment||[])}]));
  if(prev){for(const el of dock.querySelectorAll('[data-buy]')){const i=+el.dataset.buy;if(shop[i]!==prev[i])appear(el);}}
  if(prior){for(const el of document.querySelectorAll('#board .unit[data-owned-drag],#gameBottomDock .bench-unit[data-owned-drag]')){const id=el.dataset.ownedDrag,p=prior.get(id),n=lastOwned.get(id);if(!n)continue;if(!p)appear(el);else if(p.star!==n.star){play(el.querySelector('.sd-slot,.bench-portrait')||el,[{filter:'brightness(2)',scale:'1.05'},{filter:'brightness(1)',scale:'1'}],420);}else if(p.equipment!==n.equipment)equip(el);}}
 }
 function syncWallet(active,stats){
  let brand=document.querySelector('#m11Identity'),wallet=document.querySelector('#m11Wallet');
  if(!active){brand?.remove();wallet?.remove();lastShop=null;lastOwned=null;return;}
  if(!brand){brand=document.createElement('div');brand.id='m11Identity';brand.innerHTML='<b>L.I.V.E.</b><small>루미아섬 가상실험</small>';document.body.append(brand);}
  if(!wallet){wallet=document.createElement('div');wallet.id='m11Wallet';wallet.innerHTML='<span><b></b><small>크레딧</small></span><span><b></b><small>체력</small></span><span><b></b><small>숙련도</small></span>';document.body.append(wallet);}
  const values=[`${stats.credits} C`,String(stats.hp),String(stats.mastery)];[...wallet.querySelectorAll('b')].forEach((el,i)=>{if(el.textContent!==values[i]){const had=el.textContent;el.textContent=values[i];if(had)flash(el);}});
 }
 // Pause floating while any pointer interaction is in progress, even if it leaves the panel.
 const pointers=new Set();function clear(){pointers.clear();document.body?.classList.remove('live-hud-interacting');}
 document.addEventListener('pointerdown',e=>{pointers.add(e.pointerId);document.body?.classList.add('live-hud-interacting');},true);
 for(const name of ['pointerup','pointercancel'])document.addEventListener(name,e=>{pointers.delete(e.pointerId);if(!pointers.size)clear();},true);
 root.addEventListener('blur',clear);document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
 // One visual clock, including panels recreated by state updates. Freeze the whole group together.
 const floating='#currentSynergyPanel,#liveItemsPanel,#m809LiveHpStandings,#m809DamagePanel';
 let elapsed=0,last=0,over=false,previousOffset=null,velocity=0;
 document.addEventListener('pointermove',e=>{over=!!e.target.closest?.(floating);},{passive:true});
 document.addEventListener('pointerout',e=>{if(!e.relatedTarget)over=false;});
 function tick(now){const dt=last?Math.min(50,now-last):0;last=now;const active=document.body.dataset.appMode==='game'&&['formation','duel','farm','boss'].includes(document.body.dataset.liveScene);const target=active&&!reduced()&&!over&&!document.body.classList.contains('live-hud-interacting')?1:0;velocity+=(target-velocity)*(1-Math.exp(-dt/180));elapsed+=dt*velocity;const offset=active&&!reduced()?-8*(1-Math.cos(elapsed/8000*Math.PI*2))/2:0;const value=offset.toFixed(3)+'px';if(value!==previousOffset){document.body.style.setProperty('--live-hud-y',value);previousOffset=value;}requestAnimationFrame(tick);}
 requestAnimationFrame(tick);
 root.LIVEHudMotion=Object.freeze({play,appear,equip,ghost,economy,syncWallet,setMode,togglePanel});
})(globalThis);
