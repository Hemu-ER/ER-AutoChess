"use strict";
const {roster,byId}=ERRoster;
const {CombatEngine,DT}=ERCombat;
const $=s=>document.querySelector(s),board=$("#board"),expandedMeters=new Set();
let teams={A:[],B:[]},battle=null,units=[],running=false,paused=false,time=0;
let speed=1,last=0,accumulator=0,frame=null;
const filters={A:{q:"",cost:"all",role:"all",aff:"all",status:"all"},B:{q:"",cost:"all",role:"all",aff:"all",status:"all"}};


const identityInfo={
 hyunwoo:{name:'현우',skin:'멧현우'},adela:{name:'아델라',skin:'꿈델라'},dailin:{name:'리 다이린',skin:'어흥 다이린'},yuki:{name:'유키',skin:'유키멍'},
 rio:{name:'리오',skin:'퍼펙트 샷 바니 리오'},justina:{name:'유스티나',skin:'럭키 히어로 바니 유스티나'},jenny:{name:'제니',skin:'럭셔리 바니 제니'},nicky:{name:'니키',skin:'언럭키 바니 니키'},
 shurin:{name:'슈린',skin:'벽파참랑 슈린'},marcus:{name:'마커스',skin:'해변의 전사 마커스'},ian:{name:'이안',skin:'도깨비불에 이끌린 이안'},yumin:{name:'유민',skin:'풍랑 위의 이정표 유민'},
 'debi-marlene':{name:'데비&마를렌',skin:'스파클링 트윈즈 데비&마를렌'},garnet:{name:'가넷',skin:'운명의 붉은 가약 가넷'},kenneth:{name:'케네스',skin:'운명의 푸른 가약 케네스'},irem:{name:'이렘',skin:'당신과 나의 네코마츠리 이렘'},
 laura:{name:'라우라',skin:'프리즌 브레이크 라우라'},bianca:{name:'비앙카',skin:'프리즌 키퍼 비앙카'},cathy:{name:'캐시',skin:'프리즌 브레이크 캐시'},abigail:{name:'아비게일',skin:'프리즌 키퍼 아비게일'},
 leny:{name:'레니',skin:'군악대 레니'},hart:{name:'하트',skin:'군악대 하트'},isol:{name:'아이솔',skin:'새해토끼 아이솔'},chloe:{name:'클로에',skin:'새해토끼 클로에'},sua:{name:'수아',skin:'새해의 이야기꾼 수아'},
 johann:{name:'요한',skin:'악마사냥꾼 요한'},nadine:{name:'나딘',skin:'악마사냥꾼 나딘'},bernice:{name:'버니스',skin:'악마사냥꾼 버니스'},rozzi:{name:'로지',skin:'하우스키퍼 로지'},aya:{name:'아야',skin:'하우스키퍼 아야'},mirka:{name:'미르카',skin:'와일드 메이드 미르카'},charlotte:{name:'샬럿',skin:'샬럿'},nina:{name:'니나',skin:'살아 있는 마리오네트'}
};
const displayName=r=>identityInfo[r?.id]?.name||r?.name||'?';
const skinName=r=>identityInfo[r?.id]?.skin||r?.name||'-';

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
 hart:{active:['Peacemaker','체력 5% 이하에서 전투당 1회. 모든 실험체를 3초간 불사로 만들고 종료 직전 일부 회복. 즉사 피해에는 발동하지 않음.'],passive:['Feedback','기본 공격마다 공격력 비례 추가 피해 2회. 추가 피해는 기본 공격 판정이 아님.']},
 isol:{active:['Mok제 폭탄','10초마다 발동. 현재 구체 효과는 아직 미완성/QA 중.'],passive:['유격전','전투 시작 시 공격력·공격 속도 증가.']},
 chloe:{active:['생명 공유','클로에 또는 니나가 체력 5% 이하일 때 한쪽만 발동. 발동자는 불사, 받는 기본/스킬 피해 70%를 상대에게 전이. 생명줄인 상대가 죽으면 발동자도 사망. 동시에 조건 충족 시 클로에 우선.'],passive:['살아 있는 마리오네트','전투 시작 시 자기 진영의 안전한 빈 칸에 [니나] 소환. 니나는 독립적으로 이동·공격·피격하며 실험체 시너지/트리거에는 포함되지 않음.']},
 sua:{active:['오딧세이','4초마다 현재 대상과 같은 행의 모든 적에게 스킬 피해 + 입힌 피해 비례 회복.'],passive:['마음의 양식','모든 기본 공격에 스킬 증폭 비례 추가 피해 + 체력 회복.']},
 johann:{active:['구원의 성역','2칸 이내 아군 체력 45% 이하에서 전투당 1회. 4초간 방어력 증가 + 매초 최대 체력 20%와 요한 스킬 증폭에 비례해 대량 회복.'],passive:['빛의 가호','행동 불능 면역. 요한과 2칸 이내 아군의 공격 속도·공격력·스킬 증폭 증가.']},
 nadine:{active:['늑대 맹습','[야성] 15중첩 시 다음 기본 공격 3회에 공격력 비례 추가 피해.'],passive:['야성','매초 [야성]이 증가(최대 15). 중첩에 따라 공격 속도만 증가.']},
 bernice:{active:['레그샷','기본 공격 3회 후 공격 대상과 같은 열의 모든 적에게 공격력 비례 피해 + 공격 속도 감소.'],passive:['산탄','기본 공격은 공격력 90% 피해. 동시에 같은 열의 다른 적들에게 공격력 50% 산탄 피해.']},
 rozzi:{active:['셈텍스탄 Mk-II','기본 공격 5회 후 적 최대 체력 비례 추가 피해.'],passive:['더블샷','기본 공격 행동 1회에 실제 기본 공격 2회 수행.']},
 aya:{active:['공포탄','적이 인접하면 전투당 1회 적 전체에 스킬 피해 + 행동 불능.'],passive:['고정 사격','기본 공격 3회 후 다음 5회 기본 공격의 공격 속도 +100% 및 스킬 증폭 비례 추가 피해.']},
 mirka:{active:['크래시 해머','[리펄스 게이지] 100 이상에서 모두 소모해 체력 비례 보호막. 현재 대상과 인접 적에게 체력 비례 피해 + 행동 불능.'],passive:['리펄스 게이지','매초 +1, 자신의 HP 1% 감소마다 +2, 기본 공격마다 +5.']},
 charlotte:{active:['기적 실현','15초마다 아군 전체에게 1.5초 무적.'],passive:['치유의 빛','기본 공격 3회 후 자신과 2칸 이내 실험체를 회복하고 공격력·스킬 증폭 강화.']},
 nina:{active:['생명 공유','니나가 체력 5% 이하에서 발동 가능. 니나가 발동하면 니나가 불사 상태가 되고 받는 기본/스킬 피해 70%를 클로에에게 전이. 클로에 사망 시 니나도 사망.'],passive:['마리오네트','클로에가 소환하는 독립 기물. 직접 이동·기본 공격·피격 가능. 실험체가 아니므로 시너지 카운트와 실험체 전용 트리거에서 제외.']}
};

function ensureInspector(){
 if(document.querySelector('#unitInspector'))return;
 const host=document.querySelector('.arena-card')||document.querySelector('main')||document.body;
 const el=document.createElement('section');el.id='unitInspector';el.className='unit-inspector empty';
 el.innerHTML='<div class="inspect-id"><span class="inspect-kicker">EXPERIMENTER DATA</span><b>실험체 정보</b><small>전장의 실험체에 커서를 올려봐.</small></div>';
 const boardShell=document.querySelector('.board-shell');
 if(boardShell&&boardShell.parentElement===host) boardShell.insertAdjacentElement('afterend',el); else host.appendChild(el);
}
function fmtStat(v,d=0){return Number.isFinite(+v)?(+v).toLocaleString('ko-KR',{maximumFractionDigits:d}):'-'}
function showInspector(u,rOverride=null){
 ensureInspector();const el=document.querySelector('#unitInspector');
 const r=rOverride||byId[u?.characterId]||{id:u?.characterId||'nina',name:u?.name||'니나',cost:'소환',role:u?.role||'소환수',affiliations:[],baseStats:{}};
 const info=skillInfo[r.id]||skillInfo[u?.characterId]||{active:['-','효과 정보 없음'],passive:['-','효과 정보 없음']};
 const bs=u?{hp:u.maxHp,atk:u.atk,amp:u.amp,def:u.def,as:u.as,range:u.range}:r.baseStats||{};
 const dname=displayName(r),sname=skinName(r);
 const star=u?.star||1,cost=r.id==='nina'?'소환수':`${r.cost} COST`;
 el.classList.remove('empty');
 el.innerHTML=`<div class="inspect-id"><span class="inspect-kicker">${esc(cost)} · ${esc(r.role||u?.role||'')}</span><b>${esc(dname)} <em>${'★'.repeat(star)}</em></b><small>스킨 · ${esc(sname)} · ${esc((r.affiliations||[]).join(' / ')||'소속 없음')}</small></div>
 <div class="inspect-skills"><article><span>ACTIVE</span><b>${esc(info.active[0])}</b><p>${esc(info.active[1])}</p></article><article><span>PASSIVE</span><b>${esc(info.passive[0])}</b><p>${esc(info.passive[1])}</p></article></div>
 <div class="inspect-stats"><span><i>HP</i><b>${fmtStat(bs.hp)}</b></span><span><i>ATK</i><b>${fmtStat(bs.atk,1)}</b></span><span><i>AMP</i><b>${fmtStat(bs.amp,1)}</b></span><span><i>DEF</i><b>${fmtStat(bs.def,1)}</b></span><span><i>AS</i><b>${fmtStat(bs.as,2)}</b></span><span><i>RNG</i><b>${fmtStat(bs.range)}</b></span></div>`;
}


function esc(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function config(seed=+$("#seed").value){return {teamA:teams.A,teamB:teams.B,masteryA:+$("#masteryA").value,masteryB:+$("#masteryB").value,seed,moveInterval:+$("#moveInterval").value}}
function showError(e){$("#status").textContent=e.message}
function statusLabel(r){return r.implemented?"SKILL READY":"SKILL PENDING"}
function unique(field){return [...new Set(roster.flatMap(r=>field==="aff"?r.affiliations:[r[field]]))]}

function reset(){
 if(frame!==null)cancelAnimationFrame(frame); frame=null;
 running=false;paused=false;accumulator=0;time=0;battle=null;
 $("#pause").textContent="Ⅱ 일시정지";$("#clock").textContent="0.0s";$("#log").innerHTML="";
 try{units=new CombatEngine(config()).getResult().units;$("#status").textContent="배치 단계"}catch(e){units=[];showError(e)}
 renderTeams();render();meters();
}

function rosterFiltered(team){
 const f=filters[team];
 return roster.filter(r=>{
  const text=(displayName(r)+" "+skinName(r)+" "+r.role+" "+r.affiliations.join(" ")).toLowerCase();
  return (!f.q||text.includes(f.q.toLowerCase())) &&
   (f.cost==="all"||r.cost===+f.cost) &&
   (f.role==="all"||r.role===f.role) &&
   (f.aff==="all"||r.affiliations.includes(f.aff)) &&
   (f.status==="all"||(f.status==="ready")===!!r.implemented);
 });
}
function selectOptions(values,current,allLabel){
 return `<option value="all">${allLabel}</option>`+values.map(v=>`<option value="${esc(v)}" ${String(current)===String(v)?"selected":""}>${esc(v)}</option>`).join("");
}
function teamSlot(team,e,i,disabled){
 const r=byId[e.characterId]||{id:e.characterId,name:e.characterId||"?",cost:"?",role:"소환수",affiliations:[],implemented:true,asset:{}};
 const portrait=r.asset?.sd
  ? `<img src="${esc(r.asset.sd)}" alt="" onerror="this.remove();this.parentElement.textContent='${esc(displayName(r).slice(0,1))}'">`
  : esc(displayName(r).slice(0,1));
 return `<div class="team-slot">
  <div class="slot-id"><span class="mini-portrait">${portrait}</span><div><b>${esc(displayName(r))}</b><small>${r.cost}C · ${esc(r.role)}</small></div></div>
  <label>별<select data-star="${i}" ${disabled}>${[1,2,3].map(v=>`<option value="${v}" ${v===e.star?"selected":""}>${v}★</option>`).join("")}</select></label>
  <label>깊이<select data-x="${i}" ${disabled}>${["후열","중열","전열"].map((v,j)=>`<option value="${j}" ${j===e.x?"selected":""}>${v}</option>`).join("")}</select></label>
  <label>라인<select data-y="${i}" ${disabled}>${["왼쪽","중앙","오른쪽"].map((v,j)=>`<option value="${j}" ${j===e.y?"selected":""}>${v}</option>`).join("")}</select></label>
  <button class="remove" data-remove="${i}" ${disabled}>×</button>
 </div>`;
}
function rosterCard(team,r){
 const used=teams[team].some(e=>e.characterId===r.id),full=teams[team].length>=3;
 const portrait=r.asset?.sd
  ? `<img src="${esc(r.asset.sd)}" alt="${esc(displayName(r))}" loading="lazy" onerror="this.remove();this.parentElement.innerHTML='<span>${esc(displayName(r).slice(0,1))}</span>'">`
  : `<span>${esc(displayName(r).slice(0,1))}</span>`;
 return `<button class="roster-card ${r.implemented?"ready":"pending"}" data-pick="${r.id}" ${running||used||full?"disabled":""}>
   <span class="portrait-placeholder" data-character="${r.id}">${portrait}</span>
   <span class="roster-info"><b>${esc(displayName(r))}</b><small>${r.cost}C · ${esc(r.role)}</small><small>${esc(r.affiliations.join(" / "))}</small></span>
   <span class="impl">${statusLabel(r)}</span>
 </button>`;
}
function synergySummary(team){
 const rs=teams[team].map(e=>byId[e.characterId]).filter(Boolean),count=n=>rs.filter(r=>Array.isArray(r.affiliations)&&r.affiliations.includes(n)).length;
 const live=battle?.getResult?.().synergies?.[team], names=["파자마","바니걸","수영복","마츠리","프리즌","군악대","새해","악마사냥꾼","메이드","애증","치유의 노래","에레보스"];
 const parts=names.map(n=>{const c=count(n);if(!c)return"";let tier=live?.affiliations?.[n]?.tier??((n==="군악대"||n==="새해")?c:(n==="애증"||n==="치유의 노래")?1:c>=3?3:c>=2?2:0);let label=n==="에레보스"?`${n} · 효과 미정`:tier?`${n} ${tier}단계 ON`:`${n} ${c} · 미발동`;return `<span class="${tier?"synergy-on":"synergy-off"}">${label}</span>`}).filter(Boolean);
 const roles=live?.roles||rs.map((r,i)=>({name:r.name,role:r.role,active:null}));
 return `<div class="synergy-strip">${parts.length?parts.join(""):"<em>소속 없음</em>"}<i></i>${roles.map(x=>`<span class="role-chip ${x.active===false?"synergy-off":""}">${esc(x.role)}${x.active===true?" ON":x.active===false?" OFF":""}</span>`).join("")}</div>`
}
function renderTeams(){
 for(const team of ["A","B"]){
  const panel=$("#team"+team),f=filters[team],disabled=running?"disabled":"";
  panel.innerHTML=`<div class="team-head"><div><span>TEAM ${team}</span><h2>${team==="A"?"ALLY":"ENEMY"} SQUAD</h2></div><strong>${teams[team].length}/3</strong></div>
   <div class="selected-squad">${teams[team].length?teams[team].map((e,i)=>teamSlot(team,e,i,disabled)).join(""):`<div class="empty-squad">실험체를 선택해 팀을 편성해.</div>`}</div>${synergySummary(team)}
   <div class="roster-tools">
    <input class="search" data-filter="q" value="${esc(f.q)}" placeholder="이름 / 역할 / 소속 검색">
    <select data-filter="cost">${selectOptions([1,2,3],f.cost,"코스트 전체")}</select>
    <select data-filter="role">${selectOptions(unique("role"),f.role,"역할 전체")}</select>
    <select data-filter="aff">${selectOptions(unique("aff"),f.aff,"소속 전체")}</select>
    <select data-filter="status">${selectOptions(["ready","pending"],f.status,"구현 상태 전체").replace(">ready<",">스킬 구현<").replace(">pending<",">스킬 미구현<")}</select>
   </div>
   <div class="roster-grid">${rosterFiltered(team).map(r=>rosterCard(team,r)).join("")}</div>`;
  panel.querySelectorAll("[data-filter]").forEach(el=>el.onchange=el.oninput=()=>{filters[team][el.dataset.filter]=el.value;renderTeams()});
  panel.querySelectorAll("[data-pick]").forEach(b=>{const r=byId[b.dataset.pick];b.onmouseenter=()=>showInspector(null,r);b.onfocus=()=>showInspector(null,r)});
  panel.querySelectorAll("[data-pick]").forEach(b=>b.onclick=()=>{
   if(running||teams[team].length>=3)return;
   const id=b.dataset.pick;if(teams[team].some(e=>e.characterId===id))return;
   const pos=[2,1,0].flatMap(x=>[0,1,2].map(y=>({x,y}))).find(p=>!teams[team].some(e=>e.x===p.x&&e.y===p.y));
   teams[team].push({characterId:id,star:2,...pos});reset();
  });
  panel.querySelectorAll("[data-remove]").forEach(b=>b.onclick=()=>{if(!running){teams[team].splice(+b.dataset.remove,1);reset()}});
  for(const field of ["star","x","y"])panel.querySelectorAll(`[data-${field}]`).forEach(s=>s.onchange=()=>{
   if(running)return;
   const i=+s.dataset[field],updated={...teams[team][i],[field]:+s.value};
   if(teams[team].some((e,j)=>j!==i&&e.x===updated.x&&e.y===updated.y)){renderTeams();showError(new Error("이미 사용 중인 배치 칸입니다."));return}
   teams[team][i]=updated;reset();
  });
 }
 for(const id of ["masteryA","masteryB","moveInterval","seed","fixedSeed","batch"])$("#"+id).disabled=running;
}

function buildBoard(){
 board.innerHTML="";
 for(let y=0;y<3;y++)for(let x=0;x<6;x++){
  const c=document.createElement("div");
  c.className="cell "+(x<3?"teamA":"teamB")+(x===3?" divider":"");
  c.dataset.x=x;c.dataset.y=y;
  c.innerHTML=`<span class="coord">${x<3?"A":"B"} ${["왼","중앙","오른"][y]} · ${["후열","중열","전열","전열","중열","후열"][x]}</span>`;
  c.ondragover=e=>e.preventDefault();c.ondrop=e=>drop(e,c);board.appendChild(c);
 }
}
function drop(e,c){
 e.preventDefault();if(running||battle)return;
 const u=units.find(u=>u.id===e.dataTransfer.getData("text/plain"));if(!u)return;
 const globalX=+c.dataset.x,y=+c.dataset.y;if((u.team==="A"&&globalX>2)||(u.team==="B"&&globalX<3))return;
 const x=u.team==="A"?globalX:5-globalX,entry=teams[u.team].find(e=>e.characterId===u.characterId);
 const occupied=teams[u.team].find(e=>e!==entry&&e.x===x&&e.y===y);
 if(occupied){const ox=entry.x,oy=entry.y;Object.assign(entry,{x,y});Object.assign(occupied,{x:ox,y:oy});}
 else Object.assign(entry,{x,y});
 reset();
}
function unitMarkup(u){
 const r=byId[u.characterId]||{name:u.name,role:u.role,implemented:true,asset:{}},hp=Math.max(0,u.hp/u.maxHp*100),low=hp<=30,shield=Math.max(0,u.skill?.shield||0),shieldPct=Math.min(Math.max(0,100-hp),shield/u.maxHp*100);
 const visual=r.asset?.sd
  ? `<img class="sd-image" src="${esc(r.asset.sd)}" alt="${esc(u.name)}" draggable="false" onerror="this.remove();this.parentElement.innerHTML='<div class=\\'sd-silhouette\\'><span>${esc(u.name.slice(0,1))}</span></div>'">`
  : `<div class="sd-silhouette"><span>${esc(u.name.slice(0,1))}</span></div>`;
 return `<div class="ground-ring"></div>
  <div class="sd-slot" data-asset="${esc(r.asset?.sd||"")}">${visual}</div>
  <div class="target-marker"></div><div class="hit-vfx"></div><div class="skill-vfx"></div>
  <div class="unit-hud">
   <div class="unit-top"><span class="unit-name">${esc(displayName(r))}</span><span class="stars">${"★".repeat(u.star)}</span></div>
   <div class="hpbar ${low?"low":""}" title="${shield>0?`HP ${Math.ceil(u.hp)} / ${Math.ceil(u.maxHp)} · 보호막 ${Math.ceil(shield)}`:`HP ${Math.ceil(u.hp)} / ${Math.ceil(u.maxHp)}`}"><i style="width:${hp}%"></i>${shield>0?`<em class="shield-overlay" style="left:${hp}%;width:${shieldPct}%"></em>`:""}</div>
   <div class="unit-sub"><span>${shield>0?`${u.role} · 보호막 ${Math.ceil(shield)}`:u.role}</span><span>${Math.ceil(u.hp)} / ${Math.ceil(u.maxHp)}</span></div>
   ${!r.implemented?`<span class="pending-tag">SKILL PENDING</span>`:""}
  </div>`;
}
function render(){
 board.querySelectorAll(".unit").forEach(e=>e.remove());
 for(const u of units){
  const cell=board.querySelector(`[data-x="${u.x}"][data-y="${u.y}"]`);if(!cell)continue;
  const e=document.createElement("div");
  e.className=`unit ${u.team}${u.dead?" dead":""}${u.ccUntil>time?" cc":""}`;
  e.draggable=!running&&!battle;e.dataset.id=u.id;e.innerHTML=unitMarkup(u);
  e.ondragstart=event=>event.dataTransfer.setData("text/plain",u.id);e.onmouseenter=()=>showInspector(u);e.onfocus=()=>showInspector(u);e.tabIndex=0;cell.appendChild(e);
 }
}
function damageDetails(u){
 const row=(label,s)=>`<tr><th>${esc(label)}</th><td>${s.activations}회</td><td>${s.hits}회</td><td>${s.raw.toLocaleString("ko-KR",{maximumFractionDigits:1})}</td><td>${s.dealt.toLocaleString("ko-KR",{maximumFractionDigits:1})}</td></tr>`;
 const targetLabel=id=>{const r=byId[id];return r?displayName(r):id};
 const rows=Object.entries(u.damageSources).map(([name,s])=>row(name,s)+Object.entries(s.targets||{}).map(([id,t])=>row("↳ "+targetLabel(id),t)).join("")).join("");
 return `<div class="source-scroll"><table class="source-table"><caption>${esc(u.name)} — 준 피해 ${Object.values(u.damage).reduce((a,b)=>a+b,0).toFixed(1)} · 받은 피해 ${(u.damageTaken||0).toFixed(1)} · 회복량 ${(u.healingDone||0).toFixed(1)} · 받은 회복 ${(u.healingReceived||0).toFixed(1)}</caption><thead><tr><th>피해 출처 / 피격 대상</th><th>발동</th><th>적중</th><th>Raw</th><th>실제</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function meters(){
 for(const team of ["A","B"]){
  const root=$("#meter"+team),arr=units.filter(u=>u.team===team),max=Math.max(1,...arr.map(u=>Object.values(u.damage).reduce((a,b)=>a+b,0)));
  root.innerHTML=arr.map(u=>{const total=Object.values(u.damage).reduce((a,b)=>a+b,0),open=expandedMeters.has(u.id),id=esc(u.id);return `<div class="meter-row"><button class="meter-toggle" data-unit="${id}">${esc(displayName(byId[u.characterId]||{id:u.characterId,name:u.name}))} <span>${open?"접기":"상세"}</span></button><div class="meter-track"><div class="meter-fill" style="width:${total/max*100}%"></div></div><span class="meter-numbers"><b>${total.toFixed(0)}</b><small>받은 피해 ${(u.damageTaken||0).toFixed(0)} · 회복 ${(u.healingDone||0).toFixed(0)} · 받은 회복 ${(u.healingReceived||0).toFixed(0)}${u.shieldAbsorbed>0?` · 흡수 ${u.shieldAbsorbed.toFixed(0)}`:''}</small></span></div><div ${open?"":"hidden"}>${damageDetails(u)}</div>`}).join("");
  root.onclick=e=>{const b=e.target.closest("button[data-unit]");if(!b)return;const id=b.dataset.unit;expandedMeters.has(id)?expandedMeters.delete(id):expandedMeters.add(id);meters()};
 }
}
function sync(){
 const result=battle.getResult();units=result.units;time=result.time;
 for(const event of battle.drainEvents())if(event.type==="log"){const line=document.createElement("div");line.innerHTML=`[${event.time.toFixed(1)}] ${event.message}`;$("#log").prepend(line)}
 $("#clock").textContent=time.toFixed(1)+"s";
 if(result.battleOver){running=false;$("#status").textContent=result.outcome;renderTeams()}
 render();meters();
}
function start(){
 if(running)return true;
 try{reset();const seed=$("#fixedSeed").checked?+$("#seed").value:Math.floor(Math.random()*2147483647);battle=new CombatEngine(config(seed));battle.start();running=true;paused=false;$("#status").textContent=`전투 중 · seed ${seed}`;renderTeams();sync();last=performance.now();frame=requestAnimationFrame(loop);return true}catch(e){battle=null;showError(e);return false}
}
function loop(now){
 if(!running){frame=null;return}
 const elapsed=Math.min(.15,(now-last)/1000)*speed;last=now;
 if(!paused){accumulator+=elapsed;while(accumulator+1e-9>=DT&&running){battle.step();accumulator-=DT;if(battle.getResult().battleOver)break}sync()}
 frame=running?requestAnimationFrame(loop):null;
}
function batch(){try{const counts={"A팀 승리":0,"B팀 승리":0,"무승부":0},base=+$("#seed").value;for(let i=0;i<100;i++)counts[new CombatEngine(config(base+i)).run().outcome]++;$("#batchResult").textContent=`A팀 ${counts["A팀 승리"]}% · B팀 ${counts["B팀 승리"]}% · 무승부 ${counts["무승부"]}%`}catch(e){showError(e)}}
$("#start").onclick=start;$("#pause").onclick=()=>{if(!running)return;paused=!paused;$("#pause").textContent=paused?"▶ 재개":"Ⅱ 일시정지"};
$("#step").onclick=()=>{if(!running&&!start())return;paused=true;$("#pause").textContent="▶ 재개";battle.step();battle.step();sync()};
$("#reset").onclick=reset;$("#speed").onchange=e=>speed=+e.target.value;$("#batch").onclick=batch;
for(const id of ["masteryA","masteryB","moveInterval","seed"])$("#"+id).onchange=reset;
buildBoard();ensureInspector();reset();
