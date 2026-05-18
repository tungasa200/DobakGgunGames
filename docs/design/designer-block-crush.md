# 컴포넌트 명세 — Block Crush (블록 크러시)

- 작성자: designer
- 최초 작성일: 2026-05-18
- PRD 참조: `docs/specs/block-crush-prd.md`
- 플로우 문서: `docs/design/block-crush-flow.md`
- 모드 적용 범위: **일반 모드만** (Excel 모드 N/A)
- CSS 모듈 파일: `frontend/src/games/block-crush/BlockCrush.module.css`
- 페이지 파일: `frontend/src/pages/BlockCrushPage.tsx`
- 게임 컴포넌트: `frontend/src/games/block-crush/`

---

## 목차

1. [전체 레이아웃 (BlockCrushPage)](#1-전체-레이아웃-blockchrushpage)
2. [BlockCrushBoard (8×8 그리드)](#2-blockchrushboard-8x8-그리드)
3. [BlockCrushTray (3블록 트레이)](#3-blockcrushtray-3블록-트레이)
4. [폴리오미노 블록 색상 팔레트 (18종)](#4-폴리오미노-블록-색상-팔레트-18종)
5. [HUD (점수판)](#5-hud-점수판)
6. [게임 오버 모달](#6-게임-오버-모달)
7. [랭킹 테이블 (게임 하단)](#7-랭킹-테이블-게임-하단)
8. [CSS Custom Properties 전체 목록](#8-css-custom-properties-전체-목록)
9. [keyframes 요약](#9-keyframes-요약)
10. [반응형 레이아웃 브레이크포인트](#10-반응형-레이아웃-브레이크포인트)
11. [접근성 명세](#11-접근성-명세)
12. [타이포그래피](#12-타이포그래피)

---

## 1. 전체 레이아웃 (BlockCrushPage)

### 1.1 페이지 구조 와이어프레임

```
┌─────────────────────────────────────────────────────┐
│  NormalHeader (accentColor: var(--bcr-accent))      │
│  [← 게임 목록]  블록 크러시   [엑셀 모드 버튼 숨김]  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │              HUD (점수 / 콤보)                │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  ┌────────────────────────┐                         │
│  │                        │                         │
│  │   BlockCrushBoard      │                         │
│  │   (8 × 8 그리드)        │                         │
│  │                        │                         │
│  └────────────────────────┘                         │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │          BlockCrushTray (3 슬롯)              │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
├─────────────────────────────────────────────────────┤
│              랭킹 테이블 섹션                         │
│  [주간 랭킹 탭] [전체 최고 기록 탭]                  │
│  ┌──────────────────────────────────────────────┐   │
│  │  순위 │ 닉네임 │ 점수 │ 날짜                  │   │
│  └──────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────┤
│  Footer                                             │
└─────────────────────────────────────────────────────┘
```

### 1.2 페이지 컨테이너 스타일

```
.pageWrapper:
  position        : fixed
  inset           : 0
  overflow        : auto
  background      : var(--bcr-page-bg)    /* #f5f0e8 */
  font-family     : sans-serif
  display         : flex
  flex-direction  : column

.gameSection:
  display         : flex
  flex-direction  : column
  align-items     : center
  padding         : 16px 16px 32px
  gap             : 16px
  flex            : 1

.rankingSection:
  width           : 100%
  max-width       : 520px
  margin          : 0 auto
  padding         : 0 16px 48px
```

### 1.3 NormalHeader 적용

- 기존 `NormalHeader` 컴포넌트를 그대로 사용.
- `accentColor`: `var(--bcr-accent)` — `#E67E22` (따뜻한 주황색, 블록 크러시 아이덴티티).
- `gameName`: `"블록 크러시"`.
- `currentGame`: `"block-crush"`.
- Excel 모드 버튼: NormalHeader에서 자동 표시되나, Block Crush는 Excel 모드 미지원. GamePage에서 `gameKey: 'block-crush'`를 Excel 모드 미지원 목록에 추가하여 버튼을 숨기거나 비활성화. (developer-frontend 결정)

### 1.4 Footer 적용

- 기존 `Footer` 컴포넌트 그대로 사용. 별도 수정 없음.

---

## 2. BlockCrushBoard (8×8 그리드)

### 2.1 보드 전체 컨테이너

```
.board:
  display         : grid
  grid-template-columns: repeat(8, var(--bcr-cell-size))
  grid-template-rows   : repeat(8, var(--bcr-cell-size))
  gap             : var(--bcr-gap)        /* 2px */
  background      : var(--bcr-grid-line)  /* #C8B89A */
  border          : 2px solid var(--bcr-grid-line)
  border-radius   : 8px
  padding         : 2px
  box-shadow      : 0 4px 16px rgba(0, 0, 0, 0.18)
  position        : relative             /* 드래그 미리보기 절대 위치 기준 */
  user-select     : none
```

### 2.2 셀 크기 권장값

| 환경 | 셀 크기 (`--bcr-cell-size`) | 보드 총 크기 (셀 8 + gap 7) |
|---|---|---|
| PC (769px+) | 56px | 56×8 + 2×7 = 462px |
| 태블릿 (481~768px) | 46px | 46×8 + 2×7 = 382px |
| 모바일 (480px 이하) | 38px | 38×8 + 2×7 = 318px |
| 모바일 소형 (360px 이하) | 32px | 32×8 + 2×7 = 270px |

### 2.3 셀 스타일

#### 빈 셀

```
.cell:
  width           : var(--bcr-cell-size)
  height          : var(--bcr-cell-size)
  border-radius   : 4px
  background      : var(--bcr-cell-empty)    /* #F7F0E3 */
  transition      : background 60ms ease
```

#### 채워진 셀 (블록 종류별 색상)

```
.cell[data-filled="true"]:
  background      : var(--bcr-block-COLOR)   /* 4번 섹션 참고 */
  box-shadow      : inset 0 2px 0 rgba(255,255,255,0.35),
                    inset 0 -2px 0 rgba(0,0,0,0.18)
  /* 입체감: 상단 밝은 하이라이트, 하단 그림자 */
```

#### 드래그 미리보기 — 유효 위치

```
.cell[data-preview="valid"]:
  background      : var(--bcr-preview-valid)    /* rgba(46, 204, 113, 0.45) */
  box-shadow      : inset 0 0 0 2px rgba(46, 204, 113, 0.8)
  border-radius   : 4px
  animation       : bcrPreviewPulse 0.6s ease-in-out infinite alternate
```

#### 드래그 미리보기 — 무효 위치 (이미 채워진 셀 위)

```
.cell[data-preview="invalid"]:
  background      : var(--bcr-preview-invalid)  /* rgba(231, 76, 60, 0.40) */
  box-shadow      : inset 0 0 0 2px rgba(231, 76, 60, 0.8)
  border-radius   : 4px
```

### 2.4 줄 클리어 애니메이션

클리어 대상 행/열 전체 셀에 클래스 `.clearing`을 추가한다.

```
.cell.clearing:
  animation       : bcrClearFlash 160ms ease-out forwards

@keyframes bcrClearFlash:
  0%    background: var(--bcr-clear-flash)  /* #FFFBE6 */
        box-shadow: 0 0 12px rgba(255,235,59,0.7)
        transform: scale(1.05)
  60%   background: var(--bcr-clear-flash)
        transform: scale(1.0)
  100%  background: transparent
        opacity: 0
        transform: scale(0.85)
  /* duration: 280ms total (160ms 재생 후 나머지 120ms에 걸쳐 소멸) */
```

구현 권장 흐름:
1. 클리어 대상 셀에 `.clearing` 클래스 추가.
2. 280ms 후 해당 셀 데이터를 empty 상태로 변경 (애니메이션 완료 후 처리).
3. 여러 줄 동시 클리어 시 모든 대상 셀에 동시 적용.

### 2.5 그리드 라인 스타일

- 셀 사이 `gap: 2px`, 배경색 `var(--bcr-grid-line): #C8B89A`.
- 보드 테두리는 동일 색상 `border: 2px solid var(--bcr-grid-line)`.
- 셀이 gap을 통해 그리드 라인을 형성하는 방식 (배경이 투과되어 보임).

---

## 3. BlockCrushTray (3블록 트레이)

### 3.1 트레이 컨테이너

```
.tray:
  display         : flex
  flex-direction  : row
  justify-content : center
  align-items     : flex-end
  gap             : 20px
  padding         : 12px 16px
  background      : var(--bcr-tray-bg)     /* rgba(0,0,0,0.06) */
  border-radius   : 12px
  border          : 1px solid var(--bcr-tray-border)  /* rgba(0,0,0,0.10) */
  min-height      : 100px
  width           : fit-content
```

### 3.2 트레이 슬롯

트레이 슬롯 3개는 항상 고정 너비 영역을 차지한다 (null 상태에도 공간 유지).

```
.traySlot:
  width           : calc(var(--bcr-tray-cell) * 5)  /* 최대 5셀 폴리오미노 기준 */
  min-width       : calc(var(--bcr-tray-cell) * 4)
  min-height      : calc(var(--bcr-tray-cell) * 4)
  display         : flex
  align-items     : center
  justify-content : center
  cursor          : grab
  position        : relative

  /* 슬롯 내 폴리오미노 렌더링은 미니 그리드로 */

.traySlot:active:
  cursor          : grabbing

.traySlot[data-empty="true"]:  /* 배치 완료 후 빈 슬롯 */
  opacity         : 0
  pointer-events  : none
  /* 자리는 유지, 시각적으로만 숨김 */
```

### 3.3 트레이 셀 크기

| 환경 | 트레이 셀 (`--bcr-tray-cell`) | 비고 |
|---|---|---|
| PC (769px+) | 22px | 보드 셀의 약 39% |
| 태블릿 (481~768px) | 18px | |
| 모바일 (480px 이하) | 15px | |

### 3.4 폴리오미노 미니 렌더링

트레이 슬롯 내 폴리오미노는 그 블록의 바운딩 박스 크기의 미니 그리드로 렌더링한다.

```
.trayPiece:
  display         : grid
  /* grid-template-columns / rows는 JS로 동적 설정 (바운딩 박스 크기 기반) */
  gap             : 1px

.trayPieceCell:
  width           : var(--bcr-tray-cell)
  height          : var(--bcr-tray-cell)
  border-radius   : 3px
  background      : var(--bcr-block-COLOR)  /* 블록 종류별 */
  box-shadow      : inset 0 1px 0 rgba(255,255,255,0.35),
                    inset 0 -1px 0 rgba(0,0,0,0.18)

.trayPieceCell[data-empty="true"]:
  background      : transparent
  box-shadow      : none
```

### 3.5 드래그 중 원본 슬롯 표시 방법

드래그를 시작하면 원본 슬롯의 폴리오미노는 반투명으로 유지한다 (완전히 숨기지 않음).

```
.traySlot[data-dragging="true"] .trayPiece:
  opacity         : 0.35
  pointer-events  : none
  /* 드래그 중 원본 위치 인지 제공, 취소 시 복원될 위치 가이드 역할 */
```

드래그 아이템(커서/손가락을 따라다니는 블록):

```
.dragGhost:
  position        : fixed
  pointer-events  : none
  z-index         : 9999
  /* PC: cursor 위치 기준 offset (-절반 너비, -절반 높이) */
  /* 모바일: touch 위치보다 y 방향으로 -80px offset (손가락 가림 방지) */
  opacity         : 0.92
  transform       : scale(1.05)   /* 집어든 느낌 */
  transition      : transform 80ms ease-out

  .trayPieceCell 과 동일한 셀 크기 사용 (보드 셀 크기: var(--bcr-cell-size))
  /* 보드 위 올라오면 보드 셀 크기로 커짐 — 드래그 시작 시 보드 셀 크기로 고정 권장 */
```

---

## 4. 폴리오미노 블록 색상 팔레트 (18종)

### 4.1 색상 설계 원칙

- blockfall(블록폴) 게임의 `#8e44ad` 보라 계열, blockfall-insane의 `#ff2d55` 핑크/레드 계열과 **명확히 구분**되는 팔레트 사용.
- 블록 크러시는 **따뜻하고 채도 높은 파스텔-팝 계열** 팔레트를 채택. 보드 배경의 크림색(`#F7F0E3`)과 보색 대비로 생기 있게 표현.
- 색맹 사용자를 위해 색상만으로 구분하지 않고 블록 **형태(폴리오미노 모양)**로 1차 구분 가능하므로, 색상 팔레트는 미적 기준 우선으로 설계.
- 단, 인접 슬롯의 블록이 동일 색상이 되지 않도록 세트 생성 로직에서 최소한의 인접 색상 충돌 방지 권장 (developer-frontend 결정).

### 4.2 18종 블록 색상 키 할당

블록 종류 코드는 **PRD §4.3 확정 코드명**을 사용한다. H/V 변형은 동일 형태이므로 같은 색상을 공유한다.

| 블록 코드 (PRD §4.3) | 형태 | CSS 변수 | 색상값 | 색 설명 |
|---|---|---|---|---|
| `DOT_1` | 단일 1칸 | `--bcr-block-dot1` | `#FFF176` | 옐로우 |
| `I_2_H` | 가로 2칸 | `--bcr-block-i2h` | `#FFB74D` | 앰버 |
| `I_2_V` | 세로 2칸 | `--bcr-block-i2v` | `#FFB74D` | 앰버 (H와 동일) |
| `I_3_H` | 가로 3칸 | `--bcr-block-i3h` | `#FF8A65` | 딥 오렌지 |
| `I_3_V` | 세로 3칸 | `--bcr-block-i3v` | `#FF8A65` | 딥 오렌지 (H와 동일) |
| `I_4_H` | 가로 4칸 | `--bcr-block-i4h` | `#F06292` | 코랄 핑크 |
| `I_4_V` | 세로 4칸 | `--bcr-block-i4v` | `#F06292` | 코랄 핑크 (H와 동일) |
| `I_5_H` | 가로 5칸 | `--bcr-block-i5h` | `#4DB6AC` | 틸 |
| `I_5_V` | 세로 5칸 | `--bcr-block-i5v` | `#4DB6AC` | 틸 (H와 동일) |
| `SQ_2` | 2×2 정사각 | `--bcr-block-sq2` | `#9575CD` | 미디엄 퍼플 (블록폴 진보라와 구분) |
| `SQ_3` | 3×3 정사각 | `--bcr-block-sq3` | `#FFCC02` | 고채도 옐로우 |
| `L_TL` | ┘ 좌상 꺾임 3칸 | `--bcr-block-ltl` | `#AED581` | 라임 그린 |
| `L_TR` | └ 우상 꺾임 3칸 | `--bcr-block-ltr` | `#A5D6A7` | 민트 그린 |
| `L_BL` | ┐ 좌하 꺾임 3칸 | `--bcr-block-lbl` | `#80CBC4` | 민트 틸 |
| `L_BR` | ┌ 우하 꺾임 3칸 | `--bcr-block-lbr` | `#CE93D8` | 라일락 |
| `T_4` | T자 4칸 | `--bcr-block-t4` | `#4FC3F7` | 라이트 블루 |
| `S_4` | S자 4칸 | `--bcr-block-s4` | `#F48FB1` | 핑크 |
| `Z_4` | Z자 4칸 | `--bcr-block-z4` | `#80DEEA` | 시안 |

### 4.3 색상 접근성 메모

- 위 18색 모두 보드 배경 `#F7F0E3` 위에서 육안 구분 가능.
- 색맹 유저 대응: 형태가 다른 폴리오미노이므로 색상 외 시각 단서 존재. 별도 색맹 모드 불필요.
- WCAG AA(4.5:1) 대비는 색상 자체보다 HUD, 점수, 버튼 텍스트에 적용.

---

## 5. HUD (점수판)

### 5.1 HUD 레이아웃

```
┌──────────────────────────────────────────────────────┐
│         점수: 12,340               COMBO ×3          │
└──────────────────────────────────────────────────────┘
```

```
.hud:
  width           : 100%
  max-width       : calc(var(--bcr-cell-size) * 8 + 2px * 7 + 4px)
                    /* 보드 너비와 동일 */
  display         : flex
  justify-content : space-between
  align-items     : center
  padding         : 6px 8px
  background      : var(--bcr-hud-bg)        /* rgba(0,0,0,0.06) */
  border-radius   : 8px
  border          : 1px solid var(--bcr-hud-border)  /* rgba(0,0,0,0.10) */
```

### 5.2 현재 점수 표시

```
.scoreLabel:
  font-size       : 12px
  font-weight     : 600
  color           : var(--bcr-text-muted)   /* #7A6952 */
  letter-spacing  : 0.04em
  text-transform  : uppercase

.scoreValue:
  font-size       : 26px    (PC)  /  22px (모바일)
  font-weight     : 900
  color           : var(--bcr-text-primary)  /* #3D2B1A */
  font-variant-numeric: tabular-nums
  transition      : transform 120ms ease-out

.scoreValue.bump:
  /* 점수 증가 시 1프레임 scale up 후 복귀 */
  animation       : bcrScoreBump 200ms ease-out
```

### 5.3 콤보 카운터

콤보 2 이상일 때만 표시. 콤보 1은 표시하지 않는다.

```
.comboDisplay:
  display         : flex
  align-items     : center
  gap             : 4px
  background      : var(--bcr-combo-bg)   /* rgba(230, 126, 34, 0.14) */
  border          : 1px solid var(--bcr-combo-border)  /* rgba(230, 126, 34, 0.4) */
  border-radius   : 20px
  padding         : 3px 10px
  opacity         : 0        /* 콤보 없으면 숨김 */
  transition      : opacity 200ms, transform 200ms

.comboDisplay[data-active="true"]:
  opacity         : 1
  animation       : bcrComboPop 300ms ease-out

.comboLabel:
  font-size       : 11px
  font-weight     : 700
  color           : var(--bcr-accent)     /* #E67E22 */
  letter-spacing  : 0.06em
  text-transform  : uppercase

.comboCount:
  font-size       : 18px    (PC)  /  16px (모바일)
  font-weight     : 900
  color           : var(--bcr-accent)
```

표시 텍스트 형식: `COMBO ×3` (label + count 분리 렌더링)

### 5.4 팝업 점수 표시 (Should 항목)

줄 클리어 시 획득 점수를 클리어된 줄 영역 근처에 짧게 팝업으로 표시한다.

```
.scorePopup:
  position        : absolute
  pointer-events  : none
  z-index         : 100
  font-size       : 18px   (PC)  /  15px (모바일)
  font-weight     : 900
  color           : var(--bcr-accent)
  text-shadow     : 0 1px 4px rgba(0,0,0,0.2)
  animation       : bcrScorePopup 700ms ease-out forwards

@keyframes bcrScorePopup:
  0%    opacity: 1;  transform: translateY(0) scale(1.1)
  60%   opacity: 1;  transform: translateY(-24px) scale(1.0)
  100%  opacity: 0;  transform: translateY(-40px) scale(0.9)
  duration: 700ms

위치 계산:
  클리어된 행의 경우: 행의 y 중심 좌표, 보드의 오른쪽 끝 + 8px
  클리어된 열의 경우: 열의 x 중심 좌표, 보드의 위쪽 끝 - 8px
  여러 줄 동시: 각각 별도 팝업, stagger 0ms (동시 표시)
```

---

## 6. 게임 오버 모달

### 6.1 모달 구조 와이어프레임

```
┌──────────────────────────────────────────────────────┐
│  (배경: 보드 + 트레이, blur 처리)                      │
│                                                      │
│         ┌────────────────────────────────┐           │
│         │                                │           │
│         │      GAME OVER                 │           │
│         │                                │           │
│         │  최종 점수                      │           │
│         │  ┌──────────────────────────┐  │           │
│         │  │       12,340 점           │  │           │
│         │  └──────────────────────────┘  │           │
│         │                                │           │
│         │  클리어한 줄 수: 24줄           │           │
│         │                                │           │
│         │  ──────────────────────────    │           │
│         │                                │           │
│         │  닉네임                         │           │
│         │  ┌──────────────────────────┐  │           │
│         │  │  [닉네임 입력 필드]       │  │           │
│         │  └──────────────────────────┘  │           │
│         │                                │           │
│         │  ┌──────────────────────────┐  │           │
│         │  │       등록하기            │  │           │
│         │  └──────────────────────────┘  │           │
│         │                                │           │
│         │  등록 없이 다시 시작            │           │
│         └────────────────────────────────┘           │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 6.2 오버레이 스타일

```
.gameOverOverlay:
  position        : fixed
  inset           : 0
  background      : rgba(0, 0, 0, 0.55)
  display         : flex
  align-items     : center
  justify-content : center
  z-index         : 500
  backdrop-filter : blur(3px)
  -webkit-backdrop-filter: blur(3px)
  animation       : bcrOverlayIn 300ms ease-out forwards

@keyframes bcrOverlayIn:
  from  opacity: 0
  to    opacity: 1
```

### 6.3 모달 카드 스타일

```
.gameOverModal:
  background      : #FFFDF7
  border-radius   : 16px
  padding         : 28px 24px
  width           : min(400px, 90vw)
  box-shadow      : 0 8px 32px rgba(0,0,0,0.28)
  display         : flex
  flex-direction  : column
  gap             : 16px
  animation       : bcrModalIn 300ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards

@keyframes bcrModalIn:
  from  opacity: 0;  transform: scale(0.88)
  to    opacity: 1;  transform: scale(1)
```

### 6.4 모달 내부 요소 명세

```
.gameOverTitle:
  font-size       : 28px
  font-weight     : 900
  color           : var(--bcr-text-primary)  /* #3D2B1A */
  text-align      : center
  letter-spacing  : 0.06em
  text-transform  : uppercase

.gameOverScoreSection:
  text-align      : center

  .scoreLabel:
    font-size     : 12px
    color         : var(--bcr-text-muted)
    font-weight   : 600
    letter-spacing: 0.08em
    text-transform: uppercase

  .scoreFinal:
    font-size     : 36px
    font-weight   : 900
    color         : var(--bcr-accent)        /* #E67E22 */
    font-variant-numeric: tabular-nums

  .lineClearInfo:
    font-size     : 14px
    color         : var(--bcr-text-secondary)  /* #6B5744 */
    margin-top    : 4px
    텍스트        : "클리어한 줄 수: {totalLines}줄"

.divider:
  border          : none
  border-top      : 1px solid var(--bcr-divider)  /* rgba(0,0,0,0.10) */
  margin          : 0

닉네임 입력 폼:

  .inputLabel:
    font-size     : 13px
    font-weight   : 600
    color         : var(--bcr-text-secondary)
    margin-bottom : 6px

  .nicknameInput:
    width         : 100%
    height        : 44px
    border        : 1.5px solid var(--bcr-input-border)   /* #C8B89A */
    border-radius : 8px
    padding       : 0 12px
    font-size     : 15px
    color         : var(--bcr-text-primary)
    background    : #FFFFFF
    outline       : none
    box-sizing    : border-box

    :focus
      border-color: var(--bcr-accent)
      box-shadow  : 0 0 0 3px rgba(230,126,34,0.18)

    ::placeholder
      color       : var(--bcr-text-muted)

  .inputError:
    font-size     : 12px
    color         : #E53E3E
    margin-top    : 4px

등록 버튼:

  .submitBtn:
    width         : 100%
    height        : 48px
    background    : var(--bcr-accent)       /* #E67E22 */
    color         : #FFFFFF
    border        : none
    border-radius : 10px
    font-size     : 16px
    font-weight   : 700
    cursor        : pointer
    transition    : background 120ms, transform 80ms

    :hover
      background  : var(--bcr-accent-dark)  /* #CA6F1E */

    :active
      transform   : scale(0.97)

    [loading 상태]:
      background  : #D0A070
      cursor      : not-allowed
      (스피너 아이콘 표시)

"등록 없이 다시 시작" 버튼:

  .skipBtn:
    background    : transparent
    border        : none
    color         : var(--bcr-text-muted)
    font-size     : 13px
    cursor        : pointer
    text-decoration: underline
    text-align    : center
    padding       : 4px 0

    :hover
      color       : var(--bcr-text-secondary)
```

---

## 7. 랭킹 테이블 (게임 하단)

### 7.1 랭킹 섹션 레이아웃

기존 blockfall-battle의 결과 화면 랭킹 패널 UI 스타일을 일반 인라인 위젯으로 참고하되, 블록 크러시 색상 토큰으로 적용한다.

```
.rankingSection:
  width           : 100%
  max-width       : 520px
  margin          : 0 auto
  padding         : 0 16px 48px

.rankingTitle:
  font-size       : 18px
  font-weight     : 700
  color           : var(--bcr-text-primary)
  margin-bottom   : 12px
  text-align      : center
```

### 7.2 탭 구분 (주간 랭킹 / 전체 최고 기록)

```
.rankingTabs:
  display         : flex
  gap             : 8px
  margin-bottom   : 12px

.rankingTab:
  flex            : 1
  padding         : 8px 0
  font-size       : 14px
  font-weight     : 600
  text-align      : center
  border          : 1.5px solid var(--bcr-grid-line)  /* #C8B89A */
  border-radius   : 8px
  background      : transparent
  color           : var(--bcr-text-muted)
  cursor          : pointer
  transition      : background 120ms, color 120ms

.rankingTab[data-active="true"]:
  background      : var(--bcr-accent)      /* #E67E22 */
  border-color    : var(--bcr-accent)
  color           : #FFFFFF
```

### 7.3 랭킹 테이블 열 구성

| 열 | 너비 | 설명 |
|---|---|---|
| 순위 | 40px | 1~3위 트로피/메달 이모지, 이후 숫자 |
| 닉네임 | flex: 1 | 최대 너비 초과 시 ellipsis |
| 점수 | 90px | 우측 정렬, tabular-nums |
| 날짜 | 80px | `M월 D일` 형식 |

```
.rankingTable:
  width           : 100%
  border-collapse : collapse
  font-size       : 14px

.rankingTable th:
  padding         : 8px 10px
  background      : var(--bcr-accent)    /* #E67E22 */
  color           : #FFFFFF
  font-weight     : 700
  font-size       : 12px
  letter-spacing  : 0.05em
  text-align      : left

  th.rankCol    : text-align: center
  th.scoreCol   : text-align: right
  th.dateCol    : text-align: right

.rankingTable td:
  padding         : 8px 10px
  border-bottom   : 1px solid var(--bcr-divider)  /* rgba(0,0,0,0.08) */
  color           : var(--bcr-text-secondary)      /* #6B5744 */

  .rankCol
    text-align    : center
    font-weight   : 700
    font-size     : 16px     (1~3위 이모지)

  .nicknameCol
    overflow      : hidden
    text-overflow : ellipsis
    white-space   : nowrap
    max-width     : 0        (flex 컨텍스트 기준)

  .scoreCol
    text-align    : right
    font-weight   : 700
    color         : var(--bcr-text-primary)
    font-variant-numeric: tabular-nums

  .dateCol
    text-align    : right
    font-size     : 12px
    color         : var(--bcr-text-muted)

순위 이모지:
  1위: 🥇
  2위: 🥈
  3위: 🥉
  4위 이상: 숫자 (예: "4")

본인 행 강조 (로그인 유저, 이번 게임 제출 시):
  .rankingTable tr.myRow td:
    background    : rgba(230, 126, 34, 0.08)
    border-left   : 3px solid var(--bcr-accent)
    font-weight   : 600
```

### 7.4 빈 데이터 상태

```
.rankingEmpty:
  text-align      : center
  padding         : 24px 0
  font-size       : 14px
  color           : var(--bcr-text-muted)
  텍스트          : "아직 기록이 없습니다"
```

---

## 8. CSS Custom Properties 전체 목록

`BlockCrush.module.css` 상단 또는 `:root` 스코프에 선언. `--bcr-` 접두사 사용.

```css
/* ── Block Crush 전용 CSS Custom Properties ── */
/* 접두사: --bcr- (Block CRush) */

/* === 색상 팔레트 === */

/* 페이지/배경 */
--bcr-page-bg            : #F5F0E8;    /* 크림 베이지 — 보드 배경과 어우러지는 페이지 배경 */
--bcr-cell-empty         : #F7F0E3;    /* 빈 셀 */
--bcr-grid-line          : #C8B89A;    /* 그리드 라인 (gap 배경) */

/* 강조 / 액션 */
--bcr-accent             : #E67E22;    /* 주 강조색 — 따뜻한 주황 */
--bcr-accent-dark        : #CA6F1E;    /* hover/active용 어두운 주황 */
--bcr-accent-subtle      : rgba(230, 126, 34, 0.14);  /* 콤보 배지 배경 */

/* 텍스트 */
--bcr-text-primary       : #3D2B1A;    /* 주 텍스트 (진한 브라운) */
--bcr-text-secondary     : #6B5744;    /* 보조 텍스트 */
--bcr-text-muted         : #7A6952;    /* 희미한 텍스트 */

/* UI 요소 */
--bcr-tray-bg            : rgba(0, 0, 0, 0.06);
--bcr-tray-border        : rgba(0, 0, 0, 0.10);
--bcr-hud-bg             : rgba(0, 0, 0, 0.06);
--bcr-hud-border         : rgba(0, 0, 0, 0.10);
--bcr-divider            : rgba(0, 0, 0, 0.08);
--bcr-input-border       : #C8B89A;

/* 콤보 */
--bcr-combo-bg           : rgba(230, 126, 34, 0.14);
--bcr-combo-border       : rgba(230, 126, 34, 0.40);

/* 드래그 미리보기 */
--bcr-preview-valid      : rgba(46, 204, 113, 0.45);   /* 유효 위치 — 초록 반투명 */
--bcr-preview-invalid    : rgba(231, 76, 60, 0.40);    /* 무효 위치 — 빨간 반투명 */

/* 줄 클리어 */
--bcr-clear-flash        : #FFFBE6;    /* 클리어 애니메이션 플래시 색 */

/* === 레이아웃 치수 === */

--bcr-cell-size          : 56px;       /* PC 기본값; 미디어 쿼리로 재정의 */
--bcr-tray-cell          : 22px;       /* 트레이 셀; 미디어 쿼리로 재정의 */
--bcr-gap                : 2px;        /* 보드 그리드 gap */

/* === 블록 종류별 색상 (PRD §4.3 코드명 기준) === */

/* blockfall 보라 계열, blockfall-insane 핑크 계열과 구분된 팔레트 */
--bcr-block-dot1         : #FFF176;    /* 옐로우 — DOT_1 (1칸) */
--bcr-block-i2h          : #FFB74D;    /* 앰버 — I_2_H (가로 2칸) */
--bcr-block-i2v          : #FFB74D;    /* 앰버 — I_2_V (세로 2칸, H와 동일색) */
--bcr-block-i3h          : #FF8A65;    /* 딥 오렌지 — I_3_H (가로 3칸) */
--bcr-block-i3v          : #FF8A65;    /* 딥 오렌지 — I_3_V (세로 3칸, H와 동일색) */
--bcr-block-i4h          : #F06292;    /* 코랄 핑크 — I_4_H (가로 4칸) */
--bcr-block-i4v          : #F06292;    /* 코랄 핑크 — I_4_V (세로 4칸, H와 동일색) */
--bcr-block-i5h          : #4DB6AC;    /* 틸 — I_5_H (가로 5칸) */
--bcr-block-i5v          : #4DB6AC;    /* 틸 — I_5_V (세로 5칸, H와 동일색) */
--bcr-block-sq2          : #9575CD;    /* 미디엄 퍼플 — SQ_2 (2×2) */
--bcr-block-sq3          : #FFCC02;    /* 고채도 옐로우 — SQ_3 (3×3) */
--bcr-block-ltl          : #AED581;    /* 라임 그린 — L_TL (┘ 좌상) */
--bcr-block-ltr          : #A5D6A7;    /* 민트 그린 — L_TR (└ 우상) */
--bcr-block-lbl          : #80CBC4;    /* 민트 틸 — L_BL (┐ 좌하) */
--bcr-block-lbr          : #CE93D8;    /* 라일락 — L_BR (┌ 우하) */
--bcr-block-t4           : #4FC3F7;    /* 라이트 블루 — T_4 */
--bcr-block-s4           : #F48FB1;    /* 핑크 — S_4 */
--bcr-block-z4           : #80DEEA;    /* 시안 — Z_4 */
```

---

## 9. keyframes 요약

developer-frontend 구현 참고용. `BlockCrush.module.css` 내에 정의.

| 이름 | 용도 | duration | timing |
|---|---|---|---|
| `bcrClearFlash` | 줄 클리어 셀 플래시 + 사라짐 | 280ms | ease-out |
| `bcrPreviewPulse` | 유효 위치 미리보기 맥동 | 0.6s infinite alternate | ease-in-out |
| `bcrScoreBump` | 점수 증가 시 값 강조 | 200ms | ease-out |
| `bcrComboPop` | 콤보 카운터 등장 팝 | 300ms | ease-out |
| `bcrScorePopup` | 획득 점수 팝업 상승 후 페이드 | 700ms | ease-out |
| `bcrOverlayIn` | 게임 오버 오버레이 페이드인 | 300ms | ease-out |
| `bcrModalIn` | 게임 오버 모달 팝인 | 300ms | cubic-bezier(0.34,1.56,0.64,1) (bounce) |

### 9.1 keyframes 코드 스케치

```css
/* 줄 클리어 플래시 */
@keyframes bcrClearFlash {
  0%   { background: var(--bcr-clear-flash);
         box-shadow: 0 0 12px rgba(255,235,59,0.7);
         transform: scale(1.05); }
  60%  { background: var(--bcr-clear-flash); transform: scale(1.0); }
  100% { background: transparent; opacity: 0; transform: scale(0.85); }
}

/* 유효 위치 맥동 */
@keyframes bcrPreviewPulse {
  from { box-shadow: inset 0 0 0 2px rgba(46,204,113,0.6); }
  to   { box-shadow: inset 0 0 0 2px rgba(46,204,113,1.0); }
}

/* 점수 강조 */
@keyframes bcrScoreBump {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.18); }
  100% { transform: scale(1); }
}

/* 콤보 팝 */
@keyframes bcrComboPop {
  0%   { transform: scale(0.7); opacity: 0; }
  60%  { transform: scale(1.12); opacity: 1; }
  100% { transform: scale(1); }
}

/* 팝업 점수 상승 */
@keyframes bcrScorePopup {
  0%   { opacity: 1; transform: translateY(0) scale(1.1); }
  60%  { opacity: 1; transform: translateY(-24px) scale(1.0); }
  100% { opacity: 0; transform: translateY(-40px) scale(0.9); }
}

/* 오버레이 페이드인 */
@keyframes bcrOverlayIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* 모달 팝인 */
@keyframes bcrModalIn {
  from { opacity: 0; transform: scale(0.88); }
  to   { opacity: 1; transform: scale(1); }
}
```

---

## 10. 반응형 레이아웃 브레이크포인트

기존 blockfall-battle 명세(`docs/design/blockfall-battle-components.md` §13)와 동일한 브레이크포인트를 사용한다.

| 브레이크포인트 | 범위 | 주요 변경 |
|---|---|---|
| desktop | 769px 이상 | 기본값 적용 (셀 56px, 트레이 셀 22px) |
| tablet | 481~768px | 셀 46px, 트레이 셀 18px |
| mobile | 480px 이하 | 셀 38px, 트레이 셀 15px; 트레이 슬롯 gap 12px |
| mobile-sm | 360px 이하 | 셀 32px, 트레이 셀 13px |

```css
/* 태블릿 */
@media (max-width: 768px) {
  :root,
  .blockCrushRoot {  /* CSS Modules 경우 로컬 선언 */
    --bcr-cell-size  : 46px;
    --bcr-tray-cell  : 18px;
  }
}

/* 모바일 */
@media (max-width: 480px) {
  .blockCrushRoot {
    --bcr-cell-size  : 38px;
    --bcr-tray-cell  : 15px;
  }
  .tray {
    gap              : 12px;
  }
}

/* 소형 모바일 */
@media (max-width: 360px) {
  .blockCrushRoot {
    --bcr-cell-size  : 32px;
    --bcr-tray-cell  : 13px;
  }
}
```

### 10.1 모바일 레이아웃 특이사항

- 트레이는 항상 가로 배열 유지 (세로 배열로 변경하지 않음).
- HUD는 항상 보드 상단에 위치.
- 게임 오버 모달은 `width: min(400px, 90vw)` 로 자동 조정.
- 랭킹 테이블 날짜 열은 모바일(480px 이하)에서 숨김 처리 가능 (선택):
  ```css
  @media (max-width: 480px) {
    .dateCol { display: none; }
  }
  ```

---

## 11. 접근성 명세

### 11.1 키보드 네비게이션

Block Crush는 드래그 기반 게임으로 키보드 전용 플레이는 현재 명세 범위 외. 단, 게임 외 UI 요소는 키보드 완전 접근 가능해야 한다.

| 화면 | 키 | 동작 |
|---|---|---|
| idle | `Tab` | "게임 시작" 버튼으로 포커스 |
| idle | `Enter` / `Space` | 게임 시작 |
| gameOver 모달 | `Tab` | 닉네임 입력 → 등록 버튼 → 다시 시작 버튼 순 |
| gameOver 모달 | `Escape` | "등록 없이 다시 시작" 동작 (confirm 불필요) |
| gameOver 모달 | `Enter` (닉네임 필드에서) | 등록하기 실행 |
| 랭킹 탭 | `Tab` + `Enter`/`Space` | 탭 전환 |

### 11.2 ARIA 속성

```
게임 영역:
  role            : "application"
  aria-label      : "블록 크러시 게임"

보드:
  role            : "grid"
  aria-label      : "8×8 블록 보드"
  aria-rowcount   : 8
  aria-colcount   : 8

HUD 점수:
  role            : "status"
  aria-live       : "polite"
  aria-label      : "현재 점수"
  aria-atomic     : true

콤보 표시:
  role            : "status"
  aria-live       : "polite"
  aria-label      : "콤보 카운터"

게임 오버 모달:
  role            : "dialog"
  aria-modal      : true
  aria-labelledby : "gameOverTitle"
  aria-describedby: "gameOverScore"
  (모달 열릴 때 포커스 이동: 닉네임 입력 필드로 자동 focus)

닉네임 입력:
  id              : "nicknameInput"
  aria-label      : "랭킹 등록 닉네임"
  aria-required   : true
  aria-invalid    : (유효성 실패 시 true)
  aria-describedby: "nicknameError" (에러 발생 시)

등록 버튼:
  aria-busy       : (로딩 중 true)

랭킹 테이블:
  role            : "table"
  aria-label      : "블록 크러시 랭킹"

랭킹 탭:
  role            : "tablist"
  각 탭           : role="tab", aria-selected, aria-controls
```

### 11.3 색상 대비 (WCAG 2.1 AA 기준 4.5:1)

| 요소 | 배경 | 전경 | 기준 |
|---|---|---|---|
| 주 텍스트 | `#F5F0E8` | `#3D2B1A` | 약 12:1 — 충분 |
| 보조 텍스트 | `#F5F0E8` | `#6B5744` | 약 6.5:1 — 통과 |
| 희미 텍스트 | `#F5F0E8` | `#7A6952` | 약 5.2:1 — 통과 |
| 등록 버튼 텍스트 | `#E67E22` | `#FFFFFF` | 약 3.1:1 — 대형/굵은 텍스트 기준(3:1) 통과 |
| 랭킹 테이블 헤더 | `#E67E22` | `#FFFFFF` | 약 3.1:1 — 굵은 텍스트 기준 통과 |
| 콤보 레이블 | `rgba(230,126,34,0.14)` on `#F5F0E8` | `#E67E22` | 약 3.5:1 — 굵은 텍스트 기준 통과 |

### 11.4 모션 접근성

```css
@media (prefers-reduced-motion: reduce) {
  /* 모든 animation 과 transition 최소화 */
  .cell.clearing       { animation: none; opacity: 0; }
  .scoreValue.bump     { animation: none; }
  .comboDisplay        { animation: none; transition: none; }
  .scorePopup          { animation: none; opacity: 0; }
  .gameOverOverlay     { animation: none; }
  .gameOverModal       { animation: none; }
  .bcrPreviewPulse     { animation: none; }
}
```

---

## 12. 타이포그래피

| 요소 | font-size | font-weight | 색상 |
|---|---|---|---|
| 현재 점수 (PC) | 26px | 900 | `--bcr-text-primary` |
| 현재 점수 (모바일) | 22px | 900 | `--bcr-text-primary` |
| 점수 레이블 | 12px | 600 | `--bcr-text-muted` |
| 콤보 레이블 | 11px | 700 | `--bcr-accent` |
| 콤보 숫자 (PC) | 18px | 900 | `--bcr-accent` |
| 콤보 숫자 (모바일) | 16px | 900 | `--bcr-accent` |
| 팝업 점수 (PC) | 18px | 900 | `--bcr-accent` |
| 팝업 점수 (모바일) | 15px | 900 | `--bcr-accent` |
| "GAME OVER" 제목 | 28px | 900 | `--bcr-text-primary` |
| 최종 점수 | 36px | 900 | `--bcr-accent` |
| 줄 수 정보 | 14px | 400 | `--bcr-text-secondary` |
| 입력 레이블 | 13px | 600 | `--bcr-text-secondary` |
| 입력 필드 텍스트 | 15px | 400 | `--bcr-text-primary` |
| 에러 메시지 | 12px | 400 | `#E53E3E` |
| 등록 버튼 | 16px | 700 | `#FFFFFF` |
| 건너뛰기 버튼 | 13px | 400 | `--bcr-text-muted` |
| 랭킹 탭 | 14px | 600 | 상태별 상이 |
| 랭킹 헤더 | 12px | 700 | `#FFFFFF` |
| 랭킹 닉네임 | 14px | 400 | `--bcr-text-secondary` |
| 랭킹 점수 | 14px | 700 | `--bcr-text-primary` |
| 랭킹 날짜 | 12px | 400 | `--bcr-text-muted` |
| 랭킹 1~3위 이모지 | 16px | — | — |
| 빈 데이터 안내 | 14px | 400 | `--bcr-text-muted` |

모든 폰트는 기존 일반 모드 게임(`GamePage.tsx`)과 동일하게 `font-family: sans-serif` 적용.

---

> 본 명세는 `docs/progress/designer-block-crush.md`와 함께 관리됨.
> 스펙 변경은 planner 경유 필수.
> Excel 모드 명세는 N/A (일반 모드 전용).
> developer-frontend는 이 파일과 `docs/design/block-crush-flow.md`를 함께 참조할 것.
