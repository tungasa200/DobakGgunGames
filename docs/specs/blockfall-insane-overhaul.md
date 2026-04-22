# Blockfall Insane Mode — 개편 PRD

> 작성일: 2026-04-22
> 작성자: planner
> 상태: 확정 (designer / developer-frontend / qa-tester 착수 가능)
> 이전 문서와의 관계: `docs/블록폴 인세인모드(Insane mode) 작업계획.md`는 **초기 구축 계획**이고, 본 PRD는 **전면 개편 스펙**이다. 두 문서가 상충하는 경우 **본 PRD가 우선**한다.

---

## 1. 배경 & 목표

### 1-1. 배경

`BlockfallInsaneBoard`는 STEP 1~6이 모두 구현 완료 상태이나, 실제 플레이 체감이 "평범한 테트리스에 가끔 이벤트가 뜨는 정도"로 **광기(Insane)가 부족**하다. 이벤트 효과의 상당수가 코드상으로는 동작하나 화면에서 체감되지 않거나, 일회성에 그쳐 지속 압박이 없다. 전용 랭킹이 백엔드에 분리되어 있음에도 UI는 여전히 일반 블록폴과 구분되지 않는다.

### 1-2. 개편 목표 — "광기 체감 수위의 재정의"

본 개편은 새 이벤트 추가가 목적이 아니라, **이미 있는 17개 이벤트가 화면에서 강하게 체감되도록 만드는 것**이 핵심이다. 사용자 지시에 따라 연출 강도는 **최대치**로 설정한다.

**"최대치"의 조작적 정의 (measurable)**
- 이벤트가 발동하면 **화면 전체가 흔들린다**(camera shake) — 최소 6~12px 진폭, 300~600ms.
- 이벤트마다 **색 왜곡 필터**가 즉시 걸리고 (hue-rotate / invert / saturate / contrast), 지속형 이벤트는 지속시간 내내 유지.
- 이벤트 발동 **직전 200~400ms** 화면에 경고 Flash (흰색 또는 적색 점멸) + 저진폭 떨림으로 예고.
- 배너는 기존의 "작은 문구"가 아니라 **화면 폭의 70%를 덮는 대형 배너**로 교체, 0.6s 확대-축소 애니메이션 + 글리치 효과.
- 파티클 개수 / 속도 / motion blur 잔상 길이를 모두 **1.5~2배 상향**.
- 라인 클리어 시에도 동일 계열의 Flash가 발생 (이벤트 활성 중이면 더 강하게).

이 기준을 충족해야 "광기 최대치"라고 본다.

---

## 2. 확정 스펙

### 2-1. 난이도 선택 UI 제거, 낙하 속도 고정

- 기존 난이도 3단 선택(쉬움/보통/어려움)을 **제거**한다.
- 인세인 모드는 **기본 `hard` 고정**: `DROP_SPEEDS['hard'] = [180, 150, 125, 105, 88, 74, 63, 53, 45, 38, 32]`. 레벨 인덱스(1~11)별 낙하 간격(ms)은 그대로 사용한다.
- UI 영향:
  - `difficulty` 상태 / `LEVELS` 배열 / `handleDifficultyChange` / `.diffRow` 전체 제거.
  - 랭킹 탭도 단일(INSANE 전용) — 쉬움/보통/어려움 탭 3개가 아닌 **단일 랭킹 테이블**.
  - 랭킹 제출 시 `level` 필드는 `'hard'` 고정값으로 송신 (백엔드 호환 유지).
- 주간/역대 랭킹 호출도 `'hard'` 하나만 로드: `rankingsApi.getWeekly('blockfall-insane', 'hard')`, `getAlltimeBest('blockfall-insane', 'hard')`.

### 2-2. BGM / 오디오

- **이번 개편에서 오디오 파일·오디오 시스템을 전혀 건드리지 않는다.**
- **앞으로도 영구적으로 인세인 모드에 BGM / SFX / 오디오 변조를 추가하지 않는다.** 신규 요청이 와도 이 PRD가 "영구 제외"를 근거로 반려 근거가 된다.
- 이유: 사용자 확정 방침.

### 2-3. 접근 제어

- `/blockfall-insane` AdminRoute 래퍼 **유지**.
- `HomePage.tsx` Test Lab 카드의 `user?.role === 'ADMIN'` 조건 **유지**.
- 정식 공개는 별도 지시가 있을 때만 진행. 본 개편에서는 제외.

### 2-4. 모드 적용 범위

- **일반 모드 전용.**
- Excel 모드는 인세인에 적용하지 않는다 (기존 작업계획 섹션 12에서 이미 확정된 방침 유지).

---

## 3. 이벤트 재정의 표 — 17개 이벤트 진단 & 액션

각 항목에 대해 **현재 상태(파일:라인 근거)** + **분류(유지/수치강화/재구현/제거)** + **새 동작 기대치**를 명시한다.

### 3-1. 시각 이벤트 (Visual)

| ID | 현재 상태 | 분류 | 새 동작 기대치 |
|---|---|---|---|
| `FLIP_H` | 정상 작동 — `ctx.translate(bw,0); ctx.scale(-1,1)` (BlockfallInsaneBoard.tsx:899~901). 단순히 반전만 됨. | **수치강화 + 연출보강** | 발동 시 좌우 반전 애니메이션(0.3s easeInOut)으로 **뒤집는 모션** 노출. 색 필터 `hue-rotate(180deg)`를 지속시간 동안 상시 적용. 카메라 shake 강(12px, 500ms). |
| `FLIP_V` | 정상 작동 — `ctx.translate(0,bh); ctx.scale(1,-1)` (:903~905). | **수치강화 + 연출보강** | 상하 반전 애니메이션. 필터 `invert(1)` 또는 `contrast(1.5)` 적용. shake 강. |
| `DARK_SPOTLIGHT` | **작동하지만 미약** — `createRadialGradient(px,py,1.5,px,py,6)` (:977)로 반경 6셀 시각화. 어둠 알파 0.95이나 **반경이 넓어** 플레이어가 보드 대부분을 볼 수 있음. | **수치강화** | 스포트라이트 반경을 **6셀→3셀**로 축소. 어둠 알파 0.95→0.98. 스포트라이트 경계를 부드러운 페더 대신 **깜빡이는 램프** 느낌으로 (0.5s 주기로 반경 ±10% 흔들림). |
| `INVISIBLE_PIECE` | 정상 작동 — `evInvisible.current` 시 `pm` 미렌더 (:955). | **유지** | 현재 충분히 체감. (hard 고정으로 고스트 경로 죽어있어 문제 없음.) |
| `COLOR_GRAY` | 정상 작동 — `drawCell`에서 `#EEEEEE` 강제 (:1055). | **수치강화** | 지속 8초 유지. 단, **`.wrap` 전체에 `filter: grayscale(1) contrast(1.3)`** 추가로 UI 상자·배경까지 회색화. 지금은 블록만 회색이라 광기 체감 약함. |

### 3-2. 물리 이벤트 (Physical)

| ID | 현재 상태 | 분류 | 새 동작 기대치 |
|---|---|---|---|
| `SAND_BURST` | 정상 작동 — `evSandBurst` 플래그로 다음 lock 시 sand 변환 (:395~414). | **유지 + 연출보강** | 로직 유지. 변환 순간 **폭발 파티클 버스트(15개)** + shake(8px, 300ms). |
| `FULL_SAND` | 정상 작동 — 모든 solid를 sand로 전환(:637~644). 가중치 0.5. | **수치강화 + 연출보강** | 전환 과정을 **프레임당 1줄씩 위에서 아래로 쓸려내리는 연출**로 분할. 배경 flash (적색, 400ms) + shake 최대(15px, 800ms). |
| `LIQUID_FLOOD` | **작동하지만 미약** — `n = boardW * 2 = 22개` sand 생성(:649~654). | **수치강화** | 생성 수 `boardW * 2` → `boardW * 6`(66개). 생성 위치 y=0~2 분산. |
| `EXPLODE` | 정상 작동 — 반경 2 solid/settled 제거(:660~678). | **수치강화 + 연출보강** | 반경 2→3. 폭발 지점에 **ShatterParticle 20개 튀어오르기** (bounces=2). flash (흰색, 200ms) + shake 강(10px). |
| `VORTEX` | 정상 작동 — 중심 방향 vx 부여 (:618~626, :430~435). 힘 0.3은 약함. | **수치강화** | 구심력 0.3 → 0.8. 감쇠 0.8 → 0.9(덜 감쇠). `.wrap`에 slow rotation 필터(3deg 좌우 흔들림, 1s 주기). |
| `BOUNCE_WALLS` | **작동하지만 미약** — 벽 충돌 시 vx 반전 (:447~453). 대부분 sand vx≈0이라 체감 안 됨. | **재구현** | 발동 시 **모든 moving sand에 초기 vx ±1.5 부여**. 이후 8초간 벽 충돌 시 반전+감쇠 0.9. 벽 충돌 순간 벽이 **0.2s 붉게 번쩍**. |
| `FLOOR_DROP` | 정상 작동 — 바닥 4행 확장 + arena→Shatter (:727~758). | **수치강화 + 연출보강** | 확장 행 4→6. Shatter `bounces` 3→5, 초기 `vy` 0.1→0.5. canvas 확장을 300ms **애니메이션**. shake 최대(15px, 800ms). 모바일 제외 유지. |

### 3-3. 방해 이벤트 (Disruptive)

| ID | 현재 상태 | 분류 | 새 동작 기대치 |
|---|---|---|---|
| `CONTROL_FREEZE` | 정상 작동 — `evControlFreeze`로 입력 무시 (:1153, :1168, :1183, :1203, :1226). | **유지 + 연출보강** | 2초 유지. 피스에 **얼음 필터**(파란 색조 + 흰 테두리 빛) + 화면 가장자리 프로스트 오버레이. |
| `PIECE_SHATTER` | 정상 작동 — 피스를 sand로 분해 후 `playerReset` (:682~701). | **유지 + 연출보강** | 분해 순간 shake(8px, 250ms) + flash + 0.1s 폭발 파티클. |
| `RANDOM_LOCK` | 정상 작동 — `lockPieceImmediate()` 호출 (:704~707). | **유지 + 경고 Flash** | 발동 직전 300ms **피스 테두리 붉은 점멸** 예고 후 고정. 예고 필수(현재 즉시 고정이라 당황). |
| `BOARD_TILT` | **반쪽 구현 (버그)** — 발동 시점 settled→moving + vx 1회 부여 (:710~725). **6초 지속이지만 vx는 `p.vx *= 0.7` 감쇠로 1~2초 내 0 수렴**. 작업계획 섹션 0 알려진 이슈. | **재구현 (버그 수정)** | 섹션 6 상세. |
| `SPIN_BLOCK` | 정상 작동 — 자동 회전 (:1115~1121), 좌우만 허용 (:1341~1346). | **유지 + 연출보강** | 피스 주변에 **소용돌이 파티클 트레일**. emoji를 `🌀`에서 `🎡` 또는 `🔄`로 교체(VORTEX와 중복 회피). |

### 3-4. 보드 크기 이벤트

| ID | 현재 상태 | 분류 | 새 동작 기대치 |
|---|---|---|---|
| `BOARD_EXPAND` | 정상 작동 — 좌우 각 1칸 확장 (:760~780). | **유지 + 연출보강** | 확장 애니메이션 300ms easeOutBack. 새 컬럼에 **녹색 테두리 Flash**. 모바일 CSS 고정 너비 이슈는 섹션 10에서 재확인. |

### 3-5. 제거 권장 이벤트

**없음.** 17개 이벤트 모두 기여 있음. 단 `SPIN_BLOCK`과 `VORTEX`의 emoji `🌀` 중복은 교체.

---

## 4. 신규 이벤트

**없음.** 본 개편 범위는 기존 이벤트 재강화. 추후 별도 요청 시 검토.

---

## 5. 광기 연출 레이어 스펙

### 5-1. 화면 흔들림 (Camera Shake)

- **트리거**: 즉발 이벤트 발동, `FULL_SAND`/`FLOOR_DROP` 개시, 라인 클리어(3줄+ 또는 이벤트 활성 중).
- **구현 방식**: `.wrap` 또는 `.gameArea` div에 CSS `transform: translate(rx,ry)` + requestAnimationFrame, 또는 CSS keyframes class 토글. developer-frontend 선택.
- **진폭 등급**:
  - 약: 4px, 200ms — 라인 1~2줄 클리어
  - 중: 8px, 300ms — 즉발 이벤트 일반(SAND_BURST, EXPLODE, LIQUID_FLOOD, PIECE_SHATTER)
  - 강: 12px, 500ms — FLIP_H/V, VORTEX 시작, BOARD_EXPAND
  - 최대: 15px, 800ms — FULL_SAND, FLOOR_DROP
- 중첩 시 **최대값으로 갱신**.

### 5-2. 색 왜곡 필터

지속형 이벤트는 CSS `filter` 를 `.board` 또는 `.wrap`에 지속시간 동안 적용.

| 이벤트 | 필터 |
|---|---|
| `FLIP_H` | `hue-rotate(180deg)` |
| `FLIP_V` | `invert(1) contrast(1.5)` |
| `DARK_SPOTLIGHT` | 필터 없음 (스포트라이트 자체가 왜곡) |
| `COLOR_GRAY` | `grayscale(1) contrast(1.3)` |
| `VORTEX` | `hue-rotate(45deg) saturate(1.8)` + `transform: rotate()` 3deg 좌우 흔들림 |
| `BOUNCE_WALLS` | 벽 충돌 순간 0.2s `brightness(1.6)` 펄스 |
| `BOARD_TILT` | `skewX(±3deg)` (방향에 따라) |
| `CONTROL_FREEZE` | `hue-rotate(180deg) saturate(0.7) brightness(1.1)` + 프로스트 오버레이 |

### 5-3. 경고 Flash (발동 직전 예고)

- **필수 예고 대상**: `EXPLODE`, `RANDOM_LOCK`, `FLOOR_DROP`, `FULL_SAND`, `PIECE_SHATTER`.
- 300ms 전부터 화면 테두리 200ms 붉은 점멸(2회) + 저진폭 shake(2px).
- 구현: `scheduleEvent(def, delay=300)` → 300ms 후 `fireEvent` 실행.
- 지속형 이벤트는 배너로 이미 인지 가능 → 예고 생략.

### 5-4. 대형 배너

- 현재 `.eventBanner` (padding 6px) **교체**.
- 새 스펙:
  - 화면 폭 70% 중앙 오버레이
  - 글자 2.2rem, 글리치 효과 (text-shadow 이중/삼중 + 1frame 위치 이동)
  - 0.6s 확대-축소 (scale 0.8 → 1.15 → 1.0)
  - 이벤트별 색상 그라데이션 배경 (적/보/청)
  - 지속 1.2s 후 페이드아웃 (현재 2s → 1.2s).

### 5-5. 파티클 강화

- `SAND_BATCH_SIZE = 25` → **35** 로 상향.
- `SHATTER_GRAVITY` 0.06 → **0.08**. `SHATTER_DAMPING` 0.5 → 0.6.
- `drawCell` motion blur: 현재 0장 → **1장 잔상** (×1.5, alpha 0.25).
- Shatter 초기 `vy` 상향 (이벤트별 명세 반영).

<!-- (2026-04-22 디자인 명세 기준으로 확정, PRD 갱신) -->


---

## 6. BOARD_TILT 버그 수정 스펙

### 6-1. 현재 문제

- 발동 시점에 settled→moving + vx 1회 부여 (:710~725).
- `simulateSand` 내 `p.vx *= 0.7` 감쇠(:434)로 약 3틱(180ms) 후 0.
- 결과: 6초 이벤트인데 실제 기울기는 0.2s만 작동.

### 6-2. 수정 스펙

**방식**: 이벤트 활성 동안 **매 sand tick마다 지속적으로 vx 증분**.

1. `BOARD_TILT` 발동 시 `tiltDir` (ref, +1 또는 -1) 저장. `evBoardTilt: useRef(false)` 플래그 신설.
2. `simulateSand()` 내 `evBoardTilt.current === true`이면:
   - moving sand에 `p.vx = (p.vx + tiltDir * 0.4) * 0.8`.
   - **settled sand 중 tilt 방향 아래 빈 공간이 있으면 moving 전환**: 매 틱 재검사, `isEmptyForSand(x + tiltDir, y)` 이고 `isEmptyForSand(x + tiltDir, y + 1)` 이면 state=moving, vx에 tiltDir 힘.
3. `clearActiveEvent`에서 `evBoardTilt.current = false`. 기존 moving 파티클은 자연 settling.
4. UI: 지속 시간 내내 `.board`에 `transform: skewX(tiltDir * 3deg)` — 기울어진 것이 시각적으로도 보여야 함.

### 6-3. VORTEX와의 공존

- 지속형끼리 `fireEvent`가 이미 배타 처리(:607) — 유지.

---

## 7. 전용 랭킹 UI

### 7-1. 요구사항

- 데이터 소스: `rankingsApi.getWeekly('blockfall-insane', 'hard')`, `getAlltimeBest('blockfall-insane', 'hard')` (이미 분리됨).
- 위치: 기존 `BlockfallInsaneBoard` 하단 랭킹 섹션을 **위젯 방식으로 재디자인** (별도 페이지 X).
- 일반 블록폴 랭킹과 명확히 다른 톤.

### 7-2. 디자이너 참고 방향

- 제목: `주간 RANK — INSANE` → `INSANE 주간 리더보드` 등 강한 카피 + 불꽃/글리치.
- 색상: `#ff2d55` 유지 + **그라데이션** (`#ff2d55 → #ff6b00 → #ffd60a`).
- 상위 3명: 1위 왕관+불꽃 배경, 2위 은색, 3위 동색.
- 역대 1위 배너: 크기 1.3배, CSS `@keyframes` 테두리 shimmer.
- 난이도 탭 제거. "룰" 탭만 유지 또는 별도 버튼.
- 모바일은 카드 레이아웃 검토.

### 7-3. 데이터 계약

- `RankEntry = { id, name, score, gameLevel?, createdAt }` 유지.
- 백엔드 변경 없음.
- 제출 시 `level: 'hard'` 고정.

---

## 8. 이벤트 발동 빈도 / 가중치 튜닝

### 8-1. 현재

- 간격: `Math.max(1000, 30000 - (level - 1) * 2600)` ms. 레벨 1=30s, 레벨 11=매 lock.
- 가중치: `FULL_SAND=0.5`, `BOARD_EXPAND=0.7`, 나머지 `1`.

### 8-2. 개편 방침

- **간격 유지** — 빈도가 아니라 체감 수위가 개편 축.
- **가중치 조정**:
  - `FULL_SAND` 0.5 → 0.4
  - `BOARD_EXPAND` 0.7 → 0.5
  - `FLIP_H` / `FLIP_V` 1 → 1.2
  - 나머지 1 유지
- **레벨 11 매 lock 발동 가드 추가**: `activeEventId.current && duration > 0`이면 레벨 11에서도 즉발 이벤트 스킵 권장. (현재는 즉발/지속형 중첩으로 체감 혼란.)

### 8-3. 튜닝 판단 기준 (qa 가이드)

- **너무 자주**: 10초 내 동일 이벤트 2회 → 가중치 하향.
- **너무 드물게**: 레벨 5+ 2분간 특정 이벤트 0회 → 상향 검토.
- **플레이 불능**: 이벤트 연속으로 게임 오버 루프면 동시 활성 조건 강화.

---

## 9. 제외 범위

- **Excel 모드**: 없음. 영구.
- **백엔드 변경**: 없음.
- **정식 공개 처리**: 없음.
- **BGM / SFX / 오디오**: 없음. 영구.
- **신규 이벤트**: 없음.
- **BOARD_SHRINK**: 불채택 유지.

---

## 10. 완료 기준 (Definition of Done — qa-tester 체크리스트)

### 10-1. 기본 동작

- [ ] 어드민으로 `/blockfall-insane` 진입 가능, 비어드민은 `/`로 리다이렉트.
- [ ] HomePage Test Lab 인세인 버튼 어드민 전용 노출.
- [ ] 난이도 선택 UI 없음. 게임 시작 시 `DROP_SPEEDS['hard']` 적용 (레벨 1 = 180ms).
- [ ] 랭킹 섹션 난이도 탭 없음, 단일 INSANE 랭킹.

### 10-2. 연출 최대치 체감

- [ ] 즉발 이벤트 발동 시 카메라 shake (섹션 5-1 등급).
- [ ] 지속형 이벤트 활성 중 색 왜곡 필터 유지.
- [ ] `EXPLODE`, `RANDOM_LOCK`, `FLOOR_DROP`, `FULL_SAND`, `PIECE_SHATTER` 발동 전 300ms 경고 Flash.
- [ ] 이벤트 배너 화면 폭 70%, 2.2rem+, 글리치 + 0.6s 확대-축소.
- [ ] 라인 3줄+ 클리어 시 약 shake, 4줄+이벤트 활성 시 중 shake.

### 10-3. 이벤트별 동작

- [ ] 시각 5종 + 필터 적용.
- [ ] 물리 7종 수치 강화(`LIQUID_FLOOD` 66개, `EXPLODE` 반경 3 등).
- [ ] 방해 5종 정상 작동.
- [ ] **`BOARD_TILT` 수정**: 6초 내내 한쪽으로 파티클 지속 쏠림, 보드 `skewX`, 종료 후 복원.
- [ ] `BOARD_EXPAND` + 모바일 뷰포트에서 canvas CSS 고정 너비에 잘리지 않음.
- [ ] `VORTEX`와 `SPIN_BLOCK` emoji 다름.

### 10-4. 랭킹

- [ ] INSANE 랭킹이 일반 블록폴과 시각적으로 명확히 구분 (designer 검수).
- [ ] 역대 1위 배너 강조.
- [ ] 1/2/3위 시각 차등화.
- [ ] 제출 후 목록 갱신.

### 10-5. 성능 / 호환

- [ ] `FULL_SAND` 분할 전환으로 60fps 유지.
- [ ] 모바일에서 `FLIP_H`/`FLIP_V`/`FLOOR_DROP` 발동 풀 제외.
- [ ] 오디오 파일·API 호출 코드 내 **전무** (영구 방침).
- [ ] `tsc -b && eslint .` 통과.

---

## 11. 오픈 퀘스천

- 대형 배너 시야 가림 → 투명도 designer 판단.
- `BOARD_TILT` 성능 이슈 발견 시 planner와 재협의.
- 경고 Flash 색(붉/흰) designer 판단.

---

## 12. 파일 영향 요약

- `frontend/src/games/blockfall/BlockfallInsaneBoard.tsx` — 전면 수정 (developer-frontend)
- `frontend/src/games/blockfall/BlockfallInsaneBoard.module.css` — 배너/shake/필터/랭킹 재작성 (designer + developer-frontend)
- `frontend/src/pages/HomePage.tsx` — 변경 없음
- `frontend/src/App.tsx` — 변경 없음
- 백엔드 — 변경 없음
- `shared/` — 변경 없음