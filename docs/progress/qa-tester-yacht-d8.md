# qa-tester — 야추 D8 모드 검증

## 일자
2026-05-10

## 검증 범위
- PRD: `docs/specs/yacht-d8-mode-prd.md`
- API 계약: `docs/specs/yacht-api-contract.md` §d8 모드 분기
- 디자인: `docs/design/yacht-d8-design.md`
- 백엔드 변경: `docs/progress/developer-backend-yacht-d8.md`
- 프론트 변경 커밋: 61bf568 (17개 파일, +1509/-135)

---

## 정적 체크 결과

### 1. `./gradlew test` (백엔드)
- **결과: BUILD SUCCESSFUL**
- 전체 79개 테스트 PASS, 실패/에러 0
- D8 관련 테스트 클래스:
  - `YachtScoreCalculatorTest$D6Upper` (6/6 PASS)
  - `YachtScoreCalculatorTest$D6Lower` (6/6 PASS)
  - `YachtScoreCalculatorTest$D6Edge` (3/3 PASS)
  - `YachtScoreCalculatorTest$D8Upper` (2/2 PASS)
  - `YachtScoreCalculatorTest$D8Lower` (5/5 PASS)
  - `YachtScoreCalculatorTest$D8Meta` (6/6 PASS)
  - `YachtControllerSecurityTest` (6/6 PASS) — diceType 누락/D10/ALREADY_IN_ROOM 검증 포함

### 2. `npx tsc -b` (프론트)
- **결과: 에러 0개**

### 3. `npx eslint src/games/yacht/ src/api/yacht.ts`
- **결과: 에러 1개 (d8 무관)**
- `YachtChat.tsx:57` — `react-hooks/set-state-in-effect` (기존 파일, 61bf568 변경 없음)
- d8 신규 코드(YachtModeCard, YachtModeBadge, YachtDiceRow3D, YachtSelectPage, YachtScoreBoard, yacht.ts, scoreCalc.ts, yacht.types.ts 등)에서 추가 에러 없음

---

## 코드 정합성 점검 결과

### 백엔드 점수 계산 (PRD §5 vs 구현)

| 항목 | PRD 기대 | D6Rules | D8Rules | 판정 |
|---|---|---|---|---|
| ONES~SIXES | face 총합 | O | O | 일치 |
| SEVENS | 7눈 총합 | N/A | O | 일치 |
| EIGHTS | 8눈 총합 | N/A | O | 일치 |
| CHOICE | 5개 총합 | O | O | 일치 |
| FOUR_OF_A_KIND | ≥4개 → face×4, 5개도 인정 | O | O | 일치 |
| FULL_HOUSE | 정확히 [2,3] 카운트, 5개 동일은 0 | O | O | 일치 |
| LITTLE_STRAIGHT D6 | {1234}{2345}{3456} | O | — | 일치 |
| LITTLE_STRAIGHT D8 | +{4567}{5678} | — | O | 일치 |
| BIG_STRAIGHT D6 | {12345}{23456} | O | — | 일치 |
| BIG_STRAIGHT D8 | +{34567}{45678} | — | O | 일치 |
| YACHT | 5개 동일 → 50 | O | O | 일치 |
| 상단 보너스 임계 | D6=63, D8=84 | 63 | 84 | 일치 |
| 상단 보너스 점수 | 양쪽 35 (OQ-1 잠정) | 35 | 35 | 일치 |
| totalScoreKeys | D6=12, D8=14 | 12 | 14 | 일치 |
| rngFaces | D6=6, D8=8 | 6 | 8 | 일치 |

**주목 사항**: D6Rules.calcBigStraight는 `containsAll`, D8Rules.calcBigStraight는 `equals` 방식으로 구현 방식이 비대칭. 기능적으로는 양쪽 모두 정확히 동작하지만 D6도 `equals`로 통일하면 더 명시적. 기능 버그 아님 (BUG-01 Low).

### 프론트 점수 계산 (scoreCalc.ts vs PRD §5.6)

- ONES~EIGHTS, CHOICE, FOUR_OF_A_KIND, FULL_HOUSE, YACHT: 백엔드와 동일 로직 확인
- LITTLE_STRAIGHT: D6 3개 셋 + D8 2개 셋 diceType 분기 일치
- BIG_STRAIGHT: D6 2개 셋 + D8 2개 셋 diceType 분기 일치
- 클라이언트 계산은 미리보기 전용이며 실제 기록은 서버가 처리함

### D8 주사위 면 매핑 (createOctahedronGeometry.ts)

- getFaceNumber 옥탄트 → 면 번호 매핑: PRD 및 디자인 §3.2 명세와 일치
- 마주보는 면 합 = 9: face1↔8, 2↔7, 3↔6, 4↔5 확인됨
- FACE_ROT_D8 회전값: PITCH = arcsin(1/√3) ≈ 0.6155rad 기반. 각 면의 법선을 +Z 방향으로 회전시키는 yaw/pitch 조합 적용. 수학적 도출 일치.

### 매칭 풀 분리

- `YachtRoomRepository.findAvailableRooms`: `diceType` 파라미터 필터 JPQL 쿼리 확인
- `YachtMatchService.match`: Redis 분산락을 diceType별 분리(`yacht:match:D6`, `yacht:match:D8`)로 처리
- ALREADY_IN_ROOM 검사: `findActiveRoomsByUserId`가 모드 무관 검색 — 한 사용자 한 방 원칙 유지 확인

### 인증/보안

- `YachtController`: `@AuthenticationPrincipal Long userId`가 null이면 401 즉시 반환
- `resolveDiceType`: "D6"/"D8" 화이트리스트만 허용, 이외 null 반환 → 400 INVALID_DICE_TYPE
- `App.tsx`: `/yacht/select`, `/yacht` 모두 `<AuthRoute>`로 보호 확인

### WS 페이로드 diceType 포함 여부

- `YachtRoomStatePayload`: diceType 필드 추가 확인 (`docs/progress/developer-backend-yacht-d8.md` 기재)
- `YachtGameStartedPayload`: diceType + totalRounds 계산 분기 확인
- `useYachtGame.hydrateFromSnapshot`: snap.diceType으로 클라이언트 상태 동기화 확인
- `RoomStatePayload`, `GameStartedPayload` 인터페이스: diceType?: DiceType 옵셔널 필드 포함

### 랭킹 분리

- `YachtRankingService.getTopRankings()`: D6/D8 각각 fetchRankings 호출, 분리 응답 빌더 확인
- `YachtRankingService.updateRecord(userId, isWinner, diceType)`: diceType별 yacht_record 분리 upsert 확인
- `YachtRankingResponse`: D6/D8 분리 구조 (`List<RankingEntry> d6, d8`) 확인

---

## 발견된 이슈

상세 내용: `docs/review/yacht-d8-bug-report.md` 참조

| ID | 우선순위 | 차단 여부 |
|---|---|---|
| BUG-01: D6/D8 BIG_STRAIGHT 구현 방식 비대칭 | Low | 비차단 |
| BUG-02: totalScore 필드가 winCount 값으로 대체됨 | Medium | 비차단 |
| BUG-03: 409 시 기존 방 diceType 불일치 가능성 | Low | 비차단 |
| BUG-04: YachtChat.tsx ESLint 에러 (기존 파일) | Low | 비차단 |

**Critical/High 버그 없음.**

---

## 미완료 항목 (수동 E2E 필요)

- `docs/review/yacht-d8-test-plan.md` §E 전체: 브라우저 수동 확인 필요
- §D (WS 페이로드): 실제 WebSocket 연결 후 확인 필요
- §C (랭킹 분리): Railway 마이그레이션 SQL 실행 후 읽기 전용 쿼리 확인 필요
- §G-10 (D6 데이터 백필): 마이그레이션 SQL 실행 사용자 확인 필요

---

## 다음 권장 단계

1. **사용자**: Railway MySQL에서 `backend/src/main/resources/db/yacht-record-d8-migration.sql` 실행 (§C/G-10 전제)
2. **사용자**: 수동 E2E — `docs/review/yacht-d8-test-plan.md` §E 항목 순서대로 브라우저 확인
3. **developer-backend**: BUG-02 (`totalScore` 필드 처리 방향) planner와 협의. yacht_record에 total_score 컬럼 추가 여부 결정.
4. **developer-backend + developer-frontend**: BUG-03 해소를 위해 409 응답에 diceType 필드 추가 검토.
5. **developer-frontend**: BUG-04 (YachtChat ESLint 에러) 별도 PR에서 처리.
6. **qa-tester**: E2E 완료 후 regression-checklist.md §2-11 Yacht D8 항목 추가.

---

## 결론

정적 검증(빌드 + 타입 + 린트) 및 코드 정합성 점검 통과. 백엔드 79개 단위 테스트 전량 PASS. Critical/High 버그 없음. 수동 E2E 및 Railway 마이그레이션 이후 최종 확인 권장.
