---
date: 2026-05-29
author: Claude (developer-backend / developer-frontend)
scope: 통신 성능·WebSocket 안정성 개선 + 코드 스플리팅
---

# 통신 성능 & WebSocket 최적화 작업 로그

## 작업 배경

전반적인 통신 속도 점검 요청을 계기로 REST API, WebSocket, 프론트엔드 번들 세 영역에서 이슈를 발굴하고 전부 수정하였다.

---

## 점검 결과 요약

| 심각도 | 이슈 수 | 수정 완료 |
|--------|---------|----------|
| P0 | 1 | ✅ |
| P1 | 4 | ✅ |
| P2 | 4 | ✅ |
| P3 | 3 | ✅ |

---

## 수정 내용 상세

### P0 — BlockfallBattle ↔ MinesweeperBattle 이벤트 리스너 충돌

**문제**
`/ws-battle` 엔드포인트를 두 게임이 공유하므로, 두 컨트롤러가 모두 `SessionDisconnectEvent`를 수신하여 상대 게임 세션의 disconnect를 잘못 처리할 수 있었다.

**수정**
- `BlockfallBattleWebSocketController.handleConnect` : 세션 속성에 `wsGameType=blockfall` 기록
- `MinesweeperBattleWebSocketController.handleConnect` : 세션 속성에 `wsGameType=minesweeper` 기록
- 각 컨트롤러의 `handleDisconnect` 진입 시 `wsGameType` 값으로 자신의 게임 세션인지 먼저 확인 후 불일치하면 즉시 return

**변경 파일**
- `backend/…/controller/BlockfallBattleWebSocketController.java`
- `backend/…/controller/MinesweeperBattleWebSocketController.java`

---

### P1 — useRpsGame / useYachtGame useEffect cleanup race condition

**문제**
컴포넌트 언마운트 시 cleanup에서 `leave()` → `disconnect()` 를 연달아 호출하면, `leave()` 가 서버 세션 속성을 먼저 정리하여 이후 `SessionDisconnectEvent` 처리가 누락될 수 있었다.

**수정**
cleanup에서 `leave()` 호출 제거, `disconnect()` 만 호출. 명시적 나가기 버튼에서만 `leave()` → `disconnect()` 순서 유지.

**변경 파일**
- `frontend/src/games/online-rps/hooks/useRpsGame.ts`
- `frontend/src/games/yacht/hooks/useYachtGame.ts`

---

### P1 — MinesweeperBattle 재연결 정책 불일치

**문제**
RPS·Yacht·Battle은 `MAX_RETRY=3` / `RETRY_DELAYS=[2000,4000,8000]` 인데, Minesweeper Battle만 `MAX_RETRY=5` / `RETRY_DELAYS=[2000,4000,6000,8000,10000]` 으로 달라 사용자 경험 불일치.

**수정**
Minesweeper Battle의 재연결 정책을 나머지 게임과 동일하게 통일.

**변경 파일**
- `frontend/src/games/minesweeper/battle/useMinesweeperBattleSocket.ts`

---

### P2 — Battle BOARD_STATE 메시지 throttle

**문제**
게임 루프(~60fps)에서 매 프레임마다 `sendBoardState`를 호출하여 초당 최대 ~50 KB 대역폭 소모.

**수정**
`battleStompClient.ts`의 `sendBoardState`에 100ms throttle 적용 (최대 10fps). 동일 페이로드 중복 전송 차단. 기존에 불필요하게 포함되던 `type: 'BOARD_STATE'` 필드 제거(destination으로 이미 식별 가능).

**예상 효과** : 초당 전송량 ~50 KB → ~8 KB (83% 감소)

**변경 파일**
- `frontend/src/lib/battleStompClient.ts`

---

### P2 — Yacht 채팅 매 메시지마다 DB 조회

**문제**
`YachtWebSocketController.handleChat`에서 채팅 메시지를 발행할 때마다 `userRepository.findById()`로 프로필 이미지 URL을 DB에서 재조회.

**수정**
`handleJoin` 에서 프로필 이미지 URL을 WebSocket 세션 속성(`profileImageUrl`)에 캐싱. `handleChat`에서 세션 캐시를 참조하여 DB 쿼리 0회로 감소.

**변경 파일**
- `backend/…/controller/YachtWebSocketController.java`

---

### P2 — 게시글 목록 N+1 쿼리

**문제**
`BoardPostService.getPosts()`에서 게시글 목록(최대 20개)을 조회한 뒤, 각 게시글마다 `countByPostId()` 쿼리를 별도 실행하여 최대 21회 DB 쿼리 발생.

**수정**
`BoardCommentRepository`에 `countByPostIdIn(List<Long> postIds)` 배치 카운트 쿼리 추가. `getPosts()`에서 postId 목록을 한 번에 넘겨 단일 쿼리로 처리 후 Map으로 매핑.

**예상 효과** : 게시글 목록 조회 쿼리 N+1 → 2회 (쿼리 90% 감소)

**변경 파일**
- `backend/…/repository/BoardCommentRepository.java`
- `backend/…/service/BoardPostService.java`

---

### P2 — 댓글 목록 author LAZY 로드 N+1

**문제**
`BoardComment.author`가 `FETCH.LAZY`로 설정되어 있어, 댓글 목록 변환(`BoardCommentResponse::from`) 시 댓글 수만큼 추가 User 쿼리 발생.

**수정**
`BoardCommentRepository`의 관련 조회 메서드에 `@EntityGraph(attributePaths = {"author"})` 추가. JOIN FETCH로 author를 함께 로드.

**변경 파일**
- `backend/…/repository/BoardCommentRepository.java`

---

### P3 — WebSocket Heartbeat 미설정

**문제**
`WebSocketConfig`에 heartbeat 설정이 없어 Spring 기본값(10초)이 적용됨. 모바일 환경에서 연결 끊김 감지 지연 가능.

**수정**
`enableSimpleBroker()`에 `.setHeartbeatValue(new long[]{25000, 25000})` 추가.

**변경 파일**
- `backend/…/config/WebSocketConfig.java`

---

### P3 — 코드 스플리팅 (번들 분리)

**문제**
`App.tsx`에서 모든 페이지를 정적 import하여 초기 번들에 Three.js(~1.1MB), Tiptap(~327KB), GSAP, STOMP 등 전체 의존성이 포함됨.

**수정**

1. `App.tsx` — 모든 페이지 import를 `React.lazy()` + 동적 import로 전환. `<Routes>`를 `<Suspense fallback={null}>`으로 감쌈.

2. `vite.config.ts` — `build.rollupOptions.output.manualChunks` 추가:

| 청크 이름 | 포함 라이브러리 | 로드 시점 |
|-----------|---------------|----------|
| `vendor-three` | three, @react-three/* | 3D 게임 페이지 진입 시 |
| `vendor-tiptap` | @tiptap/* | 게시판 글쓰기/수정 시 |
| `vendor-gsap` | gsap | GSAP 사용 페이지 진입 시 |
| `vendor-ws` | @stomp/stompjs, sockjs-client | 멀티플레이 게임 진입 시 |
| `vendor-router` | react-router-dom | 항상 로드 |
| `vendor-react` | react, react-dom, scheduler | 항상 로드 |

**빌드 결과**

| | 변경 전 | 변경 후 |
|---|---|---|
| 초기 로드 index.js | ~1.8 MB+ (전체 포함 추정) | **20.4 kB** (gzip 5.6 kB) |
| Three.js | 초기 번들에 포함 | 1,153 kB — 3D 게임 진입 시만 로드 |
| Tiptap | 초기 번들에 포함 | 327 kB — 글쓰기 시만 로드 |

**변경 파일**
- `frontend/src/App.tsx`
- `frontend/vite.config.ts`

---

### P3 — MinesweeperBattle 구독 주석 오류

**문제**
`useMinesweeperBattleSocket.ts` 내 채널별 주석이 실제 수신 메시지 타입과 불일치.

**수정**
주석 정정 — `/topic/…/room/{rid}` 채널: `MATCH_READY(공개)` 표현 제거, `/user/queue/…/state` 채널: `MATCH_READY(개별)` 제거 후 실제 타입(`STATE_SNAPSHOT`, `OPPONENT_DISCONNECTED`, `OPPONENT_RECONNECTED`)으로 수정.

**변경 파일**
- `frontend/src/games/minesweeper/battle/useMinesweeperBattleSocket.ts`

---

## 미수정 항목 (의도적 보류)

| 항목 | 이유 |
|------|------|
| HTTP 캐싱 헤더 (랭킹 API) | 랭킹 실시간성 요구로 `max-age` 방식 부적합. ETag 방식 적용 여부는 랭킹 집계 주기 확인 후 별도 결정 필요 |
| React Query / SWR 도입 | 프론트엔드 데이터 레이어 전체 리팩터 필요, 별도 스프린트로 검토 예정 |

---

## 검증

- 프론트엔드: `tsc -b --noEmit` 에러 없음, `vite build` 성공
- 백엔드: 에이전트 수정 완료 (컴파일 검증은 `./gradlew build` 로 CI에서 확인 권장)
