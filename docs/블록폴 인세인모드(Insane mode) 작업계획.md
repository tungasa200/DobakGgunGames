# 블록폴 인세인모드(Insane Mode) 작업계획

> 작성일: 2026-04-21  
> 최종 업데이트: 2026-04-21  
> 브랜치: WIP

---

## 0. 진행 상황 및 이어받기 체크리스트

> **다음 대화에서 이어받을 때** 이 섹션을 먼저 확인할 것.  
> 구현 파일: `frontend/src/games/blockfall/BlockfallInsaneBoard.tsx`

### 완료 ✅

| 단계 | 내용 | 상태 |
|---|---|---|
| STEP 1 | `BlockfallInsaneBoard.tsx` / `BlockfallInsaneBoard.module.css` 생성 | ✅ |
| STEP 1 | `GamePage.tsx` — blockfall-insane 메타(배경 `#0a0a0a`, 강조 `#ff2d55`) 추가 | ✅ |
| STEP 1 | `App.tsx` — `/blockfall-insane` AdminRoute 보호 라우트 추가 (`/:game` 위에 선언) | ✅ |
| STEP 1 | `HomePage.tsx` — Test Lab 카드에 어드민 전용 🔥 버튼 추가 | ✅ |
| STEP 2 | 이중 레이어 엔진 — `SandParticle` / `ShatterParticle` 타입 + `arena + particles` 이중 상태 | ✅ |
| STEP 2 | 충돌 판정 `collide()` — settled 파티클 포함 | ✅ |
| STEP 2 | 라인 클리어 `isRowFull()` — settled 파티클 포함 | ✅ |
| STEP 2 | `arenaSweepInsane()` — 파티클 y좌표 이동 + recheckSettled | ✅ |
| STEP 3 | Sand 물리 시뮬레이션 `simulateSand()` — 배치 처리(25개/틱), VORTEX/BOUNCE_WALLS 통합 | ✅ |
| STEP 3 | ShatterParticle 물리 `simulateShatter()` — 중력, 벽/바닥 튕김, motion blur 렌더 | ✅ |
| STEP 3 | `SAND_BURST` 이벤트 — 다음 lock 시 sand로 변환 플래그 방식 | ✅ |
| STEP 4 | 이벤트 프레임워크 — `InsaneEvent`, 레벨별 쿨다운, 이벤트 배너 UI, 타이머 바 | ✅ |
| STEP 5 | 시각 이벤트 5종 — FLIP_H, FLIP_V, DARK_SPOTLIGHT, INVISIBLE_PIECE, COLOR_GRAY | ✅ |
| STEP 5 | 물리 이벤트 7종 — SAND_BURST, FULL_SAND, LIQUID_FLOOD, EXPLODE, VORTEX, BOUNCE_WALLS, FLOOR_DROP | ✅ |
| STEP 5 | 방해 이벤트 5종 — CONTROL_FREEZE, PIECE_SHATTER, RANDOM_LOCK, BOARD_TILT, SPIN_BLOCK | ✅ |
| STEP 5 | `BOARD_EXPAND` 이벤트 — 좌우 각 1칸 확장, canvas 너비 동적 변경 | ✅ |
| STEP 6 | 확장 블록 8종 + 기존 7종 가중치 풀 (`randomInsanePiece()`) | ✅ |
| 버그수정 | `arenaSweepInsane` sand 틱에서 콤보 리셋 버그 — `fromLock` 파라미터로 분리 | ✅ |
| 버그수정 | `VORTEX` settled 파티클 → moving 전환 누락 | ✅ |
| 버그수정 | `playerHardDrop` / `lockPieceImmediate` — SAND_BURST 무시하고 `mergeInto()` 직접 호출 → `mergePieceIntoBoard()` 헬퍼로 일원화 | ✅ |
| 버그수정 | `gameLoop` 첫 프레임 `lastTime=0` → `dt = performance.now()` (수천ms) 로 이벤트 즉시 발동 — 첫 프레임 스킵 처리 | ✅ |
| 미결사항 | 작업계획 섹션 12 전부 확정 처리 | ✅ |

### 미완료 / 다음 대화에서 할 일 🔲

| 우선순위 | 항목 | 설명 |
|---|---|---|
| ✅ 완료 | **빌드 검증** | `npm run build` 성공 — 97 modules, TypeScript 에러 없음 (2026-04-21) |
| 🔴 필수 | **동작 확인** | 어드민 계정으로 `/blockfall-insane` 접속, 게임 시작 → 기본 동작 확인 |
| 🟡 권장 | **이벤트 수동 테스트** | 각 이벤트 강제 발동해 시각/물리/방해 효과 확인 |
| 🟡 권장 | **STEP 7 (선택)** | `BOARD_EXPAND` 이미 구현됨. `BOARD_SHRINK`는 미채택으로 확정. 추가 보드 크기 작업 없음 |
| 🟢 나중에 | **STEP 8 밸런싱** | 이벤트 발동 확률·간격 수치 튜닝, 모바일 터치 확인 |
| 🟢 나중에 | **정식 오픈 처리** | `AdminRoute` 래퍼 제거, Test Lab 어드민 조건 제거 (섹션 11-H 참고) |

### 알려진 이슈 / 주의사항

| 분류 | 내용 |
|---|---|
| 동작 주의 | `SPIN_BLOCK` 이벤트 발동 중 다른 지속형 이벤트가 교체될 경우, 교체 전 이벤트 플래그가 `clearActiveEvent()` 없이 덮여 쓰여질 수 있음. 게임플레이에는 큰 영향 없음. |
| 동작 주의 | `BOARD_EXPAND` 후 mobile CSS 고정 너비(`220px`)가 canvas 실제 너비보다 좁아질 수 있음. 반응형 점검 필요. |
| 미구현 | `BOARD_TILT` 지속 이벤트 6초 동안 지속적인 기울기 힘이 없음 — 첫 발동 시 1회 변환만 발생. 향후 개선 가능. |

---

---

## 1. 핵심 개념 — "같아 보이지만 완전히 다른 엔진"

사용자가 보는 것: 블록이 떨어지고, 쌓이고, 한 줄이 채워지면 지워지는 블록폴.  
실제 동작: **arena(고정 레이어) + sand(물리 레이어)** 이중 구조.

기본룰인 "한 줄을 채우면 지운다"는 항상 유지된다.  
이벤트는 이 기본룰을 깨는 것이 아니라, **줄을 채우는 과정을 혼란스럽게** 만드는 것이다.

---

## 2. 엔진 설계 — 이중 레이어 구조

### 2-1. 레이어 구성

```
[낙하 피스]         ← 플레이어가 조작하는 현재 블록
     ↓ 고정(lock)
     ├─ 이벤트 없음 → [arena 레이어]에 solid로 기록
     └─ 이벤트 있음 → [sand 레이어]에 moving sand로 추가

[arena 레이어]      arena[y][x]: number[][]
  solid 블록만 기록. 라인 클리어 / 충돌 판정의 1차 기준.

[sand 레이어]       particles: SandParticle[]
  물리 시뮬레이션 대상. 두 가지 상태로 구분.
  ├─ moving  : 아직 낙하/이동 중. 라인 클리어 판정 제외.
  └─ settled : 멈춘 상태. 라인 클리어 판정 참여 (solid와 동등).
```

### 2-2. 파티클 타입

파티클은 물리 특성이 다른 두 종류로 분리한다.

**SandParticle** — 모래 물리 (셀 단위 정수 좌표)

```ts
interface SandParticle {
  x: number;           // 셀 단위 정수
  y: number;
  vy: number;          // 낙하 속도 (settled 시 0)
  colorIndex: number;
  state: 'moving' | 'settled';
}
```

셀 단위 정수 좌표를 사용한다. 프레임마다 1칸씩 이동해 충분한 시각 효과를 낸다.

**ShatterParticle** — 충격 파편 물리 (실수 좌표 + 속도 벡터)

```ts
interface ShatterParticle {
  x: number;           // 실수 좌표 (서브셀 단위 이동)
  y: number;
  vx: number;          // 수평 속도 (cells/frame)
  vy: number;          // 수직 속도
  colorIndex: number;
  bounces: number;     // 남은 튕김 횟수. 0이 되면 settled로 전환
  state: 'flying' | 'settled';
}
```

ShatterParticle은 충격 이벤트(`FLOOR_DROP`)에서만 생성된다.  
실수 좌표로 이동하며, 벽/바닥 충돌 시 속도 벡터를 반전+감쇠한다.  
`bounces`가 소진되거나 속도가 임계값 이하로 떨어지면 `settled`로 전환.  
`settled` 상태의 ShatterParticle은 SandParticle settled와 동일하게 라인 클리어 판정에 참여한다.

### 2-3. 라인 클리어 판정

```ts
// 특정 행 y가 클리어 가능한지 판정
function isRowFull(y: number): boolean {
  for (let x = 0; x < BOARD_W; x++) {
    const hasSolid   = arena[y][x] !== 0;
    const hasSettled = particles.some(p => p.x === x && p.y === y && p.state === 'settled');
    if (!hasSolid && !hasSettled) return false;
  }
  return true;
}

// 클리어 실행: 해당 행의 solid + settled sand 전부 제거
// 위쪽 settled sand는 moving으로 전환 → 다시 낙하 시작
```

**핵심**: moving 상태의 파티클은 판정에서 제외된다.  
모래가 낙하 중일 때는 줄을 채우지 않고, **멈춰야만** 채운다.

### 2-4. Sand 물리 시뮬레이션

매 N프레임마다 moving 파티클을 순회하여 이동 처리:

```
1. 바로 아래(y+1)가 비어있으면 → 낙하
2. 아래가 막혀있으면 → 좌하(x-1, y+1) 또는 우하(x+1, y+1) 중 빈 곳으로 이동
3. 세 방향 모두 막혀있으면 → settled로 전환
```

비어있는지 판정 기준: `arena[y][x] === 0` AND `settled 파티클 없음` AND `보드 범위 내`.

### 2-5. 충돌 판정 (낙하 피스 기준)

낙하 피스의 충돌은 **arena 레이어만** 기준으로 판정한다.  
moving sand 위로 피스가 통과할 수 있다 (모래가 비켜날 것이므로).  
settled sand는 solid와 동일하게 충돌 판정에 포함한다.

```ts
function collide(pos, matrix): boolean {
  // arena 충돌
  if (arena[y][x] !== 0) return true;
  // settled sand 충돌
  if (particles.some(p => p.x === x && p.y === y && p.state === 'settled')) return true;
  return false;
}
```

---

## 3. 점수 시스템

기본룰은 기존 블록폴과 동일하게 유지한다.

| 점수 원천 | 계산 방식 |
|---|---|
| 라인 클리어 | 기존과 동일: 1줄=100×레벨, 2줄=300×레벨, 3줄=500×레벨, 4줄=800×레벨 |
| 소프트 드롭 | +1점/칸 |
| 하드 드롭 | +2점/칸 |
| 콤보 | 연속 클리어 시 50×(콤보-1)×레벨 |
| **이벤트 클리어 보너스** | 이벤트 활성 중 라인 클리어 시 점수 2배 |
| **Sand 연쇄 클리어** | sand 낙하로 인한 연속 클리어 발생 시 콤보로 처리 |

Sand가 settling되며 연쇄 클리어가 일어날 수 있다.  
이 경우 일반 콤보와 동일하게 보너스를 적용한다.

---

## 4. 이벤트 시스템

### 4-1. 이벤트 구조

```ts
interface InsaneEvent {
  id: EventId;
  type: 'visual' | 'physical' | 'disruptive';
  duration: number;      // ms. 0이면 즉발(one-shot)
  mobileExcluded?: boolean;  // true면 모바일에서 발동하지 않음
  onStart: () => void;
  onTick?: (dt: number) => void;
  onEnd?: () => void;    // 지속형 이벤트 종료 시 상태 복원
}
```

- 이벤트 발동 간격: 게임 레벨에 따라 15~30초 (레벨 높을수록 짧아짐)
- 동시 활성 이벤트: 최대 1개 (단, 즉발 이벤트는 지속형과 겹칠 수 있음)
- 발동 시 UI 배너로 이벤트명 표시
- `mobileExcluded: true` 인 이벤트는 발동 풀에서 제외. 모바일 판정은 `navigator.maxTouchPoints > 0` 또는 UA 기반으로 게임 시작 시 1회 확인해 `isMobile` ref에 저장.

---

### 4-2. a. 시각적 이벤트 (Visual Events)

렌더러(Canvas 2D) 레이어에서만 처리. arena / sand 데이터는 그대로이고 그리는 방식만 바뀐다.

| 이벤트 | 내용 | 지속 | 모바일 |
|---|---|---|---|
| `FLIP_H` | ctx.transform 좌우 반전 렌더 | 8초 | ❌ 제외 |
| `FLIP_V` | ctx.transform 상하 반전 렌더 | 6초 | ❌ 제외 |
| `DARK_SPOTLIGHT` | 배경 암전, 현재 낙하 피스 주변 반경 N셀만 조명 | 10초 | ✅ |
| `INVISIBLE_PIECE` | 낙하 중인 피스만 투명 렌더. 낙하가 끝나면 원래대로 | 6초 | ✅ |
| `COLOR_GRAY` | 모든 블록을 #EEEEEE로 변환 | 지속 | ✅ |

---

### 4-3. b. 물리적 이벤트 (Physical Events)

피스가 고정될 때 또는 이미 쌓인 블록의 상태를 바꾼다.  
이벤트 종료 후 파티클은 바뀐 위치/상태를 유지한다.

| 이벤트 | 내용 | 지속 | 모바일 |
|---|---|---|---|
| `SAND_BURST` | 가장 최근 고정된 블록을 즉시 sand(moving)로 전환. arena에서 제거 후 파티클 추가. 흘러내려 settled 되면 라인 클리어 판정 참여 | 즉발 | ✅ |
| `FULL_SAND` | 보드 전체 solid를 sand(moving)로 전환. 전부 흘러내리며 재정착 → 연쇄 클리어 가능. 난이도가 높은 레벨에서만 발동 | 즉발 | ✅ |
| `LIQUID_FLOOD` | 보드 상단에 sand(moving) N개를 생성. 위에서 흘러내려 쌓임 → 쓰레기 쌓이는 효과 | 즉발 | ✅ |
| `EXPLODE` | 랜덤 위치 폭발. 반경 내 solid를 arena에서 제거(파티클로 전환하지 않고 소멸) → 구멍이 생기는 방해 | 즉발 | ✅ |
| `VORTEX` | 보드 중심을 향해 moving 파티클에 구심력 추가. settled 파티클도 일시적으로 moving으로 전환 | 8초 | ✅ |
| `BOUNCE_WALLS` | moving 파티클이 벽에 닿으면 vx 반전으로 튕김 | 8초 | ✅ |
| `FLOOR_DROP` | 보드 하단이 빠르게 확장되며 쌓인 블록들이 낙하. 바닥 충돌 시 셀 단위로 산산이 흩어짐 | 즉발 | ❌ 제외 |

**`FLOOR_DROP` 상세:**  
1. `boardH`를 N행 늘리고 캔버스 높이를 빠르게 확장한다 (애니메이션).  
2. 기존 arena 블록들은 원래 좌표에 유지되나 아래에 빈 공간이 생겨 공중에 뜬 상태.  
3. 연결된 블록 덩어리를 유닛 단위로 파악해 중력 가속도를 적용하며 낙하시킨다.  
4. 유닛이 바닥 또는 다른 solid에 충돌하는 순간, 유닛을 구성하는 각 셀이 `ShatterParticle`로 분해된다.  
   - 충돌 방향(아래에서 위)의 반대로 `vy` 반전 + 감쇠  
   - 각 셀마다 랜덤 `vx` 부여 → 사방으로 흩어짐  
5. ShatterParticle은 벽/바닥에서 튕기며 (`bounces` 차감) 속도가 줄어들다 settled로 전환.  
6. settled된 ShatterParticle은 라인 클리어 판정에 참여.

```
[이벤트 전]          [바닥 확장 직후]       [충돌 후]
■ ■ . ■ ■           ■ ■ . ■ ■            . . . . .
■ ■ ■ ■ ■           ■ ■ ■ ■ ■            * . . . *
. ■ ■ ■ .           . ■ ■ ■ .            . * . * .
─────────    →      ↓ ↓ ↓ ↓ ↓    →      . . * . .
(바닥)              . . . . .            ─────────
                    . . . . .            * * . * *  ← 튀어오름
                    ─────────
```

**`FULL_SAND` 상세:**  
전체가 모래가 되어 아래로 쏟아지면서 하단부터 빼곡히 채워진다.  
자연스럽게 하단 여러 줄이 동시에 클리어되며 연쇄 콤보가 발생할 수 있다.  
"대혼돈이지만 운 좋으면 대박 점수"라는 인세인 모드다운 연출.  
단, sand settling 속도를 일괄 처리하면 프레임 드랍이 생길 수 있으므로 매 프레임 일부씩 처리한다.

---

### 4-4. c. 방해 이벤트 (Disruptive Events)

낙하 피스 조작 또는 게임 상태에 직접 개입한다.

| 이벤트 | 내용 | 지속 | 모바일 |
|---|---|---|---|
| `CONTROL_FREEZE` | 입력 잠금. 피스는 계속 낙하 | 2초 | ✅ |
| `PIECE_SHATTER` | 현재 낙하 중인 피스가 즉시 sand(moving)로 분해되어 낙하 시작. 새 피스 등장 | 즉발 | ✅ |
| `RANDOM_LOCK` | 현재 피스를 현재 위치에서 즉시 강제 고정 | 즉발 | ✅ |
| `BOARD_TILT` | 모든 settled 파티클을 moving으로 전환하고 vx를 한쪽으로 추가. 전체가 쏠림 | 6초 | ✅ |
| `SPIN_BLOCK` | 현재 낙하 중인 피스가 좌우 이동만 가능하고 딜레이 없이 계속 자동 회전. 피스 고정 시 해제 | 현재 블록 낙하 종료까지 | ✅ |

---

## 5. 확장 블록 종류

기존 7종 테트로미노는 그대로 유지하되 출현 가중치를 낮춘다.  
신규 블록은 칸 수 및 모양 제한 없음.

| ID | 이름 | 크기 | 모양 | 매트릭스 (■=셀) |
|---|---|---|---|---|
| `MINO_DOT` | 닷 | 1칸 | 단일 셀 | `■` |
| `MINO_DOMINO` | 도미노 | 2칸 | 1×2 직선 | `■■` |
| `MINO_L3` | 미니-L | 3칸 | L자 | `■` `■■` |
| `MINO_X` | 십자 | 5칸 | 십자형 | `.■.` `■■■` `.■.` |
| `MINO_WIDE` | 와이드-I | 6칸 | 1×6 직선 | `■■■■■■` |
| `MINO_BIG_O` | 빅-O | 6칸 | 2×3 직사각형 | `■■■` `■■■` |
| `MINO_THUMBS_UP` | 따봉 | 7칸 | 엄지척 | `..■` `..■` `■■■` `■■■` |
| `MINO_MIDDLE` | 뻐큐 | 7칸 | 중지 | `.■.` `.■.` `■■■` `■■■` |

---

## 6. 보드 크기 동적 변경

### 6-1. 가능 여부

가능하다. 이중 레이어 구조에서:
- `arena`: `boardW` / `boardH` 기반으로 동적 재생성 가능
- `particles`: 절대 좌표 저장이므로 boardW가 바뀌어도 데이터 유지

### 6-2. 구현 방식

`boardW`, `boardH`를 상수가 아닌 `useRef`로 관리한다.  
Canvas의 `width` / `height`를 state로 연결해 이벤트 발동 시 자동 반영.

### 6-3. 경계 처리

| 상황 | 처리 |
|---|---|
| 확장 | 파티클은 그 자리에 유지. 새 공간이 생기는 것이므로 추가 처리 불필요 |
| 축소 (좌우) | 새 경계 밖 파티클을 경계 안쪽으로 밀거나 sand(moving)로 전환 |
| 축소 (상하) | 잘린 위쪽 파티클 소멸. 충분히 좁아지면 게임 오버 트리거로 활용 가능 |
| 피스 스폰 | boardW 변경 시 스폰 X 좌표 재계산: `boardW / 2 - piece.width / 2` |

### 6-4. 보드 크기 이벤트 (후보)

| 이벤트 | 내용 | 지속 |
|---|---|---|
| `BOARD_EXPAND` | 보드 좌우로 2칸 확장. 낙하 피스는 확장된 영역까지 이동 가능 | 10초 |
| `BOARD_SHRINK` | 보드 좌우로 2칸 축소. 밀려난 파티클은 sand(moving)로 전환되어 쏟아짐 | 8초 |

---

## 7. 렌더링

### 7-1. 렌더 레이어 순서

```
1. 배경 / 그리드
2. arena solid 블록              ← 기존과 동일한 방식
3. settled sand / shatter 파티클 ← solid와 동일한 셀 크기, 약간 다른 색조
4. moving sand 파티클            ← 동일 셀 크기, 반투명
5. flying shatter 파티클         ← 실수 좌표, 셀 크기, 잔상(motion blur) 효과
6. 낙하 피스 (고스트 포함)
7. 이벤트 오버레이 (시각 이벤트 ctx 변환)
8. UI 오버레이 (이벤트 배너, 타이머 바)
```

**ShatterParticle 렌더 특이사항:**  
- 실수 좌표이므로 `ctx.fillRect(p.x * CELL, p.y * CELL, CELL, CELL)` 로 서브셀 위치에 그림  
- 속도에 비례한 짧은 잔상을 `globalAlpha`를 낮춰 이전 위치에 덧그려 motion blur 효과  
- `bounces`가 많이 남아있을수록 밝게, 줄어들수록 점점 어둡게 렌더해 에너지 소실 표현

### 7-2. 성능

파티클 수가 `BOARD_W × BOARD_H` (최대 ~250개, 보드 전체가 sand인 경우) 를 넘지 않으므로  
매 프레임 전체 순회해도 성능 문제 없다. (셀 단위 정수 좌표 채택의 이점)

`FULL_SAND` 등 대량 settling 발생 시 1프레임에 모든 파티클을 이동시키지 않고  
**프레임당 최대 N개씩** 처리해 프레임 드랍을 방지한다.

---

## 8. 페이지 신설 작업

### 8-1. 신규 파일

| 경로 | 설명 |
|---|---|
| `frontend/src/games/blockfall/BlockfallInsaneBoard.tsx` | 인세인 전용 컴포넌트 |
| `frontend/src/games/blockfall/BlockfallInsaneBoard.module.css` | 기존 CSS 베이스, 인세인 UI 스타일 추가 |

### 8-2. 접근 제한 — 어드민 전용 (테스트 기간)

테스트 완료 전까지 어드민 계정만 접근 가능하도록 제한한다.

**라우트 보호 (`App.tsx`)**

`/:game` 동적 라우트보다 앞에 인세인 전용 라우트를 추가한다.  
`AdminRoute`는 `user.role !== 'ADMIN'` 이면 `/`로 리다이렉트하는 기존 컴포넌트를 그대로 사용.

```tsx
// App.tsx — 기존 /:game 라우트 위에 추가
<Route
  path="/blockfall-insane"
  element={
    <AdminRoute>
      <GamePage excel={false} />
    </AdminRoute>
  }
/>
```

동적 라우트(`/:game`)보다 구체적인 경로가 먼저 매칭되므로 App.tsx의 라우트 순서만 지키면 된다.

**진입점 — 홈페이지 실험실(Test Lab) 카드**

홈페이지에 이미 `🧪 Test Lab` 카드가 존재한다 (`HomePage.tsx` 200~210번째 줄).  
이 카드 안에 인세인 모드 버튼을 추가하되, `useAuth`로 어드민 여부를 확인해 **어드민일 때만 버튼을 렌더링**한다.

```tsx
// HomePage.tsx
const { user } = useAuth();

// Test Lab 카드 내부
{user?.role === 'ADMIN' && (
  <Link className={styles.btn} to="/blockfall-insane">
    🔥 블록폴: 인세인 (테스트)
  </Link>
)}
```

비어드민 사용자에게는 Test Lab 카드 자체는 보이지만 버튼이 없어 인세인 모드의 존재를 알기 어렵다.  
추후 정식 오픈 시 이 조건과 `AdminRoute` 래핑을 제거하면 된다.

### 8-3. GamePage.tsx 수정

```ts
GAME_NAMES:    'blockfall-insane' → '블록폴: 인세인'
FILE_TITLES:   'blockfall-insane' → 'blockfall_insane.xlsx'
CELL_SIZES:    'blockfall-insane' → 30
BG_COLORS:     'blockfall-insane' → '#0a0a0a'
ACCENT_COLORS: 'blockfall-insane' → '#ff2d55'
```

---

## 9. 기존 코드와의 관계

| 항목 | 기존 BlockfallBoard | 인세인 BlockfallInsaneBoard |
|---|---|---|
| 보드 상태 | `arena: number[][]` | `arena: number[][]` + `particles: SandParticle[]` |
| 라인 클리어 | arena 행 채워지면 제거 | arena + settled sand 합산 판정 |
| 충돌 판정 | arena 배열 직접 조회 | arena + settled sand 합산 |
| 블록 고정 | arena에 숫자 기록 | 이벤트에 따라 arena 또는 sand 레이어로 분기 |
| 이벤트 | 없음 | 시각/물리/방해 이벤트 시스템 |
| 랭킹 API | `rankingsApi('blockfall')` | `rankingsApi('blockfall-insane')` |
| 점수 기본 체계 | 라인×레벨 | 동일 + 이벤트 보너스 |

공유하는 것: UI 레이아웃, CSS 모듈 베이스, 랭킹 API, 인증/세션, NormalHeader.

---

## 10. 작업 순서

1. **[STEP 1] 페이지 신설 (껍데기)**
   - 파일 생성, GamePage 메타 추가, 홈페이지 카드 추가
   - 기존 블록폴 그대로 동작 확인

2. **[STEP 2] 이중 레이어 엔진 기반**
   - `SandParticle` 타입 정의
   - arena + particles 이중 상태 관리
   - 충돌 판정에 settled sand 포함
   - 라인 클리어에 settled sand 포함
   - sand 없이 기존과 동일하게 동작하는 MVP 완성

3. **[STEP 3] Sand 물리 구현**
   - moving → settled 전환 로직
   - 낙하/확산 시뮬레이션
   - `SAND_BURST` 하나만 붙여서 검증

4. **[STEP 4] 이벤트 프레임워크**
   - `InsaneEvent` 타입, 발동 타이머, 활성 이벤트 관리
   - 이벤트 알림 배너 + 타이머 바 UI

5. **[STEP 5] 이벤트 전체 구현**
   - 시각 → 물리 → 방해 순으로 구현

6. **[STEP 6] 확장 블록 추가**
   - `createInsanePiece()` / `randomInsanePiece()` 작성

7. **[STEP 7] 보드 크기 동적 변경 (선택)**
   - `BOARD_EXPAND` / `BOARD_SHRINK` 이벤트

8. **[STEP 8] 밸런싱 및 마무리**
   - 이벤트 발동 확률 / 간격 튜닝
   - 모바일 터치 확인
   - 엑셀 모드 연동 (이벤트 비활성화 검토)

---

## 11. 구현 시 주의사항

### A. 엔진 핵심 — 절대 혼동하지 말 것

**라인 클리어 판정은 반드시 세 가지를 합산한다**
```
arena[y][x] !== 0
OR settled SandParticle at (x, y)
OR settled ShatterParticle at (x, y)
```
셋 중 하나라도 빠지면 "채웠는데 안 지워짐" 버그가 발생한다.

**충돌 판정(낙하 피스 기준)도 동일하게 settled 파티클 포함**  
moving 파티클은 충돌 판정에서 제외한다. 낙하 중인 모래 위로 피스가 통과해야 자연스럽다.

**moving SandParticle은 라인 클리어 판정에서 절대 제외**  
흘러내리는 도중에 줄이 채워지면 안 된다. 멈춰야(settled) 카운트된다.

---

### B. 파티클 두 종류를 혼동하지 말 것

| | SandParticle | ShatterParticle |
|---|---|---|
| 좌표 | 정수 (셀 단위) | **실수** (서브셀 이동) |
| 속도 | vy만 (아래/대각선) | vx + vy (자유 방향) |
| 벽 반응 | 없음 | **튕김** (vx 반전 + 감쇠) |
| 생성 시점 | 이벤트로 피스 고정 시 | `FLOOR_DROP` 충돌 시만 |
| settled 후 | 라인 클리어 참여 | 동일하게 참여 |

`FLOOR_DROP`은 `ShatterParticle`만 생성한다. `SandParticle`로 구현하면 모래처럼 흘러서 연출이 완전히 달라진다.

---

### C. 라우트 순서 — App.tsx

`/blockfall-insane` 전용 라우트를 반드시 `/:game` 동적 라우트보다 **위에** 선언해야 한다.  
순서가 바뀌면 `/:game`이 먼저 매칭되어 `AdminRoute` 보호가 무력화된다.

```tsx
// ✅ 올바른 순서
<Route path="/blockfall-insane" element={<AdminRoute><GamePage excel={false} /></AdminRoute>} />
<Route path="/:game" element={<GamePage excel={false} />} />

// ❌ 잘못된 순서 — AdminRoute 무시됨
<Route path="/:game" element={<GamePage excel={false} />} />
<Route path="/blockfall-insane" element={<AdminRoute>...</AdminRoute>} />
```

---

### D. 모바일 판정 — 게임 시작 시 1회만

`isMobile`을 게임 루프 내에서 매 프레임 체크하지 않는다.  
컴포넌트 마운트 시 또는 게임 시작 시 1회 판정해 `useRef`에 저장하고, 이벤트 풀 필터링에 사용한다.

```ts
const isMobileRef = useRef(navigator.maxTouchPoints > 0);

// 이벤트 발동 시
const pool = EVENT_POOL.filter(e => !isMobileRef.current || !e.mobileExcluded);
```

모바일 제외 이벤트: `FLIP_H`, `FLIP_V`, `FLOOR_DROP`

---

### E. FULL_SAND 성능 — 일괄 처리 금지

`FULL_SAND` 발동 시 모든 solid를 한 프레임에 moving으로 전환하면  
수백 개 파티클이 동시에 물리 계산을 시작해 프레임 드랍이 발생한다.  
**프레임당 최대 20~30개씩** 순차 전환하거나, settling 시뮬레이션을 배치로 나눠 처리한다.

---

### F. FLOOR_DROP — 보드 크기 변경 후 캔버스 리사이즈

`boardH` 변경 시 `canvas.height`도 같이 업데이트해야 한다.  
단, canvas 크기를 바꾸면 **ctx의 transform이 리셋**된다.  
`ctx.scale(CELL, CELL)` 재적용을 잊지 않는다.

---

### G. 시각 이벤트 — ctx.save() / ctx.restore() 필수

`FLIP_H`, `FLIP_V` 같은 ctx.transform 변환은 반드시 `ctx.save()`로 감싸고  
렌더 후 `ctx.restore()`로 원복한다. 누적 적용되면 이후 모든 렌더가 오염된다.

---

### H. 정식 오픈 시 제거할 코드 목록

테스트 종료 후 아래 항목을 제거하면 공개 전환이 완료된다.

1. `App.tsx` — `/blockfall-insane` 라우트의 `AdminRoute` 래퍼 제거
2. `HomePage.tsx` — Test Lab 카드의 `user?.role === 'ADMIN'` 조건 제거
3. (선택) `GamePage.tsx` — `GAME_NAMES`에 일반 홈페이지 노출용 항목 추가

---

## 12. 미결 사항 → 확정 사항

| 항목 | 결정 내용 |
|---|---|
| 이벤트 발동 간격 (레벨별) | 레벨 1→11로 올라갈수록 간격이 줄어든다. 레벨 11에서는 매 블록 낙하(lock) 시마다 이벤트 발동. 구체 수치: `Math.max(1000, 30000 - (level - 1) * 2600)` ms (레벨1=30s, 레벨11=매회) |
| `FULL_SAND` 발동 레벨 하한선 | 하한선 없음 — 모든 레벨에서 발동 가능. 단, 이벤트 풀 내 가중치를 다른 이벤트의 **절반**으로 설정해 발동 확률을 낮춘다 |
| 엑셀 모드 | **없음** — 인세인 모드는 일반 모드 전용. `GamePage` 분기에서 `excel={false}` 고정 |
| 보드 크기 동적 변경 | **`BOARD_EXPAND`만 채택** (`BOARD_SHRINK` 불채택). 확장 전용으로 난이도 상승 없이 보상성 이벤트로 활용 |
| settled sand 시각 표현 | **구현 안정성 우선** — solid와 동일한 셀 크기로 렌더하되, 색상에 약간의 투명도를 추가해 구분 (`globalAlpha = 0.85`). 별도 텍스처/그림자 없이 단순하게 처리 |
