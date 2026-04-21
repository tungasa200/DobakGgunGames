# Blockfall Insane Overhaul — Visual Spec

작성일: 2026-04-22
작성자: designer

---

## 0. 리서치 요약

- 현재 구현 파일: `frontend/src/games/blockfall/BlockfallInsaneBoard.tsx` + `BlockfallInsaneBoard.module.css`
- 현재 이벤트 배너: `.eventBanner` — 단순 텍스트, `scale(1.04)` 0.5s pulse 애니메이션 1종
- 현재 파티클 알파: moving sand `0.6`, settled `0.85`, flying shatter `0.6 + energy*0.4`, 잔상 `0.25`
- 현재 화면 흔들림: 미구현 (shakeCanvas 관련 코드 없음)
- 현재 색 왜곡: 미구현 (CSS filter 미적용, canvas ctx globalCompositeOperation 미적용)
- 현재 경고 Flash: 미구현
- 모드 적용 범위: 일반 모드 전용 (Excel 모드 없음 — `excel={false}` 고정)

---

## 1. 샌드 이펙트 재설계

### 1-1. SandParticle 기대 비주얼

"가루가 터져 나와 흘러내리다 딱 멈추는" 느낌. 현재는 낙하 속도가 조용하고 밀도가 낮다.
이번 개편의 핵심 목표: 블록이 모래로 변환되는 순간 "폭발적 분산" 느낌을 주고,
흘러내리는 동안 "밀도 높은 가루 물리" 느낌을 준다.

#### 파티클 수 (블록당 생성 개수)

| 이벤트 | 현재 | 목표 | 비고 |
|--------|------|------|------|
| SAND_BURST (피스 1개 lock) | 피스 셀 수 x 1 (셀 1개=파티클 1개) | 동일 수량 유지, 초기 분산 반경 대폭 확대 | 수량보다 속도/분산 개선 |
| FULL_SAND (보드 전체) | solid 셀 수 x 1 | 동일 (전체 변환), 배치 크기 25→35개/틱 증가 | 처리속도 1.4배 |
| LIQUID_FLOOD (상단 유입) | 기존 미확인 | 보드 너비 x 4 개 (기본 11칸 기준 = 44개) | 수량 약 2.5배 |
| PIECE_SHATTER (피스 분해) | 피스 셀 수 x 1 | 동일 수량, 초기 vx 범위 확대 | 속도 2배 |

#### 파티클 개당 크기

- SandParticle: 셀 1칸 그대로 (1 x 1 셀 단위). 크기 변경 없음.
- `drawCell` 내부에서 solid 블록에 적용되는 내부 테두리 강조선(0.07셀 선)을 sand 상태에서는 제거하고 순수 색면만 그려 밀도감을 높인다.

#### 색상 (원본 색 + 밝기 오프셋)

moving 상태에서 원본 colorIndex 색상보다 밝기를 올려 "빛나는 가루" 느낌을 준다.

| 상태 | globalAlpha (현재) | globalAlpha (목표) | 색상 처리 |
|------|-------------------|-------------------|----------|
| moving | 0.6 | 0.75 | `brighten(COLORS[colorIndex], 0.3)` 헬퍼로 계산하거나, alpha 상향으로 대체 가능 |
| settled | 0.85 | 0.90 | 원본 색 유지, 미세 흰 테두리 0.04셀 추가로 solid와 시각 구분 |
| flying shatter | 0.6 + energy*0.4 | 0.7 + energy*0.3 (최대 1.0) | bounces 많을수록 밝음 유지 |

#### 초기 속도 분포 (SAND_BURST / PIECE_SHATTER 발동 시)

피스 lock 또는 피스 분해 시 파티클 생성 시점에 초기 vx, vy를 부여한다.
현재는 vx=0, vy=0으로 생성되어 폭발감이 없다.

| 파라미터 | 현재 | 목표 |
|---------|------|------|
| 초기 vx 범위 | 0 | `Math.random() * 3 - 1.5` (범위: -1.5 ~ +1.5) |
| 초기 vy 범위 | 0 | `Math.random() * -0.8` (범위: -0.8 ~ 0, 위쪽 또는 중립) |
| vx 감쇠 계수 | 0.7 | 0.80 (감쇠 완화 — 더 오래 퍼짐) |
| vy 최대 낙하속도 | 3 | 4 |

#### Sand 틱 간격 및 배치 크기

| 상수 | 현재 | 목표 |
|------|------|------|
| SAND_TICK_INTERVAL | 60ms | 45ms |
| SAND_BATCH_SIZE | 25 | 35 |

#### SandParticle 수명 (LIQUID_FLOOD 생성분 한정)

- 최대 수명: 15,000ms (15초). 이후 settled 아닌 상태면 파티클 배열에서 강제 제거.
- 소멸 방식: 수명 20% 이하(3,000ms)부터 alpha 선형 감소.
  `alpha = lifetimeRemaining / 3000 * 0.75` (settled 기준값 0.75 기준)
- 일반 SAND_BURST / PIECE_SHATTER / FULL_SAND 생성 파티클은 수명 없음 (라인클리어로만 제거).

#### 잔상 처리 (Motion Blur) — SandParticle

현재 SandParticle에 잔상 없음. 개편 후 조건부 적용:

- 조건: `|vx| + |vy| > 1.5` 일 때만 적용 (느린 파티클에는 잔상 없음)
- 잔상 위치: `(p.x - p.vx * 0.8, p.y - p.vy * 0.8)`
- 잔상 alpha: 0.20 (동일 색상)
- 구현: drawCell 호출 전 별도 `drawCell(ctx, p.x - p.vx*0.8, p.y - p.vy*0.8, p.colorIndex, 0.20)` 1회 호출

---

### 1-2. ShatterParticle 기대 비주얼 (FLOOR_DROP 전용)

"충격 후 파편이 사방으로 튀고 점차 에너지를 잃어 정착하는" 느낌.
현재는 초기 속도가 작아 파편이 멀리 날아가지 않고, 잔상도 짧아 임팩트가 약하다.

| 파라미터 | 현재 | 목표 |
|---------|------|------|
| 초기 vx 범위 | `(Math.random() - 0.5) * 2` = -1 ~ +1 | `Math.random() * 5 - 2.5` (범위: -2.5 ~ +2.5) |
| 초기 vy (반발, 바닥 충돌 시) | `-vy * SHATTER_DAMPING(0.50)` | `-vy * 0.65` (감쇠 완화, 더 높이 튐) |
| SHATTER_GRAVITY | 0.06 | 0.08 |
| SHATTER_DAMPING | 0.50 | 0.60 |
| SHATTER_MIN_SPEED | 0.04 | 0.03 |
| 잔상 거리 x | `p.x - p.vx * 1.5` | `p.x - p.vx * 2.5` |
| 잔상 거리 y | `p.y - p.vy * 1.5` | `p.y - p.vy * 2.5` |
| 잔상 alpha | 0.25 | 0.35 |
| 본체 alpha (flying) | `0.6 + energy * 0.4` | `0.7 + energy * 0.3` (bounces=3 시 최대 1.0) |

#### SandParticle vs ShatterParticle 비주얼 차이 요약

| 항목 | SandParticle | ShatterParticle |
|------|-------------|----------------|
| 움직임 | 흘러내리는 모래, 대각선 분산 | 폭발 후 포물선 궤도, 벽 튕김 |
| 밝기 | 중간 밝기, 원본 색 | 튕김 횟수 많을수록 밝음, 줄수록 어두움 |
| 잔상 | 속도 클 때만 단거리 잔상 | 항상 잔상, 장거리 |
| 수명 | 무제한 (라인클리어까지) | bounces 소진 후 settled 전환 |

---

## 2. 광기 연출 레이어 — 화면 흔들림

### 2-1. 구현 방식 결정

canvas `ctx.translate` 방식 권장 (CSS transform 대신).

근거:
- `ctx.save()` / `ctx.restore()` 루프 내에서 처리하므로 draw 함수 진입 시 적용, 종료 시 자동 복원.
- CSS transform 방식은 canvas 요소 외부(모바일 버튼, 이벤트 배너 등)까지 흔들리는 부작용 발생.
- ctx가 CELL=30 단위 좌표계로 동작하므로 translate 단위는 px → 셀 단위 변환 필요:
  `ctx.translate(shakeX / CELL, shakeY / CELL)`

### 2-2. 트리거 조건 및 진폭

| 트리거 이벤트 | 진폭 (px) | 지속 시간 (ms) | 특이사항 |
|-------------|----------|--------------|---------|
| EXPLODE 발동 | ±14 | 600 | 폭발 반경에 비례해 +0~4px 추가 가능 |
| FLOOR_DROP 충돌 순간 | ±18 | 800 | 충돌 프레임에 최대 진폭, 이후 감쇠 |
| FLOOR_DROP 바닥 확장 시작 | ±8 | 300 | 낮은 강도의 "땅 흔들림" |
| FULL_SAND 발동 | ±10 | 500 | 전체 변환 충격감 |
| RANDOM_LOCK 발동 | ±7 | 300 | 강제 고정 충격 |
| 4라인 클리어 (Tetris) | ±12 | 500 | 특별 보상 연출 |
| 2~3라인 클리어 | ±6 | 300 | |
| 1라인 클리어 | ±3 | 150 | |
| 이벤트 활성 중 라인클리어 (보너스) | 기본 진폭 x 1.5 | 기본 x 1.3 | 2배 보너스 강조 |

### 2-3. 흔들림 수치 상세

```
관리 ref: shakeRef = { amplitude: number, duration: number, total: number, elapsed: number }

진폭 계산 (매 프레임):
  currentAmp = shakeRef.amplitude * Math.pow(shakeRef.duration / shakeRef.total, 0.7)

오프셋 계산:
  offsetX = currentAmp * Math.sin(shakeRef.elapsed * 0.06)
  offsetY = currentAmp * 0.4 * Math.sin(shakeRef.elapsed * 0.09 + Math.PI / 4)

최대 진폭 캡: 20px
복수 트리거 겹침: 새 트리거 진폭 > 현재 진폭이면 교체, 작으면 무시
```

### 2-4. draw() 함수 내 적용 위치

```ts
ctx.save();

// [1] 흔들림 적용 (가장 먼저, 모든 렌더 레이어 이전)
if (shakeRef.current.duration > 0) {
  const amp = shakeRef.current.amplitude
    * Math.pow(shakeRef.current.duration / shakeRef.current.total, 0.7);
  const t = shakeRef.current.elapsed;
  ctx.translate(
    (amp * Math.sin(t * 0.06)) / CELL,
    (amp * 0.4 * Math.sin(t * 0.09 + Math.PI / 4)) / CELL
  );
  shakeRef.current.duration -= dtMs;
  shakeRef.current.elapsed  += dtMs;
}

// [2] 기존 시각 이벤트 반전 변환 (FLIP_H, FLIP_V) — 순서 유지
if (evFlipH.current) { ctx.translate(bw, 0); ctx.scale(-1, 1); }
if (evFlipV.current) { ctx.translate(0, bh); ctx.scale(1, -1); }

// ... 기존 렌더 레이어 1~8 ...

ctx.restore();
```

흔들림 트리거 함수 (신규):

```ts
function triggerShake(amplitudePx: number, durationMs: number) {
  if (amplitudePx <= shakeRef.current.amplitude) return; // 더 강한 것만 교체
  const capped = Math.min(amplitudePx, 20);
  shakeRef.current = { amplitude: capped, duration: durationMs, total: durationMs, elapsed: 0 };
}
```

---

## 3. 광기 연출 — 색 왜곡

### 3-1. 구현 방식 결정

canvas 요소에 인라인 `style.filter` 직접 적용 (ctx globalCompositeOperation 방식 아님).

근거:
- ctx.globalCompositeOperation 방식은 전체 canvas를 재렌더해야 하므로 복잡도 높음.
- canvas 요소의 `style.filter` 를 ref로 관리하면 렌더 루프 밖에서 1회 적용.
- FLIP_H/FLIP_V는 이미 ctx.transform으로 처리되므로 CSS filter와 레이어 충돌 없음.
- COLOR_GRAY 이벤트는 canvas 내부에서 colorIndex 무시 처리하므로 CSS filter와 별개 동작.

### 3-2. 이벤트별 CSS filter 매핑

| 이벤트 ID | CSS filter 값 | 적용 시간 | 방식 |
|----------|--------------|----------|------|
| EXPLODE 발동 | `hue-rotate(90deg) contrast(1.5) brightness(1.2)` | 300ms 후 제거 | 즉발 → 페이드 아웃 |
| FLOOR_DROP 충돌 순간 | `hue-rotate(180deg) contrast(1.4) saturate(1.8)` | 400ms 후 제거 | 즉발 → 선형 복귀 |
| VORTEX 지속 중 | `hue-rotate(-30deg) saturate(1.5)` | 이벤트 8000ms 동안 | 이벤트 종료 시 제거 |
| LIQUID_FLOOD 발동 | `saturate(2.2) hue-rotate(15deg)` | 500ms 후 제거 | 즉발 → 페이드 아웃 |
| FULL_SAND 발동 | `contrast(1.3) brightness(0.9) sepia(0.3)` | 800ms 후 제거 | 즉발 → 선형 복귀 |
| DARK_SPOTLIGHT 지속 중 | `brightness(0.7)` | 이벤트 10000ms 동안 | canvas 전체 어두움 보조 |
| BOARD_TILT 발동 | `hue-rotate(45deg) contrast(1.2)` | 6000ms 동안 | 이벤트 종료 시 제거 |
| BOARD_EXPAND 발동 | `brightness(1.15) saturate(1.4)` | 600ms 후 제거 | 즉발 → 페이드 아웃 |
| 기본 (이벤트 없음) | `none` | — | — |

### 3-3. COLOR_GRAY 이벤트 충돌 회피

- COLOR_GRAY 활성 중에는 canvas filter를 `grayscale(1)` 로 강제 고정.
- 다른 즉발 이벤트(EXPLODE 등)가 겹쳐도 `grayscale(1)` 유지, 다른 filter 무시.
- COLOR_GRAY 종료 후 다른 지속 이벤트(VORTEX 등)가 여전히 활성이면 해당 이벤트 filter 복귀.

### 3-4. filter 전환 방식

```ts
// 관리 ref
filterRef = { value: string, fadeMs: number, fadeTotalMs: number }

// 즉발 적용
boardRef.current.style.filter = filterValue;
filterRef.current = { value: filterValue, fadeMs: fadeDurationMs, fadeTotalMs: fadeDurationMs };

// 선형 복귀 (매 프레임, gameLoop 내)
if (filterRef.current.fadeMs > 0) {
  filterRef.current.fadeMs -= dtMs;
  if (filterRef.current.fadeMs <= 0) {
    boardRef.current.style.filter = evColorGray.current ? 'grayscale(1)' : 'none';
  }
  // CSS filter 중간 보간은 어려우므로 단순 제거 방식 사용
  // 필요 시 opacity ref 별도 관리로 보간 가능
}
```

---

## 4. 경고 Flash

### 4-1. Flash 등급 분류

| 등급 | 해당 이벤트 | Flash 방식 |
|-----|-----------|-----------|
| HIGH | EXPLODE, FLOOR_DROP, FULL_SAND, CONTROL_FREEZE | 붉은 테두리 + 흰 채널 shift |
| LOW | 나머지 14종 | 붉은 테두리만 |

### 4-2. 타이밍 상세

```
이벤트 발동 T=0 기준:

[HIGH 등급]
T = -350ms : 붉은 테두리 alpha 0 → 1 페이드 인 시작 (200ms 소요)
T = -150ms : 테두리 alpha 1.0 홀드
T =    0ms : 이벤트 발동 + 흰 배경 rgba(255,255,255,0.18) 즉발 적용
T =  100ms : 흰 배경 alpha → 0 즉시 컷
T =  100ms : 테두리 alpha 1 → 0 페이드 아웃 시작 (200ms 소요)
T =  300ms : Flash 완전 소멸

[LOW 등급]
T = -200ms : 붉은 테두리 alpha 0 → 1 페이드 인 시작 (150ms 소요)
T =  -50ms : 테두리 alpha 1.0 홀드
T =    0ms : 이벤트 발동
T =  100ms : 테두리 alpha 1 → 0 페이드 아웃 시작 (150ms 소요)
T =  250ms : Flash 완전 소멸
```

Flash는 `setTimeout` 으로 이벤트 발동 앞에 미리 스케줄링.
이벤트 발동 함수 `fireEvent(def)` 호출 전 `scheduleFlash(def.id)` 호출.

### 4-3. Flash 구현 방식

canvas 위 `position: absolute` 오버레이 div (`flashOverlayRef`).

```
테두리 표현:
  box-shadow: inset 0 0 0 4px rgba(255, 45, 85, {alpha})
  — alpha 값은 JS에서 매 프레임 계산 후 flashOverlayRef.current.style.boxShadow 직접 적용
  — CSS transition 사용하지 않음 (타이밍 정밀 제어 위해 JS 직접 제어)

흰 채널 shift (HIGH 등급 발동 순간만):
  background: rgba(255, 255, 255, 0.18)
  → 100ms 후 background: transparent 로 즉시 전환
```

---

## 5. 이벤트 배너 임팩트 재설계

### 5-1. 현재 vs 목표 비교

| 항목 | 현재 | 목표 |
|-----|------|------|
| 위치 | `.gameArea` 위 고정 영역 (보드 밖) | 보드 canvas 위 `position: absolute` 오버레이 |
| 크기 | `font-size: 1rem` | `font-size: clamp(1.6rem, 5vw, 2.4rem)` |
| 배경 | `rgba(255, 45, 85, 0.12)` 약한 배경 | `rgba(0,0,0,0.72)` + `backdrop-filter: blur(6px)` |
| 등장 | `scale(1.04)` 0.5s pulse 1종 | 확대 + skew + 바운스 + 글리치 `::after` 조합 |
| 지속 | 즉시 사라짐 | 1800ms 표시 후 퇴장 |
| 퇴장 | 즉시 null 처리 | alpha 0으로 0.4s fade out |
| 색상 | `#ff2d55` 단일색 | 이벤트 카테고리별 3종 팔레트 |

### 5-2. 등장 애니메이션 키프레임

```css
/* 배너 박스 등장 — 0.45s */
@keyframes insaneBannerIn {
  0%   { transform: scale(0.6) skewX(-8deg); opacity: 0; letter-spacing: 0.2em; }
  40%  { transform: scale(1.08) skewX(2deg); opacity: 1; letter-spacing: 0.06em; }
  55%  { transform: scale(0.97) skewX(-1deg); }
  70%  { transform: scale(1.03) skewX(0deg); }
  100% { transform: scale(1) skewX(0deg); opacity: 1; letter-spacing: 0.04em; }
}
/* timing-function: cubic-bezier(0.22, 1, 0.36, 1) */

/* 글리치 플리커 — ::after 가상 요소, 0.3s 1회 */
@keyframes insaneBannerGlitch {
  0%   { clip-path: inset(0 0 100% 0); transform: translateX(-4px); opacity: 1; }
  10%  { clip-path: inset(20% 0 60% 0); transform: translateX(4px); }
  25%  { clip-path: inset(55% 0 30% 0); transform: translateX(-3px); }
  40%  { clip-path: inset(10% 0 80% 0); transform: translateX(2px); }
  60%  { clip-path: inset(0 0 0 0); transform: translateX(0); }
  100% { clip-path: inset(0 0 0 0); transform: translateX(0); opacity: 0; }
}
/* ::after 에 동일 텍스트를 data-name attr 로 복제, color: #0af (청록) 고정으로 채색 */

/* 퇴장 — 0.4s */
@keyframes insaneBannerOut {
  0%   { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(0.88); }
}
```

### 5-3. 이벤트 카테고리별 색상 팔레트

| 카테고리 | 해당 이벤트 | 텍스트 색 | 테두리 색 | box-shadow |
|---------|-----------|---------|---------|-----------|
| visual | FLIP_H, FLIP_V, DARK_SPOTLIGHT, INVISIBLE_PIECE, COLOR_GRAY | `#67e8f9` | `rgba(103,232,249,0.6)` | `0 0 24px rgba(103,232,249,0.3)` |
| physical | SAND_BURST, FULL_SAND, LIQUID_FLOOD, EXPLODE, VORTEX, BOUNCE_WALLS, FLOOR_DROP, BOARD_EXPAND | `#ff9f0a` | `rgba(255,159,10,0.6)` | `0 0 24px rgba(255,159,10,0.35)` |
| disruptive | CONTROL_FREEZE, PIECE_SHATTER, RANDOM_LOCK, BOARD_TILT, SPIN_BLOCK | `#ff375f` | `rgba(255,55,95,0.6)` | `0 0 24px rgba(255,55,95,0.4)` |

카테고리는 기존 `EventDef.type` 필드(`'visual' | 'physical' | 'disruptive'`)와 1:1 매핑.
배너 렌더 시 `def.type` 으로 분기해 inline style 또는 CSS 변수로 적용.

### 5-4. 배너 레이아웃 명세

DOM 구조:

```
.boardWrapper  (신규, position: relative)
  └─ <canvas ref={boardRef}>           — 메인 보드
  └─ .flashOverlay                     — 경고 Flash
  └─ .insaneBannerOverlay              — 이벤트 배너 컨테이너
       └─ .insaneBannerBox             — 배너 내부 박스 (data-name="이벤트이름" 필수)
            └─ .insaneBannerEmoji      — 이모지
            └─ .insaneBannerName       — 이벤트 이름 텍스트
            └─ .insaneBannerSub        — 부제목 (지속 시간 설명)
```

각 클래스 CSS 명세:

```css
.boardWrapper {
  position: relative;
  display: inline-block;
  flex-shrink: 0;
}

.flashOverlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 10;
  border-radius: 2px;
}

.insaneBannerOverlay {
  position: absolute;
  left: 0;
  right: 0;
  top: 38%;
  z-index: 20;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.insaneBannerBox {
  padding: 10px 24px 12px;
  border-radius: 6px;
  border: 2px solid;            /* 카테고리별 JS inline style */
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  text-align: center;
  min-width: 60%;
  max-width: 92%;
  animation: insaneBannerIn 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  position: relative;
  overflow: hidden;
}

.insaneBannerBox::after {
  content: attr(data-name);
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 24px;
  color: #0af;
  font-size: clamp(1.6rem, 5vw, 2.4rem);
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  animation: insaneBannerGlitch 0.3s ease-out forwards;
  pointer-events: none;
}

.insaneBannerEmoji {
  font-size: clamp(1.8rem, 6vw, 2.8rem);
  display: block;
  margin-bottom: 2px;
  filter: drop-shadow(0 0 8px currentColor);
}

.insaneBannerName {
  font-size: clamp(1.6rem, 5vw, 2.4rem);
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-family: 'Segoe UI', 'Impact', sans-serif;
  /* color, text-shadow: JS inline style (카테고리별) */
}

.insaneBannerSub {
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.6);
  letter-spacing: 0.08em;
  margin-top: 3px;
  /* 예: "8초 동안 좌우 반전" / "즉발 — 다음 고정 시 적용" */
}

.insaneBannerExiting {
  animation: insaneBannerOut 0.4s ease-in forwards !important;
}
```

### 5-5. 배너 퇴장 로직

1. 배너 표시 후 1800ms 경과 시 `.insaneBannerBox` 에 `.insaneBannerExiting` 클래스 추가
2. 추가 400ms 후 `setEventBanner(null)` 로 DOM 제거

### 5-6. 기존 배너 관련 코드 변경 요약

- 기존 `.eventBanner` div → `.insaneBannerOverlay > .insaneBannerBox` 구조로 교체
- 기존 `@keyframes eventPulse` → `insaneBannerIn` 으로 교체 (기존 클래스 삭제 가능)
- `setEventBanner` state 타입에 `sub?: string` 필드 추가 필요 (부제목 표시용)

---

## 6. 이벤트별 시각 효과 기대치 표

> planner 확정본 수신 완료 반영 (2026-04-22). 이벤트 총 18종 (원래 17 + BOARD_EXPAND).

| 이벤트 ID | 카테고리 | 흔들림 | CSS filter | 배너 색 | 한 줄 기대치 |
|----------|---------|--------|-----------|--------|------------|
| FLIP_H | visual | 강 12px 500ms | `hue-rotate(180deg)` 지속 | #67e8f9 | 보드 좌우 거울 반전, 8초 지속, 청록 배너 등장 |
| FLIP_V | visual | 강 12px 500ms | `invert(1) contrast(1.5)` 지속 | #67e8f9 | 보드 상하 반전, 피스가 천장에서 내려오는 것처럼 보임 |
| DARK_SPOTLIGHT | visual | 없음 | `brightness(0.7)` 10초 | #67e8f9 | 화면 대부분 암전, 낙하 피스 주변 반경 3셀만 원형 조명 (planner 반경 축소) |
| INVISIBLE_PIECE | visual | 없음 | 없음 | #67e8f9 | 낙하 피스만 투명, 고스트 없음, 위치 감으로만 플레이 |
| COLOR_GRAY | visual | 없음 | `grayscale(1) contrast(1.3)` 지속 | #67e8f9 | 모든 블록 #EEEEEE 단색 + wrap 전체 grayscale (planner: UI 상자까지 회색화) |
| SAND_BURST | physical | 중 8px 300ms | 없음 | #ff9f0a | 다음 lock 시 블록 폭발 분산, 초기 vx/vy로 사방으로 퍼짐 |
| FULL_SAND | physical | 최대 15px 800ms | `contrast(1.3) brightness(0.9) sepia(0.3)` 800ms + 적색 flash 400ms | #ff9f0a | 보드 전체 블록 모래 변환, 위→아래 한 줄씩 쓸려내리는 연출, 연쇄 클리어 |
| LIQUID_FLOOD | physical | 없음 | `saturate(2.2) hue-rotate(15deg)` 500ms | #ff9f0a | 상단 y=0~2 분산해서 66개 모래 폭포처럼 유입 (planner: boardW*6) |
| EXPLODE | physical | 강 14px 600ms | `hue-rotate(90deg) contrast(1.5) brightness(1.2)` 300ms + 흰 flash 200ms | #ff9f0a | 반경 3 폭발 + ShatterParticle 20개 튀어오름, 강한 충격 |
| VORTEX | physical | 없음 | `hue-rotate(45deg) saturate(1.8)` 8초 + 3deg 회전 흔들림 | #ff9f0a | 구심력 0.3→0.8, 감쇠 0.8→0.9, 모래가 중심으로 빨려듦 |
| BOUNCE_WALLS | physical | 없음 | 벽 충돌 시 0.2s `brightness(1.6)` | #ff9f0a | 발동 시 모든 moving sand에 초기 vx ±1.5 부여, 벽 충돌 시 반전+감쇠 |
| FLOOR_DROP | physical | 강 8px 300ms(확장) + 최대 18px 800ms(충돌) | `hue-rotate(180deg) contrast(1.4) saturate(1.8)` 400ms | #ff9f0a | 확장 행 4→6, Shatter bounces 3→5, canvas 300ms 애니메이션, 최강 임팩트 |
| CONTROL_FREEZE | disruptive | 없음 | `hue-rotate(180deg) saturate(0.7) brightness(1.1)` + 프로스트 | #ff375f | 조작 마비 2초, 피스에 얼음 필터, 화면 가장자리 프로스트 오버레이 |
| PIECE_SHATTER | disruptive | 중 8px 250ms | 흰 flash + 0.1s 폭발 파티클 | #ff375f | 현재 피스 즉시 모래로 분해, 초기 vx로 사방 퍼짐 |
| RANDOM_LOCK | disruptive | 약 7px 300ms | 발동 직전 300ms 피스 테두리 붉은 점멸 | #ff375f | 현재 위치 강제 고정, 예고 Flash 필수 |
| BOARD_TILT | disruptive | 없음 | `hue-rotate(45deg) contrast(1.2)` 6초 + `skewX(±3deg)` | #ff375f | planner 재구현 스펙: 6초 내내 지속 vx 증분, settled 재검사, skewX 유지 |
| SPIN_BLOCK | disruptive | 없음 | 소용돌이 파티클 트레일 | #ff375f | 피스 300ms마다 자동 회전, emoji `🎡` 또는 `🔄` (VORTEX 🌀과 중복 회피) |
| BOARD_EXPAND | physical | 강 12px 500ms | `brightness(1.15) saturate(1.4)` 600ms + 새 컬럼 녹색 테두리 Flash | #ff9f0a | 좌우 각 1칸 확장 애니메이션 300ms easeOutBack |

---

## 7. 인세인 전용 랭킹 UI

### 7-1. 페이지 vs 위젯 판단

위젯(게임 하단 인라인) 유지 + 시각 차별화 강화. 별도 페이지 신설 없음.

근거:
- 현재 어드민 전용 테스트 단계, 별도 랭킹 페이지는 진입 동선이 낮음.
- 정식 오픈 후에도 게임 플로우 이탈 없이 즉시 순위 확인 가능한 인라인이 UX상 유리.
- 일반 블록폴과 API 네임스페이스 이미 분리(`blockfall-insane`), 데이터 혼용 없음.
- 정식 오픈 시 별도 랭킹 페이지 신설 재검토 가능 (planner 결정 사항).

### 7-2. 일반 블록폴 랭킹과의 시각 구분

| 항목 | 일반 BlockfallBoard | 인세인 목표 |
|-----|-------------------|-----------|
| 배경색 | 밝은 계열 | `#0d0d1a` (짙은 남색) — `.rankSection` background |
| 주 강조색 | `#8e44ad` (보라) | `#ff2d55` + `#ff9f0a` 투 톤 |
| 섹션 타이틀 | "주간 RANK" 단순 텍스트 | "INSANE RANK" + 4초 주기 글리치 애니메이션 |
| 테이블 헤더 | `background: #8e44ad` 단색 | `background: linear-gradient(90deg, #ff2d55, #ff9f0a)` |
| 1위 행 | `#ff8c00 + bold` | `#ffd60a (금색) + bold + text-shadow` |
| 역대 1위 배너 | 흰 배경, 보라 테두리 | 검은 배경, 금색 테두리, 금색 글로우 |
| 탭 버튼 | 보라 border/bg | 난이도 탭 제거 (planner 확정), "룰" 탭만 유지 또는 별도 버튼 |

### 7-3. "INSANE RANK" 타이틀 디자인

```css
@keyframes insaneRankGlitch {
  0%   {
    text-shadow: 2px 0 rgba(255,45,85,0.8), -2px 0 rgba(103,232,249,0.8);
    clip-path: inset(0 0 0 0);
    transform: translateX(0);
  }
  15%  {
    text-shadow: -2px 0 rgba(255,45,85,0.8), 2px 0 rgba(103,232,249,0.8);
    clip-path: inset(10% 0 70% 0);
    transform: translateX(2px);
  }
  30%  {
    clip-path: inset(0 0 0 0);
    transform: translateX(0);
  }
  50%  { text-shadow: 2px 0 rgba(255,159,10,0.6), -2px 0 rgba(255,45,85,0.6); }
  75%  { text-shadow: 0 0 8px rgba(255,45,85,0.6); }
  100% { text-shadow: 0 0 4px rgba(255,45,85,0.4); }
}

.insaneRankTitle {
  font-size: 1.1rem;
  font-weight: 900;
  text-align: center;
  color: #ff2d55;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  animation: insaneRankGlitch 4s infinite;
  margin: 0 0 10px;
  position: relative;
}

.insaneWord {
  color: #ff9f0a;
  text-shadow: 0 0 12px rgba(255, 159, 10, 0.5);
}
```

### 7-4. 역대 1위 배너 (.alltimeBanner) 개편

```
현재:
  background: rgba(255, 45, 85, 0.08)
  border: 1px solid rgba(255, 45, 85, 0.3)
  .atLabel color: #ff2d55

목표:
  background: rgba(255, 214, 10, 0.06)
  border: 1px solid rgba(255, 214, 10, 0.5)
  box-shadow: 0 0 12px rgba(255, 214, 10, 0.12)
  .atLabel color: #ffd60a
```

### 7-5. 1~10위 엔트리 스타일

| 순위 | 행 배경 | 텍스트 색 | 추가 스타일 |
|-----|--------|---------|-----------|
| 1위 | `rgba(255, 214, 10, 0.08)` | `#ffd60a + bold` | `text-shadow: 0 0 8px rgba(255,214,10,0.5)` |
| 2위 | `rgba(200, 200, 200, 0.05)` | `#c0c0c0 + bold` | — |
| 3위 | `rgba(205, 127, 50, 0.06)` | `#cd7f32 + bold` | — |
| 4~10위 짝수 | `#111` | `#ccc` | 현재와 동일 |
| 4~10위 홀수 | 투명 | `#ccc` | 현재와 동일 |

```css
.rankRow1st td {
  background: rgba(255, 214, 10, 0.08);
  color: #ffd60a;
  font-weight: bold;
  text-shadow: 0 0 8px rgba(255, 214, 10, 0.5);
}
.rankRow2nd td {
  background: rgba(200, 200, 200, 0.05);
  color: #c0c0c0;
  font-weight: bold;
}
.rankRow3rd td {
  background: rgba(205, 127, 50, 0.06);
  color: #cd7f32;
  font-weight: bold;
}
```

### 7-6. 랭킹 행 슬라이드 인 애니메이션

```css
@keyframes rankRowSlideIn {
  from { opacity: 0; transform: translateX(-24px); }
  to   { opacity: 1; transform: translateX(0); }
}
/* JS에서: tr.style.animation = `rankRowSlideIn 0.3s ease-out ${i * 40}ms both` */
/* 총 완료 시간: 40ms × 10 + 300ms = 700ms */
```

### 7-7. 본인 행 강조

```css
.rankRowMine td {
  background: rgba(255, 45, 85, 0.10) !important;
  border-left: 3px solid #ff2d55;
}
.rankRowMine td:first-child::after {
  content: ' (나)';
  font-size: 0.75em;
  color: #ff2d55;
  opacity: 0.8;
}
```

판정 기준 (우선순위 순):
1. 점수 제출 성공 후 서버 반환 id 와 `r.id` 비교 (동명이인 방지)
2. id 비교 불가 시 `playerName` state 와 `r.name` 일치 여부 폴백

### 7-8. 진입 동선

| 위치 | 방식 | 상태 |
|-----|------|------|
| 게임 종료 모달 | 기존 "랭킹 보기" 버튼 → 모달 닫고 페이지 스크롤 다운 | 유지 |
| 게임 보드 하단 인라인 | 항상 표시 | 유지 |
| 홈 Test Lab 카드 | 변경 없음 (진입 버튼만 유지) | 변경 없음 |

---

## 8. CSS 클래스/변수 변경 목록

파일 경로: `frontend/src/games/blockfall/BlockfallInsaneBoard.module.css`

### 8-1. 수정 대상 (기존 값 → 목표 값)

| 클래스.속성 | 현재 값 | 목표 값 |
|-----------|--------|--------|
| `.eventBanner` `font-size` | `1rem` | `clamp(1.6rem, 5vw, 2.4rem)` |
| `.eventBanner` `padding` | `6px 12px` | `10px 24px 12px` |
| `.eventBanner` `background` | `rgba(255, 45, 85, 0.12)` | `rgba(0, 0, 0, 0.72)` |
| `.eventBanner` `border` | `1px solid rgba(255, 45, 85, 0.4)` | 카테고리별 JS inline style 로 분기 처리 |
| `.eventBanner` `animation` | `eventPulse 0.5s ease-out` | `insaneBannerIn 0.45s cubic-bezier(0.22, 1, 0.36, 1)` |
| `.rankTitle` `font-size` | `1rem` | `.insaneRankTitle` 신규 클래스로 분리, `1.1rem` |
| `.table th` `background` | `#ff2d55` | `linear-gradient(90deg, #ff2d55, #ff9f0a)` |
| `.table tr:first-child td` `color` | `#ff8c00` | `#ffd60a` (`.rankRow1st` 클래스로 이관) |
| `.alltimeBanner` `background` | `rgba(255, 45, 85, 0.08)` | `rgba(255, 214, 10, 0.06)` |
| `.alltimeBanner` `border` | `1px solid rgba(255, 45, 85, 0.3)` | `1px solid rgba(255, 214, 10, 0.5)` |
| `.alltimeBanner` (신규) `box-shadow` | 없음 | `0 0 12px rgba(255, 214, 10, 0.12)` |
| `.atLabel` `color` | `#ff2d55` | `#ffd60a` |

### 8-2. 신규 추가 CSS 변수 (`:root` 또는 `.wrap` 스코프)

| 변수명 | 값 | 용도 |
|-------|---|------|
| `--insane-accent-1` | `#ff2d55` | 붉은 핑크 메인 |
| `--insane-accent-2` | `#ff9f0a` | 주황 서브 |
| `--insane-accent-gold` | `#ffd60a` | 금색 (1위/역대) |
| `--insane-accent-cyan` | `#67e8f9` | 청록 (visual 이벤트) |
| `--insane-bg-deep` | `#0d0d1a` | 랭킹 섹션 배경 |

### 8-3. 신규 추가 CSS 클래스

| 클래스명 | 역할 |
|---------|------|
| `.boardWrapper` | `position: relative` 래퍼 (canvas + overlay 포지셔닝 기준점) |
| `.flashOverlay` | 경고 Flash 오버레이 div |
| `.insaneBannerOverlay` | 배너 오버레이 컨테이너 (position: absolute, top: 38%) |
| `.insaneBannerBox` | 배너 내부 박스 (backdrop-filter: blur, 카테고리별 border) |
| `.insaneBannerEmoji` | 배너 이모지 (drop-shadow) |
| `.insaneBannerName` | 배너 이벤트 이름 텍스트 |
| `.insaneBannerSub` | 배너 부제목 (지속 시간 설명) |
| `.insaneBannerExiting` | 퇴장 애니메이션 트리거 |
| `.insaneRankTitle` | 랭킹 타이틀 (글리치 애니메이션 포함) |
| `.insaneWord` | "INSANE" 강조 스팬 (주황색) |
| `.rankRow1st` | 1위 행 금색 강조 |
| `.rankRow2nd` | 2위 행 은색 강조 |
| `.rankRow3rd` | 3위 행 동색 강조 |
| `.rankRowMine` | 본인 행 강조 (붉은 left border) |

### 8-4. 신규 추가 키프레임

| 키프레임명 | 역할 | 재생 시간 |
|----------|------|---------|
| `@keyframes insaneBannerIn` | 배너 등장: 확대 + skew + 바운스 | 0.45s |
| `@keyframes insaneBannerGlitch` | 배너 `::after` 글리치 플리커 | 0.3s, 1회 |
| `@keyframes insaneBannerOut` | 배너 퇴장: 수축 + fade | 0.4s |
| `@keyframes insaneRankGlitch` | 랭킹 타이틀 지속 글리치 | 4s, infinite |
| `@keyframes rankRowSlideIn` | 랭킹 행 슬라이드 인 (stagger) | 0.3s |

### 8-5. TSX 파일 내 수치 상수 변경 (developer-frontend 참고)

파일: `frontend/src/games/blockfall/BlockfallInsaneBoard.tsx`

| 상수명 | 현재 값 | 목표 값 |
|-------|--------|--------|
| `SAND_TICK_INTERVAL` | `60` | `45` |
| `SAND_BATCH_SIZE` | `25` | `35` |
| `SHATTER_GRAVITY` | `0.06` | `0.08` |
| `SHATTER_DAMPING` | `0.50` | `0.60` |
| `SHATTER_MIN_SPEED` | `0.04` | `0.03` |

draw 함수 내 inline 값:

| 항목 | 현재 | 목표 |
|------|------|------|
| moving sand `globalAlpha` | `0.6` | `0.75` |
| settled sand/shatter `globalAlpha` | `0.85` | `0.90` |
| shatter 잔상 거리 | `p.x - p.vx * 1.5` | `p.x - p.vx * 2.5` |
| shatter 잔상 y | `p.y - p.vy * 1.5` | `p.y - p.vy * 2.5` |
| shatter 잔상 alpha | `0.25` | `0.35` |

---

## 9. 접근성 및 반응형

### 9-1. 접근성

| 항목 | 대응 방안 |
|-----|---------|
| 화면 흔들림 | `@media (prefers-reduced-motion: reduce)` 적용 시 `triggerShake()` 에서 amplitude=0 강제 |
| 색 왜곡 | `prefers-reduced-motion` 적용 시 CSS filter 비활성 (`boardRef.current.style.filter = 'none'`) |
| 배너 텍스트 | 이모지 후 이벤트 이름 텍스트 항상 존재 (스크린리더 접근 가능) |
| 배너 aria | `.insaneBannerOverlay` 에 `aria-live="assertive"` 추가 |
| backdrop-filter 폴백 | 미지원 브라우저: `rgba(0,0,0,0.88)` 단색 (`@supports` 로 분기) |
| 키보드 네비게이션 | 방향키/스페이스/P/Shift 기존 키 완전 유지 |
| 색 대비 (WCAG AA 4.5:1) | `#67e8f9` on `rgba(0,0,0,0.72)` ≈ 8.2:1, `#ff9f0a` ≈ 4.8:1, `#ff375f` ≈ 4.6:1 — 모두 통과 |
| Flash 광과민 (WCAG 2.3.1) | Flash 최대 지속 350ms, 초당 3회 미만 — 기준 통과 |

### 9-2. 반응형

| 뷰포트 | 배너 오버라이드 |
|-------|-------------|
| 480px+ (기본) | `min-width: 60%`, `font-size: clamp(1.6rem, 5vw, 2.4rem)`, `blur(6px)` |
| 480px 미만 | `min-width: 80%`, `blur(4px)` |
| 360px 미만 | `.insaneBannerBox padding: 8px 12px`, `.insaneBannerName font-size: 1.4rem`, `.insaneBannerEmoji display: none` |

기존 `@media (max-width: 479px)`, `@media (max-width: 359px)` 블록 내부에 위 오버라이드 추가.

---

## 10. planner PRD 정합성 노트 (2026-04-22 갱신)

planner가 `docs/specs/blockfall-insane-overhaul.md`에 확정한 스펙과 본 명세 간 정합성:

- **일치**: 화면 흔들림 진폭 등급, 이벤트 색 왜곡 매핑, 경고 Flash 대상 5종, 파티클 상향 수치, BOARD_TILT skewX 유지, SPIN_BLOCK emoji 교체.
- **본 명세가 더 상세한 부분** (planner PRD 유지):
  - 흔들림 구현 방식(canvas translate vs CSS transform) — translate 권장 근거.
  - CSS filter 이벤트별 정확한 값과 적용 시간.
  - 배너 CSS 키프레임/클래스 구조 전체.
  - 랭킹 UI 순위별 색상/애니메이션 정밀 수치.
- **오픈 퀘스천 해소안**:
  - 대형 배너 시야 가림: `rgba(0,0,0,0.72)` + `backdrop-filter: blur(6px)` + 1.2s 지속 → 적당 가시성. 필요 시 두께 축소 가능.
  - 경고 Flash 색: 붉은 테두리(공통) + HIGH 등급만 흰 배경 채널 shift(100ms).

---

## 11. 개발자 착수 체크리스트 (developer-frontend)

1. `.boardWrapper` 래퍼 div 신규 추가 (canvas 부모). position: relative 선언.
2. 기존 `.eventBanner` div 제거 → `.insaneBannerOverlay > .insaneBannerBox` 구조로 교체.
3. `EventDef.type` 필드 기반으로 배너 카테고리 색상 inline style 적용.
4. `shakeRef` + `triggerShake(amplitudePx, durationMs)` 함수 신규 구현. draw 함수 맨 앞에 translate 적용.
5. `filterRef` + `setBoardFilter(filterValue, fadeMs)` 함수 신규 구현. canvas style.filter 직접 제어.
6. `flashOverlayRef` div 신규 추가. `scheduleFlash(eventId)` 함수로 setTimeout 기반 테두리 alpha 제어.
7. 파티클 수치 상수 5개 교체: SAND_TICK_INTERVAL, SAND_BATCH_SIZE, SHATTER_GRAVITY, SHATTER_DAMPING, SHATTER_MIN_SPEED.
8. draw 함수 내 inline alpha/잔상 거리 값 교체 (섹션 8-5).
9. SAND_BURST / PIECE_SHATTER / LIQUID_FLOOD 파티클 생성 시점 초기 vx/vy 부여.
10. CSS 모듈에 신규 클래스 14개 + 키프레임 5개 추가.
11. 반응형 미디어 쿼리에 배너 오버라이드 추가.
12. 랭킹 섹션 순위별 클래스 적용 (.rankRow1st/2nd/3rd/Mine).
13. `prefers-reduced-motion` 대응 분기 추가.
