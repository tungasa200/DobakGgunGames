# PRD — Yacht D8 모드 (정팔면체 주사위 병행 운영)

- 작성자: planner
- 최초 작성일: 2026-05-10
- 상태: **확정** — 사용자 정책 결정 완료
- 승인자: 프로젝트 오너 (사용자)
- 기반 문서:
  - 본체 PRD: `docs/specs/yacht-prd.md` (v1.0, 2026-04-29 CP1 승인 완료)
  - API 계약: `docs/specs/yacht-api-contract.md` (2026-04-29 작성)
- 관련 progress:
  - `docs/progress/planner-yacht-d8.md` (본 PRD 작업 로그)

---

## 1. 목적 / 배경

### 배경
- 기존 야추(d6, 6면체 주사위)는 2026-04-29 CP1 승인 후 Test Lab(BETA)에 노출 중.
- 정팔면체(d8) 주사위를 활용한 **확장 모드**를 도입하여 새로운 전략/리스크 곡선을 제공.
- 두 모드는 병행 운영하며, 매칭/랭킹/점수 룰은 모드별로 격리된다.

### 목표
- 기존 야추(d6)의 매칭/STOMP 인프라/UI 골격을 그대로 유지하면서 **주사위 면 수만 다른 d8 모드**를 추가.
- 사용자가 홈에서 야추 진입 시 **D6 / D8 중 하나를 선택**한 뒤 매칭이 진행.
- 같은 모드(`diceType`)끼리만 매칭 풀이 형성된다 — D6 방과 D8 방은 절대 섞이지 않음.
- 랭킹은 모드별로 분리 집계한다 — `D6 랭킹`과 `D8 랭킹`을 별도 응답으로 노출.

### 비목표 (Out of Scope)
- **Excel 모드 (해당 없음)** — 사용자 지시: 일반 모드만.
- d10/d12 등 추가 면 수: 본 PRD 미포함.
- 기존 d6 게임 데이터 마이그레이션: d6 기존 레코드는 `dice_type='D6'`로 백필.
- 모드 간 통합 랭킹 / 합산 랭킹: 비목표 (모드별 완전 분리).
- 진행 중 모드 변경: 한 게임 시작 후 모드 전환 불가.

---

## 2. 모드 적용 범위

- **일반 모드: 필수 (Must)**
- **Excel 모드: 해당 없음 (N/A)** — 사용자 지시: "Excel 모드 미적용".
- designer는 **일반 모드만** 명세 작성.
- developer-frontend는 **일반 모드만** 구현.
- qa-tester는 **일반 모드만** 검증.

---

## 3. 모드 정의 표 (D6 vs D8)

| 항목 | D6 (기존) | D8 (신규) |
|---|---|---|
| 주사위 면 수 | 6 (1~6) | 8 (1~8) |
| 주사위 개수 | 5 | 5 |
| 한 턴 굴림 횟수 | 최대 3 | **최대 4** (면당 적중률 1/8 보정) |
| 상단 족보 | ONES~SIXES (6개) | ONES~EIGHTS (8개) |
| 상단 보너스 임계 | 63점 | **108점** (면 합 비례 63 × 36/21) |
| 상단 보너스 점수 | +35 | **+35 (잠정 — §13 의문점)** |
| 하단 족보 | CHOICE / FOUR_OF_A_KIND / FULL_HOUSE / LITTLE_STRAIGHT / BIG_STRAIGHT / YACHT (6개) | **동일 6개** (룰 동일, face 1~8) |
| LITTLE_STRAIGHT 가능 셋 | {1,2,3,4} {2,3,4,5} {3,4,5,6} | {1,2,3,4} {2,3,4,5} {3,4,5,6} **{4,5,6,7} {5,6,7,8}** |
| BIG_STRAIGHT 가능 셋 | {1,2,3,4,5} {2,3,4,5,6} | {1,2,3,4,5} {2,3,4,5,6} **{3,4,5,6,7} {4,5,6,7,8}** |
| YACHT 점수 | 50 (5개 동일) | 50 (5개 동일) |
| 총 족보 수 | 12 | **14** (상단 8 + 하단 6) |
| 한 게임 라운드 수 | 참가자수 × 12 | **참가자수 × 14** |
| 정원 | 2~6명 | 2~6명 (동일) |
| 매칭 풀 | D6 전용 | **D8 전용** (분리) |
| 랭킹 집계 | D6 단독 | **D8 단독** (분리) |

---

## 4. 유저 스토리

- **US-D8-1** — As a logged-in user, I want to choose between D6 and D8 modes before matching, so that I can play the variant I prefer.
- **US-D8-2** — As a player, I want D8 matching to only pair me with other D8 players, so that the rules are consistent.
- **US-D8-3** — As a D8 player, I want the upper section to expose 8 categories (Ones~Eights) and apply the bonus threshold of 108, so that the rules scale with the dice.
- **US-D8-7** — As a D8 player, I want one extra reroll per turn (4 instead of 3), so that the lower-category odds (Yacht/Full House/4-Kind/Straight) match what I expect from the standard 5-die game.
- **US-D8-4** — As a D8 player, I want the straight conditions to recognize 4-/5-consecutive sets that include faces 7 and 8, so that I can score with the wider face range.
- **US-D8-5** — As a player, I want my D6 and D8 rankings to be tracked separately, so that each mode has fair competition.
- **US-D8-6** — As a player, I want the score table layout to remain readable when there are 14 categories, so that I can plan strategically without scrolling fatigue.

---

## 5. 점수 룰 상세 (D8)

### 5.1 상단 (Upper Section) — 8개

| 키 | 이름 | 점수 | 최대값 (5개 모두 같은 face일 때) |
|---|---|---|---|
| `ONES` | Ones | 1 눈 총합 | 5 |
| `TWOS` | Twos | 2 눈 총합 | 10 |
| `THREES` | Threes | 3 눈 총합 | 15 |
| `FOURS` | Fours | 4 눈 총합 | 20 |
| `FIVES` | Fives | 5 눈 총합 | 25 |
| `SIXES` | Sixes | 6 눈 총합 | 30 |
| `SEVENS` | Sevens | 7 눈 총합 | 35 |
| `EIGHTS` | Eights | 8 눈 총합 | 40 |

### 5.2 상단 보너스 (D8)

- **임계값**: 상단 8개 합계 **≥ 108점** (= 63 × 36/21, 면 합 비례).
- **보너스 점수**: **+35점** (D6와 동일).
- **판정 시점**: 상단 8개 모두 기록된 시점에 자동 판정 + `SCORE_RECORDED.payload.bonusEarned=true` 알림.
- 8개 미만 기록 시 미확정 (현재 합계만 미리보기).
- **균형 이론**: 평균 카테고리당 10.5점(=각 면 약 3개)으로 D6와 동일한 "각 면 3개" 목표. 4롤 + 단순 홀드 기대값 ≈ 36 × 5 × (1−(7/8)⁴) = 74.5점, 임계까지 부족분 비율 ~45%로 D6의 부족분 비율(~42%)과 거의 동일.

### 5.3 하단 (Lower Section) — 6개 (D6와 동일 룰, face 1~8)

| 키 | 조건 | 점수 |
|---|---|---|
| `CHOICE` | 무조건 | 5개 총합 (최대 40 = 8×5) |
| `FOUR_OF_A_KIND` | 같은 눈 4개 이상 | 그 눈×4 (5개 동일도 인정 → ×4 계산. 최대 32 = 8×4) |
| `FULL_HOUSE` | **정확히** 3개+2개 | 5개 총합 (5개 동일은 0점) |
| `LITTLE_STRAIGHT` | 어느 4개 연속 | **15 (고정)** |
| `BIG_STRAIGHT` | 어느 5개 연속 | **30 (고정)** |
| `YACHT` | 5개 동일 | **50 (고정)** |

### 5.4 LITTLE_STRAIGHT 가능 셋 (D8)

- {1,2,3,4}
- {2,3,4,5}
- {3,4,5,6}
- **{4,5,6,7}** (D8 추가)
- **{5,6,7,8}** (D8 추가)

→ 5개 주사위 중 어느 4개라도 위 셋 중 하나를 포함하면 15점.

### 5.5 BIG_STRAIGHT 가능 셋 (D8)

- {1,2,3,4,5}
- {2,3,4,5,6}
- **{3,4,5,6,7}** (D8 추가)
- **{4,5,6,7,8}** (D8 추가)

→ 5개 주사위 set이 위 셋 중 하나와 같으면 30점.

### 5.6 점수 계산 의사 코드 (D8 — developer-backend 참고)

```
fun calculateScoreD8(scoreKey: String, dice: Int[5]): Int {
  return when (scoreKey) {
    "ONES" -> dice.filter { it==1 }.sum()
    "TWOS" -> dice.filter { it==2 }.sum()
    "THREES" -> dice.filter { it==3 }.sum()
    "FOURS" -> dice.filter { it==4 }.sum()
    "FIVES" -> dice.filter { it==5 }.sum()
    "SIXES" -> dice.filter { it==6 }.sum()
    "SEVENS" -> dice.filter { it==7 }.sum()
    "EIGHTS" -> dice.filter { it==8 }.sum()
    "CHOICE" -> dice.sum()
    "FOUR_OF_A_KIND" -> {
      val counts = dice.groupingBy { it }.eachCount()
      val face = counts.entries.firstOrNull { it.value >= 4 }?.key
      if (face != null) face * 4 else 0
    }
    "FULL_HOUSE" -> {
      val counts = dice.groupingBy { it }.eachCount().values.sorted()
      // 정확히 [2,3]만 인정. [5]는 0.
      if (counts == listOf(2,3)) dice.sum() else 0
    }
    "LITTLE_STRAIGHT" -> {
      val s = dice.toSet()
      val littleSets = listOf(
        setOf(1,2,3,4), setOf(2,3,4,5), setOf(3,4,5,6),
        setOf(4,5,6,7), setOf(5,6,7,8)
      )
      if (littleSets.any { s.containsAll(it) }) 15 else 0
    }
    "BIG_STRAIGHT" -> {
      val s = dice.toSet()
      val bigSets = listOf(
        setOf(1,2,3,4,5), setOf(2,3,4,5,6),
        setOf(3,4,5,6,7), setOf(4,5,6,7,8)
      )
      if (bigSets.any { s == it }) 30 else 0
    }
    "YACHT" -> if (dice.toSet().size == 1) 50 else 0
    else -> throw INVALID_SCORE_KEY
  }
}
```

> 공통 룰 기준 정리: 본 PRD §5.6은 D8 전용. D6 계산 로직은 `docs/specs/yacht-prd.md §5.6` 그대로 유지.
> 서버는 `diceType`에 따라 두 계산기 중 하나를 분기 호출한다.

### 5.7 주사위 굴림

- 주사위 5개. 한 턴 최대 굴림 횟수는 모드별 분리 — **D6: 3회 / D8: 4회**.
- 서버는 룰셋(`YachtScoreRules.maxRollsPerTurn()`)에서 최대 횟수를 가져와 GAME_STARTED·TURN_CHANGED·TURN_STATE의 `rollsLeft` 초기값으로 사용.
- 클라이언트는 `MAX_ROLLS_BY_MODE[diceType]`로 첫 굴림 여부(`rollsLeft === maxRolls`)를 판정.
- 서버가 면 수에 맞춰 1~N 균등 분포 난수 생성 (D6: 1~6, D8: 1~8).
- `keptIndices` 처리 등 그 외 굴림 룰은 D6와 동일.

#### 5.7.1 D8 4롤 보정 근거

D8는 면당 적중률이 1/8로 D6(1/6) 대비 낮아 하단 족보 단판 확률이 절반 이하로 떨어진다 (YACHT 1/3, FH/4K ~0.44×). 면당 적중률 균형을 회복하기 위해 4롤로 상향:

| | D6 3롤 | D8 3롤 | D8 **4롤** |
|---|---|---|---|
| 1주사위 적중률 | 1−(5/6)³ ≈ 42.1% | 1−(7/8)³ ≈ 33.0% | 1−(7/8)⁴ ≈ 41.4% |

D8 4롤은 D6 3롤과 사실상 동등한 면당 적중률을 회복한다. 동시에 상단 보너스 임계는 면 합 비례(108)로 상향해 4롤로 보너스가 자동 보장되는 사태를 방지.

---

## 6. 매칭 정책 (모드 분리)

### 6.1 핵심 원칙
- **같은 `diceType` 방끼리만 매칭.** D6 방과 D8 방은 어떤 경우에도 섞이지 않는다.
- 매칭 요청 시 클라이언트가 `diceType`을 명시한다.
- 진행 중 방에 관전자로 합류하는 경우에도 같은 `diceType` 방에만 합류 가능.

### 6.2 매칭 알고리즘 변경

본체 PRD §4.3의 매칭 알고리즘을 다음과 같이 보강:

```
요청: POST /api/yacht/match { "diceType": "D6" | "D8" }

1. 동일 유저의 활성 방 중복 참여 방지 (모드 무관)
   - 이미 다른 활성 방 참가 중 → 409 ALREADY_IN_ROOM (기존 roomId 응답)
2. Redis 분산락 "yacht:match:{diceType}" (모드별 분리 락 권장)
   - 또는 "yacht:match:global" + diceType 필터링도 가능 (developer-backend 결정)
3. 매칭 대상 탐색 (우선순위, 모두 dice_type=요청값으로 필터):
   3a. status=WAITING + currentPlayers < maxPlayers
   3b. 3a 미발견 시 status=PLAYING + currentPlayers < maxPlayers → 관전자 합류
4. 발견 시 자리 예약 + roomId 반환 (created=false)
5. 미발견 시 신규 방 INSERT (dice_type=요청값, status=WAITING) + 첫 참가자 등록 + roomId 반환 (created=true)
6. 락 해제
```

### 6.3 잘못된 `diceType` 요청
- `diceType` 값이 `"D6"` / `"D8"` 외 → `400 INVALID_DICE_TYPE`.
- `diceType` 누락 → `400 INVALID_DICE_TYPE` (필수 필드).

---

## 7. 랭킹 정책 (모드 분리)

### 7.1 핵심 원칙
- D6 랭킹과 D8 랭킹은 **완전히 별개의 리더보드**로 노출.
- `yacht_record` 테이블에 `dice_type` 컬럼 추가 후 모드별 집계.
- API 응답에 `D6` / `D8` 두 그룹을 분리해서 반환.

### 7.2 GET `/api/yacht/rankings` 응답 구조 변경

본체에 `byMode` 또는 `D6` / `D8` 키로 분리:

```json
{
  "D6": [
    { "rank": 1, "userId": 101, "nickname": "유저A", "winCount": 12, "totalScore": 4321, "playedCount": 30 },
    { "rank": 2, "userId": 202, "nickname": "유저B", "winCount": 8, "totalScore": 3210, "playedCount": 22 }
  ],
  "D8": [
    { "rank": 1, "userId": 303, "nickname": "유저C", "winCount": 5, "totalScore": 2450, "playedCount": 11 }
  ]
}
```

> 정확한 순위 키(승수 / 누적 점수 / 평균 등)는 기존 야추 랭킹 정책을 따른다 (developer-backend가 본체 구현 기준 매칭).
> 본 PRD가 새로 도입하는 것은 **모드별 분리 응답** 구조뿐. 정렬/필터 규칙은 본체 야추 랭킹 정책 그대로.

### 7.3 기존 d6 데이터 백필
- 기존 `yacht_record` 행은 `dice_type='D6'`으로 백필 (마이그레이션 SQL §8 참조).

---

## 8. DB 스키마 변경

### 8.1 `yacht_room` (이미 적용 완료)

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `dice_type` | VARCHAR(4) | NOT NULL, DEFAULT 'D6' | `'D6'` \| `'D8'` |

- **상태**: Railway 프로덕션 DB에 수동 적용 **완료** (사용자 확인). 추가 SQL 불필요.

### 8.2 `yacht_record` (마이그레이션 필요)

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `dice_type` | VARCHAR(4) | NOT NULL, DEFAULT 'D6' | `'D6'` \| `'D8'` |

#### 마이그레이션 SQL (developer-backend가 실행 준비)

```sql
-- 1. 컬럼 추가 (기본값 'D6'로 설정해 기존 행 자동 백필)
ALTER TABLE yacht_record
  ADD COLUMN dice_type VARCHAR(4) NOT NULL DEFAULT 'D6';

-- 2. 인덱스 추가 (모드별 랭킹 조회 최적화)
CREATE INDEX idx_yacht_record_dice_type_user
  ON yacht_record (dice_type, user_id);

-- 3. (옵션) 기존 행 백필 명시적 확인 — DEFAULT로 이미 D6이지만 명시
UPDATE yacht_record SET dice_type = 'D6' WHERE dice_type IS NULL;
```

> Railway 프로덕션 DB에는 사용자가 수동 적용 (CLAUDE.md 정책: "Railway 프로덕션 DB에 직접 쓰기 쿼리 금지").
> 로컬 dev DB는 `ddl-auto=update`로 자동 반영.
> migration 파일은 `backend/src/main/resources/db/migration/` 또는 SQL 변경분 폴더에 배치 (developer-backend 결정).

### 8.3 영향받지 않는 테이블
- `yacht_participant`, `yacht_score`, `yacht_win`은 `room_id` FK를 통해 모드 추적 가능 — 추가 컬럼 불필요.
- 단, 모드별 랭킹/통계 조회 효율을 위해 developer-backend가 **JOIN 비용을 평가하여** `yacht_score`/`yacht_win`에 `dice_type`을 비정규화 추가할지 후속 결정 가능 (본 PRD에서는 강제하지 않음).

---

## 9. API 변경

### 9.1 `POST /api/yacht/match`

**요청 변경**:
```json
{ "diceType": "D6" }
```
또는
```json
{ "diceType": "D8" }
```

- `diceType`: **필수**. `"D6"` 또는 `"D8"`.

**응답 변경** (모든 200/201 응답에 `diceType` 추가):
```json
{
  "roomId": "yachtab12",
  "status": "WAITING",
  "diceType": "D8",
  "playerCount": 2,
  "maxPlayers": 6,
  "created": false,
  "joinedAsSpectator": false
}
```

**신규 에러**:
| HTTP | error 코드 | 상황 |
|---|---|---|
| 400 | `INVALID_DICE_TYPE` | `diceType` 누락 또는 `"D6"`/`"D8"` 외 값 |

### 9.2 `GET /api/yacht/room/{roomId}`

**응답에 `diceType` 추가**:
```json
{
  "roomId": "yachtab12",
  "status": "PLAYING",
  "diceType": "D8",
  "hostUserId": 101,
  "maxPlayers": 6,
  "currentTurnUserId": 101,
  "turnOrder": [101, 202],
  "roundIndex": 2,
  "participants": [...],
  "scoreboard": [
    {
      "userId": 101,
      "scores": {
        "ONES": 3, "TWOS": null, "THREES": null, "FOURS": null,
        "FIVES": null, "SIXES": null, "SEVENS": null, "EIGHTS": null,
        "CHOICE": null, "FOUR_OF_A_KIND": null, "FULL_HOUSE": null,
        "LITTLE_STRAIGHT": null, "BIG_STRAIGHT": null, "YACHT": null
      },
      "upperTotal": 3,
      "bonusEarned": false,
      "grandTotal": 3
    }
  ]
}
```

- D8 방의 `scoreboard.scores`는 14개 키 (D6는 12개 그대로).
- 클라이언트는 `diceType`을 보고 어떤 키 셋을 렌더할지 판단.

### 9.3 `GET /api/yacht/rankings`

§7.2 참조 — `D6` / `D8` 키로 분리 응답.

### 9.4 `scoreKey` enum 확장 (D8 한정)

기존 12개 + **`SEVENS`**, **`EIGHTS`** 2개 추가 → 총 14개.

- D6 방에서 `SEVENS`/`EIGHTS` 전송 → `INVALID_SCORE_KEY`.
- D8 방에서는 14개 모두 유효.

---

## 10. WebSocket 페이로드 변경

### 10.1 `GAME_STARTED` — `diceType` 포함

```json
{
  "type": "GAME_STARTED",
  "timestamp": "2026-05-10T12:01:00.000Z",
  "payload": {
    "roomId": "yachtab12",
    "diceType": "D8",
    "turnOrder": [202, 101],
    "currentTurnUserId": 202,
    "totalRounds": 28
  }
}
```
- `totalRounds` = 참가자수 × 14 (D8) / × 12 (D6).
- 클라이언트는 `diceType`으로 점수판 키 셋과 보너스 임계를 결정.

### 10.2 `ROOM_STATE` — `diceType` 포함

```json
{
  "type": "ROOM_STATE",
  "timestamp": "2026-05-10T12:00:00.000Z",
  "payload": {
    "roomId": "yachtab12",
    "status": "WAITING",
    "diceType": "D8",
    "hostUserId": 101,
    "maxPlayers": 6,
    "participants": [...]
  }
}
```

### 10.3 `ROLL_RESULT`

- 페이로드 형식 변경 없음.
- `dice` 값 범위만 모드별로 다름 (D6: 1~6, D8: 1~8). 0은 미굴림 의미 (모드 공통).

### 10.4 `SCORE_RECORDED`

- 페이로드 형식 변경 없음.
- `scoreKey`로 `SEVENS` / `EIGHTS`가 들어올 수 있음 (D8 한정).
- 보너스 임계는 서버가 모드에 따라 자동 적용 (D6=63 / D8=108).

### 10.5 기타 이벤트
- `TURN_STATE`, `TURN_CHANGED`, `GAME_OVER`, `PLAYER_LEFT`, `ROOM_CLOSED`: 페이로드 형식 변경 없음.
- `MATCH_COUNTDOWN` 류: 본체 야추가 사용하지 않음(전원 준비 + 방장 시작 방식) — 변경 없음.

---

## 11. UI 흐름

### 11.1 전체 플로우

```
[홈/게임 허브] — "Yacht" 진입 버튼 (로그인 유저 한정)
        ↓ 클릭 (비로그인 시 라우트 가드 → 로그인 페이지)
[모드 선택 화면] (신규)
  - 두 카드: "D6 (정육면체) — 12 족보" / "D8 (정팔면체) — 14 족보"
  - 각 카드 하단 짧은 설명 (상단 8개·보너스 108점·4롤·스트레이트 확장 등)
  - 카드 클릭 시 해당 모드로 매칭 호출
        ↓ 클릭
[자동 매칭 호출] POST /api/yacht/match { diceType: "D6" | "D8" }
        ↓
[WebSocket 연결 + 구독]
  /topic/yacht/room/{roomId}
        ↓
[/join 자동 발행]
        ↓
[대기 화면]
  - 모드 표기 (예: "D8 모드 — 정팔면체") 상단에 명확히 노출
  - 참가자 / 준비 상태 / 방장 표시 (본체 동일)
        ↓ 전원 준비 + 방장 /start
[GAME_STARTED 수신]
  - diceType에 따라 점수판 키 셋(12 / 14) 렌더
  - diceType에 따라 주사위 모델(d6 BoxGeometry / d8 OctahedronGeometry) 렌더
        ↓
[게임 진행] (룰 분기는 모두 서버 책임)
        ↓
[GAME_OVER]
  - rankings 표시
  - WAITING 리셋 후 재시작 가능 (본체 동일)
```

### 11.2 모드 선택 화면 요구사항 (Must)
- 화면 진입 시점에 **두 모드 카드 동시 노출**.
- 카드에 포함되는 정보:
  - 주사위 시각 아이콘 (designer 결정)
  - 모드명 ("정육면체 (D6)" / "정팔면체 (D8)")
  - 족보 수 / 보너스 임계값 / 평균 게임 시간 안내
- 카드 클릭 시 즉시 매칭 호출 (별도 확인 모달 불필요).
- 비로그인 유저가 모드 선택 화면 직접 URL 진입 시 로그인 페이지 리다이렉트.

### 11.3 게임 화면 — 모드 표기
- 점수판 상단에 현재 모드(`D6` / `D8`) 작은 배지 노출.
- 결과 모달에도 모드 배지 유지.

---

## 12. 상단 족보 8개 점수판 레이아웃

### 12.1 이슈
- D6는 상단 6 + 하단 6 = 12행. D8은 상단 8 + 하단 6 = **14행**.
- 모바일 세로 화면에서 14행 모두 한눈에 보이지 않을 수 있음.

### 12.2 정책 (Must)
- **데스크탑 (≥ 1024px)**: 14행 모두 한 화면에 노출 (스크롤 없음 권장).
  - 행 높이를 D6 대비 약 85% 수준으로 축소 가능.
- **태블릿 (768px ~ 1023px)**: 14행 모두 한 화면 노출 시도. 안 될 경우 점수판 영역 내부 세로 스크롤 허용.
- **모바일 (< 768px)**: **점수판 영역 내부 세로 스크롤 허용** (Must).
  - 단, "현재 턴 플레이어 행"과 "내 행"은 항상 스크롤 영역 상/하단에 sticky 노출 권장 (Should).

### 12.3 축약 정책
- 카테고리명을 모바일에서는 약자(예: `1` `2` `3` `4` `5` `6` `7` `8` `Choice` `4-Kind` `F.House` `L.Str` `B.Str` `Yacht`)로 축약 가능 (designer 결정).
- 점수 셀의 폰트/패딩 축소 허용.

### 12.4 비고
- 정확한 컴포넌트 명세, 색상, sticky 동작 등은 designer가 `docs/design/yacht-d8-design.md`에 작성 (본 PRD는 정책 가이드만).

---

## 13. 의문점 / 리스크

| ID | 질문 | 영향 | 임시 결정 |
|---|---|---|---|
| OQ-1 | **D8 보너스 점수가 35로 충분한가?** | 상단 8개를 다 채우려면 평균 face가 더 커야 하므로 D6보다 도달 난이도가 높음. 4롤 보정으로 면당 적중률은 D6 수준으로 회복됐고 임계도 면 합 비례로 상향됐으므로 보너스 가성비는 D6와 유사할 것으로 예상. | **35점 확정.** 4롤 + 임계 108로 균형 맞춘 상태에서 도달률 모니터링. |
| OQ-2 | 상단 보너스 임계 108점의 적정성 | 108 = 63 × 36/21 (면 합 비례). 4롤 단순 홀드 기대값 74.5점 대비 부족분 비율(~45%)이 D6의 부족분 비율(~42%)과 거의 동일. | **108점 확정.** 통계 누적 후 검토. |
| OQ-3 | D8 첫 도입 시 매칭 풀이 작아 매칭 실패 빈도 증가 우려 | D8 모드 사용자가 적으면 매칭 대기 시간↑. | 신규 방 자동 생성 정책으로 완화. 출시 후 모니터링. |
| OQ-4 | 14행 점수판 모바일 가독성 (특히 sticky 미구현 시) | UX 저하 가능. | designer가 sticky 여부 명세 결정. |
| OQ-5 | 기존 D6 진행 중 게임이 있는 시점에 D8 배포 시 호환성 | `diceType` 컬럼은 DEFAULT 'D6'로 처리되므로 무중단 배포 가능. | 기 적용. 추가 작업 불필요. |
| OQ-6 | `yacht_record`에 모드 컬럼 추가 후 기존 랭킹 API 호환 | 기존 클라이언트가 `D6`/`D8` 분리 응답을 처리 못할 수 있음. | 프론트와 백엔드 동시 배포 필요. CI/CD 정책에 따라 사용자 조율. |

---

## 14. 환경변수

- **추가 환경변수 없음.**
- 본 PRD의 모든 결정은 코드/DB 스키마 변경으로 처리되며 새로운 Vercel/Railway 환경변수를 도입하지 않는다.

---

## 15. 성공 지표

### 출시 완료 기준
- [ ] 홈에서 야추 진입 시 D6/D8 모드 선택 화면 노출
- [ ] D6 매칭과 D8 매칭이 절대 섞이지 않음 (E2E 검증)
- [ ] D8 게임에서 상단 8 족보 + 14행 점수판이 정상 동작
- [ ] D8 보너스(임계 108, 점수 35)가 8개 모두 기록 시점에 자동 부여
- [ ] D8 게임에서 한 턴 최대 4회 굴림이 가능하고, D6는 그대로 3회로 동작
- [ ] D8 LITTLE_STRAIGHT / BIG_STRAIGHT가 face 7,8 포함 셋에서 정상 인정
- [ ] `/api/yacht/rankings`가 `D6` / `D8` 분리 응답을 반환
- [ ] 기존 D6 게임이 회귀 없이 동작 (점수 계산, 랭킹, 매칭)
- [ ] `yacht_record.dice_type` 마이그레이션 성공 + 기존 행 백필 완료

### 관찰 지표 (Phase 2 준비용)
- D6 vs D8 일일 매칭 수 비율
- D8 평균 게임 시간 (참가자수 × 14 라운드 → D6 대비 17% 증가 예상)
- D8 상단 보너스 도달률 (OQ-1 검증 핵심)
- D8 LITTLE/BIG STRAIGHT 발생률 (face 범위 확장 효과)
- 모드 선택 화면 → 매칭 호출 전환율

---

## 16. 책임 매트릭스

| 산출물 | 담당 |
|---|---|
| 본 PRD | planner |
| `docs/design/yacht-d8-design.md` (모드 선택 화면 + 14행 점수판 + d8 주사위 시각) | designer |
| `yacht_record.dice_type` 마이그레이션 SQL 적용 (Railway는 사용자 수동 실행) | developer-backend |
| `POST /api/yacht/match` 요청 바디 확장 (`diceType`) + 매칭 풀 분리 | developer-backend |
| 점수 계산기 D8 분기 (`SEVENS`/`EIGHTS` 추가, 스트레이트 셋 확장) | developer-backend |
| 보너스 판정 로직 모드별 분기 (D6=63/35, D8=108/35) | developer-backend |
| 턴당 굴림 횟수 모드별 분기 (D6=3, D8=4 — `YachtScoreRules.maxRollsPerTurn()`) | developer-backend |
| `/api/yacht/rankings` D6/D8 분리 응답 | developer-backend |
| WebSocket 페이로드 `diceType` 필드 추가 | developer-backend |
| 모드 선택 화면 + 모드 라우팅 + 매칭 호출 시 `diceType` 전달 | developer-frontend |
| 점수판 14행 렌더 + 모바일 스크롤/sticky | developer-frontend |
| d8 주사위 3D 모델 (`OctahedronGeometry` 또는 동등) + 1~8 텍스처 | developer-frontend |
| QA 시나리오 (모드 분리 매칭, 14행 점수, 백필 검증) | qa-tester |

---

## 17. 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-05-10 | 최초 작성. 사용자 정책 결정 8건 그대로 반영. |
| 2026-05-10 | D8 균형 재조정: 턴당 굴림 3→4, 상단 보너스 임계 84→108(면 합 비례). D6 룰은 변경 없음. |
