# PRD — Yacht (실시간 멀티플레이 야추)

- 작성자: planner
- 최초 작성일: 2026-04-29
- 수정일: **2026-04-29 — CP1 승인 완료**
- 상태: **CP1 승인 완료 (2026-04-29)** — Phase 2 착수 가능
- 승인자: 프로젝트 오너 (사용자)
- CP1 확정 내용:
  - CP1-1: **타임아웃 없음** — AFK 시 게임 정체 허용 (MVP 단순화)
  - CP1-2: **안A — 별도 `yacht_win` 테이블** (`user_id`, `win_count`) 단순 승수 카운트
  - CP1-3: **모든 참가자 준비 완료 시 방장이 시작 버튼** — 방장/준비 개념 유지, `ready`/`start` 이벤트 사용
- 관련 문서:
  - 야추 룰 원문: `docs/야추 룰.agent.md`
  - 참조 PRD (구조/WS 패턴): `docs/specs/online-rps-prd.md`
  - 참조 Design (UX 명세 패턴): `docs/design/online-rps-design.md`
  - 참조 Progress (작업 로그 패턴): `docs/progress/planner-online-rps.md`
- 관련 progress:
  - `docs/progress/planner-yacht.md` (본 PRD 작업 로그)

---

## 1. 배경 & 목표

### 배경
- DobakGgun Games는 솔로 미니게임 컬렉션을 운영해 왔으며, 2026-04-24의 `online-rps` 도입으로 실시간 멀티플레이어 인프라(STOMP/SockJS/JWT/Redis/세션 인터셉터/`SessionDisconnectEvent` 패턴)가 검증됨.
- 가위바위보 다음 멀티플레이 게임으로 **야추(Yacht)** 를 추가하여 호흡이 더 길고 전략이 개입되는 실시간 대결 콘텐츠를 제공한다.
- 야추는 5개 주사위를 굴려 12개 족보를 채우는 턴제 게임으로, RPS와 달리 (1) 턴 기반 진행, (2) 점수판 누적 관리, (3) 3D 주사위 시각화, (4) 게임당 N×12 라운드 등 새로운 요구사항을 가진다.

### 목표
- 로그인 유저 2~4명이 실시간 자동 매칭으로 야추 한 판을 처음부터 끝까지 플레이.
- 주사위 5개를 3D로 렌더링(three.js + gsap)하고, 굴림 결과는 **서버가 생성**하여 모든 참가자에게 동일한 결과를 브로드캐스트.
- **턴 기반** 플레이 — 한 시점에 한 명만 굴리고 점수를 기록하며, 모든 참가자에게 점수판이 실시간 동기화.
- 기존 채팅(`/topic/room/**`, `/app/chat/**`) 및 RPS(`/topic/rps/**`, `/app/rps/**`) 경로와 완전히 분리된 `/topic/yacht/**`, `/app/yacht/**` 네임스페이스 사용.
- 12개 족보 × N명 라운드를 모두 채우면 총합 최고점자가 승리, 결과를 DB에 저장.
- 비로그인 유저는 진입/플레이 모두 차단(SecurityConfig + 프론트 라우트 가드).

### 비목표 (Out of Scope)
- **Excel 모드 (해당 없음)** — 사용자 지시: 일반 모드만 지원.
- 친구 초대 / 비공개 방 / 비밀번호.
- AI 봇 채우기.
- 관전 모드 / 채팅 병행 / 리플레이.
- 게스트/비로그인 유저 접근.
- 재연결 시 진행 중인 게임 복귀(MVP 비목표).

---

## 2. 유저 스토리

- **US-1 (핵심)** — As a logged-in user, I want to click the "Yacht" entry and be matched automatically, so that I can start playing without navigating a lobby.
- **US-2** — As a matched player, I want to see who else has joined and a countdown to game start, so that I know when the round begins.
- **US-3** — As a player on my turn, I want to roll the dice up to 3 times and lock the dice I want to keep, so that I can build the combination I aim for.
- **US-4** — As a player on my turn, I want to preview the score I would get for each unscored category before I commit, so that I make an informed choice.
- **US-5** — As a player on my turn, I want to record my final result onto exactly one unfilled category (even as 0), so that the turn is concluded fairly.
- **US-6** — As a non-active player, I want to watch the active player's dice roll and score in real time, so that I follow the game state.
- **US-7** — As a player, I want a clear running score table for everyone (including upper bonus progress), so that I can plan my strategy.
- **US-8** — As a player, I want the game to end automatically when all scoreboards are full and to see the winner ranking, so that I know the outcome.
- **US-9** — As a player, I want my disconnection to be handled gracefully (auto-zero on missed turns, game continues for others), so that the game doesn't break.
- **US-10** — As a logged-in user, I want yacht paths to be isolated from chat and RPS, so that there is no cross-interference.
- **US-11 (보안)** — As a non-logged-in visitor, I want to be blocked from entering yacht entirely, so that only authenticated users play.

---

## 3. 모드 적용 범위 (**필수 필드**)

- **일반 모드: 필수 (Must)**
- **Excel 모드: 해당 없음 (N/A)** — 사용자 지시: "Excel 모드 없음."
- designer는 **일반 모드만** 명세 작성.
- developer-frontend는 **일반 모드만** 구현.
- qa-tester는 **일반 모드만** 검증.

---

## 4. 게임 플로우 (상세)

### 4.1 전체 플로우 다이어그램 (텍스트)

```
[홈/게임 허브] — "Yacht" 진입 버튼 (로그인 유저 한정 노출)
        ↓ 클릭 (비로그인 시 라우트 가드로 차단 → 로그인 페이지 리다이렉트)
[자동 매칭 호출] POST /api/yacht/match
        ↓ 서버 처리:
        ①  WAITING 상태 & 정원 미달 방 검색
        ②  발견 시 → 자리 예약 + roomId 반환
        ③  미발견 시 → 새 방 자동 생성(maxPlayers=4, status=WAITING) + 첫 참가자 등록 + roomId 반환
        ↓ 클라이언트 수신: { roomId, status, playerCount, maxPlayers, created }
        ↓
[WebSocket 연결 + 구독]
  /topic/yacht/room/{roomId}
        ↓
[/join 자동 발행] /app/yacht/room/{roomId}/join
        ↓
[대기 화면]
  - "플레이어 대기 중…" + 인원 / 최대 인원 표시 (예: 2/4)
  - 참가자 닉네임 리스트
  - '나가기' 버튼만 노출
  - 2인 이상 모이면 서버가 5초 카운트다운 브로드캐스트 (MATCH_COUNTDOWN, online-rps와 동일 패턴)
        ↓ 카운트다운 만료 (또는 4인 즉시 시작)
[GAME_STARTED 브로드캐스트]
  - 턴 순서 결정 (랜덤 셔플) + 첫 turn 부여
  - TURN_STATE 브로드캐스트 (currentTurnUserId, rollsLeft=3)
        ↓
[게임 라운드 — 한 명씩 순차 진행]
  현재 턴 플레이어:
    1. /roll 전송 (keptIndices=[]) → 서버가 5개 랜덤 dice 생성
    2. ROLL_RESULT 브로드캐스트 (전원에게 동일 결과)
    3. (선택) 원하는 dice 인덱스 keep + /roll 재전송 (총 3회까지)
    4. /score 전송 (선택한 scoreKey)
    5. SCORE_RECORDED 브로드캐스트 (점수판 갱신)
    6. TURN_CHANGED 브로드캐스트 → 다음 플레이어로 턴 이전
  비활성 플레이어: 점수판/주사위 시각 동기화만 수신 (입력 비활성)
        ↓ 모든 참가자가 12개 족보 모두 기록 완료
[GAME_OVER 브로드캐스트]
  - 최종 점수 / 보너스 / 총합
  - 승자(들) — 동점 시 공동 1위
  - 결과 DB 저장 (yacht_room.status=FINISHED + yacht_score 영구화)
        ↓
[결과 화면]
  - 순위표 (총합 내림차순)
  - 본인 강조
  - '나가기' 버튼 (홈 이동) — 재도전 버튼은 MVP 비목표
```

### 4.2 방 상태 (`yacht_room.status`)

| 상태 | 의미 |
|---|---|
| `WAITING` | 매칭 가능 — `POST /api/yacht/match` 응답 대상. 정원 미달 시 신규 매칭 유입 가능. |
| `PLAYING` | 게임 진행 중 — 신규 매칭 대상에서 제외. |
| `FINISHED` | 게임 종료 또는 전원 퇴장 — 매칭/접근 불가. |

### 4.3 매칭 알고리즘 (서버 — `POST /api/yacht/match`)

```
1. 동일 유저의 활성 방 중복 참여 방지 확인
   - 이미 WAITING/PLAYING 방 참가 중이면 409 ALREADY_IN_ROOM (응답에 기존 roomId 포함)
2. Redis 분산락 "yacht:match:global" 또는 DB 행 락 획득
3. 매칭 대상 탐색:
   - status=WAITING
   - currentPlayers < maxPlayers (4)
   - created_at 최신순 1건
4. 대상 있음 → 자리 예약 (currentPlayers++) → roomId 반환 (created=false)
5. 대상 없음 → 새 yacht_room INSERT (maxPlayers=4, status=WAITING, name 자동) + 첫 참가자 등록 → roomId 반환 (created=true)
6. 락 해제
```

### 4.4 한 게임의 전체 라운드 수

- 야추는 12개 족보(상단 6 + 하단 6)를 각 플레이어가 모두 채워야 종료.
- **총 라운드 = 플레이어 수 × 12**
  - 2인: 24턴
  - 3인: 36턴
  - 4인: 48턴
- 한 턴은 (최대 3회 굴림 + 1회 점수 기록)으로 구성.

### 4.5 턴 순서 결정

- `GAME_STARTED` 시점에 서버가 참가자 userId 배열을 **랜덤 셔플**해 turn order 확정.
- 그 후 항상 같은 순서로 round-robin (1라운드: A→B→C→D, 2라운드: A→B→C→D, … 12라운드까지).
- turn order는 `GAME_STARTED.payload.turnOrder` 필드로 전 참가자에게 공개.

### 4.6 보너스 판정 시점

- 상단 6개 족보(Ones~Sixes)가 **모두 기록된 시점**에 합계 검사.
- 합계 ≥ 63 → **bonus = 35점** 부여. `SCORE_RECORDED.payload.bonusEarned=true`로 알림.
- 6개 미만 기록 상태에서는 bonus 미확정 (현재 합계만 미리보기로 노출).

---

## 5. 게임 규칙 (야추 룰 원문 기반)

> 출처: `docs/야추 룰.agent.md`. 사용자 확정 사양.

### 5.1 기본 규칙
- 플레이어: **최소 2인, 최대 4인**.
- 주사위: **5개**. 1~6 균등 분포.
- 한 턴에 **최대 3번 굴림**. 1번째는 5개 모두 굴림. 2/3번째는 keep하지 않은 주사위만 다시 굴림.
- 굴림 도중 keep할 주사위 인덱스를 자유롭게 선택/해제 가능 (단, **굴리는 시점에만 keep 적용**).
- 3번 다 굴리지 않고 중간에 점수 기록 가능.
- 굴림 종료 후 **반드시 1개 빈 족보를 선택해 기록** — 조건 미달 항목 선택 시 0점 강제.

### 5.2 족보 (상단 — Upper Section)
| 키 | 이름 | 점수 | 최대값 |
|---|---|---|---|
| `ONES` | Ones | 1 눈 총합 | 5 |
| `TWOS` | Twos | 2 눈 총합 | 10 |
| `THREES` | Threes | 3 눈 총합 | 15 |
| `FOURS` | Fours | 4 눈 총합 | 20 |
| `FIVES` | Fives | 5 눈 총합 | 25 |
| `SIXES` | Sixes | 6 눈 총합 | 30 |

- **상단 보너스**: 상단 6개 합계 ≥ 63점 시 **+35점**.

### 5.3 족보 (하단 — Lower Section)
| 키 | 이름 | 조건 | 점수 | 최대값 |
|---|---|---|---|---|
| `CHOICE` | Choice | 무조건 | 5개 총합 | 30 |
| `FOUR_OF_A_KIND` | Four of a Kind | 같은 눈 4개 이상 | 같은 눈 4개의 합 | 24 |
| `FULL_HOUSE` | Full House | 3개+2개 조합 | 5개 총합 | 28 |
| `LITTLE_STRAIGHT` | Little Straight | 1-2-3-4-5 | 30 (고정) | 30 |
| `BIG_STRAIGHT` | Big Straight | 2-3-4-5-6 | 30 (고정) | 30 |
| `YACHT` | Yacht | 5개 동일 | 50 (고정) | 50 |

- **Yacht 처리 (Full House / Four of a Kind와 충돌 방지)**:
  - 5개 동일(예: ⚄⚄⚄⚄⚄)일 때 **Full House 인정 안 함** (조건 미달 → 0점).
  - 5개 동일일 때 **Four of a Kind는 인정** (4개의 합으로 계산, 예: 5×4=20).
  - 5개 동일은 본래 의도된 `YACHT`로 기록 시 50점.

### 5.4 점수 기록 강제 규칙
- 한 턴 종료 시 **반드시** 빈 족보 하나에 점수를 기록해야 함 (12개 모두 채워질 때까지).
- 조건 미달 항목 선택 시 **0점 기록**.
- 이미 기록된 항목은 다시 선택 불가 (서버 검증 — `SCORE_KEY_ALREADY_USED` 에러).

### 5.5 게임 종료 & 승자 판정
- 모든 참가자가 12개 족보를 전부 기록하면 종료 (총 라운드 = 참가자 수 × 12).
- **승자 = 총합(상단 + 보너스 + 하단) 최고점자**.
- 동점 시 **공동 1위 (Tie)** — 승리 수 카운트도 동일하게 부여.

### 5.6 점수 계산 의사 코드 (서버 권장 구현 — developer-backend 참고)

```
fun calculateScore(scoreKey: String, dice: Int[5]): Int {
  return when (scoreKey) {
    "ONES" -> dice.filter { it==1 }.sum()
    "TWOS" -> dice.filter { it==2 }.sum()
    "THREES" -> dice.filter { it==3 }.sum()
    "FOURS" -> dice.filter { it==4 }.sum()
    "FIVES" -> dice.filter { it==5 }.sum()
    "SIXES" -> dice.filter { it==6 }.sum()
    "CHOICE" -> dice.sum()
    "FOUR_OF_A_KIND" -> {
      val counts = dice.groupingBy { it }.eachCount()
      val face = counts.entries.firstOrNull { it.value >= 4 }?.key
      if (face != null) face * 4 else 0
    }
    "FULL_HOUSE" -> {
      val counts = dice.groupingBy { it }.eachCount().values.sorted()
      // [2,3] 정확히. [5]는 인정 안 함.
      if (counts == listOf(2,3)) dice.sum() else 0
    }
    "LITTLE_STRAIGHT" -> {
      if (dice.toSortedSet() == sortedSetOf(1,2,3,4,5)) 30 else 0
    }
    "BIG_STRAIGHT" -> {
      if (dice.toSortedSet() == sortedSetOf(2,3,4,5,6)) 30 else 0
    }
    "YACHT" -> if (dice.toSet().size == 1) 50 else 0
    else -> throw INVALID_SCORE_KEY
  }
}
```

---

## 6. WebSocket 이벤트 명세 (전체 상세)

### 6.1 경로 체계

> 기존 채팅(`/topic/room/**`, `/app/chat/**`)과 RPS(`/topic/rps/**`, `/app/rps/**`)와 **완전히 격리된** `/yacht` 네임스페이스 사용.

| 용도 | 경로 | 방향 | 비고 |
|---|---|---|---|
| Endpoint | `/ws` (SockJS, JWT) | 기존과 공유 | `JwtHandshakeInterceptor` 재사용 |
| 구독 — 방 이벤트 | `/topic/yacht/room/{roomId}` | 서버 → 모든 참가자 | — |
| 발행 — 방 입장 | `/app/yacht/room/{roomId}/join` | 클라이언트 → 서버 | `POST /api/yacht/match` 응답 후 자동 발행 |
| 발행 — 주사위 굴림 | `/app/yacht/room/{roomId}/roll` | 클라이언트 → 서버 | `keptIndices: int[]` 포함 |
| 발행 — 점수 기록 | `/app/yacht/room/{roomId}/score` | 클라이언트 → 서버 | `scoreKey: string` 포함 |
| 발행 — 방 퇴장 | `/app/yacht/room/{roomId}/leave` | 클라이언트 → 서버 | — |
| 구독 — 개인 에러 | `/user/queue/errors` | 서버 → 본인 | 기존 채팅/RPS와 공유 (코드로 구분) |

> 기존 STOMP 경로(`/topic/room/**`, `/app/chat/**`, `/topic/rps/**`, `/app/rps/**`)는 **건드리지 않음**.

### 6.2 메시지 envelope (서버 → 클라이언트)

```json
{
  "type": "<EVENT_TYPE>",
  "timestamp": "2026-04-29T12:34:56.789Z",
  "payload": { ... }
}
```

### 6.3 서버 → 클라이언트 메시지 타입 (`/topic/yacht/room/{roomId}`)

#### 6.3.1 `ROOM_STATE` — 방 상태 업데이트
대기 중 입/퇴장 시 브로드캐스트.
```json
{
  "type": "ROOM_STATE",
  "timestamp": "2026-04-29T12:00:00.000Z",
  "payload": {
    "roomId": "yacht1ab",
    "status": "WAITING",
    "maxPlayers": 4,
    "participants": [
      { "userId": 101, "nickname": "유저A" },
      { "userId": 202, "nickname": "유저B" }
    ]
  }
}
```

#### 6.3.2 `MATCH_COUNTDOWN` / `MATCH_COUNTDOWN_CANCELLED`
2인 이상 모이면 5초 카운트다운 브로드캐스트 (online-rps `MATCH_COUNTDOWN` 패턴 동일 — CP1-3에서 확정).
```json
{
  "type": "MATCH_COUNTDOWN",
  "timestamp": "2026-04-29T12:00:50.000Z",
  "payload": {
    "roomId": "yacht1ab",
    "secondsRemaining": 5,
    "startAt": "2026-04-29T12:00:55.000Z"
  }
}
```
인원이 2명 미만으로 떨어지면 `MATCH_COUNTDOWN_CANCELLED`.

#### 6.3.3 `GAME_STARTED` — 게임 시작
```json
{
  "type": "GAME_STARTED",
  "timestamp": "2026-04-29T12:01:00.000Z",
  "payload": {
    "roomId": "yacht1ab",
    "turnOrder": [101, 202, 303],
    "currentTurnUserId": 101,
    "rollsLeft": 3,
    "totalRounds": 36
  }
}
```

#### 6.3.4 `TURN_STATE` — 턴 상태 (각 턴 시작 시점)
```json
{
  "type": "TURN_STATE",
  "timestamp": "2026-04-29T12:01:05.000Z",
  "payload": {
    "roomId": "yacht1ab",
    "currentTurnUserId": 101,
    "rollsLeft": 3,
    "dice": [0,0,0,0,0],
    "keptIndices": [],
    "turnDeadlineAt": "2026-04-29T12:01:35.000Z"
  }
}
```
- `dice` 배열의 0은 "아직 미굴림" 의미 (클라이언트 시각 처리).
- `turnDeadlineAt`은 CP1-1 결정값(추천 30초)에 따라 서버가 산출.

#### 6.3.5 `ROLL_RESULT` — 굴림 결과
```json
{
  "type": "ROLL_RESULT",
  "timestamp": "2026-04-29T12:01:10.000Z",
  "payload": {
    "dice": [3, 5, 2, 5, 6],
    "keptIndices": [1, 3],
    "rollsLeft": 2,
    "currentTurnUserId": 101
  }
}
```
- `dice`는 5칸 고정. keep된 인덱스의 값은 직전 결과와 동일.
- `rollsLeft`는 이번 굴림 직후 남은 굴림 수 (3→2→1→0).

#### 6.3.6 `SCORE_RECORDED` — 점수 기록 결과
```json
{
  "type": "SCORE_RECORDED",
  "timestamp": "2026-04-29T12:01:30.000Z",
  "payload": {
    "userId": 101,
    "scoreKey": "FOURS",
    "score": 12,
    "upperTotal": 27,
    "bonusEarned": false,
    "grandTotal": 42
  }
}
```
- `bonusEarned=true`인 순간에 `+35` 보너스가 `grandTotal`에 반영됨.
- `upperTotal`은 상단 6개 부분합 (보너스 미포함).

#### 6.3.7 `TURN_CHANGED` — 턴 이전
```json
{
  "type": "TURN_CHANGED",
  "timestamp": "2026-04-29T12:01:31.000Z",
  "payload": {
    "previousTurnUserId": 101,
    "currentTurnUserId": 202,
    "rollsLeft": 3,
    "roundNum": 1
  }
}
```
- 모든 참가자의 12개 족보가 채워졌으면 `TURN_CHANGED` 대신 `GAME_OVER` 발행.

#### 6.3.8 `GAME_OVER` — 게임 종료
```json
{
  "type": "GAME_OVER",
  "timestamp": "2026-04-29T12:30:00.000Z",
  "payload": {
    "roomId": "yacht1ab",
    "rankings": [
      { "userId": 101, "nickname": "유저A", "grandTotal": 245, "rank": 1, "isWinner": true },
      { "userId": 202, "nickname": "유저B", "grandTotal": 230, "rank": 2, "isWinner": false },
      { "userId": 303, "nickname": "유저C", "grandTotal": 230, "rank": 2, "isWinner": false }
    ]
  }
}
```
- 동점 시 같은 `rank` 부여, 둘 다 `isWinner=true`로 마킹 (공동 1위).
- 서버는 `GAME_OVER` 직후 `yacht_room.status=FINISHED` 업데이트.

#### 6.3.9 `PLAYER_LEFT`
```json
{
  "type": "PLAYER_LEFT",
  "timestamp": "2026-04-29T12:10:00.000Z",
  "payload": {
    "roomId": "yacht1ab",
    "userId": 202,
    "nickname": "유저B",
    "reason": "DISCONNECT"
  }
}
```
- `reason` enum: `LEAVE` / `DISCONNECT`.

#### 6.3.10 `ROOM_CLOSED`
```json
{
  "type": "ROOM_CLOSED",
  "timestamp": "2026-04-29T12:11:00.000Z",
  "payload": {
    "roomId": "yacht1ab",
    "reason": "EMPTY"
  }
}
```
- `reason` enum: `EMPTY` (전원 퇴장), `INSUFFICIENT_PLAYERS` (PLAYING 중 잔존 1명 미만).

### 6.4 클라이언트 → 서버 메시지

#### 6.4.1 `/app/yacht/room/{roomId}/join`
Body: `{}`

서버 처리:
1. JWT Principal 검증 (없으면 `UNAUTHORIZED`).
2. 방 존재 + WAITING 상태 + slot 예약 일치 확인.
3. 세션 속성 `yachtSubscribedRoomIds`에 roomId 추가.
4. `ROOM_STATE` 브로드캐스트.
5. 참가자 ≥ 2 시 `MATCH_COUNTDOWN` 타이머 시작/유지.

#### 6.4.2 `/app/yacht/room/{roomId}/roll`
```json
{ "keptIndices": [0, 2] }
```
- `keptIndices`는 0~4 사이 정수 배열. 빈 배열 허용 (전부 다시 굴림 = 첫 굴림).

서버 처리:
1. 방 PLAYING 확인.
2. Principal == `currentTurnUserId` 확인 (아니면 `NOT_YOUR_TURN`).
3. `rollsLeft > 0` 확인 (아니면 `NO_ROLLS_LEFT`).
4. `keptIndices` 검증 (0~4 범위, 중복 없음, 첫 굴림에는 [] 강제).
5. **서버가** keep 안 된 인덱스에 대해 1~6 랜덤 생성 (Java `SecureRandom` 또는 동등 권장).
6. 내부 상태 갱신: `dice`, `rollsLeft--`, `keptIndices`.
7. `ROLL_RESULT` 브로드캐스트.

#### 6.4.3 `/app/yacht/room/{roomId}/score`
```json
{ "scoreKey": "FULL_HOUSE" }
```

서버 처리:
1. 방 PLAYING + Principal == currentTurnUserId 확인.
2. **최소 1회는 굴렸는지** 확인 (첫 turn에서 굴림 없이 score만 보내면 `MUST_ROLL_FIRST`).
3. `scoreKey`가 12개 enum 중 하나인지 + 본인이 아직 사용하지 않았는지 확인 (`SCORE_KEY_ALREADY_USED`).
4. §5.6 의사 코드대로 점수 산출 (조건 미달이면 0점).
5. `yacht_score` insert/update + `upperTotal` 재계산 + 보너스 발생 시 35점 추가.
6. `SCORE_RECORDED` 브로드캐스트.
7. 다음 턴 결정:
   - 본인 다음 turnOrder 인덱스의 유저로 이전 + `rollsLeft=3` 리셋 + `dice=[0,0,0,0,0]` 리셋.
   - 한 라운드(전원 1턴씩) 끝나면 다음 라운드로.
   - 모든 참가자가 12개 score 채웠으면 `GAME_OVER` 브로드캐스트 (TURN_CHANGED 미발행).
8. `TURN_CHANGED` 브로드캐스트 (게임 미종료 시).

#### 6.4.4 `/app/yacht/room/{roomId}/leave`
Body: `{}`

서버 처리:
1. 참가자 목록에서 제거.
2. 게임 상태별 처리 (§7 참조).

### 6.5 에러 코드 (`/user/queue/errors`)

| code | 상황 |
|---|---|
| `UNAUTHORIZED` | JWT 누락/만료 |
| `ROOM_NOT_FOUND` | 존재하지 않는 roomId |
| `ROOM_NOT_AVAILABLE` | PLAYING/FINISHED 방 입장 시도 |
| `ROOM_FULL` | 정원 초과 |
| `NOT_IN_ROOM` | 미참가 유저가 액션 시도 |
| `NOT_YOUR_TURN` | 다른 유저 턴에 roll/score 시도 |
| `NO_ROLLS_LEFT` | rollsLeft=0 상태에서 roll 시도 |
| `INVALID_KEPT_INDICES` | keptIndices가 0~4 외 / 중복 |
| `MUST_ROLL_FIRST` | 한 번도 굴리지 않고 score 시도 |
| `INVALID_SCORE_KEY` | scoreKey가 enum 외 |
| `SCORE_KEY_ALREADY_USED` | 이미 기록된 족보 재선택 |
| `GAME_NOT_ACTIVE` | PLAYING 아닌 상태에서 roll/score 시도 |
| `ALREADY_IN_ROOM` | (REST 응답) 이미 활성 방 참가 중 |

---

## 7. 연결 끊김 처리 정책

### 7.1 감지 방법
- Spring `SessionDisconnectEvent` 리스너로 감지 (online-rps `SessionDisconnectEvent` 패턴 재사용).
- 세션 속성에 `yachtSubscribedRoomIds: Set<String>` 저장 (chat/RPS 키와 별도).

### 7.2 대기방(WAITING) 중 끊김
| 상황 | 처리 |
|---|---|
| 일반 끊김 | 참가자 목록 제거 + `PLAYER_LEFT` + `ROOM_STATE` 갱신 |
| 카운트다운 중 인원 1명으로 감소 | `MATCH_COUNTDOWN_CANCELLED` 브로드캐스트 |
| 전원 퇴장 | `ROOM_CLOSED(EMPTY)` + DB soft-close |

### 7.3 게임(PLAYING) 중 끊김 — **야추 특화 처리**

| 상황 | 처리 |
|---|---|
| 비활성 플레이어 끊김, 잔존 ≥ 2 | **남은 미기록 족보 전체에 0점 자동 기록** (게임 진행에 영향 안 주도록) + `PLAYER_LEFT` + `ROOM_STATE`/필요 시 `SCORE_RECORDED` 갱신. 끊긴 유저는 그대로 점수판에 남되 모든 잔여 족보 0. 게임 종료 조건은 정상 충족 가능. |
| 현재 turn 플레이어 끊김 | **즉시 모든 미기록 족보 0점 자동 기록** + `TURN_CHANGED`로 다음 플레이어로 즉시 이전 + (필요 시) GAME_OVER 트리거. |
| 잔존 1명 | 남은 1명 단독으로 게임을 종료시키지 않고 **`ROOM_CLOSED(reason=INSUFFICIENT_PLAYERS)`** 브로드캐스트 후 방 FINISHED 처리. 단독 승리 인정 여부는 OQ-3에서 결정. |
| 전원 끊김 | `ROOM_CLOSED(EMPTY)` + DB soft-close |

### 7.4 재연결 (MVP 비목표)
- 진행 중인 게임 복귀 미지원. 재연결 시 새 세션 = 새 매칭 필요.

---

## 8. REST API 계약

### 공통
- Auth: **Authenticated** (JWT Bearer). USER/FRIEND/ADMIN 모두.
- SecurityConfig: `/api/yacht/**`, `/app/yacht/**`, `/topic/yacht/**` → `authenticated()` (비로그인 차단 명시).
- 에러 포맷: `{ "error": "<ERROR_CODE>" }`.

### 8.1 `POST /api/yacht/match` — 자동 매칭 진입점

**요청**
- Method: `POST`
- Path: `/api/yacht/match`
- Headers: `Authorization: Bearer <JWT>`
- Body: 없음 또는 `{}`

**응답 200 — 기존 대기방 매칭됨**
```json
{
  "roomId": "yacht1ab",
  "status": "WAITING",
  "playerCount": 2,
  "maxPlayers": 4,
  "created": false
}
```

**응답 201 — 신규 방 자동 생성됨**
```json
{
  "roomId": "yachtnew",
  "status": "WAITING",
  "playerCount": 1,
  "maxPlayers": 4,
  "created": true
}
```

**에러**
| HTTP | 코드 | 상황 |
|---|---|---|
| 401 | `UNAUTHORIZED` | JWT 누락/만료 |
| 409 | `ALREADY_IN_ROOM` | 이미 활성 방 참가 중. body에 `roomId` 포함. |
| 429 | `MATCH_RATE_LIMIT` | 짧은 시간 내 반복 매칭 요청 (임계치 OQ-4) |
| 503 | `MATCH_UNAVAILABLE` | Redis/DB 락 획득 실패 |

### 8.2 `GET /api/yacht/room/{roomId}` — 방 스냅샷 조회

**용도**: 클라이언트 새로고침/재진입 시 STOMP 연결 전 현재 상태 확인 (옵션).

**응답 200**
```json
{
  "roomId": "yacht1ab",
  "status": "PLAYING",
  "maxPlayers": 4,
  "participants": [
    { "userId": 101, "nickname": "유저A" },
    { "userId": 202, "nickname": "유저B" }
  ],
  "currentTurnUserId": 101,
  "scoreboard": [
    { "userId": 101, "scores": { "ONES": 3, "TWOS": null, ... }, "upperTotal": 3, "grandTotal": 3 }
  ]
}
```

**에러**
- 401 `UNAUTHORIZED`
- 403 `NOT_IN_ROOM` (해당 유저가 참가자가 아님)
- 404 `ROOM_NOT_FOUND`

---

## 9. DB 스키마 초안 (`ddl-auto=update` 기반)

### 9.1 `yacht_room`

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `id` | BIGINT | PK, AUTO_INCREMENT | 내부 ID |
| `room_id` | VARCHAR(8) | UNIQUE, NOT NULL | 외부 노출 roomId (영소문자+숫자) |
| `status` | VARCHAR(16) | NOT NULL | `WAITING` / `PLAYING` / `FINISHED` |
| `max_players` | INT | NOT NULL | 4 (고정 초기값, 향후 조정 여지) |
| `created_at` | DATETIME(3) | NOT NULL | 생성 시각 UTC |
| `started_at` | DATETIME(3) | NULL | PLAYING 진입 시각 |
| `closed_at` | DATETIME(3) | NULL | FINISHED 시각 |
| `winner_user_ids` | VARCHAR(255) | NULL | GAME_OVER 시 승자 user_id CSV (공동 1위 대비) |

- 인덱스: `(status, created_at DESC)` — 매칭 조회 최적화.

### 9.2 `yacht_participant`

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `id` | BIGINT | PK, AUTO_INCREMENT | |
| `room_id` | BIGINT | FK → yacht_room(id), NOT NULL | |
| `user_id` | BIGINT | FK → user(id), NOT NULL | |
| `turn_order` | INT | NULL | 0~3, GAME_STARTED 시점에 채워짐 |
| `joined_at` | DATETIME(3) | NOT NULL | |
| `left_at` | DATETIME(3) | NULL | |
| `final_grand_total` | INT | NULL | GAME_OVER 시 채워짐 |
| `is_winner` | BOOLEAN | NULL | GAME_OVER 시 채워짐 |

- UNIQUE: `(room_id, user_id)`.
- 인덱스: `(user_id)`.

### 9.3 `yacht_score`

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `id` | BIGINT | PK, AUTO_INCREMENT | |
| `room_id` | BIGINT | FK → yacht_room(id), NOT NULL | |
| `user_id` | BIGINT | FK → user(id), NOT NULL | |
| `score_key` | VARCHAR(20) | NOT NULL | enum 12종 |
| `score_value` | INT | NOT NULL | 0~50 |
| `recorded_at` | DATETIME(3) | NOT NULL | |

- UNIQUE: `(room_id, user_id, score_key)`.
- 인덱스: `(room_id, user_id)`.

### 9.4 진행 중 상태 저장
- 현재 dice / rollsLeft / keptIndices / 턴 진행 상태는 **Redis 또는 서버 메모리** (`ConcurrentHashMap`)에 저장.
- DB는 확정된 점수(`yacht_score`)만 보관.
- 구체 저장 방식은 developer-backend가 CP3에서 결정 (Redis 권장 — multi-instance 대비).

### 9.5 랭킹 연동 (CP1-2 결정 사항)
- CP1-2 결과에 따라 다음 중 하나가 추가됨:
  - 안A: 신규 `yacht_win` 테이블 (`user_id` PK, `win_count` INT)
  - 안B: 기존 `RankingService` 확장
  - 안C: 추가 테이블 없이 `yacht_participant.is_winner=true` 카운트로 집계

---

## 10. 엣지 케이스 & 에러 시나리오

| ID | 상황 | 처리 |
|---|---|---|
| EC-1 | 비로그인 유저가 `/api/yacht/match` 호출 | 401 + 라우트 가드로 로그인 페이지 리다이렉트 |
| EC-2 | 비로그인 유저가 STOMP `/topic/yacht/**` 구독 시도 | `JwtHandshakeInterceptor`에서 차단 + 연결 거절 |
| EC-3 | 정원 4명 도달 후 5번째 유저 매칭 시도 | 다른 WAITING 방 탐색 또는 신규 생성 (정상 매칭 흐름) |
| EC-4 | `PLAYING` 방 재진입 시도 (URL 직접) | 401/403 + 홈 리다이렉트 |
| EC-5 | 다른 유저 턴에 roll 시도 | `NOT_YOUR_TURN` 에러 |
| EC-6 | rollsLeft=0인데 roll 시도 | `NO_ROLLS_LEFT` 에러 |
| EC-7 | 한 번도 굴리지 않고 score 시도 | `MUST_ROLL_FIRST` 에러 |
| EC-8 | 이미 기록된 score_key 재선택 | `SCORE_KEY_ALREADY_USED` 에러 |
| EC-9 | `keptIndices`에 -1, 5, 중복 등 | `INVALID_KEPT_INDICES` 에러 |
| EC-10 | scoreKey가 enum 외 (`"LARGE_STRAIGHT"` 등 오타) | `INVALID_SCORE_KEY` 에러 |
| EC-11 | 턴 타임아웃 (CP1-1 결정값 경과) | 추천안 채택 시: 서버가 미기록 족보 중 가장 점수가 낮은 (또는 우선순위 규칙) 항목에 0점 자동 기록 + TURN_CHANGED |
| EC-12 | 게임 중 현재 turn 플레이어 끊김 | 모든 미기록 족보 0점 자동 + TURN_CHANGED |
| EC-13 | 게임 중 비활성 플레이어 끊김 | 잔존 인원으로 게임 계속, 끊긴 유저는 0점 자동 채움 |
| EC-14 | 게임 중 잔존 1명만 남음 | `ROOM_CLOSED(INSUFFICIENT_PLAYERS)` 후 FINISHED |
| EC-15 | 카운트다운 중 인원이 1명으로 감소 | `MATCH_COUNTDOWN_CANCELLED` |
| EC-16 | 이미 활성 방 참가 중인 유저가 매칭 재호출 | 409 `ALREADY_IN_ROOM` + 기존 roomId 응답 |
| EC-17 | `dice` 클라이언트 조작 시도 (개발자 도구로 위조 메시지 발송) | 서버 측에서 `dice`는 받지 않고 무조건 새로 생성하므로 무효 |
| EC-18 | 동시 굴림 race (동일 turnUserId가 짧은 간격 두 번 roll 발행) | 서버 동시성 락으로 첫 요청만 처리, 둘째는 `NO_ROLLS_LEFT` 또는 무시 |
| EC-19 | 게임 종료 직후 `/leave` 발행 | 정상 처리, 점수 이미 영구화돼 영향 없음 |
| EC-20 | 빈 방이 TTL 경과 (아무도 join 안 함) | TTL 정책 OQ-1 — 디폴트 10분 후 자동 close 권장 |

---

## 11. 보안 / 인프라 요구사항

### 11.1 비로그인 차단 (Must)
- `SecurityConfig`에 다음 규칙 추가:
  ```
  /api/yacht/**   → authenticated()
  /app/yacht/**   → authenticated() (StompChannelInterceptor 검증)
  /topic/yacht/** → authenticated() (StompChannelInterceptor 검증)
  ```
- 프론트 라우트 가드: `/yacht`, `/yacht/play/{roomId}` 모두 비로그인 시 로그인 페이지 리다이렉트.
- 직접 URL 진입 시도도 차단.

### 11.2 STOMP 네임스페이스 격리
- 기존 `/topic/room/**` (chat), `/topic/rps/**` (RPS), 신규 `/topic/yacht/**` 완전 분리.
- `StompChannelInterceptor`에서 경로별 권한/존재 검증 분기.
- 세션 속성 키: `subscribedRoomIds` (chat), `rpsSubscribedRoomIds` (RPS), `yachtSubscribedRoomIds` (신규) — **충돌 금지**.

### 11.3 서버 주체 주사위 생성
- 클라이언트가 보내는 `roll` 메시지에 `dice` 필드 받지 않음 — 무조건 서버가 1~6 균등 분포로 생성.
- `SecureRandom` 또는 동등 권장.
- 클라 조작 방지를 위해 `keptIndices`만 신뢰.

### 11.4 3D 렌더링 의존성
- 프론트엔드: `three.js` + `gsap` (사용자 확정).
- 주사위 모델: BoxGeometry 6면체 + 1~6 텍스처.
- 굴림 애니메이션: gsap timeline (회전 + 떨어짐 + 정지).
- 모든 유저가 같은 `dice` 결과로 동일한 애니메이션 재생 (시각적 차이 허용, 결과는 일치).

---

## 12. 게임 밸런스 / 점수 정책

| 항목 | 값 | 근거 |
|---|---|---|
| 주사위 개수 | 5 | 야추 표준 룰 |
| 한 턴 굴림 횟수 | 최대 3 | 야추 표준 룰 |
| 족보 수 | 12 | 야추 표준 룰 |
| 상단 보너스 임계 | 63점 | 야추 표준 룰 |
| 상단 보너스 점수 | +35 | 야추 표준 룰 |
| Yacht 점수 | 50 (고정) | 야추 표준 룰 |
| Little/Big Straight 점수 | 30 (고정) | 야추 표준 룰 |
| Full House 점수 | 5개 총합 (Yacht 불인정) | 야추 표준 룰 |
| Four of a Kind 점수 | 같은 눈 4개 합 (Yacht 인정 — 4개 분량) | 야추 표준 룰 |
| 게임 시작 카운트다운 | **5초** (CP1-3 추천) | online-rps와 일관성 |
| 턴 타임아웃 | **30초** (CP1-1 추천) | OQ — 사용자 결정 |
| 턴 타임아웃 시 처리 | **최저점 항목 자동 0점 기록** (CP1-1 추천) | OQ — 사용자 결정 |
| 정원 | 2~4명 | 사용자 확정 |

---

## 13. 성공 지표

### MVP 완료 기준
- [ ] 로그인 유저 2~4명이 동시에 한 게임 끝까지 완주 가능 (`GAME_OVER` 정상 도달)
- [ ] 12개 족보 점수 계산이 §5.6 의사 코드와 100% 일치 (특히 Full House에서 Yacht 불인정, Four of a Kind에서 Yacht 인정)
- [ ] 3D 주사위가 모든 참가자에게 동일한 결과로 표시
- [ ] 비로그인 유저가 `/yacht`, `/api/yacht/**`, `/topic/yacht/**` 모두 접근 차단
- [ ] 게임 결과(`yacht_room`, `yacht_participant`, `yacht_score`)가 DB에 정상 저장
- [ ] 기존 채팅(`/topic/room/**`)/RPS(`/topic/rps/**`) 회귀 테스트 통과
- [ ] 연결 끊김 시 잔존 유저 게임 진행에 영향 없음 (끊긴 유저 자동 0점)

### 관찰 지표 (Phase 2 준비용)
- 일일 매칭 수, 게임 완주율
- 평균 게임 시간 (GAME_STARTED → GAME_OVER)
- 턴 타임아웃 발생 비율 (30초 적정성 검증)
- 동점 발생 빈도 (공동 1위 정책 검증)
- 연결 끊김 발생 빈도 / 그로 인한 자동 0점 빈도

---

## 14. 오픈 퀘스천

| ID | 질문 | 담당 | 답변 시점 |
|---|---|---|---|
| OQ-1 | 빈 방 TTL (생성 후 N분 WAITING 유지 시 자동 close?) | developer-backend | CP3 |
| OQ-2 | `score_key` 미선택 자동 기록 시 우선순위 (최저 기대값? 미사용 첫 항목? CHOICE?) | planner ↔ developer-backend | CP1-1 결정 후 CP3에서 구체화 |
| OQ-3 | 게임 중 잔존 1명 시 단독 승리 인정 여부 (현재 INSUFFICIENT_PLAYERS로 무승부 처리 권장) | planner | CP1 결정 후 |
| OQ-4 | 매칭 Rate Limit 임계치 (10초 내 N회 초과 시 429) | developer-backend | CP3 |
| OQ-5 | 4인 꽉 찬 즉시 카운트다운 만료 vs 계속 5초 대기 | developer-backend | CP3 |
| OQ-6 | 매칭 정렬 (최신순 vs FIFO) | developer-backend | CP3 |
| OQ-7 | 결과 화면 표시 시간 후 자동 홈 복귀 (몇 초?) | designer | CP2 |
| OQ-8 | 점수 미리보기 UI (호버? 항상 표시?) — 모바일 동작 | designer | CP2 |
| OQ-9 | 3D 주사위 모바일 성능 — 저사양 기기 fallback (2D)? | designer ↔ developer-frontend | CP2/CP3 |
| OQ-10 | Phase 2 랭킹 스키마 구체화 (CP1-2가 안C로 결정된 경우) | planner | MVP 이후 |

---

## 15. CP1 이후 일정 (예상)

1. **CP1 승인** (현재) — 사용자 결정 (3건)
2. **CP2** — designer가 `docs/design/yacht-design.md` 작성
   - 화면: 매칭/대기/게임/결과 (4종)
   - 3D 주사위 시각화 가이드 (조명, 카메라, 굴림 애니메이션 타임라인)
   - 점수판 UI (실시간 동기화 + 미리보기)
   - 모바일 반응형 명세
3. **CP3** — developer-backend + developer-frontend 병렬 착수
   - 백엔드: 엔티티 3종(`yacht_room`/`yacht_participant`/`yacht_score`) + Repository + `YachtController` + `YachtStompController` + `YachtMatchService` + `YachtGameService` + 카운트다운/턴 타임아웃 스케줄러 + 점수 계산 유틸
   - 프론트: `pages/YachtPage.tsx` + `pages/YachtRoomPage.tsx` + `games/yacht/` 컴포넌트 + `lib/yachtStompClient.ts` + `three.js` 3D 주사위 컴포넌트 + 점수판 컴포넌트
4. **CP4** — 통합 테스트
5. **CP5** — qa-tester `docs/review/yacht-test-plan.md` 작성/검증
6. **릴리스** — main 머지

---

## 16. CP1 결정 항목 (사용자 승인 필요 — 3건)

> **본 PRD 확정 전 사용자가 아래 3개 항목을 승인해야 함.**
> 추천안은 planner 분석 기준이며, 사용자가 대안 채택 가능.

| ID | 항목 | 추천안 | 대안 | 영향 범위 |
|---|---|---|---|---|
| **CP1-1** | **턴 타임아웃 정책** | **30초** / 미선택 시 미기록 족보 중 **최저점(또는 우선순위 규칙) 항목 자동 0점 기록** / **서버 주체** (`ScheduledExecutorService`) | 대안A: 60초 (여유롭지만 AFK 리스크) / 대안B: 타임아웃 없음 (MVP 단순화, 단 AFK 시 게임 무한 정체 가능) | WS `TURN_STATE.turnDeadlineAt`, 타임아웃 스케줄러 구현, OQ-2(자동 기록 우선순위 규칙) 후속 결정 |
| **CP1-2** | **랭킹 연동 방식** | **안C — MVP는 결과 저장만** (`yacht_room`/`yacht_participant`/`yacht_score`), Phase 2에서 랭킹 재설계 | 안A: 신규 `yacht_win` 테이블 (`user_id`, `win_count`) — 단순 승수 카운트 / 안B: 기존 `RankingService` 확장 (`YachtRanking extends Ranking`) — 통합 랭킹 페이지 자동 노출 | DB 스키마(§9.5), 향후 랭킹 페이지/홈 위젯 노출 |
| **CP1-3** | **자동 시작 방식** | **online-rps와 동일한 5초 카운트다운 자동 시작** (`MATCH_COUNTDOWN` 패턴 재사용) — 방장/준비 개념 없음 | 대안: 첫 입장자(방장)가 시작 버튼 — 호스트 AFK 시 게임 시작 지연, 자동 매칭 UX와 모순 | WS `MATCH_COUNTDOWN`/`MATCH_COUNTDOWN_CANCELLED` 사용 여부, 대기 화면 UI |

### CP1 승인 결과 (2026-04-29 확정)
- [x] CP1-1: **타임아웃 없음** 채택 — 게임 중 턴 타임아웃 스케줄러 불필요
- [x] CP1-2: **안A — `yacht_win` 테이블 신규** (`user_id BIGINT FK, win_count INT DEFAULT 0`) 단순 승수 카운트
- [x] CP1-3: **전원 준비 + 방장 시작 버튼** 채택 — `/ready`, `/start` STOMP 이벤트 사용, `MATCH_COUNTDOWN` 미사용

---

PRD 작성 완료. CP1 승인 완료. Phase 2 착수.
