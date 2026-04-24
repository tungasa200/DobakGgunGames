# Progress — developer-backend : Online RPS

- 소유 팀원: developer-backend
- 기능 키: `online-rps`
- 최종 업데이트: 2026-04-24 (QA 버그 수정)
- 기반 PRD: `docs/specs/online-rps-prd.md` (CP1 승인 완료)
- 계획서: `docs/progress/developer-backend-online-rps-plan.md` (CP2 승인 완료)

---

## 현재 상태

**QA 버그 수정 완료 + 테스트 전체 통과 (2026-04-24 재확인)**

### BUG-1 수정 (HIGH) — OnlineRpsWebSocketController.java
- `sendError()` 메서드에서 `RpsEnvelopeDto` 래핑 제거
- 이전: `RpsEnvelopeDto{type:"ERROR", timestamp, payload:{code,message}}` 전송 → 클라이언트 에러 처리 무력화
- 이후: `Map.of("code", code, "message", message)` 직접 전송 (ChatController 패턴과 일치)
- 불필요해진 import(`RpsEnvelopeDto`, `Instant`, `ZoneOffset`, `DateTimeFormatter`)와 `now()` 메서드 함께 제거

### BUG-2 수정 (HIGH) — RpsRoomService.java
- `leaveRoom()` 내 `remaining == 1 && state.status == WAITING → shouldClose = true` 분기 제거
- 이전: 2인 WAITING 방에서 방장 퇴장 시 잔존 1인을 `ROOM_CLOSED(HOST_LEFT_ALONE)`으로 강제 퇴장 (PRD §8.2 위반)
- 이후: `remaining >= 1 && wasHost` → `HOST_CHANGED` + `ROOM_STATE` 브로드캐스트 (PRD §8.2 준수)
- `remaining == 0` → `ROOM_CLOSED(EMPTY)` 기존 로직 유지

---

## 구현 완료 + 테스트 통과 (2026-04-24 확인)**

`./gradlew clean test` → BUILD SUCCESSFUL
- DobakGgunGamesApplicationTests: 1개 통과
- OnlineRpsControllerSecurityTest: 4개 통과
- RpsGameServiceTest: 20개 통과
- HtmlSanitizerTest: 20개 통과

### 중요: gradle.properties 생성됨

`backend/gradle.properties` 신규 파일 커밋 필요.
Windows 한국어 환경(한글 경로)에서 Gradle @arg-file 인코딩 불일치 문제 해결을 위한 설정.
Railway CI에는 영향 없음 (Linux 환경에서는 MS949 설정이 UTF-8과 동일하게 동작).

---

## 구현 완료 파일 목록

### Entity (`com.dobakggun.entity.rps`)
- `backend/src/main/java/com/dobakggun/entity/rps/RpsChoice.java` — ROCK/PAPER/SCISSORS enum
- `backend/src/main/java/com/dobakggun/entity/rps/RpsResult.java` — WIN/LOSS/DRAW enum
- `backend/src/main/java/com/dobakggun/entity/rps/RoomStatus.java` — WAITING/PLAYING/FINISHED enum
- `backend/src/main/java/com/dobakggun/entity/rps/RpsRoom.java` — `rps_room` JPA 엔티티
- `backend/src/main/java/com/dobakggun/entity/rps/RpsRoundResult.java` — `rps_round_result` JPA 엔티티

### Repository
- `backend/src/main/java/com/dobakggun/repository/RpsRoomRepository.java`
  - `findAvailableRooms(status)` — WAITING+정원미달 방 FIFO 탐색
  - `findActiveRoomsByCreatedBy(userId, statuses)` — ALREADY_IN_ROOM 체크
  - `closeAllActiveRooms(finished, now, statuses)` — @PostConstruct 좀비 방 정리
  - `findStaleWaitingRooms(status, cutoff)` — TTL 스윕
- `backend/src/main/java/com/dobakggun/repository/RpsRoundResultRepository.java`
  - `findByRoom_IdOrderByRoundNumAscPlayerIdAsc(roomPkId)`
  - `findByRoomOrderByRoundNumAscPlayerIdAsc(room)`
  - `findByPlayer_IdOrderByPlayedAtDesc(playerId)`

### DTO (`com.dobakggun.dto.rps`)
- `MatchResponseDto.java` — POST /api/rps/match 응답
- `RpsEnvelopeDto.java` — 서버→클라 공통 메시지 봉투 {type, timestamp, payload}
- `RpsParticipantDto.java` — ROOM_STATE 내 참가자 항목
- `RpsRoomStateDto.java` — ROOM_STATE payload
- `RpsGameStartedDto.java` — GAME_STARTED payload
- `RpsPlayerResultDto.java` — ROUND_RESULT 내 플레이어별 결과
- `RpsRoundResultDto.java` — ROUND_RESULT payload
- `RpsMatchCountdownDto.java` — MATCH_COUNTDOWN / MATCH_COUNTDOWN_CANCELLED payload
- `RpsPlayerLeftDto.java` — PLAYER_LEFT payload
- `RpsHostChangedDto.java` — HOST_CHANGED payload
- `RpsRoomClosedDto.java` — ROOM_CLOSED payload
- `RpsChooseRequest.java` — /choose 요청 바디 (@NotNull choice)

### Service
- `backend/src/main/java/com/dobakggun/service/RpsGameService.java`
  - `judge(Map<Long,RpsChoice>)` — 다인 판정 (카드 종류 수 기반)
  - `judgeOne(RpsChoice, RpsChoice)` — 1:1 판정 헬퍼
  - `beats(RpsChoice, RpsChoice)` — 상성 판단
- `backend/src/main/java/com/dobakggun/service/RpsRoomService.java`
  - `ConcurrentHashMap<String, RpsRoomState>` 인메모리 방 상태 관리
  - `joinRoom(roomId, userId, nickname)` — WebSocket 세션 등록
  - `leaveRoom(roomId, userId, reason)` — 퇴장 처리 + PLAYER_LEFT + 방장 이전/방 해산
  - `recordChoice(roomId, userId, choice)` — 카드 선택 등록
  - `rematch(roomId, userId)` — 명시적 재도전 요청
  - `processRoundResult(roomId)` — 판정+ROUND_RESULT+DB저장+WAITING리셋
  - `startMatchCountdown(state)` / `cancelCountdown(state)` — 5초 타이머
  - `onRoundTimeout(roomId)` — 10초 타임아웃 (자동 랜덤선택)
  - `sweepStaleRooms()` — @Scheduled(fixedDelay=60000) TTL 스윕
  - `closeStaleRoomsOnStartup()` — @PostConstruct 좀비방 정리
- `backend/src/main/java/com/dobakggun/service/RpsMatchService.java`
  - `match(userId)` — 자동 매칭 (Redis 분산락 + Rate limit)
  - `AlreadyInRoomException` (inner class)

### Controller
- `backend/src/main/java/com/dobakggun/controller/OnlineRpsController.java`
  - `POST /api/rps/match` — 200/201/409/429/503
- `backend/src/main/java/com/dobakggun/controller/OnlineRpsWebSocketController.java`
  - `@MessageMapping("/rps/room/{roomId}/join")`
  - `@MessageMapping("/rps/room/{roomId}/choose")`
  - `@MessageMapping("/rps/room/{roomId}/rematch")`
  - `@MessageMapping("/rps/room/{roomId}/leave")`
  - `@EventListener SessionDisconnectEvent` — rpsSubscribedRoomIds 참조

### Config
- `backend/src/main/java/com/dobakggun/config/RpsSchedulerConfig.java` — ThreadPoolTaskScheduler Bean (poolSize=10, "rps-timer-")
- `backend/src/main/java/com/dobakggun/config/SecurityConfig.java` — `/api/rps/**` authenticated() 추가

### SQL 파일
- `backend/src/main/resources/db/online-rps-schema.sql` — 참조용 DDL
- `backend/src/main/resources/db/drop-admin-rsp.sql` — admin_rsp_play 정리 (사용자 수동 실행)

### 테스트
- `backend/src/test/java/com/dobakggun/service/RpsGameServiceTest.java`
  - 판정 로직 단위 테스트 (kinds=1/2/3, 경계값, 전체 9가지 1:1 조합)
- `backend/src/test/java/com/dobakggun/controller/OnlineRpsControllerSecurityTest.java`
  - @WebMvcTest 시큐리티 슬라이스 테스트
- `backend/src/test/java/com/dobakggun/DobakGgunGamesApplicationTests.java`
  - RpsMatchService, RpsRoomService @MockBean 추가

---

## 제거된 파일 (구 admin-rsp)

- `AdminRspController.java`
- `AdminRspService.java`
- `AdminRspPlay.java` (entity)
- `RspChoice.java` (entity)
- `RspResult.java` (entity)
- `AdminRspPlayRepository.java`
- `dto/rsp/RspPlayRequest.java`
- `dto/rsp/RspPlayResponse.java`
- `dto/rsp/RspStatsResponse.java`
- `test/.../AdminRspControllerSecurityTest.java`
- `test/.../AdminRspPlayRepositoryTest.java`
- `test/.../AdminRspServiceTest.java`

---

## 아키텍처 결정 사항 (CP2 계획서 확정 내용)

| 항목 | 결정 |
|---|---|
| 참가자 상태 저장 | 서버 인메모리 ConcurrentHashMap (단일 인스턴스) |
| 타이머 | ThreadPoolTaskScheduler Bean (poolSize=10) |
| MATCH_COUNTDOWN | 1회 브로드캐스트 + 단일 ScheduledFuture(5초) |
| 동시성 — 매칭 | Redis SETNX 분산락 (rps:match:global, TTL 3초) |
| 동시성 — 방 상태 | synchronized(state) 블록 |
| 방 TTL | WAITING 상태 10분 → @Scheduled 스윕 |
| 재도전 | 기존 rps_room row 재사용, ROUND_RESULT 후 자동 카운트다운 재시작 |
| Rate Limit | Redis INCR rps:rate:{userId}, 10초 내 5회 초과 → 429 |
| 매칭 탐색 정렬 | created_at ASC (FIFO — OQ-11 결정) |
| 4인 꽉 참 | 기존 타이머 유지 (즉시 시작 안 함 — OQ-10 결정) |
| autoPicked 추적 | RpsRoomState.voluntaryChoosers Set<Long> 별도 관리 |

---

## 사용자에게 요청

### Railway 배포 후 수동 실행 필요 (선택 사항)
```sql
-- backend/src/main/resources/db/drop-admin-rsp.sql
DROP TABLE IF EXISTS admin_rsp_play;
```
운영 확인 후 Railway MySQL 콘솔에서 실행.

---

## 신규 환경변수

**없음.** 기존 REDIS_URL, JWT_SECRET, DB 설정 재활용.

---

## 블로커 / 질문

없음.

---

## 다음 세션

1. developer-frontend에게 API 사용 가이드 전달
2. qa-tester에게 검증 요청
3. Railway 배포 후 drop-admin-rsp.sql 수동 실행 (필요 시)
