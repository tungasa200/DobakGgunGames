# Blockfall Insane Mode — Test Plan

작성일: 2026-04-22
작성자: qa-tester
대상 파일: `frontend/src/games/blockfall/BlockfallInsaneBoard.tsx`
상태: 구현 대기 중 — 선행 초안. planner 이벤트 재정의 목록 수신 시 섹션 2 동기화 예정.

---

## 0. 전제 조건 및 방침

- **오디오 테스트 제외**: BGM/오디오는 건드리지 않음. "오디오에 영향 없음 회귀" 항목만 포함.
- **Excel 모드 없음**: 섹션 12 확정 사항 — `excel={false}` 고정. Excel 모드 검증 항목 불필요.
- **어드민 전용 유지**: AdminRoute 접근 제어 회귀 검증 필수.
- **랭킹 분리**: `rankingsApi('blockfall-insane')` vs `rankingsApi('blockfall')` 완전 분리 확인.
- **"밋밋" 체감 해소 기준**: 각 이벤트 발동 시 시각 변화가 즉각적이고 명확하게 느껴질 것. 관찰자(테스터)가 이벤트 발동 여부를 이벤트 배너 없이도 0.5초 내에 인지 가능해야 통과.

---

## 1. 테스트 범위

### 이번 개편으로 영향받는 것

| 영역 | 내용 |
|---|---|
| 연출 강도 | 파티클 수/속도/확산, 화면 흔들림, 색 왜곡, 경고 Flash, 이벤트 배너 임팩트 |
| 샌드 이펙트 | SandParticle moving/settled 전환 속도, 시각 밀도, FULL_SAND 연쇄 |
| 이벤트 18종 동작 | 발동/지속/종료 로직 전체 재검증 |
| 파티클 품질 | ShatterParticle 튕김/감쇠/소멸, motion blur, bounces 에너지 표현 |
| 어드민 접근 | AdminRoute + Test Lab 카드 조건 |
| 랭킹 UI | 전용 랭킹 분리 및 UI 정확도 |

### 영향받지 않는 것

| 영역 | 이유 |
|---|---|
| 오디오/BGM | 영구 제외 방침 — 기존 동작 영향 없음 회귀 1줄만 확인 |
| Excel 모드 | 인세인 모드에 적용 없음 — 검증 불필요 |
| 일반 BlockfallBoard | 별도 컴포넌트 — 공통 모듈 변경 시에만 회귀 범위 포함 |
| 다른 게임(가위바위보 등) | 공통 API/컴포넌트 변경 여부에 따라 회귀 범위 결정 |

### 플랫폼

| 플랫폼 | 우선순위 | 비고 |
|---|---|---|
| 데스크톱 Chrome (최신) | 필수 | 기준 플랫폼 |
| 데스크톱 Edge (최신) | 필수 | Chrome 엔진 기반 |
| 모바일 Chrome Android | 권장 | 모바일 제외 이벤트 미발동 확인 |
| iOS Safari | 가능 시 | `maxTouchPoints` 판정 동작 여부 |

---

## 2. 이벤트별 검증 표 (18종)

강제 발동 방법: `showDebug` 상태 활성화 후 디버그 패널 경유, 또는 `window.__fireInsaneEvent('EVENT_ID')` 훅 노출을 developer-frontend에 요청. 훅 없는 경우 콘솔에서 `fireEvent(EVENT_POOL.find(e => e.id === 'XXX')!)` 직접 호출.

---

### 2-1. FLIP_H (좌우 반전) — Visual / 8초 / 모바일 제외

| 항목 | 내용 |
|---|---|
| 예상 동작 기준 | 캔버스 전체가 좌우 반전 렌더됨. 블록 조작 방향(좌/우 키)은 물리적으로 반전된 화면과 일치하지 않아 혼란 유발. 8초 후 복원. |
| 검증 방법 | 디버그 훅으로 발동 → 좌 키 입력 시 블록이 화면상 오른쪽으로 이동하는지 관찰. ctx.save/restore가 렌더마다 적절히 호출되는지 확인. |
| 통과 기준 | 발동 즉시(1프레임 이내) 반전 렌더 확인. 8초 경과 후 정상 복원. 복원 후 이후 렌더 오염 없음(좌 키 = 화면 왼쪽 이동). |
| 실패 케이스 예시 | ctx.save() 없이 transform 누적 → 이벤트 종료 후에도 반전 유지. 재현: FLIP_H 발동 → 8초 대기 → 블록이 여전히 반전된 방향으로 움직이면 실패. |
| 모바일 검증 | 모바일 기기에서 해당 이벤트가 발동 풀에서 제외되어 발동되지 않음을 20회 이상 게임 플레이로 확인. |

---

### 2-2. FLIP_V (상하 반전) — Visual / 6초 / 모바일 제외

| 항목 | 내용 |
|---|---|
| 예상 동작 기준 | 캔버스 상하 반전 렌더. 블록이 위에서 아래로가 아닌 아래에서 위로 낙하하는 것처럼 보임. 6초 후 복원. |
| 검증 방법 | 디버그 훅 발동 → 화면이 상하 뒤집히는지 시각 확인. 낙하 피스 위치와 실제 게임 로직 좌표의 시각적 불일치 관찰. |
| 통과 기준 | 발동 즉시 상하 반전 확인. 6초 후 복원, 이후 렌더 오염 없음. FLIP_H와 순차 발동 시 각각 독립적으로 복원됨. |
| 실패 케이스 예시 | FLIP_V 종료 후 ctx transform이 복원되지 않아 이후 모든 프레임에서 상하 반전 유지. |
| 모바일 검증 | FLIP_H와 동일 기준으로 모바일 발동 제외 확인. |

---

### 2-3. DARK_SPOTLIGHT (암전) — Visual / 10초 / 모바일 포함

| 항목 | 내용 |
|---|---|
| 예상 동작 기준 | 배경이 거의 완전히 어두워지고(rgba(0,0,0,0.95) 오버레이), 현재 낙하 피스 중심에서 반경 약 6셀 이내만 RadialGradient로 밝게 보임. 10초 후 복원. |
| 검증 방법 | 발동 → 낙하 피스 이동 시 조명이 피스를 따라다니는지 확인. 피스 이동 후 이전 위치가 어두워지고 새 위치가 밝아지는지 관찰(1프레임 이내 추종). |
| 통과 기준 | 조명 밖 블록이 육안으로 식별 불가 수준. 조명이 피스 이동에 1프레임 이내 추종. 10초 후 정상 밝기 완전 복원. |
| 실패 케이스 예시 | 피스가 이동했는데 조명이 이전 위치에 고정됨. 또는 암전이 전혀 적용되지 않아 보드 전체가 보임. |

---

### 2-4. INVISIBLE_PIECE (투명 블록) — Visual / 6초 / 모바일 포함

| 항목 | 내용 |
|---|---|
| 예상 동작 기준 | 현재 낙하 중인 피스만 렌더되지 않음. 기존 arena 블록, settled 파티클은 정상 렌더. 6초 후 복원(다음 피스부터 정상 렌더). |
| 검증 방법 | 발동 → 낙하 피스가 화면에서 사라지는지 확인. 하드드롭 시 피스가 고정된 자리에 visible 상태로 나타나는지 확인. easy 모드의 고스트 피스도 함께 비가시인지 확인. |
| 통과 기준 | 발동 시 피스 렌더 즉시 비가시. 고스트 피스도 비가시(evInvisible 체크 일원화). 6초 후 다음 피스부터 정상 표시. |
| 실패 케이스 예시 | 이벤트 종료 후에도 다음 피스가 투명한 채로 등장. 또는 arena 블록까지 투명해짐. |

---

### 2-5. COLOR_GRAY (색맹 모드) — Visual / 8초 / 모바일 포함

| 항목 | 내용 |
|---|---|
| 예상 동작 기준 | 모든 블록(arena, settled 파티클, moving 파티클, 낙하 피스)이 #EEEEEE 단색으로 렌더됨. drawCell() 내부 evColorGray 분기 적용. 8초 후 원래 색상 복원. |
| 검증 방법 | 발동 → 보드 전체가 회색 단색으로 변하는지 확인. NEXT 캔버스와 HOLD 캔버스도 회색인지 확인(drawCell 공유 여부). |
| 통과 기준 | 발동 즉시 모든 렌더 색상이 #EEEEEE. NEXT/HOLD 포함. 8초 후 원래 색상으로 완전 복원. |
| 실패 케이스 예시 | 낙하 피스만 회색이고 arena 블록은 원래 색상 유지. 또는 이벤트 종료 후에도 일부 파티클이 회색으로 남음. |

---

### 2-6. SAND_BURST (모래 폭발) — Physical / 즉발 / 모바일 포함

| 항목 | 내용 |
|---|---|
| 예상 동작 기준 | 플래그(evSandBurst=true) 설정 후, 다음 피스가 고정되는 순간 해당 피스가 arena에 기록되지 않고 즉시 SandParticle(moving)로 분해되어 낙하 시작. 플래그는 고정 즉시 false로 초기화. |
| 검증 방법 | 디버그 훅으로 발동 → 다음 피스를 하드드롭(Space) → 피스가 arena에 기록되지 않고 모래처럼 흩어지는지 확인. lockPiece / lockPieceImmediate / playerHardDrop 세 경로 모두에서 mergePieceIntoBoard() 헬퍼가 호출되는지 코드 리뷰. |
| 통과 기준 | 고정 시 피스 셀 수만큼 SandParticle(moving) 생성. evSandBurst 즉시 false 초기화. settled 후 라인 클리어 판정 참여. 다음 피스는 정상 solid 고정. |
| 실패 케이스 예시 | playerHardDrop 또는 lockPieceImmediate 경로에서 mergePieceIntoBoard() 대신 mergeInto() 직접 호출 → SAND_BURST 무시되고 solid로 기록됨. 재현: 하드드롭으로만 고정, 일반 낙하 고정과 결과 비교. |

---

### 2-7. FULL_SAND (대혼돈) — Physical / 즉발 / 모바일 포함

| 항목 | 내용 |
|---|---|
| 예상 동작 기준 | 보드 내 모든 solid(arena 블록)가 즉시 SandParticle(moving)로 전환되어 아래로 쏟아짐. arena 전체 0으로 초기화. 재정착 후 연쇄 라인 클리어 가능. |
| 검증 방법 | 보드에 블록을 절반 이상 채운 뒤 디버그 발동 → arena 배열이 전부 0이 되는지 확인(콘솔). 파티클 수가 기존 solid 수와 일치하는지 확인. 파티클이 낙하-재정착하며 연쇄 클리어 발생하는지 관찰. Chrome DevTools Performance로 발동 전후 프레임 타임 측정. |
| 통과 기준 | 발동 직후 arena 전체 0 확인. simulateSand() 배치 처리(SAND_BATCH_SIZE=25)가 물리 계산에 적용됨. 발동 후 5초 이내 FPS 40fps 이상 유지. 재정착 후 하단부터 연쇄 클리어 발생. |
| 실패 케이스 예시 | 전체 파티클이 한 틱에 물리 계산되어 250개 이상 동시 처리로 FPS 급락. 재현: 보드를 가득 채운 뒤 발동, Performance 탭에서 프레임 타임 >25ms가 5프레임 연속이면 실패. |
| 성능 기준 | FULL_SAND 발동 후 5초 이내 FPS 40fps 이상 유지. |

---

### 2-8. LIQUID_FLOOD (모래 홍수) — Physical / 즉발 / 모바일 포함

| 항목 | 내용 |
|---|---|
| 예상 동작 기준 | 보드 상단(y=0)에서 boardW*2개(기본 22개)의 SandParticle(moving)이 무작위 x 위치에 생성되어 아래로 쏟아짐. 쓰레기가 위에서 쌓이는 방해 효과. |
| 검증 방법 | 발동 → 보드 상단에서 새 파티클이 등장해 흘러내리는지 시각 확인. 파티클 수가 boardW*2인지 확인. 색상이 1~7 사이 무작위인지 확인. |
| 통과 기준 | 파티클 생성 위치 y=0 확인. 색상 무작위(1~7). settled 후 라인 클리어 판정 정상 참여. |
| 실패 케이스 예시 | 파티클이 보드 중간에서 생성되거나, 생성 직후 즉시 settled 전환(흘러내리는 연출 없음). |

---

### 2-9. EXPLODE (폭발) — Physical / 즉발 / 모바일 포함

| 항목 | 내용 |
|---|---|
| 예상 동작 기준 | 보드 중하단 랜덤 위치(y: boardH*0.4 ~ boardH*0.8 구간)에서 반경 2(dx²+dy²≤4) 이내 solid가 완전 소멸. 파티클 생성 없이 순수 제거. 폭발 범위 settled 파티클도 제거. recheckSettled() 호출로 지지 잃은 파티클 재낙하. |
| 검증 방법 | 발동 → 보드에서 원형 구멍이 생기는지 확인. 구멍 위 settled 파티클이 다시 낙하하는지 확인(recheckSettled 동작). ShatterParticle 생성 없음 확인(FLOOR_DROP 전용). |
| 통과 기준 | 반경 내 solid 전부 제거. recheckSettled 후 부유 파티클 0개. 구멍이 시각적으로 명확히 식별 가능(검은 공간). 폭발 위치가 매 발동마다 다름(랜덤 동작 확인). |
| 실패 케이스 예시 | 폭발 범위에 settled 파티클이 남아있음. 또는 폭발 위치가 항상 같은 좌표(랜덤 미동작). |

---

### 2-10. VORTEX (소용돌이) — Physical / 8초 / 모바일 포함

| 항목 | 내용 |
|---|---|
| 예상 동작 기준 | 발동 시 보드 내 모든 settled SandParticle이 즉시 moving으로 전환(ShatterParticle 제외). 이후 8초 동안 moving SandParticle에 보드 중심(x=boardW/2) 방향으로 vx 구심력 추가. 파티클이 중심으로 모이는 소용돌이 연출. |
| 검증 방법 | 파티클이 있는 상태에서 발동 → settled SandParticle 전체가 즉시 이동 시작하는지 확인. settled ShatterParticle은 그대로 settled 유지인지 확인. 이동 방향이 보드 중심을 향하는지 관찰. 8초 후 일반 sand 물리 복원. |
| 통과 기준 | 발동 즉시 settled SandParticle 전체 moving 전환(ShatterParticle 제외). 발동 후 2초 내 파티클이 시각적으로 중심 방향 이동 육안 확인. 8초 후 evVortex=false, 파티클이 정상 sand 물리로 전환. |
| 실패 케이스 예시 | fireEvent VORTEX의 `p.type === 'sand'` 조건 누락 시 ShatterParticle도 moving 전환됨. 재현: ShatterParticle(FLOOR_DROP 이후) 있는 상태에서 VORTEX 발동, settled shatter가 날아가면 버그. |

---

### 2-11. BOUNCE_WALLS (탄성 벽) — Physical / 8초 / 모바일 포함

| 항목 | 내용 |
|---|---|
| 예상 동작 기준 | 8초 동안 moving SandParticle이 벽 인근에서 vx 반전(×−0.8 감쇠)으로 튕김. 일반 모래처럼 벽에서 쌓이지 않고 반대 방향으로 이동. |
| 검증 방법 | 발동 후 피스를 고정해 SandParticle 생성 → 파티클이 좌우 벽에서 튕기는지 시각 확인. 감쇠 적용 여부(튕길수록 이동 거리 감소) 관찰. 8초 후 벽에서 정상 쌓임 복원. |
| 통과 기준 | 벽 충돌 시 vx 방향 반전 + 0.8 감쇠 적용 확인. 8초 후 evBounceWalls=false, 파티클이 벽에 쌓임. |
| 실패 케이스 예시 | 파티클이 벽을 통과하거나, 감쇠 없이 무한 왕복. |

---

### 2-12. FLOOR_DROP (바닥 붕괴) — Physical / 즉발 / 모바일 제외

| 항목 | 내용 |
|---|---|
| 예상 동작 기준 | boardH +4. arena 모든 블록이 ShatterParticle(flying, bounces=3)로 전환되어 낙하. 바닥/solid 충돌 시 vy 반전+SHATTER_DAMPING(0.5) 감쇠, vx 랜덤 재부여, bounces 차감. bounces=0 또는 속도 < SHATTER_MIN_SPEED(0.04)이면 settled. canvas.height 업데이트 후 ctx.scale(CELL,CELL) 재적용 필수. |
| 검증 방법 | 발동 → canvas.height = (21+4)*30 = 750px 확인. arena 전체 0 확인. ShatterParticle이 실수 좌표로 이동하며 바닥에서 튀어오르는 motion blur 연출 확인. settled 후 라인 클리어 판정 참여 확인. |
| 통과 기준 | 발동 즉시 canvas.height = 750px. arena 전체 0. ShatterParticle bounces 초기값 3 확인. 바닥 충돌 시 최소 1회 이상 육안으로 튀어오름 확인. 전 과정 FPS 40fps 이상. settled ShatterParticle이 가득 찬 행 제거에 참여. |
| 실패 케이스 예시 | canvas.height 변경 후 ctx.scale(CELL,CELL) 재적용 누락 → 이후 렌더 전혀 안 되거나 극소 크기(1px 셀)로 렌더됨. 재현: FLOOR_DROP 발동 후 피스와 파티클이 캔버스 범위를 벗어나거나 왜곡되면 실패. |
| 모바일 검증 | 모바일에서 이 이벤트가 발동되지 않음을 20회 이상 게임 플레이로 확인. |

---

### 2-13. CONTROL_FREEZE (조작 마비) — Disruptive / 2초 / 모바일 포함

| 항목 | 내용 |
|---|---|
| 예상 동작 기준 | 2초 동안 모든 키 입력(이동, 회전, 하드드롭, 소프트드롭, hold) 무시. 피스는 계속 자동 낙하. 2초 후 즉시 정상 입력 복원. |
| 검증 방법 | 발동 → 좌/우/위(회전)/아래(소프트드롭)/Space(하드드롭)/C(hold) 입력 모두 무시 확인. 2초 후 동일 키 입력 → 정상 반응 확인. 모바일은 터치 입력도 무시 확인. |
| 통과 기준 | 발동 후 모든 입력 무시. 2초 경과 후 첫 키 입력부터 즉시 반응. 2초 이내 피스 자동 낙하 정상 진행(dropCounter 동작). |
| 실패 케이스 예시 | 2초 후에도 입력이 잠겨있거나, 자동 낙하도 함께 멈추는 경우. |

---

### 2-14. PIECE_SHATTER (블록 분해) — Disruptive / 즉발 / 모바일 포함

| 항목 | 내용 |
|---|---|
| 예상 동작 기준 | 현재 낙하 중인 피스가 즉시 SandParticle(moving)로 분해. 피스는 arena에 기록되지 않음. playerReset() 호출로 즉시 새 피스 등장. |
| 검증 방법 | 발동 → 낙하 피스가 모래로 흩어지고 새 피스가 즉시 스폰되는지 확인. 분해 전 피스 셀 수 = 생성 SandParticle 수 확인. arena에 분해 흔적 없음 확인. |
| 통과 기준 | 발동 즉시 낙하 피스 소멸, SandParticle 생성. 새 피스 1프레임 이내 스폰. arena에 분해된 피스 흔적 없음. |
| 실패 케이스 예시 | 분해 후 playerReset() 미호출 → 새 피스가 등장하지 않아 게임이 멈춤. 또는 arena에 분해된 피스가 solid로 기록됨. |

---

### 2-15. RANDOM_LOCK (강제 고정) — Disruptive / 즉발 / 모바일 포함

| 항목 | 내용 |
|---|---|
| 예상 동작 기준 | 현재 낙하 피스를 현재 위치에서 즉시 강제 고정(lockPieceImmediate). 이후 새 피스 즉시 스폰. |
| 검증 방법 | 피스가 보드 중간에 있을 때 발동 → 피스가 낙하를 멈추고 현재 위치에서 고정되는지 확인. |
| 통과 기준 | 고정 위치가 발동 시점의 피스 좌표와 정확히 일치. 이후 새 피스 즉시 스폰. 라인 클리어 판정 정상 수행. |
| 실패 케이스 예시 | 강제 고정 위치가 발동 시점보다 1칸 아래로 이동 후 고정됨(lockPieceImmediate vs lockPiece 혼용 또는 추가 낙하 발생). |

---

### 2-16. BOARD_TILT (기울기) — Disruptive / 6초 / 모바일 포함

| 항목 | 내용 |
|---|---|
| 예상 동작 기준 | 발동 시 모든 settled SandParticle과 settled ShatterParticle이 즉시 moving으로 전환되고 무작위 방향(좌 또는 우)으로 vx 부여. 전체가 한쪽으로 쏠리는 연출. |
| 검증 방법 | 발동 → 파티클이 한 방향으로 이동하는지 확인. 6초 동안 지속 여부 관찰. |
| 통과 기준 | 발동 즉시 settled 파티클 전체(sand+shatter) moving 전환. 이동 방향이 좌 또는 우로 일관됨. |
| 실패 케이스 예시 | **알려진 이슈**: BOARD_TILT는 첫 발동 시 1회 settled→moving 전환만 발생하고, 이후 6초 동안 지속적인 기울기 힘 없음(작업계획 섹션 0 명시). 재현: 발동 후 2초 대기, 파티클이 계속 한쪽으로 쏠리지 않고 단순 낙하하면 알려진 이슈 재현됨. planner PRD 섹션 6에서 재구현 스펙 확정 — 6초 내내 지속 vx 증분 + settled 재검사 적용 필수. |

---

### 2-17. SPIN_BLOCK (자동 회전) — Disruptive / 피스 낙하 종료까지 / 모바일 포함

| 항목 | 내용 |
|---|---|
| 예상 동작 기준 | 현재 낙하 피스가 300ms마다 자동으로 시계 방향 회전. 피스가 고정되면 즉시 evSpinBlock=false, clearActiveEvent() 호출. |
| 검증 방법 | 발동 → 피스가 300ms 간격으로 자동 회전하는지 확인. 피스 고정(lock) 즉시 SPIN_BLOCK 해제, 다음 피스는 자동 회전 없는지 확인. |
| 통과 기준 | 발동 후 300ms 이내 첫 회전 발생. 피스 고정 즉시 evSpinBlock=false, activeEventId=null. 다음 피스는 자동 회전 없음. |
| 실패 케이스 예시 | **알려진 이슈**: SPIN_BLOCK 발동 중 다른 지속형 이벤트(예: DARK_SPOTLIGHT) 발동 시 clearActiveEvent() 없이 activeEventId가 덮여 씌워져 SPIN_BLOCK 플래그가 영구 유지될 수 있음. 재현: SPIN_BLOCK 발동 → 즉시 DARK_SPOTLIGHT 강제 발동 → 피스 고정 후에도 다음 피스가 자동 회전하면 버그. |

---

### 2-18. BOARD_EXPAND (보드 확장) — Physical / 즉발 / 모바일 포함

| 항목 | 내용 |
|---|---|
| 예상 동작 기준 | boardW +2(좌우 각 1칸). arena 행마다 앞/뒤 0 삽입. 기존 파티클 x+1, 현재 피스 pos.x+1. canvas.width 업데이트 후 ctx.scale(CELL,CELL) 재적용 필수. |
| 검증 방법 | 발동 → canvas.width = (11+2)*30 = 390px 증가 확인. 파티클이 위치 보존(시각적으로 제자리)인지 확인. 이후 블록이 확장된 좌우 영역까지 이동 가능한지 확인. 재발동 시 boardW=15 확인. |
| 통과 기준 | boardW.current = 13. canvas.width = 390. ctx scale 재적용(이후 렌더 정상). 기존 파티클 위치 시각적으로 보존(1칸 오른쪽 이동이 아닌 제자리 유지). |
| 실패 케이스 예시 | canvas.width 변경 후 ctx.scale 미적용 → 이후 렌더가 극소 크기(1px 셀)로 렌더됨. 또는 모바일에서 확장된 canvas가 CSS 220px 고정 너비와 충돌하여 오른쪽 부분이 잘림(섹션 8-3에서 별도 검증). |

---

## 3. 광기 연출 검증

### 3-1. 화면 흔들림 (Screen Shake)

planner PRD 섹션 5-1 / designer 명세 섹션 2 기준. 현재 미구현 → 신규 구현 필수. canvas ctx.translate 방식 권장.

| 항목 | 내용 |
|---|---|
| 예상 동작 기준 | EXPLODE, FLOOR_DROP, FULL_SAND 등 충격성 이벤트 발동 시 캔버스가 짧게 흔들림(X/Y translate 진동). 강도는 이벤트별로 차등: 약(4px,200ms) / 중(8px,300ms) / 강(12px,500ms) / 최대(15px,800ms). |
| 검증 방법 | 각 충격 이벤트 발동 → 캔버스 흔들림을 DevTools Performance 또는 육안으로 확인. triggerShake(ampPx, durationMs) 함수 호출 여부 코드 확인. |
| 통과 기준 | EXPLODE: ±14px 600ms, FLOOR_DROP 충돌: ±18px 800ms, FULL_SAND: ±10~15px 500~800ms, RANDOM_LOCK: ±7px 300ms, 4라인 클리어: ±12px 500ms. 흔들림 종료 후 offset 원점 복원(잔류 없음). |
| 실패 케이스 예시 | 흔들림이 없어 EXPLODE가 시각적으로 "그냥 구멍만 생기는" 수준 → "밋밋" 체감 재현. 흔들림이 canvas 외부(모바일 버튼 등)까지 영향 → CSS transform 오용. |

### 3-2. 색 왜곡 / 글리치 Flash

planner PRD 섹션 5-2 / designer 명세 섹션 3 기준. canvas 요소 style.filter 인라인 적용 방식.

| 항목 | 내용 |
|---|---|
| 예상 동작 기준 | 이벤트별 CSS filter 적용. 지속형: 지속시간 유지. 즉발: 지정 시간 후 fade 제거. |
| 검증 방법 | 각 이벤트 발동 → canvas 요소 style.filter 값을 DevTools Elements 패널로 확인. |
| 통과 기준 | EXPLODE: `hue-rotate(90deg) contrast(1.5) brightness(1.2)` 300ms. FLOOR_DROP 충돌: `hue-rotate(180deg) contrast(1.4) saturate(1.8)` 400ms. VORTEX 8초: `hue-rotate(-30deg) saturate(1.5)`. COLOR_GRAY: `grayscale(1)` 상시. BOARD_TILT 6초: `hue-rotate(45deg) contrast(1.2)`. 종료 후 `none` 또는 다음 활성 이벤트 filter로 복귀. |
| 실패 케이스 예시 | COLOR_GRAY 활성 중 다른 즉발 이벤트가 filter를 덮어 씀 → grayscale 유지 실패. |

### 3-3. 경고 Flash (Pre-event Warning)

planner PRD 섹션 5-3 / designer 명세 섹션 4 기준. HIGH/LOW 등급 분리.

| 항목 | 내용 |
|---|---|
| 예상 동작 기준 | HIGH(EXPLODE, FLOOR_DROP, FULL_SAND, CONTROL_FREEZE): 발동 -350ms 테두리 fade in + 발동 순간 흰 배경 100ms shift. LOW(RANDOM_LOCK 포함 나머지 예고 대상): 발동 -200ms 테두리만 fade in. |
| 검증 방법 | 이벤트 발동 직전 350ms 구간을 스로우모션 스크린레코딩으로 확인. flashOverlayRef div의 box-shadow 변화 확인. |
| 통과 기준 | 발동 전 적색 테두리 등장 → 발동 순간 이벤트 시작 → 테두리 fade out. HIGH 등급은 추가로 흰 배경 100ms 적용. |
| 실패 케이스 예시 | 경고 없이 이벤트가 곧바로 발동되어 플레이어가 당황. |

### 3-4. 이벤트 배너 임팩트

planner PRD 섹션 5-4 / designer 명세 섹션 5 기준.

| 항목 | 내용 |
|---|---|
| 예상 동작 기준 | 배너가 canvas 위 position: absolute 오버레이로 등장. font-size: clamp(1.6rem, 5vw, 2.4rem), 카테고리별 색상, 0.45s 확대-skew-바운스 등장, ::after 글리치 0.3s, 1800ms 표시 후 0.4s fade out. |
| 검증 방법 | 각 카테고리별 이벤트 발동 → 배너 색상 확인. visual=#67e8f9, physical=#ff9f0a, disruptive=#ff375f. 키프레임 애니메이션 실제 재생 확인. |
| 통과 기준 | 배너 0.5초 이내 등장. 글리치 효과 육안 확인. 1800+400 = 2200ms 후 완전 소멸. 캔버스 플레이 영역 일부만 덮음(전체 가리지 않음). |
| 실패 케이스 예시 | 배너가 게임 영역 전체 덮음. 또는 sticky하게 남음. 카테고리별 색 구분 없음. |

---

## 4. 파티클 품질 검증

### 4-1. SandParticle 개수·속도·확산

| 항목 | 기준 |
|---|---|
| 개수 확인 | SAND_BURST: 피스 셀 수(1~8개). LIQUID_FLOOD: boardW*6(66개, planner 상향). FULL_SAND: arena 전체 solid 수. |
| 낙하 속도 | SAND_TICK_INTERVAL=45ms당 1셀씩 낙하(60→45 상향). SAND_BATCH_SIZE=35(25→35). |
| 초기 분산 | SAND_BURST/PIECE_SHATTER 생성 시 초기 vx -1.5~+1.5, vy -0.8~0 부여. 폭발감 존재. |
| 확산 범위 | 아래가 막히면 좌하/우하 대각선 이동. FULL_SAND 후 3초 내 보드 하단 60% 이상 분포. |
| alpha | moving 0.75, settled 0.90 (0.6/0.85에서 상향). |
| 통과 기준 | 파티클이 단순 수직 낙하가 아닌 좌우 폭발감 있는 확산. 모래 밀도 체감. |
| 실패 케이스 예시 | 초기 vx=0으로 직선 낙하만 — "밋밋" 체감 원인. |

### 4-2. FULL_SAND 대량 settling 성능

| 항목 | 기준 |
|---|---|
| 목표 FPS | 60fps |
| 허용 하한 | 40fps (250개 파티클 이동 구간) |
| 측정 방법 | Chrome DevTools → Performance 탭 → FULL_SAND 발동 구간 Recording → 프레임 타임 분포 확인. 16.7ms 초과 프레임이 5연속 이상이면 경고, 25ms 초과가 5연속 이상이면 실패. |
| 전환 연출 | planner PRD 섹션 3-2: 프레임당 1줄씩 위→아래로 쓸려내리는 분할 전환. 한 프레임 일괄 전환 금지. |

### 4-3. ShatterParticle 튕김/감쇠/소멸 (FLOOR_DROP 전용)

| 항목 | 기준 |
|---|---|
| bounces 초기값 | 3 → 5 (planner 상향) |
| 튕김 연출 | 바닥 충돌 후 최소 1회 이상 육안으로 높이 튀어오름. vy 반전 + SHATTER_DAMPING=0.60 감쇠(0.50→0.60 완화). |
| 감쇠 | bounces 소진 또는 속도 < SHATTER_MIN_SPEED(0.03, 0.04→0.03 하향) 시 settled. |
| SHATTER_GRAVITY | 0.06 → 0.08 |
| 초기 vy | 0.1 → 0.5 |
| motion blur | 속도 크면 잔상 렌더. 잔상 거리 vx*1.5→vx*2.5, alpha 0.25→0.35. |
| 에너지 표현 | `0.7 + (bounces/5)*0.3`. bounces=5 → alpha 1.0, bounces=0 → 0.7. |
| settled 후 | 라인 클리어 판정 참여. isRowFull()에서 hasSettledAt() 확인. |
| 실패 케이스 예시 | 파티클 즉시 settled(튕김 없음). 또는 무한 튕김(감쇠 미동작). |

---

## 5. 기본 동작/규칙 회귀

### 5-1. 낙하 속도 DROP_SPEEDS['hard'] 레벨별 적용

| 레벨 | hard 속도(ms) | 검증 방법 |
|---|---|---|
| 1 | 180 | 게임 시작 → 낙하 간격 180ms 시각 확인 |
| 3 | 125 | 라인 20개 클리어 후(레벨3) → 낙하 간격 빨라짐 확인 |
| 5 | 88 | 라인 40개 클리어 후(레벨5) → 확연히 빠름 |
| 11 | 32 | 라인 100개 클리어 후(레벨11) → 거의 즉시 낙하 |

통과 기준: `dropInterval.current = DROP_SPEEDS['hard'][gameLevel-1]` 값과 실측 낙하 간격 ±20ms 이내.

### 5-2. 난이도 선택 UI 제거 확인

planner PRD 섹션 2-1: 난이도 UI 완전 제거 확정.

| 항목 | 기준 |
|---|---|
| 검증 방법 | `/blockfall-insane` 접속 → 게임 시작 화면에서 난이도 선택 UI 요소 유무 확인. DevTools Elements로 hidden 상태도 확인. 코드에서 difficulty state / LEVELS 배열 / handleDifficultyChange / .diffRow 전부 제거 확인. |
| 통과 기준 | 난이도 선택 UI 완전 미노출. 코드에서 관련 식별자 잔존 없음. 랭킹 탭도 단일 INSANE (쉬움/보통/어려움 탭 3개 아님). |
| 실패 케이스 예시 | UI에서 난이도를 선택할 수 있거나 코드에 difficulty 관련 식별자가 잔존함. |

### 5-3. 라인 클리어 판정 정확도

| 시나리오 | 판정 조건 | 기대 결과 |
|---|---|---|
| arena만 가득 찬 행 | arena 블록으로만 boardW 전체 채워짐 | 클리어 |
| sand settled로만 가득 찬 행 | SandParticle settled로만 채워짐 | 클리어 |
| shatter settled로만 가득 찬 행 | ShatterParticle settled로만 채워짐 | 클리어 |
| arena + sand 혼합으로 가득 찬 행 | 두 종류 합산으로 boardW 전체 채워짐 | 클리어 |
| moving 파티클 포함 행 | 일부 셀이 moving/flying 파티클로 점유 | 클리어 안 됨 |
| 1개 이상 빈 셀 있는 행 | 한 셀이라도 비어있음 | 클리어 안 됨 |

검증 방법: SAND_BURST/LIQUID_FLOOD 이벤트로 파티클 생성 후 수동으로 행을 채워서 각 시나리오 확인.

### 5-4. 이벤트 클리어 보너스 2배

| 항목 | 기준 |
|---|---|
| 조건 | activeEventId.current !== null 상태에서 라인 클리어 발생 |
| 검증 방법 | 지속형 이벤트(DARK_SPOTLIGHT 등) 활성 중 라인 클리어 → 점수가 기본 값의 2배인지 확인 |
| 통과 기준 | arenaSweepInsane(tspin, eventActive=true) 경우 baseScore * 2. 즉발 이벤트 후(activeEventId=null)는 1배. |

### 5-5. 레벨 11 매 lock 이벤트 발동 가드

planner PRD 섹션 8-2: `activeEventId.current && duration > 0`이면 레벨 11에서도 즉발 이벤트 스킵 권장.

| 항목 | 기준 |
|---|---|
| 검증 방법 | 레벨 11 도달 후 → 지속형 이벤트 활성 중 피스 고정 시 즉발 이벤트 중첩 발동 여부 확인 |
| 통과 기준 | 지속형 활성 중 즉발 이벤트 스킵. 지속형 없을 때는 매 lock 발동. |

### 5-6. 일반 BlockfallBoard 영향 없음

| 항목 | 기준 |
|---|---|
| 검증 방법 | `/blockfall` 접속 → 게임 시작 → 정상 플레이 확인. 점수 계산, 라인 클리어, 랭킹 등록이 인세인 모드 변경 전과 동일. |
| 통과 기준 | BlockfallBoard에서 SandParticle, InsaneEvent 관련 코드 미실행. 콘솔 오류 없음. 랭킹 API 요청이 `'blockfall'` ID 사용. |

### 5-7. 오디오 영향 없음 회귀

오디오 관련 코드 변경 없음. BGM/효과음이 인세인 모드 개편 전과 동일하게 동작(음소거/재생 토글 포함). 이 이상의 오디오 테스트는 수행하지 않음.

---

## 6. 랭킹 분리 검증

### 6-1. 인세인 기록과 일반 블록폴 기록 교차 오염 없음

| 시나리오 | 검증 방법 | 통과 기준 |
|---|---|---|
| 인세인 기록 등록 후 일반 랭킹 확인 | `/blockfall-insane`에서 점수 등록 → `/blockfall` 랭킹 목록 확인 | 인세인 기록 미표시 |
| 일반 기록 등록 후 인세인 랭킹 확인 | `/blockfall`에서 점수 등록 → 인세인 랭킹 목록 확인 | 일반 기록 미표시 |

### 6-2. 전용 랭킹 UI 정확도

designer 명세 섹션 7 기준.

| 항목 | 기준 |
|---|---|
| 점수 정렬 | 높은 점수 순 내림차순 |
| 본인 강조 | .rankRowMine 클래스 적용, 붉은 left border + "(나)" 접미. id 기반 우선 매칭, name 폴백. |
| 1/2/3위 차등 | 1위=금색(#ffd60a), 2위=은색(#c0c0c0), 3위=동색(#cd7f32) + 각각 bold/text-shadow |
| 타이틀 | "INSANE RANK" 4초 주기 글리치 애니메이션 |
| 헤더 | linear-gradient(90deg, #ff2d55, #ff9f0a) |
| 역대 1위 배너 | 금색 테두리 + 금색 글로우 (rgba(255,214,10,0.5)) |
| 슬라이드 인 | 각 행 40ms stagger, 총 700ms 내 완료 |
| 갱신 | 점수 등록 후 랭킹 목록이 재조회되어 최신 순위 반영 |
| 난이도 탭 | 제거됨 (단일 INSANE 랭킹) |

### 6-3. rankingsApi('blockfall-insane') 네트워크 확인

| 항목 | 기준 |
|---|---|
| 엔드포인트 | GET/POST 요청 URL에 `blockfall-insane` 게임 ID 포함 |
| 확인 방법 | Chrome DevTools Network 탭 → 랭킹 조회/등록 요청 URL 확인 |
| 통과 기준 | URL에 `blockfall-insane` 포함. `blockfall` 단독 ID로 요청되지 않음. level 필드는 `'hard'` 고정. |

### 6-4. HMAC/세션 보안

| 시나리오 | 검증 방법 | 통과 기준 |
|---|---|---|
| 유효하지 않은 세션으로 점수 등록 | sessionId 없이 또는 만료된 세션으로 등록 요청 | 4xx 오류 반환, 등록 실패 |
| 비어드민 사용자 직접 API 호출 | 비어드민 계정으로 `blockfall-insane` 점수 등록 API 직접 호출 | 403 반환 또는 세션 발급 자체가 불가 |

---

## 7. 어드민 접근 회귀

### 7-1. 비어드민 사용자 접근 차단

| 시나리오 | 검증 방법 | 통과 기준 |
|---|---|---|
| 일반 유저 `/blockfall-insane` 직접 접속 | 비어드민 계정으로 URL 직접 입력 | `/`(홈)으로 리다이렉트 |
| 로그아웃 상태에서 `/blockfall-insane` 접속 | 로그아웃 후 URL 직접 입력 | `/` 또는 로그인 페이지로 리다이렉트 |

### 7-2. 라우트 선언 순서 검증

| 항목 | 기준 |
|---|---|
| 검증 방법 | `App.tsx`에서 `/blockfall-insane` 라우트가 `/:game` 동적 라우트보다 위에 선언되어 있는지 코드 확인 |
| 통과 기준 | 코드 리뷰에서 선언 순서 정상 확인. 비어드민 직접 접속 시 AdminRoute가 실제로 가로채는지 동작 확인. |
| 실패 케이스 예시 | `/:game`이 먼저 선언된 경우 → `/blockfall-insane`이 동적 게임 페이지로 열리며 AdminRoute 보호 무력화. |

### 7-3. Test Lab 카드 어드민 조건

| 시나리오 | 검증 방법 | 통과 기준 |
|---|---|---|
| 비어드민 홈페이지 | 비어드민 계정으로 홈 접속 | Test Lab 카드는 보이나 "블록폴: 인세인" 버튼 미표시 |
| 어드민 홈페이지 | 어드민 계정으로 홈 접속 | "블록폴: 인세인 (테스트)" 버튼 표시 |
| 미로그인 홈페이지 | 로그아웃 후 홈 접속 | 버튼 미표시(user = null) |

---

## 8. 모바일 시나리오

### 8-1. 모바일 제외 이벤트 발동 풀 미포함 확인

| 이벤트 | 제외 여부 | 검증 방법 |
|---|---|---|
| FLIP_H | 제외 | 모바일(maxTouchPoints > 0) 환경에서 30회 이상 게임 플레이 → 발동 없음 확인 |
| FLIP_V | 제외 | 동일 |
| FLOOR_DROP | 제외 | 동일 |
| DARK_SPOTLIGHT | 포함 | 모바일에서 발동 가능해야 함 |
| 그 외 15종 | 포함 | 모바일에서 발동 가능 |

`isMobileRef.current = navigator.maxTouchPoints > 0` — 컴포넌트 마운트 시 1회 설정. 데스크톱(maxTouchPoints=0)에서는 세 이벤트 모두 발동 가능해야 함.

### 8-2. 터치 컨트롤 회귀

| 항목 | 기준 |
|---|---|
| 좌우 이동 | 터치 스와이프 또는 화면 버튼 정상 동작 |
| 회전 | 탭/버튼 정상 동작 |
| 하드드롭 | 스와이프 다운 또는 버튼 정상 동작 |
| 소프트드롭 | 아래 방향 버튼 정상 동작 |
| CONTROL_FREEZE 중 터치 | 터치 입력도 무시되는지 확인 |
| SPIN_BLOCK 중 좌우 이동 | 좌우 터치만 가능, 자동 회전 중 충돌 없음 |

### 8-3. BOARD_EXPAND 후 모바일 캔버스 충돌

| 항목 | 기준 |
|---|---|
| 문제 상황 | BOARD_EXPAND 발동 시 canvas.width = 390px. 모바일 CSS 고정 너비 220px과 충돌 가능(작업계획 섹션 0 알려진 이슈). |
| 검증 방법 | 모바일 기기 또는 DevTools 모바일 에뮬레이터(너비 390px 미만)에서 BOARD_EXPAND 발동 → 캔버스 잘림/가로 스크롤 발생 여부 확인. |
| 통과 기준 | 캔버스가 잘리지 않거나 CSS가 동적으로 조정되어 전체 캔버스가 화면에 보임. 확장된 영역까지 터치 조작 가능. |
| 실패 케이스 예시 | canvas 오른쪽 1~2칸이 잘려서 블록이 화면 밖으로 나감. 또는 전체 화면이 가로 스크롤 가능한 상태가 됨. |

---

## 9. 성능 기준

| 시나리오 | 목표 FPS | 허용 하한 | 측정 방법 |
|---|---|---|---|
| 일반 플레이 (이벤트 없음) | 60fps | 50fps | Chrome DevTools Performance → 프레임 타임 ≤ 20ms |
| FULL_SAND 발동 직후 5초 | 60fps | 40fps | 발동 순간부터 5초 Recording → 평균 프레임 타임 ≤ 25ms |
| FLOOR_DROP ShatterParticle 최대 활성 | 60fps | 40fps | ShatterParticle 최대 개수(boardW*boardH ≈ 231개) flying 상태에서 측정 |
| EXPLODE 연쇄 3회 | 60fps | 50fps | 빠른 연속 발동 시 recheckSettled 오버헤드 없음 확인 |
| BOARD_EXPAND 누적 2회 (boardW=15) | 60fps | 45fps | boardW=15 상태에서 FULL_SAND 발동 조합 측정 |
| VORTEX 8초 전체 | 60fps | 50fps | 파티클 전체 이동 구간 Recording |

측정 도구: Chrome DevTools Performance 탭 → Frame rendering info 활성화 → 30초 Recording. 프레임 타임이 허용 하한 초과 5프레임 연속 시 developer-frontend에 버그 리포트 작성.

---

## 10. Lint/Build 게이트

### 10-1. ESLint 검증

```
cd frontend && npm run lint
```

통과 기준: 오류(error) 0개. 경고(warn)는 기존 대비 증가 없음.
확인 항목: unused variable, any 타입 사용, React hooks 의존성 누락(useCallback deps).

### 10-2. TypeScript + Vite Build 검증

```
cd frontend && npm run build
```

통과 기준: `tsc -b` 타입 오류 0개, `vite build` 성공(exit code 0).
확인 항목: Particle union 타입(SandParticle | ShatterParticle) 분기 처리 누락, 타입 단언(`!`) 오남용.

---

## 부록 A. 회귀 체크리스트 (공통 모듈 영향도)

이번 개편 변경 파일 범위: `BlockfallInsaneBoard.tsx`, `BlockfallInsaneBoard.module.css`. 공통 모듈(`rankingsApi`, `AuthContext`, `AdminRoute`, `GamePage`) 변경 없음으로 간주. 단, 개편 과정에서 공통 모듈이 수정된 경우 아래 게임 smoke test 전체 실행:

| 게임 | Smoke Test |
|---|---|
| 블록폴 (일반) | 시작 → 라인 클리어 → 점수 등록 → 랭킹 조회 |
| 가위바위보 (어드민 전용) | 어드민 접속 → 게임 플레이 → 결과 확인 |
| (기타 등록된 게임) | 시작 → 기본 플레이 → 결과 확인 |

---

## 부록 B. planner PRD 정합성 반영 (2026-04-22 업데이트)

planner `docs/specs/blockfall-insane-overhaul.md` 확정본 기준 본 테스트 플랜 동기화 완료:

- **난이도 UI 제거**: 섹션 5-2에 명시적 검증 항목 추가 ✅
- **hard 고정 낙하 속도**: 섹션 5-1 레벨별 실측 기준 ✅
- **Screen Shake**: 섹션 3-1에 구현 필수 + 등급별 수치 반영 ✅
- **색 왜곡**: 섹션 3-2에 이벤트별 CSS filter 값 반영 ✅
- **경고 Flash**: 섹션 3-3에 HIGH/LOW 등급 분리 반영 ✅
- **BOARD_TILT 재구현**: 섹션 2-16에 지속 vx 증분 + settled 재검사 검증 추가 ✅
- **파티클 상향**: 섹션 4-1/4-3에 planner/designer 수치 반영 (SAND_TICK_INTERVAL 45, BATCH 35, alpha 0.75/0.90, bounces 5, damping 0.60 등) ✅
- **LIQUID_FLOOD 상향**: 섹션 2-8/4-1 — boardW*2 → boardW*6 (44~66개) ✅
- **이벤트 가중치 조정**: FULL_SAND 0.5→0.4, BOARD_EXPAND 0.7→0.5, FLIP_H/V 1→1.2 (섹션 2 배너 빈도 모니터링 기준) ✅
- **전용 랭킹 UI**: 섹션 6-2 designer 명세 기준 상세 검증 항목 반영 ✅
- **오디오 영구 제외**: 섹션 5-7 유지 ✅

---

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-22 | 초안 작성 + planner PRD 확정본 반영 동기화 완료 |
| (예정) | developer-frontend 구현 완료 후 실제 테스트 케이스 실행 결과 반영 |
