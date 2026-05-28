# PRD — Yacht D12 모드 (정십이면체 주사위 확장)

- 작성자: planner
- 최초 작성일: 2026-05-28
- 상태: **초안** — 사용자 검토 대기
- 기반 문서:
  - 본체 PRD: `docs/specs/yacht-prd.md`
  - D8 PRD: `docs/specs/yacht-d8-mode-prd.md` (D8 균형 산정 근거)
  - API 계약: `docs/specs/yacht-api-contract.md`
- 관련 progress:
  - `docs/progress/planner-yacht-d12.md` (본 PRD 작업 로그)

---

## 1. 목적 / 배경

### 배경
- 야추 D6 / D8 두 모드는 안정 운영 중이며, 사용자 확장 모드 요청에 대응해 **D12 (정십이면체) 모드**를 추가한다.
- D8 도입 시 정립한 균형 공식(면당 적중률 균등화 + 면 합 비례 임계 상향)을 동일 원리로 D12에 적용한다.
- D6 / D8 / D12 모드는 매칭/랭킹/점수 룰이 모드별로 완전히 격리된다.

### 목표
- 기존 야추 인프라(WebSocket, 매칭, 점수판, DP 봇)를 그대로 재사용하면서 **주사위 면 수만 12로 확장**.
- 사용자가 야추 진입 시 **D6 / D8 / D12 중 하나를 선택**한 뒤 매칭이 진행.
- 같은 모드(`diceType`)끼리만 매칭 풀이 형성된다 — D12 방은 D6 / D8 방과 절대 섞이지 않음.
- 랭킹은 모드별로 분리 집계 — `D6 랭킹`, `D8 랭킹`, `D12 랭킹`을 별도 응답으로 노출.

### 비목표 (Out of Scope)
- **Excel 모드 (해당 없음)** — D8과 동일하게 일반 모드만 운영.
  - 사용자 지시에 따라 본 PRD는 일반 모드만 명세하며, Excel 적용 여부는 사용자 결정 사항(§13 OQ-EXCEL).
- d10/d20 등 추가 면 수: 본 PRD 미포함.
- 기존 D6 / D8 게임 데이터 마이그레이션: 본 PRD가 새로 도입하는 `D12` 값은 신규 행에만 적용.
- 모드 간 통합 랭킹 / 합산 랭킹: 비목표 (세 모드 완전 분리).
- 진행 중 모드 변경: 한 게임 시작 후 모드 전환 불가.

---

## 2. 모드 적용 범위

- **일반 모드: 필수 (Must)**
- **Excel 모드: 해당 없음 (N/A)** — 사용자 지시 확인 필요(§13 OQ-EXCEL).
- designer는 **일반 모드만** 명세 작성 (모드 선택 화면에 D12 카드 추가 + 12면 주사위 시각 + 16행 점수판 모바일 정책).
- developer-frontend는 **일반 모드만** 구현.
- qa-tester는 **일반 모드만** 검증.

---

## 3. 모드 정의 표 (D6 vs D8 vs D12)

| 항목 | D6 (기존) | D8 (기존) | **D12 (신규)** |
|---|---|---|---|
| 주사위 면 수 | 6 (1~6) | 8 (1~8) | **12 (1~12)** |
| 주사위 개수 | 5 | 5 | **5** |
| 한 턴 굴림 횟수 | 최대 3 | 최대 4 | **최대 5** (§3.1 근거) |
| 상단 족보 | ONES~SIXES (6개) | ONES~EIGHTS (8개) | **ONES~TWELVES (12개)** |
| 상단 보너스 임계 | 63점 | 112점 | **245점** (§3.2 근거) |
| 상단 보너스 점수 | +35 | +35 | **+35** (모드 공통 유지 — §3.3) |
| 하단 족보 | 6개 (CHOICE / 4K / FH / L.STR / B.STR / YACHT) | 동일 6개 | **동일 6개** (신규 족보 도입 안 함 — §3.4) |
| LITTLE_STRAIGHT 가능 셋 | 3개 | 5개 | **9개** ({1234} ~ {9,10,11,12}) |
| BIG_STRAIGHT 가능 셋 | 2개 | 4개 | **8개** ({1~5} ~ {8~12}) |
| YACHT 점수 | 50 | 50 | **50** (공통) |
| 총 족보 수 | 12 | 14 | **18** (상단 12 + 하단 6) |
| 한 게임 라운드 수 | 참가자수 × 12 | 참가자수 × 14 | **참가자수 × 18** |
| 정원 | 2~6명 | 2~6명 | **2~6명** (동일) |
| 매칭 풀 | D6 전용 | D8 전용 | **D12 전용** (완전 분리) |
| 랭킹 집계 | D6 단독 | D8 단독 | **D12 단독** (완전 분리) |
| YACHT 단판 확률(1롤) | 1/6⁴ ≈ 0.077% | 1/8⁴ ≈ 0.024% | **1/12⁴ ≈ 0.0048%** |
| 1주사위 면당 적중률 | 1/6 ≈ 16.7% | 1/8 = 12.5% | **1/12 ≈ 8.3%** |

### 3.1 한 턴 굴림 횟수 산정 — 5회

D8 PRD §5.7.1에서 정립한 "1주사위 적중률 균등화" 공식을 D12에 적용:

| 모드 | 1주사위 적중률 (n롤) | 공식 |
|---|---|---|
| D6 3롤 | 1−(5/6)³ ≈ **42.1%** | 기준 |
| D8 4롤 | 1−(7/8)⁴ ≈ **41.4%** | D6 ≒ |
| D12 4롤 | 1−(11/12)⁴ ≈ **29.4%** | D6 대비 70% — 부족 |
| **D12 5롤** | 1−(11/12)⁵ ≈ **35.5%** | D6 대비 84% — **권장** |
| D12 6롤 | 1−(11/12)⁶ ≈ **40.7%** | D6 ≒ — 게임 시간 과부하 |

**결정**: 5회.
- 6롤은 D6에 가장 근접하지만 한 턴당 결정 횟수가 5회 reroll × 5 주사위 = UI 클릭 부하 급증, 한 게임이 D6 대비 ~2.5배(18라운드 × 5/3 ≈ 2.5) 길어져 체감 페이스 저하.
- 5롤은 D6 대비 약 16% 적중률 손실에 그치며, 카테고리 선택 유연성(상단 12개)과 LITTLE/BIG_STRAIGHT 조합 확장(§3.5)이 보정 효과를 제공.
- DP 봇 vCache 크기(rollsLeft 차원)는 D8(4) → D12(5)로 1단계 증가 — 영향 §4.

### 3.2 상단 보너스 임계 — 245점 (D8 균형 정책 동일 적용)

**1단계 — 면 합 비례 계산**
- D6: 63 = Σ(1~6) × 3 = 21 × 3
- D8 비례값: 63 × Σ(1~8)/Σ(1~6) = 63 × 36/21 = 108
- D12 비례값: 63 × Σ(1~12)/Σ(1~6) = 63 × 78/21 = **234**

**2단계 — D8 정책 동일 보정**
- D8는 비례값 108을 실 플레이 검증 후 **112로 상향** (windfall 발생 시 나머지 평균 이상 요구 기준).
- D12도 동일 비율로 보정: 112/108 ≈ 1.037 → 234 × 1.037 ≈ 243.
- 12개 카테고리의 평균 face 추정: 245 / 78 × 12 ≈ 3.77개/카테고리 → D8(112 ÷ 36 × 8 ≈ 24.9 → 평균 3.11)과 유사 수준 어려움.

**3단계 — 정수 정합**
- 보너스 임계는 12로 나누어떨어지는 직관적 정수가 바람직 (245 = 21+22+...+28의 부분합 등 자연 분할 없음).
- 240 (= 평균 4.0 × Σ12 면수 환산), 245, 252 (= 21×12) 후보 비교:
  - **240**: 평균 4.0개 — D8 비례 기준(평균 3.11) 대비 다소 어려움. windfall 보정 약함.
  - **245**: 평균 4.08개 — D8 상향 정책과 가장 정합.
  - **252**: 평균 4.2개 — 11/12 windfall 발생 빈도(약 17%)에도 도달 어려움. 너무 가혹.

**결정**: **245점**. (사용자 검토 의문점 §13 OQ-2)

> 245 결정 근거: D8가 비례값 108에서 +4(=3.7%) 상향한 112로 확정한 비율을 D12에 동일 적용(234 × 1.037 ≈ 243 → 정수 정합 245). 평균 4.08개/카테고리는 D8 평균 3.11개/카테고리보다 높지만, D12는 카테고리 12개 분산 효과와 high-face windfall(10·11·12 다수 적중) 빈도가 D8 대비 높아 균형 유지.

### 3.3 상단 보너스 점수 — +35 유지

- D6 / D8 / D12 모두 +35로 통일.
- 근거: 보너스 점수를 모드별로 다르게 책정하면 사용자 학습 부담 증가. 보너스의 가성비는 임계(63/112/245)와 라운드 수(12/14/18)가 함께 조절하므로 점수는 공통 유지.
- 임계 도달 시 한계 효용 비교(보너스/임계): D6 ≈ 55.6%, D8 ≈ 31.3%, **D12 ≈ 14.3%**.
  - D12는 임계가 큰 만큼 상대 보상이 작아 보이지만, **절대 +35점은 그대로 결승선 부근 역전 카드**로 기능 (게임 평균 총점 D6 ~150, D8 ~250, D12 ~400 추정).

### 3.4 하단 신규 족보 — **도입 안 함**

D12는 1~12 면 중 신규 패턴(예: 6쌍 / Two Pair / Straight 6연속 등)이 이론상 가능하나, 본 PRD에서는 **하단 6개 족보 그대로 유지**.

**근거**:
- 모드 학습 부담 최소화 (D6 → D12 자연 확장).
- D8 PRD 결정 정책 (하단은 모드 공통, 면 범위만 확장) 일관성 유지.
- 6연속 스트레이트(`SUPER_STRAIGHT` 등)는 5주사위로 불가(주사위가 5개이므로 6면 연속 불가).
- D12 면 범위에서 LITTLE/BIG_STRAIGHT 가능 셋이 9/8개로 폭증 → 기존 족보 안에서 충분한 다양성 확보.

**대안 검토 결과 (모두 미채택)**:
- `TWO_PAIRS` (서로 다른 2쌍): D6/D8과 호환 안 됨 → 모드 분기 늘어남.
- `STRAIGHT_FLUSH` (연속 + 홀/짝): 직관성 떨어짐.

> 향후 D12 운영 데이터 누적 후 별도 PRD로 신규 족보 도입 재검토.

### 3.5 LITTLE_STRAIGHT / BIG_STRAIGHT 가능 셋 (D12)

**LITTLE_STRAIGHT (4개 연속) — 9개**:
- {1,2,3,4} {2,3,4,5} {3,4,5,6} {4,5,6,7} {5,6,7,8}
- **{6,7,8,9} {7,8,9,10} {8,9,10,11} {9,10,11,12}** (D12 추가 4개)

**BIG_STRAIGHT (5개 연속) — 8개**:
- {1~5} {2~6} {3~7} {4~8}
- **{5~9} {6~10} {7~11} {8~12}** (D12 추가 4개)

판정 로직은 기존(`Set`에 모든 원소 포함 / set 크기 5 검증)과 동일 — 면 범위만 12까지 확장.

---

## 4. 봇 AI 설계 (DP 엔진 확장)

### 4.1 핵심 수치 (D6 / D8 / D12 비교)

| 항목 | D6 | D8 | **D12** |
|---|---|---|---|
| 면 수 (`faces`) | 6 | 8 | **12** |
| 총 결과 수 (`faces^5`) | 7,776 | 32,768 | **248,832** |
| 정렬 멀티셋 수 (`C(faces+4, 5)`) | 252 | 792 | **4,368** |
| 슬롯 수 (`numSlots`) | 12 | 14 | **18** |
| W 테이블 크기 ((1<<numSlots)×(upperCap+1)) | 4,096 × 64 = **262,144** | 16,384 × 113 = **1,851,392** | 262,144 × 246 = **64,487,424** |
| W 테이블 메모리 (8byte/entry) | 2.1MB | 14.8MB | **515.9MB** |
| 최대 rollsLeft (`maxRollsPerTurn-1`) | 2 | 3 | **4** |
| vCacheSize | (2+1)×252 = 756 | (3+1)×792 = 3,168 | **(4+1)×4,368 = 21,840** |
| packKey 비트폭 (faceBits) | 3 → 17bit | 4 → 22bit | **4 → 22bit** (faces=12는 4bit 충분) |
| keyToVIdx 배열 크기 | ~112K | ~2.2M | **~22M** (배열 인덱스 = 22bit max) |

### 4.2 기존 YachtDpEngine / YachtDpContext 재사용성

**결론**: 코드 자체는 100% 재사용 가능. 단, **W 테이블 메모리(515MB)와 사전 계산 시간이 가장 큰 리스크**.

#### 재사용 가능한 이유
- `YachtDpContext`는 이미 `faces` 파라미터를 받아 멀티셋/V캐시/W테이블 크기를 동적 계산.
- `YachtDpEngine`, `YachtDpPrecomputer`는 컨텍스트만 D12로 바꾸면 동작.
- `YachtDpTable`의 magic number 공식(`0x59445030 | ctx.faces`)이 `0x5944503C` (= "YDP" + 0x3C='<', faces=12)로 자동 계산. **단, `'0' + 12 = 60` = ASCII `<` 문자라 외관상 깔끔하지 않음**. (§4.4 참조)

#### 메모리/시간 리스크 — 별도 §4.3

#### 즉시 필요한 변경
- `YachtDpContext`에 `public static final YachtDpContext D12 = new YachtDpContext(new D12Rules());` 추가.
- `YachtDpBot`의 `MAX_V_CACHE` 계산을 `Math.max(D6, D8, D12)`로 확장.
- `tableRef(ctx)` 분기를 if-else 또는 switch로 확장 (현재는 `ctx.faces == 6 ? d6 : d8` 삼항 → switch 권장).

### 4.3 W 테이블 메모리/사전 계산 시간 리스크

#### 메모리: 515.9MB
- Railway 인스턴스 메모리에 부담 (현재 백엔드 Heap 사이즈 사용자 확인 필요 — §13 OQ-MEM).
- 직렬화 파일도 약 515MB → Git LFS 또는 .gitignore + 부팅 시 계산 + 디스크 캐시 전략 필요.

#### 사전 계산 시간 (추정)
- D8: ~수십 분 수준 (병렬 처리 후).
- D12는 W 테이블 entry 수가 35배, 매 entry당 V 계산 비용도 멀티셋 수 4368/792 = 5.5배 → **단순 곱하면 D8의 ~200배 (수십 시간)**.
- 실측 전까지는 정확치 불명. §13 OQ-DP에 사용자 결정 위탁.

#### 완화 옵션
1. **풀 DP 강행**: 코드 변경 최소, 메모리/시간 비용 감수.
2. **DP 차원 축소**: `upperCap` 차원을 256 → 64 양자화 (8단계 묶음) → W 테이블 1/4 축소 (130MB). 보너스 판정 정확도 미세 손실.
3. **Heuristic 봇 사용**: D12는 풀 DP 대신 휴리스틱(YachtBotStrategy 기반 룰 봇) 사용. 강도 D6/D8 대비 낮음.
4. **봇 사용 안 함**: D12는 PvP 전용으로 한정 (봇 매칭 불가).

> **권장 (planner 의견)**: 1단계는 옵션 3 (Heuristic) 또는 4 (봇 없음)로 출시, 사용자 트래픽 검증 후 풀 DP 도입 결정. 단, 사용자 결정 사항 (§13 OQ-DP).

### 4.4 packKey 비트 / magic number

- faces=12는 4비트 (1~12)로 표현 가능 → packKey 비트폭은 D8과 동일 (rollsLeft 3bit + 4주사위×4bit = 21bit + s[0] 비트 = 22bit). 단, rollsLeft 최대값이 4(=D12)로 3비트 필요 (D8은 3 → 2비트). YachtDpContext.packKey의 `rollsLeft | (s[0] << 2)` 부분은 2비트 고정이므로 **rollsLeft가 4일 때 충돌 발생**. (참고: `rollsLeft = maxRollsPerTurn - 1 = 4`)

> **수정 필요**: `YachtDpContext.packKey()` 의 rollsLeft 비트폭을 2 → 3비트로 확장 (`s[0] << 3` 등 후속 shift도 +1). D6/D8 호환을 위해 `rollBits` 필드 도입 권장.

- magic number: `0x59445030 | 12 = 0x5944503C` ("YDP<"). 동작에는 문제 없으나 가독성 위해 12의 경우 별도 처리 검토 가능 (예: `0x59445031, 0x59445032` 식 인덱스 부여). developer-backend 재량.

---

## 5. 3D 주사위 구현 (정십이면체)

### 5.1 기존 자산 활용

`frontend/public/sample/dodecahedron.html`에 이미 구현된 자산:
- 20개 정점 (황금비 PHI 기반) + 12개 정오각형 면 좌표 (`RAW_V`, `FACES`, `FACE_NUM`).
- 4×3 아틀라스 텍스처 (숫자 1~12, 6/9 밑줄 처리).
- `buildDie(scaleR, gap, bulge, segs)`: inset pentagon + edge bevel (flat quad) + vertex cap (flat triangle) 조합으로 라운디드 정십이면체 빌드.
- `smoothSeams(geom, tol)`: 정점 위치 그룹핑 후 normal 평균 (D8의 `smoothNormalsAtSeams`와 동일 패턴).
- `MeshPhysicalMaterial` 설정 (clearcoat, roughness 등).

### 5.2 신규 생성 파일

**`frontend/src/games/yacht/components/dice/createDodecahedronGeometry.ts`** (신규)
- dodecahedron.html의 `buildDie` + `smoothSeams` 함수를 TS ESM으로 포팅.
- export 함수:
  - `createDodecahedronGeometry(R, gap, bulge, segs, numeralExtent): THREE.BufferGeometry`
  - `createDodecahedronAtlasTexture(renderer): THREE.CanvasTexture` (4×3 grid, 1~12 텍스처)
  - `getFaceNumberFromCentroid(...)`: 12면 중 어느 면인지 판정 (FACE_NUM 매핑 활용)
  - `smoothSeams(geom, tol)`: D8의 `smoothNormalsAtSeams`와 동일 동작 (이름 통일을 위해 export 또는 공용 모듈 분리 검토)
- `createOctahedronGeometry.ts`와 파일 구조 / export 시그니처를 의도적으로 유사하게 맞춰 `YachtDiceRow3D.tsx`에서 분기 호출 단순화.

### 5.3 YachtDiceRow3D.tsx 통합

기존 D6 / D8 분기에 D12 케이스 추가:
```ts
if (diceType === 'D12') {
  geometry = createDodecahedronGeometry(R, gap, bulge, segs);
  atlasTexture = createDodecahedronAtlasTexture(renderer);
  rollAnimation = createDodecahedronRoll(...); // 굴림 시 회전 종료 각도 매핑
}
```

### 5.4 면 → 숫자 매핑 (Roll 종료 각도)

D6는 BoxGeometry의 6개 표준 면, D8는 옥탄트 부호로 1~8 매핑. D12는 12개 정오각형 면의 법선 벡터와 카메라 up vector dot product로 "위쪽" 면 판정. `FACE_NUM` 배열 활용.

- 굴림 결과 dice 값(1~12)이 위쪽 면에 오도록 종료 각도를 계산.
- developer-frontend가 정확한 회전 행렬을 산정 (designer는 굴림 애니메이션 timing/easing 명세).

### 5.5 모드 선택 화면 / 미리보기

- `YachtModeDicePreview3D.tsx`: D12 케이스 추가, 정십이면체 미리보기 회전 표시.
- `YachtModeCard.tsx`: D12 카드 추가 (designer가 비주얼 결정).

---

## 6. 매칭 정책 (모드 분리)

### 6.1 핵심 원칙
- **같은 `diceType` 방끼리만 매칭** (D6 / D8 / D12 완전 분리).
- D6 / D8 정책 §6과 동일, 단순히 enum에 `D12` 추가.

### 6.2 매칭 알고리즘

기존 D8 PRD §6.2 그대로 적용. `diceType` 필터에 D12 케이스 포함.

```
요청: POST /api/yacht/match { "diceType": "D6" | "D8" | "D12" }
```

### 6.3 잘못된 `diceType` 요청
- 기존 정책 유지 — `INVALID_DICE_TYPE` 응답 (허용 값 목록에 D12 추가).

---

## 7. 랭킹 정책 (모드 분리)

### 7.1 핵심 원칙
- D6 / D8 / D12 랭킹 완전 별개 리더보드.
- `yacht_record.dice_type` 컬럼 enum에 `D12` 추가만 하면 기존 집계 로직 그대로 동작.

### 7.2 GET `/api/yacht/rankings` 응답 구조

```json
{
  "D6":  [ ... ],
  "D8":  [ ... ],
  "D12": [
    { "rank": 1, "userId": 404, "nickname": "유저D", "winCount": 3, "totalScore": 1290, "playedCount": 7 }
  ]
}
```

### 7.3 기존 데이터
- D12는 신규 enum 값 — 백필 불필요. 첫 D12 게임 완료 시 첫 행 INSERT.

---

## 8. DB 스키마 변경

### 8.1 `YachtDiceType` enum 확장

```java
public enum YachtDiceType {
    D6,
    D8,
    D12   // 신규
}
```

### 8.2 `yacht_room.dice_type` 컬럼

- 기존 VARCHAR(4) → **`D12` 저장 가능** (VARCHAR(4) 길이 충분).
- 컬럼 스키마 변경 불필요. enum 값만 추가.

### 8.3 `yacht_record.dice_type` 컬럼

- 동일 — VARCHAR(4) 그대로, enum 값만 확장.
- 마이그레이션 SQL: **불필요** (스키마 변경 없음).
- JPA `@Enumerated(EnumType.STRING)` 자동 처리.

### 8.4 검증
- developer-backend는 application 부팅 시 `YachtDiceType.valueOf("D12")`가 정상 동작하는지 확인.
- 기존 D6 / D8 데이터에 영향 없음.

---

## 9. API 변경

### 9.1 `POST /api/yacht/match`

**요청**:
```json
{ "diceType": "D12" }
```

`diceType` 허용 값: `D6` / `D8` / **`D12`**.

**응답** — 기존 구조에 `diceType: "D12"` 포함 가능.

**에러**:
- D8 PRD §9.1 그대로 — `INVALID_DICE_TYPE`에 D12도 허용 값으로 추가.

### 9.2 `GET /api/yacht/room/{roomId}`

**응답** — `diceType: "D12"` 가능. `scoreboard.scores`는 18개 키:
- 상단 12: `ONES`, `TWOS`, ..., `TWELVES`
- 하단 6: `CHOICE`, `FOUR_OF_A_KIND`, `FULL_HOUSE`, `LITTLE_STRAIGHT`, `BIG_STRAIGHT`, `YACHT`

### 9.3 `scoreKey` enum 확장 (D12 한정)

기존 14개 (D8 기준) + **`NINES`**, **`TENS`**, **`ELEVENS`**, **`TWELVES`** 4개 추가 → 총 18개.

- D6 방에서 `SEVENS`/`EIGHTS`/`NINES`/`TENS`/`ELEVENS`/`TWELVES` 전송 → `INVALID_SCORE_KEY`.
- D8 방에서 `NINES`/`TENS`/`ELEVENS`/`TWELVES` 전송 → `INVALID_SCORE_KEY`.
- D12 방에서는 18개 모두 유효.

### 9.4 `GET /api/yacht/rankings`

§7.2 참조 — `D6` / `D8` / `D12` 분리 응답.

### 9.5 `GET /api/yacht/rooms/status`

```json
{
  "D6":  { "activeRooms": 3, "activePlayers": 12 },
  "D8":  { "activeRooms": 1, "activePlayers": 4 },
  "D12": { "activeRooms": 0, "activePlayers": 0 }
}
```

---

## 10. WebSocket 페이로드 변경

### 10.1 `GAME_STARTED`

```json
{
  "diceType": "D12",
  "totalRounds": 36,    // 2명 × 18 = 36
  "rollsLeft": 5,
  ...
}
```

### 10.2 `ROLL_RESULT`

- 형식 변경 없음. `dice` 값 범위만 D12에서 1~12.

### 10.3 `SCORE_RECORDED`

- 형식 변경 없음. `scoreKey`로 `NINES` ~ `TWELVES` 가능.
- 보너스 임계는 서버가 모드별 자동 적용 (D6=63 / D8=112 / D12=245).

### 10.4 기타 이벤트
- `TURN_STATE`, `TURN_CHANGED`, `GAME_OVER` 등 모두 형식 변경 없음.

---

## 11. UI 흐름

### 11.1 모드 선택 화면

기존 D6 / D8 카드에 **D12 카드 추가** (3카드 가로 배치):
- 데스크탑: 3카드 가로 노출.
- 모바일: 세로 스택 (D6 → D8 → D12 순).

각 D12 카드 요소:
- 12면 주사위 시각 (designer 결정 — 정십이면체 3D 미리보기 권장)
- "정십이면체 (D12) — 18 족보"
- 짧은 설명: "상단 12개 · 보너스 245점 · 한 턴 5롤 · 평균 게임 시간 ~30분 (참가자수 2명 기준)"

### 11.2 게임 화면 — 18행 점수판

D8 PRD §12 (14행)에서 한 단계 더 압박:
- **데스크탑 (≥ 1280px)**: 18행 모두 한 화면 노출 시도. 행 높이 D6 대비 65~70% 축소 허용.
- **태블릿 (1024~1279px)**: 18행 모두 노출 시도, 안 될 경우 점수판 영역 세로 스크롤.
- **태블릿 (768~1023px)**: 점수판 영역 세로 스크롤 **Must**.
- **모바일 (< 768px)**: 점수판 영역 세로 스크롤 **Must**.
  - 현재 턴 플레이어 행 + 내 행 sticky 노출 **Must** (D8는 Should이었으나 D12는 18행이라 강화).

### 11.3 축약 정책
- 모바일 카테고리명 약자:
  - 상단: `1` `2` `3` `4` `5` `6` `7` `8` `9` `10` `11` `12`
  - 하단: `Choice` `4-Kind` `F.House` `L.Str` `B.Str` `Yacht`
- 점수 셀 폰트 추가 축소 가능.

### 11.4 모드 표기 배지
- 점수판 상단에 `D12` 배지 노출 (D6 / D8과 동일 컴포넌트).

---

## 12. 게임 시간 / 페이스 분석

### 12.1 예상 게임 시간

| 모드 | 라운드 수 (2명) | 턴당 평균 시간 | 게임 시간 (2명 기준) |
|---|---|---|---|
| D6 | 24 | ~30초 | ~12분 |
| D8 | 28 | ~35초 (4롤) | ~16분 |
| D12 | 36 | ~45초 (5롤) | **~27분** |

- D12는 D8 대비 게임 시간 약 1.7배 증가.
- AFK / 이탈 위험 증가 → 턴 타임아웃 정책(`turnDeadlineAt`) 검토 필요 (§13 OQ-TIMEOUT).

### 12.2 페이스 완화 대안 (사용자 결정 위탁)
- 5롤 → 4롤로 축소 (단, §3.1 적중률 손실 ↑).
- 라운드 수 축소 (단, 18 족보 모두 채워야 함 — 축소 불가).
- 턴 시간 제한 (예: 60초 → AFK 시 자동 ZERO 처리).

---

## 13. 의문점 / 사용자 결정 필요

| ID | 질문 | 영향 | 임시 결정 |
|---|---|---|---|
| **OQ-EXCEL** | D12 모드를 Excel 모드에도 적용하는가? | Excel 모드 분기 작업 (디자인 + 프론트). | **N/A 가정** (D6 / D8와 동일 정책). 사용자 답변 필요. |
| **OQ-ROLLS** | 한 턴 굴림 5회가 적정한가? 4회(빠른 게임) / 6회(D6 적중률 동등) 옵션 비교. | 게임 시간 ±25%, DP vCache 크기 변동. | **5회 권장** (§3.1). |
| **OQ-2** | 상단 보너스 임계 245점이 적정한가? 240 / 252 비교. | 보너스 도달률, 게임 균형. | **245점 잠정** (§3.2 D8 비율 동일 적용). 베타 검증 후 조정 가능. |
| **OQ-DP** | D12 봇 AI를 풀 DP / Heuristic / 봇 없음 중 어느 방식으로 출시하는가? | 백엔드 메모리 ~515MB / 사전 계산 시간 수십 시간 vs. 봇 강도 저하. | **단계적 출시 권장**: 1단계 Heuristic (또는 봇 없음), 2단계 풀 DP. 사용자 결정 필요. |
| OQ-MEM | Railway 백엔드 인스턴스 메모리 한도 (현재 ?) | 풀 DP 채택 가능 여부 결정. | 사용자 확인 필요 — Heap 사이즈 / 가용 RAM. |
| OQ-NEWPATTERN | 12면 활용 신규 족보(TWO_PAIRS 등) 도입 검토 여부. | 점수판 행수 ↑, 학습 부담 ↑. | **§3.4: 미도입.** 운영 후 별도 PRD로 재검토. |
| OQ-TIMEOUT | 턴 타임아웃을 D12에서 단축/연장 / AFK 자동 ZERO 처리 도입 여부. | 게임 페이스. | **D8 정책 그대로** 잠정. 베타 운영 후 조정. |
| OQ-MOBILE | 18행 점수판 모바일 sticky 미구현 시 UX 허용 수준. | 모바일 가독성. | designer 결정 위임. |
| OQ-PACKBITS | YachtDpContext.packKey()의 rollsLeft 비트폭 2→3 확장이 D6/D8 W 테이블 캐시 파일(`yacht-d6-dp.bin` / `yacht-d8-dp.bin`)을 invalidate 하는가? | 기존 캐시 재계산 필요 여부. | **재계산 필요 가능성 높음** — magic/version 1단계 bump 권장. developer-backend 확인. |
| OQ-WAITING | D12 모드 초기 매칭 풀이 작아 대기 시간 ↑ 우려. | D6 / D8 매칭과 동일 — 자동 방 생성으로 완화. | 출시 후 모니터링. |

---

## 14. 환경변수

- **추가 환경변수 없음.**
- 단, D12 W 테이블 사전 계산을 부팅 시점에 강제할지 옵션(예: `YACHT_D12_DP_PRECOMPUTE=eager|lazy|disabled`)을 도입할 가치 있음. developer-backend가 OQ-DP 결정에 따라 옵션 추가 여부 판단.

---

## 15. 성공 지표

### 출시 완료 기준
- [ ] 홈에서 야추 진입 시 D6 / D8 / D12 3개 모드 선택 화면 노출
- [ ] D12 매칭이 D6 / D8 매칭과 절대 섞이지 않음 (E2E 검증)
- [ ] D12 게임에서 상단 12 족보 + 하단 6 = 18행 점수판 정상 동작
- [ ] D12 보너스 (임계 245, 점수 35)가 상단 12개 모두 기록 시점에 자동 부여
- [ ] D12 게임에서 한 턴 최대 5회 굴림이 가능, D6/D8는 변동 없음 (3/4)
- [ ] D12 LITTLE_STRAIGHT 9셋, BIG_STRAIGHT 8셋 정상 인정
- [ ] `/api/yacht/rankings`가 `D6` / `D8` / `D12` 분리 응답
- [ ] 기존 D6 / D8 게임이 회귀 없이 동작
- [ ] `YachtDiceType.D12` 저장/조회 정상 동작 (yacht_room / yacht_record)
- [ ] 12면 주사위 3D 모델이 모든 브라우저에서 정상 렌더 (Chrome/Safari/Firefox 데스크탑+모바일)
- [ ] (봇 도입 시) D12 봇이 합리적 의사결정 수행 (휴리스틱 또는 풀 DP)

### 관찰 지표
- D6 / D8 / D12 일일 매칭 수 비율
- D12 평균 게임 시간 (목표 ≤ 30분)
- D12 상단 보너스 도달률 (목표 30~50%, OQ-2 검증)
- D12 YACHT 발생률 (목표 ~1게임당 0.3회, 1/12⁴ × 평균 시도수 기준 추정)
- D12 LITTLE/BIG_STRAIGHT 발생률
- D12 게임 중도 이탈률 (D6/D8 대비)
- 모드 선택 화면 → D12 카드 클릭 → 매칭 성공 전환율

---

## 16. 파일별 작업 목록 (구현 시 건드릴 파일)

### 백엔드 (Java)

| 파일 | 작업 |
|---|---|
| `entity/yacht/YachtDiceType.java` | enum에 `D12` 추가 |
| `service/yacht/D12Rules.java` | **신규** — D6Rules / D8Rules 패턴 복제, 상단 12, 임계 245, maxRolls 5, 스트레이트 9/8셋 |
| `service/yacht/YachtScoreRulesFactory.java` | `case D12 -> D12` 추가 + D12 싱글톤 생성 |
| `service/yacht/bot/YachtDpContext.java` | `public static final YachtDpContext D12 = new YachtDpContext(new D12Rules());` 추가, `packKey` rollBits 2→3 확장 (또는 `rollBits` 필드 도입), UPPER_ORDER 배열 길이 8→12 (NINES ~ TWELVES 추가) |
| `service/yacht/bot/YachtDpBot.java` | `MAX_V_CACHE` 계산에 D12 포함, `d12TableRef` 추가, `tableRef(ctx)` 분기 확장, `initCtx` D12 호출 |
| `service/yacht/bot/YachtDpTable.java` | magic number 공식 검증 (12 → `0x5944503C`), 버전 bump 검토 (rollBits 변경으로 D6/D8 캐시 invalidate 필요 시) |
| `service/yacht/YachtScoreRules.java` | 주석 업데이트 (D6/D8/D12 3모드 명시) |
| `dto/yacht/YachtMatchRequest.java` | `diceType` 검증 로직에 D12 추가 |
| `dto/yacht/YachtRankingResponse.java` | `D12` 필드 추가 |
| `dto/yacht/YachtRoomStatePayload.java` | (변경 없음 — `diceType` 필드는 String/enum) |
| `service/yacht/YachtMatchService.java` (또는 동등) | 매칭 풀 분리 로직에 D12 케이스 추가 |
| `service/yacht/YachtGameService.java` (또는 동등) | 룰 호출 시 `YachtScoreRulesFactory.get(diceType)` — 이미 동적 분기이면 변경 없음 |
| `service/yacht/YachtRankingService.java` (또는 동등) | D12 집계 추가 |
| `service/yacht/bot/YachtBotStrategy.java` | (OQ-DP 결정에 따라) D12 휴리스틱 분기 추가 |
| `src/test/java/com/dobakggun/service/yacht/YachtBotSimulator.java` | D12 시뮬레이션 테스트 추가 |
| `src/main/resources/yacht-d12-dp.bin` | (풀 DP 채택 시) 사전 계산 후 저장 — Git LFS 또는 .gitignore 검토 |

### 프론트엔드 (TypeScript / React)

| 파일 | 작업 |
|---|---|
| `games/yacht/types/yacht.types.ts` | `DiceType` union에 `'D12'` 추가, `ScoreKey`에 `'nines' \| 'tens' \| 'elevens' \| 'twelves'` 추가, `SCORE_KEYS_D12` / `UPPER_SCORE_KEYS_D12` 신규 export, `SCORE_KEYS_BY_MODE` / `UPPER_SCORE_KEYS_BY_MODE` / `UPPER_BONUS_THRESHOLD_BY_MODE` / `MAX_ROLLS_BY_MODE`에 D12 매핑 추가, `SCORE_LABELS` / `SCORE_LABELS_SHORT`에 4개 추가, `SERVER_KEY_MAP` / `CLIENT_KEY_MAP`에 4개 추가, `YachtRankingResponse` / `YachtRoomStatusByMode`에 D12 필드 추가 |
| `games/yacht/types/scoreCalc.ts` | D12 점수 계산 분기 (상단 12, 스트레이트 9/8셋) |
| `games/yacht/components/dice/createDodecahedronGeometry.ts` | **신규** — dodecahedron.html의 buildDie/smoothSeams 포팅, atlas texture 생성, geometry export |
| `games/yacht/components/dice/YachtModeDicePreview3D.tsx` | D12 케이스 추가 (정십이면체 미리보기 회전) |
| `games/yacht/components/YachtDiceRow3D.tsx` | D12 분기 — geometry / material / 굴림 종료 각도 계산 |
| `games/yacht/components/YachtModeCard.tsx` | D12 카드 추가 (designer 결정 비주얼) |
| `games/yacht/components/YachtModeBadge.tsx` | D12 배지 케이스 추가 |
| `games/yacht/components/YachtScoreBoard.tsx` | 18행 렌더, 모바일 sticky 강화 |
| `games/yacht/YachtSelectPage.tsx` | 3카드 레이아웃 (D6 / D8 / D12), D12 매칭 호출 |
| `games/yacht/YachtPage.tsx` | diceType === 'D12' 케이스 라우팅 |
| `games/yacht/hooks/useYachtGame.ts` | maxRolls 모드 분기 (D12=5) |
| `games/yacht/components/YachtGameScreen.tsx` | 18행 점수판 + 5롤 표시 |
| `games/yacht/components/YachtResultScreen.tsx` | D12 결과 모달 — 모드 배지 |
| `games/yacht/components/YachtGameOverModal.tsx` | D12 케이스 |
| `games/yacht/components/YachtWaitingRoom.tsx` | D12 모드 표기 |

### 디자인 / 문서

| 파일 | 작업 |
|---|---|
| `docs/design/yacht-d12-design.md` | **신규** — 모드 선택 화면 3카드 레이아웃, D12 주사위 시각, 18행 점수판 모바일 정책 (designer 작성) |
| `docs/specs/yacht-prd.md` | (선택) D6 / D8 / D12 3모드 운영 명시 |
| `docs/specs/yacht-api-contract.md` | D12 enum / 18개 scoreKey 추가 |
| `docs/progress/planner-yacht-d12.md` | **신규** — 본 PRD 작업 로그 |
| `docs/progress/designer-yacht-d12.md` | **신규** — 디자인 작업 |
| `docs/progress/developer-backend-yacht-d12.md` | **신규** |
| `docs/progress/developer-frontend-yacht-d12.md` | **신규** |
| `docs/progress/qa-tester-yacht-d12.md` | **신규** |

---

## 17. 책임 매트릭스

| 산출물 | 담당 |
|---|---|
| 본 PRD | planner |
| `docs/design/yacht-d12-design.md` (모드 선택 3카드 + 18행 점수판 + 12면 주사위 시각) | designer |
| `YachtDiceType` enum 확장 + `D12Rules` 구현 + Factory 분기 | developer-backend |
| `YachtDpContext.D12` 등록 + packKey 비트 확장 + DP 봇 분기 (OQ-DP 결정 후) | developer-backend |
| `POST /api/yacht/match` D12 허용 + 매칭 풀 분리 검증 | developer-backend |
| `/api/yacht/rankings` D12 분리 응답 | developer-backend |
| WebSocket 페이로드 D12 전파 검증 | developer-backend |
| 모드 선택 화면 3카드 + D12 매칭 호출 | developer-frontend |
| `createDodecahedronGeometry.ts` 신규 + `YachtDiceRow3D` D12 분기 | developer-frontend |
| 18행 점수판 + 모바일 sticky 강화 | developer-frontend |
| QA 시나리오 (D12 매칭 분리, 18행 점수, 18개 scoreKey, 1~12 dice 값, 5롤 동작) | qa-tester |
| 봇 시뮬레이션 (D12 풀 DP / Heuristic 검증) | developer-backend + qa-tester |

---

## 18. 단계별 출시 권장 (Phasing)

OQ-DP 결정에 따라 다음과 같이 단계 출시 권장:

### Phase 1 — 기본 동작 (봇 없음 또는 Heuristic)
- 백엔드: D12 enum / 룰 / API 분기
- 프론트엔드: 모드 선택 D12 카드 + 18행 점수판 + 12면 3D 주사위
- 봇: 휴리스틱 또는 봇 매칭 비활성화
- 목표: PvP 매칭만 동작, 사용자 트래픽 검증

### Phase 2 — 풀 DP 봇 (트래픽 확인 후)
- 백엔드: `yacht-d12-dp.bin` 사전 계산 + AtomicReference 등록
- 메모리 확보: Railway 인스턴스 업그레이드 검토
- 봇 매칭 활성화

### Phase 3 — 운영 데이터 기반 조정
- 보너스 임계 245 → 240 / 252 조정 검토
- 5롤 → 4롤 단축 검토
- 신규 족보 (TWO_PAIRS 등) 도입 검토

---

## 19. 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-05-28 | 최초 초안. D8 균형 정책(면당 적중률 균등화 + 면 합 비례 임계 상향) 동일 적용. 사용자 검토 의문점 10건 명시. |
