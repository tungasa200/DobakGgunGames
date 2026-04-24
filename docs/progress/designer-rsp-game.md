# Progress — designer : RSP (가위바위보) 어드민 전용 게임

- 소유 팀원: **designer**
- 기능 키: `rsp`
- 최종 업데이트: 2026-04-21
- 관련 문서:
  - PRD: `docs/specs/rsp-game.md`
  - UX 명세: `docs/design/rsp-game.md`
  - planner 로그: `docs/progress/planner-rsp-game.md`

---

## 현재 상태

- **CP3 승인 완료 (2026-04-21) — UX 명세 최종 확정. developer-frontend 착수 가능.**
- `docs/design/rsp-game.md` 신규 작성 완료 (2026-04-21)
- `docs/design/rsp-game.md` D-1/D-2 확정 반영 완료 (2026-04-21)

---

## 작업 로그

### 2026-04-21 (2차 세션 — CP3 확정 사항 반영)

**CP3 확정 내용 (사용자 승인)**
- **D-1 확정**: 다음 판 전환 방식 = "다음 판" 버튼 클릭으로만 전환.
  자동 2초 전환 로직 완전 제거. 일반 모드/Excel 모드 양쪽 동일 동작.
- **D-2 확정**: 어드민 진입 경로 = 완전 숨김.
  AdminDashboardPage 포함 어드민 UI 전체에 RSP 링크/힌트 노출 금지.
  어드민은 URL 직접 암기/북마크로만 진입.

**수정한 섹션 (docs/design/rsp-game.md)**
- §2.2 게임 플로우: "자동 2초 또는 다음 판 클릭" → "유저가 다음 판 버튼 클릭"으로 단일화
- §5.1 상태 정의 표: result 상태 설명에서 자동 전환 문구 제거
- §5.2 전환 다이어그램: timer 기반 전환 제거, "다음 판 버튼 클릭 (CP3 확정)" 명시
- §8 어드민 진입 경로 UX: 전면 재작성 — 완전 숨김 확정 정책 및 frontend 구현 금지 항목 명시
- §11.3 체크리스트: `AdminDashboardPage` RSP 변경 금지 항목 추가
- 부록 B: 미결 표 → 결정사항 이력 표로 전환, D-1/D-2 "확정 (CP3, 2026-04-21)" 표기

---

### 2026-04-21 (초기 세션 — UX 명세 작성)

**읽은 파일**
- `docs/specs/rsp-game.md` — PRD 전체 검토 (CP2 승인 완료 확인)
- `docs/progress/planner-rsp-game.md` — 최신 결정사항 확인
- `CLAUDE.md` — Excel 모드 정책 확인
- `frontend/src/styles/excel.css` — Excel 공통 스타일 토큰 확인
- `frontend/src/components/excel/ExcelShellContext.tsx` — useExcelShell 훅 인터페이스 확인
- `frontend/src/components/excel/ExcelShell.tsx` — ExcelShell 컴포넌트 구조 확인 (GAMES 배열, 시트 탭 구성 등)
- `frontend/src/games/sudoku/SudokuBoard.tsx` — useExcelShell 통합 패턴 확인
- `frontend/src/games/blockfall/BlockfallBoard.tsx` — Excel 모드 색상 분기 패턴 확인
- `frontend/src/pages/admin/AdminDashboardPage.tsx` — GAME_LABELS 구조 확인
- `docs/review/architecture.md` — smell 재발 방지 근거 확인

**작성 완료 항목 (docs/design/rsp-game.md)**
1. 공통 요구사항 요약
2. 유저 플로우 (진입 / 게임 / 세션 종료)
3. 화면별 와이어프레임 — 일반 모드 (헤더/VS 보드/선택 버튼/통계 바/에러 배너)
4. 화면별 와이어프레임 — Excel 모드 (쉘 구조/리본/수식바/시트 탭 3개/상태바)
5. 상태 머신 (idle/submitting/revealing/result/error 전환 다이어그램)
6. 컴포넌트 명세 (RspBoard/useRspGame/AdminRspPage/AdminRspExcelPage/adminRspApi)
7. Excel 모드 useExcelShell 통합 패턴 (수식바/상태바/리본 게임 그룹 업데이트 명세)
8. 어드민 진입 경로 UX (대시보드 하단 소자 링크 권장안 포함)
9. 접근성 A11y (키보드 단축키/aria 속성/색상 대비표/포커스 인디케이터)
10. 마이크로카피 (버튼/결과/통계/에러/안내 문구 전체)
11. 아키텍처 smell 재발 방지 (GAME_LABELS 미추가 결론 / 공통 유틸 재활용 목록)
12. 반응형 레이아웃 (일반 모드 3 브레이크포인트 / Excel 모드 excel.css 준수)

**주요 결정 사항**
- 일반 모드: 세로 스택 카드 UI (헤더 + VS 보드 + 선택 버튼 + 통계 바)
- Excel 모드: ExcelShell 래퍼 + 게임/히스토리/룰 시트 탭 3개
  - 'ranking' SheetTab을 히스토리 탭으로 재사용 (ExcelShellContext 타입 변경 없이)
  - RSP는 ExcelShell GAMES 배열에 미등록 (홈 드롭다운 비노출)
- revealing 애니메이션: 600ms (shake 300ms + fadeIn 300ms)
- 스트릭 아이콘: 텍스트 우선 (이모지 선택 사항 D-4)
- 어드민 진입 경로: 대시보드 하단 소자 링크 권장 (사용자 CP3 확인 필요 — D-2)

---

## 다음 단계

1. **developer-frontend 착수** (CP3 완료, UX 명세 최종 확정)
   - `docs/design/rsp-game.md` 기반으로 구현 시작 가능
   - 착수 전 §11.3 체크리스트 전체 확인 필수
   - D-2: `AdminDashboardPage.tsx`에 어떤 변경도 없음을 확인
2. **developer-backend 착수** (API 병렬 진행 가능)

---

## 블로커 / 리스크

- **D-2**: CP3에서 완전 숨김으로 확정. `AdminDashboardPage` 관련 블로커 해소.
- **ExcelShell 단독 렌더 POC**: RSP Excel 모드는 홈 카탈로그 미등록으로 인해
  선례가 없음. developer-frontend가 ExcelShell을 AdminRoute 내에서 단독 렌더할 때
  정상 동작하는지 초기 POC 필요 (planner 로그에도 같은 리스크 기록됨).
- **SheetTab 'ranking' 재사용**: ExcelShellContext의 SheetTab 타입 변경 없이
  'ranking' 분기를 히스토리로 재사용하는 방식은 developer-frontend가
  구현 시 더 나은 방법(예: 커스텀 탭 라벨 prop 추가)으로 변경 가능.
  명세 변경이 필요하면 designer에게 알림 후 수정.

---

---

### 2026-04-21 (세션 종료 로그)

**세션 종료 일시**: 2026-04-21

**CP3 완료 확정**
- UX 명세 `docs/design/rsp-game.md` 최종 확정 상태. 추가 수정 없음.
- D-1 확정: "다음 판" 버튼 클릭만 전환, 자동 전환 없음.
- D-2 확정: RSP 진입 링크 완전 숨김 — AdminDashboardPage/사이드바/홈/Excel홈 전체 비노출.

**developer-frontend 구현물 UX 명세 충족 여부 (designer 관점 체크)**

| UX 명세 항목 | 구현 확인 | 비고 |
|---|---|---|
| 상태 머신 (idle/submitting/revealing/result/error) | 충족 | RspBoard.tsx `excel` prop 분기로 양쪽 모드 통합 구현 |
| 히스토리 탭 (시트 탭 3개: 게임/히스토리/룰) | 충족 | ExcelShell 단독 렌더 POC 성공으로 블로커 해소 |
| 리본 게임 그룹 | 충족 | Excel 모드 리본 구현 확인 |
| 수식바 | 충족 | §6.7 색상 토큰 CSS 모듈 반영 확인 |
| 키보드 단축키 1/2/3 + Escape | 충족 | aria-label/aria-live 접근성 반영 |
| 애니메이션 타이밍 600ms | 충족 | shake 300ms + fadeIn 300ms 명세와 일치 |
| AdminDashboardPage 미변경 | 충족 | D-2 완전 숨김 정책 준수 |

**CP5 생략 기록**
- QA 단계(CP5, qa-tester 검증)는 사용자 결정으로 건너뜀.
- qa-tester 검증 없이 구현 완료 처리됨. 향후 이슈 발생 시 별도 버그 티켓으로 대응.

**향후 보강 항목 (Should 항목 — 별도 티켓)**
- 스트릭 아이콘 이모지 확정 (D-4)
- 기타 Should 항목은 `docs/design/rsp-game.md` 부록 참조

---

## 파일 소유권 메모

- `docs/design/rsp-game.md` — designer 소유 (본 명세 파일)
- `docs/progress/designer-rsp-game.md` — designer 소유 (본 파일)
- `frontend/src/styles/excel.css` — 수정 금지 (명세만 참조)
- `frontend/` 실제 코드 — developer-frontend 소유

---

## 후속 액션

- 2026-04-24: online-rps로 교체됨. docs/design/online-rps-design.md 참조.
