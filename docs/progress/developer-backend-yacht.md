# Progress — developer-backend : Yacht 멀티플레이

- 소유 팀원: developer-backend
- 기능 키: `yacht`
- 최종 업데이트: 2026-04-29 (세션 1 — 구현 완료)
- 기반 PRD: `docs/specs/yacht-prd.md` (CP1 승인 완료)
- API 계약: `docs/specs/yacht-api-contract.md`
- 계획서: `docs/progress/developer-backend-yacht-plan.md`

---

## 현재 상태

**세션 1 완료 — 구현 완료, Railway CI 배포 대기 중**

모든 레이어(Entity/Repository/DTO/Service/Controller) 구현 완료.
`compileJava` 성공 확인.
로컬 `./gradlew test`는 기존 RPS 때와 동일한 Windows 한글 경로 환경 이슈(ClassNotFoundException)로 실패.
Railway Linux 환경 CI에서는 정상 빌드/테스트 예상 (기존 RPS 패턴 동일).

**STOMP 공유 엔드포인트**: `/ws` (기존 채팅/RPS와 동일한 엔드포인트 사용) — developer-frontend 수정 완료.

---

## 구현 완료 파일 목록

### Entity (`com.dobakggun.entity.yacht`)
- `backend/src/main/java/com/dobakggun/entity/yacht/YachtRoomStatus.java` — WAITING/PLAYING/FINISHED enum
- `backend/src/main/java/com/dobakggun/entity/yacht/YachtRoom.java` — yacht_room JPA 엔티티
- `backend/src/main/java/com/dobakggun/entity/yacht/YachtParticipant.java` — yacht_participant JPA 엔티티
- `backend/src/main/java/com/dobakggun/entity/yacht/YachtScore.java` — yacht_score JPA 엔티티
- `backend/src/main/java/com/dobakggun/entity/yacht/YachtWin.java` — yacht_win JPA 엔티티 (CP1-2)

### Repository
- `backend/src/main/java/com/dobakggun/repository/YachtRoomRepository.java`
- `backend/src/main/java/com/dobakggun/repository/YachtParticipantRepository.java`
- `backend/src/main/java/com/dobakggun/repository/YachtScoreRepository.java`
- `backend/src/main/java/com/dobakggun/repository/YachtWinRepository.java`

### DTO (`com.dobakggun.dto.yacht`) — 18개
- `YachtMatchResponse.java` — POST /api/yacht/match 응답
- `YachtRoomResponse.java` — GET /api/yacht/room/{roomId} 응답
- `YachtParticipantDto.java`
- `YachtScoreboardDto.java`
- `YachtRollRequest.java` — /roll 요청
- `YachtScoreRequest.java` — /score 요청
- `YachtReadyRequest.java` — /ready 요청
- `YachtEnvelopeDto.java` — 서버→클라 공통 봉투
- `YachtRoomStatePayload.java`
- `YachtGameStartedPayload.java`
- `YachtTurnStatePayload.java`
- `YachtRollResultPayload.java`
- `YachtScoreRecordedPayload.java`
- `YachtTurnChangedPayload.java`
- `YachtRankingEntryDto.java`
- `YachtGameOverPayload.java`
- `YachtPlayerLeftPayload.java`
- `YachtRoomClosedPayload.java`

### Service
- `backend/src/main/java/com/dobakggun/service/YachtMatchService.java`
  - Redis 분산락 yacht:match:global (TTL 3초, 3회 재시도)
  - Rate limit yacht:rate:{userId} (10초 내 5회 → 429)
  - ALREADY_IN_ROOM 인메모리 + DB 두 레이어 확인
- `backend/src/main/java/com/dobakggun/service/YachtGameService.java`
  - ConcurrentHashMap 인메모리 방 상태 관리
  - joinRoom / setReady / startGame / rollDice / recordScore / leaveRoom
  - autoFillScores (연결 끊김 시 미기록 족보 0점 자동 처리)
  - finishGame / computeRankings / upsertWin (GAME_OVER + yacht_win upsert)
  - calculateScore (static, 12개 족보 전체)
  - sweepStaleRooms @Scheduled (10분 TTL)
  - closeStaleRoomsOnStartup @EventListener(ApplicationReadyEvent)

### Controller
- `backend/src/main/java/com/dobakggun/controller/YachtController.java`
  - POST /api/yacht/match
  - GET /api/yacht/room/{roomId}
- `backend/src/main/java/com/dobakggun/controller/YachtWebSocketController.java`
  - /join, /ready, /start, /roll, /score, /leave
  - SessionDisconnectEvent → yachtSubscribedRoomIds 참조

### 기존 파일 수정
- `backend/src/main/java/com/dobakggun/config/SecurityConfig.java`
  — `/api/yacht/**` authenticated() 추가
- `backend/src/test/java/com/dobakggun/DobakGgunGamesApplicationTests.java`
  — YachtMatchService, YachtGameService @MockBean 추가

### 테스트 신규 작성
- `backend/src/test/java/com/dobakggun/service/YachtScoreCalculatorTest.java`
  — 12개 족보 점수 계산 단위 테스트 (15개 케이스)
  — Full House Yacht(5개 동일) = 0 확인
  — FOUR_OF_A_KIND Yacht 인정 (face×4) 확인
- `backend/src/test/java/com/dobakggun/controller/YachtControllerSecurityTest.java`
  — 비인증 요청 차단 슬라이스 테스트

### 문서
- `docs/specs/yacht-api-contract.md` — API 계약 문서
- `docs/progress/developer-backend-yacht-plan.md` — 구현 계획서

---

## 테스트 결과

**로컬 환경**: `compileJava` 성공. 기존 RPS와 동일한 Windows 한글 경로 ClassNotFoundException 발생.
`compileTestJava`까지 성공, 클래스 파일 생성 확인.
Railway CI(Linux) 환경에서 통과 예상.

**단위테스트 요청**: qa-tester에게 아래 사항 검증 요청
1. `YachtScoreCalculatorTest` 15개 케이스 전체 통과 확인
2. `YachtControllerSecurityTest` 비인증 차단 4개 케이스 확인
3. 기존 `RpsGameServiceTest`, `HtmlSanitizerTest` 회귀 테스트 통과 확인

---

## 아키텍처 결정 사항

| 항목 | 결정 |
|---|---|
| 게임 상태 저장 | ConcurrentHashMap<String, YachtRoomState> 인메모리 (RPS 패턴 재사용) |
| 턴 타임아웃 | CP1-1: 없음 |
| 매칭 분산락 | Redis yacht:match:global, TTL 3초, 3회 재시도 |
| Rate Limit | yacht:rate:{userId}, 10초 내 5회 초과 → 429 |
| 세션 속성 키 | yachtSubscribedRoomIds (chat/rps와 완전 분리) |
| 준비/시작 방식 | CP1-3: /ready (비방장 토글) + /start (방장+전원준비 조건) |
| yacht_win | CP1-2: upsert (없으면 INSERT, 있으면 winCount++) |
| 점수 계산 | YachtGameService.calculateScore() static 메서드 (서버 전담) |
| 상단 보너스 | ONES~SIXES 6개 모두 기록 완료 시점에만 판정 |
| 방 TTL | 10분 @Scheduled 스윕 |

---

## CP1 확정 사항 준수 여부

- [x] CP1-1: 턴 타임아웃 없음 — 스케줄러 미구현
- [x] CP1-2: yacht_win 테이블 upsert (GAME_OVER 시 1위 winCount++)
- [x] CP1-3: /ready (비방장) + /start (방장+전원준비) STOMP 이벤트 구현

---

## 신규 환경변수

**없음.** 기존 REDIS_URL, JWT_SECRET, DB 설정 재활용.

---

## 블로커 / 질문

없음.

---

## 다음 세션 할 일

1. Railway CI `./gradlew test` 결과 확인 (사용자가 로그 공유)
2. YachtScoreCalculatorTest 15개 + YachtControllerSecurityTest 4개 통과 확인
3. qa-tester E2E 검증 결과 수신 후 버그 대응
4. OQ-3(잔존 1명 단독 승리) 정책 결정 후 필요 시 로직 추가

---

## developer-frontend에게: API 사용 가이드

**REST API**

```
POST /api/yacht/match
  Headers: Authorization: Bearer <JWT>
  Body: (없음)
  200: { roomId, status:"WAITING", playerCount, maxPlayers, created:false }
  201: { roomId, status:"WAITING", playerCount, maxPlayers, created:true }
  409: { error:"ALREADY_IN_ROOM", roomId }

GET /api/yacht/room/{roomId}
  Headers: Authorization: Bearer <JWT>
  200: { roomId, status, hostUserId, maxPlayers, currentTurnUserId, turnOrder, roundIndex, participants, scoreboard }
```

**STOMP 흐름**

1. POST /api/yacht/match → roomId 수신
2. WS 연결: /ws (SockJS + JWT)
3. /topic/yacht/room/{roomId} 구독
4. /app/yacht/room/{roomId}/join 발행 (body: {})
5. ROOM_STATE 수신 후 대기 화면 렌더링
6. 비방장: /ready { ready: true } 발행
7. 방장: 전원 준비 확인 후 /start {} 발행
8. GAME_STARTED 수신 → 게임 화면 전환
9. TURN_STATE 수신 → 현재 턴 플레이어 강조
10. 본인 턴: /roll { keptIndices: [] } → ROLL_RESULT 수신
11. 본인 턴: /score { scoreKey: "YACHT" } → SCORE_RECORDED + TURN_CHANGED
12. GAME_OVER → 결과 화면

**에러 처리**: /user/queue/errors 구독 → { code, message }

**scoreKey 12종**: ONES, TWOS, THREES, FOURS, FIVES, SIXES, CHOICE, FOUR_OF_A_KIND, FULL_HOUSE, LITTLE_STRAIGHT, BIG_STRAIGHT, YACHT (대문자)

---

## qa-tester에게: 검증 요청

Railway 배포 완료 후 아래 항목 검증 요청:

1. **단위테스트**: `./gradlew test` 통과 확인
   - YachtScoreCalculatorTest 15개 케이스
   - YachtControllerSecurityTest 비인증 차단
   - 기존 RpsGameServiceTest, HtmlSanitizerTest 회귀

2. **기능 테스트**:
   - 2인 매칭 → 준비 → 시작 → 게임 완주 (GAME_OVER 정상 도달)
   - 12개 족보 점수 계산 검증 (특히 Full House Yacht=0, FOUR_OF_A_KIND Yacht=face×4)
   - 상단 보너스 63점 이상 시 +35 반영 확인
   - 연결 끊김 시 미기록 족보 0점 자동 처리 + 게임 계속 진행
   - 비로그인 /api/yacht/match → 401/403 차단

3. **회귀 테스트**: 기존 채팅, RPS 기능 정상 동작 확인

---

세션 종료: 2026-04-29. 다음 세션: Railway CI 확인 + qa-tester 버그 대응.
