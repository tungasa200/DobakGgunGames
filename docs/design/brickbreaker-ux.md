# Brick Breaker — UX 디자인 명세

> 작성자: designer
> 기준 PRD: docs/specs/brickbreaker.md
> 최종 수정: 2026-05-06
> 모드 적용 범위: 일반(다크 게임 테마) 단독 — Excel 모드 미적용

---

## 1. 색상 팔레트

### 1-1. 배경 / 구조 색상

| 역할 | 토큰명 | 값 | 참조 |
|---|---|---|---|
| 페이지 배경 | `--bb-page-bg` | `#0d1117` | Blockfall Battle 동일 |
| HUD 패널 배경 | `--bb-hud-bg` | `#1c2128` | Blockfall Battle 동일 |
| HUD 테두리 | `--bb-hud-border` | `#30363d` | Blockfall Battle 동일 |
| 캔버스 배경 | `--bb-canvas-bg` | `#07080d` | Battle canvas-wrap 동일 |
| 캔버스 테두리 | `--bb-canvas-border` | `rgba(99,102,241,0.35)` | 인디고 네온 |

### 1-2. 게임 오브젝트 색상

| 오브젝트 | 색상 | 비고 |
|---|---|---|
| 공 (기본) | `#22D3EE` | 네온 시안 — Tailwind cyan-400 |
| 공 잔상 (trail) | `rgba(34,211,238,0.18)` → `0.0` | 5단계 페이드 |
| 패들 | `linear-gradient(180deg, #A78BFA, #7C3AED)` | 네온 퍼플 그라디언트 |
| 패들 테두리 글로우 | `box-shadow: 0 0 12px rgba(167,139,250,0.65)` | 퍼플 네온 |
| 벽 (좌/우/상단) | `#21262d` (배경) + `rgba(99,102,241,0.25)` 테두리 | |

### 1-3. 벽돌 색상 체계

#### 내구도별 기본 색상

| 타입 | 내구도 | 배경색 | 테두리 | 텍스트 |
|---|---|---|---|---|
| D1 | 1회 | `#1E3A5F` | `#3B82F6` (blue-500) | 없음 |
| D2 | 2회 | `#3D1E5F` | `#A855F7` (purple-500) | `2` (반투명 흰색) |
| D3 | 3회 | `#5F1E1E` | `#EF4444` (red-500) | `3` (반투명 흰색) |
| ITEM | 1회 | `#1E4D2B` | `#22C55E` (green-500) | 아이템 기호 |

#### 내구도 손상 상태 — 밝기 변화 규칙

타격 시 벽돌 배경색을 `filter: brightness()` 로 조정한다.
CSS Canvas 2D에서는 fillStyle 직접 계산으로 구현.

| 상태 | 계산식 | 시각 결과 |
|---|---|---|
| D2 풀체력 | 기본색 100% | `#3D1E5F` |
| D2 1타 맞음 (잔여 1회) | brightness 65% — 어둡고 금 균열 오버레이 | `#271340` 계열 |
| D3 풀체력 | 기본색 100% | `#5F1E1E` |
| D3 1타 맞음 (잔여 2회) | brightness 75% | `#471616` 계열 |
| D3 2타 맞음 (잔여 1회) | brightness 50% + 균열 오버레이 강도 MAX | `#2F0E0E` 계열 |

**균열 오버레이 표현**: Canvas의 `strokeStyle = rgba(255,255,255,0.15~0.40)` 대각선 2~3줄. 잔여 내구도가 낮을수록 선 수 증가 및 opacity 증가.

#### 아이템 벽돌 구분 방식
- 배경색이 녹색 계열(`#1E4D2B`)로 D1~D3와 완전히 다른 색조
- 테두리에 `#22C55E` 네온 글로우: `box-shadow: 0 0 6px rgba(34,197,94,0.55)` (Canvas: shadowBlur+shadowColor)
- 벽돌 중앙에 해당 아이템 문자 (`M` / `W` / `P` / `S`) 를 `rgba(255,255,255,0.7)` Bold 12px로 렌더

### 1-4. 아이템 4종 색상

| 기호 | 아이템명 | 캡슐 배경색 | HUD 칩 배경색 |
|---|---|---|---|
| `M` | 멀티볼 | `#FF6B6B` | `#FF6B6B` |
| `W` | 패들확장 | `#4ECDC4` | `#4ECDC4` |
| `P` | 관통볼 | `#FFD93D` | `#FFD93D` |
| `S` | 공슬로우 | `#6C5CE7` | `#6C5CE7` |

### 1-5. 아케이드 네온 강조색 팔레트

| 용도 | 색상 |
|---|---|
| 주 강조 (인디고) | `#6366F1` |
| 시안 글로우 | `#22D3EE` |
| 퍼플 글로우 | `#A78BFA` |
| 그린 (아이템) | `#22C55E` |
| 옐로 (경고/카운트) | `#F59E0B` |
| 레드 (위험/게임오버) | `#EF4444` |
| 화이트 하이라이트 | `rgba(255,255,255,0.9)` |

---

## 2. HUD 상세 명세

### 2-1. 레이아웃 구조

```
┌──────────────────────────────────────────────────────────┐  ← hudTop (48px)
│  [ 스테이지 3/10 ]   [ 점수 12,345 ]   [ ♥♥♥ ]   [M][W]  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│                   Canvas 720×480px                       │
│                                                          │
├──────────────────────────────────────────────────────────┤
│       [ 일시정지 ]      [ 그만두기 ]      [ 도움말 ]        │  ← hudBottom (44px)
└──────────────────────────────────────────────────────────┘
```

### 2-2. 상단 HUD 바 (hudTop)

| 속성 | 값 |
|---|---|
| 높이 | 48px |
| 배경 | `#1c2128` |
| 하단 테두리 | `1px solid #30363d` |
| 패딩 | `0 16px` |
| 레이아웃 | `display: flex; align-items: center; gap: 16px` |

#### 항목별 명세

**스테이지 정보 (stageInfo)**
- 레이블: `STAGE` — font-size `0.65rem`, color `#8b949e`, uppercase, letter-spacing 0.10em
- 값: `3 / 10` — font-size `1.1rem`, font-weight 700, color `#f0f6fc`
- 값 변경 시: 0.25s `bb-num-pop` 애니메이션 (scale 1.3 → 1.0)

**점수 (scoreInfo)**
- 레이블: `SCORE` — 위와 동일 스타일
- 값: `12,345` — font-size `1.3rem`, font-weight 800, color `#22D3EE` (시안 네온)
- 점수 오를 때: 0.2s pop 애니메이션, `text-shadow: 0 0 8px rgba(34,211,238,0.65)`
- font-variant-numeric: tabular-nums

**생명 표시 (livesInfo)**
- 방식: 하트 기호 `♥` x 3개 (최대치 기준)
- 색상: 활성 `#EF4444` (네온 레드), 소진 `#30363d`
- font-size: `1.2rem`, letter-spacing: `4px`
- 생명 감소 시: 0.4s 쉐이크 애니메이션 (`translateX` ±4px 4회 반복)

**활성 아이템 칩 (itemChip 영역)**
- 위치: HUD 우측, flex-start 정렬
- 칩 크기: 28×28px, border-radius 6px
- 배경: 아이템별 색상 (2-5 참조)
- 기호: 흰색 Bold 14px, 중앙 정렬
- 배치: 가로 행, gap 6px
- 최대 동시 표시: 4개 (모든 아이템 동시 활성 기준)

**아이템 칩 타이머 표시**
- 칩 하단에 1px 높이 progress bar (칩 너비 100%)
- 바 색상: 아이템 색상 대비 밝기 +40% (흰색 방향)
- 잔여 시간 0~3초: `bb-chip-blink` 애니메이션 실행
  - 주기: 0.5s (1초에 2회 점멸)
  - opacity: 1.0 → 0.45 → 1.0
- 칩 만료 시: `opacity: 0` transition 0.3s 후 DOM에서 제거

```
┌──────┐
│  M   │  ← 아이템 기호 (Bold 14px 흰색)
│______│  ← 타이머 바 (밑 1px 채움)
└──────┘
  28px
```

### 2-3. 하단 HUD 바 (hudBottom)

| 속성 | 값 |
|---|---|
| 높이 | 44px |
| 배경 | `#1c2128` |
| 상단 테두리 | `1px solid #30363d` |
| 패딩 | `0 16px` |
| 레이아웃 | `display: flex; align-items: center; justify-content: center; gap: 12px` |

**버튼 공통 스타일**
- 높이: 30px, padding: `0 16px`
- border-radius: 6px
- font-size: 0.85rem, font-weight 600
- cursor: pointer
- transition: background 0.12s

**일시정지 버튼**
- 배경: `transparent`, 테두리: `1.5px solid #6366F1`, 글자: `#6366F1`
- hover: `background: rgba(99,102,241,0.12)`
- 재개 상태에서는 "재개" 텍스트로 전환

**그만두기 버튼**
- 배경: `transparent`, 테두리: `1.5px solid #30363d`, 글자: `#8b949e`
- hover: `background: #21262d`, 글자: `#e6edf3`

**도움말 버튼**
- 배경: `transparent`, 테두리: `1.5px solid #30363d`, 글자: `#8b949e`
- hover: 그만두기와 동일
- 클릭 시: 키 안내 오버레이 토글

---

## 3. 캔버스 내 렌더링 상세

### 3-1. 공 렌더링

**기본 형태**
- 반지름: 8px
- 색상: `#22D3EE`
- Canvas 2D 설정:
  ```
  ctx.shadowColor = '#22D3EE'
  ctx.shadowBlur = 10
  fillStyle = '#22D3EE'
  ```

**잔상 효과 (globalAlpha trail)**
- 잔상 구현: 공의 이전 위치를 최대 6개 저장하는 배열 유지
- 각 잔상 원의 반지름: `r * (0.9 - i * 0.12)` (i = 0~5)
- 각 잔상 원의 alpha: `0.25 - i * 0.04`
- 잔상 색상: `#22D3EE`
- Canvas 렌더 순서: 잔상(뒤) → 현재 공(앞)

**다중 공 (멀티볼 아이템 활성 시)**
- 추가 공은 동일한 렌더링 규칙 적용
- 각 공에 독립적인 trail 배열 유지

### 3-2. 패들 렌더링

**기본 형태**
- 크기: `너비 100px × 높이 14px` (기본값, W 아이템 시 150px)
- border-radius: 7px (양 끝 둥근 pill 형태 — Canvas에서 arc로 구현)
- 색상: `linear-gradient` 방향 상→하, 상단 `#A78BFA`, 하단 `#7C3AED`
- Canvas 2D 구현:
  ```
  grd = ctx.createLinearGradient(x, y, x, y + paddleH)
  grd.addColorStop(0, '#A78BFA')
  grd.addColorStop(1, '#7C3AED')
  ctx.shadowColor = '#A78BFA'
  ctx.shadowBlur = 14
  ```

**패들 확장(W 아이템) 애니메이션**
- 확장/축소 시 100ms에 걸쳐 너비 선형 보간 (lerp)
- 시각적으로 늘어나는 느낌 구현

### 3-3. 벽돌 렌더링

**크기 기준** (캔버스 720×480, 상단 여백 50px 기준)
- 열 수: 10개, 행 수: 최대 8행
- 벽돌 너비: `(720 - 20px 좌우여백 - 9px 간격합) / 10 = 69px`
- 벽돌 높이: 22px
- 간격: 가로 1px, 세로 1px

**내구도별 렌더링**
- 배경색: 1-3절 색상 체계 적용
- 테두리: 1px solid, 색상은 테두리 색상 열 참조
- border-radius: 3px (Canvas에서 roundRect 또는 arc 구현)

**피격 시 플래시 이펙트**
- 피격된 벽돌: 0.1초간 `fillStyle = 'rgba(255,255,255,0.55)'` 덮어그리기
- 내구도 감소 후: brightness 변화 즉시 반영

**파괴 시 파티클 이펙트**
- 파티클 수: 6~8개
- 파티클 크기: 3×3px 정사각형 (또는 반지름 2px 원)
- 초기 속도: 벽돌 중심에서 랜덤 방향, 속력 `1.5~3.5px/frame`
- 중력: `vy += 0.15` (매 프레임)
- 수명: 25~35 프레임
- 색상: 파괴된 벽돌의 테두리 색상 계열
- opacity 감소: 수명에 비례해 선형 감소 (1.0 → 0.0)
- 파티클은 Canvas 별도 파티클 배열로 관리, 수명 만료 시 제거

**ITEM 벽돌 특수 렌더링**
- 파괴 시 아이템 캡슐이 하강 시작
- 파티클은 녹색 계열 (`#22C55E`)

### 3-4. 아이템 캡슐 낙하 렌더링

**형태**
- 크기: 28px 너비 × 16px 높이
- border-radius: 8px (pill 형태)
- Canvas 2D: roundRect 사용 또는 arc+lineTo 조합

**색상**: 아이템별 배경색 (1-4절 참조)

**중앙 기호**
- 흰색 Bold 14px
- textAlign: center, textBaseline: middle

**낙하 속도**
- 초기: `vy = 2.0px/frame`
- 중력 없음 — 등속 낙하
- 캔버스 하단 이탈 시 제거

**패들 충돌 시**
- 캡슐 즉시 제거 + 아이템 발동 효과 (HUD 칩 추가)
- 충돌 판정: 캡슐 바운딩 박스 vs 패들 바운딩 박스 AABB

---

## 4. 게임 오버 / 클리어 / 스테이지 전환 오버레이 UX

### 4-1. 공통 오버레이 기반

```
position: absolute; inset: 0;
background: rgba(7, 8, 13, 0.82);
backdrop-filter: blur(4px);
display: flex; flex-direction: column;
align-items: center; justify-content: center;
gap: 20px;
z-index: 50;
animation: bb-overlay-in 300ms ease-out;
```

`bb-overlay-in` keyframe:
```
0%   { opacity: 0; transform: scale(0.95); }
60%  { opacity: 1; transform: scale(1.02); }
100% { opacity: 1; transform: scale(1); }
```

### 4-2. 스테이지 클리어 오버레이

**표시 순서 (타임라인)**

| T | 이벤트 |
|---|---|
| 0ms | 마지막 벽돌 파괴 → 슬로우모션 시작 (게임 루프 dt × 0.15) |
| 500ms | 슬로우모션 종료, 오버레이 페이드 인 |
| 500ms~600ms | `Stage N Clear!` 텍스트 출현 (scale 0.8 → 1.0) |
| 600ms~1600ms | 보너스 카운트업 숫자 0 → 최종값 애니메이션 |
| 1600ms~3100ms | `다음 스테이지 시작` 카운트다운 `3 → 2 → 1` (각 500ms) |
| 3100ms | 오버레이 사라짐, 스테이지 전환 |

**레이아웃 (스테이지 N = 1~9)**
```
┌─────────────────────────────────┐
│                                 │
│   Stage 3 Clear!                │  ← 32px Bold, color #22D3EE, neon glow
│                                 │
│   보너스 +1,500                  │  ← 20px, color #F59E0B
│                                 │
│   3                             │  ← 카운트다운 숫자 64px Bold, color #6366F1
│   다음 스테이지까지...              │  ← 14px, color #8b949e
│                                 │
└─────────────────────────────────┘
```

### 4-3. 스테이지 10 클리어 (게임 클리어) 오버레이

**표시 순서**

| T | 이벤트 |
|---|---|
| 0ms | 마지막 벽돌 파괴 → 슬로우모션 0.5초 |
| 500ms | Congratulations! 오버레이 |
| 500ms~1500ms | 최종 점수 카운트업 |
| 1500ms~ | 닉네임 입력 폼 표시 |

**레이아웃**
```
┌─────────────────────────────────┐
│                                 │
│   Congratulations!              │  ← 36px Bold, color #F59E0B, 금색 glow
│   All 10 Stages Cleared         │  ← 16px, color #8b949e
│                                 │
│   최종 점수                      │  ← 14px label
│   98,760                        │  ← 40px Bold, color #22D3EE
│                                 │
│   ┌──────────────────────────┐  │
│   │ 닉네임 입력               │  │  ← rankForm input
│   └──────────────────────────┘  │
│                                 │
│   [ 랭킹 등록 ]   [ 건너뛰기 ]    │  ← 버튼들
│                                 │
└─────────────────────────────────┘
```

### 4-4. 게임 오버 오버레이

**표시 순서**

| T | 이벤트 |
|---|---|
| 0ms | 마지막 생명 소진 → 슬로우모션 0.5초 |
| 300ms | 빨간 플래시: 캔버스 전체 `rgba(239,68,68,0.4)` 0.2초 |
| 500ms | GAME OVER 오버레이 페이드 인 |
| 500ms~900ms | 도달 스테이지 / 점수 카운트업 (400ms) |
| 900ms~ | 버튼 3개 표시 |

**레이아웃**
```
┌─────────────────────────────────┐
│                                 │
│   GAME OVER                     │  ← 40px Bold 900, color #EF4444
│                                 │  text-shadow: 0 0 20px rgba(239,68,68,0.8)
│   Stage 4 도달                  │  ← 18px, color #f0f6fc
│   12,345 점                     │  ← 24px Bold, color #22D3EE
│                                 │
│   [ 다시하기 ]                   │  ← Primary 버튼 (인디고)
│   [ 랭킹 등록 ]                  │  ← Secondary 버튼
│   [ 메인으로 ]                   │  ← Ghost 버튼
│                                 │
└─────────────────────────────────┘
```

### 4-5. 일시정지 오버레이

**레이아웃**
```
┌─────────────────────────────────┐
│                                 │
│   PAUSED                        │  ← 36px Bold, color #f0f6fc
│                                 │
│   [ 재개하기 ]                   │  ← Primary
│   [ 그만두기 ]                   │  ← Ghost
│                                 │
│   [키보드 단축키 안내 표]         │  ← 접힌 상태 기본, 펼칠 수 있음
│                                 │
└─────────────────────────────────┘
```

### 4-6. 닉네임 입력 폼 UX (rankForm)

- input 너비: 240px, 높이: 40px
- placeholder: `닉네임을 입력하세요 (최대 10자)`
- maxlength: 10
- border: `1.5px solid #30363d`
- focus border: `1.5px solid #6366F1` + `box-shadow: 0 0 0 3px rgba(99,102,241,0.2)`
- border-radius: 8px
- background: `#0d1117`, color: `#f0f6fc`
- font-size: 1rem

**유효성 검사 표시**
- 빈 값 제출 시: 테두리 `#EF4444`, 아래에 `12px color #EF4444` 경고 텍스트
- 제출 중(로딩): 버튼 `disabled` + 스피너 아이콘 표시

---

## 5. 랭킹 표시 포맷

### 5-1. 항목 형식

권장 형식: **`N스테이지 클리어 / 98,760점`** 또는 게임 오버 시 **`4스테이지 도달 / 12,345점`**

- 스테이지 10 전부 클리어한 경우: `ALL CLEAR / 105,200점` (특별 표기)

### 5-2. 랭킹 테이블 컬럼 구성

| 컬럼명 | 너비 비율 | 정렬 | 설명 |
|---|---|---|---|
| `#` | 40px 고정 | 중앙 | 순위 (1~10) |
| 닉네임 | flex 1 | 좌측 | 최대 10자, 말줄임 처리 |
| 결과 | 160px | 중앙 | `N스테이지 / N,NNN점` |
| 점수 | 100px | 우측 | 숫자만, tabular-nums Bold |
| 등록일 | 80px | 중앙 | `MM.DD` 형식 |

### 5-3. 순위별 시각 강조

| 순위 | 처리 |
|---|---|
| 1위 | `#F59E0B` (금), 행 배경 `rgba(245,158,11,0.08)` |
| 2위 | `#94A3B8` (은) |
| 3위 | `#CD7F32` (동) |
| 내 점수 행 | 배경 `rgba(99,102,241,0.12)`, 테두리 `rgba(99,102,241,0.35)` |
| ALL CLEAR 행 | 닉네임 옆 `⭐ ALL` 뱃지 (`#F59E0B` 배경, 흰색 텍스트) |

---

## 6. 애니메이션 / 이펙트 목록

| 이펙트명 | 트리거 | 구현 위치 | 구현 방법 |
|---|---|---|---|
| 공 잔상 (trail) | 항상 | Canvas | 이전 위치 배열 6개, 순차 globalAlpha 원 |
| 벽돌 피격 플래시 | 공-벽돌 충돌 | Canvas | 해당 셀에 흰색 반투명 rect 0.1초 덮기 |
| 벽돌 파괴 파티클 | 내구도 0 | Canvas | 파티클 배열, 중력+감쇠, 25~35프레임 |
| 패들 글로우 펄스 | 게임 중 | Canvas | shadowBlur 8→16→8 2.4s 사인파 |
| 아이템 캡슐 낙하 | 아이템 벽돌 파괴 | Canvas | 등속 낙하, 충돌 판정 |
| 아이템 획득 팝 | 패들-캡슐 충돌 | Canvas | 캡슐 위치에서 반지름 팽창 원+fade 0.3s |
| 슬로우모션 | 마지막 벽돌 파괴 / 생명 소진 | Game loop | dt 계수 0.15 적용 0.5s |
| 레드 플래시 | 생명 소진 | Canvas overlay | rgba(239,68,68,0.4) 전체 rect 0.2s |
| HUD 점수 팝 | 점수 증가 | CSS | `bb-num-pop` 키프레임 (scale 1.3 → 1) |
| HUD 생명 쉐이크 | 생명 감소 | CSS | `bb-life-shake` 키프레임 (translateX ±4px) |
| 칩 깜빡임 | 아이템 잔여 3초 이하 | CSS | `bb-chip-blink` 0.5s 무한 |
| 오버레이 진입 | 상태 전환 | CSS | `bb-overlay-in` scale+fade |
| 스테이지 클리어 텍스트 | Stage clear | CSS | `bb-clear-pop` scale 0.8 → 1.05 → 1 |
| 카운트다운 숫자 팝 | 카운트다운 각 숫자 | CSS | `bb-num-pop` 0.25s |
| 게임 오버 텍스트 쉐이크 | 게임 오버 | CSS | `bb-gameover-shake` 수평 진동 |

---

## 7. 반응형 레이아웃

### 7-1. 데스크톱 (>= 760px)

- 캔버스: 720×480px 고정
- HUD: 캔버스 동일 너비(720px), 상단 48px + 하단 44px
- 전체 gameWrapper: `max-width: 720px; margin: 0 auto`

### 7-2. 태블릿 (481px ~ 759px)

- 캔버스: `width: 100%; max-width: 520px` — 비율 유지 (3:2)
- `canvas { width: 100%; height: auto }` + `aspect-ratio: 720/480`
- HUD 폰트 사이즈: 0.85배 축소
- 아이템 칩: 24×24px로 축소

### 7-3. 모바일 (480px 이하)

- 캔버스: `width: 100vw; max-width: 480px`
- HUD hudTop 높이: 40px, hudBottom 높이: 40px
- 버튼 텍스트: 아이콘 only (일시정지 = ⏸, 그만두기 = ✕, 도움말 = ?)
- 생명 표시: `♥ 3` 형식으로 숫자 병기
- 아이템 칩: 22×22px

---

## 8. 접근성

### 8-1. 키보드 네비게이션

| 키 | 동작 |
|---|---|
| ← / → | 패들 이동 |
| Space | 공 발사 (게임 시작 전) / 일시정지 토글 |
| Esc | 일시정지 |
| Enter | 오버레이 기본 버튼 활성화 |
| Tab | 오버레이 내 버튼 간 이동 |

### 8-2. 색상 대비

- 모든 HUD 텍스트: 배경 대비 WCAG AA 기준 4.5:1 이상
- `#f0f6fc` on `#1c2128` 대비비: ~12:1 (AAA)
- `#22D3EE` on `#1c2128` 대비비: ~7.5:1 (AA 통과)
- `#EF4444` on `#1c2128` 대비비: ~4.6:1 (AA 통과)

### 8-3. 모션 감소 (prefers-reduced-motion)

- 공 잔상 비활성화: trail 배열 길이 0
- 파티클 이펙트 비활성화
- CSS 애니메이션: `animation-duration: 0.01ms` 전체 재정의
- 슬로우모션 연출 비활성화 (즉시 전환)

```css
@media (prefers-reduced-motion: reduce) {
  .gameWrapper * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```
