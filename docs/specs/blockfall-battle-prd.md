# PRD — Blockfall Battle (블록폴 통신배틀 모드)

- 작성자: planner
- 최초 작성일: 2026-04-27
- 상태: **CP1 작성 완료 — Phase 2 병렬 시작 준비**
- 관련 문서:
  - 기존 싱글 게임 구현: `frontend/src/games/blockfall/BlockfallBoard.tsx`
  - WebSocket 인프라 레퍼런스: `docs/specs/online-rps-prd.md`
  - 백엔드 구현 패턴 레퍼런스: `docs/progress/developer-backend-online-rps.md`
- 관련 progress: `docs/progress/planner-blockfall-battle.md`

---

## 1. 배경 & 목표

### 배경
- 기존 블록폴은 솔로 플레이 + 점수 랭킹(`rankings` 테이블) 기반.
- `online-rps` 프로젝트로 STOMP/JWT/세션 인터셉터 등 실시간 멀티플레이 인프라 검증 완료.
- 같은 인프라를 재활용해 블록폴에 **2~4인 통신 배틀 모드**를 추가, 콤보 기반 garbage line 공격 시스템으로 멀티플레이의 재미 도입.

### 목표
- 로그인 유저 + 게스트 혼합 2~4인이 실시간으로 블록폴 배틀을 즐긴다.
- 콤보 발동 시 다른 플레이어에게 garbage line 공격을 보내 보드 위로 밀어 올린다.
- 한 명만 살아남거나 모두 게임오버되면 결과 화면을 표시한다.
- 결과 화면 내에서만 역대 랭킹 상위 10명을 노출한다(홈/사이드바 미노출).
- **Test Lab 섹션에서만 진입 가능** — 운영 정식 게임으로 노출하지 않는다(테스트 단계).

### 비목표 (Out of Scope)
- Excel 모드 적용 (이번 버전 제외 — 일반 모드 전용).
- 주간 랭킹.
- 친구 초대 / 비공개 방 / 채팅 병행.
- 관전 / 리플레이.
- 솔로 모드 점수 랭킹과의 통합 (별도 테이블 분리).
- AI 봇 채우기.

---

## 2. 유저 스토리

- **US-1 (핵심)** — As a player, I want to enter "Blockfall Battle" from the Test Lab section, so that I can test the upcoming online multiplayer feature.
- **US-2** — As a player (logged-in or guest), I want to be matched into a battle room automatically, so that I can start playing without configuring a lobby.
- **US-3** — As the first player in a room, I want to wait for at least one more player to join, so that I'm not playing alone.
- **US-4** — As a player, I want to see other players' boards (or compact previews) in real time, so that I can sense the competition.
- **US-5** — As a player, I want my combo clears to send garbage lines to opponents, so that I have an attacking strategy.
- **US-6** — As a player, I want to receive garbage from opponents in a fair pattern (random hole, gray blocks), so that the game stays competitive but predictable.
- **US-7** — As a logged-in player, I want my battle wins to be recorded so I can climb the all-time wins ranking.
- **US-8 (게스트)** — As a guest, I want to play the battle without signing up, so that I can test the feature easily — but I accept that my record won't be saved.
- **US-9** — As a player joining mid-battle (room is PLAYING), I want to be queued and auto-joined into the next round, so that I don't bounce off a full room.
- **US-10** — As a player, I want a graceful disconnection handling (battle continues for others), so that the game doesn't break.

---

## 3. 모드 적용 범위 (**필수 필드**)

- **일반 모드: 필수 (Must)**
- **Excel 모드: 해당 없음 (N/A) — 이번 버전 제외**
- 사용자 지시 명시: "Excel 모드 이번 버전 제외".
- designer는 **일반 모드만** 명세 작성.
- developer-frontend는 **일반 모드만** 구현.
- qa-tester는 **일반 모드만** 검증.
- (향후 확장 가능 — 사용자 추가 지시 시 별도 이슈로 분리.)

---

## 4. 진입 경로 정책 (**중요**)

### 4.1 Test Lab 섹션에서만 노출
- **홈 메인 네비게이션 / 일반 게임 카드 목록에는 노출하지 않는다.**
- 홈의 "Test Lab" 섹션 내 카드에서 클릭 시에만 진입 가능.
- 라우트 예: `/test-lab/blockfall-battle`
  - 라우트는 등록되지만 일반 게임 라우트(`/blockfall`)와는 별개.
- 진입 시 페이지 헤더에 **"테스트 단계 — 운영 게임 아님"** 배너 노출 (designer가 디자인 결정).

### 4.2 운영 노출 조건 (Phase 2 이후)
- 본 PRD 범위 밖.
- Test Lab 운영 검증 완료 → 별도 PRD/이슈로 정식 진입 경로 결정.

---

## 5. 배틀방 상태 머신

### 5.1 방 상태 (battle_room.status)

| 상태 | 의미 | 진입 조건 | 이탈 조건 |
|---|---|---|---|
| `WAITING` | 매칭 가능, 한 명 이상 대기 중 | 신규 방 생성 시 / 직전 게임 FINISHED 후 다음 라운드 매칭 시점 | 2인 이상 모이면 → `PLAYING` |
| `PLAYING` | 게임 진행 중 | WAITING + 인원 ≥ 2 + 자동 시작 카운트다운 만료 | 우승자 결정 또는 전원 게임오버 → `FINISHED` |
| `FINISHED` | 게임 종료, 결과 브로드캐스트 완료 | 우승자 결정 또는 전원 종료 | 일정 시간(10초) 후 → `WAITING` 리셋 또는 방 close |

### 5.2 대기열 (Queue)

- 방이 `PLAYING` 상태일 때 새로 들어오려는 플레이어는 **대기열(Queue)** 에 진입.
- 대기열은 방마다 별도 (`battle_room.queue`).
- 대기열 최대 크기: **무제한**.
- 현재 게임이 `FINISHED` → `WAITING` 으로 전이될 때 큐의 모든 대기자를 한꺼번에 참가자로 승격.
  - 단, 4인 초과 시 선착순 우선 (FIFO) 으로 4인까지만 다음 게임 참가, 나머지는 큐에 남음.

### 5.3 상태 전이 다이어그램

```
[방 생성] → WAITING (1인)
   ↓ 다른 플레이어 입장 (≥2)
   ↓ 5초 카운트다운 (자동 시작)
PLAYING ─── 도중 입장 시도 → 대기열(Queue)에 추가, QUEUE_POSITION 안내
   ↓ 우승자 결정 또는 전원 종료
FINISHED (결과 화면 10초 표시)
   ↓ 다음 라운드 자동 매칭
WAITING ── 큐에 대기자 있으면 즉시 합류 (FIFO 4인까지)
   ↓ ≥2 인원 충족 시 카운트다운 재시작
PLAYING (다음 판)

[전원 퇴장] → FINISHED (closed_at 기록) → DB soft-close
```

### 5.4 자동 시작 정책
- 방에 2명 이상 모이면 서버가 5초 카운트다운 브로드캐스트(`MATCH_COUNTDOWN`).
- 카운트다운 만료 → `GAME_STARTED` 자동 브로드캐스트.
- 카운트다운 중 인원이 1명으로 감소 → 카운트다운 취소(`MATCH_COUNTDOWN_CANCELLED`).
- 4인 꽉 차면 카운트다운 즉시 만료(선택 구현).

---

## 6. 게스트 식별자 정책

### 6.1 발급 시점
- **HTTP `POST /api/blockfall-battle/join` 호출 시점에 발급.**
- 요청 헤더에 JWT 없으면 게스트로 분류, 응답에 `guestToken: "guest_{uuid}"` 포함.
- 클라이언트는 `guestToken`을 로컬스토리지(또는 sessionStorage)에 보관 후 WebSocket 연결 시 사용.

### 6.2 식별자 포맷
- `guest_{uuid v4}` (예: `guest_b3f1a2d4-...`)
- 닉네임 자동 생성: `손님-{4자리}` (예: `손님-A3F2`) — 4자리는 uuid 앞 4글자 대문자.

### 6.3 만료 조건
- 방 종료 시 (`FINISHED`) → 클라이언트에서 자동 폐기.
- WebSocket 연결 끊김 후 30초 타임아웃 → 서버에서 폐기.
- 같은 게스트 토큰으로 다른 방 입장 가능 (재사용 허용 — 단, 동일 시점 한 방만 활성).

### 6.4 JwtHandshakeInterceptor 예외 처리

**문제**: 기존 `JwtHandshakeInterceptor`는 JWT 필수 + `User.Role.FRIEND` 이상만 허용. 게스트는 JWT가 없으므로 그대로면 차단됨.

**해결 방안 (developer-backend가 CP3에서 구체 구현)**:

- **방안 A (권장)**: 신규 인터셉터 `BlockfallBattleHandshakeInterceptor` 추가. `/ws-battle` 별도 엔드포인트 등록 → JWT 또는 `guestToken` 둘 다 허용.
  - 새 STOMP 엔드포인트: `/ws-battle` (SockJS, 자체 인터셉터)
  - JWT 또는 `guestToken` 쿼리 파라미터 검사 후 세션 attribute에 `userId`(로그인 시) 또는 `guestId`(게스트 시) 저장.
  - `isGuest` 플래그도 함께 저장.
- **방안 B (대안)**: 기존 `/ws` 재사용 + `JwtHandshakeInterceptor` 수정. 단, 다른 게임에 영향 가능 — 회귀 위험.

**선택**: 방안 A 권장 (격리성). developer-backend가 최종 결정.

### 6.5 게스트 제약
- 전적 DB 저장 안 됨 (§8 참조).
- 랭킹 미반영.
- 다른 모든 기능(매칭, 배틀, 콤보 공격 등)은 로그인 유저와 동일.

---

## 7. 공격 기믹 — 콤보 → Garbage Line

### 7.1 콤보 횟수 → Garbage Line 줄 수 매핑

| 콤보 횟수 | 보낼 garbage line 수 | 비고 |
|---|---|---|
| 1콤보 | 0줄 | 공격 미발생 (자기 점수만) |
| 2콤보 | 1줄 | |
| 3콤보 | 2줄 | |
| 4콤보 | 3줄 | |
| 5콤보 이상 | 4줄 (상한) | 5+ 모두 4줄 고정 |

> 콤보 정의: 기존 싱글 블록폴의 콤보 카운터(연속 라인 클리어 시 누적)를 그대로 사용.
> 한 번에 여러 줄 클리어해도 콤보는 1회만 증가 (테트리스 표준 관행).

### 7.2 Garbage Line 구성

- **위치**: 받는 플레이어의 보드 **하단에 추가**, 기존 보드 내용은 위로 밀려 올라감.
- **블록 색**: 회색(예: `#888888`, designer가 정확한 hex 결정 — `COLORS_NORMAL`에 garbage 색 추가 인덱스 9 권장).
- **빈 칸 위치**: 줄마다 **랜덤 1칸**이 비어있음 (보드 너비 11칸 기준 0~10 중 1칸).
  - 동일 공격에 여러 줄이 포함된 경우, 줄별로 빈 칸 위치는 같음 (테트리스 표준 — 한 번에 들어오는 garbage는 같은 hole).
  - 다른 공격 사이에는 hole 위치 독립적.
- **밀어 올림 결과 보드 상단(buffer zone 포함) 초과**: 즉시 게임오버 처리 (Block Out).

### 7.3 공격 대상 선정

**선택 정책: 랜덤 1명**
- 자신 제외, 현재 살아있는(아직 게임오버 안 된) 플레이어 중 무작위 1명에게 공격.
- 단, 클라이언트가 `targetPlayerId`를 명시적으로 지정한 경우 해당 플레이어로 우선 (UI 추가 시 활용 — 본 PRD에서는 기본 랜덤).
- 살아있는 플레이어가 본인밖에 없으면 공격 무효.

**대안 (Phase 2)**: 최상위 점수 플레이어 자동 타겟 (kill the leader).

### 7.4 Garbage 큐잉
- 클라이언트가 콤보 발동 시 서버로 `COMBO_ATTACK` 메시지 전송.
- 서버가 대상 플레이어 결정 → 대상에게 `GARBAGE_ATTACK` 메시지 전송.
- 받는 클라이언트는 다음 piece가 lock 되는 시점에 garbage line을 보드에 적용 (즉시 적용 X — 현재 떨어지는 piece 보호).
- 짧은 시간 내 다중 garbage 누적 시 합산 적용 (최대 8줄까지 누적, 그 이상은 즉시 게임오버 위험).

---

## 8. 전적 DB 저장 정책

### 8.1 저장 대상
- **로그인 유저만 저장** (게스트 제외).
- 게임 종료 시점(`PLAYER_FINISHED` 처리) 또는 배틀 종료 시점(`GAME_RESULT`)에 win/lose 카운트 업데이트.

### 8.2 테이블: `battle_record`

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `id` | BIGINT | PK, AUTO_INCREMENT | |
| `user_id` | BIGINT | FK → user(id), UNIQUE, NOT NULL | 유저 1명당 1행 (UPSERT) |
| `win_count` | INT | NOT NULL, DEFAULT 0 | 1위 횟수 |
| `lose_count` | INT | NOT NULL, DEFAULT 0 | 1위 외 종료 횟수 |
| `total_games` | INT | NOT NULL, DEFAULT 0 | 참여한 총 배틀 수 |
| `last_played_at` | DATETIME(3) | NOT NULL | 최근 플레이 시각 |
| `created_at` | DATETIME(3) | NOT NULL | 첫 기록 시각 |
| `updated_at` | DATETIME(3) | NOT NULL | 마지막 수정 시각 |

- 인덱스: `(win_count DESC, last_played_at DESC)` — 랭킹 조회 최적화.

### 8.3 `rankings` 테이블과 분리하는 이유

1. **데이터 모델 차이**: `rankings`는 단일 점수(개인 베스트) 기반. `battle_record`는 누적 승/패 카운트 기반 — 의미가 다름.
2. **게임별 분리 일관성**: 솔로 블록폴 점수와 배틀 승수는 다른 지표 — 통합 시 사용자 혼란.
3. **랭킹 조회 쿼리 단순화**: `battle_record`에서 `ORDER BY win_count DESC` 단일 쿼리로 종료. `rankings`는 `gameKey` 분기 필요.
4. **확장성**: 추후 다른 배틀 게임(지뢰찾기 배틀 등) 추가 시 `battle_record`에 `game_key` 컬럼 추가하여 멀티 게임 통합 가능. 본 PRD에서는 블록폴 전용으로 출발.

> 참고: 본 PRD에서는 `battle_record` 컬럼에 `game_key`를 두지 않고 블록폴 배틀 전용으로 시작. 다른 배틀 게임 추가 시 마이그레이션으로 `game_key VARCHAR(32)` 추가 + `(game_key, user_id)` UNIQUE로 변경 권장.

### 8.4 승/패 판정 기준
- 1위(rank=1)로 종료 → `win_count++`
- 2~4위 → `lose_count++`
- 모든 종료 케이스에 `total_games++`, `last_played_at` 갱신.
- **연결 끊김 / 자발적 LEAVE**: total_games 증가시키지 않음 (도중 이탈은 미집계 — 어뷰징 방지 차원).

---

## 9. 랭킹 정책

### 9.1 결정 사항
- **승리 횟수 기준** (`battle_record.win_count` DESC).
- **역대 랭킹만** — 주간 랭킹은 본 PRD에서 제외 (복잡성 축소).
- 상위 **10명** 조회.
- 동점 시 `last_played_at` 최신순.

### 9.2 신규 API로 분리 (기존 `rankingsApi` 재사용 X)

**이유**:
- `rankings` 테이블과 분리되었으므로 (§8.3) 기존 API 호환 안 됨.
- 응답 DTO도 다름 (점수 → 승수).

**신규 API**: `GET /api/blockfall-battle/rankings` (§13.2 참조).

### 9.3 표시 위치 정책 (**필수 명시**)

- **표시 위치: 배틀 결과 화면(`GAME_RESULT` 수신 후 표시) 내에만 노출.**
- **홈화면 미적용** — 사이드바, 메인 네비게이션, 게임 카드, 솔로 블록폴 랭킹 화면 어디에도 노출하지 않음.
- 배틀 결과 화면 내 표시 형태: "역대 승수 TOP 10" 패널 (designer가 레이아웃 결정).
- `GAME_RESULT` 메시지의 `topRankings` 필드로 함께 전달 (§10 참조) — 클라이언트가 별도 API 호출하지 않아도 결과 화면에서 즉시 노출.
- 다만 클라이언트에서 새로고침 / 재진입 시 최신 랭킹을 보고 싶을 때를 위해 `GET /api/blockfall-battle/rankings`도 제공 (선택적 호출).

---

## 10. WebSocket 메시지 스펙

### 10.1 네임스페이스

| 용도 | 경로 | 비고 |
|---|---|---|
| Endpoint | `/ws-battle` (SockJS, 신규) | JWT 또는 guestToken 허용. 기존 `/ws`와 분리. |
| 구독 — 방 이벤트 | `/topic/blockfall-battle/room/{roomId}` | |
| 구독 — 개인 큐 | `/user/queue/blockfall-battle/errors` | |
| 발행 — 방 이벤트 | `/app/blockfall-battle/room/{roomId}/{action}` | action: join, board-state, combo-attack, leave |

> 기존 채팅(`/topic/room/**`) / RPS(`/topic/rps/**`)와 완전 분리.

### 10.2 공통 envelope (서버 → 클라이언트)

```json
{
  "type": "<EVENT_TYPE>",
  "timestamp": "ISO8601",
  "payload": { ... }
}
```

> 아래 메시지 본문은 `payload` 필드 내용을 명세. envelope에 감싸 전송됨.

### 10.3 서버 → 클라이언트 메시지

#### 10.3.1 `ROOM_STATE` — 방 현재 상태 브로드캐스트

```json
{
  "type": "ROOM_STATE",
  "roomId": "string(8자리)",
  "status": "WAITING|PLAYING|FINISHED",
  "players": [
    { "id": "string", "nickname": "string", "isGuest": boolean }
  ],
  "queueCount": number
}
```

- 트리거: 입장, 퇴장, 큐 변동, 상태 전이 시.
- `players[].id`: 로그인 유저는 user_id의 string, 게스트는 `guest_{uuid}`.
- `queueCount`: 현재 대기열에 있는 인원 수.

#### 10.3.2 `GAME_STARTED` — 게임 시작 신호

```json
{
  "type": "GAME_STARTED",
  "roomId": "string",
  "players": [
    { "id": "string", "nickname": "string", "isGuest": boolean }
  ],
  "startAt": "ISO8601"
}
```

- 트리거: 카운트다운 만료 시.
- 클라이언트는 `startAt` 기준으로 동기화된 게임 시작 (소량 클럭 드리프트 허용).

#### 10.3.3 `BOARD_UPDATE` — 플레이어 보드 상태 전파

```json
{
  "type": "BOARD_UPDATE",
  "playerId": "string",
  "board": "number[][]",
  "score": number,
  "lines": number,
  "level": number
}
```

- 트리거: 클라이언트가 `BOARD_STATE` 발행 시(200ms 주기) → 서버가 다른 참가자 전원에게 그대로 전파.
- `board`: BOARD_W × BOARD_H 2D 배열. 색 인덱스 0~9.
- 본인 자신에게는 미전송(에코 방지) — 서버에서 originator 필터링.

#### 10.3.4 `GARBAGE_ATTACK` — 방해 블록 수신

```json
{
  "type": "GARBAGE_ATTACK",
  "targetPlayerId": "string",
  "lines": number,
  "fromPlayerId": "string"
}
```

- 트리거: 다른 플레이어의 콤보 발동(`COMBO_ATTACK`) → 서버가 대상 결정 후 발송.
- `lines`: 1~4. (5콤보 이상 모두 4 상한)
- 받는 클라이언트는 다음 piece lock 시점에 보드에 적용.
- `targetPlayerId`로 본인이 대상인지 확인 (본인일 때만 적용).

#### 10.3.5 `PLAYER_FINISHED` — 플레이어 게임오버

```json
{
  "type": "PLAYER_FINISHED",
  "playerId": "string",
  "rank": number,
  "score": number
}
```

- 트리거: 한 플레이어의 보드가 Block Out → 서버가 즉시 브로드캐스트.
- `rank`: 종료 시점 순위 (마지막 살아남으면 1위, 먼저 죽을수록 낮은 순위).
  - 4인 게임에서 첫 번째로 죽으면 rank=4, 마지막은 rank=1.

#### 10.3.6 `GAME_RESULT` — 배틀 최종 결과

```json
{
  "type": "GAME_RESULT",
  "roomId": "string",
  "results": [
    {
      "rank": number,
      "playerId": "string",
      "nickname": "string",
      "score": number,
      "isGuest": boolean
    }
  ],
  "topRankings": [
    { "rank": number, "nickname": "string", "winCount": number }
  ]
}
```

- 트리거: 우승자 결정 또는 전원 게임오버 시.
- `results`: 모든 참가자 결과, rank 오름차순.
- `topRankings`: 역대 승수 TOP 10 (§9.3).

#### 10.3.7 `QUEUE_POSITION` — 대기열 위치 안내

```json
{
  "type": "QUEUE_POSITION",
  "position": number,
  "totalInQueue": number
}
```

- 트리거: 대기열 진입 시 + 대기열 변동 시(앞 사람 빠지면 position 갱신).
- `position`: 1부터 시작 (1이면 다음 라운드 1순위).
- 개인 큐(`/user/queue/blockfall-battle/...`) 또는 본인 전용 채널로 전송.

#### 10.3.8 `PLAYER_LEFT` — 플레이어 이탈

```json
{
  "type": "PLAYER_LEFT",
  "playerId": "string",
  "nickname": "string"
}
```

- 트리거: `LEAVE_BATTLE` 메시지 또는 `SessionDisconnectEvent`.
- 게임 도중 이탈 시 해당 플레이어는 자동 게임오버 처리(`PLAYER_FINISHED`도 함께 발송).

#### 10.3.9 `ERROR` — 오류 메시지

```json
{
  "type": "ERROR",
  "code": "string",
  "message": "string"
}
```

- 개인 큐 전용 (`/user/queue/blockfall-battle/errors`).

| code | 상황 |
|---|---|
| `ROOM_NOT_FOUND` | 존재하지 않는 roomId |
| `ROOM_NOT_AVAILABLE` | 방이 FINISHED 상태 |
| `NOT_IN_ROOM` | 본인이 참가하지 않은 방에 메시지 발송 |
| `INVALID_BOARD` | board 형식 불량 |
| `INVALID_COMBO` | combo 값 음수 또는 비정상 |
| `UNAUTHORIZED` | JWT/guestToken 누락 또는 만료 |

### 10.4 클라이언트 → 서버 메시지

#### 10.4.1 `JOIN_BATTLE` — 배틀 참가 요청

> **선택 사항**: WebSocket 발행 대신 **REST API `POST /api/blockfall-battle/join`** 로 처리(권장).
> WebSocket join 메시지는 HTTP join 응답으로 받은 roomId에 구독 후 자동 발행하는 형태로 두되, body는 `{}` 빈 객체로 충분.
> developer-backend가 CP3에서 최종 결정.

발행 경로: `/app/blockfall-battle/room/{roomId}/join`
```json
{}
```

#### 10.4.2 `BOARD_STATE` — 내 보드 상태 전송 (200ms 주기)

발행 경로: `/app/blockfall-battle/room/{roomId}/board-state`
```json
{
  "type": "BOARD_STATE",
  "board": "number[][]",
  "score": number,
  "lines": number,
  "level": number,
  "combo": number
}
```

- 클라이언트가 200ms throttle 로 발송 (성능 보호).
- 서버는 본인 제외 다른 참가자에게 `BOARD_UPDATE`로 전파.

#### 10.4.3 `COMBO_ATTACK` — 콤보 공격 발동

발행 경로: `/app/blockfall-battle/room/{roomId}/combo-attack`
```json
{
  "type": "COMBO_ATTACK",
  "combo": number,
  "targetPlayerId": "string|null"
}
```

- 클라이언트가 콤보 ≥ 2 발생 시 발송.
- `targetPlayerId`: null이면 서버가 랜덤 선택. 명시되면 해당 플레이어 우선(살아있을 때만).
- 서버가 §7.1 매핑으로 lines 수 결정 후 대상에게 `GARBAGE_ATTACK` 전파.

#### 10.4.4 `LEAVE_BATTLE` — 배틀 이탈

발행 경로: `/app/blockfall-battle/room/{roomId}/leave`
```json
{
  "type": "LEAVE_BATTLE"
}
```

---

## 11. 도중 입장 상세 플로우

### 11.1 시나리오

```
[유저 X] HTTP POST /api/blockfall-battle/join
   ↓
[서버] 매칭 알고리즘:
   - WAITING 방 + 정원 미달 우선 탐색
   - 없으면 PLAYING 방의 큐로 진입
   - 없으면 신규 WAITING 방 생성
   ↓
[케이스 A: WAITING 방에 합류]
   - players 배열에 추가 → ROOM_STATE 브로드캐스트
   - 인원 ≥ 2 시 카운트다운 시작
   ↓
[케이스 B: PLAYING 방의 큐에 진입]
   - 큐에 추가
   - X 본인에게 QUEUE_POSITION 전송 (예: position=1)
   - 다른 참가자에게 ROOM_STATE 브로드캐스트 (queueCount 증가)
   ↓
[현재 판 종료]
   - GAME_RESULT 브로드캐스트
   - 10초 결과 화면 후 WAITING 전이
   ↓
[큐 처리]
   - 큐 FIFO 순으로 다음 라운드 참가자 4명까지 승격
   - 5명 이상이면 4명만 승격, 나머지는 큐에 잔류
   - QUEUE_POSITION 메시지로 잔류자 위치 갱신
   - 신규 참가자 포함 ROOM_STATE 브로드캐스트
   - 인원 ≥ 2 시 카운트다운 시작
```

### 11.2 큐 무제한 정책
- 큐 최대 크기 제한 없음.
- 현실적 운영을 위해 추후 100명 등 제한 추가 가능 (Phase 2).

### 11.3 큐 이탈
- 큐 대기 중 `LEAVE_BATTLE` 또는 연결 끊김 시 큐에서 제거.
- 다른 큐 대기자들의 `QUEUE_POSITION` 갱신 브로드캐스트.

---

## 12. DB 마이그레이션 SQL 초안

### 12.1 `battle_room` 테이블

```sql
CREATE TABLE IF NOT EXISTS battle_room (
    id              BIGINT       NOT NULL AUTO_INCREMENT,
    room_id         VARCHAR(8)   NOT NULL,
    status          VARCHAR(16)  NOT NULL,
    max_players     INT          NOT NULL DEFAULT 4,
    current_players INT          NOT NULL DEFAULT 0,
    queue_count     INT          NOT NULL DEFAULT 0,
    created_at      DATETIME(3)  NOT NULL,
    started_at      DATETIME(3)  NULL,
    finished_at     DATETIME(3)  NULL,
    closed_at       DATETIME(3)  NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_battle_room_room_id (room_id),
    KEY idx_battle_room_status_created (status, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

> 참가자 / 큐 상세는 인메모리(`ConcurrentHashMap`) 또는 Redis로 관리 (실시간 변동 잦음). DB는 방 메타만 보관.
> 본 PRD에서는 **Redis 미사용 — 인메모리 단일 인스턴스** (현재 비기능 요구사항 §14 명시).

### 12.2 `battle_record` 테이블

```sql
CREATE TABLE IF NOT EXISTS battle_record (
    id              BIGINT       NOT NULL AUTO_INCREMENT,
    user_id         BIGINT       NOT NULL,
    win_count       INT          NOT NULL DEFAULT 0,
    lose_count      INT          NOT NULL DEFAULT 0,
    total_games     INT          NOT NULL DEFAULT 0,
    last_played_at  DATETIME(3)  NOT NULL,
    created_at      DATETIME(3)  NOT NULL,
    updated_at      DATETIME(3)  NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_battle_record_user_id (user_id),
    KEY idx_battle_record_wins (win_count DESC, last_played_at DESC),
    CONSTRAINT fk_battle_record_user FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 12.3 적용 방법
- 위 SQL을 `backend/src/main/resources/db/blockfall-battle-schema.sql`에 작성.
- `spring.jpa.hibernate.ddl-auto=update` 가 자동 적용.
- 운영 점검은 사용자가 Railway MySQL 콘솔에서 SQL 직접 실행하여 확인 가능.

---

## 13. REST API 엔드포인트

### 13.1 `POST /api/blockfall-battle/join` — 배틀 참가 요청

**목적**: 자동 매칭 또는 큐 진입.

**요청**
- Method: `POST`
- Path: `/api/blockfall-battle/join`
- Headers: `Authorization: Bearer <JWT>` (선택 — 없으면 게스트로 처리)
- Body:
  ```json
  {
    "guestToken": "string|null"
  }
  ```
  - 게스트 재방문 시 기존 토큰 재사용 가능 (선택). 첫 방문이면 null.

**응답 200/201**
```json
{
  "roomId": "string(8)",
  "status": "WAITING|PLAYING",
  "playerCount": number,
  "maxPlayers": 4,
  "queuePosition": number | null,
  "isGuest": boolean,
  "guestToken": "string|null",
  "playerId": "string"
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `roomId` | string | 방 식별자 |
| `status` | string | WAITING(즉시 참가) 또는 PLAYING(큐 진입) |
| `playerCount` | int | 본인 포함 현재 방 참가자 수 (큐 진입 시 큐 포함 X) |
| `maxPlayers` | int | 4 |
| `queuePosition` | int|null | 큐 진입 시 위치(1부터), 즉시 참가 시 null |
| `isGuest` | boolean | 본인이 게스트인지 |
| `guestToken` | string|null | 게스트 신규 발급 시 토큰, 로그인 유저는 null |
| `playerId` | string | 본인 플레이어 ID (user_id 또는 guest_{uuid}) |

**에러**
| HTTP | 코드 | 상황 |
|---|---|---|
| 401 | `UNAUTHORIZED_GUEST_TOKEN` | guestToken 형식 불량 |
| 409 | `ALREADY_IN_ROOM` | 이미 다른 활성 방에 참가 중 (`{ "error": "ALREADY_IN_ROOM", "roomId": "..." }`) |
| 503 | `MATCH_UNAVAILABLE` | 일시적 매칭 실패 |

---

### 13.2 `GET /api/blockfall-battle/rankings` — 역대 랭킹 조회

**목적**: 역대 승수 기준 TOP 10 조회.

**요청**
- Method: `GET`
- Path: `/api/blockfall-battle/rankings`
- Headers: 인증 불필요 (공개)
- Query: 없음

**응답 200**
```json
{
  "topRankings": [
    {
      "rank": 1,
      "userId": 101,
      "nickname": "방장닉",
      "winCount": 24,
      "totalGames": 50,
      "lastPlayedAt": "2026-04-27T10:00:00.000Z"
    }
  ]
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `topRankings[].rank` | int | 1~10 |
| `topRankings[].userId` | long | DB user_id |
| `topRankings[].nickname` | string | 유저 닉네임 |
| `topRankings[].winCount` | int | 누적 승수 |
| `topRankings[].totalGames` | int | 누적 참여 수 |
| `topRankings[].lastPlayedAt` | ISO8601 | 마지막 플레이 시각 |

- 정렬: `win_count DESC, last_played_at DESC`.
- 결과 0건이면 `topRankings: []` 반환 (200).

**에러**: 일반 5xx만.

---

## 14. 비기능 요구사항

| 항목 | 값 | 비고 |
|---|---|---|
| BOARD_STATE 클라이언트 발송 주기 | 200ms (throttle) | 초당 5회 |
| BOARD_UPDATE 서버 전파 주기 | 클라이언트 발송 즉시 (no batching) | 향후 batching 검토 가능 |
| 최대 동시 방 수 | 제한 없음 (현재) | 운영 모니터링 후 결정 |
| 대기열 최대 크기 | 무제한 (현재) | |
| Redis 사용 | **미사용** (현재) | 단일 인스턴스 인메모리 운영 |
| 카운트다운 시간 | 5초 | (online-rps와 동일 기조) |
| 결과 화면 표시 시간 | 10초 | 자동 다음 라운드 매칭 트리거 |
| 게스트 세션 타임아웃 | 30초 (연결 끊김 후) | |
| Garbage 누적 상한 | 8줄 | 초과 시 게임오버 |

### 14.1 단일 인스턴스 제약
- 현재 Railway에 Spring Boot 단일 인스턴스 운영 가정.
- 인메모리 ConcurrentHashMap 기반 방 상태 관리.
- 향후 다중 인스턴스 확장 시 Redis Pub/Sub 도입 필요 (Phase 2).

---

## 15. 엣지 케이스 & 에러 시나리오

| ID | 상황 | 처리 |
|---|---|---|
| EC-1 | 방 정원(4명) 초과 입장 시도 | 큐로 자동 라우팅 |
| EC-2 | 게스트가 JWT 없이 WebSocket 연결 시도 | `/ws-battle` 인터셉터가 guestToken 검사 후 허용 |
| EC-3 | 잘못된 guestToken 형식 (`guest_` 접두사 없음 등) | 401 반환, 신규 발급 유도 |
| EC-4 | 콤보 발동 시 살아있는 다른 플레이어가 본인밖에 없음 | GARBAGE_ATTACK 미발송 |
| EC-5 | 도중 입장한 큐 대기자가 `LEAVE_BATTLE` 발송 | 큐에서 제거 + 다른 대기자 position 갱신 |
| EC-6 | 게임 중 전원 연결 끊김 | 방 즉시 FINISHED + closed_at 기록, DB soft-close |
| EC-7 | 게임 중 1명만 남음 | 자동 우승(rank=1) 처리, GAME_RESULT 브로드캐스트 |
| EC-8 | 동일 user_id로 두 개 방 동시 참가 시도 | 409 ALREADY_IN_ROOM (기존 roomId 응답) |
| EC-9 | 콤보 값 음수/비정상 | INVALID_COMBO 에러 |
| EC-10 | board 배열 형식 불량 (크기 불일치 등) | INVALID_BOARD 에러 + 무시 (게임 중단 X) |
| EC-11 | Garbage 누적 8줄 초과 | 즉시 PLAYER_FINISHED 처리 |
| EC-12 | 결과 화면 10초 안에 다른 큐 대기자 없고 인원 1명 → WAITING 복귀 | 1명만 있으면 카운트다운 시작 안 함, 다른 입장 대기 |
| EC-13 | 게임 시작 직전 한 명 이탈로 인원 1명 됨 | 카운트다운 취소(MATCH_COUNTDOWN_CANCELLED), WAITING 유지 |
| EC-14 | 게스트 닉네임이 다른 게스트와 충돌 (희박) | guest_id 우선, 닉네임은 표시용. UI에서 `손님-A3F2 #abcd` 등으로 보강 가능 (designer 결정) |
| EC-15 | 같은 콤보 메시지 중복 발송 (네트워크 재전송) | 서버가 클라이언트별 마지막 콤보 시퀀스 추적, 동일 시퀀스 무시 (developer-backend 구현) |

---

## 16. 성공 지표

### MVP 완료 기준 (CP1 기준)
- [ ] 로그인 유저 + 게스트 혼합 2~4인 배틀 정상 동작
- [ ] 콤보 발동 시 garbage line 정상 전송 / 수신 / 적용
- [ ] 도중 입장 시 큐 진입 후 다음 라운드 자동 합류
- [ ] 게임 종료 후 결과 화면에 역대 TOP 10 랭킹 표시
- [ ] 로그인 유저 승수가 `battle_record`에 정확히 누적
- [ ] 게스트는 전적 미저장 (DB 확인)
- [ ] 기존 솔로 블록폴 / 채팅 / RPS 동작 영향 없음 (회귀 테스트)
- [ ] Test Lab 외 다른 진입 경로에서 노출 안 됨

### 관찰 지표 (Phase 2 준비용)
- 일일 배틀 수 / 게스트 참여 비율
- 평균 배틀 인원 (2/3/4인 분포)
- 도중 이탈률
- 큐 대기 평균 시간

---

## 17. 오픈 퀘스천

| ID | 질문 | 담당 | 답변 시점 |
|---|---|---|---|
| OQ-1 | 게스트 인증 방안 A vs B 최종 선택 | developer-backend | CP3 |
| OQ-2 | BOARD_UPDATE 서버 측 batching 전략 (현재 즉시 전파) | developer-backend | CP3 |
| OQ-3 | 4인 꽉 찼을 때 카운트다운 즉시 만료 vs 5초 유지 | developer-backend | CP3 |
| OQ-4 | 게임 중 연결 끊김 vs 자발적 LEAVE의 전적 처리 차이 (현재 둘 다 미집계) | planner | Phase 2 |
| OQ-5 | 결과 화면 10초 자동 다음 라운드 매칭 — 큐 잔류자에게 별도 컨펌? | designer | CP2 |
| OQ-6 | 모바일 UX (보드 5개 표시 vs 본인 보드만 + 미리보기) | designer | CP2 |
| OQ-7 | Test Lab 페이지 자체 디자인 (배너 / 경고 문구 톤) | designer | CP2 |
| OQ-8 | 게스트 닉네임 충돌 시 표시 보강 (#abcd 접미 등) | designer | CP2 |
| OQ-9 | 콤보 메시지 중복 방지 시퀀스 ID 도입 여부 | developer-backend | CP3 |
| OQ-10 | 큐 무제한 → 운영 후 한도 부과 시점 | planner | Phase 2 |

---

## 18. CP1 이후 일정 (예상)

1. **CP1 작성 완료** (현재) — Phase 2 병렬 시작 준비
2. **CP2 (병렬)** — designer가 `docs/design/blockfall-battle.md` 작성 (Test Lab 진입 / 결과 화면 / 보드 레이아웃)
3. **CP2 (병렬)** — developer-backend가 엔티티/서비스/컨트롤러/`/ws-battle` 구현
4. **CP2 (병렬)** — developer-frontend가 `BlockfallBattleBoard.tsx` 신규 작성, STOMP 클라이언트 통합
5. **CP3** — 통합 테스트 (4인 게스트 혼합 시나리오 포함)
6. **CP4** — qa-tester `docs/review/blockfall-battle-test-plan.md` 작성 및 검증
7. **릴리스** — main 머지 + Test Lab 카드 노출 + Railway 배포

---

> 본 PRD는 `docs/progress/planner-blockfall-battle.md` 와 함께 관리됨. 스펙 변경은 반드시 planner 경유.
