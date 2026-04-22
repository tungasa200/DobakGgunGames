# developer-frontend — Blockfall Insane Overhaul 진행 로그

최종 업데이트: 2026-04-22 (BUG-01/02 수정)
브랜치: WIP
커밋: 374b0ad → BUG-01/02 fix 커밋 예정

---

## 완료 항목

### A. 준비 작업
- [x] `difficulty` state, `LEVELS` 배열, `handleDifficultyChange`, `.diffRow` 전체 제거
- [x] hard 고정: `currentLevelRef` 타입 `string`으로 단순화, 항상 `'hard'`
- [x] 랭킹 탭 단일화: 쉬움/보통/어려움 탭 3개 → "주간 랭킹" + "룰" 2탭
- [x] `rankingsApi.getWeekly('blockfall-insane', 'hard')`, `getAlltimeBest('blockfall-insane', 'hard')` 고정

### B. 파티클 수치 상수 교체
- [x] `SAND_TICK_INTERVAL`: 60 → 45
- [x] `SAND_BATCH_SIZE`: 25 → 35
- [x] `SHATTER_GRAVITY`: 0.06 → 0.08
- [x] `SHATTER_DAMPING`: 0.50 → 0.60
- [x] `SHATTER_MIN_SPEED`: 0.04 → 0.03
- [x] moving sand `globalAlpha` 0.6 → 0.75
- [x] settled sand `globalAlpha` 0.85 → 0.90
- [x] shatter 잔상 거리: `vx * 1.5` → `vx * 2.5` (y 동일)
- [x] shatter 잔상 alpha: 0.25 → 0.35
- [x] SAND_BURST / PIECE_SHATTER / FULL_SAND / LIQUID_FLOOD 초기 vx `Math.random() * 3 - 1.5`, vy `Math.random() * -0.8` 부여
- [x] LIQUID_FLOOD 생성 수: `boardW * 6` (66개), y=0~2 분산
- [x] EXPLODE 반경: 2 → 3 (조건 `dx²+dy² <= 9`)
- [x] Sand 잔상: `|vx|+|vy| > 1.5` 조건 시 `vx*0.8, vy*0.8` 위치에 alpha 0.20 잔상 추가
- [x] vy 최대 낙하속도: 3 → 4
- [x] VORTEX 구심력: 0.3 → 0.8, 감쇠: 0.8 → 0.9
- [x] FLOOR_DROP 확장 행: 4 → 6, 초기 vy: 0.1 → 0.5, bounces: 3 → 5
- [x] DARK_SPOTLIGHT 반경: 6 → 3, 어둠 alpha: 0.95 → 0.98

### C. Camera Shake 시스템
- [x] `shakeRef = { amplitude, duration, total, elapsed }` useRef 신설
- [x] `triggerShake(amplitudePx, durationMs)`: 더 강한 것만 교체, 최대 20px 캡
- [x] draw() 맨 앞 ctx.translate 적용 (sin 함수 기반 오프셋)
- [x] shake 타이머 gameLoop에서 dt만큼 감소
- [x] `prefers-reduced-motion` 시 amplitude=0 강제
- [x] 이벤트별 triggerShake 호출 (EXPLODE 14px/600ms, FLOOR_DROP 8px+18px, FULL_SAND 15px/800ms, RANDOM_LOCK 7px/300ms 등)
- [x] 라인 클리어 shake (4줄 12px/500ms, 2~3줄 6px/300ms, 1줄 3px/150ms)

### D. CSS filter 색 왜곡 시스템
- [x] `filterRef = { fadeMs, fadeTotalMs }` useRef
- [x] `setBoardFilter(filterValue, fadeMs)`: boardRef.current.style.filter 직접 제어
- [x] `clearBoardFilter()`: COLOR_GRAY 중이면 grayscale(1), 아니면 'none'
- [x] gameLoop에서 fadeMs 감소 → 0 되면 clearBoardFilter 호출
- [x] COLOR_GRAY 활성 중 다른 filter 무시 (setBoardFilter 내 evColorGray 체크)
- [x] `prefers-reduced-motion` 시 filter 비활성
- [x] 이벤트별 filter 매핑: FLIP_H `hue-rotate(180deg)`, FLIP_V `invert(1) contrast(1.5)`, VORTEX, FULL_SAND, EXPLODE, FLOOR_DROP, BOARD_TILT, BOARD_EXPAND, LIQUID_FLOOD, CONTROL_FREEZE, DARK_SPOTLIGHT

### E. 경고 Flash 시스템
- [x] `.flashOverlay` div (position: absolute, inset: 0, pointer-events: none) ref 신규 추가
- [x] `scheduleFlash(eventId)`: setTimeout 기반 테두리 alpha 제어
- [x] HIGH 등급 (EXPLODE, FLOOR_DROP, FULL_SAND, CONTROL_FREEZE): T=-350ms 붉은 테두리 + T=0ms 흰 배경 flash
- [x] LOW 등급: T=-200ms 붉은 테두리만
- [x] 타이머 ids flashTimerIds.current에 저장, 언마운트/startGame 시 정리

### F. 대형 배너 재설계
- [x] 기존 `.eventBanner` div 제거
- [x] `.boardWrapper > canvas + .flashOverlay + .insaneBannerOverlay > .insaneBannerBox` 구조 구현
- [x] `EventDef.type` ('visual'|'physical'|'disruptive') 기반 카테고리별 색상 inline style 적용
- [x] `BANNER_COLORS` 상수: visual(#67e8f9), physical(#ff9f0a), disruptive(#ff375f)
- [x] `EventDef.sub` 필드 추가 (부제목)
- [x] `showBanner(def)`: 배너 표시 1800ms 후 `.insaneBannerExiting` 클래스, 2200ms 후 null
- [x] `bannerExiting` state로 `insaneBannerExiting` 클래스 토글
- [x] `aria-live="assertive"` 접근성 적용
- [x] `data-name={eventBanner.name}` — ::after 글리치용

### G. BOARD_TILT 버그 수정
- [x] `evBoardTilt: useRef(false)`, `tiltDir: useRef(0)` 신설
- [x] `simulateSand()` 내 evBoardTilt.current === true이면 `p.vx = (p.vx + tiltDir.current * 0.4) * 0.8`
- [x] settled sand 중 tiltDir 방향 빈 공간 있으면 moving 전환 (매 틱 재검사)
- [x] `clearActiveEvent()`에서 `evBoardTilt.current = false`
- [x] board에 `style={{ transform: skewX(tiltDir * 3deg) }}` JSX inline style
- [x] **BUG-01 fix**: `boardSkewDeg` useState 추가 → BOARD_TILT 발동 시 `setBoardSkewDeg(dir * 3)`, 종료/리셋 시 `setBoardSkewDeg(0)`. JSX boardSkewStyle을 state 기반으로 교체하여 즉각 리렌더 보장 (ref 기반 지연 최대 180ms 제거).

### H. BOUNCE_WALLS 재구현
- [x] 발동 시 모든 moving sand에 초기 vx ±1.5 부여
- [x] 이후 벽 충돌 시 vx 반전+감쇠 0.9

### I. 랭킹 UI 개편
- [x] `.rankSection` background: `#0d0d1a` (CSS 변수 `--insane-bg-deep`)
- [x] `.insaneRankTitle` + `@keyframes insaneRankGlitch` 구현
- [x] `.insaneWord` 클래스 (주황색 "INSANE" 강조)
- [x] 테이블 헤더: `linear-gradient(90deg, #ff2d55, #ff9f0a)`
- [x] `.rankRow1st`, `.rankRow2nd`, `.rankRow3rd`, `.rankRowMine` 클래스 신규 추가
- [x] 역대 1위 배너 `.alltimeBanner` 금색 계열 (rgba(255,214,10,0.06))
- [x] `.atLabel` color: #ffd60a
- [x] `@keyframes rankRowSlideIn` 신규, tr에 stagger animation 적용
- [x] `submittedIdRef` — 제출 성공 id로 본인 행 판별 (동명이인 방지)

### J. CSS 모듈 신규 클래스/키프레임
- [x] 신규 클래스 14개: boardWrapper, flashOverlay, insaneBannerOverlay, insaneBannerBox, insaneBannerEmoji, insaneBannerName, insaneBannerSub, insaneBannerExiting, insaneRankTitle, insaneWord, rankRow1st, rankRow2nd, rankRow3rd, rankRowMine
- [x] 신규 키프레임 5개: insaneBannerIn, insaneBannerGlitch, insaneBannerOut, insaneRankGlitch, rankRowSlideIn
- [x] 반응형: 480px 미만 `min-width: 80%`, 360px 미만 padding/fontSize/emoji 오버라이드
- [x] `@supports (backdrop-filter: blur(6px))` 폴백 처리
- [x] CSS 변수 5개: --insane-accent-1/2/gold/cyan, --insane-bg-deep

### K. SPIN_BLOCK emoji 교체
- [x] `🌀` → `🎡` (VORTEX와 중복 회피)

---

## 빌드/린트 상태
- `tsc -b`: 통과 (에러 0)
- `eslint BlockfallInsaneBoard.tsx`: 통과 (에러 0, 경고 0)
- BUG-01/02 수정 후 재검증: `tsc -b --noEmit` 통과, `eslint` 통과

---

## 미완료 항목 및 사유

없음 (체크리스트 전항목 완료, BUG-01/02 수정 완료)

---

## 구현 중 발견한 이슈

1. **랭킹 행 animation**: CSS 모듈에서 `styles.rankRowSlideIn`이 keyframe 이름이 아닌 undefined를 반환할 수 있어, inline style의 animation에 fallback 문자열 `'rankRowSlideIn'`을 함께 사용. CSS 모듈은 keyframe 이름을 별도 export하지 않으므로 animation name은 항상 변환되지 않은 원래 이름을 사용해야 함. → `${styles.rankRowSlideIn ?? 'rankRowSlideIn'}` 패턴 적용.

2. **FLOOR_DROP canvas 확장**: FLOOR_DROP 발동 시 `canvas.height` 변경 후 `ctx.scale(CELL, CELL)` 재적용 패턴 유지. 기존과 동일.

3. **handleSubmitRanking result 타입**: `rankingsApi.submit` 반환 타입이 unknown이어서 `(result as RankEntry).id` 체크로 방어 처리.

---

## 이월 사항

없음.

---

## 현재 상태

qa-tester 조건부 통과, BUG-01/02 수정 완료.

---

## qa-tester 검증 요청

구현 완료. qa-tester에게 아래 항목 검증 요청:

- `/blockfall-insane` 어드민 진입 및 비어드민 리다이렉트
- 난이도 선택 UI 없음, 게임 시작 시 DROP_SPEEDS['hard'] 적용 (레벨 1=180ms)
- 랭킹 섹션: INSANE 단일 랭킹 (쉬움/보통/어려움 탭 없음)
- 이벤트 발동 시 camera shake 체감
- 지속형 이벤트 활성 중 CSS filter 유지 (FLIP_H hue-rotate 등)
- EXPLODE/FLOOR_DROP/FULL_SAND/CONTROL_FREEZE 발동 전 붉은 테두리 경고
- 배너: 화면 폭 60%+ 덮는 대형 배너, 등장 애니메이션, 1800ms 후 퇴장
- BOARD_TILT: 6초 내내 파티클 한쪽으로 지속 쏠림, skewX 유지, 종료 후 복원
- LIQUID_FLOOD: 66개 파티클, y=0~2 분산 유입
- EXPLODE: 반경 3 제거
- SPIN_BLOCK emoji가 🎡 (VORTEX 🌀과 다름)
- 랭킹 1위 금색, 2위 은색, 3위 동색, 본인 행 붉은 left border
- 오디오 관련 코드 전무
