# 테스트 플랜 — Yacht D8 모드 확장 (yacht-d8)

- 작성자: qa-tester
- 작성일: 2026-05-10
- 기반 PRD: `docs/specs/yacht-d8-mode-prd.md`
- 기반 API 계약: `docs/specs/yacht-api-contract.md` §d8 모드 분기
- 기반 디자인: `docs/design/yacht-d8-design.md`
- 모드 적용: **일반 모드만** (Excel 모드 N/A — PRD §2)

---

## A. 점수 룰 검증 (D6 / D8 양쪽)

### A-1. 상단 족보 합산

| ID | 입력 (dice) | scoreKey | 기대 점수 | 모드 |
|---|---|---|---|---|
| A-1-1 | [1,1,2,3,1] | ONES | 3 | D6 |
| A-1-2 | [2,3,4,5,6] | ONES | 0 | D6 |
| A-1-3 | [6,6,6,6,6] | SIXES | 30 | D6 |
| A-1-4 | [7,7,1,2,3] | SEVENS | 14 | D8 |
| A-1-5 | [7,7,7,7,7] | SEVENS | 35 | D8 |
| A-1-6 | [8,8,8,1,2] | EIGHTS | 24 | D8 |
| A-1-7 | [8,8,8,8,8] | EIGHTS | 40 | D8 |
| A-1-8 | [1,2,3,4,5] | SEVENS | 0 | D8 |

### A-2. 상단 보너스 임계

| ID | 시나리오 | 기대 결과 |
|---|---|---|
| A-2-1 | D6: 상단 6개 합 = 62 (미달) | bonusEarned=false, grandTotal 미반영 |
| A-2-2 | D6: 상단 6개 합 = 63 (정확) | bonusEarned=true, grandTotal +35 |
| A-2-3 | D6: 상단 6개 합 = 70 (초과) | bonusEarned=true, grandTotal +35 |
| A-2-4 | D8: 상단 8개 합 = 107 (미달) | bonusEarned=false |
| A-2-5 | D8: 상단 8개 합 = 108 (정확) | bonusEarned=true, grandTotal +35 |
| A-2-6 | D8: 상단 8개 합 = 130 (초과) | bonusEarned=true, grandTotal +35 |
| A-2-7 | D8: 상단 7개만 기록 (EIGHTS 미기록) | bonusEarned 미판정 (8개 모두 기록 시점까지 대기) |

### A-3. bonusEarned=true 트리거 확인

- SCORE_RECORDED 페이로드에서 8번째 상단 족보 기록 직후 bonusEarned=true, grandTotal에 +35 포함
- 그 이전 기록에서는 bonusEarned=false

### A-4. LITTLE_STRAIGHT

| ID | dice | 기대 | 모드 |
|---|---|---|---|
| A-4-1 | [1,2,3,4,1] | 15 | D6 |
| A-4-2 | [2,3,4,5,5] | 15 | D6 |
| A-4-3 | [3,4,5,6,6] | 15 | D6 |
| A-4-4 | [4,5,6,7,1] | 15 | D8 (추가 셋) |
| A-4-5 | [5,6,7,8,1] | 15 | D8 (추가 셋) |
| A-4-6 | [1,2,3,5,6] | 0 | D6 (불일치) |
| A-4-7 | [1,2,3,5,8] | 0 | D8 (불일치) |
| A-4-8 | [4,5,6,7,1] | 0 | D6에서 LITTLE_STRAIGHT → 0 (D6는 셋 없음) |

### A-5. BIG_STRAIGHT

| ID | dice | 기대 | 모드 |
|---|---|---|---|
| A-5-1 | [1,2,3,4,5] | 30 | D6 |
| A-5-2 | [2,3,4,5,6] | 30 | D6 |
| A-5-3 | [3,4,5,6,7] | 30 | D8 (추가 셋) |
| A-5-4 | [4,5,6,7,8] | 30 | D8 (추가 셋) |
| A-5-5 | [8,7,6,5,4] | 30 | D8 (순서 무관) |
| A-5-6 | [1,2,3,4,6] | 0 | D6 (끊김) |
| A-5-7 | [1,2,3,4,4] | 0 | D6 (중복) |
| A-5-8 | [3,4,5,6,8] | 0 | D8 (불일치) |

### A-6. FULL_HOUSE — Yacht 예외

| ID | dice | 기대 | 비고 |
|---|---|---|---|
| A-6-1 | [3,3,3,2,2] | 13 | D6 정상 |
| A-6-2 | [5,5,5,5,5] | 0 | D6 Yacht → 0 |
| A-6-3 | [8,8,8,8,8] | 0 | D8 Yacht → 0 |
| A-6-4 | [7,7,7,8,8] | 37 | D8 정상 |
| A-6-5 | [6,6,6,6,2] | 0 | 4+1 조합 → 0 |

### A-7. FOUR_OF_A_KIND

| ID | dice | 기대 | 비고 |
|---|---|---|---|
| A-7-1 | [6,6,6,6,2] | 24 | D6 |
| A-7-2 | [5,5,5,5,5] | 20 | D6 5개 동일 → ×4 |
| A-7-3 | [8,8,8,8,1] | 32 | D8 최대 |
| A-7-4 | [8,8,8,8,8] | 32 | D8 5개 동일 → ×4 |
| A-7-5 | [3,3,3,1,2] | 0 | 3개 → 0 |

### A-8. YACHT

| ID | dice | 기대 | 모드 |
|---|---|---|---|
| A-8-1 | [3,3,3,3,3] | 50 | D6 |
| A-8-2 | [8,8,8,8,8] | 50 | D8 |
| A-8-3 | [7,7,7,7,7] | 50 | D8 |
| A-8-4 | [1,1,1,1,2] | 0 | D6 |

---

## B. 매칭 분리 검증

| ID | 시나리오 | 기대 결과 |
|---|---|---|
| B-1 | D6 WAITING 방만 존재할 때 D8 매칭 요청 | 신규 D8 방 생성 (created=true, diceType=D8) |
| B-2 | D8 WAITING 방만 존재할 때 D6 매칭 요청 | 신규 D6 방 생성 (created=true, diceType=D6) |
| B-3 | 동일 모드 WAITING 방 존재 시 매칭 요청 | 기존 방 합류 (created=false, diceType 일치) |
| B-4 | D6 방에 있는 사용자가 D8 매칭 요청 | 409 ALREADY_IN_ROOM (기존 roomId 응답) |
| B-5 | D8 방에 있는 사용자가 D6 매칭 요청 | 409 ALREADY_IN_ROOM |
| B-6 | POST /api/yacht/match에 diceType 필드 누락 | 400 {"error":"INVALID_DICE_TYPE"} |
| B-7 | POST /api/yacht/match에 diceType="D10" | 400 {"error":"INVALID_DICE_TYPE"} |
| B-8 | POST /api/yacht/match에 diceType=null | 400 {"error":"INVALID_DICE_TYPE"} |
| B-9 | 인증 없이 POST /api/yacht/match | 302 (OAuth2 리다이렉트) |
| B-10 | D6 방 6명 풀인 상태에서 7번째 D6 매칭 | PLAYING 방 있으면 관전자 합류, 없으면 신규 D6 방 생성 |

---

## C. 랭킹 분리 검증

| ID | 시나리오 | 기대 결과 |
|---|---|---|
| C-1 | D6 게임 종료 시 | yacht_record D6 행만 win_count/total_games 변동, D8 행 무변화 |
| C-2 | D8 게임 종료 시 | yacht_record D8 행만 win_count/total_games 변동, D6 행 무변화 |
| C-3 | 동일 사용자가 D6/D8 모두 플레이 후 | yacht_record에 (user_id, D6), (user_id, D8) 두 행 존재 |
| C-4 | GET /api/yacht/rankings 응답 구조 | { "D6": [...], "D8": [...] } 두 키 분리 확인 |
| C-5 | D6 랭킹 항목: rank/userId/nickname/winCount/totalScore/playedCount 필드 존재 | |
| C-6 | D8 랭킹 항목: rank/userId/nickname/winCount/totalScore/playedCount 필드 존재 | |
| C-7 | 기존 D6 데이터 (마이그레이션 전) | dice_type='D6'으로 백필 완료 확인 (SHOW COLUMNS + SELECT 검증) |

---

## D. WS 페이로드 검증

| ID | 이벤트 | 검증 항목 |
|---|---|---|
| D-1 | ROOM_STATE | payload.diceType = "D6" 또는 "D8" 포함 |
| D-2 | GAME_STARTED (D8 2인) | payload.diceType="D8", totalRounds=28 (2×14) |
| D-3 | GAME_STARTED (D6 2인) | payload.diceType="D6", totalRounds=24 (2×12) |
| D-4 | GAME_STARTED (D8 3인) | totalRounds=42 (3×14) |
| D-5 | ROLL_RESULT (D8) | dice 배열 값이 1~8 범위만 (9 이상 없음) |
| D-6 | ROLL_RESULT (D6) | dice 배열 값이 1~6 범위만 (7,8 없음) |
| D-7 | SCORE_RECORDED (D8, SEVENS) | scoreKey="SEVENS", score=dice중7눈합 |
| D-8 | SCORE_RECORDED (D8, EIGHTS) | scoreKey="EIGHTS", score=dice중8눈합 |
| D-9 | SCORE_RECORDED (bonusEarned=true) | 8개 모두 기록 직후 bonusEarned=true, grandTotal에 +35 |

---

## E. 프론트엔드 UI 검증 (수동 E2E)

### E-1. 라우팅

| ID | 시나리오 | 기대 결과 |
|---|---|---|
| E-1-1 | 홈 → "야추 플레이" 클릭 (로그인) | /yacht/select 진입, 두 카드 노출 |
| E-1-2 | 홈 → "야추 플레이" 클릭 (비로그인) | 로그인 페이지로 리다이렉트 |
| E-1-3 | /yacht 직접 접근 (mode 파라미터 없음) | /yacht/select로 replace 리다이렉트 |
| E-1-4 | /yacht?mode=INVALID 접근 | /yacht/select로 replace 리다이렉트 |
| E-1-5 | /yacht?mode=D8 직접 접근 | D8 모드로 게임 진행 (select 없이 즉시 매칭) |
| E-1-6 | /yacht/select 직접 URL 접근 (비로그인) | 로그인 페이지로 리다이렉트 |

### E-2. 모드 선택 화면

| ID | 확인 항목 |
|---|---|
| E-2-1 | D6 카드: "정육면체 (D6)", 12 족보, 63점, 활성 방 수, TOP 랭킹 표시 |
| E-2-2 | D8 카드: "정팔면체 (D8)", 14 족보, 4롤, 108점, 활성 방 수, TOP 랭킹 표시 |
| E-2-3 | 랭킹 로딩 중 shimmer 스켈레톤 표시 |
| E-2-4 | D6 카드 클릭 → /yacht?mode=D6 navigate, D6 매칭 시작 |
| E-2-5 | D8 카드 클릭 → /yacht?mode=D8 navigate, D8 매칭 시작 |
| E-2-6 | 매칭 요청 중 버튼 disabled + "매칭 중..." 텍스트 |
| E-2-7 | 409 ALREADY_IN_ROOM 수신 시 기존 방으로 navigate + 토스트 |
| E-2-8 | 기타 에러 시 버튼 원상복구 + 에러 토스트 |
| E-2-9 | Tab 키로 D6 카드 → D8 카드 순 포커스 |
| E-2-10 | Enter/Space로 카드 클릭 동작 실행 |

### E-3. 게임 화면 헤더

| ID | 확인 항목 |
|---|---|
| E-3-1 | D6 게임: 헤더 타이틀 "Yacht D6", D6 배지 (#4f6cd8 파란 계열) |
| E-3-2 | D8 게임: 헤더 타이틀 "Yacht D8", D8 배지 (#d86a4f 주황 계열) |
| E-3-3 | 배지 aria-label="현재 모드: D6 정육면체" / "현재 모드: D8 정팔면체" |

### E-4. 점수판 행 수

| ID | 확인 항목 |
|---|---|
| E-4-1 | D6 게임: 점수판 상단 6행 (ONES~SIXES) |
| E-4-2 | D8 게임: 점수판 상단 8행 (ONES~EIGHTS) |
| E-4-3 | D6 상단 합계 표기: "현재합계 / 63" |
| E-4-4 | D8 상단 합계 표기: "현재합계 / 108" |
| E-4-5 | D8 점수판에 SEVENS/EIGHTS 행 존재 + 클릭 가능 (내 턴일 때) |

### E-5. 모바일 점수판 (480px 이하)

| ID | 확인 항목 |
|---|---|
| E-5-1 | D8 모드 점수판 내부 세로 스크롤 동작 |
| E-5-2 | 첫 번째 열(족보명)이 sticky-left 고정 |
| E-5-3 | 헤더 행(플레이어명)이 sticky-top 고정 |
| E-5-4 | 점수판 하단 fade-out 그라데이션 표시 (스크롤 여지 있을 때) |

### E-6. 3D 주사위

| ID | 확인 항목 |
|---|---|
| E-6-1 | D6 모드: 큐브(박스) 형태 주사위 렌더 |
| E-6-2 | D8 모드: 정팔면체 형태 주사위 렌더 |
| E-6-3 | D8 주사위 면 1~8 텍스처 라벨 정확 (6번 면 밑줄 포함) |
| E-6-4 | D8 마주보는 면 합 = 9 (face1↔8, 2↔7, 3↔6, 4↔5) |
| E-6-5 | D8 굴림 애니메이션 800ms easeOutCubic 정상 |
| E-6-6 | D8 KEEP 주사위 노란 tint/outline 표시 |
| E-6-7 | D6 KEEP 주사위 노란 tint/outline 표시 (회귀) |

### E-7. 대기실 랭킹

| ID | 확인 항목 |
|---|---|
| E-7-1 | 대기실 랭킹 탭 D6/D8 분리 표시 |
| E-7-2 | D8 방 대기 중: D8 탭 기본 활성 |
| E-7-3 | D6 방 대기 중: D6 탭 기본 활성 |
| E-7-4 | 탭 전환 시 해당 모드 랭킹 즉시 변경 |

---

## F. 보안 / 에지 케이스

| ID | 시나리오 | 기대 결과 |
|---|---|---|
| F-1 | 클라이언트가 ROLL_RESULT의 dice 값을 임의로 조작 시도 | 서버는 클라이언트 dice 값 무시, 서버 RNG 기준으로만 처리 |
| F-2 | D8 게임에서 클라이언트가 SEVENS/EIGHTS 족보 키를 보내지 않고 12개만 기록 | 서버 totalScoreKeys=14 검증으로 GAME_OVER 발생하지 않음 (게임 계속 진행) |
| F-3 | D6 방에서 SEVENS 족보 키 전송 | 서버: INVALID_SCORE_KEY 에러 응답 |
| F-4 | D6 방에서 EIGHTS 족보 키 전송 | 서버: INVALID_SCORE_KEY 에러 응답 |
| F-5 | D8 게임 중인 사용자가 D6 매칭 재호출 | 409 ALREADY_IN_ROOM |
| F-6 | XSS 페이로드를 diceType 필드에 삽입 (예: "<script>") | 400 INVALID_DICE_TYPE (서버 화이트리스트 검증) |
| F-7 | SQL injection 시도를 diceType에 삽입 | 400 INVALID_DICE_TYPE |
| F-8 | Rate limit: 10초 내 POST /api/yacht/match 6회 이상 | 429 MATCH_RATE_LIMIT |

---

## G. 회귀 테스트 (D6 기존 기능)

| ID | 확인 항목 | 우선순위 |
|---|---|---|
| G-1 | /yacht/select 접근 시 기존 /yacht 진입 방식 동작 변경 없음 | Critical |
| G-2 | D6 매칭 → WAITING 방 생성 → D6 게임 시작 정상 | Critical |
| G-3 | D6 LITTLE_STRAIGHT 3개 셋 ({1234}{2345}{3456}) 모두 인정 | Critical |
| G-4 | D6 BIG_STRAIGHT 2개 셋 ({12345}{23456}) 모두 인정 | Critical |
| G-5 | D6 상단 보너스 임계 63점 정상 판정 | Critical |
| G-6 | D6 게임 종료 시 yacht_record D6 행만 업데이트 | Critical |
| G-7 | GET /api/yacht/rankings 응답에 D6 키 정상 포함 | Critical |
| G-8 | D6 방에서 SEVENS/EIGHTS scoreKey 차단 (INVALID_SCORE_KEY) | High |
| G-9 | D6 3D 큐브 주사위 정상 렌더 (D8 코드 분기로 인한 회귀 없음) | High |
| G-10 | 기존 yacht_record D6 행에 dice_type='D6' 백필 완료 (마이그레이션 SQL) | Critical |
| G-11 | /yacht 라우트가 AuthRoute로 보호됨 (회귀 없음) | Critical |
| G-12 | GAME_STARTED D6 totalRounds = 참가자수 × 12 | Critical |
| G-13 | **D6 게임의 한 턴 최대 굴림이 그대로 3회**로 동작 (4롤 회귀 없음) | Critical |
| G-14 | D6 GAME_STARTED/TURN_CHANGED 페이로드 `rollsLeft` 초기값 = 3 | Critical |

---

## H. D8 굴림 횟수 (4롤) 검증

| ID | 확인 항목 | 우선순위 |
|---|---|---|
| H-1 | D8 게임 시작 시 GAME_STARTED `rollsLeft = 4` | Critical |
| H-2 | D8 첫 굴림 후 `rollsLeft = 3`, 두 번째 굴림 후 `2`, 세 번째 후 `1`, 네 번째 후 `0` | Critical |
| H-3 | D8에서 `rollsLeft = 0` 상태에서 추가 ROLL 요청 시 `ALREADY_ROLLED_MAX` 에러 | Critical |
| H-4 | D8 점수 기록 후 다음 턴 TURN_CHANGED 페이로드 `rollsLeft = 4` | Critical |
| H-5 | D8 첫 굴림 직전(`rollsLeft = 4`)에 keptIndices 무시되고 5개 모두 새로 굴림 | High |
| H-6 | D8 첫 굴림 직전 buttonText = "굴리기!", 이후 "다시 굴리기" | High |
| H-7 | D8 4번째 굴림까지 keptIndices가 정상 적용되어 keep된 면 보존 | High |
| H-8 | D8 게임 종료 (14턴 × N명) 후 GAME_OVER 정상, 4롤이 횟수 카운트에 영향 없음 | Critical |
| H-9 | D8 재접속/강퇴/재시작 후 새 턴 시작 시 `rollsLeft = 4`로 정확히 리셋 | High |
| H-10 | D8 4롤 정확성: `1−(7/8)⁴ ≈ 41.4%` 면당 적중률에 부합하는지 통계적 스폿체크 (수동) | Medium |

---

## 비고

- Excel 모드 검증 대상 없음 (PRD §2: N/A).
- 실서비스 DB 통합 테스트 금지. C, G-10 항목은 사용자가 Railway에서 마이그레이션 SQL 실행 후 읽기 전용 쿼리로 확인.
- E 섹션(프론트 UI) 전체는 수동 브라우저 E2E 필요 — 자동화 불가.
- F-1 항목은 클라이언트가 서버 측 RNG 결과를 재정의할 방법이 없음을 확인 (서버 소스 코드 리뷰로 대체).
