# 테스트 플랜 — Yacht (실시간 멀티플레이 야추)

- 작성자: qa-tester
- 작성일: 2026-04-29
- 기반 문서: `docs/specs/yacht-prd.md` (CP1 승인 완료본, 2026-04-29)
- 모드 적용 범위: **일반 모드만** (Excel 모드 N/A — PRD §3 명시)
- 상태: **선행 초안 (구현 전 작성)** — 백엔드/프론트엔드 구현 완료 후 TC 실행 예정
- TC 총계: **86개** (TC-SEC 7, TC-MATCH 6, TC-READY 7, TC-DICE 7, TC-SCORE 16, TC-TURN 5, TC-OVER 5, TC-CONN 6, TC-WS 8, TC-DB 5, TC-PERF 4, TC-ACCESS 2, TC-REG 8)

---

## CP1 확정사항 반영 요약

| CP | 내용 | 테스트 영향 |
|---|---|---|
| CP1-1 | 턴 타임아웃 없음 | TC-TURN-05 — 무한 대기 검증, 타임아웃 자동 0점 TC 제외 |
| CP1-2 | 별도 `yacht_win` 테이블 (user_id, win_count) | TC-OVER-04, TC-OVER-05 — win_count 증가 검증 |
| CP1-3 | 전원 준비 + 방장 시작 버튼 (`/ready`, `/start` STOMP) | TC-READY 섹션 7개 — MATCH_COUNTDOWN 패턴 대체 |

> CP1-3 주의: PRD §4.1 플로우 다이어그램 및 §6.3.2에는 MATCH_COUNTDOWN 패턴이 잔류하나, 이는 CP1 확정 전 초안이다. **CP1-3 확정안(ready/start)을 기준으로 검증**한다. MATCH_COUNTDOWN 이벤트가 발생하면 버그로 처리한다.

---

## 우선순위 정의

| 우선순위 | 기준 |
|---|---|
| Critical | 서비스 기동 불가 / 보안 홀 / 데이터 오염 / 게임 로직 오판정 / 회귀로 기존 기능 파손 |
| High | 핵심 게임 플로우 차단 / 잘못된 점수 계산 / 인증 우회 / DB 저장 오류 |
| Medium | 비정상 에러 응답 / UX 흐름 깨짐 / 엣지케이스 미처리 |
| Low | 텍스트 오류 / 미세 타이밍 / 접근성 권장 사항 |

---

## TC-SEC: 보안/인증 (7개)

| TC-ID | 테스트 항목 | 전제조건 | 입력/동작 | 기대 결과 | 우선순위 |
|---|---|---|---|---|---|
| TC-SEC-01 | 비로그인 유저 매칭 API 거부 | JWT 없음 | `POST /api/yacht/match` Authorization 헤더 없이 호출 | HTTP 401, `{ "error": "UNAUTHORIZED" }` | Critical |
| TC-SEC-02 | 비로그인 유저 WebSocket 연결 거부 | JWT 없음 | SockJS+STOMP `/ws` 연결 시도 (token 파라미터 없이) | 핸드셰이크 거부 (HTTP 401 또는 403), STOMP CONNECT 불가 | Critical |
| TC-SEC-03 | 만료된 JWT로 STOMP CONNECT 시도 | 만료 JWT 보유 | `/ws?token=<만료_JWT>`로 연결 시도 | `UNAUTHORIZED` 에러 또는 연결 거부 | Critical |
| TC-SEC-04 | 비로그인 유저 `/topic/yacht/**` 구독 시도 | JWT 없음 | STOMP SUBSCRIBE `/topic/yacht/room/{roomId}` 전송 | StompChannelInterceptor에서 차단, 에러 또는 연결 종료 | Critical |
| TC-SEC-05 | 비로그인 유저 `/app/yacht/**` 발행 시도 | JWT 없음 | STOMP SEND `/app/yacht/room/{roomId}/roll` 전송 | StompChannelInterceptor에서 차단, `UNAUTHORIZED` 에러 | Critical |
| TC-SEC-06 | USER 역할 유저 매칭 가능 | JWT(USER 역할) | `POST /api/yacht/match` | 200 또는 201 응답, roomId 반환 | High |
| TC-SEC-07 | 비로그인 프론트 라우트 차단 | 비로그인 | `/yacht` 또는 `/yacht/play/{roomId}` 직접 URL 접근 | 로그인 페이지 리다이렉트 | High |

---

## TC-MATCH: 자동 매칭 (6개)

| TC-ID | 테스트 항목 | 전제조건 | 입력/동작 | 기대 결과 | 우선순위 |
|---|---|---|---|---|---|
| TC-MATCH-01 | 활성 WAITING 방 없을 때 → 신규 방 생성 | 활성 WAITING 방 없음, 인증 유저 | `POST /api/yacht/match` 호출 | HTTP 201, `{ roomId, status: "WAITING", playerCount: 1, maxPlayers: 4, created: true }` | High |
| TC-MATCH-02 | WAITING 방 있을 때 → 기존 방 합류 | WAITING 방 1개 존재(인원 미달) | 다른 인증 유저가 `POST /api/yacht/match` 호출 | HTTP 200, `{ roomId: <기존 roomId>, status: "WAITING", playerCount: 2, created: false }` | High |
| TC-MATCH-03 | ALREADY_IN_ROOM — WAITING 방 참가 중 재매칭 | 유저가 WAITING 방 참가 중 | `POST /api/yacht/match` 재호출 | HTTP 409, `{ "error": "ALREADY_IN_ROOM", "roomId": "<기존 roomId>" }` | High |
| TC-MATCH-04 | ALREADY_IN_ROOM — PLAYING 방 참가 중 재매칭 | 유저가 PLAYING 방 참가 중 | `POST /api/yacht/match` 호출 | HTTP 409, `{ "error": "ALREADY_IN_ROOM", "roomId": "<기존 roomId>" }` | High |
| TC-MATCH-05 | 5인 동시 매칭 → 4인 방 + 1인 새 방 분리 | 빈 상태에서 5명 동시 요청 | 매칭 API 5인 동시 호출 | 4명이 같은 roomId 배정, 1명이 별도 새 roomId 배정. 정원 4 초과 없음. 분산락 동작 확인. | Medium |
| TC-MATCH-06 | MATCH_RATE_LIMIT — 짧은 시간 내 반복 요청 | 인증 유저 | 10초 내 임계치 초과 횟수로 `POST /api/yacht/match` 연속 호출 | HTTP 429, `{ "error": "MATCH_RATE_LIMIT" }` (임계치 OQ-4 확정 후 구체화) | Medium |

---

## TC-READY: 준비 및 시작 (CP1-3 확정안) (7개)

> 전제: 2인 이상이 WebSocket 연결 + `/join` 발행 후 대기 화면 상태.
> `/ready` 경로: `/app/yacht/room/{roomId}/ready`, `/start` 경로: `/app/yacht/room/{roomId}/start`

| TC-ID | 테스트 항목 | 전제조건 | 입력/동작 | 기대 결과 | 우선순위 |
|---|---|---|---|---|---|
| TC-READY-01 | 비방장이 ready:true 발행 → ROOM_STATE 브로드캐스트 | 2인 대기방, 유저B 비방장 | 유저B: `/ready { "ready": true }` 발행 | 전원에게 `ROOM_STATE` 브로드캐스트. participants에서 유저B의 ready=true 반영 확인. | High |
| TC-READY-02 | 비방장이 ready:false 발행 → 준비 취소 반영 | TC-READY-01 이후, 유저B ready=true 상태 | 유저B: `/ready { "ready": false }` 발행 | `ROOM_STATE` 브로드캐스트, 유저B ready=false로 변경 확인 | High |
| TC-READY-03 | 방장이 /ready 발행 → 무시 또는 INVALID_ACTION | 2인 대기방, 유저A 방장 | 유저A: `/ready { "ready": true }` 발행 | `/user/queue/errors`에 `INVALID_ACTION` 에러 수신 또는 무시 처리. ROOM_STATE에 방장 ready 상태 변경 없음. | Medium |
| TC-READY-04 | 비방장 미준비 상태에서 방장 /start 발행 → NOT_ALL_READY | 2인 대기방, 유저B ready=false | 유저A(방장): `/start {}` 발행 | `/user/queue/errors`에 `NOT_ALL_READY` 에러 수신. 게임 시작 안 됨. | High |
| TC-READY-05 | 모든 비방장 준비 완료 후 방장 /start → GAME_STARTED | 2인 대기방, 유저B ready=true | 유저A(방장): `/start {}` 발행 | 전원에게 `GAME_STARTED` 브로드캐스트. payload에 `turnOrder`, `currentTurnUserId`, `rollsLeft: 3`, `totalRounds` 필드 존재. | Critical |
| TC-READY-06 | 비방장이 /start 발행 → NOT_HOST | 2인 대기방, 전원 준비 완료 상태 | 유저B(비방장): `/start {}` 발행 | `/user/queue/errors`에 `NOT_HOST` 에러 수신. 게임 시작 안 됨. | High |
| TC-READY-07 | 2인 미만 상태에서 방장 /start → NOT_ENOUGH_PLAYERS | 1인 대기방 | 유저A(방장, 혼자): `/start {}` 발행 | `/user/queue/errors`에 `NOT_ENOUGH_PLAYERS` 에러 수신. | High |

---

## TC-DICE: 주사위 굴리기 (7개)

> 전제: 게임 PLAYING 상태, 특별히 명시하지 않으면 현재 턴 플레이어가 발행.
> 발행 경로: `/app/yacht/room/{roomId}/roll`

| TC-ID | 테스트 항목 | 전제조건 | 입력/동작 | 기대 결과 | 우선순위 |
|---|---|---|---|---|---|
| TC-DICE-01 | 첫 굴림 (keptIndices=[]) → ROLL_RESULT 수신 | 현재 턴 플레이어, rollsLeft=3 | `/roll { "keptIndices": [] }` 발행 | 전원에게 `ROLL_RESULT` 브로드캐스트. `dice`는 1~6 정수 5개, `rollsLeft: 2`, `currentTurnUserId` 일치 확인. | Critical |
| TC-DICE-02 | 일부 kept 후 재굴림 → kept 인덱스 값 유지 | rollsLeft=2, 직전 dice=[3,5,2,5,6] | `/roll { "keptIndices": [1, 3] }` 발행 (인덱스 1,3은 5 유지) | `dice[1]` = 5, `dice[3]` = 5 (kept값 유지). 나머지 3개는 새 랜덤값. `rollsLeft: 1`. | Critical |
| TC-DICE-03 | 3회 굴림 후 4번째 /roll → NO_ROLLS_LEFT 에러 | rollsLeft=0 (이미 3회 굴림) | `/roll { "keptIndices": [] }` 발행 | `/user/queue/errors`에 `NO_ROLLS_LEFT` 에러 수신. dice/rollsLeft 변경 없음. | High |
| TC-DICE-04 | 내 턴이 아닌 플레이어가 /roll → NOT_YOUR_TURN 에러 | 유저B 턴 진행 중 | 유저A가 `/roll { "keptIndices": [] }` 발행 | 유저A `/user/queue/errors`에 `NOT_YOUR_TURN` 에러 수신. 게임 상태 변경 없음. | High |
| TC-DICE-05 | 클라이언트 dice 값 조작 → 서버 SecureRandom 사용 검증 | 현재 턴 플레이어 | 개발자 도구로 `/roll` 메시지에 `"dice": [6,6,6,6,6]` 필드 추가해 발행 | 서버가 `dice` 필드 무시, 새 난수 생성. `ROLL_RESULT.dice`는 서버 생성값. 조작된 [6,6,6,6,6]이 아닌 별도 값 수신. | Critical |
| TC-DICE-06 | keptIndices 범위 외 값 → INVALID_KEPT_INDICES 에러 | 현재 턴 플레이어, rollsLeft>0 | `/roll { "keptIndices": [-1, 5] }` 발행 | `/user/queue/errors`에 `INVALID_KEPT_INDICES` 에러 수신. | High |
| TC-DICE-07 | 모든 참가자에게 동일 dice 수신 검증 | 3인 PLAYING 게임, 유저A 턴 | 유저A `/roll {}` 발행 | 유저A, B, C 모두 동일한 `ROLL_RESULT.dice` 배열 수신. 플레이어별 다른 값 브로드캐스트 없음. | Critical |

---

## TC-SCORE: 족보 점수 계산 (서버 검증) (16개)

> 전제: 게임 PLAYING 상태, 현재 턴 플레이어가 최소 1회 굴린 상태.
> 발행 경로: `/app/yacht/room/{roomId}/score`
> 기대 결과: 전원에게 `SCORE_RECORDED` 브로드캐스트 후 `TURN_CHANGED` (게임 미종료 시).

| TC-ID | 테스트 항목 | 전제조건 | 입력/동작 | 기대 결과 | 우선순위 |
|---|---|---|---|---|---|
| TC-SCORE-01 | ONES — [1,1,1,2,3] → 3점 | 현재 dice=[1,1,1,2,3] | `/score { "scoreKey": "ONES" }` | `SCORE_RECORDED.score = 3` | Critical |
| TC-SCORE-02 | SIXES — [6,6,6,6,6] → 30점 | 현재 dice=[6,6,6,6,6] | `/score { "scoreKey": "SIXES" }` | `SCORE_RECORDED.score = 30` | Critical |
| TC-SCORE-03 | CHOICE — [2,3,4,5,6] → 20점 | 현재 dice=[2,3,4,5,6] | `/score { "scoreKey": "CHOICE" }` | `SCORE_RECORDED.score = 20` | Critical |
| TC-SCORE-04 | FOUR_OF_A_KIND — [6,6,6,6,2] → 24점 | 현재 dice=[6,6,6,6,2] | `/score { "scoreKey": "FOUR_OF_A_KIND" }` | `SCORE_RECORDED.score = 24` (6×4=24, 2는 제외) | Critical |
| TC-SCORE-05 | FOUR_OF_A_KIND — [3,3,3,1,2] → 0점 (3개만 동일) | 현재 dice=[3,3,3,1,2] | `/score { "scoreKey": "FOUR_OF_A_KIND" }` | `SCORE_RECORDED.score = 0` (4개 미달) | Critical |
| TC-SCORE-06 | FULL_HOUSE — [3,3,3,5,5] → 19점 | 현재 dice=[3,3,3,5,5] | `/score { "scoreKey": "FULL_HOUSE" }` | `SCORE_RECORDED.score = 19` (3+3+3+5+5) | Critical |
| TC-SCORE-07 | FULL_HOUSE — [6,6,6,6,6] (Yacht) → 0점 | 현재 dice=[6,6,6,6,6] | `/score { "scoreKey": "FULL_HOUSE" }` | `SCORE_RECORDED.score = 0` (Yacht는 Full House 불인정 — counts=[5], listOf(2,3) 아님) | Critical |
| TC-SCORE-08 | FOUR_OF_A_KIND — [5,5,5,5,5] (Yacht) → 20점 인정 | 현재 dice=[5,5,5,5,5] | `/score { "scoreKey": "FOUR_OF_A_KIND" }` | `SCORE_RECORDED.score = 20` (5×4=20, Yacht도 4개 합산 인정) | Critical |
| TC-SCORE-09 | LITTLE_STRAIGHT — [1,2,3,4,5] → 30점 | 현재 dice=[1,2,3,4,5] | `/score { "scoreKey": "LITTLE_STRAIGHT" }` | `SCORE_RECORDED.score = 30` | Critical |
| TC-SCORE-10 | LITTLE_STRAIGHT — [2,3,4,5,6] → 0점 | 현재 dice=[2,3,4,5,6] | `/score { "scoreKey": "LITTLE_STRAIGHT" }` | `SCORE_RECORDED.score = 0` (1-2-3-4-5가 아님) | Critical |
| TC-SCORE-11 | BIG_STRAIGHT — [2,3,4,5,6] → 30점 | 현재 dice=[2,3,4,5,6] | `/score { "scoreKey": "BIG_STRAIGHT" }` | `SCORE_RECORDED.score = 30` | Critical |
| TC-SCORE-12 | YACHT — [4,4,4,4,4] → 50점 | 현재 dice=[4,4,4,4,4] | `/score { "scoreKey": "YACHT" }` | `SCORE_RECORDED.score = 50` | Critical |
| TC-SCORE-13 | 0점 기록 가능 (조건 미충족 족보 선택) | 현재 dice=[1,2,3,4,5], SIXES 미기록 | `/score { "scoreKey": "SIXES" }` | `SCORE_RECORDED.score = 0` (조건 미달) + SCORE_RECORDED 정상 브로드캐스트 | High |
| TC-SCORE-14 | 상단 합계 63점 이상 → 보너스 35점 자동 부여 | 상단 5개 기록, 현재 dice=[6,6,6,6,6], SIXES 미기록, 상단 합계가 SIXES 기록 시 63 이상 | `/score { "scoreKey": "SIXES" }` | `SCORE_RECORDED.bonusEarned = true`, `grandTotal`에 35점 반영. | Critical |
| TC-SCORE-15 | 상단 합계 62점 → 보너스 없음 | 상단 6개 모두 기록, 합계=62 | 이미 모든 상단 기록 완료 상태 재확인 | 직전 SCORE_RECORDED에서 `bonusEarned = false`. 보너스 미부여 | High |
| TC-SCORE-16 | 이미 기록된 scoreKey 재선택 → SCORE_KEY_ALREADY_USED | 현재 플레이어 ONES 이미 기록됨 | `/score { "scoreKey": "ONES" }` | `/user/queue/errors`에 `SCORE_KEY_ALREADY_USED` 에러 수신. 기존 점수 변경 없음. | High |

### TC-SCORE 추가 검증 항목

| TC-ID | 테스트 항목 | 전제조건 | 입력/동작 | 기대 결과 | 우선순위 |
|---|---|---|---|---|---|
| TC-SCORE-17 | 클라이언트 score 값 조작 → 서버 재계산 | 현재 dice=[1,1,1,2,3] | 개발자 도구로 `/score` 메시지에 `"score": 999` 필드 추가해 발행 (scoreKey: "ONES") | 서버가 score 필드 무시, 의사코드대로 재계산하여 3점 기록. `SCORE_RECORDED.score = 3`. | Critical |
| TC-SCORE-18 | scoreKey enum 외 값 → INVALID_SCORE_KEY | 현재 턴 플레이어, 굴림 완료 | `/score { "scoreKey": "LARGE_STRAIGHT" }` | `/user/queue/errors`에 `INVALID_SCORE_KEY` 에러 수신. | High |
| TC-SCORE-19 | 굴리기 전 /score 발행 → MUST_ROLL_FIRST | 턴 시작 직후, rollsLeft=3 (아직 미굴림) | `/score { "scoreKey": "CHOICE" }` | `/user/queue/errors`에 `MUST_ROLL_FIRST` 에러 수신. | High |

---

## TC-TURN: 턴 순서 (5개)

| TC-ID | 테스트 항목 | 전제조건 | 입력/동작 | 기대 결과 | 우선순위 |
|---|---|---|---|---|---|
| TC-TURN-01 | GAME_STARTED 시 turnOrder joinOrder 셔플 후 round-robin | GAME_STARTED 수신 완료 | `GAME_STARTED.payload.turnOrder` 배열 확인 | turnOrder 배열이 참가자 수만큼 존재. 이후 TURN_CHANGED 이벤트가 같은 순서로 반복됨 (round-robin 검증). | High |
| TC-TURN-02 | 내 턴이 아닌 플레이어가 /score → NOT_YOUR_TURN | 유저B 턴 진행 중, 유저A가 굴림 없음 | 유저A가 `/score { "scoreKey": "ONES" }` 발행 | 유저A `/user/queue/errors`에 `NOT_YOUR_TURN` 에러 수신. | High |
| TC-TURN-03 | /score 후 SCORE_RECORDED → TURN_CHANGED 순서 보장 | 현재 턴 플레이어, 굴림 완료 | `/score { "scoreKey": "CHOICE" }` 발행 | 수신 순서: `SCORE_RECORDED` 먼저, 이후 `TURN_CHANGED` 수신. 역순 없음. | High |
| TC-TURN-04 | 2인 게임 기준 총 24턴 후 GAME_OVER | 2인 PLAYING 게임 | 2인이 각 12개 족보를 순서대로 기록 (24턴) | 마지막 SCORE_RECORDED 이후 TURN_CHANGED 대신 GAME_OVER 브로드캐스트. | Critical |
| TC-TURN-05 | CP1-1: 턴 타임아웃 없음 — 무한 대기 검증 | 현재 턴 플레이어 응답 없음 | 현재 턴 플레이어가 60초 이상 /roll 또는 /score 미발행 | 60초 경과 후에도 게임 상태 변경 없음. TURN_CHANGED 자동 발행 없음. 다른 플레이어가 족보 선택 전까지 턴 유지. | Critical |

---

## TC-OVER: 게임 종료 (5개)

| TC-ID | 테스트 항목 | 전제조건 | 입력/동작 | 기대 결과 | 우선순위 |
|---|---|---|---|---|---|
| TC-OVER-01 | 모든 참가자 12개 족보 채워지면 GAME_OVER 브로드캐스트 | 3인 게임, 마지막 1개 족보 기록 직전 | 마지막 참가자 마지막 scoreKey 기록 | 전원에게 `GAME_OVER` 브로드캐스트. `payload.rankings[]` 존재, `payload.roomId` 존재. yacht_room.status = FINISHED 전환. | Critical |
| TC-OVER-02 | GAME_OVER.rankings 점수 내림차순 정렬 검증 | GAME_OVER 수신 | `payload.rankings` 배열 확인 | `grandTotal` 내림차순 정렬됨. 1위가 최고점. `rank` 필드가 순위와 일치. | Critical |
| TC-OVER-03 | 동점 공동 1위 처리 — rank:1 복수, isWinner 복수 | 2인 게임, 최종 grandTotal 동점 | GAME_OVER 수신 | 두 플레이어 모두 `rank: 1`, `isWinner: true`. 나머지 없을 경우 rank:2 미존재. | High |
| TC-OVER-04 | GAME_OVER 후 yacht_win 테이블 1위 win_count++ | 2인 게임, 유저A 최고점으로 종료 | GAME_OVER 수신 후 DB 조회 | `yacht_win` 테이블에서 `user_id=유저A`의 `win_count` 가 1 증가. 유저B의 win_count 변화 없음. | Critical |
| TC-OVER-05 | 동점 공동 1위 시 복수 플레이어 모두 win_count++ | 2인 게임, 동점 종료 | GAME_OVER 수신 후 DB 조회 | `yacht_win` 테이블에서 두 플레이어 모두 `win_count` 각각 1 증가. | High |

---

## TC-CONN: 연결 끊김 처리 (6개)

| TC-ID | 테스트 항목 | 전제조건 | 입력/동작 | 기대 결과 | 우선순위 |
|---|---|---|---|---|---|
| TC-CONN-01 | 대기 중 일반 참가자 끊김 → PLAYER_LEFT + ROOM_STATE 갱신 | 3인 대기방, 유저B 일반 참가자 | 유저B 브라우저 탭 닫기 (SessionDisconnectEvent) | 유저A, C에게 `PLAYER_LEFT(reason: DISCONNECT)` + `ROOM_STATE` 갱신 (participants 감소) | High |
| TC-CONN-02 | 대기 중 방장 끊김 (다른 참가자 있음) → 방장 이전 | 2인 대기방, 유저A 방장 | 유저A 연결 끊김 | 유저B에게 방장 이전 알림 (HOST_CHANGED 또는 ROOM_STATE에 새 방장 반영) + ROOM_STATE 갱신 | High |
| TC-CONN-03 | 대기 중 방장 끊김 (혼자) → ROOM_CLOSED | 1인 대기방, 유저A 방장 | 유저A 연결 끊김 | `ROOM_CLOSED(reason: HOST_LEFT_ALONE 또는 EMPTY)` 브로드캐스트. 방 FINISHED 전환. | High |
| TC-CONN-04 | 게임 중 비활성 참가자 끊김 → 남은 족보 전체 0점 자동 기록 | 3인 PLAYING 게임, 유저C 비활성 | 유저C 연결 끊김 | `PLAYER_LEFT` 브로드캐스트. 유저C의 미기록 족보 전체에 0점 자동 기록 (`SCORE_RECORDED` × 미기록 수). 유저A, B는 게임 계속 진행. | Critical |
| TC-CONN-05 | 게임 중 현재 턴 플레이어 끊김 → 자동 0점 + TURN_CHANGED | 3인 PLAYING 게임, 유저A 현재 턴 | 유저A 연결 끊김 | 유저A 미기록 족보 전체 0점 자동 기록 + `TURN_CHANGED`로 유저B 턴으로 즉시 이전. 게임 계속 진행. | Critical |
| TC-CONN-06 | 게임 중 전원 끊김 → ROOM_CLOSED(EMPTY) | 2인 PLAYING 게임 | 두 유저 모두 연결 끊김 | `ROOM_CLOSED(reason: EMPTY)` 브로드캐스트 또는 DB soft-close. yacht_room.status = FINISHED. | High |

---

## TC-WS: WebSocket 이벤트 포맷 검증 (8개)

> 모든 이벤트는 `{ "type": "<EVENT_TYPE>", "timestamp": "...", "payload": { ... } }` envelope 포맷 준수.

| TC-ID | 테스트 항목 | 전제조건 | 입력/동작 | 기대 결과 | 우선순위 |
|---|---|---|---|---|---|
| TC-WS-01 | ROOM_STATE 포맷 검증 | `/join` 발행 후 | ROOM_STATE 수신 | `type: "ROOM_STATE"`, `timestamp`, `payload.roomId`, `payload.status`, `payload.maxPlayers`, `payload.participants[]` (userId, nickname 포함) 필드 모두 존재 | High |
| TC-WS-02 | GAME_STARTED 포맷 검증 | 방장 /start 완료 후 | GAME_STARTED 수신 | `payload.roomId`, `payload.turnOrder[]`, `payload.currentTurnUserId`, `payload.rollsLeft: 3`, `payload.totalRounds` 필드 모두 존재 | High |
| TC-WS-03 | ROLL_RESULT 포맷 검증 | /roll 발행 후 | ROLL_RESULT 수신 | `payload.dice[]` (5개 정수), `payload.keptIndices[]`, `payload.rollsLeft` (2 또는 1 또는 0), `payload.currentTurnUserId` 모두 존재 | High |
| TC-WS-04 | SCORE_RECORDED 포맷 검증 | /score 발행 후 | SCORE_RECORDED 수신 | `payload.userId`, `payload.scoreKey`, `payload.score`, `payload.upperTotal`, `payload.bonusEarned` (boolean), `payload.grandTotal` 모두 존재 | High |
| TC-WS-05 | TURN_CHANGED 포맷 검증 | /score 후 SCORE_RECORDED 다음 | TURN_CHANGED 수신 | `payload.previousTurnUserId`, `payload.currentTurnUserId`, `payload.rollsLeft: 3`, `payload.roundNum` 모두 존재 | High |
| TC-WS-06 | GAME_OVER 포맷 검증 | 마지막 족보 기록 후 | GAME_OVER 수신 | `payload.roomId`, `payload.rankings[]` 존재. rankings 각 항목에 `userId`, `nickname`, `grandTotal`, `rank`, `isWinner` 필드 모두 존재 | High |
| TC-WS-07 | PLAYER_LEFT reason enum 정확성 | 게임 중 또는 대기 중 | 자발 퇴장: `/leave {}` / 연결 끊김: 탭 닫기 | 자발 퇴장 시 `reason: "LEAVE"`, 연결 끊김 시 `reason: "DISCONNECT"` | Medium |
| TC-WS-08 | /topic/rps/** ↔ /topic/yacht/** 경로 격리 검증 | RPS와 Yacht 동시 구독 | RPS 방에서 이벤트 발행, Yacht 구독 클라이언트가 RPS 이벤트 수신하는지 확인 (역방향도) | `/topic/yacht/**` 구독자가 `/topic/rps/**` 이벤트 수신하지 않음. 크로스 수신 없음. | Critical |

---

## TC-DB: 데이터 저장 검증 (5개)

> Railway 프로덕션 DB 쓰기 쿼리 절대 금지 — 읽기 전용 조회만.

| TC-ID | 테스트 항목 | 전제조건 | 입력/동작 | 기대 결과 | 우선순위 |
|---|---|---|---|---|---|
| TC-DB-01 | 게임 완료 후 yacht_room.status = FINISHED | GAME_OVER 발생 후 | `SELECT status FROM yacht_room WHERE room_id = ?` | `status = 'FINISHED'`. `closed_at` NOT NULL. | High |
| TC-DB-02 | yacht_score row 수 = 참가자 수 × 12 | 3인 게임 완료 후 | `SELECT COUNT(*) FROM yacht_score WHERE room_id = ?` | COUNT = 36 (3명 × 12개 족보). null 또는 누락 row 없음. | High |
| TC-DB-03 | yacht_participant 최종 점수 및 is_winner 저장 | 2인 게임 완료 후 | `SELECT final_grand_total, is_winner FROM yacht_participant WHERE room_id = ?` | 두 row 모두 final_grand_total NOT NULL. 승자 is_winner=1, 패자 is_winner=0. | High |
| TC-DB-04 | yacht_win 테이블 win_count 증가 확인 | 게임 완료 후 | `SELECT win_count FROM yacht_win WHERE user_id = ?` | 승자 user_id의 win_count가 이전 대비 1 증가. 패자 win_count 변화 없음. | Critical |
| TC-DB-05 | yacht_score score_value 범위 및 유효성 | 게임 완료 후 | `SELECT score_key, score_value FROM yacht_score WHERE room_id = ?` | 모든 score_value가 0~50 범위. YACHT=50 초과 없음. NULL 없음. score_key가 12종 enum 내. | High |

---

## TC-PERF: 성능 (4개)

| TC-ID | 테스트 항목 | 전제조건 | 입력/동작 | 기대 결과 | 우선순위 |
|---|---|---|---|---|---|
| TC-PERF-01 | `POST /api/yacht/match` 응답 시간 | DB/Redis 정상 상태 | 순차 10회 매칭 요청 | p95 응답 시간 500ms 이내 | Medium |
| TC-PERF-02 | ROLL_RESULT 브로드캐스트 지연 | 4인 방 게임 중 | /roll 발행 후 ROLL_RESULT 수신까지 | 4인 기준 브로드캐스트 지연 200ms 이내 | Medium |
| TC-PERF-03 | 분산락 타임아웃 시 503 반환 | Redis 락 응답 지연 시뮬레이션 | 매칭 요청 중 Redis 일시 불가 상태 유도 | HTTP 503, `{ "error": "MATCH_UNAVAILABLE" }` — 서버 크래시 없음 | Medium |
| TC-PERF-04 | 4인 × 12라운드 (48턴) 전체 게임 완주 | 4인 게임 정상 진행 | 48턴 전체 진행 후 GAME_OVER 수신 | GAME_OVER 정상 도달. DB 192개 score row (4×12×12... — 정확히 4명×12=48 score row). 서버 메모리 누수 없음. | Medium |

---

## TC-ACCESS: 접근성 (2개)

| TC-ID | 테스트 항목 | 전제조건 | 입력/동작 | 기대 결과 | 우선순위 |
|---|---|---|---|---|---|
| TC-ACCESS-01 | 키보드로만 게임 진행 가능 여부 | 게임 화면, PLAYING 상태, 현재 턴 | Tab으로 "굴리기" 버튼 포커스, Enter로 굴림. Tab으로 족보 선택, Enter로 기록. | 마우스 없이 키보드만으로 굴림 + 족보 선택 완료 가능 | Low |
| TC-ACCESS-02 | 색상 대비 — 점수판 텍스트 | 게임 화면 점수판 | 점수판 텍스트 색상 vs 배경 색상 측정 | WCAG AA 기준 최소 4.5:1 대비비 충족 | Low |

---

## TC-REG: 회귀 테스트 (8개)

### Yacht 네임스페이스 격리

| TC-ID | 테스트 항목 | 전제조건 | 입력/동작 | 기대 결과 | 우선순위 |
|---|---|---|---|---|---|
| TC-REG-01 | Online RPS 매칭/플레이 정상 동작 | Online RPS 배포 상태 | `POST /api/rps/match` 후 WebSocket 연결, 카드 선택 | ROOM_STATE, ROUND_RESULT 정상 수신. Yacht 추가로 영향 없음 확인. | Critical |
| TC-REG-02 | `/topic/rps/**` ↔ `/topic/yacht/**` 경로 격리 | RPS와 Yacht 동시 접속 | RPS 방 참가 중 Yacht 방 참가. 각 방에서 이벤트 발행. | 각 topic 구독자가 다른 topic 이벤트를 수신하지 않음. | Critical |
| TC-REG-03 | 채팅 테스트룸 동작 영향 없음 | 채팅 기능 정상 배포 | `GET /api/chat/rooms` + WebSocket 채팅 메시지 발행 | 채팅 기능 정상. Yacht 추가로 채팅 영향 없음. | Critical |
| TC-REG-04 | `yachtSubscribedRoomIds` 세션 키 분리 확인 | 채팅, RPS, Yacht 동시 접속 | 각각 대기방/채팅방 참가 후 Yacht 세션 끊김 | Yacht 끊김 처리가 채팅/RPS 세션에 영향 없음. `yachtSubscribedRoomIds`가 `subscribedRoomIds`(채팅), `rpsSubscribedRoomIds`(RPS)와 분리됨. | Critical |

### 기존 게임 Smoke Test

| TC-ID | 테스트 항목 | 확인 항목 | 기대 결과 | 우선순위 |
|---|---|---|---|---|
| TC-REG-05 | Blockfall (일반) smoke test | 페이지 로드, 게임 시작, 점수 등록(HMAC), 랭킹 조회 | 전 항목 정상 동작. Yacht 배포로 영향 없음. | Critical |
| TC-REG-06 | Blockfall Insane smoke test | 페이지 로드, 게임 시작, insane 이벤트, 점수 등록 | 전 항목 정상 동작 | Critical |
| TC-REG-07 | Minesweeper smoke test | 페이지 로드, 게임 시작, 완료 처리 | 전 항목 정상 동작 | Critical |
| TC-REG-08 | SecurityConfig 기존 경로 우선순위 검증 | `/api/yacht/**` 규칙 추가 후 | 기존 `/api/admin/**`, `/api/chat/**`, `/api/rps/**`, `/api/rankings/**` 규칙 정상 동작. 우선순위 변경 없음. | Critical |

---

## 모드 검증 섹션

Excel 모드: **N/A** — PRD §3에서 명시적으로 제외됨. "일반 모드만, Excel 모드 없음" 지시 확인됨.
Excel 모드 검증 항목 없음.

---

## PRD 엣지케이스 전수 매핑 (EC-1 ~ EC-20)

| EC-ID | 상황 요약 | 대응 TC |
|---|---|---|
| EC-1 | 비로그인 `/api/yacht/match` 호출 | TC-SEC-01 |
| EC-2 | 비로그인 STOMP 구독 시도 | TC-SEC-04, TC-SEC-02 |
| EC-3 | 5번째 유저 매칭 → 새 방 생성 | TC-MATCH-05 |
| EC-4 | PLAYING 방 재진입 시도 | TC-SEC-07, TC-MATCH-04 |
| EC-5 | 다른 유저 턴에 roll 시도 | TC-DICE-04 |
| EC-6 | rollsLeft=0인데 roll 시도 | TC-DICE-03 |
| EC-7 | 한 번도 굴리지 않고 score 시도 | TC-SCORE-19 |
| EC-8 | 이미 기록된 score_key 재선택 | TC-SCORE-16 |
| EC-9 | keptIndices에 -1, 5, 중복 등 | TC-DICE-06 |
| EC-10 | scoreKey가 enum 외 | TC-SCORE-18 |
| EC-11 | 턴 타임아웃 (CP1-1: 타임아웃 없음) | TC-TURN-05 (무한 대기 검증) — 자동 0점 TC 제외 |
| EC-12 | 게임 중 현재 turn 플레이어 끊김 | TC-CONN-05 |
| EC-13 | 게임 중 비활성 플레이어 끊김 | TC-CONN-04 |
| EC-14 | 게임 중 잔존 1명만 남음 | ROOM_CLOSED(INSUFFICIENT_PLAYERS) — TC-CONN 추가 예정 (OQ-3 답변 후) |
| EC-15 | 카운트다운 중 1인 감소 (CP1-3 변경으로 카운트다운 없음) | N/A — CP1-3 확정 후 대기방 인원 감소 시 ready 상태 초기화 여부는 TC-READY-02 커버 |
| EC-16 | 이미 활성 방 참가 중 재매칭 | TC-MATCH-03, TC-MATCH-04 |
| EC-17 | dice 클라이언트 조작 시도 | TC-DICE-05 |
| EC-18 | 동시 굴림 race condition | TC-PERF-03 유사, 구현 후 TC 추가 예정 |
| EC-19 | GAME_OVER 직후 `/leave` 발행 | Medium — GAME_OVER 이후 상태 정상 처리 확인, 구현 후 TC 추가 예정 |
| EC-20 | 빈 방 TTL 경과 | OQ-1 답변(CP3) 후 TC 추가 예정 |

---

## 회귀 영향 평가

### 공통 모듈 변경 영향

| 변경 영역 | 영향 범위 | 회귀 검증 TC |
|---|---|---|
| SecurityConfig `/api/yacht/**` 추가 | 기존 모든 경로 우선순위 | TC-REG-08 |
| `/ws` 엔드포인트 공유 | 채팅, RPS 전체 | TC-REG-01, TC-REG-03 |
| StompChannelInterceptor `/app/yacht/**` 분기 추가 | 기존 채팅/RPS 경로 처리 | TC-REG-01, TC-REG-03 |
| SessionDisconnectEvent `yachtSubscribedRoomIds` 추가 | 채팅 `subscribedRoomIds`, RPS `rpsSubscribedRoomIds` 간섭 가능성 | TC-REG-04 |
| `/user/queue/errors` 채널 공유 | 기존 채팅/RPS 에러 처리 | 에러 코드 네임스페이스 분리 확인 필요 |

---

## 반려 기준 체크리스트

다음 조건 중 하나라도 해당되면 PR 반려 및 담당 developer에게 차단 메시지:

- [ ] PRD §3: "Excel 모드 N/A" 명시인데 Excel 관련 코드가 추가된 경우
- [ ] TC-SEC-01 ~ TC-SEC-05: 비인증 접근 허용 발견 시
- [ ] TC-SCORE-07: Yacht 주사위 5개 동일 시 Full House 인정 (0점이어야 함)
- [ ] TC-SCORE-08: Yacht 주사위 5개 동일 시 Four of a Kind 미인정 (4개 합 인정해야 함)
- [ ] TC-SCORE-14: 상단 합계 ≥ 63 시 보너스 35점 미부여
- [ ] TC-DICE-05, TC-SCORE-17: 클라이언트 조작값이 서버에 적용되는 경우
- [ ] TC-TURN-04, TC-OVER-01: 모든 족보 기록 후 GAME_OVER 미발행
- [ ] TC-OVER-04: GAME_OVER 후 yacht_win win_count 미증가
- [ ] TC-CONN-04, TC-CONN-05: 끊김 유저 자동 0점 미처리로 게임 정체
- [ ] TC-REG-01 ~ TC-REG-04: 기존 기능 (RPS, 채팅) 회귀 파손 발견 시
- [ ] TC-WS-08: /topic/rps/** ↔ /topic/yacht/** 크로스 수신 발견 시
- [ ] TC-READY-05: 방장 /start 후 GAME_STARTED 미발행
- [ ] backend + frontend 양쪽 모두 완료되지 않은 상태로 E2E 검증 요청 시

---

## 테스트 환경 요구사항

| 항목 | 요구사항 |
|---|---|
| 브라우저 | Chrome 최신 (기준), Firefox 추가 확인 |
| 동시 접속 유저 시뮬레이션 | 최소 4개 탭/브라우저 세션 (4인 게임 TC) |
| 네트워크 | 일반망 + 지연 시뮬레이션 (DevTools Network Throttle) |
| DB 접근 | 읽기 전용 조회 (TC-DB 항목) — Railway 프로덕션 쓰기 쿼리 금지 |
| WebSocket 도구 | STOMP over SockJS 지원 클라이언트 (wscat + STOMP 라이브러리 또는 브라우저 DevTools) |
| 3D 렌더링 | three.js + gsap 로드 확인 (WebGL 지원 브라우저 필수) |
| 환경 | 로컬 개발 환경 우선 — 프로덕션 직접 E2E는 사용자 승인 후 |
| 선행 조건 | developer-backend AND developer-frontend 구현 완료 — 어느 한쪽만 완료된 PR은 반려 |

---

## 미결 사항 (구현 확정 후 TC 업데이트 필요)

| ID | 항목 | 담당 | TC 업데이트 시점 |
|---|---|---|---|
| OQ-1 | 빈 방 TTL 자동 close (10분 제안) — 확정 시 EC-20 TC 추가 | developer-backend | CP3 |
| OQ-2 | 끊김 시 자동 0점 기록 우선순위 (미사용 첫 항목? CHOICE?) | developer-backend | CP3 — TC-CONN-04/05 조건 구체화 |
| OQ-3 | 게임 중 잔존 1명 단독 승리 인정 여부 | planner | CP3 — EC-14 TC 추가 |
| OQ-4 | 매칭 Rate Limit 임계치 확정 | developer-backend | CP3 — TC-MATCH-06 조건 조정 |
| OQ-5 | 4인 꽉 찼을 때 즉시 게임 시작 vs 방장 /start 대기 | developer-backend | CP3 — TC-READY 조건 조정 가능성 |
| EC-18 | 동시 굴림 race condition (동일 turnUserId 두 번 roll) | developer-backend | CP3 — TC 추가 예정 |
| EC-19 | GAME_OVER 직후 /leave 발행 처리 | developer-backend | CP3 — TC 추가 예정 |
