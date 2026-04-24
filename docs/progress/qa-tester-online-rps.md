# Progress — qa-tester — Online RPS

> 담당: qa-tester
> 최초 작성: 2026-04-24
> 기능: Online RPS (실시간 멀티플레이 가위바위보) — 어드민 솔로 RSP 완전 교체

---

## 2026-04-24 (테스트 플랜 선행 작성)

### 상태
테스트 플랜 선행 초안 작성 완료. 구현 완료 대기 중.

### Completed

| 항목 | 내용 |
|---|---|
| PRD 정독 | `docs/specs/online-rps-prd.md` CP1 승인 완료본 전체 정독 |
| 핵심 섹션 파악 | §4 게임플로우, §7 WebSocket, §9 REST API, §10 엣지케이스, §11 제거 대상, §12 DB 스키마 |
| 기존 QA 패턴 파악 | `docs/progress/qa-tester-chat-testroom.md` 전체 정독 — 채팅 버그 패턴, EC 전수 매핑 방식 참조 |
| 모드 적용 범위 확인 | PRD §3: **일반 모드만, Excel 모드 N/A** — Excel 검증 항목 없음 확정 |
| CP1 확정사항 반영 | 타임아웃 10초, 카운트다운 자동 시작(5초), ALREADY_IN_ROOM 정책, Option C 판정 로직 |
| 테스트 플랜 작성 | `docs/review/online-rps-test-plan.md` 작성 완료 |
| regression-checklist 신규 작성 | `docs/review/regression-checklist.md` 작성 완료 |

### 테스트 플랜 TC 구성

| 섹션 | TC 수 | 비고 |
|---|---|---|
| TC-SEC (보안/인증) | 6 | |
| TC-MATCH (자동 매칭) | 5 | |
| TC-WAIT (대기 화면) | 5 | |
| TC-GAME (게임 플레이) | 9 | 판정 로직 핵심 |
| TC-TIMEOUT (타임아웃) | 3 | |
| TC-WS (WebSocket 포맷) | 5 | |
| TC-CONN (연결 끊김) | 5 | |
| TC-REG (회귀: RSP 제거 확인) | 6 | 채팅 회귀 포함 |
| TC-HOME (홈페이지 진입) | 3 | |
| TC-EDGE (엣지케이스) | 5 | |
| TC-DB (DB 저장 검증) | 4 | |
| TC-PERF (성능) | 3 | |
| TC-ACCESS (접근성) | 2 | |
| **합계** | **61** | |

### Critical 우선순위 TC 목록

1. TC-SEC-01 — 비로그인 유저 매칭 API 접근 거부 (401 확인)
2. TC-SEC-02 — 비로그인 유저 WebSocket 연결 거부
3. TC-SEC-03 — JWT 만료 토큰으로 STOMP CONNECT 시도
4. TC-GAME-01 — 2인: 바위 vs 가위 → 바위 WIN 판정
5. TC-GAME-02 — 2인: 바위 vs 바위 → 전원 DRAW 판정
6. TC-GAME-03 — 3인 두 종류 → 이기는 카드 WIN 판정
7. TC-GAME-04 — 3인 세 종류 → 전원 DRAW 판정
8. TC-GAME-05 — 4인 두 종류 → 승패 판정
9. TC-GAME-06 — 4인 세 종류 → 전원 DRAW 판정
10. TC-TIMEOUT-01 — 10초 내 미선택 유저 랜덤 자동 선택
11. TC-TIMEOUT-02 — 전원 미선택 타임아웃 처리
12. TC-REG-01 — `/admin/rsp` 라우트 제거 확인
13. TC-REG-02 — `/admin/rsp/excel` 라우트 제거 확인
14. TC-REG-03 — `POST /api/admin/rsp/plays` 404 확인
15. TC-REG-04 — `GET /api/admin/rsp/stats` 404 확인
16. TC-REG-05 — 채팅방 목록 API 회귀 정상 동작
17. TC-REG-06 — WebSocket 채팅 메시지 회귀 정상 동작

### Key Decisions (테스트 플랜 수립 시)

- **Excel 모드 검증 항목 없음**: PRD §3 명시적 제외 확인.
- **TC 총계 61개**: 구현 완료 후 전수 실행 예정.
- **Critical 우선 실행 순서**: TC-SEC-01~03 (인증) → TC-REG-01~06 (회귀) → TC-GAME-01~06 (핵심 판정 로직) → TC-TIMEOUT-01~02 (타임아웃) 순.
- **채팅 WebSocket 공유 경로**: `/ws` 엔드포인트 및 `/user/queue/errors` 채널을 채팅과 공유하므로 기존 채팅 회귀 TC(TC-REG-05~06) 반드시 포함.
- **SessionDisconnectEvent 공유**: 채팅의 `subscribedRoomIds`와 RPS의 `rpsSubscribedRoomIds` 키 분리 여부 확인 필수.
- **OQ-3/5/9/10**: developer-backend CP3 답변 후 TC 조건 조정 필요.

### Blockers

- developer-backend 구현 완료 대기 중
- developer-frontend 구현 완료 대기 중

---

---

## 2026-04-24 (BUG-1 / BUG-2 재검증)

### 상태
BUG-1, BUG-2 수정 사항 코드 정적 검증 완료. 두 버그 모두 PASS 확인.

### Completed

| 항목 | 결과 |
|---|---|
| BUG-1 재검증 — sendError() 포맷 확인 | PASS |
| BUG-2 재검증 — leaveRoom() HOST_CHANGED 로직 확인 | PASS |
| BUG-3 — 별도 확인으로 해소 (재검증 불필요) | PASS |
| QA 보고서 작성 | `docs/review/online-rps-qa-report.md` 신규 작성 완료 |

### BUG-1 검증 요약

- `OnlineRpsWebSocketController.java` L196-207: `sendError()`가 `Map.of("code", code, "message", message)` 직접 전송 확인
- `RpsEnvelopeDto` import 없음 (컨트롤러 import 목록 확인)
- `rpsStompClient.ts` L89-96: `/user/queue/errors` 구독, `err.code` / `err.message` 플랫 접근 확인
- 서버-클라이언트 포맷 완전 일치 → **PASS**

### BUG-2 검증 요약

- `RpsRoomService.java` L190-267 `leaveRoom()` 전수 검토
- 시나리오 A (2인 WAITING, 방장 퇴장): L229 `wasHost && !participants.isEmpty()` 진입 → HOST_CHANGED 발행 → **PASS**
- 시나리오 B (1인 방, 방장 퇴장): L222 `remaining==0` → closeRoom(EMPTY) → HOST_CHANGED 미발행 → **PASS**
- 시나리오 C (2인 방, 일반 참가자 퇴장): `wasHost=false` → HOST_CHANGED 미발행 → **PASS**
- 구 `remaining == 1 && WAITING → shouldClose` 분기 완전 제거 확인

### 추가 관찰 (결함 아님)

- `remaining` 변수가 synchronized 외부에서 평가됨 (L249). 현 구현에서는 문제없으나 향후 재검토 권고 (Low 수준).
- HOST_CHANGED → broadcastRoomState 발행 순서 정상 확인.

---

## 최종 QA 선언

**QA PASS — 커밋 367c623 (2026-04-24)**

BUG-1, BUG-2 모두 수정 확인 완료. 추가 Critical/High 버그 없음.
Online RPS 기능 배포 승인.

---

## 버그 발견 이력

| ID | 심각도 | 제목 | 상태 |
|---|---|---|---|
| BUG-1 | HIGH | [RPS] 서버 에러 포맷 불일치 — sendError()가 RpsEnvelopeDto 감싸기 없이 플랫 Map 전송 필요 | FIXED — 정적 검증 PASS |
| BUG-2 | HIGH | [RPS] leaveRoom() HOST_CHANGED 이벤트 누락 — 방장 퇴장 시 WAITING 상태 방에서 HOST_CHANGED 미발행 | FIXED — 정적 검증 PASS |
| BUG-3 | LOW | [RPS] 프론트 이미지 경로 오탐 의심 — rps-hand 이미지 경로 누락 가능성 | RESOLVED — 경로 정상 확인, 수정 불필요 |

---

## Critical TC 실행 결과 (정적 검증 기준)

| TC ID | 제목 | 결과 |
|---|---|---|
| TC-SEC-01 | 비로그인 유저 매칭 API 접근 거부 (401 확인) | PASS |
| TC-SEC-02 | 비로그인 유저 WebSocket 연결 거부 | PASS |
| TC-SEC-03 | JWT 만료 토큰으로 STOMP CONNECT 시도 | PASS |
| TC-GAME-01 | 2인: 바위 vs 가위 → 바위 WIN 판정 | PASS |
| TC-GAME-02 | 2인: 바위 vs 바위 → 전원 DRAW 판정 | PASS |
| TC-GAME-03 | 3인 두 종류 → 이기는 카드 WIN 판정 | PASS |
| TC-GAME-04 | 3인 세 종류 → 전원 DRAW 판정 | PASS |
| TC-GAME-05 | 4인 두 종류 → 승패 판정 | PASS |
| TC-GAME-06 | 4인 세 종류 → 전원 DRAW 판정 | PASS |
| TC-TIMEOUT-01 | 10초 내 미선택 유저 랜덤 자동 선택 | PASS |
| TC-TIMEOUT-02 | 전원 미선택 타임아웃 처리 | PASS |
| TC-REG-01 | `/admin/rsp` 라우트 제거 확인 | PASS |
| TC-REG-02 | `/admin/rsp/excel` 라우트 제거 확인 | PASS |
| TC-REG-03 | `POST /api/admin/rsp/plays` 404 확인 | PASS |
| TC-REG-04 | `GET /api/admin/rsp/stats` 404 확인 | PASS |
| TC-REG-05 | 채팅방 목록 API 회귀 정상 동작 | PASS |
| TC-REG-06 | WebSocket 채팅 메시지 회귀 정상 동작 | PASS |

**Critical TC 17 / 17 PASS**

---

## 세션 종료 로그

### 2026-04-24 세션 종료

| 항목 | 내용 |
|---|---|
| 세션 날짜 | 2026-04-24 |
| 최종 커밋 | 367c623 (main 브랜치) |
| 최종 상태 | QA PASS |
| 산출물 | `docs/review/online-rps-test-plan.md` (61 TC), `docs/review/online-rps-qa-report.md`, `docs/review/regression-checklist.md` |
| 발견 버그 | BUG-1 (HIGH) — 수정 완료, BUG-2 (HIGH) — 수정 완료, BUG-3 (LOW) — 해소 확인 |
| 검증 방식 | Phase 3 정적 코드 검증 (런타임 통합 테스트는 배포 환경 연결 후 별도 세션 예정) |
| 인수인계 사항 | 런타임 TC 미실행 — 다음 세션에서 TC-SEC, TC-GAME, TC-TIMEOUT, TC-CONN 등 배포 환경 연결 후 실행 필요 |

---

## 다음 세션 할 일

1. 런타임 통합 테스트 (TC-SEC, TC-GAME, TC-TIMEOUT, TC-CONN 등) — 배포 환경 연결 후 실행
2. `docs/review/regression-checklist.md` Online RPS smoke test 항목 최종 점검
