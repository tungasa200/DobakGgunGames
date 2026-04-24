# 구현 계획서 — developer-frontend : Online RPS (멀티플레이 가위바위보)

- 작성자: developer-frontend
- 작성일: 2026-04-24
- 상태: **CP2 승인 대기 — 코드 작성 전**
- 근거 PRD: `docs/specs/online-rps-prd.md` (CP1 승인 완료)

---

## 1. 제거 대상 파일 목록

실제 존재 확인 완료 (5개 파일 존재):

| 파일 | 존재 여부 | 비고 |
|---|---|---|
| `frontend/src/games/rsp/RspBoard.tsx` | 존재 | 어드민 솔로 RSP 보드 컴포넌트 |
| `frontend/src/games/rsp/useRspGame.ts` | 존재 | 어드민 솔로 RSP 상태 훅 |
| `frontend/src/games/rsp/RspBoard.module.css` | 존재 | 어드민 솔로 RSP 스타일 |
| `frontend/src/pages/admin/AdminRspPage.tsx` | 존재 | `/admin/rsp` 라우트 페이지 |
| `frontend/src/pages/admin/AdminRspExcelPage.tsx` | 존재 | `/admin/rsp/excel` 라우트 페이지 |

### 파일 수정 시 제거할 내용

**`frontend/src/App.tsx` (수정 — 해당 라인 제거)**
- line 38: `import AdminRspPage from './pages/admin/AdminRspPage';`
- line 39: `import AdminRspExcelPage from './pages/admin/AdminRspExcelPage';`
- line 92~95 (블록 전체 제거):
  ```
  {/* 어드민 전용 가위바위보 — ... */}
  <Route path="/admin/rsp" element={<AdminRspPage />} />
  <Route path="/admin/rsp/excel" element={<AdminRspExcelPage />} />
  ```

**`frontend/src/api/admin.ts` (수정 — 섹션 제거)**
- line 206~238 (블록 전체 제거): `// ── RSP (어드민 전용 가위바위보) ─────────────────────────` 주석부터 `adminRspApi` 객체 끝까지.
  - 제거 대상 exports: `RspChoice`, `RspResult`, `RspStats`, `RspPlayResponse`, `RspStatsResponse`, `adminRspApi`

---

## 2. 신규 파일 목록

### games/online-rps 디렉토리 (8개)

| 파일 | 역할 |
|---|---|
| `frontend/src/games/online-rps/types/rps.types.ts` | TypeScript 타입/인터페이스 전체 정의 (이벤트 페이로드, 상태 enum 등) |
| `frontend/src/games/online-rps/components/RpsCard.tsx` | 카드 단일 컴포넌트 — rock/paper/scissors 이미지 + 선택/비선택/결과 상태별 스타일 |
| `frontend/src/games/online-rps/components/WaitingScreen.tsx` | 대기 화면 — 참가자 목록, 카운트다운 표시, 나가기 버튼 |
| `frontend/src/games/online-rps/components/GameScreen.tsx` | 게임 화면 — 카드 3장 선택 + 10초 타이머 + 참가자별 선택 현황(미선택/선택완료 표시) |
| `frontend/src/games/online-rps/components/ResultScreen.tsx` | 결과 화면 — 각자 선택 카드 표시 + WIN/LOSS/DRAW 배너 + 재도전/나가기 버튼 |
| `frontend/src/games/online-rps/hooks/useRpsGame.ts` | 게임 전체 상태 관리 훅 — WebSocket 연동, 화면 전환(phase) 관리, REST 호출 |
| `frontend/src/games/online-rps/components/RpsCard.module.css` | RpsCard 스타일 |
| `frontend/src/games/online-rps/components/RpsScreens.module.css` | WaitingScreen / GameScreen / ResultScreen 공유 스타일 |

### lib 디렉토리 (1개)

| 파일 | 역할 |
|---|---|
| `frontend/src/lib/rpsStompClient.ts` | RPS 전용 STOMP 클라이언트 팩토리 — stompClient.ts 패턴 기반, RPS 이벤트 타입에 맞게 특화 |

### pages 디렉토리 (1개)

| 파일 | 역할 |
|---|---|
| `frontend/src/pages/OnlineRpsPage.tsx` | `/online-rps` 라우트 페이지 — POST /api/rps/match 호출, roomId 수신 후 useRpsGame 초기화, 화면 phase에 따라 WaitingScreen / GameScreen / ResultScreen 렌더 전환 |

**총 신규 파일: 10개**

---

## 3. 기존 파일 수정 목록

### `frontend/src/App.tsx`

**제거:**
- `AdminRspPage`, `AdminRspExcelPage` import 2개
- `/admin/rsp`, `/admin/rsp/excel` Route 선언 블록

**추가:**
- `import OnlineRpsPage from './pages/OnlineRpsPage';`
- 아래 라우트를 `/:game` 일반 게임 라우트 앞, `/dbgchat` 위 위치에 선언:
  ```tsx
  <Route
    path="/online-rps"
    element={<AuthRoute><OnlineRpsPage /></AuthRoute>}
  />
  ```
  - `AuthRoute` 사용 이유: PRD 섹션 9 — "Authenticated (JWT Bearer). ADMIN/USER/FRIEND 모두 가능." 즉 로그인 유저 전체 허용, 게스트 차단만 필요.

### `frontend/src/api/admin.ts`

**제거:**
- `// ── RSP (어드민 전용 가위바위보) ─────────────────────────` 섹션 전체 (line 206~238)
- 제거 대상: `RspChoice` / `RspResult` / `RspStats` / `RspPlayResponse` / `RspStatsResponse` 타입, `adminRspApi` 객체

### `frontend/src/pages/HomePage.tsx`

**수정 위치:** Test Lab 카드 내부 (`user &&` 조건부 블록, line 243~258)

**추가 내용:** 기존 "실시간 채팅 랩" Link 아래에 Online RPS 진입 버튼 추가:
```tsx
<Link
  to="/online-rps"
  className={`${styles.btn} ${styles.btnNormal}`}
  style={{ width: '100%', textAlign: 'center', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
>
  ✊ Online RPS
</Link>
```

**수정 파일 총계: 3개**

---

## 4. 상태 관리 설계 (`useRpsGame.ts` 내부)

### phase (화면 전환 상태)

```typescript
type RpsPhase =
  | 'idle'        // 초기 / 매칭 전
  | 'matching'    // POST /api/rps/match 요청 중
  | 'connecting'  // WebSocket 연결 및 /join 발행 중
  | 'waiting'     // 대기 화면 (ROOM_STATE 수신 후)
  | 'countdown'   // MATCH_COUNTDOWN 수신, 5초 카운트다운 표시
  | 'playing'     // GAME_STARTED 수신 후 카드 선택 화면
  | 'result'      // ROUND_RESULT 수신 후 결과 화면
  | 'error'       // 복구 불가 에러 (방 닫힘, 연결 실패 등)
```

### 상태 목록

| 상태명 | 타입 | 초기값 | 설명 |
|---|---|---|---|
| `phase` | `RpsPhase` | `'idle'` | 현재 화면 phase |
| `roomId` | `string \| null` | `null` | 매칭으로 받은 roomId |
| `room` | `RoomStatePayload \| null` | `null` | 최신 ROOM_STATE 페이로드 |
| `countdown` | `number` | `0` | MATCH_COUNTDOWN의 secondsRemaining (5→0) |
| `gameDeadline` | `Date \| null` | `null` | GAME_STARTED의 deadlineAt — 10초 타이머 계산용 |
| `gameTimeLeft` | `number` | `10` | 현재 남은 게임 타이머 초 (1초 interval로 감소) |
| `myChoice` | `RpsChoice \| null` | `null` | 내가 선택한 카드 (선택 즉시 UI 반영용) |
| `chosenUserIds` | `Set<number>` | `new Set()` | 선택 완료한 참가자 userId 집합 (실제 선택 내용은 숨김) |
| `roundResult` | `RoundResultPayload \| null` | `null` | ROUND_RESULT 페이로드 |
| `errorMessage` | `string \| null` | `null` | 에러 메시지 표시용 |
| `wsStatus` | `ConnectionStatus` | `'connecting'` | WebSocket 연결 상태 |

### 주요 이벤트 핸들러 (반환하는 함수들)

- `startMatch()` — POST /api/rps/match → roomId → WebSocket 연결 순서 실행
- `sendChoice(choice: RpsChoice)` — `/app/rps/room/{roomId}/choose` 발행
- `sendLeave()` — `/app/rps/room/{roomId}/leave` 발행 후 navigate('/')
- `sendRematch()` — `/app/rps/room/{roomId}/rematch` 발행
- `handleAlreadyInRoom(roomId: string)` — 409 ALREADY_IN_ROOM 수신 시 해당 roomId로 재연결

---

## 5. `rpsStompClient.ts` 설계

### 기존 `stompClient.ts`와의 차이점

| 항목 | stompClient.ts (채팅) | rpsStompClient.ts (RPS) |
|---|---|---|
| 구독 경로 | `/topic/room/{roomId}` | `/topic/rps/room/{roomId}` |
| 발행 경로 | `/app/chat/{roomId}` | `/app/rps/room/{roomId}/join`, `/choose`, `/leave`, `/rematch` |
| 메시지 파싱 | `ChatMessageData` | `RpsServerEvent<T>` (type + payload 구조) |
| 콜백 | `onMessage`, `onRoomDeleted` | `onEvent` (이벤트 type 별로 분기) |
| 에러 구독 | `/user/queue/errors` — ROOM_NOT_FOUND 등 → `onRoomDeleted` | `/user/queue/errors` — RPS 전용 코드로 분기 |
| 재연결 로직 | 동일 (MAX_RETRY=3, 지수 백오프 2s/4s/8s) | 동일 패턴 그대로 재사용 |

### 분리 이유

채팅 전용 `stompClient.ts`는 `ChatMessageData`, `onRoomDeleted` 등 채팅 전용 타입에 강하게 결합되어 있습니다. RPS는 완전히 다른 이벤트 구조(`type` + `payload` envelope)를 사용하므로 파일을 분리하는 것이 타입 안전성과 유지보수 측면에서 명확합니다.

공유하는 것은 `VITE_WS_URL`, `SockJS + @stomp/stompjs Client` 초기화 패턴, 재연결 로직뿐이며, 이는 분리된 파일에서 동일 패턴으로 복사합니다.

### `rpsStompClient.ts` 인터페이스

```typescript
export interface RpsStompClientOptions {
  roomId: string;
  token: string;
  onEvent: (event: RpsServerEvent<unknown>) => void;
  onError: (err: { code: string; message: string }) => void;
  onStatusChange: (status: ConnectionStatus) => void;
}

export function createRpsStompClient(opts: RpsStompClientOptions): {
  connect: () => void;
  disconnect: () => void;
  join: () => void;
  choose: (choice: RpsChoice) => void;
  leave: () => void;
  rematch: () => void;
}
```

`connect()` 호출 후 onConnect 내부에서 자동으로 `/topic/rps/room/{roomId}` 구독 및 `/user/queue/errors` 구독을 설정합니다.
`join()` 은 `connect()` 완료(onConnect) 직후 `useRpsGame`이 호출합니다.

---

## 6. TypeScript 타입 정의 계획 (`rps.types.ts`)

### 공용 envelope

```typescript
export interface RpsServerEvent<T> {
  type: RpsEventType;
  timestamp: string;
  payload: T;
}

export type RpsEventType =
  | 'ROOM_STATE'
  | 'MATCH_COUNTDOWN'
  | 'MATCH_COUNTDOWN_CANCELLED'
  | 'GAME_STARTED'
  | 'ROUND_RESULT'
  | 'PLAYER_LEFT'
  | 'HOST_CHANGED'
  | 'ROOM_CLOSED';
```

### 페이로드 타입

```typescript
export type RpsChoice = 'ROCK' | 'PAPER' | 'SCISSORS';
export type RpsResult = 'WIN' | 'LOSS' | 'DRAW';
export type RoomStatus = 'WAITING' | 'PLAYING' | 'FINISHED';

export interface RpsParticipant {
  userId: number;
  nickname: string;
  ready: boolean;
  isHost: boolean;
}

export interface RoomStatePayload {
  roomId: string;
  name: string;
  status: RoomStatus;
  hostUserId: number;
  maxPlayers: number;
  participants: RpsParticipant[];
}

export interface MatchCountdownPayload {
  roomId: string;
  secondsRemaining: number;
  startAt: string;
}

export interface MatchCountdownCancelledPayload {
  roomId: string;
  reason: string;
}

export interface GameStartedPayload {
  roomId: string;
  roundNum: number;
  deadlineAt: string;
  timeoutSeconds: number;
  participantUserIds: number[];
}

export interface RoundPlayerResult {
  userId: number;
  nickname: string;
  choice: RpsChoice;
  autoPicked: boolean;
  result: RpsResult;
}

export interface RoundResultPayload {
  roomId: string;
  roundNum: number;
  results: RoundPlayerResult[];
}

export interface PlayerLeftPayload {
  roomId: string;
  userId: number;
  nickname: string;
  reason: 'LEAVE' | 'DISCONNECT' | 'KICKED';
}

export interface HostChangedPayload {
  roomId: string;
  newHostUserId: number;
  newHostNickname: string;
}

export interface RoomClosedPayload {
  roomId: string;
  reason: 'EMPTY' | 'HOST_LEFT_ALONE';
}
```

### REST API 응답 타입

```typescript
export interface MatchResponse {
  roomId: string;
  status: RoomStatus;
  playerCount: number;
  maxPlayers: number;
  created: boolean;
}

export interface AlreadyInRoomError {
  error: 'ALREADY_IN_ROOM';
  roomId: string;
}
```

---

## 7. 리스크 / 주의사항

### 7.1 ESLint 기존 경고와 신규 파일 분리

현재 프로젝트에 기존 54개 lint 경고(기존 파일 기인)가 존재합니다. 신규 파일은 모두 0 errors / 0 warnings 상태로 작성하며, 기존 경고와 명확히 구분됩니다. `tsc -b && eslint .` 통과 시 신규 파일만 확인합니다.

### 7.2 WebSocket 연결 순서 엄수

```
POST /api/rps/match
  → 200/201: roomId 수신
  → rpsStompClient.connect() 호출
  → onConnect 콜백에서 /topic/rps/room/{roomId} 구독
  → rpsStompClient.join() 호출 (/app/rps/room/{roomId}/join 발행)
  → ROOM_STATE 수신 → phase='waiting'
```

connect() 완료 전에 join()을 발행하면 STOMP 연결이 준비되지 않은 상태에서 publish가 무시됩니다. `onConnect` 콜백 내부에서 자동 join 발행하거나, `useRpsGame`이 `wsStatus === 'connected'` 상태 변경을 감지한 후 join을 발행하는 방식으로 처리합니다.

### 7.3 `ALREADY_IN_ROOM` (409) 처리 UX

사용자가 게임 중 브라우저 뒤로가기 후 다시 "Online RPS" 진입 시 409가 반환됩니다.

처리 흐름:
1. 응답 body에서 `roomId` 추출
2. "이미 진행 중인 방에 다시 연결합니다" 인라인 메시지 표시 (별도 토스트 라이브러리 없이 인라인)
3. 해당 roomId로 WebSocket 재연결 자동 진행 (startMatch와 동일 흐름, roomId만 다름)

### 7.4 MATCH_COUNTDOWN 타이머 — 서버 시간 기준

`MATCH_COUNTDOWN`의 `startAt`(서버 기준 시작 시각)과 `secondsRemaining`을 기반으로 클라이언트 타이머를 계산합니다. `setInterval` 1초 감소 방식 대신 `startAt + secondsRemaining * 1000 - Date.now()` 기반 실시간 계산으로 서버 시간과 오차를 최소화합니다.

### 7.5 컴포넌트 언마운트 시 STOMP disconnect

`OnlineRpsPage` 또는 `useRpsGame` cleanup 함수에서 반드시 `rpsStompClient.disconnect()`와 `sendLeave()` 발행을 처리합니다. 브라우저 뒤로가기나 다른 페이지로 navigate 시 방이 정리되도록 합니다.

### 7.6 카드 이미지 경로

`frontend/public/games/rcp/rock.png`, `paper.png`, `scissors.png` 3개 존재 확인 완료.
`RpsCard.tsx`에서 `/games/rcp/{choice.toLowerCase()}.png` 패턴으로 참조합니다.

### 7.7 AuthRoute vs PrivateRoute 선택

`App.tsx`에서 기존 `AuthRoute` 컴포넌트를 사용합니다(`blockfall-insane` 라우트와 동일 패턴). PRD 섹션 3에서 "일반 로그인 유저(USER/FRIEND/ADMIN) 전체 허용"이므로 `FriendRoute`(FRIEND 이상)가 아닌 `AuthRoute`(로그인 여부만 확인)가 적합합니다.

---

## 8. 구현 순서 계획

1. `rps.types.ts` — 모든 타입 정의 먼저 확정 (다른 파일의 의존 기반)
2. `rpsStompClient.ts` — WebSocket 클라이언트 팩토리
3. `useRpsGame.ts` — 상태 관리 훅 (REST + WebSocket 연동)
4. `RpsCard.tsx` + CSS — 카드 UI 컴포넌트
5. `WaitingScreen.tsx` / `GameScreen.tsx` / `ResultScreen.tsx` + CSS — 화면 컴포넌트
6. `OnlineRpsPage.tsx` — 라우트 페이지
7. `App.tsx` 수정 — 라우트 등록 + RSP 라우트/import 제거
8. `admin.ts` 수정 — adminRspApi 섹션 제거
9. 게임 파일 삭제: `games/rsp/` 3개, `pages/admin/AdminRspPage.tsx`, `pages/admin/AdminRspExcelPage.tsx`
10. `HomePage.tsx` 수정 — Online RPS 버튼 추가
11. `tsc -b && eslint .` 통과 확인

---

## 9. 파일 카운트 요약

| 구분 | 수 |
|---|---|
| 삭제 대상 파일 | 5개 |
| 신규 파일 | 10개 |
| 수정 파일 | 3개 (`App.tsx`, `admin.ts`, `HomePage.tsx`) |

---

## 10. 미결 사항 (백엔드 의존)

- 백엔드 `POST /api/rps/match` 엔드포인트 구현 완료 여부 확인 필요
- WebSocket `/app/rps/**` 핸들러 구현 완료 여부 확인 필요
- 실제 통합 테스트는 백엔드 배포 후 가능

---

> 이 계획서는 코드 변경 없이 작성된 설계 문서입니다. 사용자 CP2 승인 후 구현 시작합니다.
