# 작업 로그 — designer / yacht

- 담당자: designer
- 최초 작성일: 2026-04-29
- 마지막 갱신: 2026-04-29 (세션 1 최종)
- PRD 참조: `docs/specs/yacht-prd.md` (CP1 승인 완료)

---

## 세션 1 — 2026-04-29

### 작업 내용

1. PRD `docs/specs/yacht-prd.md` 정독 (CP1 3건 확정 사항 포함)
2. 레퍼런스 `docs/design/online-rps-design.md` 정독
3. CSS 패턴 `frontend/src/games/online-rps/components/RpsScreens.module.css` 정독
4. 3개 화면 UX 명세 작성 완료:
   - `docs/design/yacht-waiting.md`
   - `docs/design/yacht-game.md`
   - `docs/design/yacht-result.md`
5. 본 progress 파일 작성

### 세션 1 상태: 완료

- 디자인 산출물 3종 모두 작성 완료
- developer-frontend 구현 완료 확인
- CP1 전 항목 명세 반영 확인

### 완료된 산출물

| 파일 | 상태 | 비고 |
|---|---|---|
| `docs/design/yacht-waiting.md` | 완료 | 대기 화면 전체 명세 |
| `docs/design/yacht-game.md` | 완료 | 게임 화면 핵심 명세 |
| `docs/design/yacht-result.md` | 완료 | 결과 화면 전체 명세 |

### CP1 반영 내역

| CP 항목 | PRD 확정 | 명세 반영 내용 | 확인 |
|---|---|---|---|
| CP1-1: 타임아웃 없음 | 타임아웃 바 불필요 | 게임 화면에서 타이머 프로그레스 바 제거. 굴리기 버튼에 rollsLeft만 표시. | 완료 |
| CP1-2: yacht_win 테이블 | 단순 승수 카운트 | 결과 화면에 "N번째 승리!" 메시지 컴포넌트 명세 (승자 본인 전용). | 완료 |
| CP1-3: 방장 시작 버튼 | 준비 버튼 + 방장 시작 | 대기 화면에 비방장 준비 토글 버튼, 방장 전용 시작 버튼(조건부 활성) 명세. MATCH_COUNTDOWN UI 없음. | 완료 |

### OQ 디자이너 결정

| OQ ID | 질문 | 결정 | 상태 |
|---|---|---|---|
| OQ-7 | 결과 화면 표시 시간 | 자동 복귀 없음. 사용자 직접 "홈으로" 버튼. 야추 게임 특성상 결과 복기 시간 필요. | 확정 |
| OQ-8 | 점수 미리보기 표시 방식 | "항상 표시" 방식 채택. 굴림 완료 즉시 모든 미기록 셀에 미리보기 점수 표시. (hover 방식 미채택 — 모바일 hover 동작 불가) | 확정 |
| OQ-9 | 3D 주사위 모바일 fallback | CP3에서 developer-frontend와 협의 필요. 명세에서는 3D 기준 작성, fallback 정책 미결. | **미결** — 다음 세션 |

---

## developer-frontend 전달 메시지

**Yacht UX 명세 완료. `docs/design/yacht-*.md` 참조 바람.**

구현 시 주의 사항:
1. **CSS 토큰**: `--yacht-` 접두사 신규 토큰만 사용. `--rps-` 와 완전히 독립 선언 필요.
   - 토큰 목록은 각 명세 파일 마지막 섹션("CSS 토큰 선언 목록") 참조.
2. **점수판 가로 스크롤**: 4인 플레이 시 데스크탑에서도 가로 스크롤 발생 가능. `overflow-x: auto` 처리 필수.
3. **sticky 헤더 + sticky 족보 이름 열**: 점수판에서 2축 sticky 필요 (헤더 행 + 첫 번째 열). z-index 레이어 관리 주의.
4. **3D 주사위 (three.js + gsap)**: 서버 결과값을 기반으로 최종 면이 결정되도록 gsap timeline 마지막에 올바른 rotation 값 고정. `yacht-game.md §5.5` 참조.
5. **미리보기 점수 계산**: 클라이언트 사이드에서 현재 dice 배열 기반으로 12개 족보 점수를 즉시 계산해 표시. PRD §5.6 의사 코드 참조.
6. **CP1-3 준비/시작 이벤트**: `/app/yacht/room/{roomId}/ready` ({ready: true/false}), `/app/yacht/room/{roomId}/start` ({}) — 대기 화면 버튼과 연결.
7. **모바일 점수판 스크롤 힌트**: 최초 1회 페이드아웃 오버레이 그라데이션 (3초 후 자동 소멸).

---

## developer-frontend 구현 완료 확인

- 세션 1 명세 기반 구현 완료 확인됨 (2026-04-29)
- 확인 항목: 대기 화면, 게임 화면, 결과 화면 전체

---

## 다음 단계

- designer: 실제 배포 후 모바일 레이아웃 현장 검토 (다음 세션)
- designer: OQ-9 (Three.js 모바일 저사양 fallback) — developer-frontend와 협의 후 결정
- qa-tester: 구현 완료 기반 테스트 플랜 작성 (CP5)
- planner: OQ-9 정책 최종 승인 필요

---

세션 종료: 2026-04-29. 다음 세션: 모바일 UX 검토.
