# 버그 리포트 — Blockfall Battle

- 작성자: qa-tester
- 작성일: 2026-04-27
- 분석 방법: 백엔드 구현 파일 정적 코드 리뷰 (E2E 실행 전 사전 분석)
- 기반 TC: `docs/review/blockfall-battle-test-plan.md`

---

## BUG-001 [WebSocket/게임오버] Block Out 게임오버 신호 경로 미구현

- **우선순위**: P1 Critical
- **Title**: [Blockfall Battle / WebSocket] 클라이언트 Block Out 감지 → 서버 PLAYER_FINISHED 전달 경로 없음
- **담당 추천**: developer-backend

### 재현 단계

1. 2인 PLAYING 상태 진입
2. 유저B의 보드가 Block Out 상태(최상단 초과)에 도달
3. 유저A의 WebSocket 이벤트 수신 대기

### 예상 결과

PRD §10.3.5: "한 플레이어의 보드가 Block Out → 서버가 즉시 `PLAYER_FINISHED` 브로드캐스트"

### 실제 결과 (코드 분석)

`BlockfallBattleWebSocketController`에 클라이언트가 Block Out을 서버에 알리는 메시지 핸들러가 없음.
`BattleRoomService.handlePlayerFinished()`는 구현되어 있으나 WebSocket `@MessageMapping`으로 노출되지 않음.

developer-backend 통보에서 "Block Out 감지 미정의 — 서버가 BOARD_STATE에서 암묵적 감지"라고 명시하였으나, 현재 `handleBoardState()`에도 Block Out 감지 로직(보드 최상단 줄 점유 여부 확인)이 없음.

결과적으로 현재 구현에서는 어떤 경로로도 PLAYER_FINISHED가 트리거되지 않음.

### 근거 파일

- `BlockfallBattleWebSocketController.java` — `/board-state`, `/combo-attack`, `/leave` 핸들러만 존재. `/player-finished` 또는 Block Out 신호 핸들러 없음.
- `BattleRoomService.handleBoardState()` — board null 체크 후 BOARD_UPDATE 전파만 수행. Block Out 감지 없음.
- `BattleRoomService.handlePlayerFinished()` 메서드는 존재하나 외부에서 호출될 진입점 없음.

### 수정 방향 (developer-backend 확인 필요)

아래 두 방안 중 하나를 선택하고 확정 후 TC-GAME-02 조건 최종 확정:

**방안 A (권장, 서버 감지)**: `handleBoardState()`에서 board 배열 최상단(row 0 또는 버퍼 존 상단) 점유 여부를 서버가 직접 판단해 `handlePlayerFinished()` 자동 호출. 클라이언트 위변조 방지에 유리.

**방안 B (클라이언트 신고)**: `/app/blockfall-battle/room/{roomId}/player-finished` 엔드포인트 추가. 클라이언트가 자신의 Block Out 시 호출. 서버는 playerId 일치 여부 검증 후 처리.

---

## BUG-002 [보안] TC-SEC-02 — guestToken uuid 길이 검증 불충분

- **우선순위**: P1 Critical → **RESOLVED**
- **상태**: CLOSED — 2026-04-27 developer-backend 수정 완료, qa-tester 코드 레벨 재검증 통과
- **Title**: [Blockfall Battle / 보안] `guest_` 접두사만 있으면 빈 uuid도 통과 — 401 미반환

- **담당 추천**: developer-backend

### 재현 단계

1. `POST /api/blockfall-battle/join` 호출
2. Body: `{ "guestToken": "guest_" }` (uuid 부분 완전 빈 문자열)
3. 응답 코드 확인

### 예상 결과 (TC-SEC-02)

HTTP 401, `{ "error": "UNAUTHORIZED_GUEST_TOKEN" }`

### 실제 결과 (코드 분석)

`BattleRoomController.join()`: `requestToken.startsWith(GUEST_PREFIX)` 조건만 검사.
`guestToken: "guest_"` 는 `guest_` 접두사를 포함하므로 통과됨.
uuid 부분이 빈 문자열 → 닉네임 생성 로직 `uuid.replace("-", "").substring(0, Math.min(4, ...))` 에서 `substring(0, 0)` 호출 → 닉네임이 `"손님-"` (4자리 없음)로 생성됨.
401 미반환, 비정상 guestId `"guest_"` 로 방 참가 허용됨.

동일 문제가 `BlockfallBattleHandshakeInterceptor.beforeHandshake()`에도 존재:
`uuid.length() < 4` 체크가 있으나 이 경우 신규 토큰 재발급 처리(fallthrough)로 401 거부 없음.

### 근거 파일

- `BattleRoomController.java` L72-76: `startsWith(GUEST_PREFIX)` 만 체크, uuid 길이/포맷 미검증
- `BlockfallBattleHandshakeInterceptor.java` L60-64: `uuid.length() < 4` 이면 신규 발급, 거부 없음

### 수정 내용 (2026-04-27)

- `BattleRoomController.java` L39-41: `GUEST_TOKEN_PATTERN` (`^guest_[0-9a-f]{8}-...-[0-9a-f]{12}$`) 추가
- L82-86: `GUEST_TOKEN_PATTERN.matcher(requestToken).matches()` 불일치 시 HTTP 401 반환
- `BlockfallBattleHandshakeInterceptor.java` L32-34: 동일 패턴 추가
- L63-65: 패턴 불일치 시 신규 정상 토큰 자동 발급 (WebSocket 레이어는 연결 유지 + 대체 발급 전략 채택 — 보안 우회 경로 없음 확인)

### 재검증 결과 (TC-SEC-02, TC-EDGE-02)

| 입력값 | 기대 | 실제 | 판정 |
|---|---|---|---|
| `"guest_"` (빈 uuid) | HTTP 401 | `GUEST_TOKEN_PATTERN` 불일치 → 401 | PASS |
| `"invalid-token"` (접두사 없음) | HTTP 401 | 패턴 불일치 → 401 | PASS |
| `"GUEST_b3f1a2d4"` (대문자 접두사) | HTTP 401 | 패턴 불일치 → 401 | PASS |
| `""` (빈 문자열) | 신규 게스트 발급(200) | `StringUtils.hasText("")` false → 발급 분기 | PASS |

---

## BUG-003 [동시성] joinRoom sessionId null → sessionRoomMap 오염

- **우선순위**: P2 High
- **Title**: [Blockfall Battle / 동시성] REST join 직후 WebSocket 미연결 상태에서 sessionId=null이 sessionRoomMap에 삽입됨

- **담당 추천**: developer-backend

### 재현 단계

1. 로그인 유저 A: `POST /api/blockfall-battle/join` 호출 → roomId 수신
2. 유저 A가 WebSocket 연결 전 지연 발생 (예: 네트워크 지연)
3. 유저 B: 동일 방에 join
4. 유저 A WebSocket 연결 시도

### 예상 결과

정상적으로 sessionId가 등록되고 이탈 처리에 문제 없음.

### 실제 결과 (코드 분석)

`BattleRoomService.joinBattle()` → `roomManager.joinRoom(roomId, player)` 호출 시점에 `player.getSessionId()`가 `null` (REST 단계에서는 sessionId 없음).

`BattleRoomManager.joinRoom()` L73: `sessionRoomMap.put(player.getSessionId(), roomId)` — `null` key로 삽입됨.
`ConcurrentHashMap`은 null key를 허용하지 않으므로 `NullPointerException` 발생 가능성.
또는 `sessionRoomMap.put(null, roomId)` 호출 시점에 NPE 즉시 발생.

이후 `registerSession()` 호출로 sessionId 갱신이 예정되어 있으나, 그 이전에 NPE가 발생하거나 null key가 map에 잔존하면 다른 플레이어의 이탈 처리에 영향.

### 근거 파일

- `BattleRoomManager.joinRoom()` L73: `sessionRoomMap.put(player.getSessionId(), roomId)` — sessionId가 null일 때 NPE
- `BattleRoomService.joinBattle()` L82: `PlayerSessionInfo` 생성 시 sessionId 파라미터 `null` 전달

### 수정 방향

`BattleRoomManager.joinRoom()` 에서 sessionId null 체크 추가:
```java
if (player.getSessionId() != null) {
    sessionRoomMap.put(player.getSessionId(), roomId);
}
```
WebSocket 연결 시 `registerSession()` 호출로 뒤늦게 등록되는 현재 흐름은 유지.

---

## BUG-004 [데이터 무결성] finishGame — 이탈자 전적 저장 가능성

- **우선순위**: P2 High
- **Title**: [Blockfall Battle / 전적] 도중 이탈 후 finishGame 실행 시 이탈자 전적이 저장될 수 있음

- **담당 추천**: developer-backend

### 재현 단계

1. 3인 PLAYING 상태
2. 유저C가 `LEAVE_BATTLE` 발행 → `handleLeaveBySession()` 호출
3. `handleLeaveBySession()` → `roomManager.removePlayer()` → 유저C 활성 목록에서 제거
4. 유저A 또는 유저B가 게임오버 → `finishGame()` 호출
5. `finishGame()` 내 전적 저장 루프 실행

### 예상 결과 (PRD §8.4)

"연결 끊김 / 자발적 LEAVE: total_games 증가시키지 않음 (도중 이탈은 미집계)"

### 실제 결과 (코드 분석)

`BattleRoomService.finishGame()` L468-476:
```java
List<...> players = roomManager.getActivePlayers(roomId);
players.stream()
    .filter(p -> !p.isGuest() && p.getUserId() != null)
    .forEach(p -> rankingService.updateRecord(p.getUserId(), isWinner));
```

`handleLeaveBySession()` 는 `roomManager.removePlayer(sessionId)` 로 활성 목록에서 제거하므로, 이탈한 유저C는 `getActivePlayers()` 결과에 포함되지 않음. 정상.

**그러나 예외 케이스**: 게임 중 이탈자가 `removePlayer` 전에 `markFinished(alive=false)` 처리된 상태라면, `getActivePlayers()`에 여전히 포함(alive=false이지만 제거 아님)될 수 있음. `finishGame()`의 필터는 `isGuest()`와 `userId != null` 만 검사. 이탈 여부(alive=false 원인이 이탈인지 게임오버인지)를 구분하지 않음.

특히 `handleLeaveInternal()` → `broadcast PLAYER_FINISHED` 후 `checkAutoWin()` → `finishGame()` 순서에서: 이탈자가 `PLAYER_FINISHED` 처리되었지만 activePlayers에서 제거되지 않은 시점에 `finishGame()`이 호출되면 이탈자 전적 저장 발생 가능.

코드 흐름 재확인 필요: `handleLeaveInternal()` → `handleLeaveBySession()` → `removePlayer()` 는 이미 호출되었으므로 실제로 이탈자는 activePlayers에 없음. **단, race condition 시나리오에서 제거 순서 보장이 필요.**

추가로 `finishGame()` 전적 저장 대상에 "도중 이탈 여부" 플래그를 명시적으로 체크하는 방어 로직이 없어 향후 코드 변경 시 취약점이 될 수 있음.

### 권장 수정

`finishGame()` 전적 저장 필터에 이탈 플래그 추가:
```java
.filter(p -> !p.isGuest() && p.getUserId() != null && !p.isVoluntaryLeft())
```
또는 `PlayerSessionInfo`에 `voluntaryLeft` 플래그를 추가하고 `handleLeaveInternal()`에서 설정.

---

## BUG-005 [보안] guestToken 형식 우회 — `guest_X` (uuid 4자 미만)

- **우선순위**: P1 Critical → **RESOLVED**
- **상태**: CLOSED — 2026-04-27 developer-backend 수정 완료, qa-tester 코드 레벨 재검증 통과 (BUG-002와 동일 수정으로 통합 해결)
- **Title**: [Blockfall Battle / 보안] uuid가 4자 미만인 guestToken으로 방 참가 가능

- **담당 추천**: developer-backend

### 재현 단계

1. `POST /api/blockfall-battle/join` 호출
2. Body: `{ "guestToken": "guest_abc" }` (uuid 3자)
3. 응답 코드 및 처리 결과 확인

### 예상 결과

HTTP 401, `UNAUTHORIZED_GUEST_TOKEN`

### 실제 결과 (코드 분석, 수정 전)

`BattleRoomController.join()` L71-76: `startsWith("guest_")` 검사만 수행.
`"guest_abc"` → 접두사 일치 → guestId로 허용.
닉네임 생성 `uuid.replace("-","").substring(0, Math.min(4, 3))` → `"손님-ABC"` (3자) 생성. 형식 불일치.

TC-EDGE-02 케이스 `"guest_"` (빈 uuid)는 BUG-002와 동일. 본 버그는 1~3자 uuid 케이스.

### 재검증 결과 (TC-EDGE-02)

`"guest_abc"` → `GUEST_TOKEN_PATTERN` (`^guest_[0-9a-f]{8}-[0-9a-f]{4}-4...$`) 불일치 → HTTP 401 반환 확인. PASS

---

## BUG-006 [동시성] tryStartCountdown 중복 실행 경쟁 조건

- **우선순위**: P2 High
- **Title**: [Blockfall Battle / 동시성] 2번째와 3번째 유저가 동시 join 시 카운트다운 Future가 2개 생성될 수 있음

- **담당 추천**: developer-backend

### 재현 단계

1. 1인 WAITING 방 존재
2. 유저B와 유저C가 거의 동시에 `POST /api/blockfall-battle/join` 호출 (타이밍 경합)
3. 서버 상태 확인

### 예상 결과

카운트다운은 정확히 1회만 시작. MATCH_COUNTDOWN 이벤트 1회 수신.

### 실제 결과 (코드 분석)

`BattleRoomService.tryStartCountdown()`:
```java
broadcast(roomId, "MATCH_COUNTDOWN", ...);   // (1) 브로드캐스트 먼저
ScheduledFuture<?> future = taskScheduler.schedule(...);  // (2) Future 생성
ScheduledFuture<?> prev = countdownFutures.putIfAbsent(roomId, future);  // (3) 원자적 등록 시도
if (prev != null) {
    future.cancel(false);  // (4) 중복이면 취소
}
```

문제: (1) 브로드캐스트가 (3) 원자적 등록보다 먼저 실행됨.
두 스레드가 동시에 진입하면 (1)에서 MATCH_COUNTDOWN이 2회 브로드캐스트된 후, (3)에서 하나만 등록되고 나머지 Future는 취소됨.
클라이언트는 MATCH_COUNTDOWN을 중복 수신하여 카운트다운 타이머 초기화 문제 발생 가능.

### 수정 방향

`putIfAbsent` 결과를 먼저 확인한 후 브로드캐스트:
```java
ScheduledFuture<?> future = taskScheduler.schedule(() -> startGame(roomId), ...);
ScheduledFuture<?> prev = countdownFutures.putIfAbsent(roomId, future);
if (prev != null) {
    future.cancel(false);
    return; // 이미 카운트다운 중 — 중복 브로드캐스트 없음
}
broadcast(roomId, "MATCH_COUNTDOWN", ...);
```

---

## BUG-007 [Migration] battle_record FK 참조 테이블명 불일치

- **우선순위**: P2 High
- **Title**: [Blockfall Battle / DB] blockfall-battle-schema.sql의 FK가 `users` 테이블 참조, JPA 엔티티는 `user` 테이블

- **담당 추천**: developer-backend

### 재현 단계

1. `blockfall-battle-schema.sql` Railway MySQL 콘솔에서 실행
2. 오류 메시지 확인

### 예상 결과

SQL 정상 실행, battle_record 테이블 생성 완료.

### 실제 결과 (코드 분석)

`blockfall-battle-schema.sql` L33:
```sql
CONSTRAINT fk_battle_record_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
```

기존 JPA 엔티티 `User.java`가 `@Table(name = "user")` 또는 기본 테이블명 `user`를 사용하는 경우, `users` 참조는 오류.

`BattleRecord.java` L30:
```java
@JoinColumn(name = "user_id", nullable = false, unique = true)
private User user;
```
JPA는 `user` 테이블(또는 프로젝트 설정에 따라 `users`)을 참조.

두 참조가 일치하지 않으면 SQL 실행 시 `ERROR 1215 (HY000): Cannot add foreign key constraint`.

### 수정 방향

1. 기존 `user` 테이블명을 확인하여 SQL FK를 맞게 수정.
2. 기존 테이블이 `user`이면: `REFERENCES user(id)` 로 수정.
3. `user`는 MySQL 예약어이므로 백틱 처리 필요: `REFERENCES \`user\`(id)`.

---

## 요약 테이블

| 버그 ID | 영역 | 우선순위 | 상태 | 한 줄 요약 | 담당 |
|---|---|---|---|---|---|
| BUG-001 | WebSocket / 게임오버 | P1 Critical | OPEN | Block Out 게임오버 신호 경로 미구현 | developer-backend |
| BUG-002 | 보안 | P1 Critical | CLOSED | `guest_` 빈 uuid 토큰 401 미반환 → UUID v4 정규식 검증으로 해결 | developer-backend |
| BUG-003 | 동시성 | P2 High | OPEN | REST join 시 sessionId=null → sessionRoomMap NPE 가능 | developer-backend |
| BUG-004 | 데이터 무결성 | P2 High | OPEN | 이탈자 전적 저장 방어 로직 없음 | developer-backend |
| BUG-005 | 보안 | P1 Critical | CLOSED | uuid 4자 미만 guestToken 허용 → BUG-002와 통합 해결 | developer-backend |
| BUG-006 | 동시성 | P2 High | OPEN | tryStartCountdown 중복 브로드캐스트 경쟁 조건 | developer-backend |
| BUG-007 | Migration | P2 High | OPEN | battle_record FK 참조 테이블명 불일치 (`users` vs `user`) | developer-backend |

---

## 차단 판정 (2026-04-27 갱신)

**BUG-002, BUG-005 CLOSED — 잔존 P1 Critical: BUG-001 1건**

### CLOSED 버그 (2건)
- BUG-002: UUID v4 정규식 검증 (`GUEST_TOKEN_PATTERN`) 추가로 해결. TC-SEC-02, TC-EDGE-02 코드 레벨 PASS.
- BUG-005: BUG-002와 동일 수정으로 통합 해결. TC-EDGE-02 전 패턴 PASS.

### OPEN P1 Critical (1건)
- **BUG-001**: Block Out 게임오버 신호 경로 미구현 — `handlePlayerFinished()` WebSocket 노출 없음. TC-GAME-02 실행 불가.

### OPEN P2 High (4건)
- BUG-003: sessionId=null NPE 위험
- BUG-004: 이탈자 전적 저장 방어 로직 없음
- BUG-006: tryStartCountdown 중복 브로드캐스트
- BUG-007: battle_record FK 테이블명 불일치

**차단 유지: BUG-001 P1 Critical 미해결. developer-backend에 BUG-001 우선 해결 요청.**
BUG-001 해결 후 TC-GAME-02 실행 및 P2 High 버그 순차 검증 진행 예정.
