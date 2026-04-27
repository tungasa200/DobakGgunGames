# Progress — developer-backend : Blockfall Battle

- 소유 팀원: developer-backend
- 기능 키: `blockfall-battle`
- 최종 업데이트: 2026-04-27 (빌드 성공 + main 머지 완료 — Railway DB 마이그레이션 대기)
- 기반 PRD: `docs/specs/blockfall-battle-prd.md` (CP1 완료)
- 계획서: `docs/progress/developer-backend-blockfall-battle-plan.md`

---

## 현재 상태

**`./gradlew build -x test BUILD SUCCESSFUL` + 커밋 1caad2b main 머지 완료**
**잔여: Railway DB 마이그레이션(`blockfall-battle-schema.sql`) + 통합 테스트**

---

## 구현 완료 파일 목록

### Migration SQL
- `backend/src/main/resources/db/blockfall-battle-schema.sql` — battle_room, battle_record DDL

### Entity (`com.dobakggun.entity.battle`)
- `BattleRoom.java` — battle_room 테이블 JPA 엔티티
- `BattleRecord.java` — battle_record 테이블 JPA 엔티티

### Repository
- `BattleRoomRepository.java` — findByRoomId, findByStatusIn, findFirstByStatus
- `BattleRecordRepository.java` — findByUserId (JPQL), findTopRankings (Pageable)

### DTO (`com.dobakggun.dto.battle`)
- `BattleJoinRequest.java` — POST /join 요청
- `BattleJoinResponse.java` — POST /join 응답
- `BattleRankingResponse.java` — GET /rankings 응답 (RankingEntry 내부 클래스 포함)
- `BattleEnvelope.java` — 서버→클라 공통 메시지 봉투 {type, timestamp, payload}
- `PlayerInfo.java` — 참가자 정보 공통 DTO
- `RoomStatePayload.java` — ROOM_STATE payload
- `GameStartedPayload.java` — GAME_STARTED payload
- `BoardUpdatePayload.java` — BOARD_UPDATE payload
- `GarbageAttackPayload.java` — GARBAGE_ATTACK payload
- `PlayerFinishedPayload.java` — PLAYER_FINISHED payload
- `GameResultPayload.java` — GAME_RESULT payload (ResultEntry 내부 클래스 포함)
- `QueuePositionPayload.java` — QUEUE_POSITION payload
- `PlayerLeftPayload.java` — PLAYER_LEFT payload
- `MatchCountdownPayload.java` — MATCH_COUNTDOWN / MATCH_COUNTDOWN_CANCELLED payload
- `BoardStateMessage.java` — 클라→서버 BOARD_STATE 메시지
- `ComboAttackMessage.java` — 클라→서버 COMBO_ATTACK 메시지

### Security
- `BattlePrincipal.java` — 배틀 전용 Principal (로그인 유저 + 게스트 통합)
- `BlockfallBattleHandshakeInterceptor.java` — /ws-battle JWT/guestToken 허용 인터셉터
- `StompChannelInterceptor.java` (수정) — battle 경로 bypass + BattlePrincipal 설정 로직 추가

### Config
- `BattleSchedulerConfig.java` — battleTaskScheduler Bean (poolSize=5)
- `WebSocketConfig.java` (수정) — /ws-battle 엔드포인트 추가 (기존 /ws 불변)
- `SecurityConfig.java` (수정) — /ws-battle/**, /api/blockfall-battle/** permitAll 추가

### Service
- `BattleRoomManager.java` — 인메모리 ConcurrentHashMap 기반 방/큐 상태 관리
- `BattleRoomService.java` — 매칭, 카운트다운, 게임 시작/종료, 보드 전파, 공격, 이탈 처리
- `BattleRankingService.java` — TOP 10 조회, 전적 UPSERT

### Controller
- `BlockfallBattleWebSocketController.java` — STOMP /board-state, /combo-attack, /leave, SessionDisconnectEvent
- `BattleRoomController.java` — POST /api/blockfall-battle/join, GET /api/blockfall-battle/rankings

### Test
- `DobakGgunGamesApplicationTests.java` (수정) — BattleRoomService, BattleRankingService @MockBean 추가

---

## 아키텍처 결정 사항

| 항목 | 결정 |
|---|---|
| 게스트 인증 | 방안 A — /ws-battle 신규 엔드포인트 + BlockfallBattleHandshakeInterceptor |
| Principal 타입 | BattlePrincipal (ChatPrincipal 재사용 안 함 — isGuest 필드 필요) |
| BattlePrincipal 설정 위치 | StompChannelInterceptor.handleConnect (session attributes의 isGuest 속성으로 구분) |
| 인메모리 상태 | BattleRoomManager (ConcurrentHashMap — Redis 미사용) |
| 카운트다운 타이머 | battleTaskScheduler (ThreadPoolTaskScheduler, poolSize=5) |
| OQ-3 (4인 만원 즉시 시작) | 즉시 카운트다운 만료 후 GAME_STARTED |
| EC-8 (ALREADY_IN_ROOM) | BattleRoomManager.findActiveRoomByPlayerId로 사전 체크 |
| BOARD_UPDATE 에코 방지 | convertAndSendToUser로 발신자 제외 개인 채널 전송 |
| SessionDisconnect | BattlePrincipal instanceof 체크로 /ws 연결과 구분 |
| 전적 저장 | 로그인 유저만, finishGame 내에서 rankingService.updateRecord 호출 |
| OQ-9 콤보 시퀀스 중복 방지 | 미구현 (Phase 2 TODO) |

---

## 신규 환경변수

**없음** — 기존 DB, Redis, JWT 설정 재활용.

---

## 버그 수정 이력 (2026-04-27)

| 버그 ID | 수정 내용 | 수정 파일 |
|---|---|---|
| BUG-001 | `/player-finished` WebSocket 핸들러 추가 + `handlePlayerFinished(roomId, playerId)` 오버로드 | `BlockfallBattleWebSocketController.java`, `BattleRoomService.java` |
| BUG-002 | guestToken UUID v4 정규식 검증 추가 (`GUEST_TOKEN_PATTERN`) | `BattleRoomController.java` |
| BUG-003 | `joinRoom()` sessionId null 체크 추가 (NPE 방지) | `BattleRoomManager.java` |
| BUG-004 | `PlayerSessionInfo.voluntaryLeft` 플래그 추가, `handleLeaveInternal`에서 설정, `finishGame` 필터 적용 | `BattleRoomManager.java`, `BattleRoomService.java` |
| BUG-005 | BUG-002와 동일 정규식으로 통합 해결 | `BattleRoomController.java` |
| BUG-006 | `tryStartCountdown` 브로드캐스트를 `putIfAbsent` 이후로 이동, 중복 시 early return | `BattleRoomService.java` |
| BUG-007 | `User.java`가 `@Table(name="users")`이므로 SQL FK 이미 올바름 — 수정 불필요 | (확인만) |

---

## 세션 이력 (2026-04-27 최종 세션)

| 단계 | 상태 | 비고 |
|---|---|---|
| B-1 API 계약 문서 | 완료 | `developer-backend-blockfall-battle-plan.md` |
| B-2 Entity / Repository / Migration SQL | 완료 | BattleRoom, BattleRecord, blockfall-battle-schema.sql |
| B-3 Service / Controller / Security | 완료 | BattleRoomManager, BattleRoomService, BattleRankingService, BlockfallBattleWebSocketController, BattleRoomController |
| BUG-001~006 수정 | 완료 | 상세 이력은 아래 버그 수정 이력 참조 |
| BUG-007 확인 | 완료 (수정 불필요) | User.java @Table(name="users") 확인 |
| OQ-1 (방안 A 확정) | 완료 | /ws-battle 신규 엔드포인트 + BlockfallBattleHandshakeInterceptor |
| OQ-3 (4인 즉시 만료) | 완료 | tryStartCountdown에서 4인 시 즉시 GAME_STARTED |
| `./gradlew build -x test` | 빌드 성공 | BUILD SUCCESSFUL |
| 커밋 1caad2b | main 머지 완료 | — |

---

## 블로커 / 질문

1. **Railway DB 마이그레이션**: `blockfall-battle-schema.sql` Railway MySQL 콘솔에서 수동 실행 필요 (프로덕션 반영 전 필수)
2. **SessionConnectEvent.getUser()**: StompChannelInterceptor에서 설정한 BattlePrincipal이 이벤트에서 정상 조회되는지 통합 테스트 필요

---

## API 계약 변경사항 (developer-frontend 통보 필요)

**BUG-001 수정 신규 WebSocket 발행 경로:**
- Path: `/app/blockfall-battle/room/{roomId}/player-finished`
- 발행 시점: 클라이언트가 Block Out(보드 상단 초과) 감지 시
- Body: `{}` (빈 오브젝트)
- 인증: BattlePrincipal 필요 (기존 WebSocket 연결 재사용)

---

## P3 잔여 기술 부채

- **BUG-004 `voluntaryLeft` 플래그**: 기능상 동작하나 `PlayerSessionInfo` 내 dead code 구조 개선 필요 — 다음 스프린트

---

## 통신 점검 세션 버그 수정 (2026-04-27)

| 버그 ID | 내용 | 수정 파일 |
|---|---|---|
| BUG-COMM-01 | `MatchCountdownPayload.seconds` → `secondsRemaining` 필드명 통일 | `MatchCountdownPayload.java`, `BattleRoomService.java` (3곳) |
| BUG-COMM-02 | `handleBoardState`에서 `PlayerSessionInfo.score` 미갱신 → 결과 화면 점수 모두 0 수정 | `BattleRoomService.java` |
| BUG-COMM-03 | `boolean isGuest` Jackson 직렬화 시 `guest` 키로 출력 → `@JsonProperty("isGuest")` 추가 | `PlayerInfo.java`, `BattleJoinResponse.java`, `GameResultPayload.ResultEntry` |
| BUG-COMM-04 | WS 재연결 시 방에서 즉시 제거 → grace period 15초 구현 (`handleExplicitLeave` 분리) | `BattleRoomService.java`, `BlockfallBattleWebSocketController.java` |

빌드 결과: `./gradlew build -x test` BUILD SUCCESSFUL

---

## 다음 세션에서 할 것

1. Railway MySQL 콘솔에서 `blockfall-battle-schema.sql` 실행 확인
2. 통합 테스트 (4인 게스트 혼합 시나리오, 재연결 grace period 검증)
3. qa-tester에게 BUG-COMM 시리즈 재검증 요청
