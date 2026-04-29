# API 계약 — Yacht 실시간 멀티플레이

- 작성자: developer-backend
- 작성일: 2026-04-29
- 상태: 확정 (CP1 승인 기반)
- 기반 PRD: `docs/specs/yacht-prd.md`

---

## 1. 공통 규칙

- **인증**: 모든 엔드포인트/이벤트는 로그인 유저(JWT Bearer) 전용. 비로그인 차단.
- **에러 포맷 (REST)**: `{ "error": "<ERROR_CODE>", "roomId": "(optional)" }`
- **에러 전달 (STOMP)**: `/user/queue/errors` → `{ "code": "...", "message": "..." }`
- **메시지 봉투 (서버→클라 STOMP)**:
  ```json
  { "type": "EVENT_TYPE", "timestamp": "2026-04-29T12:00:00.000Z", "payload": { ... } }
  ```

---

## 2. REST API

### POST /api/yacht/match — 자동 매칭

- **Auth**: Bearer JWT (authenticated)
- **Body**: 없음 또는 `{}`

**응답 200** — 기존 대기방 합류:
```json
{
  "roomId": "yachtab12",
  "status": "WAITING",
  "playerCount": 2,
  "maxPlayers": 4,
  "created": false
}
```

**응답 201** — 신규 방 생성:
```json
{
  "roomId": "yachtnew1",
  "status": "WAITING",
  "playerCount": 1,
  "maxPlayers": 4,
  "created": true
}
```

**에러**:
| HTTP | error 코드 | 상황 |
|---|---|---|
| 401 | UNAUTHORIZED | JWT 누락/만료 |
| 409 | ALREADY_IN_ROOM | 이미 활성 방 참가 중. body에 `roomId` 포함. |
| 429 | MATCH_RATE_LIMIT | 10초 내 5회 초과 |
| 503 | MATCH_UNAVAILABLE | Redis 락 획득 실패 |

---

### GET /api/yacht/room/{roomId} — 방 스냅샷 조회

- **Auth**: Bearer JWT

**응답 200**:
```json
{
  "roomId": "yachtab12",
  "status": "PLAYING",
  "hostUserId": 101,
  "maxPlayers": 4,
  "currentTurnUserId": 101,
  "turnOrder": [101, 202, 303],
  "roundIndex": 2,
  "participants": [
    { "userId": 101, "nickname": "유저A", "ready": true, "isHost": true },
    { "userId": 202, "nickname": "유저B", "ready": true, "isHost": false }
  ],
  "scoreboard": [
    {
      "userId": 101,
      "scores": {
        "ONES": 3,
        "TWOS": null,
        "THREES": null,
        "FOURS": null,
        "FIVES": null,
        "SIXES": null,
        "CHOICE": null,
        "FOUR_OF_A_KIND": null,
        "FULL_HOUSE": null,
        "LITTLE_STRAIGHT": null,
        "BIG_STRAIGHT": null,
        "YACHT": null
      },
      "upperTotal": 3,
      "bonusEarned": false,
      "grandTotal": 3
    }
  ]
}
```

**에러**:
| HTTP | error 코드 | 상황 |
|---|---|---|
| 401 | UNAUTHORIZED | JWT 누락/만료 |
| 403 | NOT_IN_ROOM | 해당 유저가 참가자가 아님 |
| 404 | ROOM_NOT_FOUND | roomId 없음 |

---

## 3. STOMP 이벤트

### 3.1 클라이언트 → 서버

경로 패턴: `/app/yacht/room/{roomId}/{action}`

| 액션 | Body | 설명 |
|---|---|---|
| `/join` | `{}` | WS 연결 후 자동 발행. 방-세션 바인딩. |
| `/ready` | `{ "ready": true }` | 준비/준비취소 토글 (비방장) |
| `/start` | `{}` | 게임 시작 (방장 전용, 전원 준비 시) |
| `/roll` | `{ "keptIndices": [0, 2] }` | 주사위 굴리기. 첫 굴림이면 `[]`. |
| `/score` | `{ "scoreKey": "YACHT" }` | 족보 선택. |
| `/leave` | `{}` | 방 퇴장. |

**scoreKey 허용 값 (12종)**:
`ONES`, `TWOS`, `THREES`, `FOURS`, `FIVES`, `SIXES`, `CHOICE`, `FOUR_OF_A_KIND`, `FULL_HOUSE`, `LITTLE_STRAIGHT`, `BIG_STRAIGHT`, `YACHT`

---

### 3.2 서버 → 클라이언트

구독 경로: `/topic/yacht/room/{roomId}`

#### ROOM_STATE — 참가자 입퇴장 / 준비 토글 / 방장 변경 시

```json
{
  "type": "ROOM_STATE",
  "timestamp": "2026-04-29T12:00:00.000Z",
  "payload": {
    "roomId": "yachtab12",
    "status": "WAITING",
    "hostUserId": 101,
    "maxPlayers": 4,
    "participants": [
      { "userId": 101, "nickname": "유저A", "ready": true, "isHost": true },
      { "userId": 202, "nickname": "유저B", "ready": false, "isHost": false }
    ]
  }
}
```

#### GAME_STARTED — 방장 `/start` 성공 시

```json
{
  "type": "GAME_STARTED",
  "timestamp": "2026-04-29T12:01:00.000Z",
  "payload": {
    "roomId": "yachtab12",
    "turnOrder": [202, 101],
    "currentTurnUserId": 202,
    "totalRounds": 24
  }
}
```
- `turnOrder`: 랜덤 셔플된 참가자 userId 배열 (게임 내내 고정)
- `totalRounds`: 참가자수 × 12

#### TURN_STATE — 각 턴 시작 시

```json
{
  "type": "TURN_STATE",
  "timestamp": "2026-04-29T12:01:05.000Z",
  "payload": {
    "currentTurnUserId": 202,
    "rollsLeft": 3,
    "dice": [0, 0, 0, 0, 0],
    "keptIndices": [],
    "roundIndex": 0
  }
}
```
- `dice`의 0은 "아직 미굴림"
- `roundIndex`: 0-based (0 = 첫 번째 라운드)

#### ROLL_RESULT — 굴림 결과

```json
{
  "type": "ROLL_RESULT",
  "timestamp": "2026-04-29T12:01:10.000Z",
  "payload": {
    "currentTurnUserId": 202,
    "dice": [2, 4, 4, 4, 6],
    "keptIndices": [1, 2, 3],
    "rollsLeft": 1
  }
}
```
- `dice`: 5칸 고정. kept 인덱스 값은 직전 결과와 동일.
- `rollsLeft`: 이번 굴림 후 남은 횟수 (3→2→1→0)

#### SCORE_RECORDED — 족보 선택 완료

```json
{
  "type": "SCORE_RECORDED",
  "timestamp": "2026-04-29T12:01:30.000Z",
  "payload": {
    "userId": 202,
    "scoreKey": "FOUR_OF_A_KIND",
    "score": 16,
    "upperTotal": 0,
    "bonusEarned": false,
    "grandTotal": 16
  }
}
```
- `bonusEarned=true`인 순간 `+35`가 `grandTotal`에 반영됨

#### TURN_CHANGED — 다음 플레이어 턴으로

```json
{
  "type": "TURN_CHANGED",
  "timestamp": "2026-04-29T12:01:31.000Z",
  "payload": {
    "previousTurnUserId": 202,
    "currentTurnUserId": 101,
    "roundIndex": 1
  }
}
```
- 게임 종료 조건이면 `TURN_CHANGED` 대신 `GAME_OVER` 발행

#### GAME_OVER — 게임 종료

```json
{
  "type": "GAME_OVER",
  "timestamp": "2026-04-29T12:30:00.000Z",
  "payload": {
    "roomId": "yachtab12",
    "rankings": [
      { "rank": 1, "userId": 101, "nickname": "유저A", "totalScore": 245, "isWinner": true },
      { "rank": 2, "userId": 202, "nickname": "유저B", "totalScore": 230, "isWinner": false }
    ],
    "winnerUserIds": [101]
  }
}
```
- 동점 시 같은 `rank`와 `isWinner=true` 공유

#### PLAYER_LEFT — 참가자 나감/끊김

```json
{
  "type": "PLAYER_LEFT",
  "timestamp": "2026-04-29T12:10:00.000Z",
  "payload": {
    "roomId": "yachtab12",
    "userId": 202,
    "nickname": "유저B",
    "reason": "DISCONNECT"
  }
}
```
- `reason`: `LEAVE` | `DISCONNECT`

#### ROOM_CLOSED — 방 해산

```json
{
  "type": "ROOM_CLOSED",
  "timestamp": "2026-04-29T12:11:00.000Z",
  "payload": {
    "roomId": "yachtab12",
    "reason": "EMPTY"
  }
}
```
- `reason`: `EMPTY` | `INSUFFICIENT_PLAYERS`

---

## 4. 에러 코드 목록 (`/user/queue/errors`)

| code | 상황 |
|---|---|
| `UNAUTHORIZED` | JWT 누락/만료 |
| `ROOM_NOT_FOUND` | 존재하지 않는 roomId |
| `ALREADY_IN_ROOM` | 이미 다른 활성 방 참가 중 |
| `NOT_HOST` | 방장 전용 액션을 비방장이 시도 |
| `NOT_IN_ROOM` | 미참가 유저가 액션 시도 |
| `NOT_ENOUGH_PLAYERS` | 2인 미만으로 시작 불가 |
| `NOT_ALL_READY` | 전원 준비 미완료 상태에서 시작 시도 |
| `GAME_NOT_ACTIVE` | PLAYING 아닌 상태에서 roll/score 시도 |
| `NOT_YOUR_TURN` | 다른 유저 턴에 roll/score 시도 |
| `ALREADY_ROLLED_MAX` | rollsLeft=0 상태에서 roll 시도 |
| `INVALID_KEPT_INDICES` | keptIndices가 0~4 외 / 중복 / 범위 초과 |
| `MUST_ROLL_FIRST` | 한 번도 굴리지 않고 score 시도 |
| `INVALID_SCORE_KEY` | scoreKey가 12개 enum 외 |
| `ALREADY_SCORED` | 이미 기록된 족보 재선택 |
| `ROOM_NOT_AVAILABLE` | PLAYING/FINISHED 방 join 시도 |

---

## 5. DTO 구조 상세

### YachtMatchResponse (POST /api/yacht/match 응답)
```java
record YachtMatchResponse(
    String roomId,
    String status,       // "WAITING"
    int playerCount,
    int maxPlayers,
    boolean created
)
```

### YachtRoomResponse (GET /api/yacht/room/{roomId} 응답)
```java
record YachtRoomResponse(
    String roomId,
    String status,
    Long hostUserId,
    int maxPlayers,
    Long currentTurnUserId,  // null if WAITING
    List<Long> turnOrder,    // null if WAITING
    int roundIndex,          // 0-based
    List<ParticipantDto> participants,
    List<ScoreboardDto> scoreboard
)

record ParticipantDto(Long userId, String nickname, boolean ready, boolean isHost)

record ScoreboardDto(
    Long userId,
    Map<String, Integer> scores,  // key=scoreKey, value=score or null
    int upperTotal,
    boolean bonusEarned,
    int grandTotal
)
```

### YachtRollRequest (클라 → 서버 /roll)
```java
record YachtRollRequest(List<Integer> keptIndices)
```

### YachtScoreRequest (클라 → 서버 /score)
```java
record YachtScoreRequest(String scoreKey)
```

### YachtReadyRequest (클라 → 서버 /ready)
```java
record YachtReadyRequest(boolean ready)
```

### 서버 → 클라 STOMP DTO들 (모두 `YachtEnvelopeDto`로 래핑)
- `YachtEnvelopeDto`: `{ type, timestamp, payload }`
- `YachtRoomStatePayload`: `{ roomId, status, hostUserId, maxPlayers, participants }`
- `YachtGameStartedPayload`: `{ roomId, turnOrder, currentTurnUserId, totalRounds }`
- `YachtTurnStatePayload`: `{ currentTurnUserId, rollsLeft, dice, keptIndices, roundIndex }`
- `YachtRollResultPayload`: `{ currentTurnUserId, dice, keptIndices, rollsLeft }`
- `YachtScoreRecordedPayload`: `{ userId, scoreKey, score, upperTotal, bonusEarned, grandTotal }`
- `YachtTurnChangedPayload`: `{ previousTurnUserId, currentTurnUserId, roundIndex }`
- `YachtGameOverPayload`: `{ roomId, rankings, winnerUserIds }`
- `YachtPlayerLeftPayload`: `{ roomId, userId, nickname, reason }`
- `YachtRoomClosedPayload`: `{ roomId, reason }`

---

## 6. 보안 설정

```
SecurityConfig:
  /api/yacht/**  → authenticated()

StompChannelInterceptor:
  세션 속성 키 yachtSubscribedRoomIds (chat: subscribedRoomIds, rps: rpsSubscribedRoomIds와 별도)
```

---

## 7. 점수 계산 규칙 (서버 전담)

| scoreKey | 계산 |
|---|---|
| ONES | 1눈 총합 |
| TWOS | 2눈 총합 |
| THREES | 3눈 총합 |
| FOURS | 4눈 총합 |
| FIVES | 5눈 총합 |
| SIXES | 6눈 총합 |
| CHOICE | 5개 총합 |
| FOUR_OF_A_KIND | 같은 눈 4개 이상 → 그 눈×4. 조건 미충족→0. (5개 동일도 인정 — ×4 계산) |
| FULL_HOUSE | 정확히 3개+2개 조합 → 5개 총합. 5개 동일(Yacht) → 0 |
| LITTLE_STRAIGHT | [1,2,3,4,5] → 30. 미충족→0 |
| BIG_STRAIGHT | [2,3,4,5,6] → 30. 미충족→0 |
| YACHT | 5개 동일 → 50. 미충족→0 |

**상단 보너스**: ONES~SIXES 합계 ≥ 63 → +35 (해당 족보 6개 모두 기록된 시점에 판정)

---

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-04-29 | 최초 작성. CP1 확정 사항 반영 (타임아웃 없음, yacht_win 테이블, 방장+준비 방식) |
