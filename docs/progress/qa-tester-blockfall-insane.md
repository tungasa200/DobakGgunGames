# QA 진행 로그 — BlockfallInsaneBoard 전면 개편

> 담당: qa-tester
> 최초 작성: 2026-04-22
> 기능: BlockfallInsaneBoard 샌드 이펙트/광기 연출/이벤트 동작 전면 개편

## 오늘 완료 (2026-04-22)

| 항목 | 내용 |
|---|---|
| 리서치 | `docs/블록폴 인세인모드(Insane mode) 작업계획.md` 섹션 0/4/11 정독 완료 |
| 리서치 | `BlockfallInsaneBoard.tsx` 전체 훑기 — 이벤트 18종 발동/종료 로직 위치 파악 완료 |
| 리서치 | `BlockfallBoard.tsx` 일반 모드 회귀 기준 확보 완료 |
| 테스트 플랜 초안 | `docs/review/blockfall-insane-test-plan.md` 10개 섹션 풀 버전 작성 완료 (구현 대기 중 선행 초안) |
| 알려진 이슈 정리 | BOARD_TILT 1회 전환 이슈, SPIN_BLOCK 플래그 덮어쓰기, BOARD_EXPAND 모바일 CSS 충돌 파악 |
| 고위험 항목 식별 | FLOOR_DROP/BOARD_EXPAND ctx.scale 재적용 누락 위험, FULL_SAND 전환 프레임 부하 위험 |

> 주: 저장된 테스트 플랜 파일에는 team-lead가 저장 과정에서 planner PRD 확정본 수치(SAND_TICK_INTERVAL 45, SAND_BATCH_SIZE 35, bounces 5, damping 0.60, alpha 0.75/0.90, LIQUID_FLOOD boardW*6 등)를 섹션 3/4/부록 B에 추가 반영함. qa-tester 원본 초안은 planner 확정본 수신 전 작성되었음.

## 2026-04-22 — 정적 코드 검증 세션 (구현 완료 후)

### 판정: CONDITIONAL_PASS

### 검증 방법
- BlockfallInsaneBoard.tsx (1991줄) 전체 코드 정독
- BlockfallInsaneBoard.module.css (636줄) 전체 코드 정독
- tsc -b --noEmit: 에러 0 (통과)
- eslint src/games/blockfall/BlockfallInsaneBoard.tsx: 에러 0 (통과)
- 각 Critical/Blocker/수치 항목 grep으로 직접 확인

### 주요 발견 이슈

#### [BUG-01] Medium — BOARD_TILT skewX 즉시 반영 보장 안 됨
- 위치: BlockfallInsaneBoard.tsx:1735-1737, canvas style 적용부 :1800
- boardSkewStyle이 evBoardTilt.current (ref)를 읽지만, ref 변경은 리렌더를 유발하지 않음
- BOARD_TILT 발동 직후 skewX가 즉시 적용되지 않고 updateDisplay()가 호출되는 시점(낙하 간격 최소 32ms~180ms)까지 지연될 수 있음
- 실제 게임에서는 대부분 빠르게 리렌더가 발생하지만 즉시 보장 없음

#### [BUG-02] Low — 언마운트 시 bannerExitTimerRef 미정리
- 위치: BlockfallInsaneBoard.tsx:1684-1690 (언마운트 useEffect)
- bannerExitTimerRef.current (t2)는 flashTimerIds에도 push되어 있어 실질적 메모리 누수는 없음
- 그러나 언마운트 cleanup에서 bannerExitTimerRef.current에 대한 명시적 clearTimeout이 없음
- 영향: 낮음 (중복 정리 경로 존재)

#### [INFO-01] Planner 확인 필요 — PRD vs 디자인 명세 수치 불일치
- SHATTER_GRAVITY: PRD 섹션 5-5 "0.06→0.04" vs 디자인 명세 섹션 8-5 "0.06→0.08"
  → 구현은 0.08. 테스트 플랜 부록 B는 0.08 기준으로 동기화됨
- SAND_BATCH_SIZE: PRD 섹션 5-5 "25 유지" vs 디자인 명세 섹션 8-5 "25→35"
  → 구현은 35. 테스트 플랜 부록 B는 35 기준
- drawCell motion blur: PRD 섹션 5-5 "3장 연속 (×1.5, ×2.5, ×3.5)" vs 디자인 명세 섹션 1-1 "단일 잔상"
  → 구현은 단일 잔상 방식(디자인 명세 기준)
- 이 항목들은 PRD와 디자이너 명세 간 충돌로 qa-tester가 bug로 판정하지 않음. planner에게 확인 요청.

#### [INFO-02] CSS prefers-reduced-motion 미디어 쿼리 미구현
- 위치: BlockfallInsaneBoard.module.css 전체 (해당 쿼리 없음)
- 디자인 명세 섹션 9-1 "prefers-reduced-motion 적용 시 CSS 애니메이션(insaneBannerIn 등) 비활성" 미구현
- JS 코드에는 prefersReducedMotion.current 체크로 shake/filter 비활성 처리됨 (통과)
- CSS 키프레임 애니메이션(insaneBannerIn, insaneBannerGlitch, insaneRankGlitch)은 reduced-motion 시에도 재생됨
- WCAG 2.3.1 Flash 기준(초당 3회 미만)은 통과하나, 배너 애니메이션 민감 사용자 배려 부족
- 우선순위: Low (JS 레벨 대응으로 core 기능은 처리됨)

### 통과 항목 요약
- 오디오 코드 신규 추가: 없음 (PASS)
- Excel 모드 코드: 없음 (PASS)
- AdminRoute 래퍼: App.tsx에서 유지됨, /blockfall-insane이 /:game보다 먼저 선언됨 (PASS)
- BlockfallBoard.tsx 미수정: git diff 기준 변경 없음 (PASS)
- difficulty state / LEVELS / handleDifficultyChange 코드: 없음 (PASS)
- hard 고정: startGame()에서 level='hard' 고정, rankingsApi 호출 시 'hard' 전달 (PASS)
- shakeRef + triggerShake: 구현됨, draw() 내 ctx.translate 적용 (PASS)
- evBoardTilt ref + tiltDir ref: 구현됨 (PASS)
- simulateSand 내 매 틱 vx 증분: `p.vx = (p.vx + tiltDir.current * 0.4) * 0.8` (PASS)
- settled sand tiltDir 재검사: 구현됨 (PASS)
- clearActiveEvent() 내 evBoardTilt.current = false: 구현됨 (PASS)
- insaneBannerOverlay/insaneBannerBox JSX 구조: 구현됨 (PASS)
- 기존 eventBanner 제거: 코드 내 .eventBanner 미존재 (PASS)
- flashOverlayRef + scheduleFlash: 구현됨 (PASS)
- BOUNCE_WALLS 발동 시 moving sand에 초기 vx ±1.5: 구현됨 (PASS)
- LIQUID_FLOOD 수량 boardW*6: 구현됨 (:866) (PASS)
- EXPLODE 반경 3 (dx*dx+dy*dy <= 9): 구현됨 (:890) (PASS)
- SPIN_BLOCK emoji 🎡: 구현됨 (VORTEX는 🌀) (PASS)
- SAND_TICK_INTERVAL === 45: PASS
- SAND_BATCH_SIZE === 35: PASS
- SHATTER_GRAVITY === 0.08: PASS (PRD 수치와 다르나 디자이너 명세/테스트 플랜 기준 PASS)
- SHATTER_DAMPING === 0.60: PASS
- SHATTER_MIN_SPEED === 0.03: PASS
- moving sand globalAlpha 0.75: PASS (:1187)
- settled sand globalAlpha 0.90: PASS (:1176)
- shatter 잔상 거리 vx*2.5: PASS (:1196)
- shatter 잔상 alpha 0.35: PASS (:1196)
- DARK_SPOTLIGHT 반경 3 (createRadialGradient 0.5,py,3): PASS (:1215)
- DARK_SPOTLIGHT 어둠 alpha 0.98: PASS (:1217)
- VORTEX 구심력 0.8: PASS (:573)
- VORTEX 감쇠 0.9: PASS (:573)
- FLOOR_DROP 확장 행 6: PASS (:971)
- FLOOR_DROP bounces 5: PASS (:993)
- CSS 키프레임 5개 (insaneBannerIn, insaneBannerGlitch, insaneBannerOut, insaneRankGlitch, rankRowSlideIn): PASS
- CSS 클래스 (boardWrapper, flashOverlay, insaneBannerOverlay, insaneBannerBox): PASS
- CSS 클래스 (rankRow1st, rankRow2nd, rankRow3rd, rankRowMine): PASS
- CSS 변수 --insane-bg-deep: #0d0d1a: PASS
- @supports backdrop-filter 폴백: PASS (CSS:100-112)
- tsc -b --noEmit: PASS (에러 0)
- ESLint: PASS (에러 0)

### 조건부 통과 조건
1. [BUG-01] BOARD_TILT skewX 즉시 반영 — developer-frontend가 evBoardTilt를 state로 승격하거나 발동 시 forceUpdate 트리거 방식 개선. 또는 현재 동작 수준이 허용 가능하다면 planner 판단 요청.
2. [INFO-01] SHATTER_GRAVITY / SAND_BATCH_SIZE / drawCell motion blur 스펙 불일치 — planner가 디자인 명세 기준으로 확정하면 현재 구현 PASS, PRD 원문 기준이면 수정 필요.
3. [INFO-02] CSS prefers-reduced-motion — 접근성 요구사항 수준에 따라 developer-frontend 수정 또는 Low 수용.

### 반려 여부
반려: No

Critical/High 버그 없음. BUG-01은 Medium, BUG-02는 Low. PRD 확정 불일치(INFO-01)는 스펙 충돌이므로 bug 처리 불가. 조건부 통과.

## 이월 사항

| 우선순위 | 항목 | 담당 |
|---|---|---|
| Medium | BUG-01 BOARD_TILT skewX 즉시 반영 개선 | developer-frontend 또는 planner 판단 |
| Low | BUG-02 언마운트 bannerExitTimerRef 명시적 정리 | developer-frontend |
| 확인 | INFO-01 PRD vs 디자인 명세 수치 불일치 (SHATTER_GRAVITY 등) | planner |
| Low | INFO-02 CSS prefers-reduced-motion 미디어 쿼리 추가 | developer-frontend |
| 필수(런타임) | 실제 브라우저 동작 검증 (camera shake 체감, 배너 글리치, BOARD_TILT skewX 지연 재현) | qa-tester (브라우저 접근 시) |

## 반려 기준

- Screen Shake / 글리치 Flash 미구현으로 이벤트 발동이 배너 없이 0.5초 내 인지 불가 시 반려
- 어드민 접근 회귀 실패 시 즉시 반려
- 일반 BlockfallBoard 기능 파손 발견 시 즉시 반려
- FLOOR_DROP / BOARD_EXPAND ctx.scale 재적용 누락으로 렌더 파괴 시 Critical 버그 처리
- 오디오 관련 코드가 인세인 모드에 신규 추가된 경우 즉시 반려 (영구 제외 방침 위배)

## 2026-04-22 (2차 — 최종 검증 및 세션 종료)

### 정적 코드 검증 결과
- 판정: CONDITIONAL_PASS → **조건 해소 완료 (PASS)**
- tsc -b: 통과 / ESLint: 통과

### 해소된 이슈
- BUG-01 (BOARD_TILT skewX 지연): boardSkewDeg useState 승격으로 수정 완료
- BUG-02 (배너 타이머 미정리): clearTimeout cleanup 추가 완료

### 잔여 항목 (후순위 — 별도 세션)
- INFO-02: CSS `@media (prefers-reduced-motion)` 키프레임 suppress 미구현
  → JS 레벨 대응은 완료. CSS 레벨은 별도 개선 항목

### 확정 수치 (사용자 결정)
- SHATTER_GRAVITY 0.08 / SAND_BATCH_SIZE 35 / drawCell 1장 잔상 — 디자인 명세 기준 최종 확정

### 브라우저 E2E 검증
- 정적 코드 검증만 수행. 실제 브라우저 체감 검증은 사용자 직접 수행 권장
- 특히 확인 요망: camera shake 강도, 배너 크기/가독성, BOARD_TILT 6초 지속 쏠림

### 다음 세션 할 일
- 없음 (1차 정적 검증 완료)
- 브라우저 체감 후 추가 버그 리포트 있으면 docs/review/blockfall-insane-bugs.md 업데이트
