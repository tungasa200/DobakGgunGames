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
  "maxPlayers": 6,
  "created": false,
  "joinedAsSpectator": false
}
```

**응답 200** — 진행 중인 방에 관전자로 합류:
```json
{
  "roomId": "yachtab12",
  "status": "PLAYING",
  "playerCount": 6,
  "maxPlayers": 6,
  "created": false,
  "joinedAsSpectator": true
}
```
- `joinedAsSpectator=true`: 게임이 이미 시작되어 turnOrder에 포함되지 못함. 점수판/랭킹 미참여, 조작 불가, 종료 시까지 시청만 가능.

**응답 201** — 신규 방 생성:
```json
{
  "roomId": "yachtnew1",
  "status": "WAITING",
  "playerCount": 1,
  "maxPlayers": 6,
  "created": true,
  "joinedAsSpectator": false
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
  "maxPlayers": 6,
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
    "maxPlayers": 6,
    "participants": [
      { "userId": 101, "nickname": "유저A", "ready": true, "isHost": true, "isSpectator": false },
      { "userId": 202, "nickname": "유저B", "ready": false, "isHost": false, "isSpectator": false },
      { "userId": 303, "nickname": "유저C", "ready": false, "isHost": false, "isSpectator": true }
    ]
  }
}
```
- `isSpectator=true`: 게임 진행 중 합류한 관전자 (turnOrder에 없음). WAITING/FINISHED 상태에서는 항상 false.

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
- `rollsLeft`: 이번 굴림 후 남은 횟수.
  - **D6**: 3→2→1→0 (한 턴 최대 3회)
  - **D8**: 4→3→2→1→0 (한 턴 최대 4회)
  - 클라이언트는 첫 굴림 직전을 `rollsLeft === MAX_ROLLS_BY_MODE[diceType]`로 판정 (`rollsLeft === 3` 하드코딩 금지).

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
- GAME_OVER 직후, 활성 참가자가 2명 이상이면 서버는 방을 WAITING 상태로 리셋하고 `ROOM_STATE`(status="WAITING", 모든 참가자 isSpectator=false, ready=false)를 브로드캐스트한다. 클라이언트는 게임 종료 모달을 노출해 비방장은 `/ready`, 방장은 `/start`로 다음 게임을 시작할 수 있다. 활성 참가자 1명 이하면 기존대로 방을 FINISHED 처리한다.

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
| LITTLE_STRAIGHT | 어느 4개 연속 (1-2-3-4 / 2-3-4-5 / 3-4-5-6) → 15. 미충족→0 |
| BIG_STRAIGHT | 어느 5개 연속 (1-2-3-4-5 / 2-3-4-5-6) → 30. 미충족→0 |
| YACHT | 5개 동일 → 50. 미충족→0 |

**상단 보너스**: ONES~SIXES 합계 ≥ 63 → +35 (해당 족보 6개 모두 기록된 시점에 판정)

---

## d8 모드 분기

> 추가일: 2026-05-10. 기반 PRD: `docs/specs/yacht-d8-mode-prd.md`.
> 본 섹션은 d8 모드 도입에 따라 **변경되는 엔드포인트/DTO 필드만** 명시한다. 명시되지 않은 항목은 본문 §1~§7과 동일.

### d8.1 공통 — `diceType` 도입

- 모든 야추 방은 `"D6"` 또는 `"D8"` 중 하나의 `diceType`에 귀속된다.
- 매칭은 같은 `diceType`끼리만 이루어진다 (절대 섞이지 않음).
- 기존 d6 데이터는 `dice_type='D6'`으로 백필.

### d8.2 REST: `POST /api/yacht/match` 변경

**요청 Body 변경 (필수 필드 추가)**:
```json
{ "diceType": "D6" }
```
또는
```json
{ "diceType": "D8" }
```

- `diceType`: **필수**. `"D6"` | `"D8"`. 누락/잘못된 값 → 400 `INVALID_DICE_TYPE`.

**응답 변경 (모든 200/201에 `diceType` 추가)**:
```json
{
  "roomId": "yachtab12",
  "status": "WAITING",
  "diceType": "D8",
  "playerCount": 2,
  "maxPlayers": 6,
  "created": false,
  "joinedAsSpectator": false
}
```

**신규 에러**:
| HTTP | error 코드 | 상황 |
|---|---|---|
| 400 | `INVALID_DICE_TYPE` | `diceType` 누락 또는 `"D6"`/`"D8"` 외 |

### d8.3 REST: `GET /api/yacht/room/{roomId}` 변경

**응답 변경**:
- 최상위 필드에 `diceType` 추가.
- `scoreboard[].scores`의 키 셋이 `diceType`에 따라 다름:
  - D6: 12개 (`ONES`~`SIXES`, `CHOICE`, `FOUR_OF_A_KIND`, `FULL_HOUSE`, `LITTLE_STRAIGHT`, `BIG_STRAIGHT`, `YACHT`)
  - D8: 14개 (위 12개 + `SEVENS`, `EIGHTS`)

```json
{
  "roomId": "yachtab12",
  "status": "PLAYING",
  "diceType": "D8",
  "hostUserId": 101,
  "maxPlayers": 6,
  "currentTurnUserId": 101,
  "turnOrder": [101, 202],
  "roundIndex": 2,
  "participants": [
    { "userId": 101, "nickname": "유저A", "ready": true, "isHost": true }
  ],
  "scoreboard": [
    {
      "userId": 101,
      "scores": {
        "ONES": 3, "TWOS": null, "THREES": null, "FOURS": null,
        "FIVES": null, "SIXES": null, "SEVENS": null, "EIGHTS": null,
        "CHOICE": null, "FOUR_OF_A_KIND": null, "FULL_HOUSE": null,
        "LITTLE_STRAIGHT": null, "BIG_STRAIGHT": null, "YACHT": null
      },
      "upperTotal": 3,
      "bonusEarned": false,
      "grandTotal": 3
    }
  ]
}
```

### d8.4 REST: `GET /api/yacht/rankings` (모드별 분리 응답)

**응답 변경 — 모드별 분리 키**:
```json
{
  "D6": [
    { "rank": 1, "userId": 101, "nickname": "유저A", "winCount": 12, "totalScore": 4321, "playedCount": 30 }
  ],
  "D8": [
    { "rank": 1, "userId": 303, "nickname": "유저C", "winCount": 5, "totalScore": 2450, "playedCount": 11 }
  ]
}
```

- 정렬/필터 규칙(승수 우선 / 누적점수 / 평균 등)은 기존 야추 랭킹 정책과 동일.
- 본 변경의 핵심은 **모드별 응답 분리**.

### d8.5 STOMP: 발행 메시지

- `/app/yacht/room/{roomId}/score`의 `scoreKey` 허용 값:
  - **D6 방**: 기존 12종.
  - **D8 방**: 기존 12종 + `SEVENS`, `EIGHTS` = 총 14종.
  - D6 방에서 `SEVENS`/`EIGHTS` 전송 → `INVALID_SCORE_KEY` 에러.
- 다른 발행 메시지(`/join`, `/ready`, `/start`, `/roll`, `/leave`)의 Body는 변경 없음.

### d8.6 STOMP: 서버 → 클라 페이로드

#### ROOM_STATE — `diceType` 추가
```json
{
  "type": "ROOM_STATE",
  "timestamp": "2026-05-10T12:00:00.000Z",
  "payload": {
    "roomId": "yachtab12",
    "status": "WAITING",
    "diceType": "D8",
    "hostUserId": 101,
    "maxPlayers": 6,
    "participants": [...]
  }
}
```

#### GAME_STARTED — `diceType` 추가, `totalRounds` 계산식 변경
```json
{
  "type": "GAME_STARTED",
  "timestamp": "2026-05-10T12:01:00.000Z",
  "payload": {
    "roomId": "yachtab12",
    "diceType": "D8",
    "turnOrder": [202, 101],
    "currentTurnUserId": 202,
    "totalRounds": 28
  }
}
```
- `totalRounds` = 참가자수 × **14 (D8)** / × 12 (D6).

#### ROLL_RESULT — 형식 변경 없음
- `dice` 값 범위만 모드별 (D6: 1~6, D8: 1~8). 0은 미굴림.

#### SCORE_RECORDED — 형식 변경 없음
- `scoreKey`로 `SEVENS`/`EIGHTS`가 들어올 수 있음 (D8 한정).
- `bonusEarned` 판정 임계는 서버가 모드별로 자동 분기 (D6=63 / D8=108). 보너스 점수는 양 모드 공통 +35.

#### TURN_STATE / TURN_CHANGED / GAME_OVER / PLAYER_LEFT / ROOM_CLOSED
- 페이로드 형식 변경 없음.

### d8.7 DTO 변경 요약

```java
// 변경
record YachtMatchRequest(String diceType)  // "D6" | "D8" 필수

record YachtMatchResponse(
    String roomId,
    String status,
    String diceType,         // 신규
    int playerCount,
    int maxPlayers,
    boolean created,
    boolean joinedAsSpectator
)

record YachtRoomResponse(
    String roomId,
    String status,
    String diceType,         // 신규
    Long hostUserId,
    int maxPlayers,
    Long currentTurnUserId,
    List<Long> turnOrder,
    int roundIndex,
    List<ParticipantDto> participants,
    List<ScoreboardDto> scoreboard
)

// 페이로드 신규 필드
record YachtRoomStatePayload(
    String roomId, String status, String diceType,  // 신규
    Long hostUserId, int maxPlayers, List<ParticipantDto> participants
)

record YachtGameStartedPayload(
    String roomId, String diceType,                  // 신규
    List<Long> turnOrder, Long currentTurnUserId, int totalRounds
)

// 랭킹 응답
record YachtRankingsResponse(
    List<YachtRankingEntry> D6,
    List<YachtRankingEntry> D8
)

record YachtRankingEntry(
    int rank, Long userId, String nickname,
    int winCount, int totalScore, int playedCount
)
```

### d8.8 점수 계산 (서버 분기 — D8)

| scoreKey | D8 계산 |
|---|---|
| ONES~EIGHTS | 해당 face 총합 (1~8 모두 지원) |
| CHOICE | 5개 총합 (최대 40) |
| FOUR_OF_A_KIND | 같은 눈 4개 이상 → 그 눈×4 (5개 동일 인정 — ×4) |
| FULL_HOUSE | 정확히 [2,3] 카운트 → 5개 총합. [5]는 0 |
| LITTLE_STRAIGHT | 어느 4개 연속 — {1,2,3,4} {2,3,4,5} {3,4,5,6} {4,5,6,7} {5,6,7,8} 중 하나 포함 → 15 |
| BIG_STRAIGHT | 어느 5개 연속 — {1,2,3,4,5} {2,3,4,5,6} {3,4,5,6,7} {4,5,6,7,8} 중 하나와 일치 → 30 |
| YACHT | 5개 동일 → 50 |

**상단 보너스 (D8)**: ONES~EIGHTS 합계 ≥ **108** → +35 (8개 모두 기록 시점 판정). 임계는 D6 면 합 비례(63 × 36/21 = 108)로 설계. 보너스 점수 +35는 D6와 동일.

### d8.9 DB 마이그레이션 (재확인)

- `yacht_room.dice_type VARCHAR(4) NOT NULL DEFAULT 'D6'` — Railway 적용 **완료**.
- `yacht_record.dice_type VARCHAR(4) NOT NULL DEFAULT 'D6'` — **미적용**, developer-backend가 마이그레이션 SQL 준비 후 사용자에게 Railway 실행 요청.
- 마이그레이션 SQL 본문은 `docs/specs/yacht-d8-mode-prd.md §8.2` 참조.

---

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-04-29 | 최초 작성. CP1 확정 사항 반영 (타임아웃 없음, yacht_win 테이블, 방장+준비 방식) |
| 2026-05-10 | d8 모드 분기 섹션 추가. `diceType` 필수 필드 도입, 모드별 매칭/랭킹 분리, `SEVENS`/`EIGHTS` 추가, 상단 보너스 임계 84/35. |
| 2026-05-10 | D8 균형 재조정: 턴당 굴림 D6=3 / D8=4, 상단 보너스 임계 84→108. `rollsLeft` 의미 명시 갱신. |
