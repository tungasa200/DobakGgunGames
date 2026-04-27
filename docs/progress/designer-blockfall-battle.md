# Progress — designer : Blockfall Battle (블록폴 배틀 모드)

- 소유 팀원: **designer**
- 기능 키: `blockfall-battle`
- 최종 업데이트: 2026-04-27
- 관련 문서:
  - PRD: `docs/specs/blockfall-battle-prd.md` (CP1 완료)
  - UX 플로우: `docs/design/blockfall-battle-flow.md`
  - 컴포넌트 명세: `docs/design/blockfall-battle-components.md`
  - 참조: `docs/design/online-rps-design.md` (패턴 참고)

---

## 현재 상태

- **CP2 완료 — 2026-04-27 (세션 2 추가 완료)**
- `docs/design/blockfall-battle-flow.md` 신규 작성 완료
- `docs/design/blockfall-battle-components.md` 신규 작성 완료 (세션 2에서 항목 보강)
- OQ-5, OQ-6, OQ-7, OQ-8 디자이너 결정 사항 확정 (flow.md §7에 반영)
- CSS 변수 네임스페이스 (`--battle-` 접두사) 적용, blockfall-battle.css 업데이트
- 멀티 게임판 레이아웃 CSS Grid (2인/3인/4인) 명세 반영
- 경고 배너 sticky 분리 및 게스트 안내 문구 추가
- 결과 화면 2열 그리드 + 10초 카운트다운 진행 바 명세 추가
- developer-frontend에게 UX 명세 전달 완료
- 커밋 포함됨

---

## 산출물 목록

| 파일 | 설명 | 상태 |
|---|---|---|
| `docs/design/blockfall-battle-flow.md` | 배틀 전체 UX 플로우, 화면 전환, 데이터 흐름, 큐 플로우 | 완료 |
| `docs/design/blockfall-battle-components.md` | 전체 컴포넌트 명세 (스타일, 레이아웃, 접근성, keyframes, 경고 배너 sticky, 결과 2열 그리드, 10초 진행 바) | 완료 |
| `blockfall-battle.css` (명세 반영) | `--battle-` 접두사 CSS 변수 네임스페이스, 멀티 게임판 CSS Grid (2인/3인/4인) | 완료 |

---

## 작업 로그

### 2026-04-27 (CP2 세션 1 — UX 명세 작성)

**읽은 파일**
- `docs/specs/blockfall-battle-prd.md` — PRD 전체 검토 (§1~18 완독)
- `docs/design/online-rps-design.md` — 패턴 및 토큰 명세 방식 참고
- `docs/progress/designer-online-rps.md` — 작업 로그 패턴 참고
- `frontend/src/pages/HomePage.tsx` — 현재 홈 구조 파악 (Test Lab 카드 현황)
- `frontend/src/pages/HomePage.module.css` — 기존 카드 CSS 패턴 파악
- `frontend/src/styles/excel.css` — Excel 모드 N/A 확인

**핵심 발견 사항**
- HomePage.tsx Test Lab 섹션이 `{user && (...)}` 로 로그인 유저에게만 노출 중
  → PRD §6의 게스트 허용 정책과 충돌 가능 → flow.md §1.1에 주의 사항 기록
- 기존 Test Lab 카드 구조(`.labDivider` 등)를 재사용하는 방식으로 설계

**작성 완료 항목**

`docs/design/blockfall-battle-flow.md`:
1. 진입 경로 플로우 (Test Lab → /test-lab/blockfall-battle)
2. 배틀 전체 상태 플로우 (JOINING → WAITING → PLAYING → RESULT)
3. 화면 전환 트리거 상세 (화면 목록, WAITING 서브 상태, PLAYING 서브 상태, RESULT 전환)
4. 데이터 흐름 다이어그램 (WAITING / PLAYING / QUEUE 각각)
5. 도중 입장 큐 플로우 (PRD §11 기반)
6. 엣지케이스 UX 처리 (EC-1, 6, 7, 8, 12, 13, 14)
7. OQ-5/6/7/8 디자이너 결정 사항

`docs/design/blockfall-battle-components.md`:
1. 홈 Test Lab 섹션 — "블록폴 배틀 [BETA]" 항목 추가 명세
2. 테스트 단계 경고 배너 (노란색 주황 테두리 배너, OQ-7 결정 반영)
3. 대기 화면 (3가지 서브 상태: 혼자/카운트다운/취소)
4. 카운트다운 (인라인 방식, 별도 전체 화면 오버레이 불필요 결정)
5. 멀티 게임판 레이아웃 (2인/3인/4인 각각 CSS Grid 명세)
6. Garbage Line 이펙트 (수신 애니메이션, 공격 발동 이펙트, 테두리 flash)
7. 큐 대기 화면 (대기열 위치 실시간 갱신)
8. 결과 화면 (순위 패널 + TOP 10 패널 + 자동 전환 바 + 액션 버튼)
9. 플레이어 이탈 토스트
10. 연결 오류 / 에러 상태 UI
11. 컬러 토큰 (`--battle-` 접두사)
12. 타이포그래피 일람
13. 반응형 레이아웃 브레이크포인트 (desktop/tablet/mobile)
14. 접근성 명세 (키보드, ARIA, 색상 대비)
15. keyframes 요약

---

### 2026-04-27 (CP2 세션 2 — 명세 보강 및 CSS 업데이트)

**작업 내용**
- `blockfall-battle.css` CSS 변수 네임스페이스 적용: `--battle-` 접두사 전면 적용
  - 기존 `--color-*` 충돌 방지, `--rps-*` 등 타 기능 변수와 분리 확인
- 멀티 게임판 CSS Grid 레이아웃 명세 보강
  - 2인: `grid-template-columns: 1fr 1fr`
  - 3인: `grid-template-columns: 1fr 1fr 1fr`
  - 4인: `grid-template-columns: repeat(2, 1fr)` (2x2)
- 경고 배너 sticky 분리 처리: `position: sticky; top: 0; z-index: 100` 명세 추가
- 게스트 안내 문구 추가: "게스트로 참여 중입니다. 결과가 기록에 반영되지 않습니다."
- 결과 화면 레이아웃 2열 그리드 명세 추가 (순위 패널 | TOP 10 패널)
- 결과 화면 10초 카운트다운 진행 바 명세 추가
  - `--battle-countdown-progress` CSS 변수로 JS에서 `width` 제어
  - `transition: width 1s linear` 적용
- developer-frontend에 UX 명세 전달 완료 (커밋 포함)

---

## OQ 답변 기록

| OQ ID | 질문 | 결정 내용 |
|---|---|---|
| OQ-5 | 결과 화면 10초 자동 전환 + 큐 잔류자 컨펌 여부 | 별도 컨펌 없이 자동 진행. QUEUE 화면에 "다음 라운드까지 N초" 카운트다운 표시로 대기 인지 제공. |
| OQ-6 | 모바일 UX (보드 다수 표시) | 모바일: 본인 보드 메인 + 상대 보드 하단 가로 스크롤 스트립. 태블릿: 2열 그리드. 데스크톱: 인원수별 그리드. |
| OQ-7 | Test Lab 배너 디자인 | 노란색 경고 배너. bg:#FEF3C7, border:#F59E0B, text:#92400E. 문구: "테스트 단계 기능입니다. 운영 게임이 아니므로 기록이 저장되지 않을 수 있습니다." |
| OQ-8 | 게스트 닉네임 충돌 표시 | 충돌 시 `손님-{4자리} #{uuid 뒤 4자리}` 접미어 추가. 예: `손님-A3F2 #d7e9` |

---

## 주요 설계 결정 사항

- **Test Lab 카드 내 항목 추가**: 별도 섹션 신설 없이 기존 Test Lab 카드에 `labDivider` 사용해 항목 추가. BETA 배지(#F59E0B)로 시각 구분.
- **카운트다운 오버레이**: 별도 전체 화면 오버레이 없이 WAITING 화면 내 인라인 카운트다운으로 처리. 복잡성 최소화.
- **결과 화면 TOP 10 위치 강조**: 결과 화면에서만 표시 — 다른 모든 화면에 절대 노출 금지 명시 (PRD §9.3 준수).
- **Garbage 색상**: PRD 권장값 `#888888` 채택 (`--battle-garbage-color`).
- **CSS 변수 네임스페이스**: `--battle-` 접두사로 기존 `--rps-`, `--color-` 변수와 충돌 방지.
- **Excel 모드**: N/A — PRD §3 명시, 명세 작성 불필요.
- **모바일 상대 보드**: 스크롤 스트립 방식으로 본인 보드 최대화 및 상대 보드 인지 모두 충족.

---

## developer-frontend 인계 사항 (중요)

1. **Test Lab 섹션 위치**: 기존 Test Lab 카드 내부에 항목 추가. `labDivider` 클래스 재사용 가능.
2. **멀티 게임판 레이아웃**: 인원수(2/3/4)에 따라 CSS Grid 동적 변경 필요. components.md §5.3 참고.
3. **결과 화면 랭킹 표시 위치**: GAME_RESULT 수신 후 ResultScreen에서만 렌더링. `topRankings` 필드는 WebSocket payload에 포함되어 있어 별도 API 호출 불필요 (단, 재진입 시 `GET /api/blockfall-battle/rankings` 선택적 호출 가능).
4. **Garbage 애니메이션**: 기존 BlockfallBoard 로직과 연동 필요. `bb-garbage-in` keyframes 300ms ease-out.
5. **게스트 토큰 저장**: `guestToken`을 `sessionStorage`에 저장 후 WebSocket 연결 시 사용.

---

## 블로커 / 리스크

- **Test Lab 노출 조건**: 현재 로그인 유저 전용. 게스트도 배틀 참여 가능하므로 비로그인 노출 여부 사용자 확인 필요.
- **기존 BlockfallBoard 연동**: 싱글 모드 보드를 배틀 모드에서 재사용할 때 상대 보드(조작 불가 표시 전용) 처리 방식을 developer-frontend가 결정.
- **상대 보드 크기 조정**: 3인/4인 시 상대 보드 70~80% 크기 축소 구현 방식 developer-frontend 결정.
- **`--color-*` 변수 정의 위치**: excel.css 외 별도 CSS 변수 파일 없으면 `--battle-*` 선언 위치 developer-frontend 결정.

---

## 다음 단계

1. **developer-frontend 착수** (CP2 완료, UX 명세 확정)
   - `docs/design/blockfall-battle-flow.md` + `blockfall-battle-components.md` 기반 구현 시작
   - 신규 CSS 변수 `--battle-*` 선언
   - keyframes `bb-*` 구현
   - `BlockfallBattlePage.tsx`, `WaitingScreen.tsx`, `GamePlayScreen.tsx`, `ResultScreen.tsx` 등 신규 컴포넌트 작성
2. **developer-backend 착수** (병렬)
   - PRD §10~13 기반 WebSocket + REST API 구현
3. **CP3** — 통합 테스트 (4인 게스트 혼합)
4. **CP4** — qa-tester 검증

---

## 세션 종료 로그

| 세션 날짜 | 작업 | 완료 내용 |
|---|---|---|
| 2026-04-27 세션 1 | CP2 디자인 명세 작성 | blockfall-battle-flow.md, blockfall-battle-components.md 작성, OQ-5/6/7/8 결정 확정 |
| 2026-04-27 세션 2 | CP2 명세 보강 및 CSS 업데이트 | `--battle-` 접두사 CSS 변수 네임스페이스 적용, 멀티 Grid 레이아웃 보강, 경고 배너 sticky 분리, 게스트 안내 문구 추가, 결과 화면 2열 그리드 + 10초 카운트다운 진행 바 추가, developer-frontend 인계 완료, 커밋 포함 |

---

## 파일 소유권 메모

- `docs/design/blockfall-battle-flow.md` — designer 소유
- `docs/design/blockfall-battle-components.md` — designer 소유
- `docs/progress/designer-blockfall-battle.md` — designer 소유 (본 파일)
- `frontend/src/styles/excel.css` — 수정 금지 (배틀 모드 무관)
- `frontend/` 실제 코드 — developer-frontend 소유
