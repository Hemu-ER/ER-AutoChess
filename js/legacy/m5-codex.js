/* M5-14: M4 character skill descriptions reused without loading the M4 UI. */
(()=>{'use strict';
const skillInfo={
 hyunwoo:{active:['도그파이트','기본 공격 6회 후 다음 기본 공격 강화 + 체력 회복.'],passive:['허세','도그파이트 사용 후 2초간 방어력 증가 + 행동 불능 무시.']},
 adela:{active:['체크메이트','10초마다 0.5초 정신 집중 후 적 전체에 스킬 피해. 대상의 [폰] 중첩이 높을수록 강해짐. 집중 중 무적 + 행동 불능 면역.'],passive:['프로모션','기본 공격에 스킬 증폭 비례 추가 피해 + [폰] 1중첩(최대 3).']},
 dailin:{active:['만취','[취기] 100중첩 시 모두 소모. 3초간 공격 속도 +100% 및 기본 공격 추가 피해.'],passive:['취기','기본 공격마다 [취기] 5중첩. 매 10중첩마다 마지막 대상에게 추가 피해.']},
 yuki:{active:['머리치기!','기본 공격 5회 후 다음 기본 공격 강화 + 0.5초 행동 불능.'],passive:['옷매무새 정리','전투 시작 [단추] 2중첩. 기본 공격마다 단추를 소모해 추가 피해, 모두 소모하면 0.5초 집중 후 2중첩 회복.']},
 rio:{active:['정사필중','8초마다 0.5초 집중 후 가장 가까운 적에게 큰 공격력 비례 피해, 인접 적에게 절반 피해.'],passive:['카에유미','현재 공격 대상이 가까울수록 공격 속도 증가.']},
 justina:{active:['섬멸 포격','기본 공격 2회 후 현재 대상과 같은 열의 모든 적에게 스킬 증폭 비례 피해.'],passive:['부스트 대쉬','섬멸 포격 사용 후의 기본 공격에 스킬 증폭 비례 추가 피해.']},
 jenny:{active:['페르소나','기본 공격 2회 후 다음 기본 공격에 스킬 증폭 비례 추가 피해.'],passive:['죽음의 연기','사망 시 낮은 체력으로 부활하고 1.5초 무적 + 공격 속도 증가.']},
 nicky:{active:['다혈질','체력 50% 이하에서 스킬 증폭·공격력·공격 속도 증가.'],passive:['가드&카운터','확률적으로 기본 공격/스킬 피해를 크게 경감하고 공격자에게 스킬 증폭 비례 반격 피해.']},
 shurin:{active:['만검귀종','[결심응진] 3회 사용 후 인접한 모든 적에게 공격력 비례 피해. 이후 3초간 모든 기본 공격에 결심응진 적용.'],passive:['결심응진','기본 공격 3회 후 다음 기본 공격에 추가 피해 + 가한 피해의 절반 회복.']},
 marcus:{active:['지각변동','10초마다 적 전체에 공격력 비례 피해 + 행동 불능 + [충격].'],passive:['전사의 투지','[충격] 대상 기본 공격 시 충격 제거 + 추가 피해 + 0.5초 행동 불능.']},
 ian:{active:['해방','사망 시 체력을 회복하며 부활. [저항] 제거 후 공격력 120% 상태가 되고 공격 속도 증가 + 흡혈 획득.'],passive:['사로잡힌 육신','전투 시작 시 [저항] 상태로 공격력이 20% 감소.']},
 yumin:{active:['풍류운산','전투 시작 즉시 적 전체에 스킬 피해. 1초 후 적 전체 0.5초 행동 불능.'],passive:['선풍','기본 공격으로 [바람] 중첩. 바람 대상은 매초 피해를 받고 최대 중첩 대상 공격 시 추가 피해.']},
 'debi-marlene':{active:['트윈즈 러시','[레드]/[블루] 5중첩 소모 + 공격력 비례 피해 후 데비/마를렌 모드 전환.'],passive:['블루&레드','모드 전환 후 다음 5회 기본 공격에 적 현재 체력 비례 추가 피해.']},
 garnet:{active:['처형식','전투 시작 시 적 하나를 사슬로 묶어 행동 불능·방어력 감소·최대 체력 비례 피해. 일정 체력 이하에서 처형.'],passive:['익숙한 아픔','받는 기본 공격 피해 감소.']},
 kenneth:{active:['업화','[억압된 분노] 5중첩을 소모해 공격력×성급 계수 보호막 획득. 보호막과 함께 5초간 강화.'],passive:['억압된 분노','가한 피해 일부 회복. 기본 공격마다 1중첩(최대 5).']},
 irem:{active:['냥냥 펀치','[방울] 대상 공격 시 방울 제거 + 큰 스킬 피해. [물고기] 보유 시 함께 제거하고 보호막 획득.'],passive:['고양이의 습성','전투 시작 후 공격 속도 증가. 3초마다 [물고기], 기본 공격으로 적에게 [방울] 부여.']},
 laura:{active:['황혼의 도둑','주기적으로 적 전체에 스킬 증폭 비례 피해 + 행동 불능.'],passive:['괴도','기본 공격 후 [괴도]. 다음 기본 공격의 공격 속도 +100% 및 스킬 증폭 비례 추가 피해.']},
 bianca:{active:['진조의 군림','주기적으로 스킬 증폭 비례 피해 + 대상 최대 체력 비례 피해.'],passive:['짧은 안식','체력 50% 이하에서 전투당 1회 피해를 크게 줄이고 체력을 회복.']},
 cathy:{active:['이머전시OP','[치명적 외상] 대상의 외상을 제거해 최대 체력·스킬 증폭 비례 고정 피해 + 아군 회복.'],passive:['외과 전문의','공격 속도 감소 대신 후방 적 우선 공격. 기본 공격 2회마다 [치명적 외상]을 부여하고 이머전시OP를 발동.']},
 abigail:{active:['바이너리 스핀','기본 공격 3회 후 적 전체에 스킬 증폭 비례 피해.'],passive:['티어링 블레이드','기본 공격 적중 시 대상 방어력 감소.']},
 leny:{active:['스프링! 트랩','[당근! 바주카] 효과가 2회 적용된 뒤 다음 기본 공격에 추가 피해 + 행동 불능.'],passive:['당근! 바주카','3초마다 아군 전체에 [골트베르]. 레니 2칸 이내 아군이 기본 공격하면 중첩을 소모해 추가 피해 + 체력 회복.']},
 hart:{active:['Peacemaker','사망 피해를 받을 때 전투당 1회 체력 1로 버티며 즉시 불사 상태가 된다. 동시에 모든 실험체를 3초간 불사로 만들고 종료 직전 일부 회복.'],passive:['Feedback','기본 공격마다 공격력 비례 추가 피해 2회. 추가 피해는 기본 공격 판정이 아님.']},
 isol:{active:['Mok제 폭탄','10초마다 발동. 현재 구체 효과는 아직 미완성/QA 중.'],passive:['유격전','전투 시작 시 공격력·공격 속도 증가.']},
 chloe:{active:['생명 공유','클로에 또는 니나가 체력 5% 이하일 때 한쪽만 발동. 발동자는 불사, 받는 기본/스킬 피해 70%를 상대에게 전이. 생명줄인 상대가 죽으면 발동자도 사망. 동시에 조건 충족 시 클로에 우선.'],passive:['살아 있는 마리오네트','전투 시작 시 자기 진영의 안전한 빈 칸에 [니나] 소환. 니나는 독립적으로 이동·공격·피격하며 실험체 시너지/트리거에는 포함되지 않음.']},
 sua:{active:['오딧세이','4초마다 현재 대상과 같은 행의 모든 적에게 스킬 피해 + 입힌 피해 비례 회복.'],passive:['마음의 양식','모든 기본 공격에 스킬 증폭 비례 추가 피해 + 체력 회복.']},
 johann:{active:['구원의 성역','2칸 이내 아군 체력 45% 이하에서 전투당 1회. 4초간 방어력 증가 + 매초 최대 체력 20%와 요한 스킬 증폭에 비례해 대량 회복.'],passive:['빛의 가호','행동 불능 면역. 요한과 2칸 이내 아군의 공격 속도·공격력·스킬 증폭 증가.']},
 nadine:{active:['늑대 맹습','[야성] 15중첩 시 다음 기본 공격 3회에 공격력 비례 추가 피해.'],passive:['야성','매초 [야성]이 증가(최대 15). 중첩에 따라 공격 속도만 증가.']},
 bernice:{active:['레그샷','기본 공격 3회 후 공격 대상과 같은 열의 모든 적에게 공격력 비례 피해 + 공격 속도 감소.'],passive:['산탄','기본 공격은 공격력 90% 피해. 동시에 같은 열의 다른 적들에게 공격력 50% 산탄 피해.']},
 rozzi:{active:['셈텍스탄 Mk-II','기본 공격 5회 후 적 최대 체력 비례 추가 피해.'],passive:['더블샷','기본 공격 행동 1회에 실제 기본 공격 2회 수행.']},
 aya:{active:['공포탄','적이 인접하면 전투당 1회 적 전체에 스킬 피해 + 행동 불능.'],passive:['고정 사격','기본 공격 3회 후 다음 5회 기본 공격의 공격 속도 +100% 및 스킬 증폭 비례 추가 피해.']},
 mirka:{active:['크래시 해머','[리펄스 게이지] 100 이상에서 모두 소모해 체력 비례 보호막. 현재 대상과 인접 적에게 체력 비례 피해 + 행동 불능.'],passive:['리펄스 게이지','매초 +1, 자신의 HP 1% 감소마다 +2, 기본 공격마다 +5.']},
 charlotte:{active:['기적 실현','10초마다 아군 전체에게 1초 무적.'],passive:['치유의 빛','기본 공격 3회 후 자신과 2칸 이내 실험체를 회복하고 공격력·스킬 증폭 강화.']},
 nina:{active:['생명 공유','니나가 체력 5% 이하에서 발동 가능. 니나가 발동하면 니나가 불사 상태가 되고 받는 기본/스킬 피해 70%를 클로에에게 전이. 클로에 사망 시 니나도 사망.'],passive:['마리오네트','클로에가 소환하는 독립 기물. 직접 이동·기본 공격·피격 가능. 실험체가 아니므로 시너지 카운트와 실험체 전용 트리거에서 제외.']}
};
const $=id=>document.getElementById(id);
const dlg=$('m5-item-codex'), panel=$('m5-codex-content');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let tab='items';
const roster=()=>window.ERRoster?.roster?.filter(r=>!r.pveOnly)||[];
function cards(){
 if(tab==='characters')return roster().map(r=>{const a=skillInfo[r.id]||{},stats=r.baseStats||{};return {search:[r.name,r.role,...(r.affiliations||[]),...(a.active||[]),...(a.passive||[])].join(' '),html:`<article class="m5-codex-entry m5-codex-character"><img loading="lazy" src="assets/characters/${encodeURIComponent(r.id)}.png" alt=""><div><h4>${esc(r.name)} <small>${esc(r.cost)}C · ${esc(r.role)}</small></h4><p>${esc((r.affiliations||[]).join(' / '))}</p><p>HP ${esc(stats.hp)} · ATK ${esc(stats.atk)} · AMP ${esc(stats.amp)} · DEF ${esc(stats.def)} · AS ${esc(stats.as)}</p><b>ACTIVE · ${esc(a.active?.[0]||'정보 없음')}</b><p>${esc(a.active?.[1]||'')}</p><b>PASSIVE · ${esc(a.passive?.[0]||'정보 없음')}</b><p>${esc(a.passive?.[1]||'')}</p></div></article>`}});
 if(tab==='synergies')return (window.M5Systems?.codexSynergies?.()||[]).map(row=>({search:row.name+' '+row.stages.map(s=>s.detail).join(' '),html:`<article class="m5-codex-entry"><h4>${esc(row.name)}</h4>${row.stages.map(s=>`<p><b>${esc(s.label)}</b> ${esc(s.detail)}</p>`).join('')}</article>`}));
 return Object.entries(window.LIVEItems?.all||{}).map(([name,item])=>({search:name+' '+(item.materials||[]).join(' '),html:`<article class="m5-codex-entry"><h4>${esc(name)}</h4><p>${item.basic?'기본 재료':`조합: ${esc((item.materials||[]).join(' + '))}`}</p></article>`}));
}
function show(){const query=($('m5-codex-search')?.value||'').trim().toLocaleLowerCase('ko-KR'),found=cards().filter(c=>c.search.toLocaleLowerCase('ko-KR').includes(query));panel.innerHTML=found.map(c=>c.html).join('')||'<p>검색 결과가 없어.</p>';document.querySelectorAll('[data-m5-codex-tab]').forEach(b=>{b.classList.toggle('selected',b.dataset.m5CodexTab===tab);b.setAttribute('aria-selected',String(b.dataset.m5CodexTab===tab))});}
document.querySelectorAll('[data-m5-codex-tab]').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.m5CodexTab;show()}));
$('m5-codex-search')?.addEventListener('input',show);
$('m5-codex-toggle')?.addEventListener('click',()=>{tab='items';show()});
window.M5Codex={show};
})();
