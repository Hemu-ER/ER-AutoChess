"use strict";
const {roster,byId}=ERRoster;
const {CombatEngine,DT,coefficients:combatCoefficients={}}=ERCombat;
const $=s=>document.querySelector(s),board=$("#board"),expandedMeters=new Set(),expandedSkillDetails=new Set();
let teams={A:[],B:[]},battle=null,units=[],running=false,paused=false,time=0;
let speed=1,last=0,accumulator=0,frame=null;
let appMode=null; // null=start, "game"=실제 게임 화면, "test"=전투 테스트

// Round Mode v1: 기존 전투 테스트 모드와 분리된 1판 루프.
const ROUND_PREP_SECONDS=30, ROUND_RESULT_SECONDS=4, PLAYER_START_HP=100;
let roundTimer=null;
const roundState={active:false,phase:"idle",round:1,hp:{A:PLAYER_START_HP,B:PLAYER_START_HP},remaining:ROUND_PREP_SECONDS,lastOutcome:"",lastDamage:0};
const gameState={credits:0,shop:[],shopLocked:false,owned:[],items:[],nextOwnedId:1,message:"",roundIncome:5,masteryLevel:1,masteryProgress:0};
const GAME_TEMP={startCredits:5,rerollCost:2,shopSize:5,benchSize:8,masteryProgressMax:3,masteryInvestCost:4};
const alphaBoundsCache=new Map();
let ownedPointerDrag=null;
let shopDockCollapsed=false;
const BASIC_ITEMS=["철판","가죽","배터리","옷감","고철","오일"];
const playableRoster=()=>roster.filter(r=>!r.pveOnly&&r.cost>=1&&r.cost<=3);
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



// 전투 엔진의 실제 계수표를 그대로 읽어 상세 툴팁에 표시한다.
// 값이 바뀌면 combat-engine.js만 고쳐도 상세 수치가 같이 따라가도록 한 곳에서 관리한다.
const coefficientLabels={
 dog:['도그파이트 피해','ATK','ratio'],heal:['회복','최대 HP','ratio'],bluffDef:['허세 방어력','DEF','flat'],
 check:['체크메이트 기본 피해','AMP','ratio'],pawn:['폰 1중첩 추가','AMP','ratio'],promotion:['프로모션 추가 피해','AMP','ratio'],
 drunk:['만취 추가 피해','ATK','ratio'],ten:['취기 10중첩 추가 피해','ATK','ratio'],entry:['진입 피해','ATK','ratio'],
 head:['머리치기 피해','ATK','ratio'],button:['단추 추가 피해','ATK','ratio'],shot:['정사필중 피해','ATK','ratio'],kaeyumiMax:['카에유미 최대 공속','AS','percent'],
 bomb:['스킬 피해','주스탯','ratio'],boost:['부스트 대쉬 추가 피해','AMP','ratio'],persona:['페르소나 추가 피해','AMP','ratio'],revive:['부활 체력','최대 HP','ratio'],reviveAs:['부활 공격속도','AS','percent'],
 hot:['다혈질 능력치 증가','ATK/AMP/AS','percent'],guardChance:['가드 확률','확률','percent'],counter:['카운터 피해','AMP','ratio'],
 aoe:['만검귀종 광역 피해','ATK','ratio'],resolve:['결심응진 추가 피해','ATK','ratio'],quake:['지각변동 피해','ATK','ratio'],shock:['충격 추가 피해','ATK','ratio'],
 lifesteal:['회복 비율','가한 피해','percent'],start:['전투 시작 효과','주스탯','ratio'],windDot:['바람 지속 피해','AMP','ratio'],windExtra:['바람 추가 피해','AMP','ratio'],
 rush:['트윈즈 러시 피해','ATK','ratio'],currentHp:['모드 추가 피해','대상 현재 HP','percent'],chain:['처형식 피해','대상 최대 HP','percent'],basicReduce:['기본 공격 피해 감소','피해','percent'],execute:['처형 기준','대상 최대 HP','percent'],
 shield:['보호막','주스탯/최대 HP','ratio'],rage:['업화 강화','능력치','percent'],punch:['냥냥 펀치 피해','AMP','ratio'],fishShield:['물고기 보호막','AMP','ratio'],
 twilight:['황혼의 도둑 피해','AMP','ratio'],thief:['괴도 추가 피해','AMP','ratio'],dominion:['진조의 군림 피해','AMP','ratio'],maxHp:['최대 체력 비례 피해','대상 최대 HP','percent'],
 op:['이머전시OP 피해','AMP','ratio'],teamHeal:['아군 회복','최대 HP','percent'],spin:['바이너리 스핀 피해','AMP','ratio'],shred:['방어력 감소','DEF','percent'],
 trap:['스프링! 트랩 피해','AMP','ratio'],goldberg:['당근! 바주카 피해/회복','AMP','ratio'],peacemakerHeal:['Peacemaker 회복','최대 HP','percent'],feedback:['Feedback 추가 피해','ATK','ratio'],
 ninaHp:['니나 체력','클로에 HP','percent'],ninaAtk:['니나 공격력','클로에 ATK','percent'],ninaDef:['니나 방어력','클로에 DEF','percent'],ninaAs:['니나 공격속도','클로에 AS','percent'],
 odyssey:['오딧세이 피해','AMP','ratio'],mind:['마음의 양식 추가 피해','AMP','ratio'],sanctuaryDef:['구원의 성역 방어력','DEF','flat'],sanctuaryHp:['성역 틱 회복','대상 최대 HP','percent'],sanctuaryAmp:['성역 틱 추가 회복','요한 AMP','ratio'],aura:['빛의 가호 증가','ATK/AMP/AS','percent'],
 wild:['야성 1중첩 공속','AS','percent'],wolf:['늑대 맹습 추가 피해','ATK','ratio'],pellet:['산탄 주 대상 피해','ATK','ratio'],scatter:['산탄 주변 피해','ATK','ratio'],leg:['레그샷 피해','ATK','ratio'],
 semtex:['셈텍스탄 피해','대상 최대 HP','percent'],double:['더블샷 1타 피해','ATK','ratio'],fear:['공포탄 피해','AMP','ratio'],fixed:['고정 사격 추가 피해','AMP','ratio'],crash:['크래시 해머 피해','최대 HP','percent'],
 buff:['치유의 빛 공격 버프','ATK/AMP','percent']
};
const coefficientLabelOverrides={
 'charlotte.heal':['치유의 빛 회복','AMP','ratio'],'kenneth.shield':['업화 보호막','ATK','ratio'],'irem.fishShield':['물고기 보호막','AMP','ratio'],'mirka.shield':['크래시 해머 보호막','최대 HP','percent'],
 'isol.start':['유격전 ATK/AS 증가','ATK/AS','percent'],'yumin.start':['풍류운산 피해','AMP','ratio'],'justina.bomb':['섬멸 포격 피해','AMP','ratio'],'isol.bomb':['Mok제 폭탄 피해','ATK','ratio'],
 'chloe.ninaAs':['니나 공격속도','클로에 AS','percent'],'sua.heal':['마음의 양식 회복','최대 HP','percent'],'hyunwoo.heal':['도그파이트 회복','최대 HP','percent']
};
const characterDetailExtras={
 hyunwoo:['도그파이트: 기본 공격 6회 후 발동','허세 지속시간: 2초'],adela:['체크메이트: 10초 주기 · 0.5초 집중','폰 최대 3중첩'],dailin:['취기: 기본 공격당 +5 · 100에서 만취','만취 지속시간: 3초 · 공격속도 +100%'],yuki:['머리치기: 기본 공격 5회 후','단추: 전투 시작 2개 · 0.5초 집중 후 복구'],rio:['정사필중: 8초 주기 · 0.5초 집중','인접 적 피해: 주 대상의 50%'],justina:['섬멸 포격: 기본 공격 2회 후'],jenny:['페르소나: 기본 공격 2회 후 다음 타격','죽음의 연기 무적: 1.5초'],nicky:['다혈질: HP 50% 이하','가드 피해 경감: 80%'],shurin:['결심응진: 기본 공격 3회마다','만검귀종 후 강화 지속: 3초'],marcus:['지각변동: 10초 주기','충격 행동 불능: 0.5초'],ian:['해방: 사망 시 1회','해방 전 공격력: -20% · 해방 후 공격력: 120%'],yumin:['풍류운산: 전투 시작 즉시','행동 불능: 1초 후 0.5초'],
 'debi-marlene':['트윈즈 러시: 전투 시작 즉시 + 모드 5중첩 소모','모드 전환 후 강화 기본 공격: 5회'],garnet:['처형식: 전투 시작 1회','행동 불능: 1초 · 방어력 감소 10%'],kenneth:['억압된 분노: 기본 공격당 +1, 최대 5','업화 강화 지속: 5초'],irem:['물고기: 3초마다 획득','방울 대상 공격 시 냥냥 펀치'],laura:['황혼의 도둑: 10초 주기','행동 불능: 1초'],bianca:['진조의 군림: 8초 주기'],cathy:['외과 전문의: 기본 공격 2회마다 외상+OP','OP 피해: 고정 피해'],abigail:['바이너리 스핀: 기본 공격 3회 후'],leny:['골트베르: 3초마다 아군 전체 부여','효과 소비: 레니 2칸 이내 아군 기본 공격','2회 적용 후 다음 레니 기본 공격에 트랩 · CC 0.5초'],hart:['Peacemaker: 사망 피해 시 체력 1 · 전투당 1회','하트 포함 전체 실험체 불사: 3초 · 종료 직전 전체 회복'],isol:['Mok제 폭탄: 10초 주기'],chloe:['생명 공유 기준: HP 5% 이하','피해 전이: 기본/스킬 피해 70%'],sua:['오딧세이: 4초 주기'],johann:['구원의 성역: 2칸 이내 아군 HP 45% 이하 · 전투당 1회','지속: 4초 · 1초마다 회복','요한: 행동 불능 면역'],nadine:['야성: 매초 +2 · 최대 15','15중첩에서 늑대 맹습 · 다음 기본 공격 3회','야성은 공격속도만 증가'],bernice:['레그샷: 기본 공격 3회마다','공격속도 감소: 30% · 3초'],rozzi:['더블샷: 공격 행동당 실제 기본 공격 2회','셈텍스탄: 실제 기본 공격 10회마다'],aya:['공포탄: 인접 적 존재 시 전투당 1회 · CC 0.5초','고정 사격: 기본 공격 3회 후 다음 5회 · AS +100%'],mirka:['리펄스: 초당 +1 · HP 1% 손실당 +2 · 기본 공격당 +5','100 이상에서 크래시 해머 · CC 1초'],charlotte:['치유의 빛: 기본 공격 3회마다 · 자신 포함 2칸 이내','공격 버프 지속: 3초','기적 실현: 10초마다 아군 전체 1초 무적','치유의 노래: 치유의 빛 발동 시 아군 전체 AMP 70% 회복']
};
function fmtCoeff(v,type){if(type==='flat')return fmtStat(v,1);return `${fmtStat(v*100,1)}%`}
function coefficientDetailHtml(id,star){
 const table=combatCoefficients[id]||{},rows=[];
 for(const [key,vals] of Object.entries(table)){
  const meta=coefficientLabelOverrides[`${id}.${key}`]||coefficientLabels[key]||[key,'','ratio'];
  const arr=Array.isArray(vals)?vals:[vals,vals,vals];
  rows.push(`<div class="skill-coeff-row"><b>${esc(meta[0])}</b><span>${meta[1]?esc(meta[1])+' · ':''}${arr.map((v,i)=>`<em class="${i===star-1?'current-star':''}">★${i+1} ${fmtCoeff(v,meta[2])}</em>`).join(' / ')}</span></div>`);
 }
 const extras=characterDetailExtras[id]||[];
 return `<div class="skill-detail-panel">${rows.join('')}${extras.map(x=>`<div class="skill-detail-extra">${esc(x)}</div>`).join('')}</div>`;
}
function ensureSkillDetailStyle(){if(document.querySelector('#skillDetailStyle'))return;const st=document.createElement('style');st.id='skillDetailStyle';st.textContent=`
 .inspect-detail-toggle{margin:.45rem 0 0;padding:.28rem .65rem;border:1px solid rgba(255,255,255,.22);border-radius:6px;background:rgba(255,255,255,.06);color:inherit;cursor:pointer;font:inherit;font-size:.78rem}.inspect-detail-toggle:hover{background:rgba(255,255,255,.12)}
 .skill-detail-panel{grid-column:1/-1;margin-top:.45rem;padding:.65rem .75rem;border:1px solid rgba(255,255,255,.12);border-radius:8px;background:rgba(0,0,0,.18);font-size:.76rem}.skill-coeff-row{display:flex;justify-content:space-between;gap:1rem;padding:.22rem 0}.skill-coeff-row span{text-align:right;opacity:.88}.skill-coeff-row em{font-style:normal;white-space:nowrap}.skill-coeff-row .current-star{font-weight:800;text-decoration:underline}.skill-detail-extra{padding:.14rem 0;opacity:.78}
 `;document.head.appendChild(st)}

function ensureInspector(){
 ensureSkillDetailStyle();
 if(document.querySelector('#unitInspector'))return;
 const host=document.querySelector('.arena-card')||document.querySelector('main')||document.body;
 const el=document.createElement('section');el.id='unitInspector';el.className='unit-inspector empty';
 el.innerHTML='<div class="inspect-id"><span class="inspect-kicker">EXPERIMENTER DATA</span><b>실험체 정보</b><small>전장의 실험체에 커서를 올려봐.</small></div>';
 const boardShell=document.querySelector('.board-shell');
 if(boardShell&&boardShell.parentElement===host) boardShell.insertAdjacentElement('afterend',el); else host.appendChild(el);
}
function fmtStat(v,d=0){return Number.isFinite(+v)?(+v).toLocaleString('ko-KR',{maximumFractionDigits:d}):'-'}
function showInspector(u,rOverride=null,starOverride=null){
 ensureInspector();const el=document.querySelector('#unitInspector');
 const r=rOverride||byId[u?.characterId]||{id:u?.characterId||'nina',name:u?.name||'니나',cost:'소환',role:u?.role||'소환수',affiliations:[],baseStats:{}};
 const info=skillInfo[r.id]||skillInfo[u?.characterId]||{active:['-','효과 정보 없음'],passive:['-','효과 정보 없음']};
 const bs=u?{hp:u.maxHp,atk:u.atk,amp:u.amp,def:u.def,as:u.as,range:u.range}:r.baseStats||{};
 const dname=displayName(r),sname=skinName(r);
 const star=starOverride||u?.star||1,cost=r.id==='nina'?'소환수':`${r.cost} COST`;
 el.classList.remove('empty');
 el.innerHTML=`<div class="inspect-id"><span class="inspect-kicker">${esc(cost)} · ${esc(r.role||u?.role||'')}</span><b>${esc(dname)} <em>${'★'.repeat(star)}</em></b><small>스킨 · ${esc(sname)} · ${esc((r.affiliations||[]).join(' / ')||'소속 없음')}</small></div>
 <div class="inspect-skills"><article><span>ACTIVE</span><b>${esc(info.active[0])}</b><p>${esc(info.active[1])}</p></article><article><span>PASSIVE</span><b>${esc(info.passive[0])}</b><p>${esc(info.passive[1])}</p></article>${r.id!=='nina'?`<button type="button" class="inspect-detail-toggle" data-detail-id="${esc(r.id)}">${expandedSkillDetails.has(r.id)?'상세 닫기':'상세'}</button>${expandedSkillDetails.has(r.id)?coefficientDetailHtml(r.id,star):''}`:''}</div>
 <div class="inspect-stats"><span><i>체력</i><b>${fmtStat(bs.hp)}</b></span><span><i>공격력</i><b>${fmtStat(bs.atk,1)}</b></span><span><i>스킬 증폭</i><b>${fmtStat(bs.amp,1)}</b></span><span><i>방어력</i><b>${fmtStat(bs.def,1)}</b></span><span><i>공격 속도</i><b>${fmtStat(bs.as,2)}</b></span><span><i>사거리</i><b>${fmtStat(bs.range)}</b></span></div>`;
}


document.addEventListener('click',e=>{const btn=e.target.closest?.('.inspect-detail-toggle');if(!btn)return;e.preventDefault();e.stopPropagation();const id=btn.dataset.detailId;if(expandedSkillDetails.has(id))expandedSkillDetails.delete(id);else expandedSkillDetails.add(id);const u=units.find(x=>x.characterId===id)||null;const r=byId[id];if(r)showInspector(u,r)});

function esc(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function config(seed=+$("#seed").value){const teamB=appMode==='game'?teams.B.filter(e=>byId[e.characterId]):teams.B;return {teamA:teams.A,teamB,masteryA:appMode==='game'?gameState.masteryLevel:+$("#masteryA").value,masteryB:+$("#masteryB").value,seed,moveInterval:+$("#moveInterval").value}}
function showError(e){$("#status").textContent=e.message}
function statusLabel(r){return r.implemented?"SKILL READY":"SKILL PENDING"}
function unique(field){return [...new Set(roster.flatMap(r=>field==="aff"?r.affiliations:[r[field]]))]}

function roundDamage(round){return Math.min(25,5+Math.floor((Math.max(1,round)-1)/3)*2)}
function clearRoundTimer(){if(roundTimer!==null){clearInterval(roundTimer);roundTimer=null}}
function randomPlayable(){const pool=playableRoster();return pool[Math.floor(Math.random()*pool.length)]}
function rollShop(){gameState.shop=Array.from({length:GAME_TEMP.shopSize},()=>randomPlayable().id)}
function firstFreeCell(){for(const x of [2,1,0])for(const y of [1,0,2])if(!teams.A.some(e=>e.x===x&&e.y===y))return{x,y};return null}
function syncOwnedBoard(){for(const o of gameState.owned){const e=teams.A.find(e=>e.ownedId===o.uid);o.location=e?'board':'bench'}renderGameEconomy()}
function mergeOwnedUnits(){
 let merged=[];
 for(let guard=0;guard<12;guard++){
  let trio=null;
  for(const star of [1,2]){
   const groups=new Map();
   for(const o of gameState.owned.filter(o=>o.star===star)){const k=o.characterId+'|'+star;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(o)}
   trio=[...groups.values()].find(g=>g.length>=3);if(trio)break;
  }
  if(!trio)break;
  trio=trio.slice(0,3);
  const survivor=trio.find(o=>o.location==='board')||trio[0],consumed=trio.filter(o=>o!==survivor);
  for(const o of consumed){const bi=teams.A.findIndex(e=>e.ownedId===o.uid);if(bi>=0)teams.A.splice(bi,1);const oi=gameState.owned.findIndex(x=>x.uid===o.uid);if(oi>=0)gameState.owned.splice(oi,1)}
  survivor.star++;
  const boardEntry=teams.A.find(e=>e.ownedId===survivor.uid);if(boardEntry)boardEntry.star=survivor.star;
  merged.push(`${displayName(byId[survivor.characterId])} ${'★'.repeat(survivor.star)}`);
 }
 return merged;
}
function addOwned(characterId,autoBoard=false){const o={uid:gameState.nextOwnedId++,characterId,star:1,location:'bench'};gameState.owned.push(o);if(autoBoard){const pos=firstFreeCell();if(pos){teams.A.push({characterId,star:1,...pos,ownedId:o.uid});o.location='board'}}const merged=mergeOwnedUnits();return {unit:o,merged}}
function purchaseCanMerge(characterId){return gameState.owned.filter(o=>o.characterId===characterId&&o.star===1).length>=2}

function buyShop(i){if(appMode!=='game'||roundState.phase!=='prep')return;const id=gameState.shop[i],r=byId[id];if(!r)return;if(gameState.credits<r.cost){gameState.message='크레딧이 부족해.';renderGameEconomy();return}if(gameState.owned.filter(o=>o.location==='bench').length>=GAME_TEMP.benchSize&&!purchaseCanMerge(id)){gameState.message='벤치가 가득 찼어.';renderGameEconomy();return}gameState.credits-=r.cost;const added=addOwned(id,false);gameState.shop[i]=null;gameState.message=added.merged.length?`${displayName(r)} 구매 · ${added.merged.join(' → ')} 합성!`:`${displayName(r)} 구매 · 벤치로 이동`;reset();renderGameEconomy()}
function rerollShop(){if(roundState.phase!=='prep')return;if(gameState.credits<GAME_TEMP.rerollCost){gameState.message='리롤할 크레딧이 부족해.';renderGameEconomy();return}gameState.credits-=GAME_TEMP.rerollCost;rollShop();gameState.message='상점을 새로고침했어.';renderGameEconomy()}
function toggleShopLock(){if(appMode!=='game')return;gameState.shopLocked=!gameState.shopLocked;gameState.message=gameState.shopLocked?'상점을 다음 라운드까지 고정했어.':'상점 고정을 해제했어.';renderGameEconomy()}
function sellOwned(uid){if(appMode!=='game'||roundState.phase!=='prep')return;const i=gameState.owned.findIndex(o=>o.uid===uid);if(i<0)return;const o=gameState.owned[i],r=byId[o.characterId];if(!r)return;const refund=r.cost*Math.pow(3,Math.max(0,o.star-1));const bi=teams.A.findIndex(e=>e.ownedId===uid);if(bi>=0)teams.A.splice(bi,1);gameState.owned.splice(i,1);gameState.credits+=refund;gameState.message=`${displayName(r)} ${'★'.repeat(o.star)} 판매 · +${refund} 크레딧`;reset();renderGameEconomy()}
function deployOwned(uid){if(roundState.phase!=='prep'||teams.A.length>=3)return;const o=gameState.owned.find(x=>x.uid===uid);if(!o||o.location!=='bench')return;const pos=firstFreeCell();if(!pos)return;teams.A.push({characterId:o.characterId,star:o.star,...pos,ownedId:o.uid});o.location='board';reset();renderGameEconomy()}
function benchOwned(uid){if(roundState.phase!=='prep')return;const i=teams.A.findIndex(e=>e.ownedId===uid);if(i<0)return;teams.A.splice(i,1);const o=gameState.owned.find(x=>x.uid===uid);if(o)o.location='bench';reset();renderGameEconomy()}
function addMasteryProgress(amount=1,reason='숙련도'){
 if(gameState.masteryLevel>=20)return;
 gameState.masteryProgress+=amount;
 let leveled=false;
 while(gameState.masteryProgress>=GAME_TEMP.masteryProgressMax&&gameState.masteryLevel<20){gameState.masteryProgress-=GAME_TEMP.masteryProgressMax;gameState.masteryLevel++;leveled=true}
 if(gameState.masteryLevel>=20)gameState.masteryProgress=0;
 if(leveled)gameState.message=`${reason} · 숙련도 ${gameState.masteryLevel} 달성`;
}
function investMastery(){
 if(appMode!=='game'||roundState.phase!=='prep')return;
 if(gameState.masteryLevel>=20){gameState.message='숙련도가 최대치야.';renderGameEconomy();return}
 if(gameState.credits<GAME_TEMP.masteryInvestCost){gameState.message='숙련도에 투자할 크레딧이 부족해.';renderGameEconomy();return}
 gameState.credits-=GAME_TEMP.masteryInvestCost;addMasteryProgress(1,'크레딧 투자');reset();renderGameEconomy();
}
function setupWildRound(){teams.B=[{characterId:'wild_boar',star:1,x:2,y:1},{characterId:'wild_wolf',star:1,x:1,y:0}];}
function setupRoundOpponent(){if(roundState.round===1)setupWildRound();else teams.B=[{characterId:'marcus',star:1,x:2,y:1},{characterId:'rio',star:1,x:0,y:0},{characterId:'cathy',star:1,x:1,y:2}]}
function ensureAppShell(){
 if(document.querySelector("#appModeStart"))return;
 const style=document.createElement("style");style.id="appModeStyle";style.textContent=`
 body.mode-start{overflow:hidden}
 #appModeStart{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:24px;background:rgba(8,10,16,.96);color:#f5f7fb}#appModeStart[hidden]{display:none}
 .mode-start-inner{width:min(760px,100%);display:grid;gap:22px;text-align:center}.mode-brand small{letter-spacing:.28em;opacity:.6}.mode-brand h1{margin:.3rem 0;font-size:clamp(2rem,6vw,4.4rem);letter-spacing:-.04em}.mode-brand p{margin:0;opacity:.68}
 .mode-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.mode-card{min-height:190px;padding:22px;text-align:left;border:1px solid rgba(255,255,255,.16);border-radius:14px;background:rgba(255,255,255,.055);color:inherit;cursor:pointer}.mode-card:hover{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.3)}.mode-card b{display:block;font-size:1.35rem;margin-bottom:.45rem}.mode-card span{display:block;line-height:1.55;opacity:.7}.mode-card em{display:inline-block;margin-top:1rem;font-style:normal;font-size:.75rem;letter-spacing:.08em;opacity:.5}
 #devExit{position:fixed;right:12px;bottom:12px;z-index:9000;padding:7px 10px;border:1px solid rgba(255,255,255,.14);border-radius:7px;background:rgba(0,0,0,.58);color:rgba(255,255,255,.6);font:inherit;font-size:.72rem;cursor:pointer}#devExit[hidden]{display:none}
 body[data-app-mode="test"] #roundModePanel,body[data-app-mode="test"] #gameEconomyPanel{display:none!important}body[data-app-mode="game"] #teamA,body[data-app-mode="game"] #teamB{display:none!important}body[data-app-mode="game"] .dev-control-hidden{display:none!important}
 @media(max-width:620px){.mode-cards{grid-template-columns:1fr}.mode-card{min-height:145px}}`;document.head.appendChild(style);
 const start=document.createElement("section");start.id="appModeStart";start.innerHTML=`<div class="mode-start-inner"><div class="mode-brand"><small>ETERNAL RETURN AUTO CHESS</small><h1>이리체스</h1><p>플레이할 모드를 선택해.</p></div><div class="mode-cards"><button type="button" class="mode-card" data-enter-mode="game"><b>게임 플레이</b><span>게임 시작부터 라운드를 진행하는 프로토타입.</span><em>GAME CLIENT · ROUND 1</em></button><button type="button" class="mode-card" data-enter-mode="test"><b>전투 테스트</b><span>실험체 · 성급 · 배치 · 시드와 QA를 직접 설정해.</span><em>DEVELOPER LAB</em></button></div></div>`;document.body.appendChild(start);
 const exit=document.createElement("button");exit.type="button";exit.id="devExit";exit.hidden=true;exit.textContent="DEV · 시작 화면으로";document.body.appendChild(exit);
 start.querySelectorAll("[data-enter-mode]").forEach(b=>b.addEventListener("click",()=>enterAppMode(b.dataset.enterMode)));exit.addEventListener("click",returnToModeStart);
 ["start","pause","step","reset","batch","speed","seed","fixedSeed","masteryA","masteryB","moveInterval"].forEach(id=>{const el=document.getElementById(id);if(!el)return;(el.closest("label")||el).classList.add("dev-control-hidden")});document.body.classList.add("mode-start");
}
function enterAppMode(mode){appMode=mode;document.body.dataset.appMode=mode;document.body.classList.remove('mode-start');$('#appModeStart').hidden=true;$('#devExit').hidden=false;if(mode==='game')startRoundMode();else stopRoundMode()}
function returnToModeStart(){clearRoundTimer();if(running||battle)reset();roundState.active=false;roundState.phase='idle';appMode=null;delete document.body.dataset.appMode;document.body.classList.add('mode-start');$('#appModeStart').hidden=false;$('#devExit').hidden=true;renderRoundUI();renderGameEconomy()}
function ensureRoundUI(){
 if(document.querySelector('#roundModePanel'))return;const style=document.createElement('style');style.id='gameUiCleanupStyle';style.textContent=`
 #roundModePanel{position:fixed;left:50%;top:7px;transform:translateX(-50%);z-index:8600;width:min(760px,calc(100% - 18px));margin:0;padding:5px 9px;border:1px solid rgba(255,255,255,.13);border-radius:9px;background:rgba(8,11,17,.88);backdrop-filter:blur(9px);display:grid;gap:3px;box-shadow:0 5px 18px rgba(0,0,0,.24)}
 #roundModePanel .round-hud{min-height:30px}.round-side{gap:2px}.round-side-line{line-height:1}.round-side-line b{font-size:.72rem}.round-side-line strong{font-size:.86rem}.round-side-line span{font-size:.6rem;opacity:.55}.round-center{min-width:104px}.round-center b{font-size:.72rem}.round-center strong{font-size:.88rem}.round-center small{display:none}.round-hpbar{height:3px}.round-actions{position:absolute;left:50%;top:100%;transform:translate(-50%,4px)}.round-actions:empty{display:none}.round-actions .round-btn{padding:.3rem .6rem;font-size:.68rem;background:rgba(8,11,17,.9);white-space:nowrap}
 .current-synergy-panel{position:absolute;left:8px;top:50%;transform:translateY(-50%);z-index:55;width:min(190px,22%);padding:8px;border:1px solid rgba(116,171,160,.18);border-radius:8px;background:rgba(6,10,14,.72);backdrop-filter:blur(6px);pointer-events:none}.current-synergy-title{display:block;margin-bottom:5px;font-size:.62rem;letter-spacing:.12em;color:#8fa9a3}.current-synergy-panel .synergy-strip{display:flex;flex-direction:column;align-items:stretch;gap:4px;padding:0;border:0;overflow:visible;white-space:normal}.current-synergy-panel .synergy-strip>i{display:none}.current-synergy-panel .synergy-strip span{font-size:.62rem;padding:3px 5px}.current-synergy-panel .role-chip{display:block;border-color:rgba(198,171,103,.34);color:#d9c78f;background:rgba(49,40,21,.34)}.current-synergy-panel .role-chip.synergy-off{opacity:.45}
 #board .cell.role-synergy-zone:before{content:"";position:absolute;inset:7px;z-index:1;border:1px solid rgba(102,220,176,.82);border-radius:50%;background:radial-gradient(circle,rgba(82,207,158,.16),rgba(82,207,158,.025) 62%,transparent 68%);box-shadow:0 0 18px rgba(82,207,158,.16),inset 0 0 16px rgba(82,207,158,.08);pointer-events:none;animation:roleZonePulse 1.05s ease-in-out infinite alternate}#board[data-role-preview]:after{content:attr(data-role-preview) " 시너지 유효 배치";position:absolute;left:50%;top:-24px;transform:translateX(-50%);z-index:70;padding:3px 8px;border-radius:999px;background:rgba(9,18,16,.88);border:1px solid rgba(102,220,176,.45);color:#a9e4cc;font-size:.62rem;letter-spacing:.03em;white-space:nowrap;pointer-events:none}@keyframes roleZonePulse{from{opacity:.58;transform:scale(.96)}to{opacity:1;transform:scale(1)}}
 @media(max-width:850px){#roundModePanel{top:4px;width:calc(100% - 10px);padding:4px 6px}.current-synergy-panel{left:6px;right:6px;top:6px;transform:none;width:auto;max-width:none;padding:5px;display:block}.current-synergy-panel .synergy-strip{flex-direction:row;overflow-x:auto;white-space:nowrap}.current-synergy-panel .synergy-strip span{flex:0 0 auto}.current-synergy-title{display:none}.board-shell{padding-top:40px!important}}

 #gameEconomyPanel{margin:8px 0;padding:8px 12px;border:0;background:transparent;display:grid;gap:6px}
 .round-hud{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);gap:12px;align-items:center}.round-side{min-width:0;display:grid;gap:4px}.round-side.enemy{text-align:right}.round-side-line{display:flex;align-items:baseline;gap:6px}.round-side.enemy .round-side-line{justify-content:flex-end}.round-side-line b{font-size:.92rem}.round-side-line strong{font-size:1.05rem}.round-center{text-align:center;min-width:116px}.round-center b{display:block;font-size:1rem;letter-spacing:.04em}.round-center strong{display:block;font-size:1.3rem;line-height:1.15}.round-center small{display:block;opacity:.58;font-size:.68rem;margin-top:2px}.round-hpbar{height:5px;border-radius:999px;background:rgba(255,255,255,.09);overflow:hidden}.round-hpbar i{display:block;height:100%;background:currentColor}.round-actions{display:flex;justify-content:center}.round-btn,.econ-btn{padding:.48rem .75rem;border:1px solid rgba(255,255,255,.2);border-radius:7px;background:rgba(255,255,255,.07);color:inherit;cursor:pointer}.round-note,.temp-note{opacity:.58;font-size:.72rem;text-align:center}.game-msg{min-height:1.1em;font-size:.78rem;text-align:center;opacity:.72}
 body[data-app-mode="game"] #gameEconomyPanel{padding-bottom:188px}
 .game-bottom-dock{position:fixed;left:50%;bottom:0;transform:translateX(-50%);z-index:8500;width:min(1180px,calc(100% - 18px));display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:stretch;padding:10px;border:1px solid rgba(255,255,255,.18);border-bottom:0;border-radius:12px 12px 0 0;background:rgba(12,14,20,.97);backdrop-filter:blur(10px)}
 .dock-side{min-width:128px;display:grid;align-content:center;gap:5px}.dock-credit{font-size:1.2rem;font-weight:800}.dock-center{min-width:0;display:grid;gap:7px}.dock-shop{display:grid;grid-template-columns:repeat(5,minmax(90px,1fr));gap:7px}.dock-mastery{min-width:190px;display:grid;gap:6px;align-content:center}.mastery-line{display:flex;justify-content:space-between;gap:8px;align-items:center}.mastery-track{height:7px;border-radius:99px;background:rgba(255,255,255,.1);overflow:hidden}.mastery-track i{display:block;height:100%;background:currentColor}.dock-label{font-size:.7rem;opacity:.58;letter-spacing:.08em}.dock-actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.dock-actions .econ-btn{flex:1}
 .credit-price,.credit-wallet{display:inline-flex;align-items:center;gap:4px;white-space:nowrap}.credit-price img{width:22px;height:16px;object-fit:contain}.credit-wallet img{width:34px;height:24px;object-fit:contain}.credit-wallet b{font-size:1.25rem}.reroll-btn,.mastery-buy{display:flex;align-items:center;justify-content:center;gap:7px}
 .shop-card{position:relative;min-width:0;min-height:118px;padding:0;border:1px solid rgba(255,255,255,.16);border-radius:8px;overflow:hidden;background:rgba(255,255,255,.055);color:inherit;cursor:pointer;text-align:left;display:grid;grid-template-rows:72px auto auto}.shop-card:disabled{cursor:default;opacity:.65}.shop-card:not(:disabled):hover,.shop-card:focus-visible{border-color:rgba(255,255,255,.42);background:rgba(255,255,255,.1)}.shop-portrait{position:relative;display:block;overflow:hidden;background:rgba(0,0,0,.2)}.shop-portrait img,.bench-portrait img{position:absolute;left:0;top:0;width:100%;height:100%;max-width:none;max-height:none;object-fit:contain;object-position:center bottom}.shop-portrait img[data-alpha-ready="1"],.bench-portrait img[data-alpha-ready="1"]{object-fit:fill}.shop-portrait.fallback{display:grid;place-items:center;font-size:2rem;font-weight:800}.shop-name{padding:5px 7px 1px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.shop-meta{padding:0 7px 6px;display:flex;align-items:center;justify-content:space-between;gap:5px}.shop-meta small{opacity:.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.shop-card.sold{display:grid;place-items:center;min-height:118px;opacity:.3}.shop-card.sold .shop-portrait{display:none}
 .bench-zone{min-height:70px;border:1px solid rgba(255,255,255,.09);border-radius:8px;background:rgba(255,255,255,.025);padding:5px 6px;display:grid;gap:4px}.bench-head{display:flex;align-items:center;justify-content:space-between;font-size:.68rem;opacity:.65}.bench-row{display:grid;grid-template-columns:repeat(8,minmax(52px,1fr));gap:5px;min-height:54px}.bench-unit{position:relative;min-width:0;height:54px;border:1px solid rgba(255,255,255,.12);border-radius:6px;background:rgba(0,0,0,.2);overflow:hidden;touch-action:none;user-select:none;cursor:grab}.bench-unit:active{cursor:grabbing}.bench-portrait{position:absolute;inset:0;overflow:hidden}.bench-star{position:absolute;left:4px;top:3px;z-index:3;font-size:10px;text-shadow:0 1px 3px #000}.bench-unit.star-1 .bench-star{color:#69b9ff}.bench-unit.star-2 .bench-star{color:#c58cff}.bench-unit.star-3 .bench-star{color:#ffd75f}.bench-empty{display:grid;place-items:center;grid-column:1/-1;font-size:.72rem;opacity:.42}
 .shop-sell-active .dock-shop{outline:2px solid rgba(255,95,95,.72);outline-offset:3px;border-radius:8px}.shop-sell-active .dock-shop::after{content:attr(data-sell-hint);position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:30;padding:7px 12px;border-radius:999px;background:rgba(22,8,8,.92);border:1px solid rgba(255,110,110,.7);font-size:.78rem;font-weight:800;pointer-events:none}.dock-shop{position:relative}
 .drag-ghost{position:fixed;z-index:20000;width:58px;height:74px;pointer-events:none;opacity:.82;transform:translate(-50%,-55%);filter:drop-shadow(0 6px 8px #000b)}.drag-ghost img{width:100%;height:100%;object-fit:contain}.drag-target{outline:2px solid rgba(92,211,255,.65)!important;outline-offset:-2px}.dragging-owned{opacity:.35!important}
 .shop-lock-btn.locked{border-color:rgba(255,215,95,.7);background:rgba(255,215,95,.12)}
 /* Battlefield rendering: prep = own 3x3, combat/QA = full 3x6. */
 .board-shell{overflow:visible!important}
 #board{border:0!important;box-shadow:none!important;background:radial-gradient(ellipse at center,rgba(40,64,72,.10),transparent 67%)!important;overflow:visible!important;transition:width .16s ease}
 #board.formation-board{grid-template-columns:repeat(3,minmax(0,1fr))!important;width:50%;margin-inline:auto}
 #board.formation-board .cell[data-x="3"],#board.formation-board .cell[data-x="4"],#board.formation-board .cell[data-x="5"]{display:none!important}
 #board.combat-board{grid-template-columns:repeat(6,minmax(0,1fr))!important;width:100%;margin-inline:0}
 #board.combat-board .cell{display:block!important}
 body[data-app-mode="game"].formation-phase .field-b{display:none!important}
 body[data-app-mode="game"].formation-phase .field-a{left:50%!important;right:auto!important;transform:translateX(-50%)}
 .cell{overflow:visible!important;border:0!important;background:transparent!important}.cell.divider{border:0!important}.coord{opacity:.24!important;font-size:7px!important}.ground-ring{opacity:.32;z-index:2}
 #board .unit{overflow:visible!important;z-index:10!important}
 #board .sd-slot{left:-8%!important;right:-8%!important;top:-38px!important;bottom:18px!important;overflow:visible!important;z-index:3!important;display:flex!important;align-items:flex-end!important;justify-content:center!important}
 #board .sd-image{display:block!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;object-fit:contain!important;object-position:center bottom!important;opacity:1!important;visibility:visible!important;image-rendering:auto;filter:drop-shadow(0 5px 6px #000b)}
 @media(max-width:850px){#board.formation-board{width:100%}#board .sd-slot{top:-24px!important}}
 .unit-hud.compact-hud{left:12%;right:12%;top:var(--hud-top,-42px);bottom:auto;z-index:80;display:grid;grid-template-columns:11px minmax(0,1fr);gap:3px;align-items:center;pointer-events:none}.compact-hud .hud-star{font-size:9px;line-height:1;text-align:center;text-shadow:0 1px 3px #000,0 0 4px #000}.compact-hud .hud-star.star-1{color:#69b9ff}.compact-hud .hud-star.star-2{color:#c58cff}.compact-hud .hud-star.star-3{color:#ffd75f}.compact-hud .hpbar{height:3px;margin:0;position:relative;z-index:81}.unit{z-index:10}.unit:hover,.unit:focus{z-index:20}.unit .unit-hud{z-index:80}

 /* Cross-device polish: collapsible dock, readable controls, lighter typography. */
 .game-bottom-dock{transition:transform .18s ease}.dock-toggle{position:absolute;right:10px;top:-31px;height:31px;padding:0 12px;border:1px solid rgba(255,255,255,.18);border-bottom:0;border-radius:8px 8px 0 0;background:rgba(12,14,20,.97);color:inherit;font:inherit;font-size:.72rem;font-weight:500;white-space:nowrap;cursor:pointer}.game-bottom-dock.collapsed{transform:translate(-50%,calc(100% - 7px));pointer-events:none}.game-bottom-dock.collapsed .dock-toggle{pointer-events:auto;top:-31px}.game-bottom-dock b,.game-bottom-dock strong,.shop-name,.round-hud b,.round-hud strong,#unitInspector b,#unitInspector strong,.inspect-stats b{font-weight:600!important}.dock-credit,.credit-wallet b{font-weight:600!important}.dock-actions{flex-wrap:nowrap}.reroll-btn,.shop-lock-btn,.mastery-buy{white-space:nowrap;word-break:keep-all;min-width:max-content}.reroll-btn span,.mastery-buy span{white-space:nowrap}.shop-name{font-weight:600!important}.shop-meta{font-weight:400}.bench-head b{font-weight:500!important}
 .unit-hud.compact-hud{left:21%;right:21%;grid-template-columns:10px minmax(0,1fr);gap:3px}.compact-hud .hpbar{height:5px!important;border-radius:999px}.compact-hud .hud-star{font-weight:500}
 @media(max-width:850px){body[data-app-mode="game"] #gameEconomyPanel{padding-bottom:265px}.game-bottom-dock{grid-template-columns:1fr;max-height:55vh;overflow:auto}.dock-side,.dock-mastery{min-width:0}.dock-actions{flex-wrap:nowrap}.dock-shop{grid-template-columns:repeat(5,minmax(76px,1fr));overflow-x:auto}.bench-row{grid-template-columns:repeat(8,58px);overflow-x:auto}.round-hud{grid-template-columns:minmax(0,1fr) 104px minmax(0,1fr);gap:7px}.round-center strong{font-size:1.05rem}.round-side-line{gap:3px}.round-side-line b{font-size:.72rem}.round-side-line strong{font-size:.9rem}}
 `;document.head.appendChild(style);
 const panel=document.createElement('section');panel.id='roundModePanel';const eco=document.createElement('section');eco.id='gameEconomyPanel';const anchor=board?.parentElement||document.body;anchor.insertBefore(panel,board||anchor.firstChild);panel.insertAdjacentElement('afterend',eco);renderRoundUI();renderGameEconomy();
}
function phaseLabel(){if(roundState.round===1&&roundState.phase==='combat')return '파밍 전투';return {idle:'대기',prep:'준비',combat:'전투',result:'결과',finished:'게임 종료'}[roundState.phase]||roundState.phase}
function syncBoardPresentation(){
 if(!board)return;
 const prep=appMode==='game'&&roundState.active&&roundState.phase==='prep';
 board.classList.toggle('formation-board',prep);
 board.classList.toggle('combat-board',!prep);
 document.body.classList.toggle('formation-phase',prep);
 const legend=document.querySelector('.arena-top .legend');if(legend)legend.style.display=prep?'none':'';
 const hint=document.querySelector('.arena-card .hint');if(hint)hint.textContent=prep?(roundState.round===1?'ROUND 1 파밍 준비 · 내 진영 3×3 편성 · 상점 구매 후 준비 완료':'내 진영 3×3 편성 · 드래그로 배치 / 교환 · 전투 시작 시 3×6으로 결합'):'양 팀 3×3 결합 전장 · 전투/QA는 3×6';
 renderCurrentSynergyPanel();
}
function renderRoundUI(){
 syncBoardPresentation();
 const p=$('#roundModePanel');if(!p)return;const r1Prep=roundState.round===1&&roundState.phase==='prep',opp=r1Prep?'파밍 대기':roundState.round===1?'야생동물':'PLAYER B',oppHp=roundState.round===1?100:roundState.hp.B;
 const seconds=(roundState.phase==='prep'||roundState.phase==='result')?Math.max(0,Math.ceil(roundState.remaining)):null;
 const center=roundState.phase==='prep'?`준비 · ${seconds}초`:roundState.phase==='result'?`결과 · ${seconds}초`:phaseLabel();
 p.innerHTML=`<div class="round-hud"><div class="round-side ally"><div class="round-side-line"><b>나</b><strong>${roundState.hp.A}</strong><span>HP</span></div><div class="round-hpbar"><i style="width:${roundState.hp.A}%"></i></div></div><div class="round-center"><b>ROUND ${roundState.round}</b><strong>${center}</strong><small>${roundState.round===1?'파밍 라운드':'PvP'}</small></div><div class="round-side enemy"><div class="round-side-line"><b>${opp}</b><strong>${oppHp}</strong><span>HP</span></div><div class="round-hpbar"><i style="width:${oppHp}%"></i></div></div></div><div class="round-actions">${roundState.active&&roundState.phase==='prep'?'<button class="round-btn" id="roundSkip">준비 완료 · 전투 시작</button>':''}</div>`;
 p.querySelector('#roundSkip')?.addEventListener('click',beginRoundCombat)
}
function creditHtml(amount,cls='credit-price'){
 return `<span class="${cls}"><img src="assets/ui/credit.png" alt="크레딧"><b>${Number(amount)||0}</b></span>`;
}
function characterPortrait(r,cls='econ-portrait'){
 if(!r)return `<span class="${cls} fallback">?</span>`;
 const name=esc(displayName(r)),initial=esc(displayName(r).slice(0,1));
 return r.asset?.sd?`<span class="${cls}"><img data-alpha-normalize="1" src="${esc(r.asset.sd)}" alt="${name}" loading="lazy" draggable="false" onerror="this.remove();this.parentElement.classList.add('fallback');this.parentElement.textContent='${initial}'"></span>`:`<span class="${cls} fallback">${initial}</span>`;
}
function alphaBounds(img){
 const key=img.currentSrc||img.src;if(alphaBoundsCache.has(key))return alphaBoundsCache.get(key);if(!img.naturalWidth||!img.naturalHeight)return null;
 try{const c=document.createElement('canvas'),w=img.naturalWidth,h=img.naturalHeight;c.width=w;c.height=h;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(img,0,0);const d=x.getImageData(0,0,w,h).data;let minX=w,minY=h,maxX=-1,maxY=-1;for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++){if(d[(yy*w+xx)*4+3]>12){if(xx<minX)minX=xx;if(xx>maxX)maxX=xx;if(yy<minY)minY=yy;if(yy>maxY)maxY=yy}}let centerX=w/2;if(maxX>=0){const weights=new Float64Array(w);let total=0;for(let yy=minY;yy<=maxY;yy++)for(let xx=minX;xx<=maxX;xx++){const a=d[(yy*w+xx)*4+3]/255;if(a>.05){weights[xx]+=a;total+=a}}let acc=0;for(let xx=0;xx<w;xx++){acc+=weights[xx];if(acc>=total*.5){centerX=xx;break}}}const b=maxX<0?{minX:0,minY:0,maxX:w-1,maxY:h-1,centerX:w/2}:{minX,minY,maxX,maxY,centerX};alphaBoundsCache.set(key,b);return b}catch(e){return null}
}
function normalizePortraitImage(img){
 if(!img.isConnected||!img.complete||!img.naturalWidth)return;
 const box=img.parentElement,b=alphaBounds(img);if(!box||!b)return;
 const W=box.clientWidth,H=box.clientHeight;if(!W||!H)return;
 const bw=b.maxX-b.minX+1,bh=b.maxY-b.minY+1;
 if(!Number.isFinite(bw)||!Number.isFinite(bh)||bw<=0||bh<=0)return;
 const scale=Math.min(W*.88/bw,H*.94/bh);
 if(!Number.isFinite(scale)||scale<=0)return;
 const width=img.naturalWidth*scale,height=img.naturalHeight*scale,visualCenter=Number.isFinite(b.centerX)?b.centerX:(b.minX+bw/2),left=W/2-visualCenter*scale,top=H-(b.maxY+1)*scale;
 if(![width,height,left,top].every(Number.isFinite))return;
 img.style.width=`${width}px`;img.style.height=`${height}px`;img.style.left=`${left}px`;img.style.top=`${top}px`;img.dataset.alphaReady='1';
}
function positionUnitHud(img){
 if(!img.isConnected||!img.complete||!img.naturalWidth)return;
 const unit=img.closest('.unit'),slot=img.closest('.sd-slot'),b=alphaBounds(img);if(!unit||!slot||!b)return;
 const ir=img.getBoundingClientRect(),ur=unit.getBoundingClientRect();if(!ir.width||!ir.height)return;
 const scaleY=ir.height/img.naturalHeight,opaqueTop=ir.top-ur.top+b.minY*scaleY;
 const top=Math.max(-70,opaqueTop-8);unit.style.setProperty('--hud-top',`${Math.round(top)}px`);
}
function normalizeVisuals(root=document){
 root.querySelectorAll?.('img[data-alpha-normalize]').forEach(img=>{const run=()=>normalizePortraitImage(img);img.complete?requestAnimationFrame(run):img.addEventListener('load',()=>requestAnimationFrame(run),{once:true})});
 root.querySelectorAll?.('.sd-image').forEach(img=>{const run=()=>positionUnitHud(img);img.complete?requestAnimationFrame(run):img.addEventListener('load',()=>requestAnimationFrame(run),{once:true})});
}
function renderCurrentSynergyPanel(){
 let panel=document.querySelector('#currentSynergyPanel');
 if(appMode!=='game'||!roundState.active){panel?.remove();return}
 const shell=document.querySelector('.board-shell');if(!shell)return;
 if(!panel){panel=document.createElement('aside');panel.id='currentSynergyPanel';panel.className='current-synergy-panel';shell.appendChild(panel)}
 panel.innerHTML=`<span class="current-synergy-title">현재 시너지</span>${synergySummary('A')}`;
}
function rolePlacementColumns(role){
 if(role==='탱커')return [2];
 if(role==='전사'||role==='근거리 스킬')return [1,2];
 if(role==='원거리 평타'||role==='원거리 스킬')return [0,1];
 if(role==='암살자'||role==='서포터')return [0,1,2];
 return [];
}
function showRolePlacementHints(role){
 clearRolePlacementHints();
 const cols=rolePlacementColumns(role);if(!cols.length)return;
 document.body.classList.add('role-placement-preview');
 board?.setAttribute('data-role-preview',role);
 board?.querySelectorAll('.cell').forEach(cell=>{const x=+cell.dataset.x;if(x<=2&&cols.includes(x))cell.classList.add('role-synergy-zone')});
}
function clearRolePlacementHints(){
 document.body.classList.remove('role-placement-preview');
 board?.removeAttribute('data-role-preview');
 board?.querySelectorAll('.role-synergy-zone').forEach(cell=>cell.classList.remove('role-synergy-zone'));
}
function moveOwnedToCell(uid,cell){
 if(appMode!=='game'||roundState.phase!=='prep'||!cell)return false;const o=gameState.owned.find(x=>x.uid===uid);if(!o)return false;const gx=+cell.dataset.x,y=+cell.dataset.y;if(gx>2)return false;let entry=teams.A.find(e=>e.ownedId===uid),occupied=teams.A.find(e=>e!==entry&&e.x===gx&&e.y===y);
 if(!entry){if(teams.A.length>=3&&!occupied){gameState.message='전장에는 최대 3명까지 배치할 수 있어.';renderGameEconomy();return false}entry={characterId:o.characterId,star:o.star,x:gx,y,ownedId:o.uid};if(occupied){const old=gameState.owned.find(x=>x.uid===occupied.ownedId);if(old)old.location='bench';teams.A.splice(teams.A.indexOf(occupied),1)}teams.A.push(entry);o.location='board'}else if(occupied){const ox=entry.x,oy=entry.y;entry.x=gx;entry.y=y;occupied.x=ox;occupied.y=oy}else{entry.x=gx;entry.y=y}reset();renderGameEconomy();return true
}
function clearOwnedDrag(){
 if(!ownedPointerDrag)return;ownedPointerDrag.source?.classList.remove('dragging-owned');ownedPointerDrag.ghost?.remove();document.querySelectorAll('.drag-target').forEach(e=>e.classList.remove('drag-target'));document.body.classList.remove('shop-sell-active');clearRolePlacementHints();ownedPointerDrag=null;
}
function beginOwnedPointerDrag(ev,uid,source){
 if(appMode!=='game'||roundState.phase!=='prep'||ev.button>0)return;const o=gameState.owned.find(x=>x.uid===uid),r=o&&byId[o.characterId];if(!o||!r)return;ev.preventDefault();const ghost=document.createElement('div');ghost.className='drag-ghost';ghost.innerHTML=r.asset?.sd?`<img src="${esc(r.asset.sd)}" alt="">`:`<b>${esc(displayName(r))}</b>`;document.body.appendChild(ghost);source.classList.add('dragging-owned');ownedPointerDrag={uid,source,ghost,pointerId:ev.pointerId,role:r.role};showRolePlacementHints(r.role);source.setPointerCapture?.(ev.pointerId);moveOwnedPointerDrag(ev);document.addEventListener('pointermove',moveOwnedPointerDrag,{passive:false});document.addEventListener('pointerup',endOwnedPointerDrag,{once:true});document.addEventListener('pointercancel',cancelOwnedPointerDrag,{once:true});
}
function moveOwnedPointerDrag(ev){
 if(!ownedPointerDrag)return;ev.preventDefault();ownedPointerDrag.ghost.style.left=`${ev.clientX}px`;ownedPointerDrag.ghost.style.top=`${ev.clientY}px`;document.querySelectorAll('.drag-target').forEach(e=>e.classList.remove('drag-target'));const hit=document.elementFromPoint(ev.clientX,ev.clientY),shop=hit?.closest('.dock-shop'),bench=hit?.closest('.bench-zone'),cell=hit?.closest('.cell');document.body.classList.toggle('shop-sell-active',!!shop);if(shop){const o=gameState.owned.find(x=>x.uid===ownedPointerDrag.uid),r=o&&byId[o.characterId],refund=r?r.cost*Math.pow(3,o.star-1):0;shop.dataset.sellHint=`판매 +${refund}`;shop.classList.add('drag-target')}else if(bench)bench.classList.add('drag-target');else if(cell&&+cell.dataset.x<=2)cell.classList.add('drag-target');
}
function endOwnedPointerDrag(ev){
 if(!ownedPointerDrag)return;const uid=ownedPointerDrag.uid,hit=document.elementFromPoint(ev.clientX,ev.clientY),shop=hit?.closest('.dock-shop'),bench=hit?.closest('.bench-zone'),cell=hit?.closest('.cell');document.removeEventListener('pointermove',moveOwnedPointerDrag);if(shop)sellOwned(uid);else if(bench)benchOwned(uid);else if(cell)moveOwnedToCell(uid,cell);clearOwnedDrag();
}
function cancelOwnedPointerDrag(){document.removeEventListener('pointermove',moveOwnedPointerDrag);clearOwnedDrag()}
function bindOwnedPointerDrag(root){root?.querySelectorAll('[data-owned-drag]').forEach(el=>el.addEventListener('pointerdown',ev=>beginOwnedPointerDrag(ev,+el.dataset.ownedDrag,el)))}
function bindEconomyInspect(root){
 root?.querySelectorAll('[data-inspect-character]').forEach(el=>{
  const r=byId[el.dataset.inspectCharacter]; if(!r)return;
  const star=+(el.dataset.inspectStar||1);
  el.addEventListener('mouseenter',()=>showInspector(null,r,star));
  el.addEventListener('focus',()=>showInspector(null,r,star));
 });
}
function renderGameEconomy(){
 const p=$('#gameEconomyPanel');if(!p)return;let dock=$('#gameBottomDock');
 const farmingBattle=appMode==='game'&&roundState.round===1&&(roundState.phase==='combat'||roundState.phase==='result');
 if(appMode!=='game'||farmingBattle){p.innerHTML=farmingBattle?`<div class="game-msg">ROUND 1 · 파밍 전투 · 야생동물을 처치해 기본 아이템을 획득해.</div>`:'';if(dock)dock.remove();return}
 const prep=roundState.phase==='prep';
 const shopCards=gameState.shop.map((id,i)=>{if(!id)return `<div class="shop-card sold"><span>판매 완료</span></div>`;const r=byId[id];return `<button type="button" class="shop-card" data-buy="${i}" data-inspect-character="${esc(r.id)}" ${prep?'':'disabled'}>${characterPortrait(r,'shop-portrait')}<span class="shop-name">${esc(displayName(r))}</span><span class="shop-meta"><small>${esc(r.role)}</small>${creditHtml(r.cost)}</span></button>`}).join('');
 const benchOwned=gameState.owned.filter(o=>o.location==='bench');
 const bench=benchOwned.map(o=>{const r=byId[o.characterId];return `<article class="bench-unit star-${o.star}" data-owned-drag="${o.uid}" tabindex="0" data-inspect-character="${esc(r.id)}" data-inspect-star="${o.star}" title="${esc(displayName(r))} · 드래그해서 배치 / 상점에 놓아 판매">${characterPortrait(r,'bench-portrait')}<span class="bench-star">★</span></article>`}).join('')||'<span class="bench-empty">벤치가 비어 있어.</span>';
 p.innerHTML=`<div class="game-msg">${esc(gameState.message||'상점에서 구매 → 벤치에서 전장으로 드래그 · 상점에 놓으면 판매')}</div>`;
 if(!dock){dock=document.createElement('section');dock.id='gameBottomDock';dock.className='game-bottom-dock';document.body.appendChild(dock)}
 const max=GAME_TEMP.masteryProgressMax,prog=Math.min(max,gameState.masteryProgress),pct=max?prog/max*100:0,bonus=Math.max(0,gameState.masteryLevel-1);
 dock.classList.toggle('collapsed',shopDockCollapsed);dock.innerHTML=`<button type="button" class="dock-toggle" id="dockToggle" aria-expanded="${shopDockCollapsed?'false':'true'}">${shopDockCollapsed?'▲ 상점 열기':'▼ 상점 접기'}</button><div class="dock-side"><span class="dock-label">보유 크레딧</span><span class="dock-credit">${creditHtml(gameState.credits,'credit-wallet')}</span><div class="dock-actions"><button class="econ-btn reroll-btn" id="shopReroll" ${prep?'':'disabled'}><span>↻ 리롤</span>${creditHtml(GAME_TEMP.rerollCost)}</button><button class="econ-btn shop-lock-btn ${gameState.shopLocked?'locked':''}" id="shopLock" ${prep?'':'disabled'}>${gameState.shopLocked?'🔒 고정 중':'🔓 상점 고정'}</button></div></div><div class="dock-center"><div class="dock-shop">${shopCards}</div><div class="bench-zone"><div class="bench-head"><span>벤치 · 드래그로 배치</span><b>${benchOwned.length}/${GAME_TEMP.benchSize}</b></div><div class="bench-row">${bench}</div></div></div><div class="dock-mastery"><div class="mastery-line"><span><span class="dock-label">팀 숙련도</span><br><b>Lv.${gameState.masteryLevel}</b></span><small>기본 능력치 +${bonus}%</small></div><div class="mastery-track"><i style="width:${pct}%"></i></div><small>${gameState.masteryLevel>=20?'MAX':`${prog} / ${max} · 라운드마다 자연 +1`}</small><button class="econ-btn mastery-buy" id="masteryInvest" ${prep&&gameState.masteryLevel<20?'':'disabled'}><span>숙련도 투자 +1</span>${creditHtml(GAME_TEMP.masteryInvestCost)}</button></div>`;
 dock.querySelector('#dockToggle')?.addEventListener('click',()=>{shopDockCollapsed=!shopDockCollapsed;renderGameEconomy()});dock.querySelectorAll('[data-buy]').forEach(b=>b.addEventListener('click',()=>buyShop(+b.dataset.buy)));dock.querySelector('#shopReroll')?.addEventListener('click',rerollShop);dock.querySelector('#shopLock')?.addEventListener('click',toggleShopLock);dock.querySelector('#masteryInvest')?.addEventListener('click',investMastery);bindEconomyInspect(dock);bindOwnedPointerDrag(dock);normalizeVisuals(dock);
}

function startRoundMode(){
 clearRoundTimer();
 if(running||battle)reset();
 teams={A:[],B:[]};
 Object.assign(gameState,{credits:GAME_TEMP.startCredits,shop:[],shopLocked:false,owned:[],items:[],nextOwnedId:1,message:'',roundIncome:5,masteryLevel:1,masteryProgress:0});
 Object.assign(roundState,{active:true,phase:'prep',round:1,hp:{A:PLAYER_START_HP,B:PLAYER_START_HP},remaining:ROUND_PREP_SECONDS,lastOutcome:'',lastDamage:0});
 const oneCost=playableRoster().filter(r=>r.cost===1);
 const first=oneCost[Math.floor(Math.random()*oneCost.length)];
 if(!first){roundState.active=false;roundState.phase='finished';gameState.message='1코스트 실험체 풀이 비어 있어 게임을 시작할 수 없어.';renderRoundUI();renderGameEconomy();return}
 addOwned(first.id,true);
 rollShop();
 teams.B=[];
 gameState.message=`첫 1코스트 실험체 ${displayName(first)} 무료 지급 · 시작 크레딧 ${GAME_TEMP.startCredits}`;
 reset();
 $('#status').textContent='ROUND 1 · 파밍 준비';
 renderRoundUI();renderGameEconomy();startPrepTimer();
}
function stopRoundMode(){clearRoundTimer();roundState.active=false;roundState.phase='idle';roundState.remaining=ROUND_PREP_SECONDS;if(running||battle)reset();else $('#status').textContent='배치 단계';renderRoundUI();renderGameEconomy()}
function startPrepTimer(){clearRoundTimer();roundState.phase='prep';roundState.remaining=ROUND_PREP_SECONDS;renderRoundUI();renderGameEconomy();roundTimer=setInterval(()=>{if(!roundState.active||roundState.phase!=='prep'){clearRoundTimer();return}roundState.remaining-=1;renderRoundUI();if(roundState.remaining<=0)beginRoundCombat()},1000)}
function beginRoundCombat(){if(!roundState.active||roundState.phase!=='prep')return;if(!teams.A.length){gameState.message='전장에 실험체를 최소 1명 배치해야 해.';renderGameEconomy();return}clearRoundTimer();setupRoundOpponent();roundState.phase='combat';roundState.remaining=0;renderRoundUI();renderGameEconomy();if(!start()){roundState.phase='prep';teams.B=[];reset();startPrepTimer();return}$('#status').textContent=roundState.round===1?'ROUND 1 · 파밍 전투 중':`ROUND ${roundState.round} · 전투 중`}
function finishRound(outcome){if(!roundState.active||roundState.phase!=='combat')return;roundState.phase='result';roundState.lastOutcome=outcome;roundState.lastDamage=0;let resultText=outcome;if(roundState.round===1){if(outcome==='A팀 승리'){const rewardCount=1+Math.floor(Math.random()*3),pool=[...BASIC_ITEMS],rewards=[];for(let i=0;i<rewardCount&&pool.length;i++){const pick=Math.floor(Math.random()*pool.length);rewards.push(pool.splice(pick,1)[0])}gameState.items.push(...rewards);gameState.message=`야생동물 처치 · ${rewards.join(' / ')} 획득`}else gameState.message='야생동물전 패배 · 아이템 획득 실패';gameState.credits+=gameState.roundIncome;resultText=`${outcome==='A팀 승리'?'파밍 성공':'파밍 실패'} · 정산 +${gameState.roundIncome} 크레딧`}else{const dmg=roundDamage(roundState.round);if(outcome==='A팀 승리'){roundState.hp.B=Math.max(0,roundState.hp.B-dmg);roundState.lastDamage=dmg}else if(outcome==='B팀 승리'){roundState.hp.A=Math.max(0,roundState.hp.A-dmg);roundState.lastDamage=dmg}gameState.credits+=gameState.roundIncome;resultText=`${outcome} · 정산 +${gameState.roundIncome} 크레딧`}addMasteryProgress(1,'라운드 자연 성장');$('#status').textContent=`ROUND ${roundState.round} 결과 · ${resultText}`;roundState.remaining=ROUND_RESULT_SECONDS;renderRoundUI();renderGameEconomy();if(roundState.hp.A<=0||roundState.hp.B<=0){roundState.phase='finished';roundState.active=false;clearRoundTimer();renderRoundUI();return}clearRoundTimer();roundTimer=setInterval(()=>{roundState.remaining-=1;renderRoundUI();if(roundState.remaining<=0){clearRoundTimer();roundState.round+=1;roundState.active=true;roundState.phase='prep';if(!gameState.shopLocked)rollShop();setupRoundOpponent();reset();gameState.message=roundState.round===2?'ROUND 2 진입 · 상점/벤치/숙련도 사용 가능 · PvP 상대는 현재 임시 AI야.':'다음 라운드 준비';$('#status').textContent=`ROUND ${roundState.round} · 준비 단계`;renderRoundUI();renderGameEconomy();startPrepTimer()}},1000)}

function reset(){
 if(frame!==null)cancelAnimationFrame(frame); frame=null;
 running=false;paused=false;accumulator=0;time=0;battle=null;
 $("#pause").textContent="Ⅱ 일시정지";$("#clock").textContent="0.0s";$("#log").innerHTML="";
 try{units=new CombatEngine(config()).getResult().units;$("#status").textContent="배치 단계"}catch(e){units=[];showError(e)}
 renderTeams();render();meters();
}

function rosterFiltered(team){
 const f=filters[team];
 return roster.filter(r=>!r.pveOnly).filter(r=>{
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
 const rs=[...new Map(teams[team].map(e=>byId[e.characterId]).filter(Boolean).map(r=>[r.id,r])).values()],count=n=>rs.filter(r=>Array.isArray(r.affiliations)&&r.affiliations.includes(n)).length;
 const live=battle?.getResult?.().synergies?.[team], names=["파자마","바니걸","수영복","마츠리","프리즌","군악대","새해","악마사냥꾼","메이드","애증","치유의 노래","에레보스"];
 const parts=names.map(n=>{const c=count(n);if(!c)return"";let tier=live?.affiliations?.[n]?.tier??((n==="군악대"||n==="새해")?c:(n==="애증"||n==="치유의 노래")?1:c>=3?3:c>=2?2:0);let label=n==="에레보스"?`${n} · 효과 미정`:tier?`${n} ${tier}단계 ON`:`${n} ${c} · 미발동`;return `<span class="${tier?"synergy-on":"synergy-off"}">${label}</span>`}).filter(Boolean);
 const roles=live?.roles||teams[team].map(e=>{const r=byId[e.characterId];if(!r)return null;const d=e.x,role=r.role,active=(role==='전사'||role==='근거리 스킬')?d>=1:role==='탱커'?d===2:(role==='원거리 평타'||role==='원거리 스킬')?d<=1:(role==='암살자'||role==='서포터')?true:null;return{name:r.name,role,active}}).filter(Boolean);
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
 const u=units.find(u=>u.id===e.dataTransfer.getData("text/plain"));if(!u||appMode==="game"&&u.team!=="A")return;
 const globalX=+c.dataset.x,y=+c.dataset.y;if((u.team==="A"&&globalX>2)||(u.team==="B"&&globalX<3))return;
 const x=u.team==="A"?globalX:5-globalX,entry=teams[u.team].find(e=>e.x===u.x&&e.y===u.y&&e.characterId===u.characterId)||teams[u.team].find(e=>e.characterId===u.characterId);
 const occupied=teams[u.team].find(e=>e!==entry&&e.x===x&&e.y===y);
 if(occupied){const ox=entry.x,oy=entry.y;Object.assign(entry,{x,y});Object.assign(occupied,{x:ox,y:oy});}
 else Object.assign(entry,{x,y});
 reset();if(appMode==="game")syncOwnedBoard();
}
function unitMarkup(u){
 const r=byId[u.characterId]||{name:u.name,role:u.role,implemented:true,asset:{}},hp=Math.max(0,u.hp/u.maxHp*100),low=hp<=30,shield=Math.max(0,u.skill?.shield||0),shieldPct=Math.min(Math.max(0,100-hp),shield/u.maxHp*100);
 const visual=r.asset?.sd
  ? `<img class="sd-image" src="${esc(r.asset.sd)}" alt="${esc(u.name)}" draggable="false" onerror="this.remove();this.parentElement.innerHTML='<div class=\\'sd-silhouette\\'><span>${esc(u.name.slice(0,1))}</span></div>'">`
  : `<div class="sd-silhouette"><span>${esc(u.name.slice(0,1))}</span></div>`;
 return `<div class="ground-ring"></div>
  <div class="sd-slot" data-asset="${esc(r.asset?.sd||"")}">${visual}</div>
  <div class="target-marker"></div><div class="hit-vfx"></div><div class="skill-vfx"></div>
  <div class="unit-hud compact-hud">
   <span class="hud-star star-${u.star}" aria-label="${u.star}성">★</span>
   <div class="hpbar ${low?"low":""}" title="${shield>0?`HP ${Math.ceil(u.hp)} / ${Math.ceil(u.maxHp)} · 보호막 ${Math.ceil(shield)}`:`HP ${Math.ceil(u.hp)} / ${Math.ceil(u.maxHp)}`}"><i style="width:${hp}%"></i>${shield>0?`<em class="shield-overlay" style="left:${hp}%;width:${shieldPct}%"></em>`:""}</div>
  </div>`;
}
function render(){
 syncBoardPresentation();
 renderCurrentSynergyPanel();
 board.querySelectorAll('.unit').forEach(e=>e.remove());
 for(const u of units){
  const cell=board.querySelector(`[data-x="${u.x}"][data-y="${u.y}"]`);if(!cell)continue;const e=document.createElement('div');e.className=`unit ${u.team} star-${u.star}${u.dead?' dead':''}${u.ccUntil>time?' cc':''}`;e.dataset.id=u.id;e.innerHTML=unitMarkup(u);
  const ownedEntry=appMode==='game'&&u.team==='A'?teams.A.find(x=>x.x===u.x&&x.y===u.y&&x.characterId===u.characterId&&x.star===u.star):null;
  if(appMode==='game'&&ownedEntry?.ownedId){e.draggable=false;e.dataset.ownedDrag=ownedEntry.ownedId;e.style.touchAction='none';e.addEventListener('pointerdown',ev=>beginOwnedPointerDrag(ev,ownedEntry.ownedId,e))}else{e.draggable=!running&&!battle;e.ondragstart=event=>event.dataTransfer.setData('text/plain',u.id)}
  e.onmouseenter=()=>showInspector(u);e.onfocus=()=>showInspector(u);e.tabIndex=0;cell.appendChild(e);normalizeVisuals(e);
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
 if(result.battleOver){running=false;if(roundState.active&&roundState.phase==="combat")finishRound(result.outcome);else $("#status").textContent=result.outcome;renderTeams()}
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
$("#start").onclick=()=>{if(roundState.active){$("#status").textContent="라운드 모드에서는 준비 완료 버튼으로 전투를 시작해.";return}start()};$("#pause").onclick=()=>{if(!running)return;paused=!paused;$("#pause").textContent=paused?"▶ 재개":"Ⅱ 일시정지"};
$("#step").onclick=()=>{if(!running&&!start())return;paused=true;$("#pause").textContent="▶ 재개";battle.step();battle.step();sync()};
$("#reset").onclick=reset;$("#speed").onchange=e=>speed=+e.target.value;$("#batch").onclick=batch;
for(const id of ["masteryA","masteryB","moveInterval","seed"])$("#"+id).onchange=reset;
buildBoard();ensureInspector();ensureRoundUI();reset();renderRoundUI();ensureAppShell();
