# 버그 리포트 — Yacht D8 모드 확장 (yacht-d8)

- 작성자: qa-tester
- 작성일: 2026-05-10
- 검증 기준: `docs/review/yacht-d8-test-plan.md`

---

## BUG-01 [YachtScoreBoard] D6 BIG_STRAIGHT 중복 행위에서 잘못된 판정 가능성 (Low — 잠재 리스크)

**해당 없음 — 정적 분석 결과 정상 확인.**
D6Rules.calcBigStraight는 `set.containsAll(required)` 방식이고 BIG_STRAIGHT_SETS가 5개 원소 셋이므로, 주사위 5개 중 중복이 있으면 set 크기가 5 미만이 되어 5원소 셋을 containsAll로 충족 불가. 추가 크기 검증 없이도 동작 정확.
단, D8Rules.calcBigStraight는 `set.equals(required)` 방식으로 더 명시적. 양 구현 모두 정확하나 D6/D8 간 메서드 비대칭이 존재.

---

## BUG-02 [YachtRankingService] totalScore 필드가 winCount로 대체됨 (Medium)

**제목**: [랭킹] GET /api/yacht/rankings totalScore 필드가 winCount와 동일한 값 반환

**재현 단계**:
1. GET /api/yacht/rankings 호출
2. 응답 항목의 totalScore 확인

**예상 결과**: totalScore가 해당 플레이어의 누적 점수 합계를 반환

**실제 결과**: `YachtRankingService.fetchRankings()`에서 `totalScore(r.getWinCount())`로 하드코딩됨 (주석: "기존 스키마에 totalScore 컬럼 없음 — winCount로 대체"). 프론트엔드 `YachtModeCard`는 `entry.totalScore.toLocaleString()` 으로 표시하므로 랭킹 점수 미리보기가 실제 점수가 아닌 승수를 표시함

**환경**: 모든 환경 공통, D6/D8 양쪽

**우선순위**: Medium

**담당**: developer-backend 확인 필요. yacht_record에 total_score 컬럼 부재 시 planner와 스키마 결정 후 처리. 프론트에서 "N승" 표기로 대체하는 방안도 가능 — planner 판단 요청.

---

## BUG-03 [YachtSelectPage] ALREADY_IN_ROOM 409 시 diceType 불일치 가능성 (Low)

**제목**: [모드 선택] 409 ALREADY_IN_ROOM 응답 시 기존 방 diceType을 알 수 없어 잘못된 mode 파라미터 전달

**재현 단계**:
1. D6 방에 이미 입장한 상태에서 /yacht/select 재진입
2. D8 카드 클릭
3. 409 ALREADY_IN_ROOM 수신 (기존 D6 roomId 포함)
4. `navigate('/yacht?mode=D8', { state: { roomId: outcome.roomId, diceType: 'D8' } })` 호출

**예상 결과**: 기존 D6 방으로 재진입할 때 mode=D6가 전달됨

**실제 결과**: 409 응답 body에는 roomId만 있고 diceType이 없음. YachtSelectPage에서 클릭한 카드의 diceType(D8)을 navigate에 그대로 사용. YachtPage는 navigate state의 diceType으로 초기 mode를 결정하므로 기존 D6 방에 D8로 잘못 진입할 수 있음. useYachtGame의 hydrateFromSnapshot에서 snap.diceType을 읽어 덮어쓰므로 최종 게임 진행은 서버 기준으로 수정되지만, 초기 렌더에서 잘못된 모드 배지가 짧게 표시됨.

**환경**: 브라우저, 모든 해상도, 일반 모드

**우선순위**: Low (게임 로직에는 영향 없음. 수정 방안: 409 응답에 diceType 필드 추가 또는 프론트에서 GET /api/yacht/room/{roomId}로 diceType 조회)

**담당**: developer-backend (409 응답 DTO에 diceType 추가) + developer-frontend (YachtSelectPage 409 핸들러)

---

## BUG-04 [YachtChat] 기존 파일 ESLint 에러 (Info — d8 무관, 기존 이슈)

**제목**: [YachtChat] react-hooks/set-state-in-effect 에러

**상세**: `frontend/src/games/yacht/components/YachtChat.tsx:57` — useEffect 내부 동기 setState. d8 작업과 무관한 기존 파일이며 d8 커밋(61bf568)에서 수정되지 않음. developer-frontend가 별도 티켓으로 처리 필요.

**우선순위**: Low (기능 영향 없음, lint 규칙 위반)

**담당**: developer-frontend

---

## 발견된 이슈 요약

| ID | 영역 | 제목 | 우선순위 | 차단 여부 |
|---|---|---|---|---|
| BUG-01 | 백엔드 룰 | D6/D8 BIG_STRAIGHT 구현 방식 비대칭 | Low | 비차단 (정상 동작) |
| BUG-02 | 백엔드 랭킹 | totalScore가 winCount 값으로 대체됨 | Medium | 비차단 (기능 동작하나 데이터 불정확) |
| BUG-03 | 프론트 라우팅 | 409 시 기존 방 diceType 불일치 가능성 | Low | 비차단 (게임 진행 영향 없음) |
| BUG-04 | 프론트 lint | YachtChat ESLint 에러 (기존 파일) | Low | 비차단 (d8 무관) |

**Critical/High 버그 없음 — 배포 차단 없음.**
