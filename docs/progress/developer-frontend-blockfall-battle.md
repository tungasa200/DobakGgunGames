# developer-frontend — blockfall-battle 진행 로그

- 최초 작성일: 2026-04-27
- 최종 업데이트: 2026-04-27 (게임 플로우 개선 + Ready 시스템 적용)
- 상태: 게임 플로우 전면 개선 완료 + Ready 시스템 연동, tsc+eslint PASS

---

## 구현 완료 파일

| 파일 | 설명 | 최종 커밋 |
|---|---|---|
| `frontend/src/games/blockfall/types/battle.types.ts` | WebSocket/REST DTO 타입 전체 정의 | e85cd99 |
| `frontend/src/lib/battleStompClient.ts` | `/ws-battle` STOMP 클라이언트 — JWT/게스트 `?token=` 통합, 개인채널 3개 구독, `sendPlayerFinished()` 포함 | fd66e31 |
| `frontend/src/api/blockfallBattleApi.ts` | REST 래퍼(`joinBattle`, `getBattleRankings`) + `useBattleWebSocket` 훅 + `sendPlayerFinished` | fd66e31 |
| `frontend/src/styles/blockfall-battle.css` | 배틀 전용 CSS — `--battle-` 변수 네임스페이스, keyframes 8종, 디자인 명세 §11~15 반영 | e85cd99 |
| `frontend/src/games/blockfall/battle/OpponentBoard.tsx` | 상대 보드 Canvas 렌더링 (읽기 전용) | e85cd99 |
| `frontend/src/games/blockfall/battle/BlockfallBattleBoard.tsx` | 2인/3인/4인 그리드 레이아웃 + 내 게임판 — `onBlockOut` prop, Garbage line 처리 포함 | fd66e31 |
| `frontend/src/pages/BlockfallBattlePage.tsx` | 상태머신(loading/waiting/countdown/queued/playing/finished/error), `handleBlockOut` → `sendPlayerFinished()` 연결 | fd66e31 |
| `frontend/src/App.tsx` | `/test-lab/blockfall-battle` 라우트 등록 | e85cd99 |
| `frontend/src/pages/HomePage.tsx` | Test Lab 섹션 게스트 포함 노출, 블록폴 배틀 BETA 카드 추가 | e85cd99 |
| `frontend/eslint.config.js` | `argsIgnorePattern: '^_'` 등 미사용 파라미터 허용 규칙 추가 | eeb812d |

---

## 이번 세션 변경 내용 (2026-04-27 세션 종료 기준)

### 신규 구현 요약 (전체 구조 완성)

이번 세션에서 blockfall-battle 기능의 모든 신규 파일을 최초 작성하고, BUG-001(Block Out 서버 미통보) 대응까지 완료했다.

| 신규/수정 | 파일 | 핵심 내용 |
|---|---|---|
| 신규 | `battle/BlockfallBattleBoard.tsx` | 2인/3인/4인 그리드, Garbage line 처리, `onBlockOut` prop |
| 신규 | `battle/OpponentBoard.tsx` | 상대 보드 Canvas 읽기 전용 렌더링 |
| 신규 | `types/battle.types.ts` | DTO 타입 전체 (WebSocket 이벤트 + REST) |
| 신규 | `lib/battleStompClient.ts` | `/ws-battle` STOMP, JWT/guest `?token=` 통합, 개인채널 3개 구독 |
| 신규 | `api/blockfallBattleApi.ts` | `joinBattle`, `getBattleRankings`, `useBattleWebSocket` 훅, `sendPlayerFinished` |
| 신규 | `styles/blockfall-battle.css` | `--battle-` CSS 변수 전체, 레이아웃, keyframes 8종 |
| 신규 | `pages/BlockfallBattlePage.tsx` | 상태머신: loading/waiting/countdown/queued/playing/finished/error |
| 수정 | `App.tsx` | `/test-lab/blockfall-battle` 라우트 등록 |
| 수정 | `HomePage.tsx` | Test Lab 섹션 게스트 포함 노출, BETA 카드 추가 |
| 수정 | `eslint.config.js` | `argsIgnorePattern` 추가 |

### WebSocket 구독 경로 (확정)

- `/topic/blockfall-battle/room/{roomId}` — 방 전체 브로드캐스트
- `/user/queue/blockfall-battle/board` — 상대 보드 업데이트 (개인)
- `/user/queue/blockfall-battle/queue` — 큐 포지션 (개인)
- `/user/queue/blockfall-battle/errors` — 에러 메시지 (개인)

### 커밋 이력

| 커밋 해시 | 내용 |
|---|---|
| `e85cd99` | 배틀 신규 파일 최초 구현 |
| `eeb812d` | eslint.config.js argsIgnorePattern 추가 |
| `fd66e31` | BUG-001 대응: Block Out → sendPlayerFinished() 연결 |

### 빌드 검증

- `tsc -b`: PASS
- `eslint .`: PASS

---

## 이전 세션 변경 내용 (Block Out 서버 알림 구현 — BUG-001 대응)

### 변경 파일 및 내용

| 파일 | 변경 내용 |
|---|---|
| `frontend/src/lib/battleStompClient.ts` | `BattleStompClientHandle`에 `sendPlayerFinished()` 추가. `/app/blockfall-battle/room/${roomId}/player-finished`로 `'{}'` 발행 |
| `frontend/src/api/blockfallBattleApi.ts` | `UseBattleWebSocketReturn`에 `sendPlayerFinished` 추가. 훅 내부 `useCallback` 구현 (`clientRef.current?.sendPlayerFinished()`) |
| `frontend/src/games/blockfall/battle/BlockfallBattleBoard.tsx` | `BlockfallBattleBoardProps`에 `onBlockOut: () => void` 추가. `doGameOver` 내부에서 `onBlockOut()` 호출 (게임오버 감지 즉시, `onGameOver` 직전) |
| `frontend/src/pages/BlockfallBattlePage.tsx` | `handleBlockOut` 콜백 추가 (`ws.sendPlayerFinished()` 호출). `BlockfallBattleBoard`에 `onBlockOut={handleBlockOut}` prop 전달 |

### 설계 결정

- `doGameOver`는 Block Out(보드 최상단 초과) 외에도 `lockPiece`에서 충돌 감지 시 호출되는데, 배틀에서 게임오버는 모두 실질적으로 Block Out과 동일한 의미이므로 단일 경로로 처리
- `sendPlayerFinished`는 `sendLeave`와 별개 — leave는 자진 퇴장, player-finished는 게임오버 알림

---

## 이전 세션 변경 내용 (백엔드 실제 구현 경로 반영)

### battleStompClient.ts

1. **WebSocket URL 파라미터 통일**
   - 이전: JWT 유저는 `?token=<JWT>`, 게스트는 `?guestToken=<token>` (분리)
   - 변경: 유저/게스트 모두 `?token=<value>` 단일 파라미터 사용
   - 게스트의 경우 `joinBattle` 응답의 `guestToken` 값(`guest_<uuid>`)을 그대로 전달

2. **STOMP connectHeaders 정리**
   - 이전: JWT 유저는 `Authorization: Bearer <JWT>`, 게스트는 `X-Guest-Token: <token>` 헤더 추가
   - 변경: 인증은 URL 파라미터로만 수행 (헤더 제거, 빈 객체 유지)

3. **개인 채널 구독 2개 추가**
   - `/user/queue/blockfall-battle/board` — 상대 보드 업데이트 (BOARD_UPDATE, 발신자 에코 방지)
   - `/user/queue/blockfall-battle/queue` — 큐 포지션 (QUEUE_POSITION)
   - 기존 `/user/queue/blockfall-battle/errors` 유지

4. **입장 발행 제거**
   - 이전: 연결 직후 `/app/blockfall-battle/room/${roomId}/join` 발행
   - 변경: REST `joinBattle`에서 이미 처리되므로 WS 연결 후 별도 발행 없음

5. **미사용 파라미터 접두사 처리**
   - `playerId` → `_playerId`, `isGuest` → `_isGuest` (인터페이스 호환 유지, TS 에러 해소)

### eslint.config.js

- `@typescript-eslint/no-unused-vars` 규칙에 `argsIgnorePattern: '^_'` 등 패턴 추가
- `_payload` 등 의도적 미사용 파라미터에서 발생하던 기존 에러 해소

---

## 이전 세션 변경 내용 (designer UX 명세 반영)

### blockfall-battle.css 주요 변경

1. **`--battle-` CSS 변수 네임스페이스** (명세 §11)
   - `--battle-accent`, `--battle-garbage-color`, `--battle-banner-bg/border/text` 등 전체 토큰 선언
   - 기존 하드코딩 색상값을 CSS 변수로 교체

2. **keyframes 추가** (명세 §15)
   - `bb-icon-pulse`, `bb-dot-blink`, `bb-num-pop`, `bb-garbage-in`
   - `bb-attack-flash`, `bb-border-flash`, `bb-gameover-in`, `bb-toast-in`

3. **경고 배너 재설계** (명세 §2)
   - `.battle-lab-banner`: 전체 너비, sticky, `#FEF3C7` 배경, `#F59E0B` 하단 테두리
   - `.battle-lab-banner-icon`: 원형 `!` 아이콘
   - 게스트 추가 문구 표시 조건부 렌더링

4. **대기 화면 CSS 개선** (명세 §3)
   - 아이콘 pulse 애니메이션 (혼자 대기 시)
   - 로딩 dot 3개 순차 깜빡임
   - 카운트다운 숫자 인라인 (64px)
   - 참가자 목록 스타일 (배지 시스템)
   - 인원 표시 강조

5. **게임판 그리드 레이아웃 변경** (명세 §5.3)
   - 2인: `1fr 1fr` (기존 `2fr 1fr`에서 변경)
   - 3인: `3fr 2fr` + 본인 row span 2
   - 4인: `1fr 1fr` + `1fr 1fr` rows
   - 모바일/태블릿 반응형 추가

6. **보드 아이템 스타일** (명세 §5.4)
   - 흰 배경 + `#E5E7EB` 테두리 (기존 다크 테마에서 변경)
   - 본인 보드: `--battle-accent` 테두리 + subtle shadow
   - 배지 시스템: `battle-board-badge-me`, `battle-board-badge-guest`

7. **게임오버 오버레이** (명세 §5.5)
   - `bb-gameover-in` 애니메이션 적용
   - `--battle-gameover-bg` 변수 사용

8. **결과 화면 재설계** (명세 §8)
   - 2열 패널 레이아웃 (모바일 1열)
   - 이번 배틀 순위 패널 + 역대 TOP 10 패널 분리
   - 본인 행 강조 (`.result-item-mine`, `.ranking-item-mine`)
   - 10초 카운트다운 진행 바
   - TOP 10 순위 색상: 금/은/동 (`--battle-result-rank1~3`)

9. **플레이어 이탈 토스트** (명세 §9)
   - `.battle-player-left-toast`: fixed, `#F59E0B` 왼쪽 테두리, `bb-toast-in` 애니메이션

10. **재연결 배너** (명세 §10.1)
    - 40px 높이, `--battle-banner-bg` 사용 (기존 다크 테마에서 변경)

11. **버튼 스타일** (명세 §8.7)
    - `--battle-accent` primary, `#D1D5DB` 테두리 secondary

### BlockfallBattlePage.tsx 주요 변경

1. **경고 배너 분리**: 헤더 인라인 `battle-test-banner` → 별도 `renderLabBanner()` 함수 (전체 너비 sticky)
2. **대기 화면 서브 상태 구현**
   - 서브 상태 A (혼자 대기): pulse 아이콘 + dot 3개 + 서브 텍스트
   - 서브 상태 B (카운트다운): 인라인 숫자 + `waiting-countdown-number`
   - 서브 상태 C (카운트다운 취소): `phase='waiting'`으로 복귀 (기존 동일)
3. **결과 화면**: `result-panels` 2열 그리드, `result-countdown-area` 10초 바
4. **큐 대기 화면**: `queueCountdown` 상태 추가, 진행 바 표시
5. **플레이어 이탈 토스트**: `playerLeftToast` 상태 + `showPlayerLeftToast()` 헬퍼 (PLAYER_LEFT WS 이벤트 수신 시 연결 대기)
6. **접근성 ARIA**: `role="region"`, `aria-live`, `role="timer"`, `role="list"` 등 명세 §14 반영

### HomePage.tsx 변경

- Test Lab 카드 구조: 기존 `{user && (...)}` 조건부 유지 (디자이너 §1.5 권장)
- 순서: 실시간 채팅 랩 → Online RPS → 블록폴 배틀 [BETA] (명세 §1.2 와이어프레임 순서)
- BETA 배지: `#F59E0B` 배경, 인라인 스타일 적용

---

## 진행 중

없음 — 이번 세션에서 모든 구현 항목 완료

---

## 블로커 / 질문

1. **PLAYER_LEFT WS 이벤트 토스트 연결**
   - 현재 `useBattleWebSocket`이 PLAYER_LEFT payload를 외부로 노출하지 않음
   - `blockfallBattleApi.ts`에 `playerLeftNickname` 상태 추가 필요
   - QA 검증 단계에서 확인 후 처리

2. **OpponentBoard.tsx 보드 배경 색상**
   - 현재 다크 배경(`#0d1117`) — QA 검증 후 결정 요청

---

## 환경변수 추가 필요

**Vercel 대시보드에 추가 (미완료):**
- 변수명: `VITE_WS_BATTLE_URL`
- 값 형식: `https://[backend-railway-domain]/ws-battle`
- 설명: 배틀 WebSocket 엔드포인트 (기존 VITE_WS_URL과 분리)
- 참조 파일: `frontend/src/lib/battleStompClient.ts`
- 상태: 사용자에게 Vercel 등록 안내 완료, 실제 등록은 사용자 직접 수행 필요

---

## 게임 플로우 개선 세션 (2026-04-27)

### 수정된 파일

| 파일 | 변경 내용 |
|---|---|
| `frontend/src/games/blockfall/types/battle.types.ts` | `BattleEventType`에 `'READY_STATE'` 추가, `ReadyStatePayload` 인터페이스 추가 |
| `frontend/src/lib/battleStompClient.ts` | `onReadyState` 핸들러 + `sendPlayerReady` 추가 |
| `frontend/src/api/blockfallBattleApi.ts` | `readyState` 상태 + `sendPlayerReady` hook return 추가 |
| `frontend/src/pages/BlockfallBattlePage.tsx` | 연습모드, 카운트다운 틱, Ready UI, wsEnabled 'finished' 포함, handleLeave 100ms 딜레이 |

### 주요 변경 내용

1. **혼자 대기 시 연습 게임 즉시 시작** — `phase === 'waiting' && players.length <= 1` 분기로 연습 모드 렌더
2. **카운트다운 클라이언트 틱** — `countdownIntervalRef`로 1초마다 감소, MATCH_COUNTDOWN 이벤트로 초기값 수신
3. **자동 재시작 제거** — `resultCountdown`, `RESULT_AUTO_SECONDS`, 관련 useEffect 3개 전체 삭제
4. **Ready 시스템** — "다시 배틀" → "다음 라운드 준비" 버튼 + 준비 완료 인원 표시
5. **홈으로 연결 종료 수정** — `wsEnabled`에 `'finished'` 추가 + `navigate` 100ms 딜레이
6. **queueCountdown UI 제거** — renderStatusBar에서 queueCountdown 참조 제거

### 빌드 검증
- `tsc -b --noEmit`: PASS
- `eslint`: PASS

---

## 다음 세션에서 할 것

1. Railway MySQL 콘솔에서 `blockfall-battle-schema.sql` 실행 확인 (battle_record 테이블 없으면 finishGame 실패)
2. qa-tester 검증 요청 — 혼자 접속/카운트다운/Ready 시스템/홈으로 이탈 시나리오
3. PLAYER_LEFT 토스트 연결 (`useBattleWebSocket` 훅에 `playerLeftNickname` 상태 노출)
4. Vercel 환경변수 `VITE_WS_BATTLE_URL` 등록 확인
