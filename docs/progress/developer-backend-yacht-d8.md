# developer-backend — 야추 d8 모드 구현

## 일자
2026-05-10

## 산출물

### 신규 파일
- `entity/yacht/YachtDiceType.java` — D6/D8 enum
- `dto/yacht/YachtMatchRequest.java` — `{ diceType: "D6" | "D8" }`
- `service/yacht/YachtScoreRules.java` — 룰셋 인터페이스
- `service/yacht/D6Rules.java` — 기존 야추 룰
- `service/yacht/D8Rules.java` — 8면 룰 (ONES~EIGHTS, 보너스 108점, 4롤, 스트레이트 셋 확장)
- `service/yacht/YachtScoreRulesFactory.java` — diceType → 룰셋 매핑
- `resources/db/yacht-record-d8-migration.sql` — 마이그레이션 SQL

### 수정 파일
- `entity/yacht/YachtRoom.java` — `diceType` 필드 추가
- `entity/yacht/YachtRecord.java` — `diceType` 필드 + UNIQUE(user_id, dice_type)로 변경
- `repository/YachtRoomRepository.java` — `findAvailableRooms(status, diceType)` 추가
- `repository/YachtRecordRepository.java` — `findByUserIdAndDiceType` 등 모드별 메서드
- `service/YachtGameService.java` — `YachtRoomState.diceType`, `rollDice`/`recordScore`/`isGameOver` 룰셋 분기, `broadcastRoomState`/`buildRoomSnapshot`/`startGame` payload에 diceType 포함
- `service/YachtMatchService.java` — `match(userId, diceType)` 시그니처 변경, 같은 모드 풀끼리만 합류
- `service/YachtRankingService.java` — `getTopRankings()` D6/D8 분리 응답, `updateRecord(userId, isWinner, diceType)` 분기
- `controller/YachtController.java` — `POST /api/yacht/match` 바디에 diceType 검증, `GET /rankings`/`/rooms/status` 모드별 분리, `INVALID_DICE_TYPE` 400 처리
- `dto/yacht/YachtMatchResponse.java` — `diceType` 필드
- `dto/yacht/YachtRankingResponse.java` — D6/D8 분리 응답
- `dto/yacht/YachtRoomStatePayload.java` — `diceType`
- `dto/yacht/YachtGameStartedPayload.java` — `diceType`
- `test/.../YachtScoreCalculatorTest.java` — D6/D8 양쪽 룰셋 테스트
- `test/.../YachtControllerSecurityTest.java` — `userPrincipal(Long)` 헬퍼로 `@AuthenticationPrincipal Long` 추출 가능하게 변경 (기존 `@WithMockUser`는 String principal이라 401 리턴함). `YachtRankingService` 누락된 MockBean도 추가

## 테스트 결과
`./gradlew test` BUILD SUCCESSFUL — 79개 테스트 통과.

## 사용자 후속 작업 (사용자 직접 실행 필요)
**Railway MySQL에서 다음 SQL 실행**:
- `backend/src/main/resources/db/yacht-record-d8-migration.sql`
  - `yacht_record.dice_type` 컬럼 추가
  - 기존 UNIQUE(user_id) 인덱스 → UNIQUE(user_id, dice_type)로 교체
  - 기존 데이터는 자동으로 `D6`으로 채워짐

`yacht_room.dice_type`은 사용자가 이미 사전에 추가했음 — 추가 작업 없음.

환경변수 추가 없음.

## 주요 결정 사항
- `D8Rules.upperBonusValue()`도 35로 동일 (PRD §의문점 OQ-1 양쪽 35로 시작)
- D8 LITTLE_STRAIGHT 셋: {1234,2345,3456,4567,5678}, BIG_STRAIGHT: {12345,23456,34567,45678}
- D8 totalScoreKeys=14 → totalRounds = participants × 14
- 매칭 시 같은 사용자가 D6 방에 있으면 D8 매칭 시도해도 ALREADY_IN_ROOM 반환 (한 사용자 한 방 원칙 유지)
- `YachtControllerSecurityTest`의 `@WithMockUser` → `userPrincipal(Long)` 헬퍼로 교체. 프로덕션 `JwtAuthenticationFilter`(`security/JwtAuthenticationFilter.java:33-35`)가 principal로 Long을 주입하는 것과 동일하게 함.

## frontend 인계 사항
- `POST /api/yacht/match` 바디에 `diceType` 필수
- 잘못된 diceType은 400 `{ "error": "INVALID_DICE_TYPE" }`
- `GET /api/yacht/rankings` 응답 모양은 `YachtRankingResponse` 새 구조 참고 (D6/D8 분리)
- `GET /api/yacht/rooms/status` 응답도 모드별 분리
- `GET /api/yacht/room/{id}` 응답에 `diceType` 포함
- WebSocket `ROOM_STATE` / `GAME_STARTED` 페이로드에 `diceType` 포함
