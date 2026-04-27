# developer-frontend — blockfall-battle UI 개편 진행 로그

- 마지막 업데이트: 2026-04-27 (보드 컴포넌트 개편)
- 현재 상태: Phase 3 (게임 보드 대규모 개편) 구현 완료 — tsc/eslint PASS
- 담당 피처: 블록폴 배틀 UI 다크 테마 개편 (Phase 2 + BUG-UI-01 수정)
- 참조 명세: docs/design/blockfall-battle-components.md §UI 개편 델타 — v2

---

## 완료된 작업

### Phase 2 구현 (커밋: f2f6c2d) — 2026-04-27

**`frontend/src/styles/blockfall-battle.css`**
- `--color-text-primary` fallback `#111827` → `#f0f6fc`
- `--battle-result-my-row-bg` `#EEF2FF` → `rgba(99,102,241,0.15)`
- `--battle-result-my-row-border` `#C7D2FE` → `rgba(99,102,241,0.4)`
- `.battle-board-item` background `#FFFFFF` → `#1c2128`, border `#E5E7EB` → `#30363d`
- `.battle-board-item-header` background `#F9FAFB` → `#21262d`, border/color 다크화
- `.battle-board-nickname` color `#374151` → `#e6edf3`
- `.battle-board-score` color `#6B7280` → `#8b949e`
- `.waiting-player-item` background/border 다크화
- `.waiting-player-name` color `#374151` → `#e6edf3`
- `.waiting-queue-info` background/border/color 다크화
- `.waiting-title`, `.waiting-title-countdown` color → `#f0f6fc`
- `.waiting-sub` color → `#8b949e`
- `.battle-spinner` border-top-color `#58a6ff` → `#6366F1`
- `.result-panel`, `.ranking-panel` background/border 다크화
- `.result-panel-title`, `.result-title`, `.ranking-panel-title` color → `#f0f6fc`
- `.result-nickname`, `.ranking-panel-nickname` color → `#e6edf3`
- `.result-item`, `.ranking-panel-item` border-bottom-color → `#30363d`
- `.battle-error-icon` color → `#EF4444`
- `.battle-loading-text` 신규 클래스 (color `#e6edf3`)
- `.battle-btn-secondary` hover background → `#21262d`
- 신규 클래스: `.battle-my-play-area`, `.battle-my-side-panel`, `.battle-side-box`,
  `.battle-side-title`, `.battle-stats-area`, `.battle-stat-row`, `.battle-stat-label`,
  `.battle-stat-value` (+ `.combo` modifier)
- `queue-countdown-bar-wrap`, `result-countdown-bar-wrap` background → `#30363d`

**`frontend/src/games/blockfall/battle/BlockfallBattleBoard.tsx`**
- `CELL_MINI = 22` 상수 추가
- `drawMiniCell`, `drawMiniCanvas` 헬퍼 함수 추가 (BlockfallBoard.tsx NEXT/HOLD 로직 포팅)
- `nextCanvasRef`, `holdCanvasRef` ref 추가
- `draw()` 안에서 NEXT/HOLD 미니 캔버스 갱신 (게임 루프와 동기)
- JSX 구조: `battle-my-play-area` > `battle-my-side-panel` + `battle-board-canvas-wrap`
- 사이드패널: NEXT canvas 88×88, HOLD canvas 88×88 (빈 캔버스 — 키 입력 로직은 다음 스프린트)
- statsArea: SCORE/LINES/LEVEL 항목, combo >= 2 시 COMBO 항목 추가 표시
- 기존 `battle-stats-bar` div 제거

**`frontend/src/games/blockfall/battle/OpponentBoard.tsx`**
- 게스트 닉네임 인라인 `color: '#8b949e'` 제거 → `.battle-board-badge-guest` CSS 클래스 적용

**`frontend/src/pages/BlockfallBattlePage.tsx`**
- loading 화면: 로딩 텍스트에 `.battle-loading-text` 클래스 적용
- loading 화면: `waiting-dots-row` 애니메이션 dots 추가
- error 아이콘 color는 CSS `.battle-error-icon`에서 처리 (인라인 제거)

### BUG-UI-01 수정 (커밋: 07ea1d4) — 2026-04-27

**`frontend/src/styles/blockfall-battle.css`**
- `.result-score` color `#6B7280` → `#8b949e` (다크 테마 일관성 수정)

### 게임 로직 보존 확인

아래 파일은 이번 세션에서 수정하지 않음 — 동작 그대로 보존:
- `lockPiece`, `arenaSweep`, `doGameOver` 관련 로직
- `battleStompClient.ts`
- `blockfallBattleApi.ts`

### qa-tester 검증 결과 (2026-04-27)

- TC-THEME 전체 PASS
- TC-PANEL 전체 PASS (NEXT/HOLD canvas 88px, 명세 90px 대비 허용 범위)
- TC-SCREEN 7개 화면 PASS
- TC-RESPONSIVE PASS
- TC-ANIMATION 8개 keyframes 전체 PASS
- TC-REGRESSION PASS
- TC-BUILD PASS
- BUG-UI-01 수정 완료 → 재검증 불필요 (Low 수준)

### 빌드 결과

- `tsc -b --noEmit` PASS
- `eslint .` PASS

---

### Phase 3 — 보드 컴포넌트 전면 개편 (2026-04-27)

**`frontend/src/games/blockfall/battle/BlockfallBattleBoard.tsx`** (전체 재작성)
- `CELL` 24 → 30 (일반 BlockfallBoard와 동일)
- `CELL_MINI` 22 → 16 (NEXT 미리보기 셀)
- `CELL_OPP = 14` 상수 추가 (상대 보드 셀)
- `NEXT_QUEUE_SIZE = 5`, `MAX_OPP_SLOTS = 3` 상수 추가
- `nextPiece` 단일 ref → `nextQueue: useRef<Matrix[]>([])` (5개 큐)
- `nextCanvasRef` 단일 → `nextCanvasRefs: useRef<(HTMLCanvasElement | null)[]>` (5개 배열)
- `draw()` 안에서 `nextCanvasRefs.current.forEach(...)` 로 5개 미니 캔버스 일괄 갱신
- `holdCanvasRef` 완전 제거
- `playerReset`: `nextQueue.current.shift()` 로 피스 꺼내고 `push(drawFromBag())` 보충
- 초기화 시: `for (let i = 0; i < NEXT_QUEUE_SIZE; i++) nextQueue.current.push(drawFromBag())`
- `isPractice?: boolean` prop 추가 (default false)
- 게임 루프 시작 조건: `isPlaying || isPractice`
- 키보드 핸들러: `if (!isPlaying && !isPractice) return`
- 보드 전송 useEffect: `if (!isPlaying || isPractice) return`
- `lockPiece`: `onBoardChange` 호출에 `if (!isPracticeRef.current)` 조건 추가
- `arenaSweep`: `onComboAttack` 호출에 `&& !isPracticeRef.current` 조건 추가
- `doGameOver`: isPractice 시 1.5초 후 자동 재시작 (arena 초기화, 큐 재채우기, 루프 재시작)
- `applyGarbage`: `if (isPracticeRef.current || lines <= 0) return` 조건 추가
- 레이아웃: `players-N` CSS grid 방식 → `battle-layout` 2컬럼 고정 방식으로 교체
  - 좌측 `battle-my-section`: 내 보드 (NEXT 5개 큐 사이드패널 포함)
  - 우측 `battle-opponents-section`: 상대 슬롯 `MAX_OPP_SLOTS(3)` 개, 빈 슬롯은 대기 UI
- 내 닉네임: `isPractice && players.length === 0` 이면 '연습 중' 표시
- `isPracticeRef` 패턴으로 클로저 내 최신값 참조

**`frontend/src/games/blockfall/battle/OpponentBoard.tsx`**
- `isWaiting?: boolean` prop 추가
- `isWaiting && !isEliminated` 시 "대기 중" 오버레이 렌더링

**`frontend/src/styles/blockfall-battle.css`**
- `.battle-layout`, `.battle-my-section`, `.battle-opponents-section` 레이아웃 클래스 추가
- `.battle-opp-waiting-body`, `.battle-opp-waiting-icon` 슬롯 대기 UI 클래스 추가
- `.battle-next-queue`, `.battle-next-mini-canvas` NEXT 큐 5개 세로 배치 클래스 추가
- `.battle-garbage-badge` 가비지 뱃지 클래스 추가
- 모바일(max-width: 600px) 반응형: 세로 스택 + 상대 슬롯 가로 wrap

### 빌드 결과 (Phase 3)

- `tsc -b` PASS (0 errors)
- `eslint` PASS (0 errors, 0 warnings)

---

## 진행 중인 것

없음.

---

## 블로커 / 질문

없음.

---

## 다음 세션에서 할 것

1. qa-tester 검증 요청 (Phase 3 변경사항)
2. HOLD 키 기능 구현 (KeyC / Shift) — 별도 스프린트로 분리됨
3. 모바일 반응형 실기기 확인
