# UX 명세 — Yacht 결과 화면 (yacht-result)

- 작성자: designer
- 작성일: 2026-04-29
- PRD 참조: `docs/specs/yacht-prd.md` (CP1 승인 완료)
- CP1 반영: CP1-2 — yacht_win 테이블 (단순 승수), "N번째 승리!" 표시 가능
- 모드 적용: **일반 모드만** (Excel 모드 N/A)

---

## 1. 라우트 & 진입 조건

```
진입 트리거     : GAME_OVER 이벤트 수신
                  동일 라우트(/yacht/room/{roomId})에서 결과 컴포넌트로 전환
                  (라우트 변경 없음, 게임 화면에서 결과 화면으로 상태 전환)

진입 애니메이션 : 게임 화면 fade-out (200ms) → 결과 화면 fade-in (300ms)
```

---

## 2. 화면 와이어프레임

### 2.1 데스크탑 (769px 이상)

```
┌──────────────────────────────────────────────────────────────┐
│  [← 홈으로]                    Yacht                          │  ← 헤더 (56px)
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   ╔══════════════════════════════════════════════════════╗   │
│   ║              게임 종료                               ║   │  ← 종료 배너
│   ╚══════════════════════════════════════════════════════╝   │
│                                                              │
│  ┌────────────────── 순위 목록 ──────────────────────────┐   │
│                                                              │
│   1위  [트로피]  유저A (나)  245점   "WIN!"                │  ← 1위 (본인 하이라이트)
│   ─────────────────────────────────────────────────────     │
│   2위           유저B       230점                          │
│   2위           유저C       230점                          │  ← 동점 공동 2위
│   ─────────────────────────────────────────────────────     │
│   4위           유저D       198점                          │
│                                                              │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  [선택] "이번 게임이 N번째 승리입니다!"                        │  ← 승수 축하 (승자 본인만)
│                                                              │
│              [ 홈으로 ]                                       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 모바일 (480px 이하)

```
┌──────────────────────────────────┐
│  [← 홈으로]           Yacht       │
├──────────────────────────────────┤
│                                  │
│  ╔══════════════════════════╗    │
│  ║       게임 종료           ║    │
│  ╚══════════════════════════╝    │
│                                  │
│  1위 [트로피] 유저A (나) 245점   │
│               [WIN!]             │
│  ──────────────────────────────  │
│  2위          유저B    230점     │
│  2위          유저C    230점     │
│  ──────────────────────────────  │
│  4위          유저D    198점     │
│                                  │
│  "이번 게임이 N번째 승리입니다!" │
│                                  │
│         [ 홈으로 ]               │
│                                  │
└──────────────────────────────────┘
```

---

## 3. 헤더 컴포넌트

```
height          : 56px
padding         : 0 16px
background      : #FFFFFF
border-bottom   : 1px solid #E5E7EB
position        : sticky
top             : 0
z-index         : 100

좌측 — 홈으로:
  텍스트        : "← 홈으로"
  font-size     : 14px, font-weight 500
  color         : #6B7280
  :hover color  : #111827
  클릭 동작     : 홈(/) navigate

중앙 — 타이틀:
  텍스트        : "Yacht"
  font-size     : 20px, font-weight 700
  color         : #111827

우측 — 빈 영역 또는 공유 아이콘 (선택 구현)
```

---

## 4. 종료 배너

```
컨테이너:
  width         : 100%
  max-width     : 560px
  margin        : 0 auto
  padding       : 14px 0
  text-align    : center
  border-radius : 12px
  font-size     : 22px
  font-weight   : 800
  background    : var(--yacht-gameover-banner-bg)    /* #F1F5F9 */
  border        : 1.5px solid var(--yacht-gameover-banner-border)  /* #CBD5E1 */
  color         : var(--yacht-gameover-banner-color) /* #475569 */
  letter-spacing: 0.04em

텍스트          : "게임 종료"

진입 애니메이션: keyframes yacht-banner-drop
  0%   transform: translateY(-20px), opacity: 0
  60%  transform: translateY(4px),   opacity: 1
  100% transform: translateY(0),     opacity: 1
  duration: 500ms, ease-out
```

---

## 5. 순위 목록

### 5.1 순위 컨테이너

```
width           : 100%
max-width       : 560px
margin          : 0 auto
display         : flex
flex-direction  : column
gap             : 0
border          : 1px solid #E5E7EB
border-radius   : 12px
overflow        : hidden
background      : #FFFFFF
```

### 5.2 순위 항목 (각 플레이어)

```
각 항목 공통:
  display       : flex
  align-items   : center
  gap           : 12px
  padding       : 14px 16px
  border-bottom : 1px solid #F3F4F6
  min-height    : 60px
  position      : relative

  마지막 항목   : border-bottom: none

순위 번호 셀:
  width         : 28px
  flex-shrink   : 0
  font-size     : 16px
  font-weight   : 800
  text-align    : center
  color         : var(--color-text-muted)   /* #9CA3AF */

  1위           : color var(--yacht-rank1-color) /* #F59E0B */
  2위           : color #94A3B8
  3위           : color #B45309

아이콘 셀 (1위에만):
  width         : 24px
  flex-shrink   : 0
  font-size     : 20px
  content       : "🏆" (aria-hidden) 또는 트로피 SVG

닉네임 셀:
  flex          : 1
  font-size     : 15px
  font-weight   : 600
  color         : var(--color-text-primary)
  overflow      : hidden
  text-overflow : ellipsis
  white-space   : nowrap

"(나)" 배지:
  font-size     : 11px
  background    : #EEF2FF
  color         : #6366F1
  padding       : 1px 6px
  border-radius : 10px
  margin-left   : 6px
  flex-shrink   : 0

점수 셀:
  font-size     : 18px
  font-weight   : 800
  color         : var(--color-text-primary)
  text-align    : right
  flex-shrink   : 0
  min-width     : 64px

  단위 텍스트   : "점"
  font-size     : 12px
  font-weight   : 400
  color         : var(--color-text-muted)
  margin-left   : 2px

WIN 뱃지 (isWinner=true인 플레이어):
  position      : absolute
  right         : 16px
  bottom        : 6px  (점수 아래 또는 점수 옆)
  content       : "WIN!"
  font-size     : 11px
  font-weight   : 800
  background    : var(--yacht-win-badge-bg)     /* #DCFCE7 */
  color         : var(--yacht-win-badge-color)  /* #16A34A */
  padding       : 2px 8px
  border-radius : 20px
  letter-spacing: 0.06em
```

### 5.3 항목 배경 스타일 (순위별)

```
1위 항목:
  background    : var(--yacht-rank1-bg)         /* #FFFBEB */
  border-left   : 3px solid var(--yacht-rank1-accent)  /* #F59E0B */

2위 항목:
  background    : var(--yacht-rank2-bg)         /* #F8FAFC */
  border-left   : 3px solid #CBD5E1

3위 항목:
  background    : var(--yacht-rank3-bg)         /* #FFF7ED */
  border-left   : 3px solid #FED7AA

4위 이하:
  background    : #FFFFFF
  border-left   : 3px solid transparent

본인 항목 (모든 순위에 적용):
  outline       : 2px solid var(--color-primary)  /* #6366F1 */
  outline-offset: -2px
  (border-left는 순위 색상 유지)
```

### 5.4 동점(공동 순위) 표시

```
공동 순위 항목 사이:
  구분선 없음 (border-bottom 유지하되 배경색으로 그룹 표현)
  공동 2위 항목들은 동일한 rank2-bg 배경

공동 표시 텍스트 (선택):
  "공동 {N}위" 형식으로 rank 번호 대신 표시
  font-size     : 14px

다음 순위 계산:
  동점자 수만큼 건너뜀 (PRD §5.5 기준)
  예: 2위 2명이면 그 다음 플레이어는 4위
```

### 5.5 순위 항목 진입 애니메이션

```
각 항목이 순차적으로 슬라이드인:
  1위 항목      : delay 0ms
  2위 항목      : delay 120ms
  3위 항목      : delay 240ms
  4위 항목      : delay 360ms

각 항목 애니메이션:
  keyframes yacht-rank-slidein
    from: transform translateX(30px), opacity 0
    to  : transform translateX(0),    opacity 1
    duration: 350ms, ease-out
```

---

## 6. 승수 축하 메시지 (CP1-2 기반)

CP1-2 확정: `yacht_win` 테이블에 승수 저장. 승자(isWinner=true)인 본인에게만 표시.

```
표시 조건       : 본인이 isWinner=true인 경우에만 노출

컨테이너:
  display       : flex
  align-items   : center
  justify-content: center
  gap           : 8px
  padding       : 12px 20px
  background    : var(--yacht-win-celebration-bg)   /* #F0FDF4 */
  border        : 1px solid #BBF7D0
  border-radius : 10px
  max-width     : 400px
  margin        : 0 auto

텍스트:
  "이번 게임이 {N}번째 승리입니다!"
  font-size     : 15px
  font-weight   : 600
  color         : #15803D

아이콘:
  "🎉" (aria-hidden) 또는 별 SVG, width 20px

표시 불가 시:
  (winCount 데이터 미수신 또는 로딩 지연 시) 메시지 숨김 처리 (graceful degradation)

진입 애니메이션:
  순위 목록 진입 완료 후 600ms 지연 후 fade-in
  opacity 0 → 1, translateY 8px → 0
  duration: 300ms
```

---

## 7. 홈으로 버튼

```
텍스트          : "홈으로"
padding         : 12px 48px
background      : var(--color-primary)            /* #6366F1 */
color           : #FFFFFF
border          : none
border-radius   : 10px
font-size       : 16px
font-weight     : 700
cursor          : pointer
min-width       : 160px
box-shadow      : 0 4px 14px rgba(99,102,241,0.35)
transition      : background 150ms ease, transform 100ms ease

:hover
  background    : var(--color-primary-dark)       /* #4F46E5 */
  transform     : translateY(-2px)

클릭 동작      : /leave 발행 → 홈(/) navigate

위치           : 페이지 하단 중앙, 승수 메시지 아래 24px
```

---

## 8. 최종 점수판 섹션 (선택 추가 요소)

순위 목록 외에 족보별 점수 상세를 확인하고 싶은 사용자를 위한 접이식 패널.

```
트리거:
  텍스트        : "점수 상세 보기 ▾" (접힘) / "점수 상세 숨기기 ▴" (펼침)
  font-size     : 13px
  color         : var(--color-primary)
  cursor        : pointer
  text-align    : center

패널 (펼침 시):
  overflow      : hidden
  max-height    : 0 → auto (transition: max-height 300ms ease)
  padding       : 0 → 16px

내용:
  game.md §7.3 점수판과 동일한 테이블 구조
  단, 모든 셀이 기록 완료 상태 (상태 A)
  클릭 불가 (pointer-events: none)
  read-only 전용 명세

접근성:
  role          : "button"
  aria-expanded : true/false
  aria-controls : "score-detail-panel"
```

---

## 9. 에러 / 엣지 케이스 UI

### 9.1 GAME_OVER 수신 직후 로딩

```
순위 목록 자리에 스켈레톤 UI 표시 (1초 이내 GAME_OVER 페이로드 수신 가정):
  각 순위 행:
    background  : linear-gradient(90deg, #F3F4F6 25%, #E5E7EB 50%, #F3F4F6 75%)
    animation   : shimmer 1.2s infinite
    border-radius: 8px
    height      : 60px
```

### 9.2 ROOM_CLOSED 상태에서 결과 화면 도달 불가

```
화면 중앙 안내:
  텍스트        : "참가자가 부족하여 게임이 정상적으로 종료되지 않았습니다."
  서브 텍스트   : "결과를 저장할 수 없습니다."
  버튼          : "홈으로" (primary)
```

---

## 10. 반응형 레이아웃

| 브레이크포인트 | 범위 | 변경 사항 |
|---|---|---|
| desktop | 769px 이상 | 기본 레이아웃, 최대 너비 560px 중앙 정렬 |
| tablet | 481px ~ 768px | max-width 480px, 패딩 조정 |
| mobile | 480px 이하 | 아래 상세 |

```
mobile (480px-):
  종료 배너:
    font-size   : 18px
    padding     : 10px 0

  순위 항목:
    padding     : 12px 12px
    gap         : 8px

  순위 번호 셀:
    font-size   : 14px
    width       : 24px

  닉네임 셀:
    font-size   : 14px

  점수 셀:
    font-size   : 16px
    min-width   : 52px

  WIN 뱃지:
    position    : static (flex 내 인라인으로 배치)
    margin-left : auto

  승수 축하 메시지:
    font-size   : 14px
    padding     : 10px 14px

  홈으로 버튼:
    width       : calc(100% - 32px)
    font-size   : 15px
```

---

## 11. 접근성 명세

### 11.1 키보드 네비게이션

| 키 | 동작 |
|---|---|
| Tab | 버튼 포커스 |
| Enter / Space | 홈으로 이동 / 점수 상세 토글 |

### 11.2 ARIA 속성

```
종료 배너:
  role            : "status"
  aria-live       : "assertive"
  aria-atomic     : true
  aria-label      : "게임 종료"

순위 목록:
  role            : "list"
  aria-label      : "게임 결과 순위"

순위 항목:
  role            : "listitem"
  aria-label      : "{순위}위: {닉네임}, {점수}점{isWinner ? ', 승리' : ''}"

본인 항목:
  aria-current    : "true"

홈으로 버튼:
  role            : "button"
  aria-label      : "홈으로 이동"

승수 메시지:
  role            : "status"
  aria-live       : "polite"
  aria-label      : "이번 게임이 {N}번째 승리"

점수 상세 토글:
  role            : "button"
  aria-expanded   : "true" / "false"
  aria-controls   : "score-detail-panel"
```

### 11.3 색상 대비

| 요소 | 배경 | 전경 | 목표 |
|---|---|---|---|
| 1위 배경 닉네임 | #FFFBEB | #111827 | 4.5:1 이상 |
| WIN 뱃지 | #DCFCE7 | #16A34A | 4.5:1 이상 |
| 홈으로 버튼 | #6366F1 | #FFFFFF | 4.5:1 이상 |
| 승수 메시지 | #F0FDF4 | #15803D | 4.5:1 이상 |
| 3위 배경 닉네임 | #FFF7ED | #111827 | 4.5:1 이상 |

---

## 12. OQ 답변 — 결과 화면 표시 시간 (OQ-7)

**결정**: 결과 화면에 자동 홈 복귀 없음. 사용자가 직접 "홈으로" 버튼을 눌러야 함.

근거:
- 야추는 한 게임 시간이 길다 (평균 20~40분 예상). 점수 확인 및 족보 복기 시간 필요.
- 자동 복귀 타이머가 있으면 점수 상세 확인 중에 강제 이탈 우려.
- "홈으로" 버튼 외 다른 액션 없음 (재도전 버튼은 MVP 비목표, PRD §4.1 기준).

---

## 13. CSS 토큰 선언 목록 (신규 -- `--yacht-` 접두사)

```css
/* Yacht 결과 화면 전용 토큰 */

/* 종료 배너 */
--yacht-gameover-banner-bg    : #F1F5F9;
--yacht-gameover-banner-border: #CBD5E1;
--yacht-gameover-banner-color : #475569;

/* 순위별 배경 */
--yacht-rank1-bg              : #FFFBEB;
--yacht-rank1-accent          : #F59E0B;
--yacht-rank1-color           : #F59E0B;
--yacht-rank2-bg              : #F8FAFC;
--yacht-rank3-bg              : #FFF7ED;

/* WIN 뱃지 */
--yacht-win-badge-bg          : #DCFCE7;
--yacht-win-badge-color       : #16A34A;

/* 승수 축하 */
--yacht-win-celebration-bg    : #F0FDF4;
```

---

## 14. keyframes 정의 요약

| 이름 | 용도 | duration | timing |
|---|---|---|---|
| `yacht-banner-drop` | 종료 배너 낙하 등장 | 500ms | ease-out |
| `yacht-rank-slidein` | 순위 항목 슬라이드인 (stagger) | 350ms | ease-out |
| `yacht-celebration-fadein` | 승수 메시지 fade-in | 300ms | ease-out |
| `shimmer` | 스켈레톤 로딩 shimmer | 1.2s infinite | ease |

---

> 스펙 변경은 planner를 경유한다. Excel 모드는 PRD §3에 따라 N/A.
> OQ-7 (결과 화면 표시 시간) 디자이너 결정: 자동 복귀 없음, 수동 "홈으로" 버튼만.
