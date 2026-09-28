# ER AutoChess — PROJECT_CONTEXT

> 새 PC / 새 Codex 세션용 개발 인수인계 체크포인트.
> Codex는 이 문서를 먼저 읽고, 기존 코드와 충돌하면 임의로 규칙을 바꾸지 말고 충돌을 보고한다.

## 0. Codex 작업 원칙
- 실제 코드/테스트로 확인하고 추측하지 않는다.
- 수정 완료 전 실제 파일 수정 → diff → 문법/동작 테스트를 수행한다.
- 확정 규칙 / QA 임시 수치 / 미확정을 구분한다.
- 캐릭터 스킬을 기억이나 추측으로 창작하지 않는다.
- 전투 로직은 DOM/UI와 분리하고 향후 서버에서도 같은 CombatEngine을 쓴다.
- 사용자 요청 없이 확정 규칙/밸런스를 변경하지 않는다.

## 1. 프로젝트 목표
웹 기반 오토배틀러. 최종 목표는 방 생성/참가, 상점, 배치, 자동전투, 라운드를 포함한 서버 권위 멀티플레이 게임이다. 현재 만드는 자유전투 시뮬레이터는 폐기용 별도 앱이 아니라 최종 게임과 동일한 CombatEngine을 사용하는 QA 프론트엔드다.

개발 순서:
CombatEngine → 자유전투 QA → 32명 → 시너지 → 아이템 → 상점/경제/라운드 → 서버 → 멀티플레이.

## 2. 자유전투 목표
- A/B 각각 최대 3명, 32명 중 자유 선택
- 동일 팀 동일 실험체 중복 출전 금지
- 1★/2★/3★ 선택
- 팀별 숙련도
- 각 팀 3×3 자유 배치
- 전투 시작/재시작/일시정지/배속
- seed 기반 재현
- 반복 시뮬레이션
- 캐릭터 총딜 + 피해 출처/피격 대상별 상세 통계
- activations / hits / raw / dealt 분리

## 3. 보드 — 절대 혼동 금지
- 배치 보드 = 플레이어당 3×3
- 전투 보드 = 양측 결합 3×6
- 출전 = 플레이어당 최대 3명
- x = 깊이: 후열↔중열↔전열
- y = 라인: 왼쪽↔중앙↔오른쪽
- 행 = same y = 같은 왼쪽/중앙/오른쪽 라인을 따라 깊이 방향
- 열 = same x = 같은 후열/중열/전열 깊이에서 좌우 방향
- 유스티나 같은 행 공격 = same y 관통
- 버니스 같은 열 공격 = same x 좌/중/우 공격

## 4. 사거리/인접
- Range 1/2/3 유지.
- 대각선 적도 사거리 1이면 공격 가능.
- 단, '인접' 효과는 직교 인접만.
- 따라서 대각선 거리1과 인접은 다른 개념.

## 5. 타겟팅/이동
일반 타겟팅은 같은 전방 라인을 우선하고, 없으면 대각선 후보. 동률은 현재 HP → DEF → 일관된 좌우 tie-break.

캐시 특수 타겟팅:
후열 생존자 → 중열 → 전열. 해당 깊이 안에서 거리/동률 규칙.

이동:
- 공격 가능하면 공격.
- 아니면 전진 우선.
- 접근이 막히면 최근접 살아있는 적 라인 방향으로 직교 1칸 횡이동 가능.
- 대각선 이동 금지, 점유 칸 금지, A/B 대칭, 불필요한 후퇴 금지.

최근 로컬 작업에서 보고된 커밋:
`dab0c2b Fix melee pursuit and Shurin skill state machine`
2026-09-28 사용자 확인: 이전 PC의 로컬 전용 커밋이며 GitHub에 push되지 않았다. 추가 탐색하지 않는다. 이번 개발 기반은 원격 main의 6867fe9이다.

## 6. 동시 처리
같은 timestamp 행동은 함께 확정한다.
행동 확정 → 효과 → 사망 → 사망 트리거/부활 → 전투 종료.
같은 시각에 죽어도 이미 확정된 행동은 실행. 상호 처치 가능. 양측 사망+부활 없음은 무승부.

## 7. 기본 전투 수식
- 공격 간격 = 1 / AS
- DEF 적용 피해 = raw × 100 / (100 + DEF)
- EHP = HP × (1 + DEF/100)
- 고정 피해는 DEF 무시
- Crit은 기본 공격만, 2배, cap100
- 고정 방관, 유효 DEF 최저0 제안
- 강화 기본 공격은 다음 강화 조건의 일반 기본 공격 카운트에 포함하지 않는다.
- 버니스/로지는 한 공격 행동의 두 타격 모두 genuine basic.
- Heart Feedback 추가 피해는 basic 판정 아님.

## 8. 별 성장 QA안
HP/ATK/AMP: 1.00 / 1.70 / 2.80
DEF: 1.00 / 1.15 / 1.40
AS: 1.00 / 1.05 / 1.15 (cap 약4)
Range 고정.
3★=9장. 3★ 1코는 raw power에서 2★ 3코보다 확실히 강한 보상 방향.

## 9. 숙련도
시작1, 라운드 자연+1, 4크레딧→+1, 최대20.
1 초과 레벨당 HP/ATK/DEF/AS/AMP +1%.
숙련도는 상점 확률에도 영향.

## 10. 역할 시너지 QA안
전투 시작 시 최초 3×3 배치 위치로 고정. 이동 후에도 유지.
- 전사 전/중: adaptive+15%, AS+10%, DEF+10, HP+10%
- 탱커 전: DEF+20, HP+20%, AS+10%
- 암살자: 최초 중/후열 대상 공격 시 ATK/AMP+30%
- 원거리 평타 중/후: ATK+20%, AS+20%
- 원거리 스킬 중/후: AMP+25%, AS+10%
- 근거리 스킬 전/중: AMP+20%, AS+15%
- 서포터: 위치 무관, 1명당 팀 adaptive+5%, AS+5%, HP+5% (QA안)

## 11. 32명 로스터
1 멧현우 / 1코 / 전사 / 파자마
2 꿈델라 / 2코 / 원거리 스킬 / 파자마
3 다이린 / 3코 / 전사 / 파자마
4 유키멍 / 2코 / 전사 / 파자마
5 리오 / 2코 / 원거리 평타 / 바니걸
6 유스티나 / 1코 / 원거리 스킬 / 바니걸, 에레보스
7 제니 / 2코 / 원거리 스킬 / 바니걸
8 니키 / 3코 / 전사 / 바니걸
9 슈린 / 3코 / 전사 / 수영복
10 마커스 / 2코 / 탱커 / 수영복
11 이안 / 3코 / 전사 / 마츠리
12 유민 / 2코 / 원거리 스킬 / 수영복
13 데비&마를렌 / 1코 / 전사 / 수영복
14 가넷 / 2코 / 탱커 / 마츠리, 애증
15 케네스 / 1코 / 전사 / 마츠리
16 이렘 / 3코 / 근거리 스킬 / 마츠리
17 라우라 / 3코 / 근거리 스킬 / 프리즌
18 비앙카 / 2코 / 원거리 스킬 / 프리즌
19 캐시 / 3코 / 암살자 / 프리즌
20 아비게일 / 1코 / 전사 / 프리즌
21 레니 / 1코 / 서포터 / 군악대
22 하트 / 1코 / 원거리 평타 / 군악대
23 아이솔 / 1코 / 원거리 평타 / 새해
24 클로에 / 2코 / 원거리 평타 / 새해
25 수아 / 2코 / 전사 / 새해
26 요한 / 1코 / 서포터 / 데몬헌터
27 나딘 / 3코 / 원거리 평타 / 데몬헌터
28 버니스 / 2코 / 원거리 평타 / 데몬헌터
29 로지 / 1코 / 원거리 평타 / 메이드
30 아야 / 3코 / 원거리 스킬 / 메이드
31 미르카 / 3코 / 탱커 / 메이드
32 샬럿 / 1코 / 서포터 / 치유의 노래
비용 분포 1코11 / 2코11 / 3코10. 슈린은 반드시 3코.

## 12. 1★ 기본 스탯
형식: HP,ATK,DEF,AS,AMP,Range
멧현우 1080,76,39,0.88,38,1
꿈델라 760,50,21,0.80,126,3
다이린 1030,78,36,0.92,42,1
유키멍 1110,72,42,0.84,36,1
리오 735,76,18,1.08,24,3
유스티나 770,51,21,0.84,112,3
제니 745,50,19,0.86,118,3
니키 1010,62,38,0.86,104,1
슈린 965,80,31,0.98,34,1
마커스 1260,60,53,0.75,24,1
이안 925,79,30,0.90,32,1
유민 755,48,20,0.80,122,3
데비&마를렌 1060,70,38,0.88,34,1
가넷 1210,50,48,0.76,72,1
케네스 1015,73,34,0.88,32,1
이렘 850,56,27,0.91,128,1
라우라 865,55,28,0.88,124,1
비앙카 735,46,18,0.76,132,3
캐시 805,54,23,0.72,136,1
아비게일 990,60,34,0.87,92,1
레니 845,46,27,0.78,88,2
하트 720,64,17,1.04,22,3
아이솔 750,72,18,1.02,20,3
클로에 690,65,16,0.94,20,3
수아 1080,58,39,0.82,102,1
요한 830,44,28,0.76,90,2
나딘 730,67,17,0.94,20,3
버니스 780,58,22,0.72,18,2
로지 705,59,16,0.78,18,3
아야 720,48,18,0.82,128,3
미르카 1370,52,58,0.72,36,1
샬럿 860,43,29,0.75,94,2

## 13. 소속 시너지
파자마: 2/3이면 10초마다 랜덤 적 수면 1/1.5초. basic/skill 피해 시 해제+추가 피해. 과거 AMP100/200 초안, adaptive 전환 미확정.

바니걸 현재 QA: 2=평타 20% 확률 adaptive40% 추가. 3=35% 확률 adaptive50%.

수영복: 2=공유 기본공격20회마다 모든 적 maxHP3% 고정. 3=15회마다 5%.

마츠리: 죽음 후 부활해도 처치 이벤트. 같은 유닛 재사망도 다시 처치.
2=처치 시 팀 5초 ATK/AMP+15%, maxHP+15%.
3=10초 +30/+30. 중첩X, 재발동 갱신.

프리즌: 스택은 damage instance가 아니라 attack event 기준. 같은 사용이 다단히트여도 대상당 최대1회. AoE는 대상별1회. 2=+1, 3=+2. CC 중 대상 스택X. 20스택 CC 후 reset. 2=1초, 3=1.5초. 프리즌 소속이 받는 CC 50%.

군악대: 1=회복받은 아군 5초 ATK/AMP+10%, AS+10%. 2=10초 +20/+20. 해당 아군만, refresh no stack.

새해: 1=maxHP+5%, DEF+10, 10회 피격 후 제거. 2=+10/+20,20회. 3=+20/+30,30회.

데몬헌터: 현재 2 adaptive+30%, 3 +60%.

메이드:
2=basic당 청소+10, max200. 20마다 팀 DEF+1 max+10. 200 소비→팀 maxHP10% heal.
3=basic당+20. 100까지 DEF 누적 max+15. 100→200 회복충전. 200→팀15% heal+reset.

애증: 가넷에게 케네스가 아군/적으로 존재하면 AMP+30%, AS+30%, maxHP+20%, DEF+20%.

치유의 노래: 샬럿 Healing Light 발동 시 모든 아군을 샬럿 AMP100%만큼 회복.

소속 티어는 전투 시작 시 한 번 계산하고 전투 종료까지 고정. 사망/부활/소환으로 재계산하지 않음. 공유 카운터도 유지.

## 14. CC/상태
CC=행동불능. 수면은 별도 debuff+CC.
CC 중 basic/move/channel/skill activation 불가.
CC overlap은 긴 남은 시간 우선, additive 아님.
무적은 damage만 차단. CC immunity가 없으면 CC/debuff 적용 가능.
DOT는 붙지만 무적 중 tick=0.
불사 HP>=1.
기본 channel은 CC로 취소되고 조건 재충전. 꿈델라만 0.5초 channel 중 invulnerable+CC immune.

## 15. Nina
실제 칸 차지, targetable, 독립 basic, skill 없음, Chloe 스탯 비례. 실험체 아님. synergy count/trigger X, revive X, Chloe 죽으면 제거.

## 16. 캐릭터 기능/계수 체크포인트
멧현우: dog ATK200/250/400, heal maxHP8/10/15, bluff DEF20/30/50.
꿈델라: Check AMP150/200/350 + Pawn50/75/150, Promotion40/60/100.
다이린: drunk basic extra50/75/150, 10회마다 extra50/75/100.
유키멍: Head200/250/400, Button50/75/150.
리오: Shot300/400/700, adjacent half. Kaeyumi max AS+30/40/70; 거리곡선 미확정(과거 QA 1,2/3,1/3).
유스티나: same-y 행 관통. 현재 QA 행 공격 AMP70/95/170, next basic extra35/50/90.
제니: Persona150/200/300, revive HP20/30/50, post AS+30/50/100.
니키: Hot ATK/AMP/AS+20/30/50, Guard20/20/40%, DR80%, Counter AMP75/100/200.
슈린: Resolve100/150/250, heal dealt의50%. 일반 basic 3회 후 다음 basic에 Resolve. Resolve 3회 사용 후 만검귀종: 직교 인접 적 ATK200/250/450, 이후 3초 모든 basic에 Resolve. 강화기간 Resolve는 다음 만검귀종용 3회 카운트에 포함하지 않는 방향. 최근 QA에서 2★: basic6회 raw1004.1/dealt469.7, Resolve1회 raw251/dealt160.1, 만검귀종0.
마커스: all enemies ATK150/200/300, Shock extra150/200/350. 상세 trigger/CC는 원본과 코드 대조.
이안: revive40/50/70%, post AS+50/75/150, lifesteal20/30/50, initial ATK-20.
유민: battle start all AMP100/150/250, Wind DOT40/60/100 per sec, max-stack extra75/100/200. 'basic4회 후 skill'은 과거 잘못된 구현.
데비&마를렌: Rush150/200/350, next5 basics currentHP3/4/7%.
가넷: Chain target maxHP10/15/25, basic reduction15/25/40, execute10/15/25. 처형 후 revive 허용.
케네스: shield ATK300/400/700, lifesteal10/15/25, shield ATK/AS+20/30/60.
이렘: Punch AMP300/400/700, fish shield200/300/500.
라우라: AoE AMP150/200/350, Thief next basic100/150/250.
비앙카: AMP300/400/700 + target maxHP10/15/25, Short Rest90% DR+50% heal once.
캐시: AMP250/350/600 + target maxHP10/15/25 fixed, team gradual heal total5/10/20%; duration 미확정.
아비게일: AoE AMP100/150/250, DEF shred5/8/15 per basic.
레니: Trap AMP150/200/350, Goldberg AMP50/75/125 + same heal.
하트: heal maxHP10/15/25, Feedback ATK30/40/60×2.
아이솔: 기능 확정. Active 목제 폭탄=10초마다 적 전체 공격. QA ATK100/150/250. Passive 유격전 ATK/AS+15/25/50.
클로에 Nina: HP60/75/100%, ATK50/70/100, DEF70/85/100, AS80/90/100.
수아: Odyssey AMP150/200/350, damage lifesteal30/40/60, Mind Food basic AMP50/75/125 + maxHP heal2/3/5.
요한: Sanctuary DEF+20/30/50, heal/sec maxHP5/7/10×4, adjacent aura ATK/AMP/AS+10/15/25.
나딘: Wild +1/sec max10 no consumption, stack당 ATK&AS+2.5/3.75/5%. Wolf next3 basics extra ATK100/150/300. 반복 trigger 미확정.
버니스: same-x 열. shotgun genuine basics 2회 각70% QA. legshot 같은 열(same x). 상세는 원본 대조.
로지: Semtex target maxHP8/12/20, Double genuine basics60/65/75×2.
아야: Fear AoE AMP200/300/500, Fixed next5 basics extra75/100/200, AS+100%.
미르카: shield maxHP20/30/50. own maxHP10/15/25 damage는 과거 QA 가정; 정확한 basis 미확정.
샬럿: Miracle1.5s invuln, Healing AMP100/150/250, buff+10/15/30.

## 17. QA 통계 구조
범용:
attacker → source → target
source마다 activations, hits, raw, dealt.
AoE는 activations1/hitsN 가능.
피해 없는 buff/CC/heal도 activations 기록 가능.
오버킬 dealt는 남은 HP까지만.
통계 추가 전후 동일 seed의 승패/HP 변화가 동일해야 한다.

## 18. 아이템 시즌1
순수 stat, max3, basic2개→completed, dismantle X, sell O, battle lock, duplicate completed O, range item X.
기본: 검집 ATK7 / 금팔찌 AMP12 / 방탄 HP100 / 사슬 DEF14 / 화살 AS10% / 전자 Crit10% / 철사 Pen12.
완성:
오토-암즈 ATK14; 블레이드 부츠 ATK7+AMP12; 스펙터 ATK7+HP100; 아오자이 ATK7+DEF14; 미스릴 퀴버 ATK7+AS10%; 레이더 ATK7+Crit10%; 서슬가시 체인 ATK7+Pen12; 임세티 AMP24; 레버넌트 AMP12+HP100; 요명월 AMP12+DEF14; 텔루리안 타임피스 AMP12+AS10%; 용의 비늘 AMP12+Crit10%; 천룡잠 AMP12+Pen12; 미스릴 크롭 HP200; 배틀 슈트 HP100+DEF14; 팬텀 자켓 HP100+AS10%; 타이탄 아머 HP100+Crit10%; 유령 신부의 드레스 HP100+Pen12; 가디언 슈트 DEF28; 길리 슈트 DEF14+AS10%; 화령장 DEF14+Crit10%; 슈팅스타의 자켓 DEF14+Pen12; 살라딘의 화살통 AS20%; 레가투스 AS10%+Crit10%; 블래스터 헬멧 AS10%+Pen12; 운명의 주사위 Crit20%; 프시케의 칼날 Crit10%+Pen12; 아이언 메이든 Pen24.

## 19. 경제/상점
이자 없음. shop5. 매 round 무료 refresh. freeze 무료. shared pool. bench8. auto merge. buy1/2/3.
sell 1★=1/2/3, 2★=2/3/5, 3★=5/9/14.
탈락 기물 즉시 pool 반환. players2~8 default4. streak 없음.
pool per unit type 1/2/3코:
2p 11/10/9, 3p13/11/10, 4p15/13/11, 5p17/14/12, 6p19/15/13, 7p21/16/14, 8p23/17/15.

## 20. 라운드 초안
R1 supply+shop no combat
R2 wildlife
R3 mock PvP no HP
R4 first real
R5 event+PvP
R6 bounty/objective PvP
R7 carousel
R8 elite+final supply
R9-11 End PvP
R12 Death Zone
R13 Final Restriction
loss dmg: R3 0,R4 7,R5 8,R6 10,R9 13,R10 16,R11 20,R12 28,R13 40. Player HP100.
timeout 후보60s; 남은 HP 비율 합 비교, exact tie draw.

## 21. UI/그래픽 방향
기존 둥근 카드+둥근 버튼+보라/파랑 gradient+과한 shadow의 SaaS/AI 생성 웹 UI 방향은 폐기.
사용자가 과거 트친소 메이커 재탕처럼 느낀다고 평가함.

새 방향:
- 실제 게임 클라이언트 같은 화면
- 보드가 주인공
- dark tactical / cyber-industrial HUD
- 짙은 무채색
- 제한된 팀 accent
- 얇고 각진 panel
- 정보 밀도 높은 작은 typography
- 최소 shadow
- 과도한 rounded corner 금지
- purple gradient 남발 금지
- portrait roster
- QA panel/log는 접이식/보조 영역
- 최근 제시한 두 번째 UI 컨셉 보드 방향을 사용자가 선호
- 생성 시안 이미지를 실제 리소스로 그대로 쓰는 것은 아님. 레이아웃/분위기 참고용.

## 22. 멀티플레이 아키텍처
최종 server-authoritative.
서버 권위: round, HP, credits, mastery, owned units, bench, placement, shared pool, shop, combat result.
첫 온라인 목표: 2인 room code/invite → ready → shop/placement → battle → next round.
CombatEngine은 DOM/UI에 의존하지 않는다.

예:
const battle = new CombatEngine(config);
battle.step();
battle.run();
const result = battle.getResult();

config:
{ teamA:[{characterId,star,x,y}], teamB:[...], masteryA, masteryB, seed }

## 23. 과거 사고 — 반복 금지
- 유민/슈린/마커스 등 스킬을 원본과 다르게 임의 단순화한 적 있음.
- 슈린을 1코로 잘못 QA한 적 있음 → 슈린 3코.
- 유스티나 공격 축을 뒤집은 적 있음 → 같은 행=same y.
- 아이솔 기능을 미확정 취급한 적 있음 → 기능 확정, 계수만 QA.
- 손계산을 실제 simulator 결과처럼 서술한 적 있음 → 실제 엔진/손계산/추론 구분.
- 실제 파일 수정 없이 수정 완료라고 말한 사고가 있었음 → 실제 diff/test 필수.

## 24. 엔진 점검 목록
저장소를 읽고 이미 해결/미해결 구분:
- simultaneous timestamp
- movement interval
- first attack timing
- Cathy targeting
- Rio channel
- Sua heal
- Abigail timing
- Nicky details
- New Year removal
- Matsuri death/revive
- Chloe/Nina
- unique instance IDs
- same-name key collision
- item AS
- A/B mirror
- enhanced-basic counter
- statistics must not alter battle

## 25. 다음 작업
Phase A 자유전투 구조:
roster data 분리, ID 기반, 팀 최대3, star/mastery, 3×3 자유배치, 3×6 변환, 미구현 표시, CombatEngine/UI 분리, seed, QA 통계, regression tests.

Phase B 32명:
1~8 → 검증 → 9~16 → 검증 → 17~24 → 검증 → 25~32 → 검증.
각 캐릭터는 원본 기능/계수 대조 → 단위 테스트 → 특수 상호작용 → 자유전투 확인.

그 뒤 synergy → items → economy/round → multiplayer.

## 26. Source of Truth 우선순위
1. 최신 확정 규칙 / 이 PROJECT_CONTEXT.md
2. ER_오토체스_통합기획서_v0.2.1_체크포인트.docx
3. ER_오토체스_32명_캐릭터_상세설정_v1.1.docx
4. 원본 시너지 작성 파일
5. 기본 스탯 초안
6. 과거 v0.2/v0.1
7. 오래된 simulator/prototype

과거 문서의 '전투 보드 3×3'은 폐기. 최신은 배치3×3/전투3×6.
이 문서는 상세 캐릭터 원본의 모든 문장을 대체하지 않는다. 원본이 있으면 반드시 함께 대조한다.

## 27. 새 Codex 세션 첫 지시문
먼저 `docs/PROJECT_CONTEXT.md` 전체를 읽고 프로젝트의 현재 개발 규칙과 체크포인트를 파악해. 그 다음 저장소 전체를 조사해서 현재 코드가 이 문서와 어디까지 일치하는지 확인해. 아직 코드는 수정하지 마. 특히 CombatEngine/UI 분리 상태, 3×3→3×6 좌표 변환, 이동/타겟팅, 슈린 상태 머신, 피해 출처/대상별 통계, 현재 구현 캐릭터 목록, 테스트 상태를 확인해. 문서와 코드가 충돌하면 코드가 맞다고 가정하지 말고 충돌 목록을 보고해. 마지막으로 현재 저장소 HEAD/branch/최근 커밋도 알려줘.

---
핵심: **자유전투 시뮬레이터는 최종 게임과 별개가 아니다. 최종 멀티플레이에서도 사용하는 공통 CombatEngine을 먼저 만들고 그 위에 QA UI를 얹는다.**


## 28. 2026-09-28 자유전투 기반 구현

32명 ID 로스터 분리, 구현된 6명만 A/B 최대3명 선택, 별1~3, 팀별 숙련도, 팀 로컬3×3→전투3×6 변환, DOM 없는 공통 CombatEngine, 대상별 피해 통계를 추가했다. 기존 2★ 전투 동작을 보존하며 새 26명 스킬은 구현하지 않았다. 상세 API·테스트·남은 규칙 충돌은 README.md를 참고한다. 위 확정 규칙을 기존 코드 동작으로 대체하지 않는다.
