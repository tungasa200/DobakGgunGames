# Progress — planner : 사다리 타기 (Ladder) 미니게임

- 소유 팀원: **planner**
- 기능 키: `ladder-game`
- 최종 업데이트: 2026-04-29
- 관련 문서:
  - PRD: `docs/specs/ladder-game.md`
  - 참고 선례: `docs/specs/rsp-game.md` (모드 적용 범위 필드 패턴), `frontend/src/pages/RoulettePage.tsx` (미니게임 도구 라우트 선례)

---

## 현재 상태

- **CP1 승인 대기** — PRD 초안 작성 완료 (`docs/specs/ladder-game.md`).
- 사용자 지시 (2026-04-29) 기준:
  - 일반 모드만 구현 (Excel 모드 적용 지시 없음).
  - 백엔드/DB/랭킹 변경 없음 — 순수 클라이언트 도구.
  - 라우트: `/ladder`. HomePage "미니게임" 카드(룰렛/주사위 옆)에 링크 추가.
- 다음: 프로젝트 오너가 OQ-1, OQ-3, OQ-7 (CP1 시점 답변 필요분) 확인 후 PRD 확정 → designer / developer-frontend 병렬 착수.

---

## 작업 로그

### 2026-04-29 (초기 세션 — PRD 작성)
- 사용자 지시 수신:
  - 사다리 타기 게임 신규 추가, `/ladder` 라우트.
  - 참가자 2~8명, 결과(상품/벌칙)는 참가자 수와 동일.
  - 가로 선 밀도는 자동(또는 조정 가능), 결과 공개 모드는 한 명씩/전체 동시 선택 가능.
  - 초기화 버튼 포함.
  - **Excel 모드 적용 지시 없음** → 일반 모드만.
  - 영향 범위: `frontend/src/pages/LadderPage.tsx` + CSS, `App.tsx` 라우트 추가, `HomePage.tsx` 미니게임 카드 링크 추가. 백엔드/DB/환경변수 변경 없음.
- 기존 자산 조사 완료:
  - `CLAUDE.md` Excel 모드 정책 ("사용자 지시가 없으면 일반 모드만") 재확인.
  - `frontend/src/App.tsx:42, 137` — `/roulette` 라우트 등록 패턴 확인.
  - `frontend/src/pages/HomePage.tsx:248-270` — "미니게임" 섹션에 룰렛/주사위 링크 패턴 확인 (사다리 링크 추가 위치).
  - `docs/specs/rsp-game.md` — "모드 적용 범위" 필드 / "오픈 퀘스천" 표 / "체크포인트" 표 포맷 차용.
- PRD `docs/specs/ladder-game.md` 작성 완료 (14개 섹션):
  - §1 배경 및 목적 / 비목표
  - §2 유저 스토리 7건 (US-1 ~ US-7)
  - §3 모드 적용 범위 — **일반 모드 Must, Excel 모드 해당 없음** 명시 (필수 필드)
  - §4 기능 요구사항 — Must(FR-M1~M10) / Should(FR-S1~S6) / Nice-to-have(FR-N1~N5) / Won't
  - §5 게임 규칙 — 사다리 구조, 매칭 규칙, 점수/타이머 없음, 진행 흐름
  - §6 엣지 케이스 10건 (EC-1 ~ EC-10)
  - §7 API 요구사항 — 백엔드 변경 없음 명시
  - §8 영향 범위 — Frontend 신규/수정 파일, Backend/DB/shared/환경변수 변경 없음
  - §9 보안/권한 — 비로그인 허용, 권한 분기 없음
  - §10 성공 지표
  - §11 체크포인트 표 (CP1~CP5)
  - §12 게임 밸런스 정책 — 가로 선 밀도 잠정안
  - §13 참고 — 기존 유사 구현 (룰렛/주사위)
  - §14 오픈 퀘스천 7건 (OQ-1 ~ OQ-7)

---

## 다음 단계 (순서)

1. **프로젝트 오너 CP1 승인** — **현재 단계**
   - OQ-1 (결과 공개 모드 기본값) — 잠정안 A(전체 동시).
   - OQ-3 (욕설 필터 적용 여부) — 잠정안 미적용.
   - OQ-7 (참가자 수 ↔ 결과 수 자동 동기화 여부) — 잠정안 자동 동기화.
2. designer 작업 착수 (CP2)
   - `docs/design/ladder-game.md` — 일반 모드 명세
   - 입력 UI 레이아웃, 사다리 시각 스타일, 경로 트레이싱 애니메이션, 모바일 대응
   - OQ-2 (초기화 버튼 동작) / OQ-5 (모바일 한 명씩 공개 클릭 영역) / OQ-6 (결과 텍스트 길이 제한) designer가 결정 후 PRD 갱신
3. developer-frontend 작업 착수 (CP3)
   - 신규: `frontend/src/pages/LadderPage.tsx` + 스타일 파일 + (필요 시) `frontend/src/games/ladder/` 보조 컴포넌트
   - 수정: `frontend/src/App.tsx` (`/ladder` Route 추가), `frontend/src/pages/HomePage.tsx` (미니게임 카드 링크 추가)
   - 사다리 생성 알고리즘 (이중 분기 금지 무결성 보장)
   - 결과 공개 모드 A/B 토글 구현
4. qa-tester 검증 플랜 수립 (CP4)
   - `docs/review/ladder-game-test-plan.md`
   - 사다리 무결성 검증 (5회 이상 무작위 생성), 매칭 유일성, 모바일 반응형, 비로그인 접근 허용, 백엔드 호출 0건 확인

---

## 대기 중 질문 (프로젝트 오너 답변 필요)

CP1 시점에 확정 받고 싶은 항목:

- **OQ-1**: 결과 공개 모드 기본값 — A(전체 동시) / B(한 명씩) 중?
  - 잠정안: A(전체 동시).
- **OQ-3**: 참가자/결과 입력에 욕설 필터(`shared/badwords.json`) 적용?
  - 잠정안: 미적용 (친목 사용 도구라 사용자 자율).
- **OQ-7**: 참가자 수 변경 시 결과 항목도 자동 +1/-1 동기화 / 별도 수동 관리?
  - 잠정안: 자동 동기화 (항상 일치).

CP2 / 후속에서 다룰 항목 (지금 답변 불요):
- OQ-2 (초기화 버튼 동작 분기) — designer 결정
- OQ-4 (가로 선 밀도 슬라이더 MVP 포함 여부) — 후속 검토
- OQ-5 (모바일 클릭 영역) — designer 결정
- OQ-6 (결과 텍스트 길이 제한) — designer/frontend 협의

---

## 블로커 / 리스크

- 블로커 없음.
- 리스크:
  - **사다리 무결성 알고리즘** — 같은 행에 인접 가로 선이 겹치지 않게 생성하는 로직이 잘못되면 매칭 유일성이 깨질 수 있음. developer-frontend가 단위 테스트로 검증 필요.
  - **모바일 가독성** — 8명 참가자 + 결과 텍스트가 좁은 화면에서 가로 스크롤로 밀릴 수 있음. designer 명세 단계에서 폭 ≤ 360px 케이스 명시 필요.
  - **HomePage "미니게임" 카드 레이아웃** — 룰렛/주사위와 함께 3개로 늘어날 때 카드 배치가 어색해질 가능성 → designer 검토 필요.

---

## 체크포인트 표

| 체크포인트 | 책임자 | 상태 | 메모 |
|---|---|---|---|
| CP1 — PRD 초안 승인 | 프로젝트 오너 | ⏳ 승인 대기 | OQ-1 / OQ-3 / OQ-7 답변 필요 |
| CP2 — UX/디자인 명세 | designer | 대기 | `docs/design/ladder-game.md` |
| CP3 — Frontend 구현 | developer-frontend | 대기 | `LadderPage` + 라우트 + HomePage 링크 |
| CP4 — QA 검증 | qa-tester | 대기 | `docs/review/ladder-game-test-plan.md` |
| CP5 — 배포 | 프로젝트 오너 | 대기 | Vercel smoke test |

---

## 파일 소유권 메모

- `docs/specs/ladder-game.md` — planner 소유 (본인)
- `docs/progress/planner-ladder-game.md` — planner 소유 (본 파일)
- `docs/design/ladder-game.md` — designer 소유 (CP2에서 생성 예정)
- `docs/review/ladder-game-test-plan.md` — qa-tester 소유 (CP4에서 생성 예정)
- 다른 팀원은 스펙 변경 필요 시 반드시 planner 경유

---

## 인수인계 메모

- 본 PRD는 사용자 지시 기준 **일반 모드만** 구현. Excel 모드 후속 요청 시 별도 PRD 보강 또는 §3 갱신.
- 백엔드/DB/환경변수/shared/ 변경 **없음** — developer-backend는 본 작업에 관여하지 않음.
- 기존 미니게임 도구 라우트(`/roulette`, `/dice`) 패턴을 그대로 따르므로 신규 회원 인증/권한 로직 불요.
- 사용자가 답변 후 PRD 상단 메타 (상태 / 최종 확정일 / 승인자 / 확정 이력) 갱신할 것.
