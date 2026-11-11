'use strict';
// M9-07: server-authoritative augment selection + purple balance v1.0 registry.
// Gray, blue and purple all expose implemented combat/economy effects.
const crypto=require('node:crypto');
const {CARDS:PURPLE}=require('../shared/purple-cards.js');
const TIERS=Object.freeze(['gray','blue','purple']);
const LABELS=Object.freeze({gray:'회색',blue:'파랑',purple:'보라'});
const ROUNDS=Object.freeze([1,6,16]);
const DURATION_MS=30000;
const GRAY_ROWS=[
 ['G002','절약 정신','준비 종료 시 보유 5C 이하라면 다음 준비 단계에 +1C'],
 ['G004','예비 전력','PvP 패배 후 다음 준비 단계에서 무료 새로고침 1회'],
 ['G006','임기응변','행동불능 해제 시 잃은 체력의 12% 회복 (실험체별 전투당 1회)'],
 ['G009','선봉대','최초로 적에게 피해를 준 아군의 공격속도 +15%, 4초'],
 ['G010','최후의 방어선','아군이 마지막 1명 남으면 최대 HP 12% 보호막 (전투당 1회)'],
 ['G011','약점 포착','같은 적 3회 연속 공격 시 세 번째 피해 +15%'],
 ['G013','첫 손님','매 준비 단계 첫 실험체 구매 가격 1C 할인'],
 ['G014','마지막 한 푼','준비 종료 시 0~2C 보유하면 다음 준비 단계 +2C'],
 ['G015','충동구매','준비 단계에서 10C 이상 소비 시 다음 준비 단계 첫 상점 새로고침 무료'],
 ['G016','작은 이자','이자를 받은 준비 단계 2회마다 +1C'],
 ['G017','준비된 쇼핑','상점 잠금 후 다음 준비 단계에서 잠긴 상점의 첫 구매 1C 할인'],
 ['G018','현장 학습','PvP 첫 처치 시 숙련도 EXP +1 (전투당 1회)'],
 ['G019','성장의 보상','숙련도 레벨 상승 시 +2C (라운드당 1회)'],
 ['G020','꾸준한 훈련','숙련도 레벨 상승이 2라운드 연속 없으면 +2EXP'],
 ['G022','예비 부품','PvP에서 적 처치한 라운드마다 1스택, 3스택마다 기본 아이템 1개'],
 ['G023','선제 대응','아군을 최초 공격한 적이 전투 종료까지 받는 피해 +5%'],
 ['G024','복수의 표적','아군을 최초 처치한 적이 이후 받는 피해 +8%'],
 ['G025','추격의 박자','적 처치 시 처치자의 다음 기본 공격 50% 빨라짐'],
 ['G026','빈틈 포착','행동불능 상태인 적에게 첫 공격 피해 +15% (적당 전투 1회)'],
 ['G027','전열 유지','첫 아군 사망 시 남은 아군 최대 HP 5% 회복'],
 ['G028','응급 처치','아군 체력이 처음 30% 이하가 되면 최대 HP 10% 회복 (유닛별 1회)'],
 ['G029','불굴의 의지','행동불능 해제 시 최대 HP 5% 보호막, 3초 (유닛별 1회)'],
 ['G030','각개전투','세 행에 각각 아군 1명씩 배치 시 첫 5초 동안 피해 +8%'],
 ['G031','치명적 팀','팀 전체 치명타 확률 합계 90%p 이상이면 치명타 피해 +10%'],
 ['G032','약점 공략','적 체력을 처음 40% 이하로 내리면 그 적에게 다음 공격 피해 +12%'],
 ['G034','패배의 교훈','PvP 패배 시 숙련도 EXP +2'],
 ['G036','절호의 기회','상점에서 동일 실험체 2장 이상 등장하면 첫 구매 1C 할인'],
 ['G037','기회비용','준비 단계에서 크레딧 미사용 시 다음 준비 단계 +2C'],
 ['G039','긴급 정비','전투 5초 후 HP 비율이 가장 낮은 아군 최대 HP 8% 회복'],
 ['G040','집중 방어','같은 적에게 3회 공격받으면 피해 -8%, 3초 (유닛별 1회)'],
 ['G042','약자 보호','HP 30% 이하 아군이 다른 아군에게 회복받으면 회복량 +15%'],
 ['G043','빈틈없는 방어','최초 보호막 획득 아군이 보호막 유지 중 받는 피해 -5%'],
 ['G045','기습','전투 시작 후 아군별 첫 피해 +10%'],
 ['G047','양면 작전','1열과 3열에 아군이 각각 1명 이상이면 첫 4초 공속 +12%'],
 ['G050','방어구 파손','아군 기본 공격을 5회 적중당한 적의 방어력 -5, 3초'],
 ['G052','균형 잡힌 무장','서로 다른 완성 아이템 3개 장착한 유닛 최대 HP 6% 보호막, 5초'],
 ['G053','세 번째는 공짜','매 준비 단계 세 번째 유료 새로고침에서 1C 환급'],
 ['G054','알뜰한 저축','준비 종료 10C 이상 보유가 2회 연속이면 +2C'],
 ['G055','빠른 손절','매 준비 단계 첫 실험체 판매 +1C (같은 단계 구매한 개체 제외)'],
 ['G056','조립 수당','매 준비 단계 첫 완성 아이템 조합 시 +2C'],
 ['G058','승급 축하금','2성 합성마다 +2C, 3성 합성마다 +3C'],
 ['G059','연속 훈련','숙련도를 직접 구매한 준비 단계의 다음 PvP에서 첫 처치 시 +1EXP'],
 ['G060','한 발 더','기본 공격으로 적 처치 시 다음 기본 공격 피해 +15%'],
 ['G061','빈사 추격','HP 25% 이하 적을 처음 공격하면 공속 +15%, 3초 (유닛별 1회)'],
 ['G062','방해 공작','스킬 피해를 입은 적의 다음 회복량 -15%, 최대 5초'],
 ['G063','두 번째 기회','최초 보호막이 완전히 파괴된 아군 최대 HP 5% 회복'],
 ['G064','회복의 여파','아군 회복 시 피회복 아군의 다음 기본 공격 피해 +10%'],
 ['G065','견제 사격','원거리 아군 3회 연속 기본 공격 적중 시 적의 다음 기본 공격 피해 -20%'],
 ['G066','최후의 집중','마지막 생존 아군이 3초 동안 주는 피해 +10%'],
 ['G067','중앙 통제','중앙 칸에 배치된 유닛이 첫 5초 받는 피해 -8%'],
 ['G068','양옆의 호위','같은 행에 아군 3명 연속 배치하면 양 끝 최대 HP 8% 보호막, 4초'],
 ['G070','기초 장비 점검','완성 아이템을 1개 이상 장착한 유닛 첫 스킬 사용 후 HP 4% 회복'],
 ['G071','장비의 조화','서로 다른 완성 아이템 2개 이상 장착 시 첫 스킬 피해 +8%'],
 ['G072','치명타의 여운','치명타 적중 시 공속 +8%, 3초 (전투당 1회)']
];
const gray=GRAY_ROWS.map(([id,name,description])=>Object.freeze({id,name,description,tier:'gray',implemented:true,prototype:false}));
// Deliberately NOT designed augments: placeholders for M9-01 flow QA only.
const pending=tier=>Array.from({length:16},(_,i)=>Object.freeze({id:`M901_${tier.toUpperCase()}_${String(i+1).padStart(2,'0')}`,name:`${LABELS[tier]} 인퓨전 설계 대기 ${i+1}`,description:'M9-03/04에서 효과가 확정될 예정인 테스트 슬롯이야. 현재는 게임 능력에 아무 영향도 주지 않아.',tier,implemented:false,prototype:true}));
const BLUE_TARGETS=Object.freeze(["현우정신", "파자마", "바니걸", "수영복", "마츠리", "프리즌", "군악대", "새해", "악마사냥꾼", "메이드", "애증", "치유의 노래", "에레보스", "카페", "페르소나", "여행자", "고양이", "헌신", "피의 나선", "무기상인", "저격수", "사냥꾼", "검사", "리로드", "전사", "탱커", "원거리 평타", "원거리 스킬", "근거리 스킬", "암살자", "서포터"]);
// Unique battle effects have not been specified. Only shop-selection weighting is live.
const BLUE_NAMES=Object.freeze(["나 하나면 충분해", "달콤한 악몽", "잭팟 바니", "밀려오는 파도", "첫 불꽃", "교도소 폭동", "피날레", "새해 불꽃놀이", "악마 봉인", "청소 동선", "엇갈린 인연", "구원의 후렴", "암시장 장부", "애프터 서비스", "가면무도회", "길 위에서 배운 것", "내 영역이야!", "기꺼이 바치는 대가", "피의 폭풍", "공동 무장 개발", "후방 관통 사격", "전리품 수집", "일도양단", "장전 완료!", "전장의 맹세", "불침의 성채", "탄막 형성", "비전 공명", "격전지", "청부살인", "구조 신호"]);
const BLUE_DESCRIPTIONS=Object.freeze(["멧현우가 전열에 홀로 서면 첫 기본 공격 6회 피해 -20%, 도그파이트가 투지당 ATK 25% 추가 피해와 HP 3% 회복.", "수면 중 조기 기상하면 파자마 추가 피해 50%가 인접 적에게 전염; 자연 기상 시 공격속도 -25%, 2초.", "바니걸 추가 피해 발동마다 잭팟 +1(최대 3), 다음 기본 공격의 다른 적에게 45% 도탄.", "수영복 광역 파도 피해 시 물보라 4초. 표식 적의 다음 기본 공격 적중에 주변 적에게 피해 30% 도탄.", "첫 적 집중 처치 성공 시 마츠리 소속 수만큼 연속 불꽃 폭발(각 적응형 45%).", "프리즌 8중첩 구속 시 각 프리즌의 다음 공격에 적 최대 HP 3% 또는 적응형 70% 중 작은 추가 피해.", "군악대 회복 버프를 받고 적 3회 적중 시 HP 최저 아군에게 12% 보호막 4초(유닛별 8초).", "새해 버프 피격 소멸 시 근처 적 1명에게 적응형 능력치 65% 폭죽 피해.", "악마사냥꾼이 한 적에 3행동 피해를 주면 3초간 받는 피해 +10% 및 회복량 -35%.", "메이드 청소 200 완성 시 적 최후열 한 명에게 1초 미끄러짐 행동 불능, 대상별 8초 제한.", "아군 케네스 존재 시 상호 보호와 강화, 적 케네스 존재 시 가넷의 대 케네스 피해 및 처형 HP 기준 +5%p. 둘 다 중첩.", "샬럿 치유의 노래로 HP 최저 아군에 후렴. 치명상 시 전투당 1회 최대 HP 20%로 생존.", "아이템 판매 때 +1C, 에레보스 적응형 +2% 영구 성장(최대 10스택).", "카페 액티브 3회 또는 실효 회복 누적 달성 시 HP 최저 아군에 12% 중첩 보호막 1.5초, 유닛별 쿨타임 4초.", "페르소나 최대 공유 중첩에서 5초간 중후열 공격 피해 강화, 종료 후 공유 중첩 절반.", "실비아 탐험 스택당 공격속도 +5%; 10스택에서 스피드건 아군 회복을 전체로 확장.", "이렘 전중열 시작 시 인접 아군 초반 기본 공격 피해 -15%, 후열 시 첫 스킬 대상을 아군 공격으로 연계.", "아군 HP 35% 이하 시 헌신 실험체가 자기 HP 12% 희생해 HP 20% 회복. 팀 전투당 2회.", "피의 나선이 한 적만 맞히면 집중 피해, 여러 적을 맞히면 출혈 발생.", "다른 아군 완성 장비 한 개마다 헤이즈 스킬 피해 +10%, 아이템 개수 상한 없음.", "저격 포인트 배치 성공한 저격수의 기본 공격마다 가장 뒤쪽 적 1명에게 20% 관통 피해.", "PvP 표식 대상 사냥 성공마다 사냥꾼 ATK +3% 영구 누적(최대 8).", "검기 소모 공격에 인접 적 최대 2명까지 70% 피해; 검사 자신 피해 감소 10% 2초.", "리로드 속사 2회가 탄흔 대상에 적중할 때마다 최대 HP 4% 추가 스킬 피해.", "전사 첫 공격으로 결투 지정: 지정 적에게 받는 피해 -15%, 주는 스킬 피해 +20%.", "탱커 첫 피격 5회에 5초 동안 자신과 인접 아군 받는 피해 -12%.", "원거리 평타 4회마다 다른 적에 60% 탄막, 단일 적에는 35%.", "원거리 스킬 사용 시 공명 축적; 다음 스킬에서 다른 적에 적응형 60% 추가 피해.", "근거리 스킬 인접 적중 시 4초 격전지 생성: 받는 피해 -15%, 평타 추가 피해.", "암살자는 적 최후열 처형 계약: 첫 공격 +35%, 처치 시 HP 20% 회복(2회 제한).", "서포터 인접 아군이 HP 25% 이하일 때 해당 아군에 최대 HP 12% 보호막 3초, 서포터별 전투 1회."]);
const blue=BLUE_TARGETS.map((target,i)=>Object.freeze({id:'B'+String(i+1).padStart(3,'0'),name:BLUE_NAMES[i],description:BLUE_DESCRIPTIONS[i]+' · 관련 실험체 상점 가중치 ×1.5',tier:'blue',target,targetType:i<24?'affiliation':'role',implemented:true,uniqueEffectPending:false,prototype:false}));
const CARDS=Object.freeze({gray:Object.freeze(gray),blue:Object.freeze(blue),purple:PURPLE});
function drawTier(randomInt=crypto.randomInt){return TIERS[randomInt(3)]}
function sample(cards,n,randomInt=crypto.randomInt){if(cards.length<n)throw Error('인퓨전 후보 부족');const bag=[...cards];for(let i=0;i<n;i++){const j=i+randomInt(bag.length-i);[bag[i],bag[j]]=[bag[j],bag[i]]}return bag.slice(0,n)}
function drawOffers(tier,owned=[],exclude=[],randomInt=crypto.randomInt){const used=new Set([...owned,...exclude]);return sample(CARDS[tier].filter(c=>!used.has(c.id)),3,randomInt).map(c=>c.id)}
const byId=new Map(Object.values(CARDS).flat().map(card=>[card.id,card]));
function open(players,round,randomInt=crypto.randomInt){if(!ROUNDS.includes(round))throw Error('인퓨전 라운드가 아니야');const tier=drawTier(randomInt),offers={};for(const p of players)offers[p.slot]=drawOffers(tier,p.augments||[],[],randomInt);return {tier,round,offers,rerolls:{},picks:{},downloads:{},revision:1}}
function view(s,slot){return {tier:s.tier,round:s.round,offers:(s.offers[slot]||[]).map(id=>byId.get(id)),rerollsLeft:3-(s.rerolls[slot]||[]).length,rerollsUsed:s.rerolls[slot]||[],selected:s.picks[slot]?byId.get(s.picks[slot]):null,readyCount:Object.keys(s.picks).length,downloadReadyCount:Object.keys(s.downloads||{}).filter(k=>s.downloads[k]).length,downloadReady:!!s.downloads?.[slot],implementation:'1·2·3단계 인퓨전 실제 효과 적용'}}
function reroll(s,p,index,randomInt=crypto.randomInt){
 if(typeof index==='function'){randomInt=index;index=0} // old QA caller compatibility
 // Network requests must explicitly include the slot; undefined is invalid.
 if(s.picks[p.slot])throw Error('이미 인퓨전을 선택했어.');
 if(!s.offers[p.slot])throw Error('참가 후보가 없어.');
 if(!Number.isInteger(index)||index<0||index>2)throw Error('인퓨전 카드 위치 오류');
 const used=s.rerolls[p.slot]||[];
 if(used.includes(index))throw Error('이 카드의 새로고침을 이미 사용했어.');
 const blocked=new Set([...(p.augments||[]),...s.offers[p.slot]]);
 const next=sample(CARDS[s.tier].filter(c=>!blocked.has(c.id)),1,randomInt)[0];
 s.offers[p.slot][index]=next.id;
 s.rerolls[p.slot]=[...used,index];s.revision++;return view(s,p.slot);
}
function pick(s,p,choice){if(s.picks[p.slot])throw Error('이미 인퓨전을 선택했어.');const offers=s.offers[p.slot];if(!offers||!Number.isInteger(choice)||choice<0||choice>2)throw Error('잘못된 인퓨전 선택이야.');const id=offers[choice];if(!id||p.augments?.includes(id))throw Error('획득할 수 없는 인퓨전이야.');s.picks[p.slot]=id;p.augments??=[];p.augments.push(id);s.revision++;return byId.get(id)}
function autoPick(s,players,randomInt=crypto.randomInt){for(const p of players){if(!s.picks[p.slot]&&s.offers[p.slot])pick(s,p,randomInt(3))}}
function allChosen(s,players){return players.every(p=>!!s.picks[p.slot])}
function allDownloaded(s,players){return players.every(p=>!!s.downloads?.[p.slot])}
module.exports={TIERS,LABELS,ROUNDS,DURATION_MS,CARDS,BLUE_TARGETS,drawTier,drawOffers,open,view,reroll,pick,autoPick,allChosen,allDownloaded};
