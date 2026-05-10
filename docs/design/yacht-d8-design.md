# UX 명세 — Yacht D8 모드 확장 (yacht-d8-design)

- 작성자: designer
- 작성일: 2026-05-10
- PRD 참조: `docs/specs/yacht-d8-mode-prd.md` (2026-05-10 확정)
- 기반 명세: `docs/design/yacht-game.md`, `yacht-waiting.md`, `yacht-result.md`
- 모드 적용: **일반 모드만** (Excel 모드 N/A — PRD §2 지시 준수)
- CSS 기준: `frontend/src/games/yacht/components/yacht.module.css` (현행 토큰 체계 `--yacht-*` 연장)

---

## 목차

1. 모드 선택 화면 (신규 — `YachtModeSelectScreen`)
2. 14행 점수판 레이아웃 (D8 모드)
3. D8 3D 주사위 시각 (`YachtDiceOctahedron`)
4. 모드 표식 (게임 화면 헤더)
5. 결과 / 대기실 화면 변동 사항
6. 기존 컴포넌트 변경 영향 (props 표)
7. CSS 변경 명세 (신규 클래스 / 변수)

---

## 1. 모드 선택 화면 (신규)

### 1.1 라우트 및 진입 흐름

```
[홈 — "야추 플레이" 버튼 클릭]
        ↓
[라우트 가드 확인]
  비로그인: /login 리다이렉트
  로그인  : /yacht/select 진입
        ↓
[YachtModeSelectScreen 렌더]
  두 카드 동시 노출 (D6 / D8)
        ↓ 카드 클릭
[POST /api/yacht/match { diceType: "D6" | "D8" }]
        ↓
[roomId 수신 → /yacht/room/{roomId} navigate]
  (mode 정보는 서버 응답 diceType으로 관리 — query string 또는 location state 중
   developer-frontend가 선택. 명세는 navigate 시 diceType을 함께 전달하는 것만 요구)
```

뒤로가기 동작: `/yacht/select` → 홈(`/`) 복귀 (browser history 1단계 pop).

### 1.2 와이어프레임

#### 데스크탑 (769px 이상)

```
┌──────────────────────────────────────────────────────────┐
│  [← 홈으로]              Yacht                            │  ← 헤더 56px
├──────────────────────────────────────────────────────────┤
│                                                          │
│              모드를 선택하세요                             │  ← 섹션 타이틀
│         원하는 주사위 모드로 매칭이 시작됩니다             │  ← 서브
│                                                          │
│  ┌───────────────────────┐  ┌───────────────────────┐   │
│  │   [D6 주사위 아이콘]   │  │   [D8 주사위 아이콘]   │   │
│  │                       │  │                       │   │
│  │   정육면체 (D6)        │  │   정팔면체 (D8)        │   │  ← 모드명
│  │                       │  │                       │   │
│  │   12 족보             │  │   14 족보             │   │  ← 족보 수
│  │   보너스 기준 63점     │  │   보너스 기준 84점     │   │  ← 보너스 임계
│  │   라운드수 × 12       │  │   라운드수 × 14       │   │  ← 라운드 수
│  │                       │  │                       │   │
│  │   ── 현재 대기 중 ──  │  │   ── 현재 대기 중 ──  │   │
│  │   D6 방 N개 활성      │  │   D8 방 N개 활성      │   │  ← 활성 방 통계
│  │                       │  │                       │   │
│  │   D6 TOP5             │  │   D8 TOP5             │   │  ← 랭킹 미리보기
│  │   1. 유저A  4321점    │  │   1. 유저C  2450점    │   │
│  │   2. 유저B  3210점    │  │   2. (없음) —         │   │
│  │                       │  │                       │   │
│  │  [ D6로 매칭 시작 ]   │  │  [ D8로 매칭 시작 ]   │   │  ← CTA 버튼
│  └───────────────────────┘  └───────────────────────┘   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

#### 모바일 (480px 이하)

```
┌───────────────────────────────┐
│  [← 홈으로]      Yacht         │  ← 헤더
├───────────────────────────────┤
│                               │
│       모드를 선택하세요         │
│  원하는 모드로 매칭이 시작됩니다│
│                               │
│  ┌─────────────────────────┐  │
│  │   [D6 아이콘 48x48]     │  │
│  │   정육면체 (D6)         │  │
│  │   12 족보 · 보너스 63점 │  │
│  │   D6 방 N개 활성        │  │
│  │   TOP3: 유저A 4321 ···  │  │
│  │  [ D6로 매칭 시작 ]     │  │
│  └─────────────────────────┘  │
│                               │
│  ┌─────────────────────────┐  │
│  │   [D8 아이콘 48x48]     │  │
│  │   정팔면체 (D8)         │  │
│  │   14 족보 · 보너스 84점 │  │
│  │   D8 방 N개 활성        │  │
│  │   TOP3: 유저C 2450 ···  │  │
│  │  [ D8로 매칭 시작 ]     │  │
│  └─────────────────────────┘  │
│                               │
└───────────────────────────────┘
```

### 1.3 헤더 컴포넌트

기존 yacht-waiting.md §3 헤더와 동일한 구조. 변경 사항:
- 중앙 타이틀: "Yacht"
- 우측: 빈 영역

### 1.4 모드 카드 컴포넌트 명세

#### 컨테이너

```
display         : flex
flex-direction  : column
align-items     : center
gap             : 16px
padding         : 24px 20px 20px
background      : var(--yacht-surface)          /* #ffffff */
border          : 2px solid var(--yacht-border) /* #cbd5e1 */
border-radius   : 16px
width           : 100%
max-width       : 340px (데스크탑) / 100% (모바일)
cursor          : pointer
transition      : border-color 150ms ease, box-shadow 150ms ease, transform 120ms ease
```

#### D6 카드 — hover / focus 상태

```
border-color    : var(--yacht-accent)           /* #4f6cd8 */
box-shadow      : 0 4px 20px rgba(79, 108, 216, 0.22)
transform       : translateY(-3px)
```

#### D8 카드 — hover / focus 상태

```
border-color    : var(--yacht-d8-accent)        /* #d86a4f — 신규 */
box-shadow      : 0 4px 20px rgba(216, 106, 79, 0.22)
transform       : translateY(-3px)
```

#### :active 상태 (공통)

```
transform       : translateY(0)
box-shadow      : none
transition      : transform 80ms ease
```

#### :focus-visible 상태 (키보드 접근)

```
outline         : 3px solid 해당 accentColor
outline-offset  : 2px
```

#### 카드 내부 요소 순서

| 순서 | 요소 | 명세 |
|---|---|---|
| 1 | 주사위 아이콘 영역 | 48x48px SVG 또는 3D 스냅샷 이미지. D6: 육면체 아이콘, D8: 팔면체 아이콘. alt="D6 정육면체 주사위" / alt="D8 정팔면체 주사위" |
| 2 | 모드명 | font-size 20px, font-weight 800. D6: color var(--yacht-accent), D8: color var(--yacht-d8-accent) |
| 3 | 설명 텍스트 행 | font-size 13px, color var(--yacht-text-sub). "N 족보 · 보너스 기준 Npt · 라운드 × N" |
| 4 | 활성 방 통계 | font-size 12px, color var(--yacht-text-sub). "현재 대기 중: N개 방". 로딩 중 "—" 표시 |
| 5 | 랭킹 미리보기 | 최대 5행(데스크탑) / 3행(모바일). font-size 12px. 1위 행은 accentColor 강조. 데이터 없으면 "랭킹 없음" dim 표시 |
| 6 | CTA 버튼 | width 100%, padding 12px 0. 아래 §1.5 참조 |

#### 랭킹 미리보기 상세

```
컨테이너:
  width           : 100%
  border-top      : 1px solid var(--yacht-border)
  padding-top     : 12px
  margin-top      : 4px

행 레이아웃:
  display         : flex
  gap             : 8px
  align-items     : center
  padding         : 3px 0

순위 번호:
  width           : 18px
  text-align      : center
  font-weight     : 700
  font-size       : 12px
  color           : var(--yacht-text-sub)
  1위만           : color var(--yacht-warn)     /* #d97706 */

닉네임:
  flex            : 1
  font-size       : 12px
  overflow        : hidden
  text-overflow   : ellipsis
  white-space     : nowrap

점수:
  font-size       : 12px
  font-weight     : 600
  color           : var(--yacht-text-sub)
```

데이터 출처: GET /api/yacht/rankings 응답의 D6 / D8 키.
로딩 중에는 각 행에 shimmer 스켈레톤(height 14px, border-radius 4px) 표시.

### 1.5 CTA 버튼 명세

D6 버튼:
```
텍스트          : "D6로 매칭 시작"
background      : var(--yacht-accent)           /* #4f6cd8 */
color           : #ffffff
border          : none
border-radius   : 10px
padding         : 12px 0
font-size       : 15px
font-weight     : 700
width           : 100%

:hover (hover: hover 미디어쿼리 안):
  opacity       : 0.88

:active:
  transform     : scale(0.98)

:disabled (매칭 요청 중 로딩):
  opacity       : 0.45
  cursor        : not-allowed
```

D8 버튼:
```
텍스트          : "D8로 매칭 시작"
background      : var(--yacht-d8-accent)        /* #d86a4f — 신규 */
color           : #ffffff
나머지 스타일   : D6 버튼과 동일
```

### 1.6 카드 클릭 동작

1. 버튼 비활성화 (중복 클릭 방지)
2. 버튼 텍스트: "매칭 중..." (로딩 스피너 인라인 표시)
3. POST /api/yacht/match { diceType: "D6" | "D8" } 호출
4. 성공: roomId 수신 → /yacht/room/{roomId} navigate (diceType state 함께 전달)
5. 실패(409 ALREADY_IN_ROOM): 기존 방으로 navigate + 토스트 안내
6. 실패(기타): 버튼 원상복구 + 에러 토스트

### 1.7 반응형 레이아웃

| 브레이크포인트 | 카드 배치 | 카드 최대 너비 |
|---|---|---|
| 데스크탑 (769px+) | flex-direction row, gap 24px | 340px |
| 태블릿 (481~768px) | flex-direction row, gap 16px | 280px |
| 모바일 (480px-) | flex-direction column, gap 16px | 100% |

### 1.8 접근성

```
카드 컨테이너:
  role            : "button"
  tabIndex        : 0
  aria-label      : "D6 정육면체 모드 선택, 12 족보, 보너스 63점"
                   "D8 정팔면체 모드 선택, 14 족보, 보너스 84점"

CTA 버튼:
  aria-busy       : "true" (매칭 요청 중)
  aria-label      : "D6로 매칭 시작" / "D8로 매칭 시작"

키보드:
  Enter / Space → 카드 클릭 동작 실행
  Tab           → D6 카드 → D8 카드 순 포커스
  Escape        → (아무 동작 없음, 뒤로가기는 브라우저 백 버튼만)

랭킹 미리보기:
  aria-label      : "D6 TOP 랭킹 미리보기" / "D8 TOP 랭킹 미리보기"
  role            : "list"
  각 행 role      : "listitem"
```

---

## 2. 14행 점수판 레이아웃 (D8 모드)

### 2.1 행 목록 — D8 전용 (16행 렌더)

| 행 순서 | 행 키 | 표시 이름 (전체) | 모바일 약자 | 섹션 |
|---|---|---|---|---|
| 1 | ONES | Ones | 1 | 상단 |
| 2 | TWOS | Twos | 2 | 상단 |
| 3 | THREES | Threes | 3 | 상단 |
| 4 | FOURS | Fours | 4 | 상단 |
| 5 | FIVES | Fives | 5 | 상단 |
| 6 | SIXES | Sixes | 6 | 상단 |
| 7 | SEVENS | Sevens | 7 | 상단 (D8 신규) |
| 8 | EIGHTS | Eights | 8 | 상단 (D8 신규) |
| 9 | — | 상단 합계 | Upper | 계산 |
| 10 | — | 상단 보너스 (+35) | Bonus | 계산 |
| 11 | CHOICE | Choice | Choice | 하단 |
| 12 | FOUR_OF_A_KIND | Four of a Kind | 4-Kind | 하단 |
| 13 | FULL_HOUSE | Full House | F.House | 하단 |
| 14 | LITTLE_STRAIGHT | Little Straight | L.Str | 하단 |
| 15 | BIG_STRAIGHT | Big Straight | B.Str | 하단 |
| 16 | YACHT | Yacht | Yacht | 하단 |
| 17 | — | 총합 | Total | 계산 |

D6는 기존 yacht-game.md §7.3 그대로 (12행 + 계산 행 3개 = 15행). 변경 없음.

### 2.2 상단 합계 표기 변경

| 모드 | 상단 합계 셀 표기 | 보너스 임계 |
|---|---|---|
| D6 | `{현재합계} / 63` | 63점 |
| D8 | `{현재합계} / 84` | 84점 |

D6 표기는 기존 명세 그대로 "/63". D8만 "/84"로 변경.
달성/미달 색상 판정 기준값: D6=63, D8=84 (서버가 bonusEarned 플래그로 알림).

### 2.3 행 높이 / 폰트 크기 — 모드별 권장값

| 항목 | D6 | D8 |
|---|---|---|
| 족보 행 높이 | 32px | 27px |
| 계산 행 높이 | 34px | 29px |
| 족보 이름 셀 font-size (데스크탑) | 13px | 12px |
| 점수 셀 font-size (데스크탑) | 14px | 13px |
| 족보 이름 셀 font-size (모바일) | 12px | 11px |
| 점수 셀 font-size (모바일) | 13px | 12px |
| 셀 padding (데스크탑) | 8px 10px | 5px 8px |
| 셀 padding (모바일) | 6px 4px | 4px 2px |

D8 행 높이는 D6 대비 약 85% 수준. 데스크탑(769px+)에서 16행이 스크롤 없이 한 화면에 들어오는 것을 목표로 함.

### 2.4 데스크탑 레이아웃 (769px 이상)

- 16행 전체를 gameRight 패널 안에 스크롤 없이 노출 (권장).
- gameRight 패널 height는 `gameBody`의 `overflow: hidden` 안에서 자연스럽게 100%를 채움.
- 행 높이 27/29px 권장값 적용 시 총 높이 약 460px — 일반적인 데스크탑 뷰포트에서 수용 가능.
- 수용 불가 뷰포트(height < 600px 등 극단적 경우): gameRight에 `overflow-y: auto` 허용.

### 2.5 태블릿 레이아웃 (481px ~ 768px)

- 16행 한 화면 노출 시도.
- 불가능한 경우 점수판 컨테이너 내부 `overflow-y: auto` 허용.
- 가로 스크롤(overflow-x)은 플레이어 수에 따라 기존과 동일하게 허용.

### 2.6 모바일 레이아웃 (480px 이하) — Must

점수판 컨테이너(`gameRight` 또는 동등한 래퍼):
```
overflow-y      : auto
overflow-x      : auto
-webkit-overflow-scrolling: touch
```

#### Sticky 정책

```
첫 번째 컬럼 (족보명 셀):
  position      : sticky
  left          : 0
  z-index       : 40
  background    : 해당 행 배경색과 동일

헤더 행 (플레이어 이름 행):
  position      : sticky
  top           : 0
  z-index       : 50
  background    : var(--yacht-surface2)   /* #f1f5f9 */
```

"현재 턴 플레이어 행"과 "내 행" 상단/하단 sticky는 PRD §12.2에서 Should 수준으로 명시됨. 이 명세에서는 구현 권장으로 정의:
- 실현 방식: `position: sticky; top: (headerHeight + turnIndicatorHeight)px` 또는 `bottom: 0`.
- developer-frontend가 DOM 구조에 따라 구현 여부 결정. 미구현 시 QA 패스 조건에서 제외.

#### 모바일 스크롤 힌트

```
점수판 하단 fade-out 그라데이션 (세로 스크롤 존재 시):
  position      : absolute
  bottom        : 0
  left          : 0
  right         : 0
  height        : 32px
  background    : linear-gradient(to bottom, transparent, var(--yacht-bg))
                  /* #f8fafc */
  pointer-events: none
  opacity       : 1 (스크롤이 최하단에 도달하면 opacity 0으로 transition)
```

### 2.7 D6 점수판 — 변경 없음

D6 모드의 점수판은 기존 yacht-game.md §7 명세를 그대로 따른다. 행 수, 높이, 폰트 크기 모두 기존 값 유지.

---

## 3. D8 3D 주사위 시각 (YachtDiceOctahedron)

### 3.1 재질 / 색감

octahedron.html 샘플의 `MeshPhysicalMaterial` 설정을 기준으로 D6 큐브와 동일한 흰 플라스틱 + clearcoat 마감 유지:

| 속성 | 값 | 비고 |
|---|---|---|
| color | 0xffffff | 흰 플라스틱 — D6와 동일 |
| roughness | 0.42 | 샘플과 동일 |
| metalness | 0.0 | 비금속 |
| clearcoat | 0.45 | 광택 코팅 — D6와 동일 |
| clearcoatRoughness | 0.32 | 샘플과 동일 |
| reflectivity | 0.45 | 샘플과 동일 |

배경 / 조명 / 그림자: 기존 darkBox (`#1e293b`) 그대로. 변경 없음.

숫자 텍스처:
- 배경: `#faf9f5` (샘플과 동일 — D6의 면 색과 동일 톤)
- 숫자 잉크: `#0c0c0c`
- 6 면에 밑줄 표시 (6과 9 혼동 방지) — 샘플 기준 유지
- 폰트: bold sans-serif ("Helvetica Neue", Arial fallback)

### 3.2 정지 시 면 정렬 — 8면 매핑 정의

octahedron.html `getFaceNumber` 함수 기준 표준 d8 룰 (마주보는 면 합 = 9):

| 면 | 법선 옥탄트 (sx, sy, sz) | 면 번호 | 마주보는 면 |
|---|---|---|---|
| 1 | (+, +, +) | 1 | 8 |
| 2 | (+, +, -) | 2 | 7 |
| 3 | (+, -, +) | 3 | 6 |
| 4 | (+, -, -) | 4 | 5 |
| 5 | (-, +, +) | 5 | 4 |
| 6 | (-, +, -) | 6 | 3 |
| 7 | (-, -, +) | 7 | 2 |
| 8 | (-, -, -) | 8 | 1 |

정지 시 카메라 방향(+Z)에 목표 면이 오도록 mesh.rotation을 설정:
- 목표 값 N을 위쪽(+Y 방향) 기준으로 표시하려면 해당 면의 법선이 +Z를 향하게 rotation 역산.
- 구체적 rotation 값 계산은 developer-frontend 구현 영역.
- 명세 요구사항: "서버에서 받은 dice[i] 값이 N일 때, +Z 방향에서 봤을 때 해당 면 번호 N이 정면에 오도록 정지."

### 3.3 굴림 애니메이션

D6와 완전히 동일한 톤 유지:

```
Duration        : 800ms (기존 동일)
Ease            : easeOutCubic (기존 동일)
RotState 구조   : 기존 YachtDiceRow3D의 RotState 패턴 그대로 사용
                  diceType에 따라 geometry만 교체 (BoxGeometry → OctahedronGeometry)

Phase 1 (0 ~ 40%): 주사위 위로 튀어오름 + 빠른 회전
  y 오프셋      : -40px ~ -80px (랜덤)
  rotation      : 랜덤 3축 회전 (각 축 240° ~ 720°)
  ease          : power2.out

Phase 2 (40% ~ 80%): 낙하
  y 복귀        : 원위치
  ease          : bounce.out

Phase 3 (80% ~ 100%): 정착
  최종 면 맞춤  : 목표 face에 맞는 rotation으로 고정
  ease          : power3.out

kept 주사위:
  제자리 wiggle : ±5° 3축, duration 300ms (D6와 동일)
```

### 3.4 KEEP 표시

기존 D6와 동일: `diceRow3DHitKept` 클래스의 `outline: 3px solid var(--yacht-kept)` 적용.
KEPT 레이블(diceKeptLabel)도 동일하게 적용.
D8 전용 추가 시각 처리 없음 — 일관성 유지.

### 3.5 주사위 크기

D6 큐브와 동일한 렌더 영역 크기를 사용. Three.js 씬 안에서 scale 조절로 동일 영역에 맞춤:
- 데스크탑: die-size 80px (기존과 동일)
- 모바일: die-size 56px (기존과 동일)

octahedron.html의 `oct.scale.set(0.7, 0.7, 0.7)` 값은 샘플 씬 비율 기준. 실제 게임 씬에서는 D6 큐브와 동일한 시각 크기가 되도록 scale을 조정 — developer-frontend 결정.

### 3.6 신규 컴포넌트 정의 — YachtDiceOctahedron

이 컴포넌트는 D8 모드에서 기존 `YachtDiceRow3D`를 대체하거나 내부에서 분기하는 방식으로 사용. 구현 방식은 developer-frontend가 결정. 명세는 인터페이스만 정의:

역할: 5개의 D8 정팔면체 주사위를 Three.js로 렌더링. 기존 YachtDiceRow3D와 동일한 레이아웃/박스/클릭 동작을 갖되, geometry가 OctahedronGeometry인 버전.

---

## 4. 모드 표식 (게임 화면 헤더)

### 4.1 배지 위치

헤더(`header` 클래스) 중앙 타이틀 옆 또는 우측에 인라인 배지로 표시.

```
┌────────────────────────────────────────────────────┐
│  [← 나가기]    Yacht  [D6]  또는  Yacht  [D8]       │
└────────────────────────────────────────────────────┘
```

데스크탑: 타이틀 "Yacht" 오른쪽에 배지 배치.
모바일: 타이틀 "Yacht" 아래 작은 배지로 이동하거나, 타이틀 옆 공간이 충분하면 동일하게 옆에 배치.

### 4.2 배지 스타일

D6 배지:
```
텍스트          : "D6"
background      : rgba(79, 108, 216, 0.12)      /* var(--yacht-accent) 기반 */
color           : var(--yacht-accent)            /* #4f6cd8 */
border          : 1px solid rgba(79, 108, 216, 0.3)
border-radius   : 6px
padding         : 2px 8px
font-size       : 11px
font-weight     : 700
letter-spacing  : 0.06em
```

D8 배지:
```
텍스트          : "D8"
background      : rgba(216, 106, 79, 0.12)       /* var(--yacht-d8-accent) 기반 */
color           : var(--yacht-d8-accent)          /* #d86a4f — 신규 */
border          : 1px solid rgba(216, 106, 79, 0.3)
border-radius   : 6px
padding         : 2px 8px
font-size       : 11px
font-weight     : 700
letter-spacing  : 0.06em
```

### 4.3 접근성

```
배지 컨테이너:
  aria-label      : "현재 모드: D6 정육면체" 또는 "현재 모드: D8 정팔면체"
  role            : "status"
  aria-live       : "off"   (게임 중 모드는 변경되지 않으므로 live 불필요)
```

---

## 5. 결과 / 대기실 화면 변동 사항

### 5.1 대기실 (YachtWaitingRoom) 변경

기존 대기실 명세(yacht-waiting.md)에서 추가되는 내용만 기재.

#### 헤더 모드 표식

대기실 진입 시점에 diceType이 확정되므로, §4와 동일한 배지를 헤더 타이틀 옆에 표시:

```
대기 화면 헤더 중앙:
  "Yacht  [D6]"  또는  "Yacht  [D8]"
  (§4.2 배지 스타일 동일 적용)
```

#### 매칭 로딩 스크린

기존 yacht-waiting.md §10.1 로딩 화면에 서브 텍스트 추가:
- "D6 매칭 중..." 또는 "D8 매칭 중..."
- 기존 "매칭 중..." 텍스트를 diceType 반영 텍스트로 교체.

#### 대기실 상태 텍스트

기존 5.1 상태별 텍스트에 모드 정보 삽입:

| 조건 | 메인 텍스트 |
|---|---|
| 1인만 입장 | "D8 플레이어를 기다리는 중..." (diceType에 따라 "D6" / "D8") |
| 그 외 | 기존 텍스트 그대로 |

### 5.2 결과 화면 (YachtResultScreen) 변경

기존 yacht-result.md 명세에서 추가되는 내용만 기재.

#### 헤더 모드 표식

결과 헤더에도 §4 배지 동일 적용:
```
"Yacht  [D6]"  또는  "Yacht  [D8]"
```

#### 결과 화면 점수판 — 상세 보기

yacht-result.md §8 점수 상세 보기 패널의 족보 목록이 D8에서는 14행으로 확장됨.
§2.1 행 목록 기준으로 렌더. 스타일은 기존 동일 (read-only 상태 A).

#### GAME_OVER 페이로드

`diceType` 필드는 GAME_STARTED 수신 시 클라이언트가 이미 보관 중이므로, 결과 화면에서도 동일 값 사용. 추가 API 호출 불필요.

### 5.3 대기실 랭킹 섹션 — 모드 분리 표시

기존 대기실 하단 `rankingSection`을 D6 / D8 두 탭 또는 두 섹션으로 분리.

#### 와이어프레임 (탭 방식 — 권장)

```
┌──────────────────────────────────────────────────┐
│  역대 랭킹                                         │
│  [ D6 TOP10 ]  [ D8 TOP10 ]   ← 탭               │
│ ─────────────────────────────────────────────────│
│  1  유저A   4321점  12승  30판                    │
│  2  유저B   3210점   8승  22판                    │
│  ...                                             │
└──────────────────────────────────────────────────┘
```

탭 스타일:
```
탭 컨테이너:
  display         : flex
  gap             : 0
  border-bottom   : 2px solid var(--yacht-border)
  margin-bottom   : 8px

탭 버튼:
  padding         : 6px 16px
  font-size       : 13px
  font-weight     : 600
  background      : transparent
  border          : none
  cursor          : pointer
  color           : var(--yacht-text-sub)
  border-bottom   : 2px solid transparent
  margin-bottom   : -2px

활성 탭 (D6):
  color           : var(--yacht-accent)          /* #4f6cd8 */
  border-bottom   : 2px solid var(--yacht-accent)

활성 탭 (D8):
  color           : var(--yacht-d8-accent)       /* #d86a4f */
  border-bottom   : 2px solid var(--yacht-d8-accent)

탭 키보드 접근:
  role            : "tab"
  aria-selected   : "true" / "false"
  aria-controls   : "ranking-panel-d6" / "ranking-panel-d8"
```

현재 접속 모드의 탭을 기본 선택 탭으로 설정. (D8 방에서 대기 중이면 D8 탭 기본 활성)

---

## 6. 기존 컴포넌트 변경 영향

### 6.1 YachtDiceRow3D — diceType prop 추가

| prop | 타입 | 필수 | 설명 |
|---|---|---|---|
| `diceType` | `"D6" \| "D8"` | 필수 | geometry 선택 (BoxGeometry vs OctahedronGeometry) |
| `dice` | `number[]` | 필수 | 길이 5. 값 범위: D6=1~6, D8=1~8, 0=미굴림 |
| `keptIndices` | `number[]` | 필수 | 고정된 주사위 인덱스 목록 |
| `isMyTurn` | `boolean` | 필수 | 클릭 가능 여부 |
| `rollsLeft` | `number` | 필수 | 0이면 주사위 클릭 불가 |
| `onToggleKeep` | `(index: number) => void` | 필수 | 주사위 클릭 콜백 |

diceType이 "D6"이면 기존 BoxGeometry 사용. "D8"이면 OctahedronGeometry (YachtDiceOctahedron 로직) 사용.

### 6.2 YachtScoreBoard — diceType prop 추가

| prop | 타입 | 필수 | 설명 |
|---|---|---|---|
| `diceType` | `"D6" \| "D8"` | 필수 | 행 목록 전환 (12행 vs 14행+계산) |
| `scoreboard` | `PlayerScore[]` | 필수 | 기존과 동일 |
| `activeUserId` | `number` | 필수 | 현재 턴 플레이어 |
| `myUserId` | `number` | 필수 | 본인 |
| `previewScores` | `Record<string, number> \| null` | 선택 | 미리보기 점수 맵 |
| `onSelectScore` | `(key: string) => void` | 필수 | 족보 선택 콜백 |

diceType이 "D8"이면:
- 행 목록: §2.1 D8 전용 16행
- 상단 합계 표기: "/ 84"
- 행 높이 / 폰트: §2.3 D8 권장값 적용

diceType이 "D6"이면: 기존 그대로.

### 6.3 YachtPage — phase에 mode select 단계 추가

| phase | 설명 |
|---|---|
| `mode-select` | 신규. 모드 선택 화면 (YachtModeSelectScreen) |
| `matching` | 기존. POST /api/yacht/match 요청 중 로딩 |
| `waiting` | 기존. 대기실 (YachtWaitingRoom) |
| `playing` | 기존. 게임 진행 (YachtGameScreen) |
| `result` | 기존. 결과 화면 (YachtResultScreen) |

진입 라우트 `/yacht` 또는 `/yacht/select` 중 어느 것을 사용할지, 기존 `/yacht` 라우트가 어떻게 처리될지는 developer-frontend가 라우팅 구조 기준으로 결정.
명세 요구: 로그인 유저만 접근 가능한 라우트 가드가 `mode-select` 화면 앞에 존재해야 함.

### 6.4 신규 컴포넌트 목록

| 컴포넌트 이름 | 역할 |
|---|---|
| `YachtModeSelectScreen` | D6 / D8 모드 선택 카드 화면 |
| `YachtModeCard` | 개별 모드 카드 (선택 — YachtModeSelectScreen 내 인라인 또는 별도 컴포넌트) |
| `YachtDiceOctahedron` | D8 전용 3D 주사위 렌더 로직. YachtDiceRow3D 내부 분기 또는 별도 컴포넌트 — developer-frontend 결정 |
| `YachtModeBadge` | 헤더/결과/대기실에서 공통으로 사용되는 D6/D8 배지 |
| `YachtRankingTabs` | 대기실 랭킹 탭(D6/D8 전환) |

---

## 7. CSS 변경 명세

### 7.1 신규 CSS 변수 (`--yacht-` 접두사 연장)

아래 변수들은 `.page` 스코프 또는 `:root`에 추가 선언. 기존 변수와 충돌 없음.

```css
/* D8 모드 accent */
--yacht-d8-accent           : #d86a4f;   /* D8 전용 강조색 */
--yacht-d8-accent-subtle    : rgba(216, 106, 79, 0.12);  /* 배지 배경 */
--yacht-d8-accent-border    : rgba(216, 106, 79, 0.3);   /* 배지 테두리 */

/* 모드 선택 화면 */
--yacht-mode-card-radius    : 16px;
--yacht-mode-card-border    : 2px solid var(--yacht-border);
--yacht-mode-card-hover-shadow-d6 : 0 4px 20px rgba(79, 108, 216, 0.22);
--yacht-mode-card-hover-shadow-d8 : 0 4px 20px rgba(216, 106, 79, 0.22);

/* 랭킹 탭 */
--yacht-tab-active-d6       : var(--yacht-accent);       /* #4f6cd8 */
--yacht-tab-active-d8       : var(--yacht-d8-accent);    /* #d86a4f */
```

### 7.2 신규 CSS 클래스 목록

developer-frontend가 yacht.module.css에 추가 구현할 클래스 목록.
아래는 명세 수준의 클래스명 및 역할 기술. 실제 CSS 작성은 developer-frontend 소유.

| 클래스명 | 용도 |
|---|---|
| `.modeSelectScreen` | YachtModeSelectScreen 전체 래퍼. flex-column, align-items center, padding 40px 20px |
| `.modeSelectTitle` | "모드를 선택하세요" 제목. font-size 22px, font-weight 800 |
| `.modeSelectSub` | 서브 텍스트. font-size 14px, color var(--yacht-text-sub) |
| `.modeCardRow` | 두 카드를 나란히 배치하는 flex 컨테이너. gap 24px, flex-wrap wrap |
| `.modeCard` | 개별 모드 카드. border, border-radius, transition, cursor pointer |
| `.modeCardD6` | D6 카드 hover/focus 전용 — border-color, box-shadow |
| `.modeCardD8` | D8 카드 hover/focus 전용 — border-color, box-shadow (--yacht-d8-accent 사용) |
| `.modeCardIcon` | 카드 상단 아이콘 영역. 48x48px 기준 |
| `.modeCardTitle` | 모드명 텍스트. font-size 20px, font-weight 800 |
| `.modeCardMeta` | 족보 수 / 보너스 임계 / 라운드 정보 텍스트 |
| `.modeCardStats` | 활성 방 통계 텍스트 |
| `.modeCardRanking` | 랭킹 미리보기 영역 |
| `.modeCardRankRow` | 랭킹 각 행 |
| `.modeCardCta` | CTA 버튼 — D6: background var(--yacht-accent), D8: background var(--yacht-d8-accent) |
| `.modeCardCtaD8` | D8 전용 CTA 버튼 색상 override |
| `.modeBadge` | 헤더 / 대기실 / 결과 화면 공통 모드 배지 |
| `.modeBadgeD6` | D6 배지 색상. color, background, border — --yacht-accent 기반 |
| `.modeBadgeD8` | D8 배지 색상. color, background, border — --yacht-d8-accent 기반 |
| `.scoreBoardD8` | D8 점수판 wrapper. 행 높이 override, font-size 축소 |
| `.scoreBoardD8 .scoreLabelCell` | D8 족보명 셀. font-size 12px |
| `.rankingTabs` | 랭킹 탭 컨테이너. flex, border-bottom |
| `.rankingTab` | 개별 탭 버튼. padding, font-size, cursor |
| `.rankingTabActiveD6` | D6 활성 탭 underline. border-bottom var(--yacht-accent) |
| `.rankingTabActiveD8` | D8 활성 탭 underline. border-bottom var(--yacht-d8-accent) |
| `.scoreBoardScrollHint` | 모바일 점수판 하단 fade-out 그라데이션 오버레이 |

### 7.3 기존 클래스 수정 사항

| 클래스명 | 수정 내용 |
|---|---|
| `.headerTitle` | 타이틀 옆 배지(.modeBadge)를 인라인으로 수용할 수 있도록 `display: flex; align-items: center; gap: 6px` 추가 |
| `.waitingTitle` | 동일 — 배지 수용 |
| `.resultTitle` | 동일 — 배지 수용 |
| `.scoreBoard` | D8 모드에서 `.scoreBoardD8` 클래스가 추가로 붙어 행 높이 및 폰트 override |

### 7.4 수정 금지 사항

- `frontend/src/styles/excel.css` 직접 수정 금지 (PRD §2, Excel 모드 N/A)
- 기존 `--yacht-accent` 값(`#4f6cd8`) 변경 금지 (D6 기존 색상 유지)
- 기존 D6 관련 클래스 삭제 / 이름 변경 금지

---

## 8. 색상 대비 확인

| 요소 | 배경 | 전경 | 목표 | 확인 |
|---|---|---|---|---|
| D8 배지 | rgba(216,106,79,0.12) ≈ #f9ede9 | #d86a4f | 4.5:1 이상 | 확인 필요 (구현 시 검증) |
| D8 CTA 버튼 | #d86a4f | #ffffff | 4.5:1 이상 | 확인 필요 |
| D6 CTA 버튼 | #4f6cd8 | #ffffff | 4.5:1 이상 | 기존 동일 — 통과 |
| D8 탭 활성 | #ffffff | #d86a4f | 4.5:1 이상 | 확인 필요 |
| 모드 카드 제목 D8 | #ffffff | #d86a4f | 4.5:1 이상 | 확인 필요 |

D8 accent 색상 `#d86a4f`의 WCAG 4.5:1 대비를 흰 배경에서 충족하지 못하는 경우 개발 시 `#c05a3e` 등 더 어두운 톤으로 조정 가능 (planner와 사전 합의 후).

---

## 9. keyframes 추가 정의

| 이름 | 용도 | duration | timing |
|---|---|---|---|
| `yacht-mode-card-hover` | 카드 hover 진입 부드러운 상승 | 120ms | ease-out |
| `yacht-tab-slide` | 탭 전환 시 패널 fade | 150ms | ease-out |

기존 `yacht-*` keyframes (yacht-game.md §13)은 그대로 유지.

---

> 스펙 변경은 planner를 경유한다.
> Excel 모드는 PRD §2에 따라 N/A. 본 명세는 일반 모드만 다룬다.
> D8 accent 색상(#d86a4f) WCAG 대비 충족 여부는 developer-frontend 구현 시 qa-tester가 최종 검증.
> OQ-4 (14행 모바일 가독성): 모바일 점수판 내부 스크롤 + sticky 헤더로 대응. "현재 턴 플레이어 행" / "내 행" sticky는 Should 수준 권장.
