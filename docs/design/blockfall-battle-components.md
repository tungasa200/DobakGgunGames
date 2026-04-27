# 컴포넌트 명세 — Blockfall Battle (블록폴 배틀 모드)

- 작성자: designer
- 최초 작성일: 2026-04-27
- PRD 참조: `docs/specs/blockfall-battle-prd.md` (CP1 완료)
- 플로우 문서: `docs/design/blockfall-battle-flow.md`
- 모드 적용 범위: **일반 모드만** (Excel 모드 N/A — PRD §3 명시)

---

## 목차

1. [홈 Test Lab 섹션 (TestLabSection)](#1-홈-test-lab-섹션)
2. [테스트 단계 경고 배너 (TestLabBanner)](#2-테스트-단계-경고-배너)
3. [대기 화면 (WaitingScreen)](#3-대기-화면)
4. [카운트다운 오버레이 (CountdownOverlay)](#4-카운트다운-오버레이)
5. [멀티 게임판 레이아웃 (GamePlayScreen)](#5-멀티-게임판-레이아웃)
6. [Garbage Line 공격 이펙트](#6-garbage-line-공격-이펙트)
7. [큐 대기 화면 (QueueWaitingScreen)](#7-큐-대기-화면)
8. [결과 화면 (ResultScreen)](#8-결과-화면)
9. [플레이어 이탈 토스트 (PlayerLeftToast)](#9-플레이어-이탈-토스트)
10. [연결 오류 / 에러 상태 UI](#10-연결-오류--에러-상태-ui)
11. [컬러 토큰](#11-컬러-토큰)
12. [타이포그래피](#12-타이포그래피)
13. [반응형 레이아웃 브레이크포인트](#13-반응형-레이아웃-브레이크포인트)
14. [접근성 명세](#14-접근성-명세)
15. [keyframes 요약](#15-keyframes-요약)

---

## 1. 홈 Test Lab 섹션

### 1.1 섹션 위치 및 구조

기존 `HomePage.tsx`의 게임 카드 그리드 내에 이미 Test Lab 카드가 존재한다 (`{user && (...)}` 조건부). 블록폴 배틀 항목을 해당 카드 내에 추가한다.

**현재 Test Lab 카드 내 항목**:
- 실시간 채팅 랩 (`/dbgchat`)
- Online RPS (`/online-rps`)

**추가할 항목**:
- 블록폴 배틀 (`/test-lab/blockfall-battle`)

### 1.2 블록폴 배틀 진입 버튼 와이어프레임

```
Test Lab 카드 내부 (기존 구조에 추가)
┌──────────────────────────────────────────┐
│  🧪  Test Lab                            │  ← 카드 헤더 (기존 유지)
├──────────────────────────────────────────┤
│  [💬 실시간 채팅 랩]                      │  ← 기존 항목
│  ──────────────────────────────────────  │
│  [Online RPS]                            │  ← 기존 항목
│  ──────────────────────────────────────  │
│  [🟦 블록폴 배틀  BETA]                   │  ← 신규 추가 항목
└──────────────────────────────────────────┘
```

### 1.3 블록폴 배틀 항목 상세 명세

```
컨테이너 레이아웃:
  display       : flex
  align-items   : center
  gap           : 8px
  width         : 100%
  min-height    : 44px
  padding       : 8px 0

게임 아이콘:
  콘텐츠        : "🟦"
  font-size     : 1.15em
  flex-shrink   : 0

버튼 텍스트:
  flex          : 1
  font-size     : 0.87em
  font-weight   : bold
  color         : #2c3e50
  텍스트        : "블록폴 배틀"

BETA 배지:
  display       : inline-block
  background    : #F59E0B
  color         : #FFFFFF
  font-size     : 0.65em
  font-weight   : 700
  padding       : 1px 6px
  border-radius : 10px
  letter-spacing: 0.05em
  margin-left   : 6px
  텍스트        : "BETA"
  vertical-align: middle

전체 클릭 영역 (Link 또는 버튼):
  background    : white
  color         : #2c3e50
  border        : 1.5px solid #2c3e50
  border-radius : 5px
  text-decoration: none
  display       : flex
  align-items   : center
  justify-content: center
  padding       : 0 10px
  width         : 100%
  min-height    : 44px

  :hover
    background  : #2c3e50
    color       : white
    배지 background: #E07B00  (darken on hover)

클릭 동작      : navigate('/test-lab/blockfall-battle')
```

### 1.4 구분선 (divider)

각 항목 사이에 `<hr>` 또는 `border-top: 1px solid #dde1e7` 구분선을 삽입한다 (기존 `.labDivider` 클래스 재사용).

### 1.5 노출 조건 검토

현재 `{user && (...)}` 조건으로 로그인 유저에게만 노출된다. PRD §6에 따르면 게스트도 배틀에 참여 가능하다. 노출 조건 변경 여부는 developer-frontend가 사용자와 협의 후 결정 (디자이너는 로그인/비로그인 모두 노출하는 방향을 권장하지 않음 — Test Lab은 현재 로그인 유저 대상 테스트가 주목적).

---

## 2. 테스트 단계 경고 배너

### 2.1 개요

`/test-lab/blockfall-battle` 페이지 최상단, 헤더 바로 아래에 고정 배너를 표시한다. 페이지 스크롤과 무관하게 항상 노출된다.

### 2.2 와이어프레임

```
┌───────────────────────────────────────────────────┐
│ [!] 테스트 단계 기능입니다. 운영 게임이 아니므로    │
│     기록이 저장되지 않을 수 있습니다.               │
│     [게스트 접속 시 추가] 게스트 전적은 저장되지    │
│     않습니다.                                       │
└───────────────────────────────────────────────────┘
```

### 2.3 스타일 명세

```
width         : 100%
padding       : 10px 16px
background    : #FEF3C7
border-bottom : 3px solid #F59E0B
border-left   : 4px solid #F59E0B (좌측 강조 없음 — 전체 너비 배너이므로 bottom만)
color         : #92400E
font-size     : 13px
line-height   : 1.5
display       : flex
align-items   : flex-start
gap           : 8px
z-index       : 100
position      : sticky (또는 fixed — 구현 방식은 developer-frontend 결정)
top           : <헤더 높이>   (헤더 아래에 붙도록)

경고 아이콘:
  콘텐츠      : "!" 또는 텍스트 "[!]"
  width       : 20px
  height      : 20px
  border-radius: 50%
  background  : #F59E0B
  color       : #FFFFFF
  font-weight : 900
  font-size   : 12px
  display     : flex
  align-items : center
  justify-content: center
  flex-shrink : 0
  margin-top  : 1px

텍스트 영역:
  flex        : 1
  주 문구     : "테스트 단계 기능입니다. 운영 게임이 아니므로 기록이 저장되지 않을 수 있습니다."
  게스트 추가문구 (isGuest=true 시에만 표시):
                "게스트 전적은 저장되지 않습니다."
                font-weight: 600
                display: block
                margin-top: 2px
```

### 2.4 접근성

```
role          : "banner" 또는 "alert" (정적 정보이므로 "banner" 권장)
aria-label    : "테스트 단계 경고"
```

---

## 3. 대기 화면

### 3.1 화면 구조 와이어프레임

```
┌─────────────────────────────────────────────────────┐
│  [← 홈으로]           블록폴 배틀                    │  ← 헤더 (height 56px)
├─────────────────────────────────────────────────────┤
│  [!] 테스트 단계 경고 배너                           │  ← TestLabBanner
├─────────────────────────────────────────────────────┤
│                                                     │
│         ┌──────────────────────────────┐            │
│         │   🟦  (블록 아이콘 / 로고)   │            │  ← 펄스 애니메이션 (서브 상태 A)
│         │   또는 정지 아이콘           │            │  ← 정지 (서브 상태 B)
│         └──────────────────────────────┘            │
│                                                     │
│          플레이어 대기 중...  ● ● ●                  │  ← 서브 상태 A
│    ── 또는 (2인 이상 모인 경우) ──                   │
│         N초 후 게임이 시작됩니다!                    │  ← 서브 상태 B
│                ╔═══╗                                │
│                ║ 5 ║                                │  ← 카운트다운 숫자
│                ╚═══╝                                │
│                                                     │
│  ┌─────────────── 참가자 목록 ─────────────────┐    │
│  │  ● 나 (닉네임A) [나]            대기중       │    │
│  │  ● 손님-B3F1                   대기중       │    │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│          현재 인원: 2 / 4                            │  ← 인원 표시
│          (대기열에 1명 대기 중)                      │  ← queueCount > 0 시
│                                                     │
│                  [ 나가기 ]                          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 3.2 서브 상태별 상세

#### 서브 상태 A — 혼자 대기 (playerCount = 1)

```
아이콘:
  콘텐츠      : 🟦 또는 블록폴 로고 이미지
  크기        : 48x48px
  애니메이션  : keyframes bb-icon-pulse
    0%   transform: scale(1.0)
    50%  transform: scale(1.1)
    100% transform: scale(1.0)
    duration: 1.4s, infinite, ease-in-out

메인 텍스트   : "플레이어 대기 중..."
  font-size   : 18px
  font-weight : 600
  color       : var(--color-text-primary, #111827)

로딩 점 3개 (●●●):
  표시 위치   : 메인 텍스트 뒤 또는 아래
  각 dot      : width 6px, height 6px, border-radius 50%
                background: var(--battle-accent, #6366F1)
  애니메이션  : keyframes bb-dot-blink
    0%,80%,100%  opacity: 0
    40%          opacity: 1
    각 dot에 0ms / 200ms / 400ms 지연 적용

서브 텍스트   : "다른 플레이어가 입장하면 자동으로 게임이 시작됩니다"
  font-size   : 14px
  color       : var(--color-text-muted, #9CA3AF)
  margin-top  : 8px
```

#### 서브 상태 B — 카운트다운 (playerCount >= 2, MATCH_COUNTDOWN 수신)

```
아이콘:
  펄스 애니메이션 중단
  정지 이미지 표시

메인 텍스트   : "N초 후 게임이 시작됩니다!"
  font-size   : 20px
  font-weight : 700
  color       : var(--color-text-primary, #111827)

카운트다운 숫자:
  content     : secondsRemaining (5→4→3→2→1)
  font-size   : 64px (desktop) / 48px (mobile)
  font-weight : 900
  color       : var(--battle-accent, #6366F1)
  text-align  : center
  애니메이션  : keyframes bb-num-pop
    0%   transform: scale(1.3), opacity: 0.5
    100% transform: scale(1.0), opacity: 1
    duration: 200ms, ease-out (숫자 변경마다 재실행)
```

#### 서브 상태 C — 카운트다운 취소 (MATCH_COUNTDOWN_CANCELLED 수신)

```
서브 상태 A로 부드럽게 전환
전환 효과     : fade-in 200ms
카운트다운 숫자 hide: opacity 0 → display none (200ms)
메인 텍스트   : "플레이어 대기 중..." 으로 복귀
```

### 3.3 참가자 목록

```
컨테이너:
  max-width     : 400px (desktop)
  width         : 100% (mobile)
  margin        : 16px auto 0

항목별 레이아웃:
  display       : flex
  align-items   : center
  gap           : 8px
  padding       : 8px 12px
  border-radius : 8px
  background    : #F9FAFB
  border        : 1px solid #E5E7EB
  margin-bottom : 6px

  항목 내부:
    상태 인디케이터 (dot):
      width       : 8px
      height      : 8px
      border-radius: 50%
      background  : #CA8A04  (대기 중)
      flex-shrink : 0

    닉네임 텍스트:
      font-size   : 14px
      font-weight : 500
      color       : #374151

    "(나)" 배지 (본인 항목에만):
      font-size   : 11px
      background  : #EEF2FF
      color       : #6366F1
      padding     : 1px 6px
      border-radius: 10px
      margin-left : 6px

    "(게스트)" 배지 (isGuest=true 항목에):
      font-size   : 11px
      background  : #FEF3C7
      color       : #92400E
      padding     : 1px 6px
      border-radius: 10px
      margin-left : 4px

    상태 텍스트 ("대기중"):
      font-size   : 12px
      color       : #9CA3AF
      margin-left : auto
```

### 3.4 인원 표시

```
텍스트        : "현재 인원: N / M"
font-size     : 13px
color         : #9CA3AF
text-align    : center
margin-top    : 12px

N (현재 인원): color var(--battle-accent, #6366F1), font-weight 700
M (최대 인원): color #9CA3AF

대기열 안내 (queueCount > 0 시 추가 표시):
텍스트        : "(대기열에 {queueCount}명 대기 중)"
font-size     : 12px
color         : #9CA3AF
display       : block
margin-top    : 4px
```

### 3.5 나가기 버튼

```
appearance    : outlined secondary
padding       : 10px 32px
border        : 1.5px solid #DC2626
color         : #DC2626
border-radius : 8px
font-size     : 15px
font-weight   : 600
background    : transparent
margin-top    : 24px

:hover
  background  : #FEF2F2

클릭 동작     : LEAVE_BATTLE 발행 → WebSocket 종료 → navigate('/')
```

---

## 4. 카운트다운 오버레이

### 4.1 개요

GAME_STARTED 직전, MATCH_COUNTDOWN 수신 시 WAITING 화면 위에 오버레이로 표시한다. (§3.2 서브 상태 B와 중복되지 않도록 주의 — WAITING 화면의 카운트다운은 인라인, 본 섹션은 게임 시작 직전 별도 전체 화면 오버레이 방식을 권장하지 않고 인라인으로 통합한다.)

**결정**: 별도 전체 화면 오버레이 없이 WAITING 화면 내 인라인 카운트다운으로 처리한다. 카운트다운 숫자만 크게 표시하여 충분한 시각적 피드백을 제공한다.

---

## 5. 멀티 게임판 레이아웃

### 5.1 개요

GAME_STARTED 수신 후 렌더링되는 게임 진행 화면. 참가자 수에 따라 레이아웃이 달라진다.

### 5.2 전체 화면 구조 와이어프레임

```
┌──────────────────────────────────────────────────────┐
│  [← 나가기]          블록폴 배틀   [라운드 정보 등]   │  ← 헤더
├──────────────────────────────────────────────────────┤
│  [!] 테스트 단계 배너 (축소 버전 또는 유지)           │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌─────────────────────────────────────────────────┐ │
│  │         (인원수별 게임판 그리드 — §5.3 참고)      │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 5.3 인원수별 게임판 그리드 배치

#### 2인 게임 (2 players)

```
데스크톱 (769px+):
┌────────────────────────────────────────────────────┐
│  ┌───────────────────┐    ┌──────────────────────┐  │
│  │   본인 보드       │    │   상대 보드           │  │
│  │   (크게, 강조)    │    │   (동일 크기 or 작게) │  │
│  │   조작 활성       │    │   표시 전용           │  │
│  │   점수 / 라인     │    │   점수 / 라인         │  │
│  └───────────────────┘    └──────────────────────┘  │
└────────────────────────────────────────────────────┘

레이아웃:
  display            : grid
  grid-template-columns: 1fr 1fr
  gap                : 16px
  (또는 본인 보드를 조금 더 넓게: 55% 45%)
```

#### 3인 게임 (3 players)

```
데스크톱 (769px+):
┌────────────────────────────────────────────────────┐
│  ┌───────────────────┐    ┌──────────────────────┐  │
│  │                   │    │  상대 보드 A (작게)  │  │
│  │   본인 보드       │    └──────────────────────┘  │
│  │   (좌측, 크게)    │    ┌──────────────────────┐  │
│  │                   │    │  상대 보드 B (작게)  │  │
│  └───────────────────┘    └──────────────────────┘  │
└────────────────────────────────────────────────────┘

레이아웃:
  display            : grid
  grid-template-columns: 3fr 2fr
  grid-template-rows : auto
  gap                : 12px

  본인 보드           : grid-row: 1 / span 2 (좌측 전체 높이)
  상대 보드들         : 우측 열, 상하 배치
```

#### 4인 게임 (4 players)

```
데스크톱 (769px+):
┌────────────────────────────────────────────────────┐
│  ┌───────────────────┐    ┌──────────────────────┐  │
│  │   본인 보드       │    │   상대 보드 A        │  │
│  │   (좌상, 강조)    │    │                      │  │
│  └───────────────────┘    └──────────────────────┘  │
│  ┌───────────────────┐    ┌──────────────────────┐  │
│  │   상대 보드 B     │    │   상대 보드 C        │  │
│  └───────────────────┘    └──────────────────────┘  │
└────────────────────────────────────────────────────┘

레이아웃:
  display            : grid
  grid-template-columns: 1fr 1fr
  grid-template-rows : 1fr 1fr
  gap                : 12px

  본인 보드           : grid-area: 1 / 1 (좌상)
  강조 처리           : border-color: var(--battle-accent, #6366F1) 2px
```

### 5.4 개별 보드 컴포넌트 (BattleBoardCell)

```
컨테이너:
  position          : relative
  display           : flex
  flex-direction    : column
  align-items       : center
  border-radius     : 8px
  overflow          : hidden
  background        : #FFFFFF
  border            : 1.5px solid #E5E7EB

  본인 보드 강조:
    border-color    : var(--battle-accent, #6366F1)
    box-shadow      : 0 0 0 2px rgba(99,102,241,0.15)

닉네임 헤더:
  width             : 100%
  padding           : 6px 10px
  background        : #F9FAFB
  border-bottom     : 1px solid #E5E7EB
  display           : flex
  align-items       : center
  justify-content   : space-between
  font-size         : 13px
  font-weight       : 600
  color             : #374151

  "(나)" 배지 (본인):
    background      : #EEF2FF
    color           : #6366F1

  "(게스트)" 배지 (isGuest):
    background      : #FEF3C7
    color           : #92400E

  닉네임 최대 너비  : 8em (초과 시 overflow: hidden, text-overflow: ellipsis)

게임 보드 영역:
  본인 보드         : 실제 BlockfallBoard 컴포넌트 렌더링, 조작 활성
  상대 보드         : 보드 상태 표시 전용 (조작 비활성, pointer-events: none)
  상대 보드 크기    : 본인 보드 대비 70~80% (3인/4인 시 작은 크기)

점수/라인 표시 (각 보드 하단):
  padding           : 4px 8px
  display           : flex
  justify-content   : space-between
  font-size         : 12px
  color             : #6B7280
  border-top        : 1px solid #F0F0F0

  점수              : "점수: {score.toLocaleString()}"
  라인              : "라인: {lines}"
  레벨              : "레벨: {level}" (공간 있을 경우)
```

### 5.5 게임오버된 플레이어 처리

```
게임오버 오버레이 (PLAYER_FINISHED 수신 시 해당 보드에 적용):
  position          : absolute
  inset             : 0
  background        : rgba(0, 0, 0, 0.55)
  display           : flex
  flex-direction    : column
  align-items       : center
  justify-content   : center
  gap               : 8px
  border-radius     : 8px (부모 컨테이너와 동일)
  z-index           : 10

"GAME OVER" 텍스트:
  font-size         : 18px (데스크톱 기준, 작은 보드에서는 축소)
  font-weight       : 900
  color             : #FFFFFF
  letter-spacing    : 0.05em
  text-shadow       : 0 2px 4px rgba(0,0,0,0.5)

순위 표시 (rank 값 있을 경우):
  font-size         : 14px
  color             : rgba(255,255,255,0.8)
  텍스트            : "{rank}위"

애니메이션:
  오버레이 등장     : keyframes bb-gameover-in
    0%   opacity: 0, transform: scale(0.9)
    60%  opacity: 1, transform: scale(1.04)
    100% opacity: 1, transform: scale(1)
    duration: 350ms, ease-out
```

---

## 6. Garbage Line 공격 이펙트

### 6.1 Garbage Line 수신 시 (본인 보드)

```
애니메이션: keyframes bb-garbage-in
  보드 하단에서 회색 줄이 위로 밀려올라오는 효과
  방향              : bottom → up
  대상              : 추가되는 garbage 행(들) 각각
  색상              : #888888 (PRD §7.2 권장값, 완전 불투명)
  duration          : 0.3s (300ms)
  timing            : ease-out

  구현 방식 (개념):
    새로 추가되는 garbage 행은 translateY(+rowHeight)에서 시작
    → translateY(0)으로 애니메이션 (300ms)
    동시에 기존 행들은 위로 밀려 올라가는 모션 포함

Garbage 셀 색상:
  background-color  : #888888
  빈 칸(hole)       : 기존 보드 배경 색상 유지 (0 인덱스)
  표시              : 기존 블록과 동일한 cell 크기
```

### 6.2 공격 발동 시 (본인 화면 이펙트)

```
"ATTACK!" 텍스트 팝업:
  위치              : 본인 보드 중앙 상단 오버레이
  font-size         : 20px
  font-weight       : 900
  color             : #EF4444
  text-shadow       : 0 2px 8px rgba(239,68,68,0.5)
  display 시간      : 500ms 후 자동 fade-out
  애니메이션        : keyframes bb-attack-flash
    0%   opacity: 0, transform: scale(0.8) translateY(-10px)
    30%  opacity: 1, transform: scale(1.1) translateY(0)
    70%  opacity: 1, transform: scale(1.0) translateY(0)
    100% opacity: 0, transform: scale(0.9) translateY(-5px)
    duration: 500ms, ease-out

콤보 표시:
  위치              : 본인 보드 우측 상단 고정 (또는 화면 중앙)
  텍스트            : "COMBO x{N}"
    N: 콤보 횟수
  font-size         : 16px (데스크톱), 13px (모바일)
  font-weight       : 700
  color             : #F59E0B
  background        : rgba(245,158,11,0.12)
  padding           : 4px 10px
  border-radius     : 20px
  display 시간      : 1.5초 후 fade-out
  1콤보(공격 미발동): 콤보 표시하되 "ATTACK!" 팝업은 생략
  2콤보 이상        : "ATTACK!" + "COMBO x{N}" 모두 표시
```

### 6.3 Garbage 수신 표시 (본인 화면 수신 인지)

```
보드 테두리 flash:
  GARBAGE_ATTACK 수신 시 (본인 targetPlayerId일 때):
  border-color      : #EF4444 → 원래 색으로 복귀
  전환              : 200ms 내 2회 flash
  애니메이션        : keyframes bb-border-flash
    0%,100%  border-color: var(--battle-accent, #6366F1) (본인) 또는 #E5E7EB (상대)
    25%,75%  border-color: #EF4444
    duration: 400ms

공격자 닉네임 표시 (선택적):
  본인 보드 상단에 "fromPlayerId의 닉네임 공격!" 2초간 표시
  font-size         : 12px
  color             : #DC2626
  background        : rgba(220,38,38,0.08)
  padding           : 2px 8px
  border-radius     : 10px
```

---

## 7. 큐 대기 화면

### 7.1 개요

방이 PLAYING 상태일 때 join한 플레이어에게 표시되는 화면. `/test-lab/blockfall-battle` 페이지에서 QUEUE 상태로 진입.

### 7.2 와이어프레임

```
┌──────────────────────────────────────────────────────┐
│  [← 홈으로]          블록폴 배틀                      │  ← 헤더
├──────────────────────────────────────────────────────┤
│  [!] 테스트 단계 배너                                 │
├──────────────────────────────────────────────────────┤
│                                                      │
│         ┌──────────────────────────────┐             │
│         │  ⏳ (스피너 또는 아이콘)     │             │
│         └──────────────────────────────┘             │
│                                                      │
│            현재 게임 진행 중입니다                    │
│         다음 라운드에 자동으로 참가됩니다              │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │  대기열 위치: 1번째 / 총 2명 대기             │    │  ← QUEUE_POSITION 실시간 반영
│  └──────────────────────────────────────────────┘    │
│                                                      │
│         다음 라운드까지 남은 시간                     │
│  ┌──────────────────────────────────────────────┐    │
│  │  ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │    │  ← 진행 바 (있는 경우)
│  └──────────────────────────────────────────────┘    │
│                                                      │
│                  [ 나가기 ]                           │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 7.3 스타일 명세

```
화면 레이아웃:
  display           : flex
  flex-direction    : column
  align-items       : center
  justify-content   : center
  gap               : 16px
  padding           : 32px 20px
  min-height        : calc(100vh - 헤더 높이 - 배너 높이)

스피너/아이콘:
  width             : 48px
  height            : 48px
  콘텐츠            : CSS 스피너 (border-top 애니메이션) 또는 ⏳ 텍스트
  color             : var(--battle-accent, #6366F1)

메인 텍스트:
  "현재 게임 진행 중입니다"
  font-size         : 18px
  font-weight       : 600
  color             : #111827

서브 텍스트:
  "다음 라운드에 자동으로 참가됩니다"
  font-size         : 14px
  color             : #9CA3AF
  margin-top        : 4px

대기열 위치 패널:
  background        : #F3F4F6
  border            : 1px solid #E5E7EB
  border-radius     : 8px
  padding           : 12px 20px
  text-align        : center
  font-size         : 15px
  font-weight       : 600
  color             : #374151

  위치 숫자 강조:
    color           : var(--battle-accent, #6366F1)
    font-size       : 20px
    font-weight     : 900

  QUEUE_POSITION 수신 시 숫자 갱신:
    애니메이션      : keyframes bb-num-pop (§3.2 서브 상태 B와 동일)

다음 라운드 카운트다운 (GAME_RESULT 수신 후 10초 카운트 가능한 경우):
  텍스트            : "다음 라운드까지 약 N초"
  font-size         : 13px
  color             : #9CA3AF

  카운트다운 진행 바:
    height          : 4px
    width           : 100%
    max-width       : 280px
    background      : #E5E7EB
    border-radius   : 2px
    채움 bar        : background var(--battle-accent, #6366F1)
    width           : calc(remaining / 10 * 100%)
    transition      : width 1000ms linear
```

---

## 8. 결과 화면

### 8.1 개요

GAME_RESULT 수신 후 표시. **역대 승수 TOP 10 랭킹은 이 화면에서만 표시한다** (홈화면/사이드바 미표시 — PRD §9.3).

### 8.2 화면 와이어프레임

```
┌────────────────────────────────────────────────────────────────────┐
│  [← 홈으로]                 블록폴 배틀                             │  ← 헤더
├────────────────────────────────────────────────────────────────────┤
│  [!] 테스트 단계 배너                                               │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ╔══════════════════════════════════════════════════════════════╗  │
│  ║                      배틀 종료                               ║  │  ← 제목
│  ╚══════════════════════════════════════════════════════════════╝  │
│                                                                    │
│  ┌─────────────────────────┐  ┌──────────────────────────────┐    │
│  │   이번 배틀 순위         │  │   역대 승수 TOP 10            │    │
│  │                         │  │                              │    │
│  │  🥇 닉네임A      1250점  │  │  1위  닉네임X    승 24회    │    │
│  │  🥈 닉네임B      980점   │  │  2위  닉네임Y    승 19회    │    │
│  │  🥉 손님-C3D1   750점    │  │  3위  닉네임Z    승 15회    │    │  ← 본인 하이라이트
│  │  4위 닉네임D     430점   │  │  ...                         │    │
│  │                         │  │  10위 닉네임W    승  3회    │    │
│  │  [게스트] 배지 표시      │  └──────────────────────────────┘    │
│  └─────────────────────────┘                                       │
│                                                                    │
│      N초 후 다음 라운드가 자동으로 시작됩니다                       │  ← 자동 전환 안내
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  ████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │  │  ← 10초 카운트다운 바
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│            [ 다시 배틀 ]       [ 홈으로 ]                          │  ← 액션 버튼
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 8.3 반응형 레이아웃

```
데스크톱 (769px+):
  이번 배틀 순위 패널 + 역대 TOP 10 패널
  → 좌우 2열 배치
  grid-template-columns: 1fr 1fr
  gap: 20px

모바일/태블릿 (768px-):
  → 상하 1열 배치
  이번 배틀 순위 상단
  역대 TOP 10 하단
```

### 8.4 이번 배틀 순위 패널

```
패널 컨테이너:
  background        : #FFFFFF
  border            : 1.5px solid #E5E7EB
  border-radius     : 12px
  padding           : 16px

패널 제목:
  "이번 배틀 순위"
  font-size         : 16px
  font-weight       : 700
  color             : #111827
  margin-bottom     : 12px

순위 행 (results 배열, rank 오름차순):
  display           : flex
  align-items       : center
  gap               : 10px
  padding           : 8px 0
  border-bottom     : 1px solid #F5F5F5
  
  마지막 행         : border-bottom: none

  순위 아이콘/번호:
    1위             : "🥇" (24px)
    2위             : "🥈" (24px)
    3위             : "🥉" (24px)
    4위             : "4위" text (font-size 14px, color #9CA3AF)
    width           : 28px, text-align: center, flex-shrink: 0

  닉네임:
    flex            : 1
    font-size       : 14px
    font-weight     : 500
    color           : #374151
    overflow        : hidden
    text-overflow   : ellipsis
    white-space     : nowrap

  "(나)" 배지:
    본인 행에만 표시 (§3.3과 동일 스타일)

  "(게스트)" 배지:
    isGuest=true 행에 표시 (§3.3과 동일 스타일)

  점수:
    font-size       : 14px
    font-weight     : 700
    color           : #6B7280
    flex-shrink     : 0
    텍스트          : "{score.toLocaleString()}점"

본인 행 강조 (본인 playerId인 경우):
  background        : #EEF2FF
  border-radius     : 6px
  padding           : 8px
  border            : 1px solid #C7D2FE
```

### 8.5 역대 승수 TOP 10 패널

**주의: 이 패널은 결과 화면에서만 표시. 홈화면·사이드바·다른 화면에 절대 노출 금지 (PRD §9.3).**

```
패널 컨테이너:
  background        : #FFFFFF
  border            : 1.5px solid #E5E7EB
  border-radius     : 12px
  padding           : 16px

패널 제목:
  "역대 승수 TOP 10"
  font-size         : 16px
  font-weight       : 700
  color             : #111827
  margin-bottom     : 12px

  트로피 아이콘 (옵션): "🏆" 앞에 작게

순위 행 (topRankings 배열, rank 오름차순):
  display           : flex
  align-items       : center
  gap               : 8px
  padding           : 6px 0
  border-bottom     : 1px solid #F5F5F5

  순위 번호:
    font-size       : 13px
    font-weight     : 700
    color           : #9CA3AF
    width           : 28px
    text-align      : right
    flex-shrink     : 0
    1위             : color #F59E0B (금)
    2위             : color #94A3B8 (은)
    3위             : color #CD7F32 (동)
    텍스트          : "{rank}위"

  닉네임:
    flex            : 1
    font-size       : 13px
    color           : #374151
    overflow        : hidden
    text-overflow   : ellipsis
    white-space     : nowrap

  현재 로그인 유저 본인 행 강조:
    background      : #FEF3C7
    border-radius   : 4px
    padding         : 4px 6px
    border          : 1px solid #FDE68A
    font-weight     : 700

  승수:
    font-size       : 13px
    font-weight     : 700
    color           : var(--battle-accent, #6366F1)
    flex-shrink     : 0
    텍스트          : "승 {winCount}회"

기록 없음 상태 (topRankings=[]):
  텍스트            : "아직 기록이 없습니다"
  font-size         : 13px
  color             : #9CA3AF
  text-align        : center
  padding           : 16px 0
```

### 8.6 자동 전환 카운트다운 바

```
텍스트:
  "N초 후 다음 라운드가 자동으로 시작됩니다"
  font-size         : 13px
  color             : #9CA3AF
  text-align        : center
  margin-top        : 16px

카운트다운 진행 바:
  height            : 4px
  width             : 100%
  background        : #E5E7EB
  border-radius     : 2px
  margin-top        : 8px

  채움 bar:
    background      : var(--battle-accent, #6366F1)
    width           : calc(remaining / 10 * 100%)
    transition      : width 1000ms linear
    border-radius   : 2px
```

### 8.7 액션 버튼

```
버튼 영역:
  display           : flex
  gap               : 12px
  justify-content   : center
  margin-top        : 20px
  flex-wrap         : wrap

"다시 배틀" 버튼 (primary):
  background        : var(--battle-accent, #6366F1)
  color             : #FFFFFF
  padding           : 11px 28px
  border-radius     : 8px
  font-size         : 15px
  font-weight       : 600
  border            : none
  cursor            : pointer
  :hover background : #4F46E5

  클릭 동작         : POST /api/blockfall-battle/join 재호출 → join 플로우 재시작

"홈으로" 버튼 (secondary):
  background        : transparent
  color             : #6B7280
  padding           : 11px 28px
  border-radius     : 8px
  font-size         : 15px
  font-weight       : 600
  border            : 1.5px solid #D1D5DB
  cursor            : pointer
  :hover background : #F9FAFB

  클릭 동작         : navigate('/')
```

---

## 9. 플레이어 이탈 토스트

### 9.1 개요

PLAYER_LEFT 수신 시 표시. 게임 진행 중, 대기 중 모두 표시.

### 9.2 스타일 명세

```
위치              : 화면 상단 중앙
  top             : 72px (헤더 + 배너 높이 아래)
  left            : 50%
  transform       : translateX(-50%)
  z-index         : 2000

크기:
  width           : min(340px, 90vw)
  padding         : 12px 16px
  border-radius   : 10px
  box-shadow      : 0 4px 16px rgba(0,0,0,0.14)

배색:
  background      : #FFFBEB
  border-left     : 4px solid #F59E0B
  color           : #92400E

콘텐츠:
  display         : flex
  align-items     : center
  gap             : 10px

  아이콘          : 텍스트 "[나감]" 또는 간단한 SVG 아이콘
  텍스트          : "{nickname}님이 나갔습니다"
    font-size     : 14px

자동 소멸         : 2000ms 후 fade-out (200ms)

진입 애니메이션   : keyframes bb-toast-in
  from  transform: translateX(-50%) translateY(-16px), opacity: 0
  to    transform: translateX(-50%) translateY(0),     opacity: 1
  duration: 200ms, ease-out

퇴장 애니메이션   : 역방향 200ms
```

### 9.3 동시 이탈 처리

여러 플레이어가 짧은 시간 내에 이탈 시, 토스트는 순차 표시(queue) 또는 최신 메시지로 교체한다. 구현 방식은 developer-frontend 결정.

---

## 10. 연결 오류 / 에러 상태 UI

### 10.1 WebSocket 연결 불안정 배너

```
위치              : 헤더 아래 전체 너비 sticky 배너 (TestLabBanner 위 또는 대체)
height            : 40px
background        : #FEF3C7
border-bottom     : 2px solid #F59E0B
color             : #92400E
font-size         : 13px
text-align        : center
display           : flex
align-items       : center
justify-content   : center
gap               : 8px

텍스트            : "연결이 불안정합니다. 재연결 시도 중..."

재연결 성공 시    : fade-out 400ms 후 제거
```

### 10.2 인라인 오류 화면 (회복 불가)

```
레이아웃          : 화면 중앙 flex-column, gap 16px
아이콘            : "!" (32px 원형)
메인 텍스트       : "연결 오류가 발생했습니다"
서브 텍스트       : 에러 코드 한글 설명 (아래 코드표 참고)

에러 코드 한글 설명:
  ROOM_NOT_FOUND     : "방을 찾을 수 없습니다."
  NOT_IN_ROOM        : "참가 중인 방이 없습니다."
  UNAUTHORIZED       : "인증 정보가 만료되었습니다. 다시 시도해 주세요."
  MATCH_UNAVAILABLE  : "잠시 후 다시 시도해 주세요."
  기타               : "알 수 없는 오류가 발생했습니다."

버튼:
  "다시 시도"      : primary 버튼, POST /join 재호출
  "홈으로"         : secondary 버튼, navigate('/')
```

### 10.3 ALREADY_IN_ROOM (409) 처리

```
토스트 알림:
  background      : #EFF6FF
  border-left     : 4px solid #3B82F6
  color           : #1D4ED8
  텍스트          : "이미 진행 중인 방이 있습니다. 기존 방으로 이동합니다."
  소멸            : 3초

후속 동작         : 기존 roomId로 자동 재접속 (백그라운드)
```

---

## 11. 컬러 토큰

### 11.1 블록폴 배틀 전용 CSS 변수

기존 프로젝트 변수와 충돌 방지를 위해 `--battle-` 접두사를 사용한다. developer-frontend가 글로벌 CSS 또는 모듈 내에 선언.

```css
/* Blockfall Battle 전용 토큰 */

/* 주 강조색 */
--battle-accent              : #6366F1;
--battle-accent-dark         : #4F46E5;
--battle-accent-subtle       : rgba(99,102,241,0.12);

/* Garbage 블록 */
--battle-garbage-color       : #888888;

/* 배너 (Test Lab 경고) */
--battle-banner-bg           : #FEF3C7;
--battle-banner-border       : #F59E0B;
--battle-banner-text         : #92400E;

/* 게임오버 오버레이 */
--battle-gameover-bg         : rgba(0, 0, 0, 0.55);
--battle-gameover-text       : #FFFFFF;

/* 공격 이펙트 */
--battle-attack-color        : #EF4444;
--battle-combo-color         : #F59E0B;
--battle-combo-bg            : rgba(245,158,11,0.12);

/* 결과 화면 */
--battle-result-rank1        : #F59E0B;
--battle-result-rank2        : #94A3B8;
--battle-result-rank3        : #CD7F32;
--battle-result-my-row-bg    : #EEF2FF;
--battle-result-my-row-border: #C7D2FE;
--battle-result-top10-my-bg  : #FEF3C7;
--battle-result-top10-my-border: #FDE68A;

/* 토스트 */
--battle-toast-leave-bg      : #FFFBEB;
--battle-toast-leave-border  : #F59E0B;
--battle-toast-leave-text    : #92400E;
--battle-toast-error-bg      : #FEF2F2;
--battle-toast-info-bg       : #EFF6FF;
```

### 11.2 기존 프로젝트 변수 참조

| 변수 | 예상 fallback 값 | 용도 |
|---|---|---|
| `--color-text-primary` | `#111827` | 주 텍스트 |
| `--color-text-secondary` | `#6B7280` | 보조 텍스트 |
| `--color-text-muted` | `#9CA3AF` | 희미한 텍스트 |
| `--color-danger` | `#DC2626` | 나가기 버튼 |
| `--color-danger-subtle` | `#FEF2F2` | 나가기 hover |
| `--color-focus` | `#6366F1` | focus-visible outline |

---

## 12. 타이포그래피

| 요소 | font-size | font-weight | 색상 |
|---|---|---|---|
| 배틀 종료 제목 | 22px | 700 | `#111827` |
| 카운트다운 숫자 (대기) | 64px (데스크톱) / 48px (모바일) | 900 | `--battle-accent` |
| 대기 화면 메인 텍스트 | 18–20px | 600–700 | `#111827` |
| 상태 서브 텍스트 | 13–14px | 400 | `#9CA3AF` |
| 보드 닉네임 헤더 | 13px | 600 | `#374151` |
| 점수/라인 표시 | 12px | 400 | `#6B7280` |
| "GAME OVER" | 18px (기준) | 900 | `#FFFFFF` |
| "ATTACK!" 이펙트 | 20px | 900 | `#EF4444` |
| "COMBO xN" | 16px (데스크톱) / 13px (모바일) | 700 | `#F59E0B` |
| 순위 행 닉네임 | 14px | 500 | `#374151` |
| 순위 행 점수 | 14px | 700 | `#6B7280` |
| TOP 10 승수 | 13px | 700 | `--battle-accent` |
| 토스트 텍스트 | 14px | 400 | 토큰별 상이 |
| 배너 텍스트 | 13px | 400 | `--battle-banner-text` |
| 버튼 | 15px | 600 | 버튼별 상이 |

---

## 13. 반응형 레이아웃 브레이크포인트

### 13.1 브레이크포인트 정의

| 브레이크포인트 | 범위 | 주요 레이아웃 변경 |
|---|---|---|
| `desktop` | 769px 이상 | 멀티 보드 그리드, 결과 2열, 카운트다운 64px |
| `tablet` | 481px ~ 768px | 보드 2열 (본인 크게 + 나머지 작게), 결과 1열 |
| `mobile` | 480px 이하 | 본인 보드 메인, 상대 보드 하단 스트립, 카운트다운 48px |

### 13.2 멀티 게임판 반응형

```
desktop (769px+):
  §5.3 인원수별 그리드 레이아웃 적용

tablet (481–768px):
  2인: 1fr 1fr 유지 (크기 비율 조정)
  3인: 본인 보드 상단, 나머지 2인 하단 2열
  4인: 2x2 그리드 (모두 동일 크기)

mobile (480px-):
  본인 보드:
    width: 100%
    max-width: 320px
    margin: 0 auto
    게임 조작 메인
  
  상대 보드 스트립:
    display: flex
    flex-direction: row
    overflow-x: auto
    gap: 8px
    padding: 8px 0
    화면 하단 고정 또는 스크롤 영역
    각 상대 보드 미리보기 크기: 80px × 130px (축소판)
    pointer-events: none
```

### 13.3 대기/결과 화면 반응형

```
대기 화면:
  desktop   : max-width 480px, margin auto
  mobile    : full-width, padding 16px

결과 화면:
  desktop   : 2열 (순위 + TOP 10)
  mobile    : 1열 (순위 상단, TOP 10 하단)
  버튼 영역 : mobile에서 flex-direction: column, full-width 버튼

카운트다운 숫자:
  desktop   : 64px
  mobile    : 48px

"GAME OVER" 텍스트 (상대 보드 미리보기에서):
  mobile    : 14px (작은 보드에 맞게 축소)
```

---

## 14. 접근성 명세

### 14.1 키보드 네비게이션

| 화면 | 키 | 동작 |
|---|---|---|
| 모든 화면 | `Escape` | 나가기 확인 (confirm dialog) — 선택 구현 |
| 대기/큐 화면 | `Tab` | 나가기 버튼으로 포커스 이동 |
| 대기/큐 화면 | `Enter` / `Space` | 포커스된 버튼 실행 |
| 결과 화면 | `Tab` | "다시 배틀" → "홈으로" 버튼 포커스 순서 |
| 결과 화면 | `Enter` / `Space` | 포커스된 버튼 실행 |

게임 중 키보드 조작 (블록폴 기존 키 바인딩 유지):
- 방향키 좌/우: 블록 이동
- 방향키 위: 블록 회전
- 방향키 아래 / Space: 소프트/하드 드롭

### 14.2 ARIA 속성

```
TestLabBanner:
  role            : "region"
  aria-label      : "테스트 단계 경고"

대기 화면 상태 텍스트:
  role            : "status"
  aria-live       : "polite"
  aria-atomic     : true

카운트다운 숫자:
  role            : "timer"
  aria-live       : "assertive"
  aria-label      : "게임 시작까지 N초"

참가자 목록:
  role            : "list"
  각 항목         : role="listitem"

인원 표시:
  aria-live       : "polite"
  aria-atomic     : true

큐 위치 패널:
  aria-live       : "polite"
  aria-atomic     : true
  aria-label      : "대기열 위치: {position}번째 / 총 {totalInQueue}명"

플레이어 이탈 토스트:
  role            : "alert"
  aria-live       : "assertive"

결과 순위 목록:
  role            : "list"
  aria-label      : "이번 배틀 순위"
  각 행           : role="listitem"

TOP 10 목록:
  role            : "list"
  aria-label      : "역대 승수 TOP 10"

카운트다운 진행 바:
  role            : "progressbar"
  aria-valuenow   : remaining
  aria-valuemin   : 0
  aria-valuemax   : 10
  aria-label      : "다음 라운드까지 남은 시간"

게임오버 오버레이:
  aria-live       : "assertive"
  aria-label      : "게임 오버 — {rank}위"
```

### 14.3 색상 대비 (WCAG 2.1 AA 기준)

| 요소 | 배경 | 전경 | 목표 비율 |
|---|---|---|---|
| 경고 배너 텍스트 | #FEF3C7 | #92400E | 4.5:1 이상 |
| "GAME OVER" | rgba(0,0,0,0.55) | #FFFFFF | 4.5:1 이상 |
| "ATTACK!" 텍스트 | white/transparent | #EF4444 | 3:1 이상 |
| COMBO 뱃지 | rgba(245,158,11,0.12) | #F59E0B | 3:1 이상 (대형 텍스트) |
| BETA 배지 | #F59E0B | #FFFFFF | 3:1 이상 (대형 텍스트 기준) |
| 주 버튼 | #6366F1 | #FFFFFF | 4.5:1 이상 |
| 나가기 버튼 | white | #DC2626 | 4.5:1 이상 |
| 1위 순위 색상 | white | #F59E0B | 3:1 이상 (굵은 텍스트) |

---

## 15. keyframes 요약

developer-frontend 구현 참고용.

| 이름 | 용도 | duration | timing |
|---|---|---|---|
| `bb-icon-pulse` | 대기 화면 아이콘 pulse | 1.4s infinite | ease-in-out |
| `bb-dot-blink` | 대기 중 로딩 점 3개 순차 깜빡임 | 1.2s infinite (per dot, stagger) | ease |
| `bb-num-pop` | 카운트다운 숫자 변경 / 큐 위치 갱신 팝 | 200ms | ease-out |
| `bb-garbage-in` | Garbage line 밀려올라오기 | 300ms | ease-out |
| `bb-attack-flash` | "ATTACK!" 텍스트 팝업 | 500ms | ease-out |
| `bb-border-flash` | Garbage 수신 보드 테두리 flash | 400ms | ease |
| `bb-gameover-in` | 게임오버 오버레이 등장 | 350ms | ease-out |
| `bb-toast-in` | 플레이어 이탈 토스트 슬라이드인 | 200ms | ease-out |

---

> 본 명세는 `docs/progress/designer-blockfall-battle.md`와 함께 관리됨. 스펙 변경은 planner 경유 필수.
> Excel 모드 명세는 PRD §3에 따라 N/A (일반 모드 전용).

---

## UI 개편 델타 — v2

- 작성자: designer
- 작성일: 2026-04-27
- 범위: 순수 시각/레이아웃 개편. 게임 로직(WebSocket, 매칭) 변경 없음.
- 참고 파일:
  - 일반모드 기준: `BlockfallBoard.module.css`, `BlockfallBoard.tsx`
  - 개편 대상: `blockfall-battle.css`, `BlockfallBattlePage.tsx`, `BlockfallBattleBoard.tsx`

---

### 1. 배경/테마 방향 확정

**결정: 배틀 전용 세련된 다크 유지 + 구조적 개선**

**근거:**
- 현재 배틀 CSS의 다크 기조(`#0d1117` 페이지 배경, `#161b22` 헤더)는 배틀 게임의 긴장감과 잘 어울리며 일반모드 밝은 테마와 의도적으로 구별된다.
- 일반모드(`BlockfallBoard.module.css`)는 흰 배경 + `#8e44ad` 포인트로 캐주얼한 분위기이며, 배틀모드에 그대로 적용하면 차별성이 사라진다.
- 문제는 테마 방향이 아니라 **내 게임판 사이드패널 부재**와 **상대 보드 카드의 시각 정보 빈약**이다.

**채택 색상값:**

| 역할 | 색상값 | 비고 |
|---|---|---|
| 페이지 배경 | `#0d1117` | 현재 유지 |
| 헤더/패널 배경 | `#161b22` | 현재 유지 |
| 보드 카드 배경 | `#1c2128` | 현재 `#FFFFFF` → 다크 카드로 변경 |
| 보드 카드 테두리 | `#30363d` | 현재 `#E5E7EB` → 다크 테두리로 변경 |
| 본인 보드 강조 테두리 | `--battle-accent` (#6366F1) | 현재 유지 |
| 닉네임/텍스트 | `#e6edf3` | 현재 dark 기조에 맞게 이미 존재하나 카드 내부에 미적용 |
| 서브 텍스트 | `#8b949e` | 현재 유지 |
| 스탯 바 배경 | `#161b22` | 현재 유지 |

---

### 2. 포인트 컬러 결정

**결정: `--battle-accent: #6366F1` (현재 배틀 값) 유지**

**근거:**
- 일반모드의 `#8e44ad`(보라)는 브랜드 컬러로 일반모드 전체에 사용 중(버튼, 랭킹 헤더, 테두리 등). 배틀모드에 동일 값을 쓰면 두 모드의 시각적 구분이 약해진다.
- `#6366F1`(인디고)은 이미 배틀 CSS 변수로 선언되어 있고, 배틀의 전략적·경쟁적 분위기에 부합한다.
- 혼용 방지: 배틀 전용 `--battle-accent: #6366F1` 고정, 일반모드 `#8e44ad`는 배틀 파일에서 사용 금지.

**최종 포인트 컬러:**
- 주 강조: `--battle-accent: #6366F1`
- 호버/다크: `--battle-accent-dark: #4F46E5`
- 서브틀 배경: `--battle-accent-subtle: rgba(99,102,241,0.12)`

---

### 3. 내 게임판 사이드패널 구조 명세

**현재 문제:** `BlockfallBattleBoard.tsx`의 내 게임판에는 NEXT 피스 Canvas가 없고, 하단 `battle-stats-bar`에 점수/레벨/줄만 텍스트로 표시된다. 일반모드 사이드패널(NEXT/HOLD + statsArea)과 비교해 정보가 빈약하다.

**개편 방향:** 내 게임판 좌측에 일반모드 수준의 사이드패널을 추가한다.

#### 3.1 NEXT 피스 Canvas 위치와 크기

```
사이드패널 위치: 내 게임판 보드 캔버스 좌측 (내 board-item 내부)
너비           : 90px (일반모드 120px보다 작게 — 배틀 전체 레이아웃 공간 고려)
NEXT canvas:
  width        : 90px   (CELL=24, 4셀 → 96px이지만 여백 포함 90px 컨테이너)
  height       : 90px
  배경         : #0d1117 (보드와 동일한 다크)
  테두리       : 1px solid #30363d
  border-radius: 4px
  레이블       : "NEXT" — font-size 0.65em, color #8b949e, text-transform uppercase,
                 margin-bottom 4px

HOLD canvas:
  동일 크기 (90×90px)
  레이블       : "HOLD"
  홀드 사용 후 : globalAlpha 0.4 (일반모드와 동일 처리)
```

#### 3.2 점수/레벨/줄 패널 배치 방식

일반모드의 `statsArea` 방식(사이드패널 하단 margin-top: auto)을 채택한다. `battle-stats-bar`(현재 보드 하단 가로 바)는 제거하고 사이드패널 statsArea로 통합한다.

```
statsArea:
  margin-top   : auto     (HOLD 아래, 사이드패널 하단으로 밀려남)
  display      : flex
  flex-direction: column
  gap          : 8px
  align-items  : flex-end
  text-align   : right
  padding      : 8px 4px 4px
  border-bottom: 1px solid #30363d

statRow (각 항목):
  display      : flex
  flex-direction: column
  align-items  : flex-end

statLabel:
  font-size    : 0.60rem
  color        : #8b949e
  letter-spacing: 0.10em
  font-weight  : 700
  text-transform: uppercase
  margin-bottom: 2px

statValue:
  font-size    : 1.3rem
  color        : #e6edf3
  font-weight  : 800
  font-variant-numeric: tabular-nums

콤보 강조 (combo >= 2):
  color        : #EF4444

표시 항목     : SCORE / LINES / LEVEL / (COMBO — 2 이상일 때만)
```

#### 3.3 JSX 구조 스케치

```
<div class="battle-board-item mine">
  <div class="battle-board-item-header">
    닉네임, 배지, 점수
  </div>

  <div class="battle-my-play-area">          ← 신규 flex row 래퍼
    <div class="battle-my-side-panel">       ← 신규 (일반모드 sidePanel 대응)
      <div class="battle-side-box">          ← NEXT
        <div class="battle-side-title">NEXT</div>
        <canvas ref={nextRef} />
      </div>
      <div class="battle-side-box">          ← HOLD
        <div class="battle-side-title">HOLD</div>
        <canvas ref={holdRef} />
      </div>
      <div class="battle-stats-area">        ← 점수/레벨/줄 (하단 push)
        <div class="battle-stat-row">SCORE …</div>
        <div class="battle-stat-row">LINES …</div>
        <div class="battle-stat-row">LEVEL …</div>
        {combo >= 2 && <div class="battle-stat-row combo">COMBO …</div>}
      </div>
    </div>

    <div class="battle-board-canvas-wrap">   ← 기존 보드 캔버스 래퍼
      <canvas ref={boardRef} />
      {garbagePending > 0 && <div class="garbage-badge">-{garbagePending}</div>}
    </div>
  </div>

  ← battle-stats-bar 제거
</div>
```

**구현 주의:** NEXT/HOLD canvas용 ref(`nextRef`, `holdRef`)와 draw 로직은 `BlockfallBattleBoard.tsx`에 추가 필요. developer-frontend 담당.

---

### 4. 상대 보드 카드 스타일 명세

**현재 문제:** `battle-board-item` 카드의 배경이 `#FFFFFF`, 테두리가 `#E5E7EB`로 밝은 테마이나 페이지 배경은 다크(`#0d1117`)다. 혼용으로 시각적 불일치가 발생한다.

#### 4.1 카드 크기 비율

```
2인 게임:
  상대 보드 cellSize: 현재 16px → 16px 유지 (공간 충분)

3인/4인 게임:
  상대 보드 cellSize: 현재 12px → 12px 유지
  (OpponentBoard에 이미 playerCount 조건 구현됨)
```

#### 4.2 테두리 및 배경 스타일

```
.battle-board-item (상대 보드):
  background         : #1c2128     (현재 #FFFFFF → 다크 카드)
  border             : 1.5px solid #30363d  (현재 #E5E7EB)
  border-radius      : 8px         (유지)

.battle-board-item.mine:
  border-color       : #6366F1     (--battle-accent, 유지)
  box-shadow         : 0 0 0 2px rgba(99,102,241,0.12)  (유지)

.battle-board-item-header:
  background         : #21262d     (현재 #F9FAFB → 다크 헤더)
  border-bottom-color: #30363d     (현재 #E5E7EB)
  color              : #e6edf3     (현재 #374151)

.battle-board-canvas-wrap:
  background         : #0d1117     (유지 — 이미 다크)
```

#### 4.3 닉네임 표시 위치

```
위치: 카드 상단 헤더(battle-board-item-header) 내 좌측 — 현재 구조 유지
폰트: font-size 13px, font-weight 600, color #e6edf3
본인: color #6366F1 (--battle-accent, 유지)
최대 너비: 8em, overflow ellipsis (유지)

점수 표시 (헤더 우측):
  color              : #8b949e     (현재 #6B7280 → 다크 기조에 맞게)
  font-size          : 12px        (유지)
```

---

### 5. 화면별 시각 개선 포인트

#### loading (매칭 중)

**현재 문제:** 다크 배경에 스피너(`border-top-color: #58a6ff`) + "매칭 중..." 텍스트만 있다. 배틀 게임 진입 기대감을 높이는 시각 요소가 없다.

**개선 방향:** 스피너 색상을 `--battle-accent`(#6366F1)로 통일한다. "매칭 중..." 텍스트 아래 로딩 점 3개 애니메이션(`bb-dot-blink`)을 추가한다.

#### waiting (플레이어 대기)

**현재 문제:** `waiting-player-list` 항목의 배경이 `#F9FAFB`, 테두리가 `#E5E7EB`로 밝아 다크 페이지와 이질감이 크다. 전체 대기화면이 흰 박스처럼 떠 보인다.

**개선 방향:** 대기자 목록 항목 배경을 `#1c2128`, 테두리를 `#30363d`로 변경한다. `waiting-queue-info` 배경도 `#1c2128`으로 통일한다.

#### countdown (카운트다운)

**현재 문제:** 카운트다운 숫자(64px)가 다크 배경에서 충분히 크고 명확하다. 현재 구현이 양호하다.

**개선 방향:** 숫자 색상을 `--battle-accent`(#6366F1)로 확인/유지. "N초 후 게임이 시작됩니다!" 타이틀 색상을 `#f0f6fc`로 밝혀 가독성을 높인다.

#### queued (큐 대기)

**현재 문제:** `waiting-queue-info`가 `#F3F4F6` 배경으로 다크 페이지에서 밝게 튄다.

**개선 방향:** `#1c2128` 배경, `#30363d` 테두리, 텍스트 `#e6edf3`으로 다크 테마 통일.

#### playing (게임 중)

**현재 문제:** 내 보드에 NEXT/HOLD 패널이 없어 일반모드 대비 정보 밀도가 낮다. 보드 카드 배경이 밝아(`#FFFFFF`) 페이지와 불일치한다.

**개선 방향:** §3의 사이드패널 추가 + §4의 카드 다크 처리.

#### finished (결과 화면)

**현재 문제:** `result-panel`, `ranking-panel`의 배경이 `#FFFFFF`, 테두리 `#E5E7EB`로 다크 페이지 위에서 밝은 카드로 강하게 튄다.

**개선 방향:** `background: #1c2128`, `border-color: #30363d`, 텍스트 `#e6edf3`으로 다크 처리. 본인 행 강조는 `--battle-result-my-row-bg`(`#EEF2FF`) → `rgba(99,102,241,0.15)`로 다크 기조에 맞게 조정.

#### error (에러 화면)

**현재 문제:** 에러 아이콘이 텍스트 "⚠"로 작고 눈에 잘 안 띈다.

**개선 방향:** `font-size: 3em` 유지하되 `color: #EF4444`를 명시해 강조한다. "연결 오류" 제목 색상을 `#f0f6fc`로 밝힌다.

---

### 6. CSS 변경 요약 테이블

| 대상 클래스/변수 | 현재 값 | 변경 값 | 비고 |
|---|---|---|---|
| `.battle-board-item` background | `#FFFFFF` | `#1c2128` | 카드 다크화 |
| `.battle-board-item` border-color | `#E5E7EB` | `#30363d` | 카드 다크화 |
| `.battle-board-item-header` background | `#F9FAFB` | `#21262d` | 헤더 다크화 |
| `.battle-board-item-header` border-bottom-color | `#E5E7EB` | `#30363d` | 헤더 다크화 |
| `.battle-board-item-header` color | `#374151` | `#e6edf3` | 텍스트 다크화 |
| `.battle-board-nickname` color | `#374151` | `#e6edf3` | 닉네임 다크화 |
| `.battle-board-score` color | `#6B7280` | `#8b949e` | 점수 다크화 |
| `.waiting-player-item` background | `#F9FAFB` | `#1c2128` | 대기자 목록 다크화 |
| `.waiting-player-item` border-color | `#E5E7EB` | `#30363d` | 대기자 목록 다크화 |
| `.waiting-player-name` color | `#374151` | `#e6edf3` | 텍스트 다크화 |
| `.waiting-queue-info` background | `#F3F4F6` | `#1c2128` | 큐 대기 다크화 |
| `.waiting-queue-info` border-color | `#E5E7EB` | `#30363d` | 큐 대기 다크화 |
| `.waiting-queue-info` color | `#374151` | `#e6edf3` | 큐 대기 다크화 |
| `.waiting-title` color | `var(--color-text-primary)` | `#f0f6fc` | 가독성 향상 |
| `.waiting-title-countdown` color | `var(--color-text-primary)` | `#f0f6fc` | 가독성 향상 |
| `.waiting-sub` color | `var(--color-text-muted)` | `#8b949e` | 다크 기조 통일 |
| `.battle-spinner` border-top-color | `#58a6ff` | `#6366F1` | 포인트 컬러 통일 |
| `.result-panel` background | `#FFFFFF` | `#1c2128` | 결과 패널 다크화 |
| `.result-panel` border-color | `#E5E7EB` | `#30363d` | 결과 패널 다크화 |
| `.result-panel-title` color | `var(--color-text-primary)` | `#f0f6fc` | 결과 패널 다크화 |
| `.result-title` color | `var(--color-text-primary)` | `#f0f6fc` | 결과 제목 다크화 |
| `.result-nickname` color | `#374151` | `#e6edf3` | 결과 닉네임 다크화 |
| `.result-item` border-bottom-color | `#F5F5F5` | `#30363d` | 결과 구분선 다크화 |
| `.result-item.result-item-mine` background | `#EEF2FF` | `rgba(99,102,241,0.15)` | 본인 행 다크 강조 |
| `.result-item.result-item-mine` border-color | `#C7D2FE` | `rgba(99,102,241,0.4)` | 본인 행 다크 강조 |
| `.ranking-panel` background | `#FFFFFF` | `#1c2128` | TOP 10 패널 다크화 |
| `.ranking-panel` border-color | `#E5E7EB` | `#30363d` | TOP 10 패널 다크화 |
| `.ranking-panel-title` color | `var(--color-text-primary)` | `#f0f6fc` | TOP 10 제목 다크화 |
| `.ranking-panel-nickname` color | `#374151` | `#e6edf3` | TOP 10 닉네임 다크화 |
| `.ranking-panel-item` border-bottom-color | `#F5F5F5` | `#30363d` | TOP 10 구분선 다크화 |
| `.battle-stats-bar` | (현재 유지) | **제거** | 사이드패널 statsArea로 통합 |
| `.battle-my-side-panel` | (없음) | 신규 추가 | width: 90px, 사이드패널 |
| `.battle-my-play-area` | (없음) | 신규 추가 | display: flex, flex-direction: row |
| `.battle-side-box` | (없음) | 신규 추가 | NEXT/HOLD 박스 |
| `.battle-side-title` | (없음) | 신규 추가 | 사이드 레이블 |
| `.battle-stats-area` | (없음) | 신규 추가 | margin-top: auto |
| `.battle-stat-row` | (없음) | 신규 추가 | 각 스탯 항목 |
| `--color-text-primary` (battle 내) | `#111827` | `#f0f6fc` | 다크 모드 기준값 |

**신규 클래스 추가 위치:** `blockfall-battle.css` 하단 `/* ── 내 게임판 사이드패널 (v2) ── */` 섹션 신설. 기존 클래스 변경은 해당 셀렉터 직접 수정.

---

> Phase 2 (실제 CSS/TSX 수정)는 team-lead 승인 후 developer-frontend가 진행한다.
