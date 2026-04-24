# PRD — Online RPS (실시간 멀티플레이 가위바위보)

- 작성자: planner
- 최초 작성일: 2026-04-24
- 수정일: **2026-04-24 — 플로우 변경 (자동 매칭)**: 로비/방 생성 플로우 제거, 단일 `POST /api/rps/match` 자동 매칭 방식으로 전환. CP1 결정 항목에 "자동 시작 방식" 추가.
- 상태: **CP1 승인 완료 (2026-04-24)** — Phase 2 착수 가능
- 승인자: 프로젝트 오너 (사용자)
- CP1 확정 내용:
  - CP1-1: Option C 승인 (2~4인 동시 선택, 카드 종류 수 기반 판정)
  - CP1-2: 타임아웃 **10초** / 미선택 시 랜덤 자동 선택 / 서버 주체
  - CP1-3: MVP 결과 DB 저장만, 글로벌 랭킹 Phase 2
  - CP1-4: Option α 승인 (5초 카운트다운 자동 시작, 방장/준비 개념 제거)
- 관련 문서:
  - 구(舊) PRD: `docs/specs/rsp-game.md` (어드민 솔로 RSP — 본 프로젝트로 대체됨)
  - 채팅 WebSocket 인프라 참조: `docs/progress/developer-backend-chat-testroom.md`
- 관련 progress:
  - `docs/progress/planner-online-rps.md` (본 PRD 작업 로그)

---

## 1. 배경 & 목표

### 배경
- 기존 `rsp-game`은 ADMIN 역할 유저만 접근 가능한 **1인 vs 컴퓨터** 게임으로, 사용 빈도가 낮고 랭킹/홈/Excel/사이드바 어디에도 노출되지 않는 사실상 사문화 기능.
- 2026-04-23에 완료된 `chat-testroom` 프로젝트로 **STOMP/SockJS/JWT 핸드셰이크/Redis/세션 인터셉터** 등 실시간 멀티플레이어 인프라가 완비됨.
- 이 인프라를 재활용하여 어드민 솔로 RSP를 **전체 로그인 유저 대상 실시간 멀티플레이 RPS**로 전면 교체.

### 목표
- 로그인 유저 2~4명이 실시간으로 카드(가위/바위/보)를 내고 승부를 가리는 온라인 RPS 게임.
- **게임 진입 즉시 자동 매칭** → 대기(플레이어 충원) → 게임 시작 → 선택 → 결과 → 재도전 플로우. (로비/방 생성 UI 없음)
- 기존 채팅 WebSocket 경로(`/topic/room/**`, `/app/chat/**`)와 완전히 분리된 네임스페이스(`/topic/rps/**`, `/app/rps/**`) 사용.
- 결과는 DB에 저장하되, 글로벌 랭킹 반영은 Phase 2로 분리 (MVP 범위 축소).

### 비목표 (Out of Scope)
- 채점/점수 누적 랭킹 (Phase 2).
- 친구 초대 / 비공개 방 비밀번호 (Phase 2).
- 관전 모드 / 리플레이 / 채팅 병행 (Phase 2).
- 게스트/비로그인 유저 접근.
- AI 봇 채우기 (방장이 인원 모자란 채로 시작하면 최소 2인만 있으면 게임 시작).

---

## 2. 유저 스토리

- **US-1 (핵심)** — As a logged-in user, I want to click the "Online RPS" entry and be matched automatically, so that I can start playing without navigating a lobby.
- **US-2** — As a matched player, I want to see the current waiting room state (how many players joined, capacity), so that I know when the game will start.
- **US-3 (자동 시작 방식에 따라 조건부)** — As a matched player, I want the game to start automatically once we have 2 or more players, so that I don't have to coordinate readiness manually. *(추천안 — CP1-4에서 확정)*
- **US-4** — As a player, I want to pick rock, paper, or scissors within the time limit, so that I can participate in a round.
- **US-5** — As a player, I want to see the result (everyone's choice + who won/lost/drew) immediately after the round, so that I know the outcome.
- **US-6** — As a player, I want to request a rematch in the same room with the same players, so that we can keep playing without rematching.
- **US-7** — As a player, I want my disconnection to be handled gracefully (auto-leave, not stuck), so that the game doesn't break for others.
- **US-8** — As a player, I want to leave the room at any time and the server to clean up empty rooms, so that stale rooms don't pollute future matches.
- **US-9** — As a logged-in user, I want the RPS chat/game paths to be isolated from the chat testroom paths, so that there is no interference.

---

## 3. 모드 적용 범위 (**필수 필드**)

- **일반 모드: 필수 (Must)**
- **Excel 모드: 해당 없음 (N/A)**
- 사용자 지시: "일반 모드만. Excel 모드 없음." 명시됨.
- designer는 **일반 모드만** 명세 작성.
- developer-frontend는 **일반 모드만** 구현.
- qa-tester는 **일반 모드만** 검증.

---

## 4. 게임 플로우 (상세)

### 4.1 전체 플로우 다이어그램 (텍스트)

> **핵심 변경 (2026-04-24):** 로비 화면 / 방 목록 / 방 생성 UI 제거. 유저는 "Online RPS" 진입 버튼 하나만 보고, 클릭 시 서버가 자동으로 매칭 또는 방 생성까지 처리한다.

```
[홈/게임 허브] — "Online RPS" 버튼 (사이드바 or 게임 카드)
        ↓ 클릭
[자동 매칭 호출] POST /api/rps/match
        ↓ 서버 처리:
        ①  WAITING 상태 & 정원 미달 방 검색 (최신 생성순 1건)
        ②  발견 시 → 해당 방에 유저 자리 예약 + roomId 반환
        ③  미발견 시 → 새 방 자동 생성(이름 자동: "RPS-{timestamp}" 또는 익명) + 유저를 첫 참가자(혹은 호스트)로 등록 + roomId 반환
        ↓ 클라이언트 수신: { roomId, status, playerCount }
        ↓
[WebSocket 연결 + 구독]
  /topic/rps/room/{roomId}
        ↓
[JOIN 발행] /app/rps/room/{roomId}/join  (자동 호출)
        ↓
[대기 화면]
  - "플레이어 대기 중…" 메시지
  - 현재 인원 / 최대 인원 표시 (예: 2/4)
  - 참가자 닉네임 리스트
  - '나가기' 버튼만 노출
  - (추천안: 카운트다운 자동 시작 방식 채택 시) 2인 이상 모이면 서버가 5초 카운트다운 브로드캐스트 후 자동 GAME_STARTED
  - (대안: 호스트 버튼 방식 채택 시) 먼저 입장한 유저에게 '시작' 버튼 노출
        ↓ (자동 or 호스트 액션)
[게임] 라운드 진행
  - 서버가 GAME_STARTED 이벤트 브로드캐스트 (타이머 시작, 10초)
  - 각 플레이어가 카드 선택 (서버 전송)
  - 모두 선택 완료 or 타이머 만료 → 서버가 결과 계산
  - 결과 브로드캐스트: 각 플레이어 선택 + 각자 승/패/무
        ↓
[결과 화면]
  - 본인 승패 + 다른 참가자 선택 표시
  - '재도전' 버튼 (누구나 가능) → ROOM_STATE 리셋 + 대기 화면 복귀
  - '나가기' 버튼 — 방에서 나가 홈으로 이동 (새 매칭을 원하면 "Online RPS" 재클릭)
```

### 4.2 방 상태 (rps_room.status)

| 상태 | 의미 |
|---|---|
| `WAITING` | 매칭 가능 — `POST /api/rps/match` 응답 대상. 정원 미달 시 신규 매칭 유입 가능 |
| `PLAYING` | 게임 진행 중 — 신규 매칭 대상에서 제외 |
| `FINISHED` | 게임 종료 / 전원 퇴장 — 매칭/접근 불가, 일정 시간 후 DB 정리 대상 |

### 4.3 매칭 알고리즘 (서버 로직 — `POST /api/rps/match` 처리)

```
1. 동일 유저의 활성 방 중복 참여 방지 확인
   - 이미 WAITING/PLAYING 방에 참가 중이면 409 ALREADY_IN_ROOM 반환
     (클라이언트는 해당 roomId로 재진입 유도)
2. 매칭 대상 탐색 (DB + Redis 트랜잭션/락 내부):
   - status=WAITING
   - currentPlayers < maxPlayers
   - created_at 최신순 1건 선택 (오래된 방이 먼저 채워지는 FIFO를 원하면 ASC 로 변경 — CP3에서 developer-backend 최종 결정)
3. 대상 있음 → 해당 방에 유저 자리 예약 (currentPlayers++). roomId 반환.
4. 대상 없음 → 새 rps_room row INSERT (maxPlayers=4 기본, name 자동생성, status=WAITING). 생성한 유저를 첫 참가자로 등록. roomId 반환.
5. 전 과정 동시성 제어:
   - Redis 분산락 "rps:match:lock" 또는 DB 행 레벨 락 (SELECT ... FOR UPDATE) 사용.
   - 동시 요청 폭주 시 중복 방 생성 최소화.
```

---

## 5. 4인 대결 방식 (**CP1 승인 필요**)

### 5.1 Planner 추천안: **Option C — 2~4인 동시 선택 (Simultaneous Multi-Player)**

**작동 방식:**
- 방은 2~4인 허용 (min 2, max 4, 방장이 방 생성 시 `maxPlayers` 지정).
- 게임 시작 시 참가자 전원이 **동시에** 카드 선택.
- 제한 시간 내 모두 선택 완료 또는 타이머 만료 시 결과 계산.
- 각 플레이어별로 개별 승/패/무 판정:
  - 전원 같은 카드 = 전원 DRAW.
  - 세 종류(ROCK/PAPER/SCISSORS) 모두 나옴 = 전원 DRAW (상성 루프).
  - 두 종류만 나옴 = 이기는 카드를 낸 사람들은 WIN, 진 카드를 낸 사람들은 LOSS.
  - 예: 4인 중 ROCK 2명, SCISSORS 2명 → ROCK 2명 WIN, SCISSORS 2명 LOSS.
  - 예: 4인 중 ROCK 2명, PAPER 1명, SCISSORS 1명 → 세 종류 모두 → 전원 DRAW.

**추천 이유:**
1. **구현이 가장 단순** — 매칭/브래킷 관리 불필요, 한 번에 한 라운드만 처리.
2. **즉시 결과** — 참가자 전원이 같은 시점에 결과를 확인 (Option B 토너먼트 대비 대기시간 없음).
3. **소규모 세션 친화적** — 2~3인만 모여도 바로 플레이 가능 (Option B는 4인 필수).
4. **판정 로직 명료** — 카드 종류 수(1/2/3)만 체크하면 됨.
5. **재도전 UX 자연스러움** — 같은 인원으로 바로 다음 라운드 진행 가능.

### 5.2 대안 (사용자가 다른 방식 선호 시)

- **Option A (4인 동시, "가장 많이 이긴 선택이 승리")**: 판정 규칙이 복잡하고 "가장 많이 이겼다"의 정의 자체가 모호함 — 4인 모두 같은 카드도 아닌데 1명만 이기는 경우 해당 1명만 WIN? 동점 시 전원 DRAW? 직관성 떨어짐.
- **Option B (1v1 토너먼트 4강/2강/결승)**: 4인 강제 + 여러 라운드 관리(브래킷 DB 스키마) + 탈락자 대기 UX 복잡. MVP 범위 초과.

### 5.3 CP1 결정 요청 내용
- [ ] Option C(2~4인 동시 선택, 카드 종류 수 기반 판정) **승인**
- [ ] Option A / B / 기타 방식 지정

---

## 6. 타임아웃 정책 (**CP1 승인 필요**)

### 6.1 Planner 추천안

| 항목 | 추천 값 | 이유 |
|---|---|---|
| 선택 제한 시간 | **15초** | RPS는 즉흥 선택 게임. 20~30초는 긴 편이라 긴장감 하락. 15초면 충분히 직관적 선택 가능하면서 지루하지 않음. |
| 제한 시간 내 미선택 시 | **자동 랜덤 선택 (ROCK/PAPER/SCISSORS 중 균등 확률)** | 패배 처리보다 랜덤 선택이 재도전 사이클을 자연스럽게 유지. 의도적 태업(AFK)도 결과에 편향을 주지 않음. |
| 타임아웃 처리 주체 | **서버 (`ScheduledExecutorService` 또는 `@Scheduled` 태스크)** | 클라이언트 조작 방지 + 모든 참가자에게 일관된 판정 시점 보장. |

### 6.2 CP1 확정 (2026-04-24)
- **제한 시간: 10초** (사용자 지정)
- **미선택 시: 랜덤 자동 선택** 승인
- **타임아웃 주체: 서버** 승인

---

## 7. WebSocket 이벤트 명세 (**전체 상세**)

### 7.1 경로 체계

> 기존 채팅(`/topic/room/**`, `/app/chat/**`)과 **완전히 격리된** `/rps` 네임스페이스 사용.

| 용도 | 경로 | 방향 | 비고 |
|---|---|---|---|
| Endpoint | `/ws` (SockJS, JWT) | 기존 채팅과 **공유** (JwtHandshakeInterceptor 재사용) | — |
| 구독 — 방 이벤트 | `/topic/rps/room/{roomId}` | 서버 → 모든 참가자 | — |
| 발행 — 방 입장 알림 | `/app/rps/room/{roomId}/join` | 클라이언트 → 서버 | **HTTP `POST /api/rps/match`로 roomId를 받은 직후 자동 호출** (유저가 roomId를 직접 선택하지 않음) |
| 발행 — 준비 완료 토글 | `/app/rps/room/{roomId}/ready` | 클라이언트 → 서버 | **CP1-4에서 "호스트 시작 버튼 방식"이 채택된 경우에만 사용.** 카운트다운 자동 시작 방식 채택 시 미사용. |
| 발행 — 게임 시작 | `/app/rps/room/{roomId}/start` | 클라이언트 → 서버 | **CP1-4에서 "호스트 시작 버튼 방식"이 채택된 경우에만 사용.** 카운트다운 자동 시작 방식 채택 시 서버가 자동 트리거. |
| 발행 — 카드 선택 | `/app/rps/room/{roomId}/choose` | 클라이언트 → 서버 | — |
| 발행 — 재도전 요청 | `/app/rps/room/{roomId}/rematch` | 클라이언트 → 서버 | — |
| 발행 — 방 퇴장 | `/app/rps/room/{roomId}/leave` | 클라이언트 → 서버 | — |
| 구독 — 개인 에러 | `/user/queue/errors` | 기존 채팅과 **공유** (에러 코드로 구분) | — |

### 7.2 메시지 타입 (서버 → 클라이언트, `/topic/rps/room/{roomId}`)

모든 서버 브로드캐스트 메시지는 공통 envelope:
```json
{
  "type": "<EVENT_TYPE>",
  "timestamp": "2026-04-24T12:34:56.789Z",
  "payload": { ... }
}
```

#### 7.2.1 `ROOM_STATE` — 방 상태 업데이트

참가자 입/퇴장/준비 토글 시 전체 방 상태를 재브로드캐스트.

```json
{
  "type": "ROOM_STATE",
  "timestamp": "2026-04-24T12:00:00.000Z",
  "payload": {
    "roomId": "abc12345",
    "name": "편하게 한판",
    "status": "WAITING",
    "hostUserId": 101,
    "maxPlayers": 4,
    "participants": [
      { "userId": 101, "nickname": "방장닉", "ready": true, "isHost": true },
      { "userId": 202, "nickname": "참가자A", "ready": false, "isHost": false }
    ]
  }
}
```

#### 7.2.2 `GAME_STARTED` — 게임 시작 신호 (타이머 시작)

```json
{
  "type": "GAME_STARTED",
  "timestamp": "2026-04-24T12:01:00.000Z",
  "payload": {
    "roomId": "abc12345",
    "roundNum": 1,
    "deadlineAt": "2026-04-24T12:01:15.000Z",
    "timeoutSeconds": 10,
    "participantUserIds": [101, 202, 303]
  }
}
```

- 클라이언트는 `deadlineAt` 을 받아 로컬 타이머 표시. 서버 시간 기준.

#### 7.2.3 `ROUND_RESULT` — 결과 브로드캐스트

```json
{
  "type": "ROUND_RESULT",
  "timestamp": "2026-04-24T12:01:12.500Z",
  "payload": {
    "roomId": "abc12345",
    "roundNum": 1,
    "results": [
      { "userId": 101, "nickname": "방장닉",  "choice": "ROCK",     "autoPicked": false, "result": "WIN" },
      { "userId": 202, "nickname": "참가자A", "choice": "SCISSORS", "autoPicked": false, "result": "LOSS" },
      { "userId": 303, "nickname": "참가자B", "choice": "SCISSORS", "autoPicked": true,  "result": "LOSS" }
    ]
  }
}
```

- `autoPicked: true` → 타임아웃으로 서버가 대신 선택한 경우.
- 결과 브로드캐스트 직후 서버는 방 상태를 `WAITING`으로 리셋 + 준비 상태 전원 false로 돌림 + `ROOM_STATE` 재브로드캐스트.

#### 7.2.4 `PLAYER_LEFT` — 플레이어 나감/연결끊김

```json
{
  "type": "PLAYER_LEFT",
  "timestamp": "2026-04-24T12:00:30.000Z",
  "payload": {
    "roomId": "abc12345",
    "userId": 202,
    "nickname": "참가자A",
    "reason": "DISCONNECT"
  }
}
```

- `reason` enum: `LEAVE` (자발적), `DISCONNECT` (연결 끊김), `KICKED` (장기 미응답).

#### 7.2.5 `HOST_CHANGED` — 방장 이전

방장 연결 끊김 시 가장 먼저 입장한 잔존 참가자로 이전.

```json
{
  "type": "HOST_CHANGED",
  "timestamp": "2026-04-24T12:00:40.000Z",
  "payload": {
    "roomId": "abc12345",
    "newHostUserId": 303,
    "newHostNickname": "참가자B"
  }
}
```

#### 7.2.6 `ROOM_CLOSED` — 방 해산

방장 단독 상태에서 방장 퇴장 시 또는 전원 퇴장 시.

```json
{
  "type": "ROOM_CLOSED",
  "timestamp": "2026-04-24T12:05:00.000Z",
  "payload": {
    "roomId": "abc12345",
    "reason": "EMPTY"
  }
}
```

- `reason` enum: `EMPTY` (전원 퇴장), `HOST_LEFT_ALONE` (방장 혼자일 때 퇴장).

#### 7.2.7 `MATCH_COUNTDOWN` — 자동 시작 카운트다운 (CP1-4 카운트다운 방식 채택 시에만)

참가자 수가 2명 이상이 된 시점에 서버가 5초(기본) 카운트다운 타이머를 시작하고 아래 이벤트를 브로드캐스트한다.
도중에 인원이 1명 이하로 감소하면 서버가 `MATCH_COUNTDOWN_CANCELLED`로 취소 브로드캐스트.

```json
{
  "type": "MATCH_COUNTDOWN",
  "timestamp": "2026-04-24T12:00:50.000Z",
  "payload": {
    "roomId": "abc12345",
    "secondsRemaining": 5,
    "startAt": "2026-04-24T12:00:55.000Z"
  }
}
```

취소 메시지:
```json
{
  "type": "MATCH_COUNTDOWN_CANCELLED",
  "timestamp": "2026-04-24T12:00:52.000Z",
  "payload": {
    "roomId": "abc12345",
    "reason": "PLAYER_LEFT_BELOW_MIN"
  }
}
```

- 카운트다운 만료 시 서버가 자동으로 `GAME_STARTED` 브로드캐스트 + 방 상태 PLAYING 전환. (`/start` 이벤트 불필요)
- 카운트다운 중 신규 유저가 추가 입장해도 기존 타이머는 유지 (리셋하지 않음). 단, 4인 꽉 찰 시 즉시 타이머 만료 후 GAME_STARTED 트리거 (선택 구현 — CP3에서 developer-backend 결정).

### 7.3 클라이언트 → 서버 메시지

#### 7.3.1 `/app/rps/room/{roomId}/join`

**유저가 직접 roomId를 선택해 호출하는 이벤트가 아니다.**
`POST /api/rps/match` 응답으로 받은 roomId에 대해 클라이언트가 WebSocket 구독을 설정한 직후 **자동으로 1회 발행**한다.
서버는 HTTP 매칭 단계에서 이미 자리 예약을 했으므로, 이 이벤트는 실제 WebSocket 세션-유저-방 바인딩 및 `ROOM_STATE` 브로드캐스트 트리거 역할을 한다.

Body:
```json
{}
```

서버 처리:
1. JWT Principal 유효 확인 (없으면 `UNAUTHORIZED`)
2. 방 존재 확인 (없으면 `ROOM_NOT_FOUND`)
3. 방 상태가 WAITING인지 확인 (PLAYING/FINISHED면 `ROOM_NOT_AVAILABLE`)
4. `POST /api/rps/match`에서 예약한 참가자 slot과 현재 Principal 매칭 확인 (불일치 시 `NOT_IN_ROOM`)
5. 세션 속성에 roomId 기록 (`rpsSubscribedRoomIds`에 추가) — 연결 끊김 시 `SessionDisconnectEvent`에서 참조
6. `ROOM_STATE` 브로드캐스트 (전체 참가자에게)
7. (CP1-4에서 "카운트다운 자동 시작" 채택된 경우) 현재 참가자 수 >= 2 이면 서버가 `MATCH_COUNTDOWN` 타이머 시작 or 재시작 (§7.2.7 참조)

#### 7.3.2 `/app/rps/room/{roomId}/ready`

```json
{ "ready": true }
```

서버 처리:
1. 방 WAITING 상태 확인
2. 방장은 준비 토글 대상이 아님 (방장이 ready 보내면 무시 or `INVALID_ACTION`)
3. 참가자의 ready 필드 갱신 + `ROOM_STATE` 브로드캐스트

#### 7.3.3 `/app/rps/room/{roomId}/start` (방장만)

```json
{}
```

서버 처리:
1. Principal이 방장 확인 (아니면 `NOT_HOST`)
2. 방 WAITING 상태 확인
3. 참가자 수 >=2 확인 (아니면 `NOT_ENOUGH_PLAYERS`)
4. 방장 제외 전원 `ready=true` 확인 (아니면 `NOT_ALL_READY`)
5. 방 상태 `PLAYING`으로 전환 + `GAME_STARTED` 브로드캐스트 + 서버사이드 타임아웃 태스크 스케줄

#### 7.3.4 `/app/rps/room/{roomId}/choose`

```json
{ "choice": "ROCK" }
```

- `choice` 값: `ROCK` / `PAPER` / `SCISSORS` (대문자 고정).

서버 처리:
1. 방 PLAYING 상태 확인 (아니면 `GAME_NOT_ACTIVE`)
2. Principal이 현재 라운드 참가자인지 확인
3. 이미 선택했는지 확인 (중복 시 `ALREADY_CHOSEN`)
4. 서버 메모리/Redis에 선택 기록
5. 모두 선택 완료 시 → 스케줄된 타임아웃 태스크 취소 + 즉시 결과 계산 + `ROUND_RESULT` 브로드캐스트 + DB 저장 + 방 상태 WAITING으로 리셋

#### 7.3.5 `/app/rps/room/{roomId}/rematch` (방장만)

```json
{}
```

서버 처리:
1. Principal이 방장 확인
2. 방 상태 WAITING 확인 (방이 막 결과 낸 직후 상태)
3. 모든 참가자 ready 상태 초기화 (false) + `ROOM_STATE` 브로드캐스트
4. 실제 시작은 방장이 다시 `/start`를 보내야 함 (재도전은 "준비 리셋 + 새 라운드 시작 유도" 트리거)

#### 7.3.6 `/app/rps/room/{roomId}/leave`

```json
{}
```

서버 처리:
1. 참가자 목록에서 제거
2. 방장이 떠나면 방장 이전 또는 방 해산 (§8 참조)
3. `PLAYER_LEFT` 브로드캐스트

### 7.4 에러 메시지 (`/user/queue/errors`)

```json
{
  "code": "<ERROR_CODE>",
  "message": "<한글 설명>"
}
```

| code | 상황 |
|---|---|
| `ROOM_NOT_FOUND` | 존재하지 않는 roomId |
| `ROOM_NOT_AVAILABLE` | 방이 PLAYING/FINISHED 상태라 입장 불가 |
| `ROOM_FULL` | 정원 초과 |
| `NOT_HOST` | 방장 전용 액션을 일반 참가자가 시도 |
| `NOT_IN_ROOM` | 해당 방에 입장하지 않은 유저가 액션 시도 |
| `NOT_ENOUGH_PLAYERS` | 2인 미만으로 시작 시도 |
| `NOT_ALL_READY` | 방장 제외 전원 준비가 아닐 때 시작 시도 |
| `GAME_NOT_ACTIVE` | PLAYING 상태 아닐 때 choose 시도 |
| `ALREADY_CHOSEN` | 이미 선택한 상태에서 재선택 시도 |
| `INVALID_CHOICE` | choice 값이 ROCK/PAPER/SCISSORS 아님 |
| `INVALID_ACTION` | 그 외 허용되지 않는 액션 (방장이 ready 토글 등) |
| `UNAUTHORIZED` | JWT Principal 없음 or 만료 |

---

## 8. 연결 끊김 처리 정책

### 8.1 감지 방법
- Spring의 `SessionDisconnectEvent` 리스너로 감지 (기존 `ChatController.handleDisconnect` 패턴 재사용).
- 세션 속성에 `rpsSubscribedRoomIds: Set<String>` 저장 (채팅의 `subscribedRoomIds`와 별도 키).

### 8.2 대기방(WAITING)에서 연결 끊김
| 상황 | 처리 |
|---|---|
| 일반 참가자 끊김 | 참가자 목록에서 제거 + `PLAYER_LEFT` 브로드캐스트 + 남은 인원에게 `ROOM_STATE` 갱신 |
| 방장 끊김, 다른 참가자 있음 | **가장 먼저 입장한 잔존 참가자로 방장 이전** + `HOST_CHANGED` + `ROOM_STATE` 브로드캐스트 |
| 방장 끊김, 혼자였음 | 방 상태 `FINISHED` 전환 + `ROOM_CLOSED(reason=HOST_LEFT_ALONE)` 브로드캐스트 + 방 DB row soft-close |
| 전원 퇴장 | `ROOM_CLOSED(reason=EMPTY)` + 방 DB row soft-close |

### 8.3 게임(PLAYING)에서 연결 끊김
| 상황 | 처리 |
|---|---|
| 일부 참가자 끊김, 잔존 >=2 | 끊긴 참가자는 **자동 LOSS 처리** (카드 미선택 간주) + 나머지는 정상 결과 계산 + `PLAYER_LEFT` + `ROUND_RESULT` 순차 브로드캐스트 |
| 일부 참가자 끊김, 잔존 1명 | 남은 1명에게 **WIN** 부여 + 라운드 조기 종료 + `ROUND_RESULT` 브로드캐스트 + 방 WAITING으로 복귀 (혼자 남았으니 실질적 대기 상태) |
| 전원 끊김 | `ROOM_CLOSED(reason=EMPTY)` + DB soft-close |
| 방장 끊김 | 남은 참가자 중 방장 이전 + `HOST_CHANGED` + 라운드는 정상 진행 |

### 8.4 재연결 (MVP 비목표)
- 동일 세션 재연결 처리는 MVP 범위 밖. 재연결 시 새 세션으로 취급하여 방 재입장 필요.

---

## 9. REST API 계약

### 공통
- Auth: **Authenticated** (JWT Bearer). ADMIN/USER/FRIEND 모두 가능. ADMIN 전용 아님.
- SecurityConfig: `/api/rps/**` → `authenticated()`.
- 에러 포맷: `{ "error": "<ERROR_CODE>" }` (GlobalExceptionHandler 기존 패턴 준수).

> **2026-04-24 플로우 변경**: 로비 화면 제거로 인해 방 목록/생성/입장/상세 API 4종(`GET /api/rps/rooms`, `POST /api/rps/rooms`, `POST /api/rps/rooms/{roomId}/join`, `GET /api/rps/rooms/{roomId}`)을 모두 제거하고, **단일 자동 매칭 API `POST /api/rps/match` 1개**로 대체.

### 9.1 `POST /api/rps/match` — 자동 매칭 요청 (단일 진입점)

**목적**
- 유저가 "Online RPS" 버튼을 클릭한 직후 호출.
- 서버가 대기방(WAITING + 정원 미달)을 자동 탐색하여 자리 예약하거나, 없을 경우 신규 방을 자동 생성.
- 응답의 `roomId`로 클라이언트가 WebSocket 구독 → `/app/rps/room/{roomId}/join` 자동 발행 순으로 이어짐.

**요청**
- Method: `POST`
- Path: `/api/rps/match`
- Headers: `Authorization: Bearer <JWT>`
- Body: 없음 (빈 JSON `{}` 허용)

**응답 200 — 기존 대기방 매칭됨**
```json
{
  "roomId": "abc12345",
  "status": "WAITING",
  "playerCount": 2,
  "maxPlayers": 4,
  "created": false
}
```

**응답 201 — 신규 방 자동 생성됨**
```json
{
  "roomId": "xyz98765",
  "status": "WAITING",
  "playerCount": 1,
  "maxPlayers": 4,
  "created": true
}
```

**응답 필드 설명**
| 필드 | 타입 | 설명 |
|---|---|---|
| `roomId` | string(8) | 외부 노출 방 식별자. 클라이언트가 WebSocket 구독 시 사용. |
| `status` | string | 항상 `"WAITING"` (응답 시점 상태). 서버 내부 race로 PLAYING 전환되어 있으면 서버가 매칭에서 제외하므로 WAITING 보장. |
| `playerCount` | int | 본 유저 포함 현재 인원 수 (1~maxPlayers). |
| `maxPlayers` | int | 방 최대 인원 (기본 4, 향후 변경 여지 있음). |
| `created` | bool | `true`면 신규 방을 생성해 본 유저가 첫 입장자, `false`면 기존 대기방에 합류. 클라이언트 UI 분기용(예: "새 방을 만들었어요" vs "대기방에 합류했어요"). |

**서버 처리 로직**
1. JWT Principal 검증 → 없으면 `401 UNAUTHORIZED`.
2. 동일 유저가 이미 WAITING/PLAYING 방에 참가 중인지 조회 → 참가 중이면 `409 ALREADY_IN_ROOM` (응답 body에 기존 `roomId` 포함 — 클라이언트가 해당 방으로 재진입 유도).
3. Redis 분산락 `rps:match:global` 획득 (또는 DB 트랜잭션 + `SELECT ... FOR UPDATE`).
4. `rps_room` 중 `status=WAITING AND currentPlayers < maxPlayers` 조건의 최신 생성 방 1건 조회.
5. 조회 결과 있음 → 참가자 slot 예약 (`currentPlayers++`), `created=false` 응답.
6. 조회 결과 없음 → 새 `rps_room` INSERT (maxPlayers=4, status=WAITING, 이름 자동 생성 예: `RPS-{createdAt epoch}`), 본 유저를 첫 참가자로 등록, `created=true` 응답.
7. 락 해제.

**에러**
| HTTP | 코드 | 상황 |
|---|---|---|
| 401 | `UNAUTHORIZED` | JWT 누락/만료 |
| 409 | `ALREADY_IN_ROOM` | 유저가 이미 활성 방에 참가 중. 응답 body 예: `{ "error": "ALREADY_IN_ROOM", "roomId": "abc12345" }` |
| 429 | `MATCH_RATE_LIMIT` | 동일 유저가 짧은 시간 내 매칭 요청 반복 (예: 10초 내 5회 초과 — developer-backend가 CP3에서 구체 임계치 결정) |
| 503 | `MATCH_UNAVAILABLE` | Redis/DB 락 획득 실패 등 일시적 오류. 클라이언트는 재시도 권장. |

**클라이언트 후속 동작 (참고)**
1. 200/201 응답 수신 → `roomId` 추출
2. SockJS+STOMP 연결 (이미 연결돼 있으면 재사용)
3. `/topic/rps/room/{roomId}` 구독
4. `/app/rps/room/{roomId}/join` 자동 발행 (body `{}`)
5. 서버의 `ROOM_STATE` 브로드캐스트 수신 → 대기 화면 렌더링
6. (카운트다운 자동 시작 방식인 경우) 2인 이상 충족 시 `MATCH_COUNTDOWN` 수신 → 카운트다운 UI 표시 → `GAME_STARTED` 수신 → 게임 화면 전환

**409 ALREADY_IN_ROOM 처리 정책**
- 유저가 모바일에서 게임 화면 벗어난 뒤 다시 "Online RPS" 누른 경우 등 발생 가능.
- 서버는 기존 방 `roomId`를 응답에 포함해 클라이언트가 해당 방에 재진입(재구독 + `/join` 발행) 하도록 유도.
- 클라이언트는 "이미 진행 중인 방에 다시 연결합니다" 토스트 표시 후 자동 재접속.

---

## 10. 엣지 케이스 & 에러 시나리오

| ID | 상황 | 처리 |
|---|---|---|
| EC-1 | 방 정원(4명) 초과 입장 시도 | HTTP `409 ROOM_FULL` 또는 STOMP `ROOM_FULL` 에러 |
| EC-2 | `PLAYING` 상태 방 입장 시도 | `409 ROOM_NOT_AVAILABLE` |
| EC-3 | 방장 아닌 유저가 `/start` 전송 | STOMP 에러 `NOT_HOST` |
| EC-4 | 방장 아닌 유저가 `/rematch` 전송 | STOMP 에러 `NOT_HOST` |
| EC-5 | 선택 후 재선택 시도 | STOMP 에러 `ALREADY_CHOSEN` |
| EC-6 | 2인 미만 상태에서 `/start` | STOMP 에러 `NOT_ENOUGH_PLAYERS` |
| EC-7 | 비방장이 미준비 상태로 시작 시도 | STOMP 에러 `NOT_ALL_READY` |
| EC-8 | 타임아웃까지 아무도 선택 안 함 | 전원 랜덤 자동 선택 + 결과 계산 + 브로드캐스트 (autoPicked=true) |
| EC-9 | 게임 중 전원 연결끊김 | `ROOM_CLOSED(EMPTY)` + DB soft-close |
| EC-10 | 방장 게임 중 연결끊김 | 방장 이전 + 라운드는 정상 진행 |
| EC-11 | 유저가 이미 활성 방에 있는 상태에서 `POST /api/rps/match` 재호출 | `409 ALREADY_IN_ROOM` + 기존 roomId 응답. 클라이언트는 해당 방으로 자동 재진입. |
| EC-12 | choice 값이 ROCK/PAPER/SCISSORS 외 (예: `"rock"` 소문자, `null`) | `INVALID_CHOICE` 에러 |
| EC-13 | (삭제 — 방 이름 유저 입력 제거됨) | — |
| EC-14 | 동일 유저가 매우 짧은 간격으로 매칭 요청 반복 | `429 MATCH_RATE_LIMIT` (10초 내 5회 초과 기본) |
| EC-15 | `/leave` 없이 브라우저 닫음 | `SessionDisconnectEvent`로 자동 처리 (§8) |
| EC-16 | 자동 생성된 방에 아무도 `/join` 안 하고 창 닫음 | 방은 빈 상태로 남음 — TTL 기반 자동 close (OQ-3, 디폴트 10분 제안) |
| EC-17 | 카운트다운 중 인원이 1명으로 감소 | `MATCH_COUNTDOWN_CANCELLED` 브로드캐스트, 타이머 취소. 2인 이상 복귀 시 재시작. |
| EC-18 | `POST /api/rps/match` 처리 중 서버 Redis 락 타임아웃 | `503 MATCH_UNAVAILABLE`. 클라이언트 자동 재시도(최대 2회, 지수 백오프). |
| EC-19 | 동시에 다수 유저가 매칭 요청해 빈 방이 동시 여러 개 생성되는 race | Redis 분산락으로 1차 방지. 100% 방지는 어려우므로 허용. 빈 방은 TTL로 정리. |

---

## 11. 제거 대상 파일 목록

### 프론트엔드
- `frontend/src/games/rsp/RspBoard.tsx`
- `frontend/src/games/rsp/RspBoard.module.css`
- `frontend/src/games/rsp/useRspGame.ts`
- `frontend/src/pages/admin/AdminRspPage.tsx`
- `frontend/src/pages/admin/AdminRspExcelPage.tsx`
- `frontend/src/api/admin.ts` 내 `adminRspApi` 섹션만 제거 (파일 전체 삭제 금지)
- `App.tsx` 내 `/admin/rsp`, `/admin/rsp/excel` 라우트 등록 제거

### 백엔드
- `backend/src/main/java/com/dobakggun/controller/AdminRspController.java`
- `backend/src/main/java/com/dobakggun/service/AdminRspService.java`
- `backend/src/main/java/com/dobakggun/entity/AdminRspPlay.java`
- `backend/src/main/java/com/dobakggun/repository/AdminRspPlayRepository.java`
- `backend/src/main/java/com/dobakggun/dto/rsp/` 디렉토리 전체 (`RspPlayRequest.java`, `RspPlayResponse.java`, `RspStatsResponse.java`)
- `backend/src/main/java/com/dobakggun/entity/RspChoice.java`, `RspResult.java` — 새 online-rps 엔티티(`RpsChoice`, `RpsResult`)로 대체되므로 함께 제거.
- `SecurityConfig.java` 내 `/api/admin/rsp/**` 규칙 제거

### DB
- `backend/src/main/resources/db/drop-admin-rsp.sql` 신규 작성:
  ```sql
  DROP TABLE IF EXISTS admin_rsp_play;
  ```
- 사용자가 Railway MySQL에 직접 실행해야 함. 마이그레이션 자동화는 본 프로젝트 범위 밖.

### 제거 작업 순서 권장
1. developer-backend가 백엔드 파일 제거 + 새 엔티티/컨트롤러 추가 (같은 PR).
2. developer-frontend가 프론트엔드 파일 제거 + 새 페이지 추가 (같은 PR).
3. 사용자가 `drop-admin-rsp.sql` Railway에 실행.
4. qa-tester가 전체 플로우 검증.

---

## 12. DB 스키마 초안 (ddl-auto=update)

### 12.1 `rps_room`

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `id` | BIGINT | PK, AUTO_INCREMENT | 내부 ID |
| `room_id` | VARCHAR(8) | UNIQUE, NOT NULL | 외부 노출 roomId (8자리 영소문자+숫자, 기존 chat 패턴 재사용) |
| `name` | VARCHAR(30) | NOT NULL | 방 이름 (서버 자동 생성 예: `RPS-{epoch}` — 유저가 이름을 입력하지 않음. Phase 2에 표시용으로만 사용) |
| `status` | VARCHAR(16) | NOT NULL | `WAITING` / `PLAYING` / `FINISHED` |
| `max_players` | INT | NOT NULL | 2~4 |
| `created_by` | BIGINT | FK → user(id), NOT NULL | 방장 user_id (원래 방장, 이전 시에도 유지) |
| `created_at` | DATETIME(3) | NOT NULL | 생성 시각 UTC |
| `closed_at` | DATETIME(3) | NULL | 방 FINISHED 전환 시각 |

- 인덱스: `(status, created_at DESC)` — 방 목록 조회 최적화.

### 12.2 `rps_round_result`

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `id` | BIGINT | PK, AUTO_INCREMENT | |
| `room_id` | BIGINT | FK → rps_room(id), NOT NULL | |
| `round_num` | INT | NOT NULL | 방 내 라운드 번호 (1부터) |
| `player_id` | BIGINT | FK → user(id), NOT NULL | |
| `choice` | VARCHAR(16) | NOT NULL | `ROCK` / `PAPER` / `SCISSORS` |
| `auto_picked` | BOOLEAN | NOT NULL, DEFAULT FALSE | 타임아웃 자동 선택 여부 |
| `result` | VARCHAR(8) | NOT NULL | `WIN` / `LOSS` / `DRAW` |
| `played_at` | DATETIME(3) | NOT NULL | |

- 인덱스: `(room_id, round_num)`, `(player_id, played_at DESC)`.

### 12.3 참조용 DDL 파일
- 위치: `backend/src/main/resources/db/online-rps-schema.sql`
- 실제 적용은 `spring.jpa.hibernate.ddl-auto=update`가 수행. SQL 파일은 문서/수동 점검용.

### 12.4 참가자/준비 상태 저장소

- 대기방의 **참가자 목록/준비 상태**는 DB가 아닌 **Redis** 또는 서버 메모리(동시성 제어된 `ConcurrentHashMap`)에 보관 — 실시간 갱신이 잦고 방 종료 시 필요 없기 때문.
- `rps_round_result`에만 영구 저장.
- 구체적 저장 방식은 developer-backend가 CP4에서 결정 (Redis 권장).

---

## 13. 랭킹 연동

### 13.1 결정 (Planner 권장안 — **CP1 승인 필요**)

- **MVP: 결과 저장만 (DB `rps_round_result`). 글로벌 랭킹 `RankingService.VALID_GAMES`에 `online-rps` 추가하지 않음.**
- **Phase 2: 총 승수/승률 기반 랭킹 추가 검토.**

### 13.2 권장 이유
1. RPS는 **운 기반 게임**이라 랭킹이 의미를 갖기 어려움 (블록폴/지뢰찾기와 성격이 다름).
2. 멀티플레이어 결과는 솔로 스코어와 1:1 대응이 어려워 `RankingService` 현행 스키마(단일 점수 단일 유저)와 충돌.
3. MVP 범위를 실시간 플레이 자체에 집중. 랭킹은 실사용 데이터 쌓인 후 Phase 2에서 설계.

### 13.3 CP1 결정 요청 내용
- [ ] **MVP 결과 저장만** 승인 (권장)
- [ ] MVP에 글로벌 랭킹 포함 지정

---

## 14. 성공 지표

### MVP 완료 기준
- [x] 로그인 유저 2~4명이 동시에 실시간 RPS 라운드 진행 가능
- [x] 각 라운드 결과가 `rps_round_result`에 저장됨
- [x] 기존 채팅(`/topic/room/**`, `/app/chat/**`) 기능 영향 없음 (QA 회귀 테스트 통과)
- [x] 기존 admin-rsp 엔드포인트/페이지 완전 제거 확인

### 관찰 지표 (Phase 2 준비용)
- 일일 방 생성 수 / 일일 라운드 수
- 평균 라운드당 참가자 수
- 타임아웃 자동선택 발생 비율 (15초 타임 적정성 검증)

---

## 15. 체크포인트 (CP1 제출 내용 — **사용자 결정 필요**)

아래 4개 항목에 대해 사용자 승인이 필요합니다. 승인 후 designer(CP2) + developer-frontend/backend(CP3) 병렬 착수.

### CP1-1. 대결 방식
**추천: Option C (2~4인 동시 선택, 카드 종류 수 기반 판정)**
- 이유: 구현 가장 단순, 즉시 결과, 소규모 세션 친화적, 판정 로직 명료.
- [ ] Option C 승인 / [ ] 다른 옵션 지정

### CP1-2. 타임아웃 정책
**추천: 15초 / 미선택 시 랜덤 자동 선택 / 서버 주체**
- 이유: 즉흥 게임 긴장감 유지, AFK 편향 최소화, 클라 조작 방지.
- [ ] 15초 승인 / [ ] 다른 초 지정 (__초)
- [ ] 랜덤 자동 선택 승인 / [ ] 패배 처리 / [ ] DRAW 처리

### CP1-3. 랭킹 연동
**추천: MVP는 결과 저장만, Phase 2에서 랭킹 재검토**
- 이유: 운 기반 게임 특성, `RankingService` 스키마 호환성, MVP 범위 집중.
- [ ] 추천안 승인 / [ ] MVP에 랭킹 포함 지정

### CP1-4. 자동 시작 방식 (신규, 2026-04-24 플로우 변경으로 추가)
**추천: Option α — 카운트다운 자동 시작 (방장/준비 개념 완전 제거)**

**동작 방식 (Option α):**
1. 방에 2인 이상 모이면 서버가 즉시 5초 카운트다운 시작 (`MATCH_COUNTDOWN` 브로드캐스트).
2. 카운트다운 도중 3인/4인이 추가 입장해도 기존 타이머 유지 (리셋 안 함). 단, 4인 꽉 차면 즉시 만료시켜 GAME_STARTED (옵션).
3. 카운트다운 중 누군가 나가서 1인이 되면 `MATCH_COUNTDOWN_CANCELLED` + 타이머 중단. 다시 2인 이상 모이면 재시작.
4. 카운트다운 만료 → 서버가 자동으로 방 상태 PLAYING 전환 + `GAME_STARTED` 브로드캐스트.
5. `ready`/`start` WebSocket 이벤트 및 관련 UI 모두 불필요.

**추천 이유:**
1. **방 생성이 자동인데 "방장"만 수동 버튼을 가지는 것은 UX 불일치** — 유저는 "내가 방을 만든 적 없는데 왜 내가 시작 버튼을 눌러야 해?"라는 혼란 발생.
2. **준비 토글/시작 버튼을 누르지 않고 AFK 상태로 방치되는 유저가 게임 시작을 막는 문제를 근본적으로 차단** — 자동 매칭 방식에서는 "진입 의사=플레이 의사"로 간주 가능.
3. **구현 단순화** — WebSocket 이벤트 2종(`ready`, `start`) 및 `rps_participant.ready` 필드, 방장 이전 로직의 일부가 제거됨.
4. **모바일 유저 친화적** — 화면 전환/버튼 터치 부담 감소, 자동으로 게임이 흘러감.
5. **대기 시간 상한 보장** — 2인 모이는 순간부터 5초 내 무조건 시작되므로 "언제 시작하냐" 궁금해할 일 없음.

**대안 (Option β — 호스트 시작 버튼):**
- 먼저 입장한 유저가 자동으로 "호스트"가 되어 시작 버튼 보유.
- 2인 이상 모이면 호스트가 "시작" 클릭 시 즉시 GAME_STARTED.
- 기존 설계(§7 `ready`, `start` 이벤트, `HOST_CHANGED` 메시지)가 그대로 유효.
- 장점: 호스트가 "지금 시작 vs 조금 더 기다림" 재량을 가짐.
- 단점: 자동 매칭 UX와 모순, 호스트가 AFK면 게임 시작 지연, 방장 이전 복잡도 유지.

**결정 요청**
- [ ] **Option α — 카운트다운 자동 시작 (5초, 방장/준비 개념 제거)** 승인 (권장)
- [ ] Option β — 호스트 시작 버튼 방식 (기존 `ready`/`start` 이벤트 유지)
- [ ] 카운트다운 시간을 5초 이외로 지정 (__초)

---

## 16. 오픈 퀘스천 (CP2+ 에서 답변 필요)

| ID | 질문 | 담당 | 답변 시점 |
|---|---|---|---|
| OQ-1 | (해소) 방 이름 금칙어 — 유저 입력 제거됨. 서버 자동 생성이므로 불필요. | — | — |
| OQ-2 | (해소) 유저당 방 생성 개수 제한 — 자동 매칭이므로 `ALREADY_IN_ROOM` 정책으로 대체. | — | — |
| OQ-3 | 방 자동 삭제 TTL (생성 후 10분 WAITING 유지 시 자동 close?) | developer-backend | CP3 |
| OQ-4 | 결과 화면 표시 시간 후 자동으로 대기 화면 복귀 (몇 초?) | designer | CP2 |
| OQ-5 | 재도전 시 `rps_room`을 재사용할지 새 row 생성할지 | developer-backend | CP3 |
| OQ-6 | Phase 2 랭킹 스키마 (승수/승률 어떻게 환산?) | planner | MVP 이후 |
| OQ-7 | (해소) 방 목록 자동 갱신 — 로비 화면 제거로 불필요. | — | — |
| OQ-8 | 모바일 UX — 터치로 카드 선택 시 햅틱/애니메이션 | designer | CP2 |
| OQ-9 | 매칭 Rate Limit 임계치 (10초 내 N회 초과 시 429) | developer-backend | CP3 |
| OQ-10 | 카운트다운 중 4인 꽉 찼을 때 즉시 시작 vs 타이머 계속 — 어느 쪽? | developer-backend | CP3 |
| OQ-11 | 매칭 시 대상 탐색 정렬 (최신순 vs 오래된순 FIFO) | developer-backend | CP3 |

---

## 17. CP1 이후 일정 (예상)

1. **CP1 승인** (현재) — 사용자 결정
2. **CP2** — designer가 `docs/design/online-rps.md` 작성 (화면/UX/상태 전이)
3. **CP3** — developer-backend가 API/WebSocket 구현 + developer-frontend 병렬 착수
4. **CP4** — 통합 테스트 + 기존 admin-rsp 제거 PR
5. **CP5** — qa-tester `docs/review/online-rps-test-plan.md` 작성 및 검증
6. **릴리스** — main 머지 + `drop-admin-rsp.sql` 사용자 실행

---

> 본 PRD는 `docs/progress/planner-online-rps.md` 와 함께 관리됨. 스펙 변경은 반드시 planner 경유.
