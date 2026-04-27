# 테스트 플랜 — 블록폴 배틀 UI 개편 (Phase 2, 다크 테마 v2)

- 작성자: qa-tester
- 작성일: 2026-04-27
- 근거 문서:
  - `docs/design/blockfall-battle-components.md` §UI 개편 델타 — v2
  - `frontend/src/styles/blockfall-battle.css` (변경 전 기준)
  - `frontend/src/pages/BlockfallBattlePage.tsx` (변경 전 기준)
- 범위: **순수 시각/레이아웃 개편** — 게임 로직·WebSocket·매칭 변경 없음
- Excel 모드: N/A (PRD §3 명시, 일반 모드 전용)

---

## TC-THEME: 다크 테마 적용 체크리스트

### 카드 배경 #1c2128 적용 여부

| # | 대상 요소 | CSS 클래스 | 기대 값 | 확인 방법 |
|---|---|---|---|---|
| T-01 | 상대 보드 카드 배경 | `.battle-board-item` | `background: #1c2128` | CSS 파일 확인 |
| T-02 | 결과 화면 순위 패널 배경 | `.result-panel` | `background: #1c2128` | CSS 파일 확인 |
| T-03 | TOP 10 랭킹 패널 배경 | `.ranking-panel` | `background: #1c2128` | CSS 파일 확인 |
| T-04 | 대기자 목록 항목 배경 | `.waiting-player-item` | `background: #1c2128` | CSS 파일 확인 |
| T-05 | 큐 대기 정보 패널 배경 | `.waiting-queue-info` | `background: #1c2128` | CSS 파일 확인 |

### 카드 테두리 #30363d 적용 여부

| # | 대상 요소 | CSS 클래스 | 기대 값 | 확인 방법 |
|---|---|---|---|---|
| T-06 | 상대 보드 카드 테두리 | `.battle-board-item` | `border: 1.5px solid #30363d` | CSS 파일 확인 |
| T-07 | 보드 카드 헤더 하단선 | `.battle-board-item-header` | `border-bottom-color: #30363d` | CSS 파일 확인 |
| T-08 | 대기자 목록 항목 테두리 | `.waiting-player-item` | `border-color: #30363d` | CSS 파일 확인 |
| T-09 | 큐 대기 정보 패널 테두리 | `.waiting-queue-info` | `border-color: #30363d` | CSS 파일 확인 |
| T-10 | 결과 순위 항목 구분선 | `.result-item` | `border-bottom-color: #30363d` | CSS 파일 확인 |
| T-11 | TOP 10 항목 구분선 | `.ranking-panel-item` | `border-bottom-color: #30363d` | CSS 파일 확인 |
| T-12 | 결과 패널 테두리 | `.result-panel` | `border-color: #30363d` | CSS 파일 확인 |
| T-13 | TOP 10 패널 테두리 | `.ranking-panel` | `border-color: #30363d` | CSS 파일 확인 |

### 헤더 배경 #21262d 적용 여부

| # | 대상 요소 | CSS 클래스 | 기대 값 | 확인 방법 |
|---|---|---|---|---|
| T-14 | 보드 카드 닉네임 헤더 배경 | `.battle-board-item-header` | `background: #21262d` | CSS 파일 확인 |

### 텍스트 색상 #e6edf3 / #8b949e 적용 여부

| # | 대상 요소 | CSS 클래스 | 기대 값 | 확인 방법 |
|---|---|---|---|---|
| T-15 | 보드 헤더 텍스트 색상 | `.battle-board-item-header` | `color: #e6edf3` | CSS 파일 확인 |
| T-16 | 닉네임 텍스트 색상 | `.battle-board-nickname` | `color: #e6edf3` | CSS 파일 확인 |
| T-17 | 점수 텍스트 색상 | `.battle-board-score` | `color: #8b949e` | CSS 파일 확인 |
| T-18 | 대기자 닉네임 텍스트 | `.waiting-player-name` | `color: #e6edf3` | CSS 파일 확인 |
| T-19 | 큐 대기 텍스트 | `.waiting-queue-info` | `color: #e6edf3` | CSS 파일 확인 |
| T-20 | 대기 화면 타이틀 | `.waiting-title` | `color: #f0f6fc` | CSS 파일 확인 |
| T-21 | 카운트다운 타이틀 | `.waiting-title-countdown` | `color: #f0f6fc` | CSS 파일 확인 |
| T-22 | 대기 서브 텍스트 | `.waiting-sub` | `color: #8b949e` | CSS 파일 확인 |
| T-23 | 결과 패널 제목 | `.result-panel-title` | `color: #f0f6fc` | CSS 파일 확인 |
| T-24 | 결과 화면 메인 제목 | `.result-title` | `color: #f0f6fc` | CSS 파일 확인 |
| T-25 | 결과 닉네임 | `.result-nickname` | `color: #e6edf3` | CSS 파일 확인 |
| T-26 | TOP 10 패널 제목 | `.ranking-panel-title` | `color: #f0f6fc` | CSS 파일 확인 |
| T-27 | TOP 10 닉네임 | `.ranking-panel-nickname` | `color: #e6edf3` | CSS 파일 확인 |

### 스피너 포인트 컬러 통일

| # | 대상 요소 | CSS 클래스 | 기대 값 |
|---|---|---|---|
| T-28 | 매칭 중 스피너 | `.battle-spinner` | `border-top-color: #6366F1` (현재 `#58a6ff` → 변경) |

### 밝은 값 잔존 여부 검사 (다음 값들이 배틀 카드/패널에 남아있으면 버그)

검사 대상 파일: `frontend/src/styles/blockfall-battle.css`

아래 색상값이 카드·패널 관련 셀렉터에 잔존하면 즉시 버그 등록:
- `#FFFFFF` — `.battle-board-item`, `.result-panel`, `.ranking-panel`, `.waiting-player-item`에 남아있는지
- `#F9FAFB` — `.battle-board-item-header`, `.waiting-player-item`에 남아있는지
- `#F3F4F6` — `.waiting-queue-info`에 남아있는지
- `#E5E7EB` — 카드 테두리, 구분선에 남아있는지
- `#374151` — 닉네임/텍스트 색상에 남아있는지
- `#111827` — `--color-text-primary` 재정의 전 원본 값, 카드 내부 텍스트에 직접 사용 여부
- `#6B7280` — `.result-nickname`, `.battle-board-score`에 남아있는지
- `#F5F5F5` — 구분선에 남아있는지

---

## TC-PANEL: 사이드패널 구조 검증

내 게임판에 신규 사이드패널이 추가되는지 검증한다. 대상 파일: `BlockfallBattleBoard.tsx`, `blockfall-battle.css`.

| # | 검증 항목 | 기대 결과 |
|---|---|---|
| P-01 | NEXT canvas ref(`nextRef`) 존재 여부 | `BlockfallBattleBoard.tsx`에 `nextRef` 선언 및 `<canvas ref={nextRef}>` 존재 |
| P-02 | NEXT canvas 크기 90×90px | CSS `.battle-side-box` 내 canvas width/height 90px |
| P-03 | HOLD canvas ref(`holdRef`) 존재 여부 | `BlockfallBattleBoard.tsx`에 `holdRef` 선언 및 `<canvas ref={holdRef}>` 존재 |
| P-04 | HOLD canvas 크기 90×90px | CSS 기준 동일 |
| P-05 | `.battle-my-play-area` 신규 CSS 클래스 존재 | `blockfall-battle.css`에 `.battle-my-play-area { display: flex; flex-direction: row; }` |
| P-06 | `.battle-my-side-panel` 신규 CSS 클래스 존재 | `blockfall-battle.css`에 `.battle-my-side-panel { width: 90px; }` |
| P-07 | `.battle-side-box` 신규 CSS 클래스 존재 | NEXT/HOLD 박스 래퍼 |
| P-08 | `.battle-side-title` 신규 CSS 클래스 존재 | 사이드 레이블 (NEXT/HOLD 텍스트) |
| P-09 | `.battle-stats-area` 신규 CSS 클래스 존재 | `margin-top: auto` 포함 여부 |
| P-10 | `.battle-stat-row` 신규 CSS 클래스 존재 | 각 스탯 항목 |
| P-11 | `battle-stats-bar` 제거 여부 | `.battle-stats-bar`가 JSX에서 사용되지 않음 (CSS에는 잔존 가능, JSX에서 미사용 확인) |
| P-12 | statsArea에 SCORE 표시 | JSX에 "SCORE" 레이블 + 점수 값 렌더링 |
| P-13 | statsArea에 LINES 표시 | JSX에 "LINES" 레이블 + 줄 값 렌더링 |
| P-14 | statsArea에 LEVEL 표시 | JSX에 "LEVEL" 레이블 + 레벨 값 렌더링 |
| P-15 | combo >= 2 시 COMBO 표시 | `{combo >= 2 && <div className="battle-stat-row combo">...}` 패턴 존재 |
| P-16 | combo < 2 시 COMBO 미표시 | combo=1 이하 시 COMBO 행 렌더링하지 않음 |
| P-17 | NEXT canvas 레이블 텍스트 "NEXT" | `.battle-side-title` 내 "NEXT" 텍스트 |
| P-18 | HOLD canvas 레이블 텍스트 "HOLD" | `.battle-side-title` 내 "HOLD" 텍스트 |

---

## TC-SCREEN: 화면별 검증 (7개 화면)

각 화면에서 다크 테마 일관성과 필수 요소를 검증한다.

### loading 화면

| # | 검증 항목 | 기대 결과 |
|---|---|---|
| S-01 | 다크 배경 유지 | `.battle-page` background `#0d1117` |
| S-02 | 스피너 컬러 | `.battle-spinner` border-top-color `#6366F1` (기존 `#58a6ff`에서 변경) |
| S-03 | 로딩 점 3개 애니메이션 추가 여부 | 디자인 델타 §5 loading 개선: "매칭 중..." 텍스트 아래 `bb-dot-blink` 적용 점 3개 존재 여부. 미구현 시 Medium 버그 |
| S-04 | "매칭 중..." 텍스트 존재 | JSX에 텍스트 존재 |

### waiting 화면

| # | 검증 항목 | 기대 결과 |
|---|---|---|
| S-05 | 대기자 목록 항목 배경 다크 | `.waiting-player-item` background `#1c2128` |
| S-06 | 대기자 목록 항목 테두리 다크 | `.waiting-player-item` border-color `#30363d` |
| S-07 | 대기자 닉네임 텍스트 다크 | `.waiting-player-name` color `#e6edf3` |
| S-08 | "플레이어 대기 중" 타이틀 색상 | `.waiting-title` color `#f0f6fc` |
| S-09 | 로딩 점 3개 표시 | `waiting-dots-row` + 3개 `.waiting-dot` 존재 |
| S-10 | 참가자 목록 role="list" | `<ul role="list">` 존재 |
| S-11 | 나가기 버튼 존재 | `.waiting-leave-btn` 존재 |

### countdown 화면

| # | 검증 항목 | 기대 결과 |
|---|---|---|
| S-12 | 카운트다운 타이틀 텍스트 색상 | `.waiting-title-countdown` color `#f0f6fc` |
| S-13 | 카운트다운 숫자 색상 | `.waiting-countdown-number` color `var(--battle-accent)` = `#6366F1` |
| S-14 | 카운트다운 숫자 64px | font-size 64px (desktop 기준) |
| S-15 | 카운트다운 숫자 role="timer" | `role="timer"` + `aria-live="assertive"` |

### queued 화면

| # | 검증 항목 | 기대 결과 |
|---|---|---|
| S-16 | 큐 대기 패널 배경 다크 | `.waiting-queue-info` background `#1c2128` |
| S-17 | 큐 대기 패널 테두리 다크 | `.waiting-queue-info` border-color `#30363d` |
| S-18 | 큐 대기 텍스트 색상 | `.waiting-queue-info` color `#e6edf3` |
| S-19 | "현재 게임 진행 중입니다" 텍스트 존재 | JSX 확인 |
| S-20 | 나가기 버튼 존재 | `.waiting-leave-btn` 존재 |

### playing 화면

| # | 검증 항목 | 기대 결과 |
|---|---|---|
| S-21 | 상대 보드 카드 배경 다크 | `.battle-board-item` background `#1c2128` |
| S-22 | 상대 보드 카드 테두리 다크 | `.battle-board-item` border-color `#30363d` |
| S-23 | 보드 카드 헤더 배경 다크 | `.battle-board-item-header` background `#21262d` |
| S-24 | 내 보드 강조 테두리 유지 | `.battle-board-item.mine` border-color `#6366F1` |
| S-25 | 내 보드 사이드패널 렌더링 | TC-PANEL P-01~P-18 항목 |

### finished 화면

| # | 검증 항목 | 기대 결과 |
|---|---|---|
| S-26 | 결과 제목 색상 | `.result-title` color `#f0f6fc` |
| S-27 | 결과 패널 배경 다크 | `.result-panel` background `#1c2128` |
| S-28 | 결과 패널 테두리 다크 | `.result-panel` border-color `#30363d` |
| S-29 | TOP 10 패널 배경 다크 | `.ranking-panel` background `#1c2128` |
| S-30 | TOP 10 패널 테두리 다크 | `.ranking-panel` border-color `#30363d` |
| S-31 | 본인 행 강조 다크 기조 | `.result-item-mine` background `rgba(99,102,241,0.15)` (기존 `#EEF2FF`) |
| S-32 | 본인 행 강조 테두리 다크 기조 | `.result-item-mine` border-color `rgba(99,102,241,0.4)` (기존 `#C7D2FE`) |
| S-33 | 순위 목록 role="list" | `<ul role="list" aria-label="이번 배틀 순위">` 존재 |
| S-34 | TOP 10 role="list" | `<ul role="list" aria-label="역대 승수 TOP 10">` 존재 |
| S-35 | 결과 닉네임 텍스트 다크 | `.result-nickname` color `#e6edf3` |
| S-36 | TOP 10 닉네임 텍스트 다크 | `.ranking-panel-nickname` color `#e6edf3` |
| S-37 | "다시 배틀" 버튼 존재 | `.battle-btn-primary` 존재 |
| S-38 | "홈으로" 버튼 존재 | `.battle-btn-secondary` 존재 |

### error 화면

| # | 검증 항목 | 기대 결과 |
|---|---|---|
| S-39 | 에러 아이콘 색상 강조 | `.battle-error-icon` 또는 `⚠` 요소에 `color: #EF4444` 적용 |
| S-40 | "연결 오류" 제목 색상 | `.battle-error-title` color `#f0f6fc` |
| S-41 | "다시 시도" 버튼 존재 | `.battle-btn-primary` 존재 |
| S-42 | "홈으로" 버튼 존재 | `.battle-btn-secondary` 존재 |
| S-43 | 에러 코드 한글 설명 맵핑 | `ROOM_NOT_FOUND` / `NOT_IN_ROOM` / `UNAUTHORIZED` / `MATCH_UNAVAILABLE` 분기 존재 |

---

## TC-RESPONSIVE: 반응형 검증 케이스

### Desktop (1280px+ / 769px+)

| # | 검증 항목 | 기대 결과 |
|---|---|---|
| R-01 | 2인 게임 그리드 | `.battle-board-container.players-2` → `grid-template-columns: 1fr 1fr` |
| R-02 | 3인 게임 그리드 | `.battle-board-container.players-3` → `3fr 2fr`, 첫 번째 아이템 `grid-row: 1 / span 2` |
| R-03 | 4인 게임 그리드 | `.battle-board-container.players-4` → `1fr 1fr`, `grid-template-rows: 1fr 1fr` |
| R-04 | 결과 화면 2열 | `.result-panels` → `grid-template-columns: 1fr 1fr` |
| R-05 | 카운트다운 숫자 64px | `.waiting-countdown-number` font-size 64px |

### Tablet (481px~768px)

| # | 검증 항목 | 기대 결과 |
|---|---|---|
| R-06 | 3인/4인 게임 태블릿 그리드 | `@media (min-width:481px) and (max-width:768px)` → `grid-template-columns: 1fr 1fr` |
| R-07 | 3인 태블릿: 본인 보드 full-width | `.players-3 .battle-board-item:first-child` → `grid-column: 1 / -1` (태블릿 미디어쿼리) |
| R-08 | 결과 화면 1열 전환 | `@media (max-width:768px)` `.result-panels` → `grid-template-columns: 1fr` |

### Mobile (480px 이하)

| # | 검증 항목 | 기대 결과 |
|---|---|---|
| R-09 | 본인 보드 full-width | `@media (max-width:480px)` `.battle-board-item.mine` → `width: 100%, max-width: 320px` |
| R-10 | 상대 보드 스트립 | `.battle-opponents-strip` → `display: flex, flex-direction: row, overflow-x: auto` |
| R-11 | 상대 보드 스트립 항목 너비 | `width: 80px, flex-shrink: 0` |
| R-12 | 카운트다운 숫자 모바일 | `@media (max-width:480px)` → font-size 48px |
| R-13 | 결과 버튼 1열 | `@media (max-width:480px)` `.result-btns` → `flex-direction: column, width: 100%` |

---

## TC-ANIMATION: 애니메이션/이펙트 검증

CSS `blockfall-battle.css`에 다음 keyframes가 모두 정의되어 있는지 확인한다.

| # | keyframes 이름 | 용도 | 검증 방법 |
|---|---|---|---|
| A-01 | `bb-icon-pulse` | 대기 아이콘 pulse | CSS에 `@keyframes bb-icon-pulse` 존재 |
| A-02 | `bb-dot-blink` | 로딩 점 깜빡임 | CSS에 `@keyframes bb-dot-blink` 존재 |
| A-03 | `bb-num-pop` | 카운트다운 숫자 팝 | CSS에 `@keyframes bb-num-pop` 존재 |
| A-04 | `bb-garbage-in` | Garbage line 밀려올라오기 | CSS에 `@keyframes bb-garbage-in` 존재 |
| A-05 | `bb-attack-flash` | ATTACK! 텍스트 팝업 | CSS에 `@keyframes bb-attack-flash` 존재 |
| A-06 | `bb-border-flash` | Garbage 수신 보드 테두리 flash | CSS에 `@keyframes bb-border-flash` 존재 |
| A-07 | `bb-gameover-in` | 게임오버 오버레이 등장 | CSS에 `@keyframes bb-gameover-in` 존재 |
| A-08 | `bb-toast-in` | 플레이어 이탈 토스트 슬라이드인 | CSS에 `@keyframes bb-toast-in` 존재 |

각 keyframes 추가 검증:
- A-01: `0% scale(1.0)`, `50% scale(1.1)`, `100% scale(1.0)`, duration `1.4s`
- A-02: `0%,80%,100% opacity:0`, `40% opacity:1`, `.waiting-dot:nth-child(2)` delay `200ms`, `nth-child(3)` delay `400ms`
- A-03: `0% scale(1.3) opacity:0.5`, `100% scale(1.0) opacity:1`, duration `200ms`
- A-07: `0% scale(0.9) opacity:0`, `60% scale(1.04)`, `100% scale(1)`, duration `350ms`
- A-08: from `translateX(-50%) translateY(-16px) opacity:0`, to `translateY(0) opacity:1`, duration `200ms`

---

## TC-REGRESSION: 게임 로직 회귀 체크

이번 개편은 순수 시각 변경이므로 게임 로직 파일은 수정되지 않아야 한다.

| # | 파일 | 확인 내용 | 허용 변경 |
|---|---|---|---|
| G-01 | `frontend/src/api/battleStompClient.ts` | 변경 없음 | 없음 |
| G-02 | `frontend/src/api/blockfallBattleApi.ts` | 변경 없음 | 없음 |
| G-03 | `frontend/src/games/blockfall/battle/BlockfallBattleBoard.tsx` | NEXT/HOLD 렌더 로직 추가, 기존 lockPiece/arenaSweep/doGameOver 로직 변경 없음 | NEXT/HOLD draw 로직 추가 허용, 게임 로직 변경 금지 |
| G-04 | `frontend/src/games/blockfall/BlockfallBoard.tsx` | 읽기 전용 유지 — 배틀 개편 작업이 이 파일을 수정하면 Critical 버그 | 없음 |
| G-05 | `frontend/src/games/blockfall/battle/` 내 `useBlockfall*.ts` 훅 파일들 | 변경 없음 | 없음 |

### 구체적 회귀 검증 포인트

| # | 검증 항목 | 기대 결과 |
|---|---|---|
| G-06 | `BlockfallBattleBoard.tsx` 내 `lockPiece` 함수 또는 호출부 | 변경 없음 |
| G-07 | `BlockfallBattleBoard.tsx` 내 `arenaSweep` 함수 또는 호출부 | 변경 없음 |
| G-08 | `BlockfallBattleBoard.tsx` 내 `doGameOver` 함수 또는 호출부 | 변경 없음 |
| G-09 | `BlockfallBattleBoard.tsx` 내 `onBoardChange` 콜백 시그니처 | `(board, score, lines, level, combo) => void` 형태 유지 |
| G-10 | `BlockfallBattleBoard.tsx` 내 `onComboAttack` 콜백 시그니처 | `(combo: number) => void` 형태 유지 |
| G-11 | `BlockfallBattleBoard.tsx` props 인터페이스 | `players`, `myPlayerId`, `opponents`, `eliminatedPlayers`, `garbagePending` 등 기존 props 유지 |
| G-12 | `BlockfallBattlePage.tsx` WebSocket 훅 사용부 | `useBattleWebSocket` 호출 시그니처 변경 없음 |

---

## TC-BUILD: 빌드 검증

| # | 검증 항목 | 실행 명령 | 기대 결과 |
|---|---|---|---|
| B-01 | TypeScript 컴파일 에러 없음 | `cd frontend && tsc -b --noEmit` | 에러 0건 |
| B-02 | ESLint 에러 없음 | `cd frontend && eslint .` | 에러 0건 (warning은 허용) |

---

## 검증 판정 기준

### PASS 조건
- TC-THEME 전체 통과
- TC-PANEL 전체 통과
- TC-SCREEN 7개 화면 전체 통과
- TC-REGRESSION G-01~G-12 전체 통과 (로직 파일 무변경)
- TC-BUILD B-01, B-02 통과

### CONDITIONAL PASS 조건 (보고 후 팀리드 판단)
- TC-ANIMATION 일부 미구현 (기존 keyframes는 이미 존재하므로 해당 없음)
- TC-RESPONSIVE 태블릿 레이아웃 일부 미구현

### 즉시 반려 조건 (Critical/High)
- TC-REGRESSION G-04 위반: `BlockfallBoard.tsx` 수정
- TC-REGRESSION G-01~G-02 위반: battleStompClient.ts 또는 blockfallBattleApi.ts 수정
- TC-BUILD B-01 실패: TypeScript 컴파일 에러 발생
- 게임 로직 파일(lockPiece, arenaSweep, doGameOver) 변경 감지

---

## 버그 등록 형식 (발견 시)

형식: `"BUG-UI-{번호}: {재현 조건} / 기대값: {expected} / 실제값: {actual}"`

등록 파일: `docs/review/blockfall-battle-ui-overhaul-bugs.md` (발견 시 신규 생성)

---

> 이 테스트 플랜은 developer-frontend 구현 완료 후 실제 검증에 사용된다.
> 구현 완료 메시지 수신 후: 변경 파일들을 직접 Read하여 위 체크리스트 기반으로 검증 수행.
