/* L.I.V.E. M5-10 — economy preview uses M4 combat engine rules, independent farm QA. */
(() => {
'use strict';
const $=id=>document.getElementById(id);
const roster=()=>window.ERRoster?.byId||{};
const regions=()=>window.ERCombat?.ARENA_REGIONS||{};
const LAB_SYNERGIES=['파자마','바니걸','수영복','마츠리','프리즌','군악대','새해','악마사냥꾼','메이드','애증','치유의 노래','에레보스'];
const simple=tag=>String(tag||'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const SYNERGY_EFFECT_TEXT={
 "현우정신":()=>`전열에 현우 혼자 배치 시 현우 최대 HP +5%, DEF +10%.`,
 "파자마":t=>t>=3?`첫 5초부터 5초마다 무작위 적 1명을 1초 수면. 수면 해제 시 공격자 AMP 200% 추가 피해.`:`첫 5초부터 5초마다 무작위 적 1명을 1초 수면. 수면 해제 시 공격자 AMP 100% 추가 피해.`,
 "바니걸":t=>t>=3?`바니걸 기본 공격 시 40% 확률로 적응형 능력치 75% 추가 피해.`:`바니걸 기본 공격 시 20% 확률로 적응형 능력치 50% 추가 피해.`,
 "수영복":t=>t>=3?`수영복 기본 공격 공유 15회마다 적 전체에 각 대상 최대 HP 5% 고정 피해.`:`수영복 기본 공격 공유 20회마다 적 전체에 각 대상 최대 HP 3% 고정 피해.`,
 "마츠리":t=>t>=3?`적 처치 시 전 아군이 10초간 ATK/AMP +30%, 최대 HP +30%. 재발동 시 지속시간 갱신.`:`적 처치 시 전 아군이 5초간 ATK/AMP +15%, 최대 HP +15%. 재발동 시 지속시간 갱신.`,
 "프리즌":t=>t>=3?`프리즌 실험체의 피해 적중마다 감옥 +1. 8중첩 시 1.5초 행동 불능. 프리즌 실험체가 받는 행동 불능 지속시간 50% 감소.`:`프리즌 실험체의 피해 적중마다 감옥 +1. 8중첩 시 1초 행동 불능. 프리즌 실험체가 받는 행동 불능 지속시간 50% 감소.`,
 "군악대":t=>t>=2?`아군이 회복되면 해당 아군이 10초간 ATK/AMP +20%, AS +20%. 중첩 없이 지속시간 갱신.`:`아군이 회복되면 해당 아군이 5초간 ATK/AMP +10%, AS +10%. 중첩 없이 지속시간 갱신.`,
 "새해":t=>({1:`전투 시작 시 아군 전체 최대 HP +5%, DEF +10. 피격 10회 후 제거.`,2:`전투 시작 시 아군 전체 최대 HP +10%, DEF +20. 피격 20회 후 제거.`,3:`전투 시작 시 아군 전체 최대 HP +15%, DEF +25. 피격 30회 후 제거.`}[Math.min(3,t)]),
 "악마사냥꾼":t=>t>=3?`악마사냥꾼의 기본 공격/스킬 적중 시 주 능력치 30% 추가 피해.`:`악마사냥꾼의 기본 공격/스킬 적중 시 주 능력치 15% 추가 피해.`,
 "메이드":t=>t>=3?`메이드 기본 공격마다 클리닝 +15. 누적에 따라 아군 DEF가 최대 +15, 200 도달 시 아군 전체 최대 HP 12% 회복.`:`메이드 기본 공격마다 클리닝 +10. 누적에 따라 아군 DEF가 최대 +10, 200 도달 시 아군 전체 최대 HP 10% 회복.`,
 "애증":()=>`케네스가 전장에 존재하면 가넷 AMP/AS +30%, 최대 HP/DEF +20%.`,
 "치유의 노래":()=>`샬럿의 치유의 빛 발동 시 아군 전체를 샬럿 현재 AMP의 70%만큼 추가 회복.`,
 "에레보스":()=>`현재 효과 미정.`,
 "전사":()=>`중열 또는 전열 배치 시 주 능력치 +15%, AS +10%, DEF +10, 최대 HP +10%.`,
 "탱커":()=>`전열 배치 시 DEF +20, 최대 HP +20%, AS +10%.`,
 "원거리 평타":()=>`후열 또는 중열 배치 시 ATK +20%, AS +20%.`,
 "원거리 스킬":()=>`후열 또는 중열 배치 시 AMP +25%, AS +10%.`,
 "근거리 스킬":()=>`중열 또는 전열 배치 시 AMP +20%, AS +15%.`,
 "암살자":()=>`배치와 무관하게 활성. 적 후열/중열 대상 공격 시 피해 +30%.`,
 "서포터":()=>`배치와 무관하게 활성. 서포터 1명당 아군 전체 주 능력치/AS/최대 HP +5%.`
};

const state={items:[],report:'파밍 시험 전',lastFarm:null};
function snapshotForPreview(entries){
 const teamA=entries.map(o=>({characterId:o.characterId,x:o.x,y:o.y,star:o.star,items:[...(o.equipment||[])]}));
 if(!teamA.length)return null;
 const now=window.LIVEM5?.getState?.();
 const enemies=(now?.units||[]).filter(u=>u.team==='B' && roster()[u.characterId||u.id] && !roster()[u.characterId||u.id].pveOnly).slice(0,3).map(u=>({characterId:u.characterId||u.id,star:u.star||1,x:5-u.x,y:u.y}));
 const cfg={teamA,teamB:enemies.length?enemies:[{characterId:'aya',x:0,y:0,star:1}],seed:123456,masteryA:window.M5Economy?.getState?.()?.level||1,masteryB:1,moveInterval:.5,arenaRegion:now?.region||'lab'};
 try{const e=new window.ERCombat.CombatEngine(cfg);e.start();return e.getResult().synergies?.A||null}catch(err){console.warn('[M5 synergy preview]',err);return null}
}
function tiers(name){return name==='군악대'||name==='새해'?[1,2,3]:name==='애증'||name==='치유의 노래'?[1]:name==='에레보스'?[]:[2,3]}
function tierText(name,tier){const f=SYNERGY_EFFECT_TEXT[name];return f?f(tier||1):'현재 효과 설명 없음.'}
function renderSynergies(entries){
 const root=$('m5-synergy-list'),roles=$('m5-role-synergies');if(!root||!roles)return;
 root.replaceChildren();roles.replaceChildren();
 const info=snapshotForPreview(entries),aff=info?.affiliations||{};
 const shown=Object.entries(aff).filter(([n,v])=>v.count>0);
 shown.sort((a,b)=>Number(b[1].active)-Number(a[1].active)||b[1].count-a[1].count||a[0].localeCompare(b[0],'ko'));
 for(const [name,v] of shown){
  const possible=tiers(name),level=v.tier,remaining=possible.find(t=>t>v.count);
  const label=`${name} ${v.count}${level?' · '+level+'단계':''}`;
  const details=`${name} · ${v.count}명 / ${level?'현재 '+level+'단계 활성':'비활성'}\n${level?tierText(name,level):remaining?'다음 '+remaining+'명: '+tierText(name,remaining):'현재 활성 효과 없음'}${remaining?'\n다음 단계 '+remaining+'명 필요':''}`;
  const b=document.createElement('button');b.type='button';b.className='m5-aff-chip'+(v.active?' m5-synergy-active':'');b.textContent=label;b.dataset.tip=details;b.dataset.full=possible.map(t=>`${t}명 / ${tierText(name,t)}`).join('\n');root.appendChild(b);
 }
 if(!shown.length)root.textContent='배치된 실험체의 소속 시너지가 여기 표시돼.';
 for(const v of info?.roles||[]){
  const b=document.createElement('button');b.type='button';b.textContent=`${v.name} · ${v.role} ${v.active?'ON':'OFF'}`;
  b.dataset.tip=`${v.name} / ${v.role} 역할 시너지 ${v.active?'적용':'미적용'}\n${tierText(v.role,1)}`;roles.appendChild(b);
 }
}
let popup=null,hoverTarget=null;
function showTip(el,x,y){if(!popup){popup=document.createElement('div');popup.className='m5-synergy-popup';popup.hidden=true;document.body.appendChild(popup)}
 const detail=el?.dataset.tip||'';if(!detail){popup.hidden=true;return;}
 const title=detail.split('\n')[0];const rest=detail.substring(title.length+1);
 popup.innerHTML=`<strong>${simple(title)}</strong><small>${simple(rest)}</small>`;
 if(el.dataset.full&&(window.event?.shiftKey||window.M5ShowDetailedTip)){const extra=document.createElement('small');extra.style.marginTop='6px';extra.textContent='전체 단계\n'+el.dataset.full;popup.appendChild(extra)}
 popup.hidden=false;let left=x+18,top=y+15;const r=popup.getBoundingClientRect();if(left+r.width>innerWidth-10)left=Math.max(10,x-r.width-20);if(top+r.height>innerHeight-10)top=Math.max(10,y-r.height-20);popup.style.left=left+'px';popup.style.top=top+'px';
}
const tipTarget=e=>e.target.closest?.('[data-tip]')||e.target.closest?.('#m5-region-tip');
document.addEventListener('pointermove',e=>{const t=tipTarget(e);if(t){hoverTarget=t;showTip(t,e.clientX,e.clientY)}else if(hoverTarget){hoverTarget=null;if(popup)popup.hidden=true}},true);
document.addEventListener('focusin',e=>{const t=tipTarget(e);if(t){hoverTarget=t;const r=t.getBoundingClientRect();showTip(t,r.left,r.bottom)}},true);
document.addEventListener('focusout',e=>{if(tipTarget(e)){hoverTarget=null;if(popup)popup.hidden=true}},true);
document.addEventListener('keydown',e=>{if(e.key==='Shift'&&hoverTarget){window.M5ShowDetailedTip=true;const r=hoverTarget.getBoundingClientRect();showTip(hoverTarget,r.left,r.bottom)}});
document.addEventListener('keyup',e=>{if(e.key==='Shift'){window.M5ShowDetailedTip=false;if(hoverTarget){const r=hoverTarget.getBoundingClientRect();showTip(hoverTarget,r.left,r.bottom)}}});
function regionDetails(){const region=window.LIVEM5?.getState?.()?.region||'lab';const r=regions()[region];const t=$('m5-region-tip');if(t&&r){t.dataset.tip=`지역 · ${r.name}\n${r.detail}\n실제 전투 엔진에 적용되는 효과. ${region==='forest'?'양 팀 각 1명만 피해를 받음.':'지역은 전투 시작 시 확정됨.'}`;t.dataset.full='지역 효과는 M4 전투 엔진에서 계산하며 M5는 동일한 판정 결과를 재생함.';}}
function refreshSynergies(){const o=window.M5Economy?.getState?.();if(o)renderSynergies((o.owned||[]).filter(u=>u.location==='board'));regionDetails();}
// M5-11: one inventory (12 slots), one authoritative equipped array per owned unit.
const ICON_ALIASES={'방탄 조끼':'방탄조끼','슈팅스타의 자켓':'슈팅스타 자켓'};
const ITEM_EFFECT_HINTS={"오토-암즈": "기본 공격력 +10%", "블레이드 부츠": "스킬 적중 시 2초간 공격 속도 +15%", "스펙터": "매초 인접 적에게 ATK 20% 피해", "아오자이": "받는 피해 20%를 3초 동안 지연", "미스릴 퀴버": "기본 공격 3회마다 최대 HP 6% 보호막 (1초)", "레이더": "기본 공격 3회마다 ATK 비례 추가 피해 및 회복", "서슬가시 체인": "피해 대상 회복량 -20% (5초)", "임세티": "스킬 증폭 +15%", "레버넌트": "매초 인접 적에게 AMP 25% 피해", "요명월": "액티브 사용 시 인접 적에게 AMP 60% 피해", "텔루리안 타임피스": "기본 공격마다 AMP 20% 추가 피해", "천룡잠": "치명타 시 액티브 피해 +2%, 최대 5중첩", "용의 비늘": "퍼센트 방어 관통 +15%p", "미스릴 크롭": "체력 +20%", "배틀 슈트": "공격자 거리 1/2/3에 따라 피해 감소 5/10/15%", "팬텀 자켓": "기본 공격마다 공격 속도 +5%, 최대 4중첩; 최대 중첩 체력 +10%", "타이탄 아머": "2초마다 다음 기본 공격에 추가 체력 비례 피해", "유령 신부의 드레스": "주변 1칸 적 방어력 -10% 오라", "가디언 슈트": "방어력 +10%", "길리 슈트": "기본 공격마다 공격 속도 +5%, 최대 4중첩; 최대 중첩 방어력 +10%", "화령장": "치명타 적중 시 받는 피해 -2%, 최대 5중첩", "슈팅스타의 자켓": "기본 공격 대상 방어력 -5%, 최대 2중첩", "살라딘의 화살통": "기본 공격마다 공격 속도 +5%, 최대 4중첩; 최대 중첩 적응형 +5%", "레가투스": "치명타 시 ATK·AS +5%, 최대 3중첩", "블래스터 헬멧": "5초마다 다음 기본 공격에 ATK 100% 추가 피해", "운명의 주사위": "치명타 피해 +10%p", "프시케의 칼날": "적 실험체 처치 시 +1C", "아이언 메이든": "퍼센트 방어 관통 +15%"};
const ITEM_STAT_LABELS={atk:'공격력',amp:'스킬 증폭',hp:'체력',def:'방어력',as:'공격 속도',crit:'치명타 확률',penFlat:'고정 방어 관통'};
const itemIcon=name=>`assets/items/${encodeURIComponent(ICON_ALIASES[name]||name)}.webp`;
const itemStats=name=>Object.entries(window.LIVEItems?.all?.[name]?.stats||{}).map(([key,value])=>`${ITEM_STAT_LABELS[key]||key} +${['as','crit'].includes(key)?Math.round(value*100)+'%':value}`).join(' · ');
const itemDetails=name=>`${name}\n${itemStats(name)}${ITEM_EFFECT_HINTS[name]?'\n고유 효과: '+ITEM_EFFECT_HINTS[name]+' (동일 장비 중복 장착 시 고유 효과는 1회만 적용)':''}`;
const iconHtml=name=>`<img src="${itemIcon(name)}" alt="" draggable="false" loading="lazy">`;
const canAcceptItems=(n=1)=>state.items.length+n<=12;
let itemSelectedIndex=null,itemTargetUid=null,itemGesture=null,itemSuppressClickUntil=0;
const itemWorkbench=$('m5-item-inventory');
function addItems(names,{silent=false}={}){
 if(!Array.isArray(names)||!names.every(n=>window.LIVEItems?.all?.[n])||!canAcceptItems(names.length))return false;
 state.items.push(...names);
 if(!silent)itemRender();return true;
}
function itemReport(msg){state.report=msg;itemRender();}
function setInventoryTarget(uid){const u=Number(uid);if(!Number.isInteger(u))return;window.M5Economy?.selectEquipmentTarget?.(u);}
function renderEquipment(owned,selectedUid){
 const targetSel=$('m5-item-target'),box=$('m5-item-equipped');if(!targetSel||!box)return;
 const units=Array.isArray(owned)?owned:[];
 if(selectedUid!=null&&units.some(o=>o.uid===Number(selectedUid)))itemTargetUid=Number(selectedUid);
 if(!units.some(o=>o.uid===itemTargetUid))itemTargetUid=(units.find(o=>o.location==='board')||units[0])?.uid||null;
 const previous=targetSel.value;
 targetSel.replaceChildren(...units.map(o=>{
  const el=document.createElement('option');el.value=o.uid;el.textContent=`${window.ERRoster?.byId?.[o.characterId]?.name||o.characterId} ${'★'.repeat(o.star)} · ${o.location==='board'?'전장':'벤치'}`;return el;
 }));
 targetSel.value=itemTargetUid==null?'':String(itemTargetUid);
 const unit=units.find(o=>o.uid===itemTargetUid),eq=unit?.equipment||[];
 box.innerHTML=[0,1,2].map(i=>eq[i]
 ?`<div class="m5-equip-slot m5-equip-filled" title="${itemDetails(eq[i]).replace(/"/g,'&quot;')}\n장착 후 임의 해제 불가 · 실험체 판매/성급 합성 시 반환">${iconHtml(eq[i])}<small>${eq[i]}</small></div>`
 :`<button type="button" class="m5-equip-slot" data-equip-drop="${i}" title="비어 있는 장비 슬롯 · 아이템을 여기에 드래그"><b>＋</b><small>${i+1} / 3</small></button>`).join('');
}
function itemRender(){
 const root=$('m5-item-inventory');if(!root)return;
 root.innerHTML=Array.from({length:12},(_,i)=>{
  const name=state.items[i];return name?
   `<button type="button" data-item-index="${i}" class="m5-item-placeholder m5-item-owned ${i===itemSelectedIndex?'m5-item-selected':''}" title="${itemDetails(name).replace(/"/g,'&quot;')}" aria-label="${name}">${iconHtml(name)}<small>${name}</small></button>`:
   `<div class="m5-item-placeholder m5-item-empty"><small>${String(i+1).padStart(2,'0')}</small></div>`;
 }).join('');
 $('m5-item-count').textContent=`${state.items.length}/12`;
 $('m5-item-notice').textContent=state.report;
 const sell=$('m5-item-sell'),equip=$('m5-item-equip');
 if(sell){sell.disabled=itemSelectedIndex==null||!state.items[itemSelectedIndex]||!window.M5Economy?.canModify?.();sell.textContent=state.items[itemSelectedIndex]?`선택 아이템 판매 · +${window.LIVEItems.all[state.items[itemSelectedIndex]].basic?2:5}C`:'선택 아이템 판매';}
 if(equip){equip.disabled=itemSelectedIndex==null||!state.items[itemSelectedIndex]||!itemTargetUid||!window.M5Economy?.canModify?.();}
 updateCraftHint();updateCodex();
}
function updateCraftHint(targetIndex=null){
 const el=$('m5-item-craft-hint');if(!el)return;
 const a=state.items[itemSelectedIndex],b=state.items[targetIndex],result=a&&b&&window.LIVEItems.craft(a,b);
 el.textContent=result?`${a} + ${b} → ${result}`:a?`${a} 선택 · 장착 버튼 / 아이템 간 드래그 조합 / 도감에서 재료 확인`:'아이템을 선택한 뒤 장착하거나, 기본 아이템 2개를 겹쳐 조합해.';
}
function equipItemAt(i,uid=itemTargetUid){
 const item=state.items[i];if(!item||uid==null)return false;
 const answer=window.M5Economy?.equip?.(uid,item);
 if(!answer?.ok){itemReport(answer?.message||'장착할 수 없어.');return false;}
 state.items.splice(i,1);itemSelectedIndex=null;itemReport(answer.message);return true;
}
function craftByIndex(a,b){
 if(a===b||!window.M5Economy?.canModify?.())return false;
 const name=window.LIVEItems?.craft?.(state.items[a],state.items[b]);if(!name)return false;
 const fromA=state.items[a],fromB=state.items[b];
 for(const i of [a,b].sort((x,y)=>y-x))state.items.splice(i,1);
 state.items.push(name);itemSelectedIndex=null;itemReport(`${fromA} + ${fromB} → ${name} 조합 완료`);return true;
}
function craftByNames(a,b){
 const i=state.items.indexOf(a);if(i<0)return false;
 const j=state.items.findIndex((v,k)=>k!==i&&v===b);if(j<0)return false;
 return craftByIndex(i,j);
}
function sellItemAt(i){
 if(!window.M5Economy?.canModify?.())return itemReport('준비 단계에서만 판매할 수 있어.');
 const name=state.items[i],entry=window.LIVEItems?.all?.[name];if(!entry)return false;
 if(!window.M5Economy.addCredits(entry.basic?2:5))return false;
 state.items.splice(i,1);itemSelectedIndex=null;itemReport(`${name} 판매 · +${entry.basic?2:5}C`);return true;
}
function updateCodex(){
 const root=$('m5-item-recipes');if(!root||$('m5-item-codex')?.hidden)return;
 const recipes=Object.values(window.LIVEItems?.all||{}).filter(e=>!e.basic);
 root.innerHTML=recipes.map(r=>{
  const [a,b]=r.materials||[],possible=a&&b&&(a===b?state.items.filter(x=>x===a).length>=2:state.items.includes(a)&&state.items.includes(b));
  return `<button type="button" data-craft-name="${r.name}" class="m5-recipe-card" ${possible&&!window.M5Economy?.canModify?.()?'disabled':''} title="${itemDetails(r.name).replace(/"/g,'&quot;')}">${iconHtml(r.name)}<span><strong>${r.name}</strong><small>${a} + ${b}</small><small>${itemStats(r.name)}</small></span><b>${possible?'제작':'재료 부족'}</b></button>`;
 }).join('');
}
function targetUidAt(x,y){
 const cell=window.LIVEM5?.cellFromClient?.(x,y);if(!cell)return null;
 return window.M5Economy?.getState?.()?.owned?.find(u=>u.location==='board'&&u.x===cell.x&&u.y===cell.y)?.uid||null;
}
const itemGhostRemove=()=>{itemGesture?.ghost?.remove();itemGesture=null;document.querySelectorAll('.m5-item-craft-target,.m5-item-equip-hover').forEach(n=>n.classList.remove('m5-item-craft-target','m5-item-equip-hover'));};
itemWorkbench?.addEventListener('pointerdown',e=>{
 const b=e.target.closest('[data-item-index]');if(!b||!window.M5Economy?.canModify?.()||(e.pointerType==='mouse'&&e.button!==0))return;
 const i=Number(b.dataset.itemIndex),name=state.items[i];if(!name)return;
 const ghost=document.createElement('div');ghost.className='m5-item-drag-ghost';ghost.innerHTML=iconHtml(name)+`<small>${name}</small>`;document.body.appendChild(ghost);ghost.style.left=e.clientX+'px';ghost.style.top=e.clientY+'px';
 itemGesture={pointerId:e.pointerId,i,name,x:e.clientX,y:e.clientY,moving:false,ghost};
 if(e.pointerType!=='mouse')e.preventDefault();
});
document.addEventListener('pointermove',e=>{
 const g=itemGesture;if(!g||e.pointerId!==g.pointerId)return;
 g.ghost.style.left=e.clientX+'px';g.ghost.style.top=e.clientY+'px';
 if(!g.moving&&Math.hypot(e.clientX-g.x,e.clientY-g.y)>5)g.moving=true;
 g.ghost.classList.toggle('m5-item-pending',!g.moving);
 if(!g.moving)return;
 e.preventDefault();
 document.querySelectorAll('.m5-item-craft-target,.m5-item-equip-hover').forEach(n=>n.classList.remove('m5-item-craft-target','m5-item-equip-hover'));
 const hit=document.elementFromPoint(e.clientX,e.clientY),target=hit?.closest?.('[data-item-index]');
 if(target&&Number(target.dataset.itemIndex)!==g.i){const ci=Number(target.dataset.itemIndex);if(window.LIVEItems.craft(g.name,state.items[ci])){target.classList.add('m5-item-craft-target');updateCraftHint(ci);}}
 else if(hit?.closest?.('#m5-item-equipped, [data-bench], #stage, #m5-item-target'))hit.closest('#m5-item-equipped, [data-bench], #stage, #m5-item-target').classList.add('m5-item-equip-hover');
},{passive:false});
document.addEventListener('pointerup',e=>{
 const g=itemGesture;if(!g||e.pointerId!==g.pointerId)return;
 const moving=g.moving;itemGhostRemove();if(!moving)return;
 itemSuppressClickUntil=performance.now()+300;
 const hit=document.elementFromPoint(e.clientX,e.clientY),target=hit?.closest?.('[data-item-index]');
 if(target&&Number(target.dataset.itemIndex)!==g.i&&craftByIndex(g.i,Number(target.dataset.itemIndex)))return;
 if(hit?.closest?.('#m5-item-sell')){sellItemAt(g.i);return;}
 const bench=hit?.closest?.('[data-bench]');
 const uid=bench?Number(bench.dataset.bench):hit?.closest?.('#m5-item-equipped,[data-equip-drop],[data-equip-uid],#m5-item-target')?itemTargetUid:targetUidAt(e.clientX,e.clientY);
 if(uid!=null){equipItemAt(g.i,uid);return;}
 updateCraftHint();
});
document.addEventListener('pointercancel',e=>{if(itemGesture?.pointerId===e.pointerId)itemGhostRemove()});
itemWorkbench?.addEventListener('click',e=>{
 if(performance.now()<itemSuppressClickUntil){e.preventDefault();return;}
 const b=e.target.closest('[data-item-index]');if(!b)return;const i=Number(b.dataset.itemIndex);
 if(itemSelectedIndex!==null&&itemSelectedIndex!==i&&craftByIndex(itemSelectedIndex,i))return;
 itemSelectedIndex=itemSelectedIndex===i?null:i;itemRender();
});
$('m5-item-equip')?.addEventListener('click',()=>{if(itemSelectedIndex!=null)equipItemAt(itemSelectedIndex)});
$('m5-item-sell')?.addEventListener('click',()=>{if(itemSelectedIndex!=null)sellItemAt(itemSelectedIndex)});
$('m5-item-equipped')?.addEventListener('click',e=>{if(e.target.closest('[data-equip-drop]')&&itemSelectedIndex!=null)equipItemAt(itemSelectedIndex)});
$('m5-item-target')?.addEventListener('change',e=>setInventoryTarget(e.target.value));
$('m5-codex-toggle')?.addEventListener('click',()=>{const root=$('m5-item-codex');root.hidden=!root.hidden;$('m5-codex-toggle').setAttribute('aria-expanded',String(!root.hidden));$('m5-codex-toggle').textContent=root.hidden?'조합 도감 ▸':'조합 도감 ▾';updateCodex()});
$('m5-item-recipes')?.addEventListener('click',e=>{
 const b=e.target.closest('[data-craft-name]');if(!b)return;
 const name=b.dataset.craftName,entry=window.LIVEItems.all[name];
 if(!craftByNames(...entry.materials))itemReport(`${name} · ${entry.materials.join(' + ')} 재료가 부족해.`);
});

function rewardFarm(round,dead){
 const basic=window.LIVEItems?.baseNames||[];let got=[],bonus=0,overflow=0;
 for(const animal of dead){const count=1+(Math.random()<.05?1:0);if(count===2)bonus++;
   for(let j=0;j<count;j++){const name=basic[Math.floor(Math.random()*basic.length)];if(!name)continue;
     if(!canAcceptItems(1)){overflow++;continue}state.items.push(name);got.push(name);
   }
 }
 state.report=`R${round} · 처치 ${dead.length}마리 · 보상 ${got.length}개${bonus?' (추가 드롭 '+bonus+'회)':''}${overflow?' · 가방 초과 '+overflow+'개 미획득':''}`;
 $('m5-farm-report').textContent=state.report;itemRender();return {got,bonus,overflow};
}
function resetItems(){state.items.length=0;itemSelectedIndex=null;state.report='인벤토리 초기화 완료';itemRender()}
$('m5-farm-r1')?.addEventListener('click',()=>{if(window.M5Online?.active?.()){alert('오프라인 시험 모드에서 이용해 줘.')}});
window.M5Systems=Object.freeze({renderSynergies,refreshSynergies,rewardFarm,resetItems,inventory:()=>[...state.items],canAcceptItems,addItems,renderEquipment,itemRender,craftByIndex,equipItemAt,preview:entries=>snapshotForPreview(entries)});
document.addEventListener('DOMContentLoaded',()=>{itemRender();refreshSynergies();const e=window.M5Economy?.getState?.();if(e)renderEquipment(e.owned,e.owned.find(o=>o.location==='board')?.uid||null)});
})();
