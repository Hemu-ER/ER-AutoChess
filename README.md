# ER Auto Chess — Free Combat Sandbox

브라우저에서 index.html을 열어 실행한다. 빌드·외부 패키지 설치 없이 동작한다.

## 자유 편성

- A/B 각각 0~3명을 편성한다. 전투 시작에는 양 팀 최소 1명이 필요하다.
- 슈린·마커스·유민·니키·리오·유스티나만 전투 가능하다. 나머지 26명은 로스터에 미구현으로 표시하며 UI와 엔진 모두 투입을 막는다.
- 같은 팀 중복은 금지한다. 상대 팀과 같은 캐릭터 선택은 가능하다.
- 각 기물의 1★/2★/3★, 깊이·라인을 선택한다. 보드 드래그 배치도 가능하다.
- 팀별 숙련도 1~20, seed, 이동 간격을 설정한다. 전투 중 편성 설정은 잠긴다.
- 초기화/재시작/100회 자동전투는 편성과 시작 배치를 유지한다. 초기화는 전투 상태만 지운다.
- 실시간 진행도 엔진과 동일한 고정 0.05초 step을 사용한다.

## 파일 구조

- roster.js: 32명 데이터. id, name, cost, role, affiliations, baseStats, implemented. 전투 코드는 없다.
- combat-engine.js: DOM·타이머·브라우저 API 없는 공통 CombatEngine. Node CommonJS와 브라우저에서 같은 파일을 쓴다.
- game.js: 편성, 입력, 드래그, 화면/로그/통계, 재생 제어만 담당하는 브라우저 어댑터.
- index.html / style.css: 최소 편성 UI와 기존 스타일.
- docs/PROJECT_CONTEXT.md: 확정 규칙 및 개발 체크포인트.

## 공통 엔진 API

~~~js
const {CombatEngine} = require('./combat-engine.js');
const battle = new CombatEngine({
  teamA: [{characterId: 'shurin', star: 2, x: 2, y: 1}],
  teamB: [{characterId: 'shurin', star: 3, x: 2, y: 1}],
  masteryA: 8, masteryB: 8, seed: 24004, moveInterval: 0.5
});
battle.step(); // 최초 호출에 전투 준비 및 시작 효과 적용, 이후 0.05초 진행
const result = battle.run(); // 종료까지 진행. getResult()로 중간/최종 복사본 조회
const events = battle.drainEvents(); // 로그 및 피해 표시 이벤트 소비
~~~

teamA/teamB의 좌표는 각각 로컬 3×3이다. x=0/1/2는 후열/중열/전열, y=0/1/2는 왼쪽/중앙/오른쪽이다. 전투 좌표 변환은 A.x=x, B.x=5-x, y는 유지한다. **행=same y, 열=same x**. 유스티나는 같은 행(same y)을 공격한다.

인스턴스 ID는 A:shurin / B:shurin처럼 팀과 캐릭터 ID로 구분한다. 엔진 입력과 결과는 복사되어 UI 편집이 실행 중 전투에 영향을 주지 않는다. runtime은 기존 저수준 회귀 시나리오를 위한 내부 접근점이며 서버의 외부 클라이언트에 노출할 API가 아니다.

별 성장과 6명의 1★/3★ 스킬 계수는 PROJECT_CONTEXT의 수치를 적용했다. 2★ 스킬의 기능/계수와 기존 전투 순서는 보존했다.

## 피해 통계

~~~text
result.units[attacker].damageSources[sourceName]
  kind / activations / hits / raw / dealt
  targets[targetInstanceId]
    activations / hits / raw / dealt
~~~

출처 발동은 효과 사용 횟수, 대상 발동은 한 출처 발동이 해당 살아있는 대상에 피해 처리를 수행한 횟수다. 한 발동의 다단히트는 대상 발동 1회, hits는 양수 HP 피해 이벤트마다 증가한다. 광역기는 출처 발동 1회와 각 대상 발동 1회를 기록한다. 피해 없는 버프/채널링의 출처 발동은 유지하며 피해 대상이 없으면 targets는 비어 있다. 죽은 대상에 후속 피해를 시도해도 raw/hits/dealt를 추가하지 않는다.

raw는 가드·DEF 적용 전, dealt는 남은 HP로 제한한 유효 피해다. 대상 raw/dealt/hits 합은 출처 합과 같다. 대상 activations 합은 광역기에서 출처 activations보다 클 수 있다. targetStats:false 설정은 검증용으로 대상 집계만 끈다. RNG나 전투 동작을 바꾸지 않는다.

## 테스트

~~~sh
node tests/run.cjs
~~~

- combat.cjs: 기존 23개 이동/슈린/CC/100-seed 검사.
- shurin.cjs: 실제 tick → 평타 → 상태 머신 → 피해/회복/로그/통계 검사.
- damage-stats.cjs: 기존 101-seed 계측 전 회귀 비교와 출처 통계 검사.
- sandbox.cjs: 자유 편성 검증, 전 좌표 변환, 별/숙련도, 6명 실제 스킬 경로, 대상 통계, 엔진 격리, 101-seed 대상 집계 on/off, HEAD 6명 스냅샷 비교.
- runtime-source.cjs / legacy-adapter.js: 기존 테스트의 전역 함수 이름을 실제 공통 엔진에 연결한다. 전투 코드를 복제하지 않는다.
- fixtures/pre-stats.game.js: 기존 계측 전 37ddc12 스냅샷. fixtures/head.game.js: 이번 리팩터링 전 6867fe9 스냅샷. 제품에서는 로드하지 않는다.

## 남아 있는 규칙 차이

이번 변경은 편성/공통 엔진/통계 기반 작업이다. 기존 결과 보존을 위해 기존 순차 행동 처리, 시간 초과 시 A 생존 우선 판정, 유스티나 강화 평타의 다음 포격 카운트 포함은 변경하지 않았다. 체크포인트와의 충돌이며 별도 수정과 회귀 기준 갱신이 필요하다. 일반 타겟팅의 전방 검사도 기존 동작을 유지한다.

이동 간격 0.5초, 리오 거리별 AS 곡선, 마커스 지각변동 CC 1초는 QA 임시값이다. 26명 스킬, 다른 소속/역할 시너지, 아이템/경제/라운드/멀티플레이 서버는 이번 범위에 포함하지 않는다.
