# 구현 계획서 — developer-backend : Online RPS (CP2)

- 작성자: developer-backend
- 작성일: 2026-04-24
- 상태: **CP2 — 사용자 승인 대기**
- 기반 PRD: `docs/specs/online-rps-prd.md` (CP1 승인 완료)
- 참조 progress:
  - `docs/progress/developer-backend-rsp-game.md` (제거 대상 파악)
  - `docs/progress/developer-backend-chat-testroom.md` (재활용 패턴)

---

## 1. 제거 대상 파일 목록

### 1.1 삭제할 Java 파일 (7개)

| 파일 경로 | 삭제 이유 |
|---|---|
| `backend/src/main/java/com/dobakggun/controller/AdminRspController.java` | ADMIN 전용 1인 RSP 컨트롤러 → Online RPS로 전면 교체 |
| `backend/src/main/java/com/dobakggun/service/AdminRspService.java` | 1인 vs 컴퓨터 판정 서비스 → 불필요 |
| `backend/src/main/java/com/dobakggun/entity/AdminRspPlay.java` | `admin_rsp_play` 테이블 엔티티 → ddl-auto=update이므로 삭제 시 테이블은 남음, 수동 DROP 필요 |
| `backend/src/main/java/com/dobakggun/entity/RspChoice.java` | 구 RSP ENUM → 새 `RpsChoice.java`로 대체 (패키지 및 명칭 변경) |
| `backend/src/main/java/com/dobakggun/entity/RspResult.java` | 구 RSP ENUM → 새 `RpsResult.java`로 대체 |
| `backend/src/main/java/com/dobakggun/repository/AdminRspPlayRepository.java` | `admin_rsp_play` 리포지토리 → 불필요 |
| `backend/src/main/java/com/dobakggun/dto/rsp/RspPlayRequest.java` | 구 DTO (dto/rsp 디렉토리 전체 삭제) |
| `backend/src/main/java/com/dobakggun/dto/rsp/RspPlayResponse.java` | 구 DTO |
| `backend/src/main/java/com/dobakggun/dto/rsp/RspStatsResponse.java` | 구 DTO |

> dto/rsp 디렉토리 전체(3개 파일) 삭제 후 새 Online RPS DTO는 동일 패키지명 `dto/rps/`를 재사용.

### 1.2 SecurityConfig에서 제거할 라인

`backend/src/main/java/com/dobakggun/config/SecurityConfig.java` 현재 64~69행:

```java
// 어드민 전용 — ADMIN role 필수
.requestMatchers("/api/admin/**").hasRole("ADMIN")
```

위 규칙은 `/api/admin/rsp/**` 를 포함하므로 `/api/admin/rsp/**` 전용 별도 라인이 없다.
따라서 SecurityConfig에서 **RPS 전용 규칙 제거는 해당 없음** — 기존 `/api/admin/**` 라인이
AdminRspController만 커버하던 것이 아니므로 그대로 유지한다.
신규 `POST /api/rps/**` 에 대한 `authenticated()` 규칙을 추가하는 것이 유일한 변경이다.

### 1.3 DB 정리 파일 (신규 작성)

| 파일 경로 | 내용 |
|---|---|
| `backend/src/main/resources/db/drop-admin-rsp.sql` | `DROP TABLE IF EXISTS admin_rsp_play;` — 사용자가 Railway MySQL에 수동 실행 |

---

## 2. 신규 파일 목록

총 신규 생성 파일: **22개**

### 2.1 Entity (`com.dobakggun.entity.rps`) — 5개

| 파일 경로 | 역할 |
|---|---|
| `backend/src/main/java/com/dobakggun/entity/rps/RpsRoom.java` | `rps_room` 테이블 JPA 엔티티. id, roomId(8자리), name, status, maxPlayers, createdBy(FK), createdAt, closedAt 컬럼. |
| `backend/src/main/java/com/dobakggun/entity/rps/RpsRoundResult.java` | `rps_round_result` 테이블 JPA 엔티티. room(FK), roundNum, player(FK), choice, autoPicked, result, playedAt 컬럼. |
| `backend/src/main/java/com/dobakggun/entity/rps/RpsChoice.java` | ROCK / PAPER / SCISSORS enum |
| `backend/src/main/java/com/dobakggun/entity/rps/RpsResult.java` | WIN / LOSS / DRAW enum |
| `backend/src/main/java/com/dobakggun/entity/rps/RoomStatus.java` | WAITING / PLAYING / FINISHED enum |

### 2.2 Repository — 2개

| 파일 경로 | 역할 |
|---|---|
| `backend/src/main/java/com/dobakggun/repository/RpsRoomRepository.java` | `RpsRoom` Spring Data JPA 리포지토리. `findFirstByStatusAndCurrentPlayersLessThanOrderByCreatedAtDesc`, `findByRoomId`, `findActiveRoomByUserId` 등 쿼리 메서드 포함. |
| `backend/src/main/java/com/dobakggun/repository/RpsRoundResultRepository.java` | `RpsRoundResult` Spring Data JPA 리포지토리. 라운드 결과 저장 및 플레이어별 조회용. |

### 2.3 DTO (`com.dobakggun.dto.rps`) — 9개

| 파일 경로 | 역할 |
|---|---|
| `backend/src/main/java/com/dobakggun/dto/rps/MatchResponseDto.java` | `POST /api/rps/match` 성공 응답. roomId, status, playerCount, maxPlayers, created 필드. |
| `backend/src/main/java/com/dobakggun/dto/rps/RpsEnvelopeDto.java` | 서버→클라 공통 메시지 봉투. type(String), timestamp(String), payload(Object) 필드. 모든 브로드캐스트에 사용. |
| `backend/src/main/java/com/dobakggun/dto/rps/RpsRoomStateDto.java` | `ROOM_STATE` 이벤트 payload. roomId, name, status, hostUserId, maxPlayers, participants(List) 포함. |
| `backend/src/main/java/com/dobakggun/dto/rps/RpsParticipantDto.java` | ROOM_STATE 내 참가자 항목. userId, nickname, isHost 필드 (ready 필드는 CP1-4 결정으로 제거). |
| `backend/src/main/java/com/dobakggun/dto/rps/RpsGameStartedDto.java` | `GAME_STARTED` 이벤트 payload. roomId, roundNum, deadlineAt, timeoutSeconds, participantUserIds. |
| `backend/src/main/java/com/dobakggun/dto/rps/RpsRoundResultDto.java` | `ROUND_RESULT` 이벤트 payload. roomId, roundNum, results(List<RpsPlayerResultDto>). |
| `backend/src/main/java/com/dobakggun/dto/rps/RpsPlayerResultDto.java` | ROUND_RESULT 내 플레이어별 결과. userId, nickname, choice, autoPicked, result. |
| `backend/src/main/java/com/dobakggun/dto/rps/RpsMatchCountdownDto.java` | `MATCH_COUNTDOWN` / `MATCH_COUNTDOWN_CANCELLED` 이벤트 payload. roomId, secondsRemaining, startAt 또는 reason. |
| `backend/src/main/java/com/dobakggun/dto/rps/RpsChooseRequest.java` | `/app/rps/room/{roomId}/choose` 요청 바디. @NotNull choice(RpsChoice enum). |

### 2.4 Service — 3개

| 파일 경로 | 역할 |
|---|---|
| `backend/src/main/java/com/dobakggun/service/RpsMatchService.java` | `POST /api/rps/match` 처리. Redis 분산락 획득 → WAITING 방 탐색 → 자리 예약 또는 신규 방 생성 → 응답 반환. Rate limit(10초 내 5회 초과 → 429) 포함. |
| `backend/src/main/java/com/dobakggun/service/RpsRoomService.java` | 방 인메모리 상태 관리. `ConcurrentHashMap<String, RpsRoomState>`로 참가자 목록/라운드/선택 현황 관리. MATCH_COUNTDOWN 타이머(`ScheduledFuture`) 관리. 방 TTL 자동 close (10분). 브로드캐스트 헬퍼 포함. |
| `backend/src/main/java/com/dobakggun/service/RpsGameService.java` | 게임 로직 담당. 선택 접수, 전원 선택 여부 확인, 10초 타임아웃 스케줄, 결과 판정(카드 종류 수 기반), 랜덤 자동선택, DB 저장(`RpsRoundResultRepository`), 방 WAITING 리셋. |

### 2.5 Controller — 2개

| 파일 경로 | 역할 |
|---|---|
| `backend/src/main/java/com/dobakggun/controller/OnlineRpsController.java` | `@RestController`. `POST /api/rps/match` 단일 엔드포인트. `@AuthenticationPrincipal Long userId` 추출 후 `RpsMatchService` 위임. |
| `backend/src/main/java/com/dobakggun/controller/OnlineRpsWebSocketController.java` | `@Controller`. `/app/rps/room/{roomId}/join`, `/choose`, `/rematch`, `/leave` `@MessageMapping` 처리. `SessionDisconnectEvent` `@EventListener` 포함(세션 속성 `rpsSubscribedRoomIds` 참조). |

### 2.6 기타 (설정 수정 + SQL) — 1개

| 파일 경로 | 역할 |
|---|---|
| `backend/src/main/resources/db/online-rps-schema.sql` | `rps_room` + `rps_round_result` 참조용 DDL. 실제 적용은 ddl-auto=update. 인덱스 정의 포함. |

---

## 3. 기존 파일 수정 목록

총 기존 수정 파일: **1개** (최소화 원칙 준수)

### 3.1 `SecurityConfig.java` — 1줄 추가

```java
// Online RPS API — 로그인 유저 전체 허용 (ADMIN/USER/FRIEND)
.requestMatchers("/api/rps/**").authenticated()
```

추가 위치: 채팅 API 규칙 블록 바로 아래, `anyRequest().permitAll()` 바로 위.
`/api/admin/**` hasRole("ADMIN") 라인은 변경 없음 (AdminRspController 전용 규칙이 아니므로).

### 3.2 `StompChannelInterceptor.java` — 수정 불필요

현재 인터셉터는 두 가지 패턴만 명시적으로 검사한다:
- `ROOM_TOPIC_PATTERN` : `^/topic/room/([a-z0-9]{8})$` (채팅 구독)
- `ROOM_APP_PATTERN`   : `^/app/chat/([a-z0-9]{8})$` (채팅 발행)

RPS 경로(`/topic/rps/room/{roomId}`, `/app/rps/room/{roomId}/*`)는 두 패턴 모두 매칭되지 않으므로
`handleSubscribe` / `handleSend`는 `return true`로 통과한다.
CONNECT 인증 로직(JWT userId null 체크 → 연결 차단)은 RPS도 동일하게 적용되므로 추가 분기가 불필요하다.

> 결론: `StompChannelInterceptor.java` 변경 없음.

### 3.3 `WebSocketConfig.java` — 수정 불필요

`/ws` 엔드포인트, `/topic`/`/queue` 브로커, `/app` prefix, `JwtHandshakeInterceptor`가 이미 `/rps` 네임스페이스를 수용한다.
별도 등록 없이 재사용 가능.

> 결론: `WebSocketConfig.java` 변경 없음.

### 3.4 `GlobalExceptionHandler.java` — 수정 불필요

기존 `ResponseStatusException`, `HttpMessageNotReadableException`, `MethodArgumentNotValidException`
핸들러가 Online RPS 예외를 모두 포괄한다. RSP 전용 핸들러는 없었으므로 제거 대상도 없다.

> 결론: `GlobalExceptionHandler.java` 변경 없음.

---

## 4. 아키텍처 결정 사항

### 4.1 참가자 상태 저장 — ConcurrentHashMap (서버 인메모리)

**결정: Java `ConcurrentHashMap<String, RpsRoomState>` 사용**

이유:
- 서버 단일 인스턴스(Railway 단일 dyno) 가정 하에 분산 일관성 불필요.
- 타이머/선택 상태는 1라운드 수 초 동안만 유효하며, 서버 재시작 시 날아가도 무방(방 자동 close로 처리).
- Redis HashMap 대비 레이턴시 0, 직렬화 비용 없음, 구현 단순.
- 채팅 참가자 상태도 Redis(방 메타)와 인메모리(구독 세션)를 혼용하는 패턴과 일치.

`RpsRoomState` 인메모리 구조(내부 클래스 또는 별도 클래스):
```
String roomId
Long hostUserId
List<RpsParticipant> participants  // 입장 순서 유지 (방장 이전 시 첫 번째 잔존자가 신규 방장)
int currentRoundNum
Map<Long, RpsChoice> roundChoices  // userId → 선택 (null이면 미선택)
ScheduledFuture<?> countdownFuture // MATCH_COUNTDOWN 타이머
ScheduledFuture<?> roundTimeoutFuture // 10초 라운드 타임아웃
```

### 4.2 타임아웃 스케줄러 — ThreadPoolTaskScheduler (단일 인스턴스)

**결정: Spring `ThreadPoolTaskScheduler` Bean 1개 공유**

이유:
- `ScheduledExecutorService` 직접 생성 대비 Spring 생명주기 관리(graceful shutdown) 자동 처리.
- `@Scheduled`는 고정 주기 태스크 전용이라 동적 `ScheduledFuture` 반환이 불가 → 타이머 취소 불가.
- `ThreadPoolTaskScheduler.schedule(Runnable, Instant)` → `ScheduledFuture<?>`를 반환하므로
  "전원 선택 시 타임아웃 취소(`future.cancel(false)`)" 패턴 구현 가능.
- 풀 크기: 방 최대 동시 수를 고려하여 기본값 5~10으로 설정(설정 파일에서 조정 가능).

```java
// RpsSchedulerConfig.java (또는 RpsRoomService 내부 초기화)
@Bean
public ThreadPoolTaskScheduler rpsTaskScheduler() {
    ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
    scheduler.setPoolSize(10);
    scheduler.setThreadNamePrefix("rps-timer-");
    return scheduler;
}
```

### 4.3 카운트다운 처리 — ScheduledFuture + 브로드캐스트

**결정: MATCH_COUNTDOWN는 1회 브로드캐스트 + 단일 ScheduledFuture(5초 후 GAME_STARTED 자동 실행)**

이유:
- 카운트다운 숫자를 1초 단위로 계속 브로드캐스트하는 방식(5번 전송)은 불필요.
- 클라이언트가 `secondsRemaining=5`와 `startAt` 타임스탬프를 받아 로컬 카운트다운 UI를 렌더링.
- 서버는 5초 후 `future`가 발화 → `GAME_STARTED` 브로드캐스트 + 방 상태 PLAYING.
- 취소 시 `future.cancel(false)` 후 `MATCH_COUNTDOWN_CANCELLED` 브로드캐스트.

### 4.4 동시성 제어 — Redis 분산락 (POST /api/rps/match) + synchronized (인메모리 방 상태)

**결정: 두 레이어를 분리하여 각각 다른 방식 사용**

**매칭 레이어 (RpsMatchService):**
Redis SETNX 기반 분산락 `rps:match:global` (TTL 3초) 사용.
- DB의 WAITING 방 탐색 + `currentPlayers++` UPDATE를 원자적으로 처리.
- 락 획득 실패(3회 재시도, 100ms 간격) → `503 MATCH_UNAVAILABLE` 반환.

**방 상태 레이어 (RpsRoomService):**
`ConcurrentHashMap` + 개별 `RpsRoomState` 에 대한 `synchronized(state)` 블록.
- 동시 `/choose`, `/join`, `/leave` 처리 시 선택 중복/카운트 오류 방지.
- DB 접근이 없으므로 Redis 락 불필요.

### 4.5 OQ-3 방 TTL — WAITING 상태 10분 자동 close

**결정: WAITING 상태 방을 10분간 아무도 `/join`하지 않으면 자동 FINISHED 처리**

구현 방법:
- `RpsRoomService` 내 `@Scheduled(fixedDelay = 60_000)` 스윕 태스크.
- `createdAt + 10분 < now()` 이고 상태가 WAITING이며 참가자 0명인 방을 FINISHED로 전환.
- DB row의 `status=FINISHED`, `closedAt` 기록. 브로드캐스트는 불필요(아무도 없으므로).
- 인메모리 `RpsRoomState`도 제거.

### 4.6 OQ-5 재도전 — 현 방 재사용 + MATCH_COUNTDOWN 재시작

**결정: rps_room row를 재사용 (신규 row 생성 안 함), 자동 카운트다운 재시작**

구현 방법:
1. `ROUND_RESULT` 브로드캐스트 직후 서버가 방 상태를 WAITING으로 자동 리셋.
2. `ROOM_STATE` 브로드캐스트 (참가자 목록 유지, roundChoices 초기화).
3. 잔존 참가자가 2명 이상이면 즉시 MATCH_COUNTDOWN 재시작 (5초 카운트다운).
4. `/rematch` WebSocket 이벤트는 명시적 재도전 요청용으로 유지하되, 실제로는 "현재 라운드 결과 확인 후 방에서 나가지 않은 상태" 그 자체가 재도전 의사 표시.
- `rps_round_result`에 `round_num`을 1씩 증가시켜 같은 `room_id`에 여러 라운드 누적 저장.
- PRD의 "rematch: 방장만" 규칙은 이 자동 시작 방식에서 사실상 불필요하나, `/rematch` 엔드포인트는 스펙 준수를 위해 유지(즉시 MATCH_COUNTDOWN 재시작 트리거로 사용).

### 4.7 OQ-9 Rate Limit — Redis 카운터 기반 간단 구현

**결정: MVP에 간단히 구현. 10초 내 5회 초과 시 429 반환.**

구현 방법:
- Redis 키 `rps:rate:{userId}` — 값: 요청 횟수, TTL: 10초.
- `RpsMatchService.match()` 진입 시 `INCR rps:rate:{userId}` → 1이면 `EXPIRE 10` → 5 초과 시 429.
- Lua 스크립트 or `INCR` + `EXPIRE` 순서로 구현(원자성 보장 위해 Lua 스크립트 권장).

### 4.8 OQ-10 카운트다운 중 4인 꽉 찼을 때 — 타이머 계속 유지

**결정: 4인 꽉 차도 기존 타이머를 유지 (즉시 시작 안 함)**

이유:
- 즉시 시작 시 "방금 들어왔는데 바로 시작?" UX 혼란.
- 카운트다운 UI를 이미 보고 있는 기존 참가자에게도 일관성 유지.
- 4인 꽉 찼을 때 새 매칭 유입만 차단하면 충분(`POST /api/rps/match`에서 `maxPlayers` 체크).
- 단, 4인 풀 진입 시 `ROOM_STATE` 브로드캐스트로 클라이언트가 "정원 마감" 표시 가능.

### 4.9 OQ-11 매칭 탐색 정렬 — 오래된 방 FIFO (ASC)

**결정: `created_at ASC` — 가장 오래 대기 중인 방 우선 배정**

이유:
- 최신순(DESC)은 새 방만 계속 채워지고 오래된 빈 방이 방치될 수 있음.
- FIFO가 대기 시간 편차 최소화에 유리.

---

## 5. 의존성 추가 필요 여부

`build.gradle`에 **추가 의존성 없음**.

현재 `build.gradle`에 이미 존재하는 의존성으로 모든 구현 가능:
- `spring-boot-starter-websocket` — STOMP WebSocket
- `spring-boot-starter-data-redis` — Redis 분산락/Rate limit
- `spring-boot-starter-data-jpa` — rps_room / rps_round_result 엔티티
- `spring-boot-starter-security` — JWT 인증
- `spring-boot-starter-validation` — DTO @Valid

`ThreadPoolTaskScheduler`는 `spring-boot-starter-web` 안에 포함된 `spring-context`에서 제공.

---

## 6. 리스크 / 주의사항

### 6.1 채팅 경로와 RPS 경로 분리

`StompChannelInterceptor`의 `ROOM_TOPIC_PATTERN`(`/topic/room/`)과
RPS 경로(`/topic/rps/room/`)는 문자열 수준에서 중복 없음.
`OnlineRpsWebSocketController`의 `@MessageMapping("/rps/room/{roomId}/...")`도
채팅의 `@MessageMapping("/chat/{roomId}")`와 완전히 다른 경로.
별도 분기나 필터 추가 없이 네임스페이스 격리 달성.

### 6.2 SessionDisconnectEvent 충돌 방지

`ChatController.handleDisconnect`는 `subscribedRoomIds`(채팅 키)를 읽고,
`OnlineRpsWebSocketController.handleDisconnect`는 `rpsSubscribedRoomIds`(RPS 전용 키)를 읽는다.
두 리스너가 동일 세션의 Disconnect 이벤트를 각각 처리하되 세션 속성 키가 달라 충돌 없음.

### 6.3 ddl-auto=update는 DROP 안 함

`AdminRspPlay` 엔티티 삭제 후에도 `admin_rsp_play` 테이블이 DB에 남는다.
`drop-admin-rsp.sql` 을 사용자가 Railway MySQL 콘솔에서 수동 실행해야 한다.
타이밍: 새 Online RPS 배포 후, 운영 확인 완료 후에 실행 권장 (롤백 대비).

### 6.4 Race Condition — 동시 매칭

Redis 분산락으로 1차 방지. 락 TTL을 3초로 짧게 유지해 락 홀더 크래시 시 자동 해제.
100% 방지 불가: 동시 생성된 빈 방 2개가 생길 수 있으나 OQ-3 TTL 스윕으로 정리됨.

### 6.5 인메모리 상태 vs DB 불일치

서버 재시작 시 `ConcurrentHashMap`의 방 상태가 날아가지만 DB의 `rps_room.status`는 남는다.
재시작 후 기존 PLAYING/WAITING 방들은 실제로 아무도 없는 좀비 row가 된다.
대응: 애플리케이션 시작 시 (`@PostConstruct`) DB에서 WAITING/PLAYING 상태 방을 모두 FINISHED로 일괄 전환.

### 6.6 테스트 전략

기존 패턴(`AdminRspServiceTest` 단위 테스트 + `AdminRspControllerSecurityTest` 슬라이스 테스트)을 동일하게 적용:
- `RpsGameServiceTest` — 판정 로직 단위 테스트 (카드 종류 수 기반, 경계값 포함)
- `OnlineRpsControllerSecurityTest` — `/api/rps/match` 인증 슬라이스 테스트
- 기존 `DobakGgunGamesApplicationTests` — `@MockBean` 추가 필요 여부 확인 (RpsRoomService, RpsRoomRepository)

---

## 7. 구현 순서 (승인 후 레이어별 진행)

```
1. Entity (5개) — rps 패키지 신규 생성
2. Repository (2개)
3. DTO (9개)
4. Config 수정 — ThreadPoolTaskScheduler Bean, SecurityConfig 1줄 추가
5. SQL 파일 2개 — online-rps-schema.sql, drop-admin-rsp.sql
6. 구 RSP 파일 삭제 (9개 Java 파일)
7. Service (3개) — RpsMatchService → RpsRoomService → RpsGameService
8. Controller (2개) — OnlineRpsController → OnlineRpsWebSocketController
9. 테스트 작성
10. ./gradlew test 통과 확인
```

---

## 요약 수치

| 분류 | 수 |
|---|---|
| 제거 대상 Java 파일 | 9개 |
| 신규 생성 파일 | 22개 (Java 21 + SQL 2) |
| 기존 수정 파일 | 1개 (SecurityConfig.java 1줄 추가) |
| 의존성 추가 | 없음 |

---

> 위 계획대로 구현 시작을 승인해 주세요.
