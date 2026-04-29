# Progress — qa-tester — Yacht (실시간 멀티플레이 야추)

> 담당: qa-tester
> 최초 작성: 2026-04-29
> 기능: Yacht (실시간 멀티플레이 야추) — 2~4인 턴제 주사위 게임

---

## 2026-04-29 (테스트 플랜 선행 작성 — 세션 1 완료)

### 상태
테스트 플랜 선행 초안 작성 완료. 구현 완료 확인됨. E2E 실행은 Railway 배포 후.

### Completed

| 항목 | 내용 |
|---|---|
| PRD 정독 | `docs/specs/yacht-prd.md` CP1 승인 완료본 전체 정독 |
| 핵심 섹션 파악 | §5 야추 룰, §6 WS 명세, §7 연결 끊김 처리, §8 REST API, §9 DB 스키마, §10 엣지케이스, §11 보안 |
| CP1 확정사항 반영 | CP1-1(타임아웃 없음), CP1-2(yacht_win 테이블), CP1-3(ready/start 이벤트) |
| 기존 QA 패턴 참조 | `docs/review/online-rps-test-plan.md`, `docs/review/online-rps-qa-report.md` 참조 |
| 모드 적용 범위 확인 | PRD §3: **일반 모드만, Excel 모드 N/A** — Excel 검증 항목 없음 확정 |
| 테스트 플랜 작성 | `docs/review/yacht-test-plan.md` 작성 완료 (86개 TC) |
| regression-checklist 업데이트 | `docs/review/regression-checklist.md` §2-11 Yacht smoke test 항목 14개 추가, §3 게임 목록에 Yacht 행 추가 |

### 테스트 플랜 TC 구성

| 섹션 | TC 수 | 비고 |
|---|---|---|
| TC-SEC (보안/인증) | 7 | 비로그인 차단 5개 포함 |
| TC-MATCH (자동 매칭) | 6 | ALREADY_IN_ROOM, race condition, rate limit |
| TC-READY (준비/시작 — CP1-3) | 7 | ready/start 이벤트. MATCH_COUNTDOWN 제외 |
| TC-DICE (주사위 굴리기) | 7 | SecureRandom 검증, kept 유지, race condition |
| TC-SCORE (족보 점수 계산) | 19 | Full House/4ofaKind Yacht 충돌 처리 핵심 |
| TC-TURN (턴 순서) | 5 | CP1-1 타임아웃 없음 검증 포함 |
| TC-OVER (게임 종료) | 5 | yacht_win win_count, 동점 처리 |
| TC-CONN (연결 끊김) | 6 | 게임 중 자동 0점 처리 핵심 |
| TC-WS (WebSocket 포맷) | 8 | 경로 격리 검증 포함 |
| TC-DB (DB 저장) | 5 | 읽기 전용, yacht_win 포함 |
| TC-PERF (성능) | 4 | 4인 48턴 완주 포함 |
| TC-ACCESS (접근성) | 2 | 키보드 조작, 색상 대비 |
| TC-REG (회귀) | 8 | 경로 격리 4개 + 기존 게임 smoke test 4개 |
| **합계** | **86** | |

### Critical 우선순위 TC 목록

1. TC-SEC-01 — 비로그인 유저 매칭 API 거부 (401)
2. TC-SEC-02 — 비로그인 유저 WebSocket 연결 거부
3. TC-SEC-03 — 만료된 JWT로 STOMP CONNECT 시도
4. TC-SEC-04 — 비로그인 유저 /topic/yacht/** 구독 차단
5. TC-SEC-05 — 비로그인 유저 /app/yacht/** 발행 차단
6. TC-READY-05 — 방장 /start → GAME_STARTED 브로드캐스트
7. TC-DICE-01 — 첫 굴림 ROLL_RESULT 수신
8. TC-DICE-02 — kept 주사위 값 유지 재굴림
9. TC-DICE-05 — 클라이언트 dice 조작 → 서버 무시
10. TC-DICE-07 — 전원 동일 dice 수신
11. TC-SCORE-01 ~ TC-SCORE-12 — 12개 족보 점수 계산 (핵심 게임 로직)
12. TC-SCORE-07 — Full House에서 Yacht 불인정 (0점)
13. TC-SCORE-08 — Four of a Kind에서 Yacht 인정 (4개 합)
14. TC-SCORE-14 — 상단 63점 이상 보너스 35점 부여
15. TC-SCORE-17 — 클라이언트 score 조작 → 서버 재계산
16. TC-TURN-04 — 2인 24턴 후 GAME_OVER 발생
17. TC-TURN-05 — CP1-1: 타임아웃 없음, 무한 대기 검증
18. TC-OVER-01 — 모든 족보 기록 후 GAME_OVER 브로드캐스트
19. TC-OVER-02 — GAME_OVER.rankings 점수 내림차순
20. TC-OVER-04 — yacht_win win_count++ 검증
21. TC-CONN-04 — 게임 중 비활성 참가자 끊김 자동 0점
22. TC-CONN-05 — 게임 중 현재 턴 플레이어 끊김 자동 0점 + TURN_CHANGED
23. TC-WS-08 — /topic/rps/** ↔ /topic/yacht/** 크로스 수신 없음
24. TC-DB-04 — yacht_win win_count DB 확인
25. TC-REG-01 ~ TC-REG-04 — 기존 RPS/채팅 회귀 검증
26. TC-REG-05 ~ TC-REG-08 — 기존 게임 smoke test

### Key Decisions (테스트 플랜 수립 시)

- **Excel 모드 검증 항목 없음**: PRD §3 명시적 제외 확인.
- **CP1-1 타임아웃 없음**: TC-TURN-05로 "60초 경과 후에도 자동 전환 없음" 검증. PRD §10 EC-11 (타임아웃 자동 0점) 관련 TC 제외.
- **CP1-2 yacht_win 테이블**: TC-OVER-04, TC-OVER-05, TC-DB-04에서 win_count 증가 검증.
- **CP1-3 ready/start**: MATCH_COUNTDOWN TC 없음. TC-READY 섹션 7개로 대체. PRD §4.1 다이어그램/§6.3.2의 MATCH_COUNTDOWN 잔류는 CP1 확정 전 초안이므로 무시.
- **PRD 불일치 발견**: PRD §6.3.4 TURN_STATE에 `turnDeadlineAt` 필드 존재하나 CP1-1 타임아웃 없음 확정으로 실제 타임아웃 미동작. 구현 시 이 필드 송신 여부를 developer-backend가 결정해야 함. 혼란 방지 위해 타임아웃 없음이 확정임을 developer-backend에게 전달 권고.
- **Full House / Four of a Kind Yacht 충돌**: TC-SCORE-07(Full House 0점), TC-SCORE-08(4of4 20점)이 PRD §5.3 핵심 규칙이므로 Critical 처리.
- **보너스 판정 시점**: 상단 6개 모두 기록된 시점에만 검사. TC-SCORE-14에서 이 시점 검증.
- **세션 키 분리**: `yachtSubscribedRoomIds`가 `subscribedRoomIds`(채팅), `rpsSubscribedRoomIds`(RPS)와 분리됨을 TC-REG-04에서 검증.
- **E2E 진입 조건**: developer-backend AND developer-frontend 양쪽 모두 완료 후 검증. 한쪽만 완료된 상태는 반려.

### 테스트 실행 우선순위 순서

1. TC-SEC-01~05 (인증/보안)
2. TC-REG-01~08 (회귀)
3. TC-READY-05 (GAME_STARTED 핵심 흐름)
4. TC-SCORE-07, TC-SCORE-08 (Yacht 충돌 규칙 — 가장 오판정 가능성 높음)
5. TC-SCORE-01~12 (12개 족보 전체)
6. TC-SCORE-14 (보너스 35점)
7. TC-DICE-05, TC-SCORE-17 (조작 방지)
8. TC-CONN-04, TC-CONN-05 (끊김 자동 0점)
9. TC-TURN-04, TC-TURN-05 (게임 종료, 타임아웃 없음)
10. TC-OVER-01~05 (GAME_OVER + win_count)
11. TC-DB-01~05 (DB 저장 검증)
12. 나머지 TC (Medium/Low 순)

### 세션 1 — 구현 측 수정 완료 사항

| 항목 | 수정 내용 | 담당 |
|---|---|---|
| STOMP 엔드포인트 | /ws-yacht → /ws 수정 완료 | developer-frontend |
| 홈 카드 위치 | Test Lab BETA 위치로 변경 완료 | developer-frontend |

### Blockers (세션 1 기준)

- E2E 검증: Railway 배포 완료 대기 중
- 배포 완료 알림 수신 후 Critical TC부터 순차 실행

### PRD 불일치 메모 (기록 유지)

- **PRD §6.3.4 / CP1-1 불일치**: TURN_STATE에 `turnDeadlineAt` 필드 잔류. CP1-1 타임아웃 없음 확정과 충돌. 백엔드 구현에서 해당 필드 포함 여부 확인 필요. 포함 시 클라이언트가 표시용으로만 사용하고 자동 전환 로직은 없어야 함.
- **PRD §4.1/§6.3.2 / CP1-3 불일치**: MATCH_COUNTDOWN 이벤트 잔류. CP1-3 ready/start 확정과 불일치. MATCH_COUNTDOWN 이벤트 실제 발생 시 버그로 처리.

---

## 다음 세션 할 일

1. Railway 배포 완료 알림 수신 후 E2E TC 실행
2. Critical 항목 우선 실행: TC-SCORE-07(Full House Yacht=0), TC-DICE-05(조작 방어), TC-SEC 전체
3. 버그 발견 시 파일경로+재현방법 포함해 해당 developer에게 보고 (`docs/review/yacht-bugs.md` 작성)
4. 백엔드/프론트 양쪽 모두 검증 완료 후 main 머지 승인

---

세션 종료: 2026-04-29. TC 86개 선행 작성 완료. 다음 세션: Railway 배포 후 E2E 실행.
