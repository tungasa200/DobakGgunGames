# PRD — Block Crush (블록 크러시)

- 작성자: planner
- 최초 작성일: 2026-05-18
- 상태: 초안 (Phase 1 — 구현 착수 가능)
- 라우트: `/block-crush`
- 게임 키: `block-crush` (DB/엔드포인트 식별자, **`blockfall` 충돌 금지**)
- 레벨 키: `classic` (단일)
- 모드 적용 범위: **일반 모드 Only** (Excel 모드 N/A — 사용자 지시: "이번 버전 제외")
- 접근 권한: **로그인 불필요** (전체 공개)
- Test Lab 노출 기본값: **ON** (HomePage Test Lab 카드에 노출)
- 관련 문서:
  - 참조 PRD: `docs/specs/brickbreaker.md`, `docs/specs/blockfall-insane-overhaul.md`
  - API 계약: `docs/specs/block-crush-api-contract.md` (별도 파일)
  - Progress: `docs/progress/planner-block-crush.md` (작업 로그)

---

## 1. 게임 개요

### 1.1 장르 / 레퍼런스
- **장르**: 폴리오미노 배치 퍼즐 (Spatial Placement Puzzle)
- **레퍼런스**: HungryStudio의 `Block Crush!` (모바일/웹 인기 캐주얼 퍼즐 — 8×8 그리드, 3블록 트레이, 줄 클리어 콤보)
- **유사 게임**: Wood Block Puzzle, 1010!
- 본 기획은 위 게임의 **공통 규칙**(상업적으로 보호되지 않는 일반화된 메커닉)을 기반으로 한 자체 구현.

### 1.2 목적
- DobakGgun Games의 솔로 미니게임 라인업에 **차분한 두뇌 퍼즐**(테트리스 같은 시간 압박 없음) 장르 추가.
- 기존 `Brick Breaker`(반사신경) / `Blockfall`(시간 압박 테트리스) 사이의 빈 자리 — "느긋하게 머리 쓰는" 카테고리 강화.
- 짧은 세션(3~10분) 단위로 누구나 즉시 학습 가능한 진입 장벽.
- 주간 / 전체 최고 기록 2종 랭킹으로 재플레이 유도.

### 1.3 대상 유저
- 모바일/PC 웹에서 잠깐 머리를 쓰고 싶은 라이트 유저.
- 비로그인으로 즉시 플레이 가능 — 신규 방문자 진입 장벽 최소화.
- 테트리스 못 하는 유저도 즐길 수 있는 무시간 압박 퍼즐 수요.

### 1.4 플레이 방식 요약
- 8×8 고정 그리드 보드.
- 매 라운드마다 하단 **트레이**에 폴리오미노 3개가 랜덤으로 표시됨.
- 드래그&드롭으로 보드의 빈 셀에 블록 배치. 회전 / 미리보기 회전 **없음**.
- 가로 또는 세로 한 줄이 모두 채워지면 즉시 해당 줄 전체 제거 + 점수 가산.
- 동시 다중 줄 클리어 시 보너스, 연속 클리어 시 콤보 보너스.
- 트레이 3개 모두 소진하면 새로운 랜덤 3개 보충.
- **게임 오버 조건**: 트레이의 3개 블록 중 **단 하나도** 보드의 빈 공간에 놓을 수 없는 상태.
- 게임 오버 시 닉네임 입력 → 주간/전체 랭킹 등재.

### 1.5 비목표 (Out of Scope)
- **Excel 모드** — 이번 버전 제외.
- **BGM / SFX** — 이번 버전 제외 (designer 재량으로 향후 추가 가능).
- 블록 회전 / 보드 회전.
- 보드 크기 변경, 난이도 분기 (Easy/Normal/Hard) — `classic` 단일.
- 일시정지 / 이어하기 / 세이브 — 게임 오버 시 무조건 처음부터.
- 유료/언락 콘텐츠.
- 멀티플레이 / 대전.
- 일별/시즌별 랭킹 (주간 + 전체만).

---

## 2. 유저 스토리

- **US-1 (핵심)** — As a casual visitor, I want to click "블록 크러시" on the Test Lab card and start playing without logging in, so that I can try the game immediately.
- **US-2** — As a player, I want to drag a block from the tray to a valid position on the board, so that I can place pieces intuitively.
- **US-3** — As a player, I want to see a preview/highlight of where the block will land while dragging, so that I can plan placements precisely.
- **US-4** — As a player, I want lines to clear automatically with a satisfying animation when a row or column is fully filled, so that I get clear feedback.
- **US-5** — As a player, I want bonus points for clearing multiple lines at once or in consecutive moves, so that combos feel rewarding.
- **US-6** — As a player, I want a clear HUD showing my current score, combo, and remaining tray pieces, so that I know my status at a glance.
- **US-7** — As a player, I want the game to end fairly when none of the 3 tray pieces can fit anywhere, so that I am not stuck.
- **US-8** — As a player, I want to register my final score with a nickname after game over, so that I can compete on the ranking board.
- **US-9** — As a returning player, I want to see both weekly and all-time best rankings, so that I have short-term and long-term goals.
- **US-10** — As a mobile player, I want touch-drag controls with a clear ghost preview offset above my finger, so that I can see the target cells while dragging.

---

## 3. 모드 적용 범위

- **일반 모드: 필수 (Must)**
- **Excel 모드: 해당 없음 (N/A)** — 사용자 지시: "이번 버전 제외"
- designer는 일반 모드만 명세 작성.
- developer-frontend는 일반 모드만 구현.
- qa-tester는 일반 모드만 검증.

---

## 4. 게임 규칙 (상세)

### 4.1 보드
- **그리드**: 8행 × 8열 = 64셀
- **상태**: 각 셀은 빈 칸(`null`) 또는 색상 키(string) 보유.
- **시작 상태**: 전부 빈 칸, 점수 0, 콤보 0, 라운드 0.
- **회전 / 변형 없음**: 보드도 블록도 회전 불가.

### 4.2 폴리오미노 블록
- 매 라운드 시작 시 트레이에 **3개**의 블록이 랜덤(균등 분포) 등장.
- 블록은 §4.3에 정의된 18종 폴리오미노 중에서 추첨 (회전 변형 포함된 사전 정의 목록).
- 3개 블록을 모두 보드에 배치한 시점에 **즉시** 새 랜덤 3개로 트레이 보충.
  - "3개 다 쓰기 전에는 보충 없음" 규칙으로 어려운 모양 강제 사용 유도.
- 트레이 블록 순서는 자유 (왼쪽/가운데/오른쪽 어느 것이든 먼저 사용 가능).

### 4.3 폴리오미노 형태 목록 (총 18종)

> 좌표는 `[row, col]` 오프셋 배열. 좌상단(0,0) 기준.
> 회전 변형은 별도 종으로 사전 정의(런타임 회전 X).

| 키 | 셀 수 | 오프셋 |
|:---|---:|:-------|
| `DOT_1`     | 1 | `[[0,0]]` |
| `I_2_H`     | 2 | `[[0,0],[0,1]]` |
| `I_2_V`     | 2 | `[[0,0],[1,0]]` |
| `I_3_H`     | 3 | `[[0,0],[0,1],[0,2]]` |
| `I_3_V`     | 3 | `[[0,0],[1,0],[2,0]]` |
| `I_4_H`     | 4 | `[[0,0],[0,1],[0,2],[0,3]]` |
| `I_4_V`     | 4 | `[[0,0],[1,0],[2,0],[3,0]]` |
| `I_5_H`     | 5 | `[[0,0],[0,1],[0,2],[0,3],[0,4]]` |
| `I_5_V`     | 5 | `[[0,0],[1,0],[2,0],[3,0],[4,0]]` |
| `SQ_2`      | 4 | `[[0,0],[0,1],[1,0],[1,1]]` |
| `SQ_3`      | 9 | `[[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2]]` |
| `L_TL`      | 3 | `[[0,0],[1,0],[1,1]]` (┘ 좌상 꺾임) |
| `L_TR`      | 3 | `[[0,1],[1,0],[1,1]]` (└ 우상 꺾임) |
| `L_BL`      | 3 | `[[0,0],[0,1],[1,0]]` (┐ 좌하 꺾임) |
| `L_BR`      | 3 | `[[0,0],[0,1],[1,1]]` (┌ 우하 꺾임) |
| `T_4`       | 4 | `[[0,0],[0,1],[0,2],[1,1]]` (T자) |
| `S_4`       | 4 | `[[0,1],[0,2],[1,0],[1,1]]` (S자) |
| `Z_4`       | 4 | `[[0,0],[0,1],[1,1],[1,2]]` (Z자) |

- **셀 수 분포**: 1셀(1) / 2셀(2) / 3셀(5) / 4셀(6) / 5셀(2) / 9셀(1)
- **추첨 가중치**: 각 종은 동일 확률(균등). 만약 후속 밸런싱이 필요하면 `weights` 테이블 도입 (Nice-to-have).
- 회전 변형(I/L/T 등)은 본 목록에 이미 변형별로 나열되어 있으므로 런타임 회전 코드 없음.

### 4.4 배치 규칙
- 드래그한 블록의 모든 오프셋이 **보드 안**(0 ≤ row,col ≤ 7)에 들어와야 함.
- 차지하려는 모든 셀이 **빈 칸**이어야 함 (한 칸이라도 점유 시 배치 불가).
- 유효 배치 시 즉시 보드에 색상 기록, 트레이에서 해당 블록 제거, 배치 점수 가산.
- 유효하지 않은 위치에 드롭한 경우 블록은 트레이 원위치로 복귀 (점수/콤보 변화 없음).

### 4.5 줄 클리어 규칙
- 블록 배치 직후 즉시 검사:
  - 가로 8칸이 모두 채워진 행(`row`)
  - 세로 8칸이 모두 채워진 열(`col`)
- 동시 검사 후 해당 행/열 전체를 빈 칸으로 만듬 (한 번에 일괄 제거).
- 한 번의 배치로 여러 줄이 동시에 클리어될 수 있음 (예: ㄱ자 모양으로 가로 1줄 + 세로 1줄 = 2줄 클리어).
- 클리어된 셀이 다시 채워지는 연쇄 콤보는 없음 (한 번 클리어 후 검사 종료).

### 4.6 게임 오버 판정
- 모든 배치 직후, 트레이에 남은 블록 각각에 대해:
  - 보드 어딘가에 합법적으로 배치 가능한 위치가 하나라도 있는지 검사.
- **트레이의 모든 블록이 어디에도 놓을 수 없는** 경우 즉시 게임 오버.
- 트레이가 보충 직후이고 그 3개 중 하나라도 놓을 수 있으면 게임 계속.

---

## 5. 점수 공식 (확정)

### 5.1 배치 점수
- **배치한 블록의 셀 수 × 1점**
- 예) `I_4_H` 배치 = +4점, `SQ_3` 배치 = +9점.

### 5.2 줄 클리어 기본 점수
- **클리어된 줄당 100점**
- 예) 1줄 클리어 = +100, 2줄 클리어 = +200(기본) + 보너스.

### 5.3 다중 클리어 보너스 (한 번의 배치로 동시 클리어)

> **총 줄 클리어 점수** = (줄 수 × 100) + 다중 보너스

| 동시 클리어 줄 수 | 다중 보너스 | 총 줄 점수 (기본 + 보너스) |
|---:|---:|---:|
| 1줄 | +0 | 100 |
| 2줄 | +100 | 300 |
| 3줄 | +300 | 600 |
| 4줄 | +600 | 1,000 |
| 5줄 | +1,000 | 1,500 |
| 6줄 | +1,500 | 2,100 |
| 7줄 | +2,100 | 2,800 |
| 8줄 | +2,800 | 3,600 |

- 5줄 이상은 공식: `bonus(n) = bonus(n-1) + 100 × (n-1)` (계차 100씩 증가).
- 이론상 동시 클리어 최대 = 8줄(가로 4 + 세로 4의 SQ_3 + 추가 조합 시 가능). 보드가 8×8이므로 한 번에 가로 8 + 세로 8 = **최대 16줄까지 이론 가능** (보드 전체 클리어 시).

> 16줄 케이스(보드 풀 → 한 번에 전부)는 사실상 불가능에 가깝지만 계산식은 동일하게 연속 적용. 서버 검증은 §6의 절대 상한만 사용.

### 5.4 콤보 보너스
- **콤보 정의**: 직전 배치에서 1줄 이상 클리어, 그리고 **현재 배치에서도** 1줄 이상 클리어한 경우 콤보 카운트 +1.
- 클리어 없이 배치만 한 경우 콤보 0으로 리셋.
- 콤보 보너스: `comboCount × 50점` (현재 배치의 줄 점수에 추가 가산)
  - comboCount 1 = +50
  - comboCount 2 = +100
  - comboCount 3 = +150
  - ... (상한 없음, 이론상)

### 5.5 점수 가산 순서 (한 배치당)
1. 배치 점수 (셀 수 × 1)
2. 줄 클리어 검사
3. 줄 클리어 있으면:
   - 줄 기본 점수 (n × 100)
   - 다중 보너스 (§5.3 표)
   - 콤보 카운트 갱신
   - 콤보 보너스 (`combo × 50`)
4. 줄 클리어 없으면 콤보 카운트 0으로 리셋

### 5.6 이론적 최대 점수 (현실적 상한 계산)

> 게임은 트레이 보충이 무한 반복되므로 이론 최대 점수는 무한대. 다만 "현실적 상한"을 위해 다음 가정으로 계산.

#### 가정
- 평균 1게임당 트레이 보충 횟수: **40회** (= 120블록 배치)
  - 상위 유저 기준 매우 긴 게임 = 200블록 배치까지 가능 (보수적 추정 240블록까지).
- 평균 배치 셀 수: **4셀**
- 클리어 빈도: 매 3블록당 1줄 클리어, 다중 클리어는 평균 1.2배.
- 콤보 평균: 2 정도 유지.

#### 1게임 평균 점수 추산
- 배치 점수: 120블록 × 4셀 = **480점**
- 줄 클리어 점수: 40줄 × (100 기본 + 50 콤보 평균) × 1.2 다중배수 ≈ **7,200점**
- 합계 평균: **약 7,000~8,000점**

#### 상위 1% 유저 추정
- 배치: 240블록 × 4셀 = 960점
- 줄: 80줄 × 200(평균 콤보 포함) × 1.3 ≈ 20,800점
- **상위 1% 상한 추정: 약 25,000점**

#### 극단적 이론치 (운빨 + 신급 플레이)
- 배치 1,000블록 × 5셀 = 5,000점
- 줄 300줄 × (100 + 콤보 평균 200) × 다중 1.5 = 135,000점
- **극단 이론치: 약 150,000점** (사실상 도달 불가)

→ **현실 상한: 약 25,000~50,000점**, 극단 이론 상한: **약 150,000~200,000점**

---

## 6. 서버 검증 상한

### 6.1 검증 정책
- 클라이언트는 점수와 클리어한 총 줄 수를 함께 전송.
- 서버는 두 값의 **절대 상한** + **비율 정합성**을 검증.

### 6.2 절대 상한

| 필드 | 클라이언트 전송 범위 | 서버 거부 임계값 | 근거 |
|:---|:---|:---|:---|
| `score` | 0 ~ Integer.MAX_VALUE | `> 9_999_999` (천만) | 극단 이론치 150,000 × 약 66배 안전 마진 |
| `linesCleared` | 0 ~ Integer.MAX_VALUE | `> 100_000` (십만) | 극단 이론치 300줄 × 약 333배 안전 마진 |

### 6.3 비율 정합성 (Soft Validation)
- 1줄 클리어당 받을 수 있는 최대 점수 추산 = **5,000점** (8줄 동시 + 콤보 50 가정의 매우 관대한 상한)
- 검증식: `score <= 1000 + linesCleared * 5000 + 240 * 9` (배치 점수 여유분 포함)
- 위반 시 400 Bad Request `"점수가 유효 범위를 초과했습니다."`
- 단, 검증 강도는 brickbreaker (`score 0 ~ 99_999_999` 단순 범위) 수준으로 시작하고, 어뷰징 사례 누적 후 조정 가능.

### 6.4 1차 검증 단순화 안 (구현팀 선택지)

> developer-backend가 둘 중 선택. PRD는 더 안전한 (B)안을 권장.

- **(A) 단순안**: `score 0 ~ 9_999_999` + `linesCleared 0 ~ 100_000` 절대 범위만 검사.
- **(B) 비율안 (권장)**: 위 절대 범위 + `score <= 1000 + linesCleared * 5000` 비율 검사.

---

## 7. Must / Should / Nice-to-have / 제외

### 7.1 Must (출시 필수)
- 8×8 보드 + 트레이 3블록 + 드래그&드롭 배치
- 18종 폴리오미노 정의 + 균등 랜덤 추첨
- 줄 클리어 + 다중 보너스 + 콤보 보너스
- 게임 오버 판정 (트레이 3개 전부 배치 불가 시)
- 점수/콤보 HUD, 게임 오버 모달
- 닉네임 입력 + 주간/전체 랭킹 등록
- 비로그인 플레이 + 랭킹 등록 허용
- 세션 시작 / 검증 / 1회용 소비 (기존 SessionService 패턴 재사용)
- 모바일 터치 드래그 지원 (Touch + Pointer Events)
- HomePage Test Lab 카드에 노출 (기본 ON)

### 7.2 Should (출시 권장)
- 드래그 중 보드에 **착지 미리보기**(반투명 셀 하이라이트)
- 줄 클리어 애니메이션 (페이드아웃 또는 슬라이드)
- 콤보 카운트 강조 표시 (`COMBO ×3` 같은 텍스트)
- 게임 오버 시 트레이의 어떤 블록도 못 놓는다는 사실을 시각적으로 안내
- LocalStorage에 최근 게임 점수 저장 (오프라인 베스트 기록)
- 모바일에서 드래그 시 손가락 위가 아닌 **약간 위쪽 오프셋**으로 미리보기 표시 (손가락에 가려지지 않도록)

### 7.3 Nice-to-have (차후 업데이트)
- 폴리오미노 추첨 가중치 조정 (큰 블록 등장 빈도 튜닝)
- 보드 색상 테마 변경 (designer 영역)
- 일별 랭킹 추가
- 통계 페이지 (총 플레이 횟수, 평균 점수)
- BGM/SFX (별도 PRD 시 추가)
- Excel 모드 (별도 PRD 시 추가)

### 7.4 제외 (이번 버전 명시적 제외)
- Excel 모드
- BGM/SFX
- 블록 회전
- 일시정지/이어하기
- 난이도 분기

---

## 8. 엣지 케이스 & 에러 시나리오

| # | 케이스 | 기대 동작 |
|--:|:-------|:---------|
| 1 | 드래그 중 트레이 영역 밖 → 보드 안 진입 | 미리보기 표시, 드롭 시 유효성 검사 |
| 2 | 드래그 중 보드 밖 → 트레이 영역 또는 빈 공간 드롭 | 트레이 원위치 복귀 |
| 3 | 한 셀이라도 점유된 셀에 드롭 | 트레이 원위치 복귀, 색상 또는 진동으로 거부 피드백 |
| 4 | 블록의 일부가 보드 경계 밖으로 나간 위치에 드롭 | 트레이 원위치 복귀 |
| 5 | 첫 트레이 3블록 중 1개라도 어디에도 못 놓는 경우 (게임 시작 직후) | 그 1개를 못 놓아도 나머지 2개로 게임 계속, 마지막에 게임 오버 가능 |
| 6 | 트레이 3블록 보충 직후 즉시 게임 오버 (모두 못 놓는 경우) | 즉시 게임 오버 모달 표시 |
| 7 | 동시에 가로 + 세로 동시 클리어 (예: 십자형 마지막 셀 채움) | 줄 점수 + 다중 보너스 (n=2) 정상 가산 |
| 8 | 보드를 완전히 비우는 한 수 (보드 전체 클리어) | 줄 점수 + 다중 보너스 + 콤보 모두 정상 가산, 추가 "PERFECT" 같은 시각 효과는 Should |
| 9 | 페이지 새로고침 / 탭 닫기 | 진행 상태 사라짐, 세션도 무효화 (저장 X) |
| 10 | 모바일 드래그 중 다른 손가락이 화면 터치 | 첫 손가락의 드래그만 인식 (멀티터치 무시) |
| 11 | 닉네임이 badwords 위반 | 422 + 클라이언트 토스트 "사용할 수 없는 닉네임" |
| 12 | 같은 sessionId로 두 번째 등록 시도 | 400 또는 409 (기존 SessionService 패턴 따름 — 이미 SUBMITTED 상태) |
| 13 | 비로그인 + 닉네임 미입력 | 등록 버튼 비활성화 또는 클라이언트 검증 거부 |
| 14 | 백엔드 500 에러 | 클라이언트가 점수와 닉네임을 토스트로 안내 + 재시도 버튼 |
| 15 | 매우 짧은 게임(첫 3블록 직후 게임 오버) | 점수 0 또는 매우 낮은 점수로 정상 등록 가능 |
| 16 | 매우 긴 게임 (1시간 이상 진행) | 세션 만료(7200s) 직전 자동 종료 또는 만료 후 등록 시 400 |
| 17 | 모바일 가로/세로 회전 | 보드 비율 유지, HUD reflow |
| 18 | 매우 작은 화면 (320px 폭) | 보드는 화면 폭에 맞춤, 트레이는 가로 스크롤 없이 한 화면에 |

---

## 9. 성공 지표 (KPI)

| 지표 | 측정 | 목표 (출시 4주) |
|:----|:-----|:--------------|
| DAU (Block Crush 진입) | `/block-crush` 페이지뷰 | 150+ |
| 평균 세션 길이 | 첫 진입 → 게임 오버까지 | 5분 이상 |
| 평균 배치 블록 수 | 게임 오버 시점까지 배치한 블록 수 | 60+ |
| 평균 점수 | 게임 오버 시점 점수 | 5,000+ |
| 랭킹 등록률 | 랭킹 등록 / 게임 오버 | 25% 이상 |
| 재방문률 | 7일 내 2회 이상 플레이 IP 비율 | 20% 이상 |
| 모바일 비율 | 모바일 디바이스에서 1게임 이상 완주 | 40% 이상 |

---

## 10. 영향 파일 목록 (구현팀 참조)

### 10.1 백엔드 (신규 + 수정)
```
backend/src/main/java/com/dobakggun/entity/BlockCrushRanking.java                (신규)
backend/src/main/java/com/dobakggun/repository/BlockCrushRankingRepository.java  (신규)
backend/src/main/java/com/dobakggun/service/BlockCrushValidationService.java     (신규 — 선택 사항, 검증 (B)안 채택 시)
backend/src/main/java/com/dobakggun/service/RankingService.java                  (수정 — VALID_GAMES + queryWeekly/queryAlltimeBest/countByIpHash/saveRanking/validateScoreBounds/validateLevel 스위치 분기)
backend/src/main/java/com/dobakggun/service/SessionService.java                  (수정 — EXPIRE_SECONDS 맵에 "block-crush" → 7200L 추가)
backend/src/main/java/com/dobakggun/dto/RankingResponse.java                     (수정 — BlockCrushRanking instanceof 분기 추가, linesCleared 필드 반환)
backend/src/main/java/com/dobakggun/dto/RankingRequest.java                      (수정 불필요 — 기존 linesCleared 필드 재사용)
docs/sql/block-crush-ranking-schema.sql                                          (신규 — DDL, 사용자가 Railway에서 직접 실행)
```

### 10.2 프론트엔드 (신규 + 수정)
```
frontend/src/games/block-crush/types.ts                       (신규 — GameState, Block, Tray, Cell 타입)
frontend/src/games/block-crush/pieces.ts                      (신규 — 18종 폴리오미노 정의)
frontend/src/games/block-crush/scoring.ts                     (신규 — 배치/줄/콤보 점수 계산)
frontend/src/games/block-crush/useBlockCrushGame.ts           (신규 — useReducer 기반 게임 로직)
frontend/src/games/block-crush/BlockCrushBoard.tsx            (신규 — 보드 컴포넌트)
frontend/src/games/block-crush/BlockCrushTray.tsx             (신규 — 트레이 컴포넌트)
frontend/src/games/block-crush/BlockCrush.module.css          (신규 — CSS Modules)
frontend/src/pages/BlockCrushPage.tsx                         (신규 — 페이지 컨테이너 + HUD + 랭킹)
frontend/src/App.tsx                                          (수정 — /block-crush 라우트 추가)
frontend/src/pages/HomePage.tsx                               (수정 — Test Lab 카드에 "블록 크러시" 노출, 기본 ON, BETA 뱃지)
frontend/src/api/rankings.ts                                  (수정 불필요 — 기존 generic 래퍼 사용 가능, 필요 시 SubmitPayload 타입 검토)
```

### 10.3 공통 / 문서
```
docs/specs/block-crush-prd.md                                 (본 문서)
docs/specs/block-crush-api-contract.md                        (별도 API 계약 문서)
docs/progress/planner-block-crush.md                          (작업 로그)
docs/design/block-crush-design.md                             (designer 영역)
docs/review/block-crush-test-plan.md                          (qa-tester 영역)
```

> **shared/badwords.json 수정 없음** — 기존 필터 그대로 사용.

---

## 11. 작업 핸드오프

이 PRD가 확정되는 즉시 다음 팀원에게 인계:

- **designer** → `docs/design/block-crush-design.md` 작성
  - 보드 컬러 팔레트, 폴리오미노 색상 매핑, 트레이/HUD/모달 레이아웃, 줄 클리어 애니메이션, 드래그 중 미리보기 시각 명세
- **developer-frontend** → §10.2 파일 목록 기준 구현
  - `useBlockCrushGame.ts` (useReducer + sessionIdRef), `pieces.ts`, `scoring.ts`
  - 드래그&드롭은 Pointer Events 권장 (마우스/터치 통합)
- **developer-backend** → §10.1 + 별도 API 계약 문서 기준 구현
  - `BlockCrushRanking` 엔티티/Repository, `RankingService.VALID_GAMES`에 `"block-crush"` 추가
  - SessionService EXPIRE_SECONDS 맵에 `"block-crush"` 추가
  - `docs/sql/block-crush-ranking-schema.sql` 작성 → 사용자가 Railway에서 직접 실행 (직접 쓰기 금지)
- **qa-tester** → §8 엣지 케이스 + §9 KPI 기반 테스트 플랜 → `docs/review/block-crush-test-plan.md`

---

## 12. 오픈 퀘스천

| ID | 질문 | 영향 영역 | 우선순위 |
|---:|:----|:---------|:--------|
| OQ-1 | 폴리오미노 추첨 가중치 (큰 블록 등장 빈도)를 균등으로 유지할지 | planner, frontend | Low — 출시 후 데이터 기반 조정 |
| OQ-2 | 게임 오버 직후 광고 노출/유도 UI 도입 여부 | planner | Low — 본 버전 미적용 |
| OQ-3 | 서버 검증을 단순안(A) vs 비율안(B) 중 어느 쪽으로 할지 | backend | Medium — 권장 (B), backend 판단 |
| OQ-4 | 트레이 보충 시점 (3개 전부 소진 vs 즉시 1개 보충) | planner | 확정 — **3개 전부 소진 후 보충** |
| OQ-5 | 보드 전체 클리어 시 추가 보너스 도입 여부 | planner | Low — Should 단계, MVP 미적용 가능 |

---

## 13. 변경 이력

| 날짜 | 작성자 | 내용 |
|:----|:------|:----|
| 2026-05-18 | planner | 초안 작성 (8×8, 18종 폴리오미노, 점수 공식, API 계약 분리, Excel 모드 제외) |

