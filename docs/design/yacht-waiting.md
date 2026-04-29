# UX 명세 — Yacht 매칭 대기 화면 (yacht-waiting)

- 작성자: designer
- 작성일: 2026-04-29
- PRD 참조: `docs/specs/yacht-prd.md` (CP1 승인 완료)
- CP1 반영: CP1-3 — 전원 준비 완료 시 방장 시작 버튼 방식. `MATCH_COUNTDOWN` UI 불필요.
- 모드 적용: **일반 모드만** (Excel 모드 N/A)

---

## 1. 라우트 & 진입 조건

| 항목 | 값 |
|---|---|
| 라우트 | `/yacht` (매칭 요청) → `/yacht/room/{roomId}` (대기방 진입) |
| 진입 조건 | 로그인 유저 전용 (비로그인 시 라우트 가드 → `/login` 리다이렉트) |
| 매칭 호출 | `POST /api/yacht/match` → roomId 수신 → WebSocket 연결 → `/join` 발행 |

---

## 2. 화면 와이어프레임

### 2.1 공통 레이아웃 (데스크탑 기준)

```
┌─────────────────────────────────────────────────────┐
│  [← 나가기]               Yacht                      │  ← 헤더 (height 56px)
├─────────────────────────────────────────────────────┤
│                                                     │
│         ┌─────────────────────────────┐             │
│         │   [주사위 아이콘 48x48]       │             │
│         │   pulse 애니메이션 (대기 중) │             │
│         └─────────────────────────────┘             │
│                                                     │
│             플레이어를 기다리는 중...                 │  ← 상태 텍스트 (1인 대기)
│        다른 플레이어가 입장하면 준비할 수 있습니다    │  ← 서브 텍스트
│                                                     │
│  ┌──────────── 참가자 목록 ────────────────────────┐  │
│  │  [왕관] 나 (닉네임A)         [준비완료]          │  │  ← 방장 본인
│  │        참가자B               [미준비]            │  │
│  │        참가자C               [준비완료]          │  │
│  │        슬롯 비어 있음                            │  │  ← 빈 슬롯
│  └────────────────────────────────────────────────┘  │
│                                                     │
│             현재 인원: 3 / 4                          │  ← 인원 표시
│                                                     │
│   [비방장] ──────── [ 준비 / 준비 취소 ] ──────────   │  ← 비방장 전용 버튼
│   [방 장] ─────────── [ 시작 ] ──────────────────   │  ← 방장 전용 버튼
│                                                     │
│                   [ 나가기 ]                          │  ← 항상 노출
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 2.2 모바일 와이어프레임 (480px 이하)

```
┌─────────────────────────────────┐
│  [← 나가기]         Yacht        │  ← 헤더
├─────────────────────────────────┤
│                                 │
│      [주사위 아이콘 40x40]        │
│                                 │
│     플레이어를 기다리는 중...      │
│  다른 플레이어가 입장하면          │
│  준비할 수 있습니다               │
│                                 │
│  ┌────────────────────────────┐  │
│  │ [왕관] 나 (닉네임A) [준비]  │  │
│  │       참가자B       [미준비]│  │
│  │       (슬롯 2개 비어 있음)  │  │
│  └────────────────────────────┘  │
│                                 │
│         현재 인원: 2 / 4          │
│                                 │
│    [ 준비 ]  또는  [ 시작 ]       │
│         [ 나가기 ]               │
│                                 │
└─────────────────────────────────┘
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
layout          : flex, space-between, align-items center

좌측 — 나가기 버튼:
  텍스트        : "← 나가기"
  font-size     : 14px, font-weight 500
  color         : var(--color-text-secondary)   /* #6B7280 */
  :hover color  : var(--color-text-primary)     /* #111827 */
  클릭 동작     : /leave 발행 → 홈(/) navigate

중앙 — 타이틀:
  텍스트        : "Yacht"
  font-size     : 20px, font-weight 700
  color         : var(--color-text-primary)     /* #111827 */
  mobile 480px- : font-size 16px

우측 — 방 정보 (선택):
  텍스트        : "방 #{roomId 앞 4자}"
  font-size     : 12px
  color         : var(--color-text-muted)       /* #9CA3AF */
```

---

## 4. 상태 아이콘 영역

```
아이콘 컨테이너:
  display       : flex
  justify-content: center
  align-items   : center
  height        : 80px

아이콘 (대기 중 상태):
  이미지        : 주사위 SVG 또는 PNG 48x48 (데스크탑) / 40x40 (모바일)
  animation     : keyframes yacht-pulse (1.4s ease-in-out infinite)
                  0%, 100% { transform: scale(1); }
                  50%      { transform: scale(1.1); }
  alt           : "야추 대기 중"

아이콘 (전원 준비 완료 상태):
  animation     : 없음 (정지)
  filter        : drop-shadow(0 0 8px var(--yacht-ready-glow)) /* #22C55E */
```

---

## 5. 상태 텍스트 영역

### 5.1 상태별 텍스트 전환표

| 조건 | 메인 텍스트 | 서브 텍스트 |
|---|---|---|
| 1인만 입장 | "플레이어를 기다리는 중..." | "다른 플레이어가 입장하면 준비할 수 있습니다" |
| 2인 이상 입장 (준비 미완료) | "다른 플레이어의 준비를 기다리는 중..." | "모든 플레이어가 준비 완료되면 방장이 게임을 시작합니다" |
| 전원 준비 완료 (방장 대기) | "모두 준비 완료!" | "방장이 시작 버튼을 눌러 게임을 시작합니다" |

```
메인 텍스트:
  font-size     : 18px
  font-weight   : 600
  color         : var(--color-text-primary)
  text-align    : center

서브 텍스트:
  font-size     : 14px
  color         : var(--color-text-muted)
  text-align    : center
  margin-top    : 6px

로딩 점 (1인 대기 상태에만 노출):
  "●●●" 순차 opacity fade (각 점 500ms 지연)
  각 점 width/height: 6px, border-radius: 50%
  color         : var(--color-text-muted)
  gap           : 4px
```

---

## 6. 참가자 목록

### 6.1 목록 컨테이너

```
list-style      : none
margin          : 0
padding         : 0
width           : 100%
max-width       : 480px
```

### 6.2 참가자 항목 (입장한 플레이어)

```
display         : flex
align-items     : center
gap             : 8px
padding         : 10px 14px
border-radius   : 10px
background      : var(--yacht-player-item-bg)      /* #F9FAFB */
border          : 1px solid var(--yacht-player-item-border)   /* #E5E7EB */
margin-bottom   : 6px
min-height      : 48px

항목 내부 구성 (좌 → 우):
  1. 방장 아이콘 (방장에만):
       내용       : "♛" (왕관 문자) 또는 별 아이콘 SVG
       font-size  : 16px
       color      : var(--yacht-host-icon-color)   /* #F59E0B */
       width      : 20px
       flex-shrink: 0

  2. 닉네임:
       font-size  : 14px
       font-weight: 500
       color      : #111827
       flex       : 1

  3. "(나)" 배지 (본인에만):
       font-size  : 11px
       background : #EEF2FF
       color      : #6366F1
       padding    : 1px 6px
       border-radius: 10px
       margin-left: 4px

  4. 준비 상태 아이콘 (우측 끝):
       준비 완료:
         아이콘   : "✓" 체크 또는 초록 원형 아이콘
         background: var(--yacht-ready-bg)         /* #DCFCE7 */
         color    : var(--yacht-ready-color)        /* #16A34A */
         padding  : 2px 10px
         border-radius: 20px
         font-size: 12px, font-weight 700
         텍스트   : "준비"
       미준비:
         아이콘   : "○" 비어 있는 원 또는 회색 원형
         background: var(--yacht-not-ready-bg)     /* #F3F4F6 */
         color    : var(--yacht-not-ready-color)    /* #9CA3AF */
         padding  : 2px 10px
         border-radius: 20px
         font-size: 12px, font-weight 700
         텍스트   : "미준비"

  방장 본인 + 준비 상태:
       방장은 준비 아이콘 대신 "방장" 뱃지 표시
       background: var(--yacht-host-badge-bg)      /* #FEF9C3 */
       color      : #92400E
       padding    : 2px 10px, border-radius: 20px
       font-size  : 12px, font-weight 700
```

### 6.3 빈 슬롯 항목

```
display         : flex
align-items     : center
gap             : 8px
padding         : 10px 14px
border-radius   : 10px
background      : transparent
border          : 1.5px dashed #E5E7EB
margin-bottom   : 6px
min-height      : 48px

텍스트:
  content       : "슬롯 비어 있음"
  font-size     : 13px
  color         : var(--color-text-muted)     /* #9CA3AF */
  font-style    : italic
```

슬롯 수 계산: `maxPlayers - currentParticipants.length` 만큼 빈 슬롯 항목 렌더링.

---

## 7. 현재 인원 표시

```
텍스트 형식    : "현재 인원: N / M"
font-size      : 13px
color          : var(--color-text-muted)
text-align     : center
margin-top     : 4px

N (현재 인원) 강조:
  color        : var(--color-primary)         /* #6366F1 */
  font-weight  : 600

M (최대 인원):
  color        : var(--color-text-muted)
```

---

## 8. 액션 버튼 영역

버튼 영역은 헤더 "나가기" 버튼과 별개로 화면 하단부에 배치.

### 8.1 비방장 — 준비 토글 버튼

```
준비 버튼 (미준비 상태):
  텍스트        : "준비"
  padding       : 12px 40px
  background    : var(--yacht-ready-btn-bg)        /* #22C55E */
  color         : #FFFFFF
  border        : none
  border-radius : 10px
  font-size     : 16px
  font-weight   : 700
  cursor        : pointer
  min-width     : 160px
  transition    : background 150ms ease, transform 100ms ease

  :hover
    background  : var(--yacht-ready-btn-hover)     /* #16A34A */
    transform   : translateY(-2px)

  클릭 동작    : /app/yacht/room/{roomId}/ready 발행
                  { "ready": true }

준비 취소 버튼 (준비 완료 상태):
  텍스트        : "준비 취소"
  padding       : 12px 40px
  background    : transparent
  color         : var(--yacht-ready-btn-bg)        /* #22C55E */
  border        : 2px solid var(--yacht-ready-btn-bg)
  border-radius : 10px
  font-size     : 16px
  font-weight   : 700
  cursor        : pointer
  min-width     : 160px
  transition    : all 150ms ease

  :hover
    background  : #F0FDF4
    border-color: var(--yacht-ready-btn-hover)     /* #16A34A */

  클릭 동작    : /app/yacht/room/{roomId}/ready 발행
                  { "ready": false }
```

### 8.2 방장 — 시작 버튼

CP1-3 확정: 모든 비방장 참가자가 준비 완료된 경우에만 활성화.

```
활성 상태 (모든 비방장 준비 완료):
  텍스트        : "게임 시작"
  padding       : 12px 40px
  background    : var(--color-primary)             /* #6366F1 */
  color         : #FFFFFF
  border        : none
  border-radius : 10px
  font-size     : 16px
  font-weight   : 700
  cursor        : pointer
  min-width     : 160px
  box-shadow    : 0 4px 14px rgba(99,102,241,0.4)
  transition    : background 150ms ease, transform 100ms ease, box-shadow 150ms ease

  :hover
    background  : var(--color-primary-dark)        /* #4F46E5 */
    transform   : translateY(-2px)
    box-shadow  : 0 6px 20px rgba(99,102,241,0.5)

  클릭 동작    : /app/yacht/room/{roomId}/start 발행
                  {}

비활성 상태 (비방장 중 미준비 있음):
  텍스트        : "게임 시작"
  padding       : 12px 40px
  background    : #D1D5DB
  color         : #9CA3AF
  border        : none
  border-radius : 10px
  font-size     : 16px
  font-weight   : 700
  cursor        : not-allowed
  opacity       : 0.6
  min-width     : 160px

  pointer-events: none  (클릭 이벤트 차단)

비활성 상태 서브 메시지:
  텍스트        : "모든 플레이어가 준비해야 시작할 수 있습니다"
  font-size     : 12px
  color         : var(--color-text-muted)
  text-align    : center
  margin-top    : 6px
```

### 8.3 나가기 버튼 (모든 참가자 공통)

```
텍스트          : "나가기"
padding         : 10px 32px
border          : 1.5px solid var(--color-danger)     /* #DC2626 */
color           : var(--color-danger)
border-radius   : 8px
font-size       : 15px
font-weight     : 600
background      : transparent
cursor          : pointer
transition      : background 150ms ease

:hover
  background    : var(--color-danger-subtle)           /* #FEF2F2 */

클릭 동작      : /app/yacht/room/{roomId}/leave 발행 → 홈(/) navigate
```

### 8.4 버튼 배치 레이아웃

```
display         : flex
flex-direction  : column
align-items     : center
gap             : 12px
width           : 100%
padding         : 16px

순서 (상→하):
  1. 준비 버튼 (비방장) / 시작 버튼 (방장)
  2. 비활성 시 서브 메시지 (방장 전용)
  3. 나가기 버튼
```

---

## 9. 반응형 레이아웃

| 브레이크포인트 | 범위 | 변경 사항 |
|---|---|---|
| desktop | 769px 이상 | 기본 레이아웃 |
| tablet | 481px ~ 768px | 참가자 목록 max-width: 100%, 버튼 min-width 130px |
| mobile | 480px 이하 | 헤더 타이틀 16px, 아이콘 40x40, 버튼 전체 너비 |

```
mobile (480px-):
  준비/시작 버튼:
    width       : 100%
    font-size   : 15px
  나가기 버튼:
    width       : 100%
  참가자 항목:
    padding     : 8px 10px
  방장 아이콘:
    font-size   : 14px
```

---

## 10. 에러 / 엣지 케이스 UI

### 10.1 매칭 중 로딩 화면 (POST /api/yacht/match 응답 대기)

```
layout          : position fixed, inset 0, flex-column, center
background      : #F0F0F0

스피너:
  width         : 40px, height 40px
  border        : 3px solid #E5E7EB
  border-top-color: var(--color-primary)
  border-radius : 50%
  animation     : spin 800ms linear infinite

텍스트 (스피너 아래):
  "매칭 중..."
  font-size     : 18px, font-weight 600, color #111827

서브 텍스트:
  "잠시만 기다려 주세요"
  font-size     : 14px, color #9CA3AF
```

### 10.2 ALREADY_IN_ROOM (409 응답)

```
토스트 (정보):
  아이콘        : "ℹ"
  텍스트        : "이미 참여 중인 방이 있습니다. 해당 방으로 이동합니다."
  background    : #EFF6FF
  border-left   : 4px solid #3B82F6
  color         : #1D4ED8
  자동 소멸     : 3초 후
  후속 동작     : 기존 roomId로 navigate
```

### 10.3 연결 끊김 / ROOM_CLOSED

```
PLAYER_LEFT 토스트:
  텍스트        : "{nickname}님이 나갔습니다"
  background    : #FFFBEB
  border-left   : 4px solid #F59E0B
  color         : #92400E
  자동 소멸     : 4초

ROOM_CLOSED 토스트:
  텍스트        : "방이 닫혔습니다. 3초 후 홈으로 이동합니다."
  background    : #FEF2F2
  border-left   : 4px solid #DC2626
  color         : #B91C1C
  자동 소멸     : 3초 + 홈(/) navigate
```

---

## 11. 접근성 명세

### 11.1 키보드 네비게이션

| 키 | 동작 |
|---|---|
| Tab / Shift+Tab | 버튼 간 포커스 이동 |
| Enter / Space | 포커스된 버튼 활성화 |

### 11.2 ARIA 속성

```
참가자 목록:
  role            : "list"
  aria-label      : "참가자 목록"
  각 항목 role   : "listitem"

준비 버튼:
  role            : "button"
  aria-pressed    : true (준비 완료) / false (미준비)
  aria-label      : "준비" 또는 "준비 취소"

시작 버튼 (비활성):
  aria-disabled   : "true"
  aria-describedby: "start-help-text"  (서브 메시지 연결)

현재 인원 표시:
  role            : "status"
  aria-live       : "polite"
  aria-label      : "현재 인원 {N}명, 최대 {M}명"

상태 텍스트:
  role            : "status"
  aria-live       : "polite"
  aria-atomic     : true
```

### 11.3 색상 대비

| 요소 | 배경 | 전경 | 목표 |
|---|---|---|---|
| 준비 버튼 텍스트 | #22C55E | #FFFFFF | 4.5:1 이상 |
| 시작 버튼 텍스트 | #6366F1 | #FFFFFF | 4.5:1 이상 |
| 비활성 시작 버튼 | #D1D5DB | #9CA3AF | 참고용 (비활성 WCAG 예외) |
| 나가기 버튼 | transparent | #DC2626 | 4.5:1 이상 |

---

## 12. CSS 토큰 선언 목록 (신규 -- `--yacht-` 접두사)

developer-frontend가 신규 선언해야 할 CSS 변수 목록.
기존 `--rps-` 토큰과 완전히 독립 선언.

```css
/* Yacht 전용 토큰 — --yacht- 접두사, --rps- 와 충돌 없음 */

/* 참가자 항목 */
--yacht-player-item-bg        : #F9FAFB;
--yacht-player-item-border    : #E5E7EB;

/* 방장 */
--yacht-host-icon-color       : #F59E0B;
--yacht-host-badge-bg         : #FEF9C3;

/* 준비 상태 */
--yacht-ready-bg              : #DCFCE7;
--yacht-ready-color           : #16A34A;
--yacht-ready-btn-bg          : #22C55E;
--yacht-ready-btn-hover       : #16A34A;
--yacht-ready-glow            : #22C55E;
--yacht-not-ready-bg          : #F3F4F6;
--yacht-not-ready-color       : #9CA3AF;
```

---

> 스펙 변경은 planner를 경유한다. Excel 모드는 PRD §3에 따라 N/A.
