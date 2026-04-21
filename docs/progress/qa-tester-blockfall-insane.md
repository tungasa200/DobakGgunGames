# QA 진행 로그 — BlockfallInsaneBoard 전면 개편

> 담당: qa-tester
> 최초 작성: 2026-04-22
> 기능: BlockfallInsaneBoard 샌드 이펙트/광기 연출/이벤트 동작 전면 개편

## 오늘 완료 (2026-04-22)

| 항목 | 내용 |
|---|---|
| 리서치 | `docs/블록폴 인세인모드(Insane mode) 작업계획.md` 섹션 0/4/11 정독 완료 |
| 리서치 | `BlockfallInsaneBoard.tsx` 전체 훑기 — 이벤트 18종 발동/종료 로직 위치 파악 완료 |
| 리서치 | `BlockfallBoard.tsx` 일반 모드 회귀 기준 확보 완료 |
| 테스트 플랜 초안 | `docs/review/blockfall-insane-test-plan.md` 10개 섹션 풀 버전 작성 완료 (구현 대기 중 선행 초안) |
| 알려진 이슈 정리 | BOARD_TILT 1회 전환 이슈, SPIN_BLOCK 플래그 덮어쓰기, BOARD_EXPAND 모바일 CSS 충돌 파악 |
| 고위험 항목 식별 | FLOOR_DROP/BOARD_EXPAND ctx.scale 재적용 누락 위험, FULL_SAND 전환 프레임 부하 위험 |

> 주: 저장된 테스트 플랜 파일에는 team-lead가 저장 과정에서 planner PRD 확정본 수치(SAND_TICK_INTERVAL 45, SAND_BATCH_SIZE 35, bounces 5, damping 0.60, alpha 0.75/0.90, LIQUID_FLOOD boardW*6 등)를 섹션 3/4/부록 B에 추가 반영함. qa-tester 원본 초안은 planner 확정본 수신 전 작성되었음.

## 이월 사항 (미완료 / 확정 대기)

| 우선순위 | 항목 | 사유 |
|---|---|---|
| 필수 | 실제 테스트 케이스 실행 | developer-frontend 구현 완료 대기 중 |
| 필수 | planner 이벤트 재정의 목록 기반 섹션 2 최종 재검토 | team-lead 저장본의 planner 보강 반영 검수 |
| 필수 | Screen Shake 실제 구현 검증 | 현 코드 미구현, developer-frontend 구현 후 canvas translate 동작 확인 필요 |
| 필수 | 경고 Flash 실제 구현 검증 | 현 코드 미구현, developer-frontend 구현 후 HIGH/LOW 등급 동작 확인 필요 |
| 필수 | BOARD_TILT 지속 기울기 개선 동작 확인 | planner 재구현 스펙(지속 vx 증분 + settled 재검사) 실제 구현 검증 필요 |
| 필수 | 난이도 선택 UI 제거 완료 확인 | 실제 구현 완료 후 `/blockfall-insane` 접속 확인 |
| 권장 | 디버그 훅(`window.__fireInsaneEvent`) 노출 요청 | developer-frontend에 전달 필요 |

## 다음 단계

1. developer-frontend에 디버그 훅 노출 요청 메시지 전달
2. developer-frontend 구현 완료 신호 수신 후 테스트 케이스 순차 실행
   - 우선 실행: Lint/Build 게이트(섹션 10) → 어드민 접근 회귀(섹션 7) → 이벤트별 검증(섹션 2)
3. 실제 구현물에 대해 광기 연출(Screen Shake / 색 왜곡 / 경고 Flash / 대형 배너) 동작 검증
4. 이슈 발견 시 `docs/review/blockfall-insane-bugs.md` 작성 + 해당 developer 직접 메시지
5. 회귀 이슈(BlockfallBoard 파손 등) 발견 시 즉시 PR 반려 + developer-frontend 차단 메시지

## 반려 기준

- Screen Shake / 글리치 Flash 미구현으로 이벤트 발동이 배너 없이 0.5초 내 인지 불가 시 반려
- 어드민 접근 회귀 실패 시 즉시 반려
- 일반 BlockfallBoard 기능 파손 발견 시 즉시 반려
- FLOOR_DROP / BOARD_EXPAND ctx.scale 재적용 누락으로 렌더 파괴 시 Critical 버그 처리
- 오디오 관련 코드가 인세인 모드에 신규 추가된 경우 즉시 반려 (영구 제외 방침 위배)
