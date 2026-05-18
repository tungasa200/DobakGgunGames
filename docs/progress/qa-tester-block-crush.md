# QA Tester 작업 로그 — Block Crush (블록 크러시)

- 작성자: qa-tester
- 최종 수정: 2026-05-18
- 기능 상태: 선행 테스트 플랜 작성 완료 — 구현 대기 중

---

## 현재 상태

| 단계 | 상태 | 비고 |
|---|---|---|
| PRD 수신 | 미완료 | `docs/specs/block-crush-prd.md` 미존재 |
| API 계약서 수신 | 미완료 | `docs/specs/block-crush-api-contract.md` 미존재 |
| 테스트 플랜 초안 작성 | 완료 | `docs/review/block-crush-test-plan.md` |
| developer-frontend 구현 대기 | 대기 중 | — |
| developer-backend 구현 대기 | 대기 중 | — |
| TC 실행 | 미시작 | 구현 완료 후 진행 |
| 회귀 테스트 | 미시작 | 구현 완료 후 진행 |
| 버그 리포트 | 없음 | — |

---

## 2026-05-18 작업 내역

### 완료 항목

1. 기존 테스트 플랜 패턴 검토
   - `docs/review/blockfall-insane-test-plan.md` 검토 완료
   - `docs/review/blockfall-battle-test-plan.md` 검토 완료
   - 프로젝트 구조 및 공통 모듈(`RankingService`, `SessionController`, `VALID_GAMES`) 파악

2. `docs/review/block-crush-test-plan.md` 선행 초안 작성 완료
   - TC 총 85개 (섹션별 분류)
   - 기능 테스트 30개 (보드 초기화, 블록 배치, 줄 클리어, 점수 시스템, 트레이 관리, 게임 오버, 랭킹 등록/조회, Test Lab 노출)
   - 엣지 케이스 18개 (PRD §8 기반 선행 시나리오 — PRD 확정 후 동기화 필요)
   - 점수 계산 정밀 검증 5개 시나리오 (A~E — PRD §5 확정 후 수치 동기화 필요)
   - API 검증 12개 + 보안 조작 4개
   - 회귀 테스트 6개
   - 모바일 테스트 6개
   - 성능 테스트 4개
   - 접근성 테스트 4개

### 주요 판단 사항

- **PRD 미존재**: `docs/specs/block-crush-prd.md` 및 `docs/specs/block-crush-api-contract.md` 모두 미존재. 사용자 제공 요구사항 명세만을 근거로 선행 초안 작성. 점수 공식(§5), 엣지 케이스(§8), API 에러 매트릭스(§12) 확정 후 테스트 플랜 동기화 필수.
- **Excel 모드**: PRD "모드 적용 범위" 필드 미확정. 테스트 플랜 섹션 9에 조건부 항목 준비. PRD 수신 즉시 활성화 여부 판단.
- **VALID_GAMES 회귀 위험**: `RankingService.VALID_GAMES`에 `block-crush` 추가 시 기존 게임 영향 가능성 있음. `docs/review/architecture.md`에서 이미 동일 구조의 `blockfall-insane` 누락 버그 확인된 바 있어, `block-crush` 추가 시 동일 패턴 전수 확인(EXPIRE_SECONDS, VALID_GAMES, validateLevel, validateScoreBounds, queryWeekly, queryAlltimeBest, countByIpHash, saveRanking) 필수.
- **콤보 보너스 타이밍**: PRD §5에서 콤보 보너스 가산 시점(클리어 전 comboCount 기준 vs 클리어 후 증가된 comboCount 기준)이 명확히 기술되지 않음. 점수 계산 시나리오 A 작성 시 가정 사항으로 명시. PRD 확정 즉시 검증.

---

## 다음 액션

| 우선순위 | 작업 | 선행 조건 | 담당 |
|---|---|---|---|
| 즉시 | `docs/specs/block-crush-prd.md` 수신 후 §8 엣지 케이스 및 §5 점수 공식 동기화 | planner PRD 작성 완료 | qa-tester |
| 즉시 | `docs/specs/block-crush-api-contract.md` 수신 후 §4 API 검증 수치/에러 코드 동기화 | planner/developer-backend API 계약 확정 | qa-tester |
| 구현 완료 후 | developer-frontend, developer-backend 구현 완료 시 TC 실행 시작 | 양쪽 구현 완료 신호 수신 | qa-tester |
| 구현 완료 후 | 회귀 테스트(REG-01~REG-06) 실행 | 구현 배포 완료 | qa-tester |
| 구현 완료 후 | 버그 발견 시 `docs/review/block-crush-bugs.md` 작성 | TC 실행 결과 | qa-tester |
