/* M10-06 direct-load bridge for an already-applied M10-07 game.
   Loads M10-06 before M10-07 CSS in cascade order; leaves game.js/index.html untouched. */
(function (root) {
  'use strict';
  if (typeof document === 'undefined') return;
  const href = 'm1006-visual-skin.css';
  const scriptName = 'm1006-ui-language.js';
  let queryFlag = null;
  try { queryFlag = new URLSearchParams(root.location.search).get('m1006skin'); } catch (_) {}
  let storedFlag = null;
  try {
    if (queryFlag === '0' || queryFlag === '1') root.sessionStorage.setItem('live_m1006_skin', queryFlag);
    storedFlag = root.sessionStorage.getItem('live_m1006_skin');
  } catch (_) {}
  const shouldDisable = queryFlag === '0' || (queryFlag !== '1' && storedFlag === '0');
  let skin = document.getElementById('m1006VisualSkin') ||
    document.querySelector('link[href^="m1006-visual-skin.css"]');
  if (!skin) {
    skin = document.createElement('link');
    skin.rel = 'stylesheet';
    skin.href = href;
    skin.id = 'm1006VisualSkin';
    const m1007Skin = document.querySelector('link[href^="m1007-graphics.css"]');
    if (m1007Skin && m1007Skin.parentNode) {
      m1007Skin.parentNode.insertBefore(skin, m1007Skin);
    } else {
      document.head.appendChild(skin);
    }
  }
  skin.disabled = shouldDisable;
  if (!root.LIVEM1006Text && !document.querySelector('script[src^="m1006-ui-language.js"]')) {
    const script = document.createElement('script');
    script.src = scriptName;
    script.async = false;
    (document.body || document.head).appendChild(script);
  }
})(globalThis);

/* L.I.V.E. M10-07 — optional presentation and authoritative auction reward interface. */
(function(root){'use strict';
 const $=s=>document.querySelector(s);let pendingPromise=false,lastChoiceKey='',closedChoiceKey='';
 const terms=txt=>String(txt||'').replace(/(\d+)\s*행(?=$|[^가-힣]|[에의은을과마다별])/g,'$1번째 가로줄').replace(/(\d+)\s*열(?=$|[^가-힣]|[에의은을과마다별])/g,'$1번째 세로줄').replace(/(^|[^가-힣])행(?=$|[^가-힣])/g,'$1가로줄').replace(/(^|[^가-힣])열(?=$|[^가-힣])/g,'$1세로줄').replace(/(^|[^가-힣])행(?=마다|별|에|의|은|을|과|으로)/g,'$1가로줄').replace(/(^|[^가-힣])열(?=마다|별|에|의|은|을|과|으로)/g,'$1세로줄');
 const polite=(text)=>{
  let t=terms(String(text||'').trim());if(!t)return t;
  // Use the existing inflection table, but protect noun endings such as '피해.'
  // which would otherwise be corrupted by the generic 해. → 합니다. conversion.
  const shield='\uE001';t=t.replace(/(피해|손해|무해)([.!?]|$)/g,(_m,n,p)=>n+shield+p);
  t=root.LIVEFormalText?.formal?.(t)||t;
  t=t.replaceAll(shield,'');
  // Gray infusion catalog entries are often effect fragments, not sentences.
  // Append a polite applicability note without inventing numbers or conditions.
  if(/(?:[+−-]?\d+(?:\.\d+)?(?:C|EXP|%|회|초|칸|중첩)|피해)[.!?]?$/.test(t)){
   return t.replace(/[.!?]+$/,'')+' · 효과는 조건에 따라 적용됩니다.';
  }
  if(/[.!?]$/.test(t))return t;
  return t+' · 효과는 조건에 따라 적용됩니다.';
 };
 const summary=(card,full)=>{
  const raw=terms(String(card?.description||full||'')).replace(/\([^)]*\)/g,'').trim();
  const part=raw.split(/[.;]/)[0].slice(0,55).trim();
  return part+(raw.length>55?'…':'')+' · 자세한 효과는 Shift를 눌러 확인해 주세요.';
 };
 root.LIVEM1007={polite,summary,terms};
 // DOM text only: preserve internal IDs, player chat, numeric game state and skill names.
 const SCOPE='body[data-app-mode=game],#gameBottomDock,#roundModePanel,#currentSynergyPanel,#liveItemsPanel,#liveAugmentPanel,#liveCodex,#m907PurpleStrategy,#unitInspector,#liveAuctionPanel,#liveSelectionPanel,.m901-owned-augments';
 const SKIP='script,style,input,textarea,[contenteditable],.live-chat-message,.chat-message';
 const normalizeNode=node=>{
  if(node.nodeType===3){const el=node.parentElement;if(!el||el.closest(SKIP)||!el.closest(SCOPE))return;const text=node.nodeValue,updated=terms(text);if(updated!==text)node.nodeValue=updated;return;}
  if(node.nodeType!==1||node.matches(SKIP))return;
  if(node.closest(SCOPE)||node.matches(SCOPE)){
   for(const name of ['title','aria-label'])if(node.hasAttribute(name)){const old=node.getAttribute(name),v=terms(old);if(v!==old)node.setAttribute(name,v)}
  }
  for(const child of node.childNodes)normalizeNode(child);
 };
 // Add favorite markers to bench & board as the matching set changes.
 function markFocused(){
  if(document.body.dataset.appMode!=='game')return;
  let values;try{values=JSON.parse(localStorage.getItem('live_m910_shop_focus')||'[]')}catch{return};
  const wanted=new Set(Array.isArray(values)?values:[]);
  for(const el of document.querySelectorAll('.bench-unit[data-inspect-character],#board .unit[data-inspect-character]')){
   const record=root.ERRoster?.byId?.[el.dataset.inspectCharacter];
   const hit=Boolean(record&&(record.affiliations||[]).some(a=>wanted.has(a))||wanted.has(record?.role));
   el.classList.toggle('m1007-focus',hit);
  }
 }
 // Standalone claimed reward selection UI. Do not mutate client inventory; server owns award.
 const esc=t=>String(t||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 function choiceUi(){
  const room=root.LIVEMultiplayer?.getRoom?.(),own=room?.players?.find(p=>p.id===root.LIVEMultiplayer?.getPlayerId?.());
  const choices=own?.assets?.auctionChoices||[];
  let panel=$('#m1007AuctionChoices'),resume=$('#m1007ChoiceResume');
  if(!panel){panel=document.createElement('section');panel.id='m1007AuctionChoices';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','2코스트 실험체 선택권');panel.hidden=true;document.body.appendChild(panel)}
  if(!resume){resume=document.createElement('button');resume.type='button';resume.id='m1007ChoiceResume';resume.hidden=true;resume.onclick=()=>{closedChoiceKey='';choiceUi()};document.body.appendChild(resume)}
  if(!room?.started||!choices.length){panel.hidden=true;resume.hidden=true;lastChoiceKey='';closedChoiceKey='';return}
  const c=choices[0],key=c.id;
  resume.hidden=false;resume.textContent=`경매 실험체 선택권 ${choices.length}개`;
  if(key===closedChoiceKey){panel.hidden=true;return}
  panel.hidden=false;
  if(key===lastChoiceKey)return;
  lastChoiceKey=key;
  const opts=(root.ERRoster?.roster||[]).filter(r=>!r.pveOnly&&r.cost===2);
  panel.innerHTML=`<small>AUCTION RESEARCH REWARD</small><h3>2코스트 실험체를 선택해 주세요.</h3><p>원하는 실험체 1명을 ★1로 지급합니다. 상점의 실험체 재고를 소모하지 않습니다.</p><div class="m1007-choice-list">${opts.map(r=>`<button type="button" data-choice-unit="${esc(r.id)}">${esc(r.name)} · ${esc(r.role)}</button>`).join('')}</div><footer><span id="m1007ChoiceStatus" role="status">낙찰 보상은 선택 후 지급됩니다.</span><button type="button" data-choice-later>나중에 선택</button></footer>`;
  panel.querySelector('[data-choice-later]').onclick=()=>{closedChoiceKey=key;panel.hidden=true};
  panel.querySelectorAll('[data-choice-unit]').forEach(btn=>btn.addEventListener('click',async()=>{
   if(pendingPromise)return;pendingPromise=true;panel.querySelectorAll('button').forEach(b=>b.disabled=true);
   const status=panel.querySelector('#m1007ChoiceStatus');status.textContent='서버 보상을 확인하고 있습니다.';
   try{await root.LIVEMultiplayer.auctionChooseUnit(key,btn.dataset.choiceUnit);lastChoiceKey='';closedChoiceKey=key;status.textContent='보상을 지급했습니다.';panel.hidden=true;}
   catch(e){status.textContent='지급 실패: '+String(e?.message||e);panel.querySelectorAll('button').forEach(b=>b.disabled=false)}
   finally{pendingPromise=false}
  }));
 }
 let scanQueued=false;
 function scan(){scanQueued=false;normalizeNode(document.body);markFocused()}
 const observer=new MutationObserver(()=>{if(!scanQueued){scanQueued=true;requestAnimationFrame(scan)}});
 function start(){observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','aria-label']});scan();setInterval(choiceUi,650)}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
 // Low-overhead effects fed by the deterministic engine; never infer execution from generic death.
 let layer=null,previousFx=0;
 const cell=(x,y)=>document.querySelector(`#board .cell[data-x="${x}"][data-y="${y}"]`);
 const midpoint=el=>{if(!el)return null;const r=el.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}};
 function emit(event){
  if(!event||!['attack','execute'].includes(event.type)||document.body.dataset.appMode!=='game')return;
  const t=performance.now();if(event.type==='attack'&&t-previousFx<35)return;previousFx=t;
  const a=midpoint(cell(event.x,event.y)),b=midpoint(cell(event.toX,event.toY));const at=event.type==='execute'?a:b;
  if(!at||!a)return;
  if(!layer){layer=document.createElement('div');layer.id='m1007AttackLayer';document.body.appendChild(layer)}
  const node=document.createElement('span');node.className=event.type==='execute'?'m1007-execute':'m1007-shot'+(event.kind==='skill'?' skill':'');
  node.style.left=a.x+'px';node.style.top=a.y+'px';
  if(event.type==='execute'){node.style.left=at.x+'px';node.style.top=at.y+'px'}
  else{const angle=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI,length=Math.hypot(b.y-a.y,b.x-a.x);node.style.setProperty('--angle',angle+'deg');node.style.setProperty('--length',Math.max(.3,length/52).toFixed(2));}
  layer.appendChild(node);node.addEventListener('animationend',()=>node.remove(),{once:true});setTimeout(()=>node.remove(),1000);
 }
 root.LIVEAttackFX={emit};
})(globalThis);
