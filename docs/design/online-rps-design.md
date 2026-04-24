# UX/UI 명세 — Online RPS (실시간 멀티플레이 가위바위보)

- 작성자: designer
- 최초 작성일: 2026-04-24
- PRD 참조: `docs/specs/online-rps-prd.md` (CP1 승인 완료, 2026-04-24)
- 모드 적용 범위: **일반 모드만** (Excel 모드 N/A — PRD §3 명시)
- 이미지 에셋: `frontend/public/games/rcp/rock.png`, `paper.png`, `scissors.png`

---

## 목차

1. [RpsCard 컴포넌트 명세](#1-rpscard-컴포넌트-명세)
2. [매칭 대기 화면](#2-매칭-대기-화면)
3. [게임 화면](#3-게임-화면)
4. [결과 화면](#4-결과-화면)
5. [연결 끊김 / 에러 상태 UI](#5-연결-끊김--에러-상태-ui)
6. [홈페이지 test lab 진입 카드](#6-홈페이지-test-lab-진입-카드)
7. [컬러 / 타이포그래피 토큰](#7-컬러--타이포그래피-토큰)
8. [OQ 답변 (디자이너 결정 사항)](#8-oq-답변-디자이너-결정-사항)
9. [반응형 레이아웃 브레이크포인트](#9-반응형-레이아웃-브레이크포인트)
10. [접근성 명세](#10-접근성-명세)

---

## 1. RpsCard 컴포넌트 명세

### 1.1 개요

카드 선택 UI의 최소 단위. 게임 화면에서 선택 입력, 결과 화면에서 선택 결과 표시에 모두 사용한다.

### 1.2 Props 인터페이스 (구현자 참고용 — 구현 방식은 developer-frontend 결정)

```
RpsCard
  choice      : 'ROCK' | 'PAPER' | 'SCISSORS'
  state       : 'idle' | 'selected' | 'unselected' | 'revealed' | 'auto' | 'disabled'
  onClick?    : () => void          — idle 상태에서만 유효
  ownerLabel? : string              — 결과 화면에서 "참가자A" 등 이름 표시
  autoLabel?  : boolean             — true면 "자동선택" 뱃지 렌더
```

### 1.3 이미지 매핑

| choice | 이미지 파일 | alt 텍스트 |
|---|---|---|
| `ROCK` | `/games/rcp/rock.png` | `바위` |
| `PAPER` | `/games/rcp/paper.png` | `보` |
| `SCISSORS` | `/games/rcp/scissors.png` | `가위` |

### 1.4 상태별 스타일 명세

#### `idle` — 선택 전 기본 상태

```
크기(데스크탑): width 112px, height 140px
크기(모바일):  width 88px,  height 110px
border          : 2px solid var(--rps-card-border)     /* #D1D5DB */
border-radius   : 16px
background      : var(--rps-card-bg)                   /* #FFFFFF */
cursor          : pointer
transition      : transform 150ms ease, box-shadow 150ms ease

:hover
  transform       : translateY(-6px) scale(1.04)
  box-shadow      : 0 8px 24px rgba(0,0,0,0.14)
  border-color    : var(--rps-card-hover-border)       /* #6366F1 */

:focus-visible
  outline         : 3px solid var(--color-focus)       /* #6366F1 */
  outline-offset  : 2px
```

레이아웃 내부:
```
flex-direction  : column
align-items     : center
justify-content : center
gap             : 8px

이미지           : width 64px (데스크탑) / 52px (모바일), object-fit: contain
라벨             : font-size 13px, font-weight 600, color var(--rps-card-label)
단축키 힌트      : font-size 11px, color var(--color-text-muted)
                   (게임 화면에서만 노출, 결과 화면에서는 숨김)
```

#### `selected` — 내가 선택한 카드

```
border          : 2px solid var(--rps-selected-border)   /* #6366F1 */
box-shadow      : 0 0 0 4px rgba(99,102,241,0.25),
                  0 8px 24px rgba(99,102,241,0.2)
background      : var(--rps-selected-bg)                 /* #EEF2FF */
transform       : translateY(-4px) scale(1.06)
cursor          : default

애니메이션 진입  : keyframes rps-card-select
  0%   transform: scale(1)
  40%  transform: scale(1.12) rotate(-3deg)
  70%  transform: scale(1.08) rotate(2deg)
  100% transform: translateY(-4px) scale(1.06) rotate(0deg)
  duration: 280ms, ease-out
```

모바일 haptic 권장:
```
navigator.vibrate?.(60)  — 선택 즉시 1회 호출 (브라우저 지원 시)
```

#### `unselected` — 내가 고르지 않은 나머지 카드

```
opacity         : 0.38
transform       : scale(0.96)
cursor          : default
pointer-events  : none
transition      : opacity 200ms ease, transform 200ms ease
```

#### `revealed` — 결과 화면, 상대방(혹은 본인) 선택 표시

```
border          : 2px solid var(--rps-card-border)
box-shadow      : 0 4px 16px rgba(0,0,0,0.1)
cursor          : default

애니메이션 진입  : keyframes rps-card-reveal
  0%   opacity: 0, transform: rotateY(90deg) scale(0.8)
  60%  opacity: 1, transform: rotateY(-8deg) scale(1.03)
  100% opacity: 1, transform: rotateY(0deg)  scale(1)
  duration: 480ms, ease-out
  stagger: 결과 화면 진입 후 카드별로 100ms 지연씩 적용
```

결과에 따른 테두리 색상 (결과 화면 전용):
```
WIN  카드  border-color: var(--rps-result-win-border)   /* #16A34A */
             background:   var(--rps-result-win-bg)      /* #F0FDF4 */
LOSS 카드  border-color: var(--rps-result-loss-border)  /* #DC2626 */
             background:   var(--rps-result-loss-bg)     /* #FEF2F2 */
DRAW 카드  border-color: var(--rps-result-draw-border)  /* #CA8A04 */
             background:   var(--rps-result-draw-bg)     /* #FEFCE8 */
```

#### `auto` — 타임아웃으로 자동 선택된 카드

`revealed`와 동일한 레이아웃이지만 "자동선택" 뱃지를 카드 상단에 오버레이한다.

```
뱃지 구조:
  position       : absolute
  top            : 6px
  left           : 50%
  transform      : translateX(-50%)
  background     : var(--rps-auto-badge-bg)    /* #F59E0B */
  color          : #FFFFFF
  font-size      : 10px
  font-weight    : 700
  padding        : 2px 7px
  border-radius  : 10px
  letter-spacing : 0.03em
  내용           : "자동선택"

카드 테두리:
  border-color   : var(--rps-auto-border)      /* #F59E0B */
  background     : var(--rps-auto-bg)          /* #FFFBEB */
```

#### `disabled` — 선택 완료 후 잠금 (게임 화면 내)

```
opacity         : 1               — selected 카드는 유지
pointer-events  : none
cursor          : not-allowed     — selected가 아닌 카드에만 적용
```

`selected` + `disabled` 조합 시 `selected` 스타일이 우선한다.

### 1.5 카드 단축키 힌트

게임 화면의 `idle` 상태에서만 카드 하단에 키보드 단축키 표시.

| choice | 단축키 |
|---|---|
| `ROCK` | `[R]` |
| `PAPER` | `[P]` |
| `SCISSORS` | `[S]` |

> 기존 RspBoard는 1/2/3 숫자키를 사용했으나, Online RPS는 직관적 니모닉(R/P/S)으로 변경한다.
> 실제 키 바인딩 구현은 developer-frontend 결정.

---

## 2. 매칭 대기 화면

### 2.1 라우트

`/online-rps` — 홈에서 "Online RPS" 카드 클릭 후 자동으로 진입.

### 2.2 화면 와이어프레임

```
┌─────────────────────────────────────────────┐
│  [← 홈으로]              Online RPS          │  ← 헤더 (height 56px)
├─────────────────────────────────────────────┤
│                                             │
│         ┌─────────────────────────┐         │
│         │   [rock.png 아이콘]      │         │
│         │   48x48 pulse 애니메이션 │         │
│         └─────────────────────────┘         │
│                                             │
│       플레이어를 기다리는 중...               │  ← 상태 1 텍스트
│     ── 또는 (2인 이상 모인 경우) ──           │
│          5초 후 게임이 시작됩니다             │  ← 상태 2 텍스트
│       ╔══════════════════════════╗           │
│       ║  [5] [4] [3] [2] [1]    ║           │  ← 카운트다운 숫자 (64px)
│       ╚══════════════════════════╝           │
│                                             │
│  ┌──────────────── 참가자 목록 ───────────┐  │
│  │  • 나 (닉네임A)  — 대기중             │  │
│  │  • 참가자B       — 대기중             │  │
│  └────────────────────────────────────────┘ │
│                                             │
│          현재 인원: 2 / 4                    │  ← 인원 표시
│                                             │
│              [ 나가기 ]                      │  ← 항상 노출
│                                             │
└─────────────────────────────────────────────┘
```

### 2.3 상태별 상세 명세

#### 상태 1 — 혼자 대기 중 (`playerCount = 1`)

| 요소 | 명세 |
|---|---|
| 아이콘 | `rock.png` 48x48, `keyframes rps-pulse` (scale 1.0 → 1.1 → 1.0, 1.4s infinite) |
| 메인 텍스트 | "플레이어를 기다리는 중..." — font-size 18px, font-weight 600, color var(--color-text-primary) |
| 서브 텍스트 | "다른 플레이어가 입장하면 자동으로 시작됩니다" — font-size 14px, color var(--color-text-muted) |
| 로딩 점 | 점 3개 순차 fade (●●●), gap 4px, 각 500ms 지연 |

#### 상태 2 — 2인 이상 모임 (`playerCount >= 2`, `MATCH_COUNTDOWN` 수신)

| 요소 | 명세 |
|---|---|
| 아이콘 | pulse 중단, 정지 이미지 |
| 메인 텍스트 | "N초 후 게임이 시작됩니다!" — font-size 22px, font-weight 700, color var(--color-text-primary) |
| 카운트다운 숫자 | 현재 `secondsRemaining` 값 — font-size 64px, font-weight 900, color var(--rps-countdown-color) `#6366F1` |
| 카운트다운 애니메이션 | 숫자 변경 시 `keyframes rps-num-pop` (scale 1.3 → 1.0, 200ms ease-out) |

서버 `MATCH_COUNTDOWN` 브로드캐스트에서 `secondsRemaining` 필드를 실시간 수신해 업데이트한다.

#### 상태 3 — 카운트다운 취소 (`MATCH_COUNTDOWN_CANCELLED` 수신)

상태 1로 부드럽게 전환. 메인 텍스트 fadein 애니메이션(200ms).

### 2.4 참가자 목록

```
참가자 항목 레이아웃 (각 항목):
  display        : flex
  align-items    : center
  gap            : 8px
  padding        : 8px 12px
  border-radius  : 8px
  background     : var(--rps-player-item-bg)   /* #F9FAFB */
  border         : 1px solid var(--rps-player-item-border)  /* #E5E7EB */
  margin-bottom  : 6px

항목 내부:
  ● 상태 인디케이터 (width 8px, height 8px, border-radius 50%)
    - 대기 중: var(--color-warning) #CA8A04
    - 연결 끊김: var(--color-danger)  #DC2626
  닉네임 텍스트  : font-size 14px, font-weight 500
  "(나)" 배지    : 본인에만 노출, font-size 11px, background #EEF2FF, color #6366F1,
                   padding 1px 6px, border-radius 10px, margin-left 6px
```

### 2.5 현재 인원 표시

```
"현재 인원: N / M" — font-size 13px, color var(--color-text-muted)
N: 현재 인원 (강조색 var(--color-primary) #6366F1)
M: 최대 인원 (일반색)
```

### 2.6 나가기 버튼

```
appearance     : outlined secondary button
padding        : 10px 32px
border         : 1.5px solid var(--color-danger)    /* #DC2626 */
color          : var(--color-danger)
border-radius  : 8px
font-size      : 15px
font-weight    : 600
background     : transparent

:hover
  background   : var(--color-danger-subtle)         /* #FEF2F2 */

클릭 동작       : WebSocket /leave 발행 후 홈(/)으로 navigate
```

---

## 3. 게임 화면

### 3.1 화면 와이어프레임

```
┌─────────────────────────────────────────────┐
│  [← 나가기]              Online RPS   🔴 10s │  ← 헤더 + 타이머
├─────────────────────────────────────────────┤
│ ████████████████████░░░░░░░░░░░░░░░░░░░░░░  │  ← 타이머 프로그레스 바
├─────────────────────────────────────────────┤
│                                             │
│                                             │
│   ┌────────┐   ┌────────┐   ┌────────┐     │
│   │ rock   │   │ paper  │   │scissors│     │  ← 카드 3장 (RpsCard)
│   │  .png  │   │  .png  │   │  .png  │     │
│   │        │   │        │   │        │     │
│   │  바위  │   │   보   │   │  가위  │     │
│   │  [R]   │   │  [P]   │   │  [S]   │     │
│   └────────┘   └────────┘   └────────┘     │
│                                             │
│   "카드를 선택하세요" / "선택 완료! 대기 중"  │  ← 상태 메시지
│                                             │
├─────────────────────────────────────────────┤
│  참가자 현황                                 │
│  ┌──────────────┐  ┌──────────────┐         │
│  │ 나 ✓ 선택완료│  │ 참가자B ⏳ 대기│         │
│  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────┘
```

### 3.2 타이머 컴포넌트 명세

#### 타이머 바

```
위치           : 헤더 바로 아래, width 100%, height 6px
background     : var(--rps-timer-track)   /* #E5E7EB */
진행 채움:
  background   : var(--rps-timer-fill)    /* #6366F1 */
  width        : calc(remaining / total * 100%)
  transition   : width 1000ms linear

5초 이하 경고:
  채움 색상    : var(--rps-timer-warn)    /* #EF4444 */
  전환         : background-color 400ms ease
  헤더 타이머 숫자도 동일한 색상으로 변경

타이머 만료 (0초):
  전체 바 background: var(--rps-timer-expired) /* #DC2626 */
  brief flash 애니메이션 (opacity 1 → 0.6 → 1, 200ms)
```

#### 헤더 타이머 숫자

```
위치           : 헤더 우측
format         : "🔴 Ns" (5초 이하) / "Ns" (6초 이상)
font-size      : 16px, font-weight 700
5초 이상       : color var(--color-text-secondary)
5초 이하       : color var(--rps-timer-warn)   /* #EF4444 */
                 keyframes rps-timer-pulse (opacity 1 ↔ 0.6, 500ms alternate infinite)
```

### 3.3 카드 선택 영역

#### 선택 전 (idle)

- 카드 3장 `state="idle"`, 가로 나열
- 각 카드에 hover 효과 적용 (§1.4 `idle` 명세)
- 단축키 힌트 노출

#### 선택 후 (selected/unselected)

- 선택한 카드: `state="selected"`, 선택 애니메이션 실행
- 나머지 2장: `state="unselected"`, opacity 0.38, pointer-events none
- 선택 즉시 모바일 haptic 호출 (§1.4 `selected` 명세)
- disabled 잠금: 클릭 이벤트 제거

#### 타임아웃 자동 선택 시

1. 타이머 만료 직전 (0.5초) 카드 3장이 모두 `keyframes rps-shake` 적용 (200ms)
2. 서버에서 자동 선택 카드 수신 후 해당 카드에 `state="auto"` 적용 ("자동선택" 뱃지 노출)
3. 나머지 2장은 `state="unselected"` 적용

#### 상태 메시지

```
선택 전:
  "카드를 선택하세요"
  font-size 15px, color var(--color-text-muted), text-align center

선택 후:
  "선택 완료! 다른 플레이어를 기다리는 중..."
  font-size 15px, color var(--color-primary) #6366F1, font-weight 600

자동 선택:
  "시간이 초과되어 자동으로 선택되었습니다"
  font-size 14px, color var(--rps-auto-badge-bg) #F59E0B
```

### 3.4 참가자 선택 현황

게임 화면 하단 고정. 각 참가자가 선택했는지 여부만 노출 (선택 카드 종류 비공개).

```
레이아웃       : flex-wrap: wrap, gap 8px, justify-content: center

항목 구조 (각 참가자):
  padding      : 8px 14px
  border-radius: 8px
  font-size    : 13px, font-weight 500
  display      : flex, align-items: center, gap: 6px

대기 중 (미선택):
  background   : var(--rps-player-item-bg)     /* #F9FAFB */
  border       : 1px solid #E5E7EB
  color        : var(--color-text-secondary)
  아이콘       : "⏳"

선택 완료:
  background   : #F0FDF4
  border       : 1px solid #BBF7D0
  color        : #16A34A
  아이콘       : "✓"

본인 항목:
  닉네임 뒤에 "(나)" 배지 추가 (§2.4와 동일 스타일)
```

---

## 4. 결과 화면

### 4.1 화면 와이어프레임

```
┌─────────────────────────────────────────────┐
│  [← 나가기]              Online RPS          │  ← 헤더
├─────────────────────────────────────────────┤
│                                             │
│   ╔══════════════════════════════════════╗   │
│   ║             WIN / LOSS / DRAW        ║   │  ← 본인 결과 배너
│   ╚══════════════════════════════════════╝   │
│                                             │
│   "바위 vs 가위 → 바위 승리!"               │  ← 결과 요약 (옵션)
│                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ 나       │  │참가자B   │  │참가자C   │  │  ← 참가자 카드 나열
│  │ [rock]   │  │[scissors]│  │[paper]   │  │
│  │  바위    │  │  가위    │  │   보     │  │
│  │  WIN     │  │  LOSS    │  │  WIN     │  │
│  └──────────┘  └──────────┘  └──────────┘  │
│                                             │
│   X초 후 다음 라운드가 자동으로 시작됩니다  │  ← 재도전 카운트다운
│         ──────────────────────────          │
│   ███████████████████░░░░░░░░░░░░░░          │  ← 재도전 카운트다운 바
│                                             │
│              [ 나가기 ]                      │
│                                             │
└─────────────────────────────────────────────┘
```

### 4.2 본인 결과 배너

```
width          : 100%
padding        : 16px 0
text-align     : center
border-radius  : 12px
font-size      : 32px
font-weight    : 900
letter-spacing : 0.05em

WIN  배너:
  background   : var(--rps-result-win-bg)     /* #F0FDF4 */
  border       : 2px solid var(--rps-result-win-border) /* #16A34A */
  color        : #15803D
  텍스트       : "WIN"

LOSS 배너:
  background   : var(--rps-result-loss-bg)    /* #FEF2F2 */
  border       : 2px solid var(--rps-result-loss-border) /* #DC2626 */
  color        : #B91C1C
  텍스트       : "LOSS"

DRAW 배너:
  background   : var(--rps-result-draw-bg)    /* #FEFCE8 */
  border       : 2px solid var(--rps-result-draw-border) /* #CA8A04 */
  color        : #92400E
  텍스트       : "DRAW"

애니메이션 진입: keyframes rps-banner-pop
  0%   transform: scale(0.7),  opacity: 0
  60%  transform: scale(1.08), opacity: 1
  100% transform: scale(1),    opacity: 1
  duration: 400ms, ease-out
  지연: 카드 reveal 완료 후 100ms
```

### 4.3 결과 요약 텍스트 (옵션)

전체 결과를 한 줄로 요약. 카드 종류 조합에 따라 생성.

```
예시:
  2종(바위, 가위) 나온 경우: "바위 vs 가위 → 바위 승리!"
  1종 (전원 같음):           "전원 같은 패 → 무승부!"
  3종 모두 나온 경우:        "바위 · 보 · 가위 → 무승부! (상성 루프)"

font-size      : 15px
color          : var(--color-text-secondary)
text-align     : center
margin         : 8px 0
```

### 4.4 참가자 결과 카드 나열

`ROUND_RESULT` payload의 `results` 배열을 순서대로 렌더링한다.

```
레이아웃       : flex, flex-wrap: wrap, justify-content: center, gap: 12px

각 참가자 카드:
  상단          : 닉네임 텍스트 (font-size 13px, font-weight 600)
                  본인이면 "(나)" 배지 추가
  중앙          : RpsCard state="revealed" (또는 state="auto")
  하단          : 결과 뱃지 (WIN / LOSS / DRAW)

결과 뱃지:
  font-size    : 12px, font-weight 700
  padding      : 3px 10px
  border-radius: 20px
  WIN          : background #DCFCE7, color #15803D
  LOSS         : background #FEE2E2, color #B91C1C
  DRAW         : background #FEF9C3, color #92400E
```

`autoPicked: true` 인 참가자는 카드에 "자동선택" 뱃지 표시 (§1.4 `auto` 상태).

### 4.5 재도전 카운트다운

서버가 `ROUND_RESULT` 이후 `MATCH_COUNTDOWN`을 다시 브로드캐스트한다고 가정 (OQ-4 디자이너 결정 — §8 참조).

```
텍스트         : "N초 후 다음 라운드가 자동으로 시작됩니다"
font-size      : 14px, color var(--color-text-muted), text-align center

카운트다운 바:
  height       : 4px
  width        : 100%
  background   : #E5E7EB
  채움 bar     : background var(--color-primary) #6366F1
  width        : calc(remaining / total * 100%)
  transition   : width 1000ms linear

최소 표시 시간: 3초 (결과 배너 진입 후 첫 3초는 카운트다운 숫자/바 숨김 — §8 OQ-4)
3초 경과 후   : fade-in 200ms로 카운트다운 노출
```

### 4.6 나가기 버튼

§2.6과 동일한 스타일 및 동작.

---

## 5. 연결 끊김 / 에러 상태 UI

### 5.1 토스트 알림 공통 명세

```
위치           : 화면 상단 중앙, top 16px, z-index 2000
width          : min(360px, 90vw)
padding        : 12px 16px
border-radius  : 10px
display        : flex, align-items: center, gap: 10px
box-shadow     : 0 4px 16px rgba(0,0,0,0.16)
font-size      : 14px

진입 애니메이션: keyframes rps-toast-in
  from transform: translateY(-20px), opacity: 0
  to   transform: translateY(0),     opacity: 1
  duration: 220ms, ease-out

퇴장 애니메이션: 역방향 220ms

자동 소멸      : 기본 4000ms 후 fade-out
```

### 5.2 시나리오별 토스트

#### 상대방 연결 끊김 (`PLAYER_LEFT`, reason=`DISCONNECT` 또는 `LEAVE`)

```
아이콘        : 🔌 (aria-hidden)
텍스트        : "{nickname} 연결이 끊겼습니다"
background    : var(--rps-toast-warn-bg)     /* #FFFBEB */
border-left   : 4px solid #F59E0B
color         : #92400E
소멸          : 4초
```

#### 방 해산 (`ROOM_CLOSED`)

```
아이콘        : ⚠ (aria-hidden)
텍스트        : "방이 닫혔습니다. 3초 후 홈으로 이동합니다."
background    : var(--rps-toast-error-bg)    /* #FEF2F2 */
border-left   : 4px solid #DC2626
color         : #B91C1C
소멸          : 3초 후 자동 소멸 + 홈(/) navigate
```

#### 네트워크 에러 / 재연결 중

```
위치          : 화면 상단 전체 너비 배너 (토스트가 아닌 sticky 배너)
height        : 40px
background    : #FEF3C7
border-bottom : 2px solid #F59E0B
color         : #92400E
font-size     : 13px
text-align    : center
content       : "⚠ 연결이 불안정합니다. 재연결 시도 중..."

재연결 성공 시: 배너 fade-out 400ms
```

#### `ALREADY_IN_ROOM` (409 응답)

```
아이콘        : ℹ (aria-hidden)
텍스트        : "이미 진행 중인 방이 있습니다. 재진입합니다."
background    : var(--rps-toast-info-bg)     /* #EFF6FF */
border-left   : 4px solid #3B82F6
color         : #1D4ED8
소멸          : 3초
후속 동작      : 기존 roomId로 자동 재접속 (토스트 표시 중에 백그라운드 진행)
```

### 5.3 인라인 에러 상태 (게임/대기 화면 내)

화면 내에서 회복 불가능한 오류 발생 시 전체 화면 교체 (토스트 대신).

```
레이아웃       : 화면 중앙 flex-column
아이콘         : ⚠ (32px)
메인 텍스트    : "연결 오류가 발생했습니다"
서브 텍스트    : "{에러 코드 한글 설명}"
버튼           : "다시 시도" (primary), "홈으로" (secondary)
```

---

## 6. 홈페이지 test lab 진입 카드

### 6.1 카드 와이어프레임

```
┌─────────────────────────────────────────────┐
│                                             │
│   ┌───────────────────────────────────┐     │
│   │  [아이콘 영역]                     │     │
│   │  rock.png + scissors.png 2개 표시  │     │
│   │  (또는 paper.png 추가 3개 조합)    │     │
│   └───────────────────────────────────┘     │
│                                             │
│         Online RPS                          │  ← 카드 타이틀
│         2~4인 실시간 가위바위보              │  ← 부제
│                                             │
│              [ 플레이하기 ]                  │  ← CTA 버튼
│                                             │
└─────────────────────────────────────────────┘
```

### 6.2 상세 명세

```
카드 컨테이너:
  border-radius : 16px
  border        : 1.5px solid var(--rps-card-border)  /* #D1D5DB */
  background    : white
  padding       : 20px
  width         : min(280px, 100%)

  :hover
    box-shadow  : 0 8px 24px rgba(99,102,241,0.15)
    border-color: var(--color-primary)  /* #6366F1 */
    transform   : translateY(-3px)
    transition  : all 200ms ease

아이콘 영역:
  height        : 72px
  display       : flex, align-items: center, justify-content: center
  아이콘 배치   : rock.png (36px) + scissors.png (36px), gap 4px
                  (paper.png를 추가하면 3개 배치 가능, 크기 28px씩)

카드 타이틀:
  font-size     : 18px, font-weight 700, color var(--color-text-primary)

부제:
  font-size     : 13px, color var(--color-text-muted)
  margin-top    : 4px

CTA 버튼:
  background    : var(--color-primary)  /* #6366F1 */
  color         : white
  padding       : 10px 0
  width         : 100%
  border-radius : 8px
  font-size     : 15px, font-weight 600
  border        : none
  margin-top    : 16px
  cursor        : pointer

  :hover
    background  : var(--color-primary-dark)   /* #4F46E5 */

  클릭 동작     : navigate('/online-rps')

비로그인 상태:
  CTA 버튼 텍스트: "로그인 후 플레이"
  클릭 동작      : navigate('/login')
  버튼 opacity  : 0.85
```

---

## 7. 컬러 / 타이포그래피 토큰

### 7.1 신규 CSS 변수 목록

기존 프로젝트 스타일에 없는 Online RPS 전용 토큰 목록. developer-frontend가 글로벌 CSS 또는 모듈 내에 선언한다.

```css
/* Online RPS 전용 토큰 — 기존 프로젝트 변수와 명확히 구분하기 위해 --rps- 접두사 사용 */

/* 카드 */
--rps-card-bg              : #FFFFFF;
--rps-card-border          : #D1D5DB;
--rps-card-hover-border    : #6366F1;
--rps-card-label           : #374151;

--rps-selected-bg          : #EEF2FF;
--rps-selected-border      : #6366F1;

--rps-auto-bg              : #FFFBEB;
--rps-auto-border          : #F59E0B;
--rps-auto-badge-bg        : #F59E0B;

/* 결과 색상 */
--rps-result-win-bg        : #F0FDF4;
--rps-result-win-border    : #16A34A;
--rps-result-loss-bg       : #FEF2F2;
--rps-result-loss-border   : #DC2626;
--rps-result-draw-bg       : #FEFCE8;
--rps-result-draw-border   : #CA8A04;

/* 타이머 */
--rps-timer-track          : #E5E7EB;
--rps-timer-fill           : #6366F1;
--rps-timer-warn           : #EF4444;
--rps-timer-expired        : #DC2626;

/* 카운트다운 */
--rps-countdown-color      : #6366F1;

/* 참가자 항목 */
--rps-player-item-bg       : #F9FAFB;
--rps-player-item-border   : #E5E7EB;

/* 토스트 */
--rps-toast-warn-bg        : #FFFBEB;
--rps-toast-error-bg       : #FEF2F2;
--rps-toast-info-bg        : #EFF6FF;
```

### 7.2 기존 프로젝트 변수 참조 (Online RPS에서 재사용)

아래 변수들은 기존 프로젝트 CSS에 이미 선언된 것으로 가정한다. 미선언 시 developer-frontend가 fallback 값으로 처리.

| 변수 | 예상 fallback 값 | 용도 |
|---|---|---|
| `--color-primary` | `#6366F1` | 주 강조색 |
| `--color-primary-dark` | `#4F46E5` | hover 강조색 |
| `--color-text-primary` | `#111827` | 주 텍스트 |
| `--color-text-secondary` | `#6B7280` | 보조 텍스트 |
| `--color-text-muted` | `#9CA3AF` | 희미한 텍스트 |
| `--color-danger` | `#DC2626` | 위험/나가기 |
| `--color-danger-subtle` | `#FEF2F2` | 위험 버튼 hover 배경 |
| `--color-warning` | `#CA8A04` | 경고 |
| `--color-focus` | `#6366F1` | focus-visible outline |

### 7.3 타이포그래피

Online RPS는 별도 폰트를 사용하지 않고 프로젝트 기본 폰트(기존 CSS 참조)를 그대로 사용한다.

| 요소 | font-size | font-weight | 비고 |
|---|---|---|---|
| 결과 배너 | 32px | 900 | WIN/LOSS/DRAW |
| 카운트다운 숫자 | 64px | 900 | 대기 화면 |
| 화면 타이틀 | 20px | 700 | 헤더 |
| 상태 메시지 | 15–18px | 400–600 | 상황별 상이 |
| 카드 라벨 | 13px | 600 | RpsCard 하단 |
| 단축키 힌트 | 11px | 400 | RpsCard 최하단 |
| 참가자 현황 | 13px | 500 | 게임/대기 화면 하단 |
| 서브 텍스트 | 13–14px | 400 | 안내 문구 |

---

## 8. OQ 답변 (디자이너 결정 사항)

### OQ-4 — 결과 화면 표시 시간

**결정**: 결과 화면 최소 표시 시간 **3초**.

- 서버가 `ROUND_RESULT` 브로드캐스트 후 `MATCH_COUNTDOWN`으로 재시작 카운트다운을 트리거한다고 가정.
- 클라이언트는 `MATCH_COUNTDOWN` 수신 즉시 카운트다운 바를 렌더링하되, **결과 배너 진입 후 최초 3초 동안은 카운트다운 숫자/바를 숨김** 처리한다.
  - 3초 미만 시: 카드 reveal 애니메이션과 배너가 충분히 노출되지 않아 UX 저하 우려.
  - 3초 이상 시: 충분한 결과 인지 후 자연스럽게 다음 라운드로 흐름.
- 3초 경과 후 카운트다운 UI를 fade-in (200ms)으로 노출.
- 서버 측 카운트다운 시간이 3초 미만으로 설정된 경우, 카운트다운 UI를 즉시 노출하되 UX 저하를 developer-backend에 리스크로 공유한다.

### OQ-8 — 모바일 터치 애니메이션

**결정**: 아래 두 가지 모두 적용.

1. **Haptic (진동)**: 카드 tap 시 `navigator.vibrate?.(60)` 호출 (브라우저 지원 확인 후 조건부). 미지원 기기에서 조용히 무시.
2. **Scale-up 애니메이션**: 카드 tap 시 `state="selected"` 전환과 함께 §1.4의 `rps-card-select` 애니메이션 실행 (duration 280ms). 별도 모바일 전용 애니메이션을 두지 않고 동일 키프레임을 모바일에서도 적용.

---

## 9. 반응형 레이아웃 브레이크포인트

### 9.1 브레이크포인트 정의

| 브레이크포인트 | 범위 | 레이아웃 변경 |
|---|---|---|
| `desktop` | 769px 이상 | 기본 레이아웃 (카드 3장 가로) |
| `tablet` | 481px ~ 768px | 카드 크기 축소, 여백 감소 |
| `mobile` | 480px 이하 | 카드 3장 가로 유지하되 소형화, 헤더 간소화 |

### 9.2 게임 화면 반응형

```
desktop (769px+):
  카드 크기        : width 112px, height 140px
  이미지 크기      : 64px
  카드 간격        : gap 16px
  참가자 현황      : flex-row

tablet (481–768px):
  카드 크기        : width 96px, height 120px
  이미지 크기      : 54px
  카드 간격        : gap 12px

mobile (480px-):
  카드 크기        : width 88px, height 110px
  이미지 크기      : 48px
  카드 간격        : gap 8px
  단축키 힌트      : 숨김 (display: none)
  헤더 타이틀      : "Online RPS" → "RPS" (공간 절약)
  참가자 현황      : font-size 12px
```

### 9.3 결과 화면 반응형

```
desktop:
  참가자 카드     : flex-row, gap 12px, max 4개 나열

tablet/mobile:
  참가자 카드     : flex-wrap 허용, 2개씩 줄바꿈
  결과 배너       : font-size 26px (32px에서 축소)
```

### 9.4 매칭 대기 화면 반응형

```
카운트다운 숫자:
  desktop   : font-size 64px
  mobile    : font-size 48px

참가자 목록:
  desktop   : max-width 400px, margin auto
  mobile    : full-width
```

---

## 10. 접근성 명세

### 10.1 키보드 네비게이션

| 화면 | 키 | 동작 |
|---|---|---|
| 게임 화면 (idle) | `R` | ROCK 선택 |
| 게임 화면 (idle) | `P` | PAPER 선택 |
| 게임 화면 (idle) | `S` | SCISSORS 선택 |
| 게임 화면 (idle) | `Tab` / `Shift+Tab` | 카드 간 포커스 이동 |
| 게임 화면 (idle) | `Enter` / `Space` | 포커스된 카드 선택 |
| 결과 화면 | `Enter` / `Space` | (자동 진행이므로 별도 키 불필요) |
| 모든 화면 | `Escape` | 나가기 확인 다이얼로그 열기 (선택 구현) |

### 10.2 ARIA 속성

```
RpsCard (idle/selected/unselected):
  role            : "button" (idle), "img" (revealed/결과화면)
  aria-label      : "{choice 한글} 선택" (idle), "{choice 한글}" (결과화면)
  aria-pressed    : true/false (selected 상태)
  aria-disabled   : true (disabled/unselected)

타이머 바:
  role            : "progressbar"
  aria-valuenow   : 현재 남은 초
  aria-valuemin   : 0
  aria-valuemax   : 10
  aria-label      : "선택 제한 시간"

상태 메시지:
  role            : "status"
  aria-live       : "polite"
  aria-atomic     : true

결과 배너:
  role            : "status"
  aria-live       : "assertive"
  aria-atomic     : true
  aria-label      : "라운드 결과: WIN" (또는 LOSS, DRAW)

토스트:
  role            : "alert"
  aria-live       : "assertive"

참가자 목록:
  role            : "list"
  각 항목 role   : "listitem"
```

### 10.3 색상 대비

모든 색상 조합은 WCAG 2.1 AA 기준(본문 4.5:1, 대형 텍스트 3:1)을 충족해야 한다.

| 요소 | 배경 | 전경 | 비율 목표 |
|---|---|---|---|
| WIN 배너 텍스트 | #F0FDF4 | #15803D | 4.5:1 이상 |
| LOSS 배너 텍스트 | #FEF2F2 | #B91C1C | 4.5:1 이상 |
| DRAW 배너 텍스트 | #FEFCE8 | #92400E | 4.5:1 이상 |
| 타이머 경고 | white | #EF4444 | 3:1 이상 |
| 자동선택 뱃지 | #F59E0B | #FFFFFF | 3:1 이상 (대형 텍스트 기준) |
| CTA 버튼 | #6366F1 | #FFFFFF | 4.5:1 이상 |

---

## 부록 A — keyframes 정의 요약

developer-frontend가 구현 시 참고할 애니메이션 키프레임 이름 및 파라미터 목록.

| 이름 | 용도 | duration | timing |
|---|---|---|---|
| `rps-card-select` | 카드 선택 시 bounce | 280ms | ease-out |
| `rps-card-reveal` | 결과 화면 카드 flip-in | 480ms (stagger +100ms/카드) | ease-out |
| `rps-banner-pop` | 결과 배너 등장 | 400ms | ease-out |
| `rps-shake` | 타임아웃 임박 카드 떨림 | 200ms | ease |
| `rps-num-pop` | 카운트다운 숫자 변경 | 200ms | ease-out |
| `rps-pulse` | 대기 화면 아이콘 pulse | 1.4s infinite | ease-in-out |
| `rps-timer-pulse` | 5초 이하 타이머 숫자 깜박임 | 500ms alternate infinite | ease |
| `rps-toast-in` | 토스트 슬라이드인 | 220ms | ease-out |

---

> 본 명세는 `docs/progress/designer-online-rps.md`와 함께 관리됨. 스펙 변경은 planner 경유 필수.
> Excel 모드 명세는 PRD §3에 따라 N/A (일반 모드 전용).
