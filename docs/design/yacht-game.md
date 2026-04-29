# UX 명세 — Yacht 게임 화면 (yacht-game)

- 작성자: designer
- 작성일: 2026-04-29
- PRD 참조: `docs/specs/yacht-prd.md` (CP1 승인 완료)
- CP1 반영:
  - CP1-1: 타임아웃 없음 → 턴 타임아웃 프로그레스 바 불필요
  - CP1-3: 방장 시작 버튼 방식 (MATCH_COUNTDOWN UI 없음)
- 모드 적용: **일반 모드만** (Excel 모드 N/A)

---

## 1. 라우트

```
/yacht/room/{roomId}   — GAME_STARTED 수신 후 게임 화면 진입
```

WAITING 상태에서 GAME_STARTED 수신 시 동일 라우트에서 화면 전환 (라우트 변경 없음, 컴포넌트 상태 전환).

---

## 2. 전체 레이아웃 분할 (데스크탑)

```
┌──────────────────────────────────────────────────────────────────┐
│  [← 나가기]                    Yacht                              │  ← [A] 헤더 (56px)
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│                   유저A 의 차례  (라운드 3 / 12)                   │  ← [B] 턴 표시 바
│                                                                  │
├───────────────────────── [C] 주사위 영역 ─────────────────────────┤
│                                                                  │
│    ┌─── 굴릴 주사위 ───────────────────────────────────────────┐  │
│    │  [주]  [주]  [주]  [주]  [주]   ← 3D 주사위 캔버스        │  │
│    └────────────────────────────────────────────────────────┘  │
│                                                                  │
│    ┌─── 고정된 주사위 (kept) ──────────────────────────────────┐  │
│    │  [주] [주]     ← 파란 테두리, 잠금 느낌                   │  │
│    └────────────────────────────────────────────────────────┘  │
│                                                                  │
├───────────────────────── [D] 굴리기 버튼 영역 ────────────────────┤
│                                                                  │
│           [ 굴리기 (3회 남음) ]     남은 횟수: ●●●               │
│                                                                  │
├───────────────────────── [E] 점수판 영역 ─────────────────────────┤
│                                                                  │
│  족보              │  유저A (★)  │  유저B   │  유저C   │  유저D   │
│  ───────────────────────────────────────────────────────────────  │
│  Ones              │     3       │    -     │    5     │    -     │
│  Twos              │     -  →12  │    -     │    -     │    -     │  ← 미리보기
│  ...               │    ...      │   ...    │   ...    │   ...    │
│  상단 합계          │    38/63   │   -/63   │  20/63   │   -/63   │
│  상단 보너스        │     -       │    -     │    -     │    -     │
│  Choice            │     22      │    -     │    -     │    -     │
│  ...               │    ...      │   ...    │   ...    │   ...    │
│  총합              │    63       │    0     │   25     │    0     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. [A] 헤더 컴포넌트

```
height          : 56px
padding         : 0 16px
background      : #FFFFFF
border-bottom   : 1px solid #E5E7EB
position        : sticky
top             : 0
z-index         : 100

좌측 — 나가기:
  텍스트        : "← 나가기"
  font-size     : 14px, font-weight 500
  color         : #6B7280
  :hover color  : #111827
  클릭 동작     : 확인 다이얼로그 → 확인 시 /leave 발행 → 홈 navigate

중앙 — 타이틀:
  텍스트        : "Yacht"
  font-size     : 20px, font-weight 700
  color         : #111827
  mobile(480-)  : 16px

우측 — 빈 영역 (타이머 없음 — CP1-1)
```

---

## 4. [B] 턴 표시 바

```
컨테이너:
  display       : flex
  align-items   : center
  justify-content: center
  gap           : 8px
  padding       : 10px 16px
  background    : var(--yacht-turn-bar-bg)     /* #EEF2FF */
  border-bottom : 1px solid var(--yacht-turn-bar-border)  /* #C7D2FE */

턴 텍스트:
  구성          : "{닉네임} 의 차례"
  닉네임 부분  : font-size 16px, font-weight 700, color var(--color-primary) /* #6366F1 */
  " 의 차례"   : font-size 16px, font-weight 600, color var(--color-text-primary)

라운드 정보:
  텍스트        : "(라운드 {N} / 12)"
  font-size     : 13px
  color         : var(--color-text-muted)
  margin-left   : 8px

내 턴인 경우 추가 표시:
  배경          : var(--yacht-my-turn-bar-bg)  /* #F0FDF4 */
  border-bottom : 1px solid #BBF7D0
  왼쪽에 "내 차례!" 뱃지:
    background  : #22C55E
    color       : #FFFFFF
    font-size   : 12px, font-weight 700
    padding     : 2px 8px
    border-radius: 20px
```

---

## 5. [C] 주사위 영역

### 5.1 주사위 캔버스 전체 컨테이너

```
width           : 100%
min-height      : 200px
max-height      : 300px
background      : var(--yacht-dice-canvas-bg)  /* #F8FAFC */
border          : 1px solid #E5E7EB
border-radius   : 12px
overflow        : hidden
margin          : 8px 0
position        : relative

three.js 캔버스  : width 100%, height 100% (컨테이너 크기에 맞게)
```

### 5.2 굴릴 주사위 영역 (roll zone)

3D 캔버스 내 상단 영역. 클릭하면 kept 영역으로 이동.

```
레이블          : "굴릴 주사위"
font-size       : 11px
color           : var(--color-text-muted)
position        : absolute, top 8px, left 12px

주사위 5개 배치:
  display       : flex
  flex-wrap     : nowrap
  gap           : 12px
  justify-content: center
  padding       : 24px 16px 8px

각 주사위 (3D BoxGeometry):
  크기(데스크탑) : 60x60px 영역 (3D 렌더링 기준)
  크기(모바일)   : 44x44px 영역
  cursor        : pointer (내 턴이고 굴린 후에만)
  pointer-events: none (내 턴 아닐 때, 굴림 전)

hover 상태 (클릭 가능 시):
  주사위 아래 하이라이트 후광 효과 (CSS box-shadow 오버레이)
  color          : rgba(99,102,241,0.3)
  transition    : 150ms ease

클릭 동작 (내 턴 + 굴림 후):
  해당 주사위 인덱스를 keptIndices에 추가 → kept 영역으로 시각적 이동
```

### 5.3 고정된 주사위 영역 (kept zone)

```
레이블          : "고정된 주사위 (kept)"
font-size       : 11px
color           : var(--yacht-kept-label-color)  /* #3B82F6 */
font-weight     : 600
position        : absolute, bottom 8px, left 12px

kept 주사위 배치:
  display       : flex
  flex-wrap     : nowrap
  gap           : 8px
  padding       : 8px 16px 16px

kept 주사위 시각 구분:
  3D 주사위 메시 주변 파란 테두리 효과 (CSS 오버레이 사용)
  border        : 2px solid var(--yacht-kept-border)  /* #3B82F6 */
  border-radius : 6px
  background    : rgba(59,130,246,0.08)

kept 주사위 클릭 동작 (내 턴 + 굴림 후):
  해당 인덱스를 keptIndices에서 제거 → roll zone으로 시각적 이동

빈 상태 (아무것도 kept하지 않은 경우):
  레이블만 표시, 배치 영역 최소화 (height 32px)
```

### 5.4 주사위 표시 상태별 명세

| 상태 | 표시 방법 |
|---|---|
| 미굴림 (턴 시작) | 주사위 6면 모두 흐릿하게 표시 (opacity 0.4) 또는 "?" 표시 |
| 굴리는 중 (애니메이션) | gsap timeline 회전+낙하+정지 (아래 §5.5) |
| 굴림 완료 (roll zone) | 주사위 눈 정면 표시, 클릭 가능 |
| kept (kept zone) | 파란 테두리+배경, 클릭 시 되돌아감 |
| 내 턴 아님 | 모든 주사위 pointer-events none, cursor default |

### 5.5 3D 주사위 애니메이션 (three.js + gsap)

```
굴림 애니메이션 타임라인 (gsap):
  Duration      : 800ms ~ 1200ms (랜덤 분산으로 자연스럽게)
  Phase 1 (0 ~ 40%): 주사위 위로 튀어오름 + 빠른 회전
    y 오프셋    : -40px ~ -80px (랜덤)
    rotation    : 랜덤 3축 회전 (각 축 240° ~ 720°)
    ease        : power2.out
  Phase 2 (40% ~ 80%): 낙하
    y 복귀      : 원위치
    rotation    : 계속 회전
    ease        : bounce.out
  Phase 3 (80% ~ 100%): 정착
    최종 면 맞춤: 서버 결과값에 맞는 rotation 값으로 고정
    ease        : power3.out

kept 주사위:
  굴림 시 제자리에서 미세하게 흔들림 (confirm 효과)
    rotation    : ±5° wiggle, duration 300ms
    이후 정지

완료 콜백:
  gsap timeline onComplete 시점에 클릭 이벤트 활성화
```

---

## 6. [D] 굴리기 버튼 영역

### 6.1 굴리기 버튼

```
컨테이너:
  display       : flex
  align-items   : center
  justify-content: center
  gap           : 16px
  padding       : 12px 16px

버튼 스타일 (활성):
  padding       : 12px 36px
  background    : var(--color-primary)           /* #6366F1 */
  color         : #FFFFFF
  border        : none
  border-radius : 10px
  font-size     : 16px
  font-weight   : 700
  cursor        : pointer
  min-width     : 200px
  transition    : background 150ms ease, transform 100ms ease

  :hover
    background  : var(--color-primary-dark)      /* #4F46E5 */
    transform   : translateY(-2px)

  :active
    transform   : translateY(0)

버튼 비활성 (내 턴 아님, 또는 3회 소진, 또는 애니메이션 중):
  background    : #D1D5DB
  color         : #9CA3AF
  cursor        : not-allowed
  opacity       : 0.65
  pointer-events: none
```

### 6.2 버튼 텍스트 — 굴림 횟수별

CP1-1 반영: 타임아웃 없음. rollsLeft 기준으로만 표시.

| rollsLeft 상태 | 버튼 텍스트 | 활성 여부 |
|---|---|---|
| 3 (첫 굴림 전) | "굴리기 (3회 남음)" | 내 턴이면 활성 |
| 2 (1회 굴림 후) | "다시 굴리기 (2회 남음)" | 내 턴이면 활성 |
| 1 (2회 굴림 후) | "다시 굴리기 (1회 남음)" | 내 턴이면 활성 |
| 0 (3회 소진) | "굴리기" | 비활성 (족보 선택만 가능) |

### 6.3 남은 굴림 횟수 시각 표시

```
컨테이너:
  display       : flex
  align-items   : center
  gap           : 6px

레이블:
  "남은 횟수:"
  font-size     : 13px
  color         : var(--color-text-muted)

불릿 도트 (●) × rollsLeft 개수:
  도트 크기     : width 10px, height 10px
  border-radius : 50%
  활성(남은 횟수): background var(--color-primary)    /* #6366F1 */
  소진(사용됨)   : background #E5E7EB

  예시: 2회 남음 → ●●○ (활성2 + 비활성1)

transition:
  소진 시 scale 0 → 1 + opacity 0 → 1, duration 200ms
```

---

## 7. [E] 점수판 컴포넌트

### 7.1 점수판 전체 구조

```
컨테이너:
  width         : 100%
  overflow-x    : auto          (4명 시 가로 스크롤 가능)
  border-top    : 1px solid #E5E7EB

테이블 레이아웃:
  table-layout  : fixed (데스크탑) / auto (모바일)
  border-collapse: collapse
  width         : max-content (overflow 허용)
  min-width     : 100%
```

### 7.2 열 헤더 (플레이어 이름)

```
헤더 행:
  background    : var(--yacht-scoreboard-header-bg)   /* #F9FAFB */
  border-bottom : 2px solid #E5E7EB
  position      : sticky
  top           : 56px    (헤더 높이만큼 오프셋)
  z-index       : 50

족보 열 헤더 셀:
  padding       : 10px 8px
  font-size     : 12px
  font-weight   : 600
  color         : var(--color-text-muted)
  text-align    : left
  width         : 140px  (데스크탑) / 120px (모바일)
  position      : sticky
  left          : 0
  background    : #F9FAFB
  z-index       : 60

플레이어 헤더 셀:
  padding       : 10px 8px
  font-size     : 13px
  font-weight   : 700
  text-align    : center
  min-width     : 80px
  max-width     : 120px

  기본 상태:
    color       : var(--color-text-primary)
    background  : #F9FAFB

  현재 턴 플레이어 열 (하이라이트):
    color       : var(--color-primary)          /* #6366F1 */
    background  : var(--yacht-active-col-header) /* #EEF2FF */
    border-bottom: 2px solid var(--color-primary)

  본인 열:
    닉네임 뒤에 "(나)" 배지 추가
    배지: font-size 10px, background #EEF2FF, color #6366F1, padding 1px 5px, border-radius 8px
```

### 7.3 족보 행 목록

PRD §5.2, §5.3 기준 12개 족보 + 계산 행.

| 행 순서 | 행 키 | 표시 이름 | 섹션 |
|---|---|---|---|
| 1 | ONES | Ones | 상단 |
| 2 | TWOS | Twos | 상단 |
| 3 | THREES | Threes | 상단 |
| 4 | FOURS | Fours | 상단 |
| 5 | FIVES | Fives | 상단 |
| 6 | SIXES | Sixes | 상단 |
| 7 | — | 상단 합계 | 계산 |
| 8 | — | 상단 보너스 (+35) | 계산 |
| 9 | CHOICE | Choice | 하단 |
| 10 | FOUR_OF_A_KIND | Four of a Kind | 하단 |
| 11 | FULL_HOUSE | Full House | 하단 |
| 12 | LITTLE_STRAIGHT | Little Straight | 하단 |
| 13 | BIG_STRAIGHT | Big Straight | 하단 |
| 14 | YACHT | Yacht | 하단 |
| 15 | — | 총합 | 계산 |

### 7.4 족보 행 스타일

```
섹션 구분 행 (상단/하단 경계):
  height        : 4px
  background    : #E5E7EB (구분선)

일반 족보 행 (홀수):
  background    : #FFFFFF

일반 족보 행 (짝수):
  background    : #FAFAFA

계산 행 (상단합계/상단보너스/총합):
  background    : var(--yacht-calc-row-bg)     /* #F1F5F9 */
  font-weight   : 700
  border-top    : 1px solid #CBD5E1

족보 이름 셀 (첫 번째 열):
  padding       : 8px 10px
  font-size     : 13px
  font-weight   : 500
  color         : var(--color-text-secondary)
  text-align    : left
  position      : sticky
  left          : 0
  background    : 해당 행 배경색 (홀짝/계산 동일하게)
  z-index       : 40
  border-right  : 1px solid #E5E7EB
```

### 7.5 점수 셀 상태별 명세

#### 상태 A — 기록된 셀 (recorded)

```
배경            : #FFFFFF (기본 행색 그대로)
텍스트          : 점수 숫자 (0 포함)
font-size       : 14px
font-weight     : 600
color           : var(--color-text-primary)
text-align      : center
cursor          : default
pointer-events  : none

0점 기록된 경우:
  color         : var(--color-text-muted)       /* #9CA3AF */
  font-style    : italic

잠금 아이콘 (소):
  position      : absolute, right 4px, top 50%, transform translateY(-50%)
  font-size     : 9px
  opacity       : 0.4
  content       : "🔒" 또는 "■"
  (아이콘 크기 과도하면 생략하고 배경색 변화만 사용)
```

#### 상태 B — 미기록 + 내 턴 아님 (other-turn)

```
배경            : #FFFFFF
텍스트          : "—" (대시)
font-size       : 13px
color           : #E5E7EB   (dimmed)
cursor          : default
pointer-events  : none
opacity         : 0.5
```

#### 상태 C — 미기록 + 내 턴 + 굴림 전 (my-turn-before-roll)

```
배경            : #FFFFFF
텍스트          : "—"
font-size       : 13px
color           : var(--color-text-muted)
cursor          : not-allowed  (굴리기 전 클릭 불가)
pointer-events  : none

툴팁 (hover):
  "먼저 주사위를 굴려야 합니다"
  position absolute, font-size 11px
```

#### 상태 D — 미기록 + 내 턴 + 굴림 후 = 미리보기 (preview)

OQ-8 디자이너 결정: 항상 표시 방식 (hover 아님, 굴림 완료 즉시 모든 미기록 셀에 미리보기 표시).

```
배경            : var(--yacht-preview-bg)        /* #F0F9FF */
border          : 1px solid var(--yacht-preview-border)  /* #BAE6FD */
텍스트          : 미리보기 점수 숫자 (0 포함)
font-size       : 14px
font-weight     : 600
color           : var(--yacht-preview-color)     /* #0284C7 */
font-style      : italic
text-align      : center
cursor          : pointer

0점 미리보기:
  color         : var(--yacht-preview-zero-color) /* #94A3B8 */
  font-style    : italic

:hover
  background    : var(--yacht-preview-hover-bg)  /* #E0F2FE */
  border-color  : var(--color-primary)            /* #6366F1 */
  transform     : scale(1.05)
  box-shadow    : 0 2px 8px rgba(99,102,241,0.2)
  transition    : all 150ms ease
  color         : var(--color-primary)

:focus-visible
  outline       : 2px solid var(--color-primary)
  outline-offset: -2px

클릭 동작:
  선택 확인 팝업(아래 §7.7) 표시
  또는 즉시 /score 발행 (UX 결정 — §7.7 참조)
```

#### 상태 E — 현재 턴 플레이어의 열 전체 (active column)

```
배경 컬럼 헤더 : var(--yacht-active-col-header)  /* #EEF2FF */
컬럼 배경      : var(--yacht-active-col-bg)       /* #F8F9FF */ (미기록 셀에만)
left border    : 2px solid var(--color-primary)    (컬럼 전체 왼쪽 강조선)
```

### 7.6 상단 합계 / 보너스 진행도 셀

```
상단 합계 행:
  텍스트 형식   : "{현재합계} / 63"
  현재합계      : font-weight 700, color var(--color-text-primary)
  "/ 63"        : font-weight 400, color var(--color-text-muted)
  text-align    : center

  상단 보너스 획득 시 (upperTotal >= 63):
    color       : #16A34A
    "✓" 아이콘 추가

  미달 시 (상단 6개 모두 기록 완료):
    color       : #DC2626
    텍스트      : "{현재합계} / 63 (보너스 없음)"
    font-size   : 11px

  진행 중 (6개 미기록 있음):
    color       : var(--color-text-primary)

상단 보너스 행:
  6개 기록 완료 + >=63: "+35" (color #16A34A, font-weight 700)
  6개 기록 완료 + <63:  "0" (color #9CA3AF)
  미완료:               "?" (color #9CA3AF)

보너스 미니 프로그레스 바 (선택 추가 요소):
  상단 합계 셀 하단에 인라인 바
  height        : 3px
  width         : calc(min(upperTotal, 63) / 63 * 100%)
  background    : 미달: #6366F1 / 달성: #16A34A
  border-radius : 2px
  transition    : width 300ms ease
```

### 7.7 족보 선택 확인 팝업

내 턴 + 굴림 후 셀 클릭 시 선택 확인 UI.

```
방식            : 인라인 미니 팝오버 (모달 아님)
                  선택한 셀 아래에 작은 말풍선 형태

팝오버 내용:
  텍스트        : "{족보 이름}에 {점수}점을 기록합니다."
  0점 경우      : "{족보 이름}에 0점을 기록합니다. (조건 미달)"
                   color: #DC2626 강조

버튼 2개:
  확인 버튼:
    텍스트      : "기록"
    background  : var(--color-primary)
    color       : #FFF
    padding     : 6px 16px
    border-radius: 6px
    font-size   : 13px
    클릭        : /score 발행 { "scoreKey": "..." }

  취소 버튼:
    텍스트      : "취소"
    background  : transparent
    border      : 1px solid #D1D5DB
    color       : #6B7280
    padding     : 6px 16px
    border-radius: 6px
    font-size   : 13px
    클릭        : 팝오버 닫기

팝오버 스타일:
  background    : #FFFFFF
  border        : 1px solid #E5E7EB
  border-radius : 8px
  box-shadow    : 0 4px 16px rgba(0,0,0,0.12)
  padding       : 12px 14px
  z-index       : 200
  position      : absolute
  min-width     : 160px

진입 애니메이션:
  transform     : scale(0.85) translateY(-4px) → scale(1) translateY(0)
  opacity       : 0 → 1
  duration      : 150ms ease-out

키보드:
  Enter         : 확인
  Escape        : 취소/닫기
```

---

## 8. 상태별 UI 전환 흐름

### 8.1 게임 시작 (GAME_STARTED 수신)

```
1. 점수판 초기화: 모든 셀 "—" (미기록 상태)
2. 첫 번째 턴 플레이어 열 하이라이트
3. 턴 표시 바: "{첫 번째 플레이어} 의 차례 (라운드 1 / 12)"
4. 굴리기 버튼: 내 턴이면 "굴리기 (3회 남음)" 활성
5. 주사위: 5개 모두 roll zone에 흐릿 표시 (미굴림)
```

### 8.2 내 턴 시작 (TURN_STATE 수신, 내 턴)

```
1. 턴 표시 바 갱신 + "내 차례!" 뱃지 노출
2. 굴리기 버튼 활성화 (rollsLeft=3)
3. 주사위 roll zone으로 5개 모두 초기화 (keptIndices=[])
4. kept zone 비움
5. 미리보기 초기화 (모든 미기록 셀 상태 C로)
```

### 8.3 굴리기 (ROLL_RESULT 수신)

```
1. 굴림 애니메이션 시작 (§5.5)
   - keptIndices에 없는 주사위만 애니메이션
   - kept 주사위 wiggle 효과 (확인 동작)
2. 애니메이션 완료 후:
   - 주사위 결과 업데이트 (dice[] 적용)
   - keptIndices 주사위 → kept zone으로 시각 이동
   - 굴리기 버튼 텍스트 갱신 (rollsLeft 반영)
   - rollsLeft=0이면 버튼 비활성화
3. 미리보기 업데이트:
   - 모든 미기록 족보 셀에 현재 dice 기준 점수 계산 후 미리보기 표시 (상태 D)
   - 기록된 셀은 변화 없음
```

### 8.4 다른 플레이어 턴 (TURN_STATE 수신, 내 턴 아님)

```
1. 굴리기 버튼 비활성화
2. 내 족보 셀 모두 상태 B (dimmed, 클릭 불가)
3. 미리보기 해제 (상태 C/D → 상태 B)
4. 현재 턴 플레이어 열 하이라이트
5. 주사위 클릭 이벤트 비활성화
```

### 8.5 점수 기록 (SCORE_RECORDED 수신)

```
1. 해당 플레이어의 해당 족보 셀: 상태 A (기록됨) 전환
   진입 애니메이션: scale 0.8 → 1.0, 200ms ease-out
2. 상단 합계 셀 갱신
3. bonusEarned=true이면: 보너스 행 "+35" 표시 + 토스트 알림
   토스트: "{닉네임}이(가) 상단 보너스 +35점 획득!"
4. 총합 셀 갱신
5. 미리보기 해제 (기록 완료 플레이어의 해당 셀)
```

### 8.6 턴 이전 (TURN_CHANGED 수신)

```
1. 이전 턴 플레이어 열 하이라이트 해제
2. 새 턴 플레이어 열 하이라이트
3. 턴 표시 바 갱신
4. 주사위 리셋: 5개 모두 roll zone, 흐릿 표시
5. kept zone 비움
6. rollsLeft=3 → 굴리기 버튼 갱신
7. 내 턴이면 버튼 활성화, 아니면 비활성
```

---

## 9. 비로그인 접근 / 오류 처리

### 9.1 NOT_YOUR_TURN 에러

```
토스트 (경고):
  텍스트        : "지금은 내 차례가 아닙니다."
  background    : #FFFBEB
  border-left   : 4px solid #F59E0B
  color         : #92400E
  자동 소멸     : 3초
```

### 9.2 NO_ROLLS_LEFT 에러

```
토스트 (경고):
  텍스트        : "굴리기 횟수를 모두 사용했습니다. 족보를 선택하세요."
  background    : #FFFBEB
  border-left   : 4px solid #F59E0B
  자동 소멸     : 3초
```

### 9.3 MUST_ROLL_FIRST 에러

```
토스트 (경고):
  텍스트        : "점수를 기록하려면 먼저 주사위를 굴려야 합니다."
  background    : #FFFBEB
  border-left   : 4px solid #F59E0B
  자동 소멸     : 3초
```

### 9.4 SCORE_KEY_ALREADY_USED 에러

```
토스트 (에러):
  텍스트        : "이미 기록된 족보입니다."
  background    : #FEF2F2
  border-left   : 4px solid #DC2626
  자동 소멸     : 3초
```

### 9.5 플레이어 연결 끊김 (PLAYER_LEFT)

```
상단 배너 (게임 진행 중):
  height        : 40px
  background    : #FEF3C7
  border-bottom : 2px solid #F59E0B
  텍스트        : "{닉네임}님의 연결이 끊겼습니다. 해당 플레이어의 미기록 족보는 자동으로 0점 처리됩니다."
  font-size     : 13px
  color         : #92400E
  자동 소멸     : 5초
```

### 9.6 ROOM_CLOSED (게임 중 인원 부족)

```
전체 화면 모달 (닫기 불가):
  텍스트        : "참가자가 부족하여 게임이 종료되었습니다."
  버튼          : "홈으로" (primary)
  3초 후 자동으로 홈(/) navigate
```

---

## 10. 반응형 레이아웃

### 10.1 브레이크포인트

| 브레이크포인트 | 범위 | 변경 사항 |
|---|---|---|
| desktop | 769px 이상 | 기본 레이아웃 |
| tablet | 481px ~ 768px | 점수판 가로 스크롤, 주사위 축소 |
| mobile | 480px 이하 | 상세 아래 참조 |

### 10.2 모바일 전용 변경 (480px 이하)

```
[A] 헤더:
  타이틀        : 16px
  나가기 텍스트 : "←" 아이콘만 (텍스트 숨김)

[B] 턴 표시 바:
  font-size     : 14px
  라운드 정보   : 14px

[C] 주사위 영역:
  min-height    : 160px
  max-height    : 220px
  주사위 크기   : 44x44 영역

[D] 굴리기 버튼:
  width         : calc(100% - 32px)
  font-size     : 15px
  버튼 텍스트   : "굴리기 ({N}회)" (짧게)
  도트 표시     : 버튼 아래로 이동

[E] 점수판:
  overflow-x    : auto (가로 스크롤 필수)
  족보 이름 열  : width 100px, font-size 12px
  점수 셀       : min-width 64px, font-size 13px
  플레이어 이름 : max-width 80px, text-overflow ellipsis
  sticky 헤더   : top 56px (헤더 높이)

점수판 스크롤 힌트 (최초 1회):
  오른쪽 fade-out 그라데이션 오버레이
  width 40px, right 0
  background: linear-gradient(to right, transparent, #F9FAFB)
  3초 후 자동 소멸
```

### 10.3 점수판 전체 화면 토글 (선택 기능)

```
모바일에서 점수판을 전체 화면으로 보는 버튼 (선택 구현):
  아이콘        : "⊞" 또는 "전체 보기"
  위치          : 점수판 헤더 우측
  클릭 시       : 주사위 영역 접히고 점수판이 화면 절반 이상 차지
  토글 재클릭   : 원래 레이아웃 복귀
```

---

## 11. 접근성 명세

### 11.1 키보드 네비게이션

| 화면 상태 | 키 | 동작 |
|---|---|---|
| 내 턴 + 굴림 가능 | Space 또는 Enter (굴리기 버튼 포커스) | 주사위 굴리기 |
| 굴림 후 족보 선택 | Tab / Shift+Tab | 선택 가능한 미기록 셀 간 포커스 이동 |
| 족보 셀 포커스 | Enter / Space | 선택 확인 팝오버 열기 |
| 팝오버 열린 상태 | Enter | 기록 확인 |
| 팝오버 열린 상태 | Escape | 팝오버 닫기 |
| 주사위 kept 전환 | Tab으로 주사위 접근 후 Space | kept 전환 |

### 11.2 ARIA 속성

```
턴 표시 영역:
  role            : "status"
  aria-live       : "polite"
  aria-atomic     : true
  aria-label      : "{닉네임} 의 차례"

굴리기 버튼:
  role            : "button"
  aria-label      : "굴리기, {N}회 남음"
  aria-disabled   : "true" (비활성 시)

점수판 테이블:
  role            : "grid"
  aria-label      : "야추 점수판"
  caption         : "플레이어별 족보 점수 현황"

점수 셀 (기록됨):
  role            : "gridcell"
  aria-label      : "{족보 이름}: {점수}점 (기록됨)"
  aria-readonly   : "true"

점수 셀 (미리보기, 클릭 가능):
  role            : "button"
  aria-label      : "{족보 이름}: 예상 {점수}점. 클릭하여 기록"
  aria-pressed    : false

점수 셀 (dimmed):
  aria-hidden     : "true"  (또는 aria-disabled)

주사위 (roll zone):
  role            : "button"
  aria-label      : "주사위 {인덱스+1}: {눈 값}. 클릭하여 고정"
  aria-pressed    : false

주사위 (kept zone):
  role            : "button"
  aria-label      : "고정된 주사위 {인덱스+1}: {눈 값}. 클릭하여 고정 해제"
  aria-pressed    : true

토스트:
  role            : "alert"
  aria-live       : "assertive"

보너스 획득 알림:
  role            : "alert"
  aria-live       : "assertive"
  aria-label      : "보너스 획득: +35점"
```

### 11.3 색상 대비

| 요소 | 배경 | 전경 | 목표 |
|---|---|---|---|
| 미리보기 점수 (활성) | #F0F9FF | #0284C7 | 4.5:1 이상 |
| 미리보기 0점 | #F0F9FF | #94A3B8 | 3:1 이상 |
| 기록된 점수 | #FFFFFF | #111827 | 4.5:1 이상 |
| 현재 턴 플레이어 헤더 | #EEF2FF | #6366F1 | 4.5:1 이상 |
| 굴리기 버튼 | #6366F1 | #FFFFFF | 4.5:1 이상 |
| 비활성 버튼 | #D1D5DB | #9CA3AF | 참고용 (비활성 WCAG 예외) |

---

## 12. CSS 토큰 선언 목록 (신규 -- `--yacht-` 접두사)

```css
/* Yacht 게임 화면 전용 토큰 */

/* 턴 표시 바 */
--yacht-turn-bar-bg           : #EEF2FF;
--yacht-turn-bar-border       : #C7D2FE;
--yacht-my-turn-bar-bg        : #F0FDF4;

/* 주사위 캔버스 */
--yacht-dice-canvas-bg        : #F8FAFC;
--yacht-kept-border           : #3B82F6;
--yacht-kept-label-color      : #3B82F6;

/* 점수판 */
--yacht-scoreboard-header-bg  : #F9FAFB;
--yacht-active-col-header     : #EEF2FF;
--yacht-active-col-bg         : #F8F9FF;
--yacht-calc-row-bg           : #F1F5F9;

/* 미리보기 */
--yacht-preview-bg            : #F0F9FF;
--yacht-preview-border        : #BAE6FD;
--yacht-preview-color         : #0284C7;
--yacht-preview-hover-bg      : #E0F2FE;
--yacht-preview-zero-color    : #94A3B8;
```

---

## 13. keyframes 정의 요약

| 이름 | 용도 | duration | timing |
|---|---|---|---|
| `yacht-pulse` | 대기 화면 아이콘 pulse | 1.4s infinite | ease-in-out |
| `yacht-dice-roll` | 주사위 굴림 (gsap 제어, CSS 불필요) | 800~1200ms | gsap 내부 |
| `yacht-dice-kept-wiggle` | kept 주사위 확인 흔들림 | 300ms | ease |
| `yacht-cell-record` | 점수 기록 셀 등장 | 200ms | ease-out |
| `yacht-toast-in` | 토스트 슬라이드인 | 220ms | ease-out |
| `yacht-preview-in` | 미리보기 셀 fade-in | 150ms | ease-out |
| `yacht-popover-in` | 선택 팝오버 등장 | 150ms | ease-out |
| `yacht-bonus-pop` | 보너스 획득 강조 | 400ms | ease-out |

---

> 스펙 변경은 planner를 경유한다. Excel 모드는 PRD §3에 따라 N/A.
> OQ-8 (미리보기 표시 방식) 디자이너 결정: "항상 표시" 방식 채택 (굴림 완료 즉시 모든 미기록 셀에 표시).
> OQ-9 (3D 주사위 모바일 fallback) 추후 CP3에서 developer-frontend와 협의.
