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
 const teamA=entries.map(o=>({characterId:o.characterId,x:o.x,y:o.y,star:o.star,items:[]}));
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
function itemRender(){const root=$('m5-item-inventory');if(!root)return;root.replaceChildren();
 for(let i=0;i<12;i++){const name=state.items[i],box=document.createElement('div');if(name){box.className='m5-item-placeholder m5-item-owned';const b=document.createElement('strong');b.textContent=name;const sm=document.createElement('small');sm.textContent='기본';box.append(b,sm);box.title=name+' · 장착은 후속 패치';}else{box.className='m5-item-placeholder';const n=document.createElement('small');n.textContent=String(i+1).padStart(2,'0');box.appendChild(n)}root.appendChild(box)}
 $('m5-item-count').textContent=`${state.items.length}/12`;
 $('m5-item-notice').textContent=state.report;
}
function rewardFarm(round,dead){const basic=window.LIVEItems?.baseNames||[];let got=[],bonus=0,overflow=0;
 for(const animal of dead){const count=1+(Math.random()<.05?1:0);if(count===2)bonus++;for(let j=0;j<count;j++){
  const name=basic[Math.floor(Math.random()*basic.length)];if(!name)continue;
  if(state.items.length>=12){overflow++;continue}state.items.push(name);got.push(name);
 }}
 state.report=`R${round} · 처치 ${dead.length}마리 · 보상 ${got.length}개${bonus?' (추가 드롭 '+bonus+'회)':''}${overflow?' · 가방 초과 '+overflow+'개 미획득':''}`;
 $('m5-farm-report').textContent=state.report;
 itemRender();return {got,bonus,overflow};
}
function resetItems(){state.items.length=0;state.report='인벤토리 초기화 완료';itemRender()}
$('m5-item-inventory')?.addEventListener('click',e=>{const item=e.target.closest('.m5-item-owned');if(!item)return;item.title=item.title+' (장착 구현 예정)'});
$('m5-farm-r1')?.addEventListener('click',()=>{if(window.M5Online?.active?.()){alert('오프라인 시험 모드에서 이용해 줘.')}});
window.M5Systems=Object.freeze({renderSynergies,refreshSynergies,rewardFarm,resetItems,inventory:()=>[...state.items],preview:entries=>snapshotForPreview(entries)});
document.addEventListener('DOMContentLoaded',()=>{itemRender();refreshSynergies()});
})();
