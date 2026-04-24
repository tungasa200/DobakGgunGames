# 테스트 플랜 — Online RPS (실시간 멀티플레이 가위바위보)

- 작성자: qa-tester
- 작성일: 2026-04-24
- 기반 문서: `docs/specs/online-rps-prd.md` (CP1 승인 완료본)
- 모드 적용 범위: **일반 모드만** (Excel 모드 N/A — PRD §3 명시)
- 상태: **선행 초안 (구현 전 작성)** — 구현 완료 후 TC 실행 예정
- TC 총계: **61개** (TC-SEC 6, TC-MATCH 5, TC-WAIT 5, TC-GAME 9, TC-TIMEOUT 3, TC-WS 5, TC-CONN 5, TC-REG 6, TC-HOME 3, TC-EDGE 5, TC-DB 4, TC-PERF 3, TC-ACCESS 2)

---

## 우선순위 정의

| 우선순위 | 기준 |
|---|---|
| Critical | 서비스 기동 불가 / 보안 홀 / 데이터 오염 / 회귀로 기존 기능 파손 |
| High | 핵심 게임 플로우 차단 / 잘못된 승패 판정 / 인증 우회 |
| Medium | 비정상 에러 응답 / UX 흐름 깨짐 / 엣지케이스 미처리 |
| Low | 텍스트 오류 / 미세 타이밍 차이 / 접근성 권장 사항 |

---

## TC-SEC: 보안/인증 (6개)

| TC-ID | 테스트 항목 | 전제조건 | 입력/동작 | 기대 결과 | 우선순위 |
|---|---|---|---|---|---|
| TC-SEC-01 | 비로그인 유저 매칭 API 접근 거부 | JWT 없음 | `POST /api/rps/match` Authorization 헤더 없이 호출 | HTTP 401 반환, 응답 body `{ "error": "UNAUTHORIZED" }` | Critical |
| TC-SEC-02 | 비로그인 유저 WebSocket 연결 거부 | JWT 없음 | SockJS+STOMP `/ws` 연결 시도 (token 파라미터 없이) | 핸드셰이크 거부 (HTTP 401 또는 403), STOMP CONNECT 불가 | Critical |
| TC-SEC-03 | JWT 만료 토큰으로 STOMP CONNECT 시도 | 만료된 JWT 보유 | `/ws?token=<만료_JWT>`로 연결 시도 후 STOMP CONNECT 프레임 전송 | `UNAUTHORIZED` 에러, 연결 종료 — `/user/queue/errors`에 에러 수신 또는 연결 거부 | Critical |
| TC-SEC-04 | USER 역할 유저 매칭 가능 | JWT(USER 역할) 보유 | `POST /api/rps/match` 호출 | 200 또는 201 응답, roomId 반환 — ADMIN 전용 아님 확인 | High |
| TC-SEC-05 | FRIEND 역할 유저 매칭 가능 | JWT(FRIEND 역할) 보유 | `POST /api/rps/match` 호출 | 200 또는 201 응답, roomId 반환 | High |
| TC-SEC-06 | ADMIN 역할 유저 매칭 가능 | JWT(ADMIN 역할) 보유 | `POST /api/rps/match` 호출 | 200 또는 201 응답, roomId 반환 — 기존 솔로 RSP와 달리 전체 로그인 유저 접근 가능 확인 | High |

---

## TC-MATCH: 자동 매칭 (5개)

| TC-ID | 테스트 항목 | 전제조건 | 입력/동작 | 기대 결과 | 우선순위 |
|---|---|---|---|---|---|
| TC-MATCH-01 | 대기방 없을 때 매칭 → 신규 방 생성 | 활성 WAITING 방 없음, 인증된 유저 | `POST /api/rps/match` 호출 | HTTP 201 Created, 응답 body `{ roomId, status: "WAITING", playerCount: 1, maxPlayers: 4, created: true }` | High |
| TC-MATCH-02 | 대기방 있을 때 매칭 → 기존 방 합류 | WAITING 방 1개 존재 (인원 미달), 다른 인증된 유저 | `POST /api/rps/match` 호출 | HTTP 200 OK, 응답 body `{ roomId: <기존 방 ID>, status: "WAITING", playerCount: 2, created: false }` | High |
| TC-MATCH-03 | WAITING 방 참여 중 재매칭 시도 → 409 | 유저가 이미 WAITING 방에 존재 | `POST /api/rps/match` 재호출 | HTTP 409, 응답 body `{ "error": "ALREADY_IN_ROOM", "roomId": "<기존 roomId>" }` | High |
| TC-MATCH-04 | PLAYING 방 참여 중 재매칭 시도 → 409 | 유저가 PLAYING 중인 방에 존재 | `POST /api/rps/match` 호출 | HTTP 409, `{ "error": "ALREADY_IN_ROOM", "roomId": "<기존 roomId>" }` | High |
| TC-MATCH-05 | 4인 정원 꽉 찬 방에 추가 매칭 → 새 방 생성 | WAITING 방이 있으나 currentPlayers == maxPlayers(4) | `POST /api/rps/match` 호출 | HTTP 201, 새 roomId 반환, `created: true` — 정원 초과 방에 합류하지 않음 | High |

---

## TC-WAIT: 대기 화면 (5개)

| TC-ID | 테스트 항목 | 전제조건 | 입력/동작 | 기대 결과 | 우선순위 |
|---|---|---|---|---|---|
| TC-WAIT-01 | `/join` 발행 후 ROOM_STATE 수신 | 매칭 완료, WebSocket 연결, 구독 설정 | `/app/rps/room/{roomId}/join` 발행 (body `{}`) | `/topic/rps/room/{roomId}` 에서 `ROOM_STATE` 메시지 수신, type/timestamp/payload 포맷 일치 | High |
| TC-WAIT-02 | 2번째 유저 입장 시 양쪽에 ROOM_STATE 브로드캐스트 | 유저A 대기 중 | 유저B 매칭 후 `/join` 발행 | 유저A, 유저B 양쪽 모두 `ROOM_STATE` 수신, participants 배열에 양쪽 userId/nickname 포함 | High |
| TC-WAIT-03 | 2인 충족 → MATCH_COUNTDOWN 수신 | 유저A 대기 중, 유저B 방금 입장 | 유저B `/join` 발행 완료 | 양쪽 모두 `MATCH_COUNTDOWN` 수신, `secondsRemaining: 5`, `startAt` 필드 존재 | High |
| TC-WAIT-04 | 카운트다운 중 1명 퇴장 → MATCH_COUNTDOWN_CANCELLED | 2인 카운트다운 진행 중 | 유저B가 연결 끊김 또는 `/leave` 발행 | 유저A에게 `MATCH_COUNTDOWN_CANCELLED` 수신, reason 포함 — 카운트다운 중단 | High |
| TC-WAIT-05 | 퇴장 후 재진입으로 다시 2명 → 새 카운트다운 시작 | TC-WAIT-04 이후 유저A 혼자 대기 | 유저C가 매칭 후 입장 | `MATCH_COUNTDOWN` 재수신, secondsRemaining 리셋됨 | Medium |

---

## TC-GAME: 게임 플레이 (9개)

| TC-ID | 테스트 항목 | 전제조건 | 입력/동작 | 기대 결과 | 우선순위 |
|---|---|---|---|---|---|
| TC-GAME-01 | 2인: 바위 vs 가위 → 바위 WIN, 가위 LOSS | 2인 게임 PLAYING | 유저A: ROCK, 유저B: SCISSORS | `ROUND_RESULT` — 유저A result: WIN, 유저B result: LOSS | Critical |
| TC-GAME-02 | 2인: 바위 vs 바위 → 전원 DRAW | 2인 게임 PLAYING | 유저A: ROCK, 유저B: ROCK | `ROUND_RESULT` — 유저A result: DRAW, 유저B result: DRAW | Critical |
| TC-GAME-03 | 3인: 바위 2명 vs 가위 1명 → 두 종류 → 바위 WIN | 3인 게임 PLAYING | 유저A: ROCK, 유저B: ROCK, 유저C: SCISSORS | 유저A/B: WIN, 유저C: LOSS | Critical |
| TC-GAME-04 | 3인: 바위 vs 가위 vs 보 → 세 종류 → 전원 DRAW | 3인 게임 PLAYING | 유저A: ROCK, 유저B: SCISSORS, 유저C: PAPER | 유저A/B/C 모두 result: DRAW | Critical |
| TC-GAME-05 | 4인: 바위 2명 vs 가위 2명 → 바위 WIN | 4인 게임 PLAYING | 유저A,B: ROCK, 유저C,D: SCISSORS | 유저A/B: WIN, 유저C/D: LOSS | Critical |
| TC-GAME-06 | 4인: 세 종류 나옴 → 전원 DRAW | 4인 게임 PLAYING | 유저A: ROCK, 유저B: PAPER, 유저C: SCISSORS, 유저D: ROCK | 모두 result: DRAW (3종류 나옴) | Critical |
| TC-GAME-07 | 전원 선택 완료 시 타임아웃 전 즉시 결과 처리 | 2인 게임 PLAYING, 타임아웃 10초 잔여 | 두 유저 모두 10초 안에 선택 완료 | 선택 완료 순간 즉시 `ROUND_RESULT` 브로드캐스트 — 10초 기다리지 않음 | High |
| TC-GAME-08 | ROUND_RESULT의 autoPicked 필드 정확성 | 2인 게임 PLAYING, 유저B 미선택 상태 | 유저A만 선택, 10초 후 타임아웃 | 유저A: autoPicked: false, 유저B: autoPicked: true | High |
| TC-GAME-09 | 결과 DB 저장 확인 | 라운드 완료 후 | DB 조회: `SELECT * FROM rps_round_result WHERE room_id = ?` | 참가자 수만큼 row 생성, choice/auto_picked/result 값 정상 | High |

---

## TC-TIMEOUT: 타임아웃 처리 (3개)

| TC-ID | 테스트 항목 | 전제조건 | 입력/동작 | 기대 결과 | 우선순위 |
|---|---|---|---|---|---|
| TC-TIMEOUT-01 | 10초 내 미선택 유저 자동 선택 처리 | 2인 게임, 유저B가 선택 안 함 | 유저A만 선택 후 10초 경과 | `ROUND_RESULT`에서 유저B `autoPicked: true`, choice는 ROCK/PAPER/SCISSORS 중 하나 | Critical |
| TC-TIMEOUT-02 | 전원 미선택 → 전원 랜덤 자동 선택 + 결과 계산 | 2인 게임 PLAYING | 두 유저 모두 10초 내 선택 없음 | 10초 후 `ROUND_RESULT` 수신, 양쪽 모두 autoPicked: true, 선택값/결과 정상 계산됨 | Critical |
| TC-TIMEOUT-03 | 일부 선택 + 나머지 미선택 → 타임아웃 시 자동 선택 + 전체 결과 | 3인 게임, 유저C 미선택 | 유저A/B 선택, 유저C 미선택 후 10초 경과 | 유저C autoPicked: true, 3인 전체 결과 계산 및 브로드캐스트 | High |

---

## TC-WS: WebSocket 이벤트 포맷 검증 (5개)

| TC-ID | 테스트 항목 | 전제조건 | 입력/동작 | 기대 결과 | 우선순위 |
|---|---|---|---|---|---|
| TC-WS-01 | ROOM_STATE 메시지 포맷 필수 필드 존재 | 유저 입장 후 | `/join` 발행 | 수신 메시지에 `type`, `timestamp`, `payload.roomId`, `payload.status`, `payload.hostUserId`, `payload.maxPlayers`, `payload.participants[]` 모두 존재 | High |
| TC-WS-02 | GAME_STARTED의 deadlineAt 정확성 | GAME_STARTED 수신 | 게임 시작 이벤트 | `payload.deadlineAt` = 서버 시각 + 10초, `payload.timeoutSeconds` = 10 | High |
| TC-WS-03 | ROUND_RESULT 포맷 완전성 | 라운드 완료 | 결과 수신 | `payload.results[]` 각 항목에 `userId`, `nickname`, `choice`, `autoPicked`, `result` 필드 모두 존재, choice는 ROCK/PAPER/SCISSORS, result는 WIN/LOSS/DRAW | High |
| TC-WS-04 | PLAYER_LEFT reason enum 정확성 | 게임 중 또는 대기 중 | 유저 자발 퇴장: `/leave` 발행 / 연결 끊김: 브라우저 탭 닫기 | 자발 퇴장 시 reason: LEAVE, 연결 끊김 시 reason: DISCONNECT | Medium |
| TC-WS-05 | MATCH_COUNTDOWN 포맷 검증 | 2인 이상 대기방 | 2번째 유저 입장 | 수신 메시지에 `type: "MATCH_COUNTDOWN"`, `payload.secondsRemaining`, `payload.startAt` 필드 존재 | Medium |

---

## TC-CONN: 연결 끊김 처리 (5개)

| TC-ID | 테스트 항목 | 전제조건 | 입력/동작 | 기대 결과 | 우선순위 |
|---|---|---|---|---|---|
| TC-CONN-01 | 대기방: 일반 참가자 연결 끊김 | 3인 대기방, 유저B 일반 참가자 | 유저B 브라우저 탭 닫기 (SessionDisconnectEvent) | 나머지 유저에게 `PLAYER_LEFT(reason: DISCONNECT)` 브로드캐스트 후 `ROOM_STATE` 갱신 (참가자 수 감소) | High |
| TC-CONN-02 | 대기방: 방장 연결 끊김, 다른 참가자 있음 | 2인 대기방, 유저A 방장 | 유저A 연결 끊김 | `HOST_CHANGED` 브로드캐스트 (newHostUserId = 유저B), 이어서 `ROOM_STATE` 브로드캐스트 | High |
| TC-CONN-03 | 대기방: 혼자일 때 방장 연결 끊김 → ROOM_CLOSED | 1인 대기방, 유저A 방장 | 유저A 연결 끊김 | `ROOM_CLOSED(reason: HOST_LEFT_ALONE)` 브로드캐스트, 방 상태 FINISHED 전환 | High |
| TC-CONN-04 | 게임 중 참가자 끊김, 잔존 2인 이상 → 끊긴 참가자 LOSS | 3인 PLAYING, 유저C 끊김 | 유저C 연결 끊김 | `PLAYER_LEFT` + `ROUND_RESULT` 순차 브로드캐스트, 유저C result: LOSS, 나머지는 정상 결과 계산 | High |
| TC-CONN-05 | 게임 중 1명만 남으면 → 남은 1명 WIN 처리 | 2인 PLAYING, 유저B 끊김 | 유저B 연결 끊김 | 유저A에게 `ROUND_RESULT` 수신, 유저A result: WIN — 방 상태 WAITING으로 복귀 | High |

---

## TC-REG: 기존 RSP 제거 확인 (회귀 테스트) (6개)

| TC-ID | 테스트 항목 | 전제조건 | 입력/동작 | 기대 결과 | 우선순위 |
|---|---|---|---|---|---|
| TC-REG-01 | `/admin/rsp` 라우트 제거 확인 | 배포 완료 | 브라우저에서 `/admin/rsp` 직접 접근 | 404 페이지 또는 홈 리다이렉트 — 어드민 솔로 RSP 페이지 노출 없음 | Critical |
| TC-REG-02 | `/admin/rsp/excel` 라우트 제거 확인 | 배포 완료 | 브라우저에서 `/admin/rsp/excel` 직접 접근 | 404 페이지 또는 홈 리다이렉트 | Critical |
| TC-REG-03 | `POST /api/admin/rsp/plays` 엔드포인트 제거 | 배포 완료 | 인증된 ADMIN으로 `POST /api/admin/rsp/plays` 호출 | HTTP 404 — AdminRspController 제거 확인 | Critical |
| TC-REG-04 | `GET /api/admin/rsp/stats` 엔드포인트 제거 | 배포 완료 | 인증된 ADMIN으로 `GET /api/admin/rsp/stats` 호출 | HTTP 404 | Critical |
| TC-REG-05 | 기존 채팅방 목록 API 정상 동작 확인 (채팅 회귀) | 채팅 기능 정상 배포 | `GET /api/chat/rooms` 호출 | 200 OK, 기존 채팅방 목록 정상 반환 — RPS 네임스페이스 분리로 채팅 영향 없음 | Critical |
| TC-REG-06 | WebSocket 채팅 메시지 정상 동작 확인 (채팅 회귀) | 채팅 WebSocket 연결 | `/topic/room/{chatRoomId}` 구독 후 `/app/chat/{chatRoomId}` 메시지 발행 | 채팅 메시지 정상 브로드캐스트 — `/topic/rps/**` 경로 추가로 기존 채팅 채널 영향 없음 | Critical |

---

## TC-HOME: 홈페이지 진입 (3개)

| TC-ID | 테스트 항목 | 전제조건 | 입력/동작 | 기대 결과 | 우선순위 |
|---|---|---|---|---|---|
| TC-HOME-01 | 홈 Test Lab 섹션에 "Online RPS" 카드 노출 | 로그인 상태 | 메인페이지 접속 | Test Lab 섹션(또는 게임 카드 목록)에 "Online RPS" 진입 카드 존재 | Medium |
| TC-HOME-02 | 진입 버튼 클릭 → `/online-rps` 라우트 이동 | 로그인 상태 | "Online RPS" 카드 클릭 | `/online-rps` 경로로 라우팅, 매칭 요청 플로우 시작 | Medium |
| TC-HOME-03 | 비로그인 상태에서 진입 → 로그인 페이지 리다이렉트 | 비로그인 | `/online-rps` 직접 URL 접근 또는 카드 클릭 | 로그인 페이지로 리다이렉트 — 비로그인 접근 차단 | High |

---

## TC-EDGE: 엣지 케이스 (5개)

| TC-ID | 테스트 항목 | 전제조건 | 입력/동작 | 기대 결과 | 우선순위 |
|---|---|---|---|---|---|
| TC-EDGE-01 | 소문자 choice 전송 → INVALID_CHOICE 에러 | 게임 PLAYING, 유저 선택 전 | `/app/rps/room/{roomId}/choose` body: `{ "choice": "rock" }` | `/user/queue/errors` 수신, code: INVALID_CHOICE | High |
| TC-EDGE-02 | 이미 선택 후 재선택 시도 → ALREADY_CHOSEN 에러 | 게임 PLAYING, 유저A 이미 ROCK 선택 | `/app/rps/room/{roomId}/choose` body: `{ "choice": "PAPER" }` | `/user/queue/errors` 수신, code: ALREADY_CHOSEN — 첫 선택값 유지 | High |
| TC-EDGE-03 | PLAYING 중 외부에서 매칭 요청 → 매칭에서 제외 | 방 status = PLAYING | 새 유저가 `POST /api/rps/match` 호출 | PLAYING 방에 합류되지 않음 — 새 WAITING 방 생성(201) 또는 다른 WAITING 방에 합류(200) | High |
| TC-EDGE-04 | 매칭 요청 Rate Limit (10초 내 5회 초과) | 인증된 유저 | 10초 내 `POST /api/rps/match` 6회 연속 호출 | 5회 초과 시점부터 HTTP 429, `{ "error": "MATCH_RATE_LIMIT" }` | Medium |
| TC-EDGE-05 | 동시 매칭 요청 race condition — 정원 초과 없음 | 동시에 5명이 빈 상태에서 매칭 요청 | 매칭 API 동시 5회 호출 | 방 정원(4명) 초과 없음 — 1개 방에 최대 4명, 나머지 1명은 새 방 생성. 분산락/DB락 동작 확인 | Medium |

---

## TC-DB: 데이터 저장 검증 (4개)

| TC-ID | 테스트 항목 | 전제조건 | 입력/동작 | 기대 결과 | 우선순위 |
|---|---|---|---|---|---|
| TC-DB-01 | 라운드 완료 후 rps_round_result row 수 = 참가자 수 | 3인 라운드 완료 | DB 조회: `SELECT COUNT(*) FROM rps_round_result WHERE room_id = ? AND round_num = ?` | COUNT = 3 (참가자 수와 일치) | High |
| TC-DB-02 | autoPicked=true row의 choice 값 유효성 | 타임아웃 발생 후 | DB 조회: autoPicked=1인 row의 choice 컬럼 확인 | choice 값이 ROCK, PAPER, SCISSORS 중 하나 — null 또는 invalid 값 없음 | High |
| TC-DB-03 | result 컬럼 값 유효성 | 라운드 완료 후 | DB 조회: result 컬럼 전체 스캔 | 모든 result 값이 WIN, LOSS, DRAW 중 하나 — 다른 값 없음 | High |
| TC-DB-04 | 라운드 종료 후 rps_room.status WAITING 리셋 확인 | PLAYING → 라운드 완료 | DB 조회: `SELECT status FROM rps_room WHERE room_id = ?` | status = WAITING — 결과 브로드캐스트 이후 방 재사용 준비 상태 | High |

---

## TC-PERF: 성능 (3개)

| TC-ID | 테스트 항목 | 전제조건 | 입력/동작 | 기대 결과 | 우선순위 |
|---|---|---|---|---|---|
| TC-PERF-01 | POST /api/rps/match 응답 시간 | DB/Redis 정상 상태 | 순차 10회 매칭 요청 | p95 응답 시간 500ms 이내 | Medium |
| TC-PERF-02 | WebSocket 이벤트 브로드캐스트 지연 | 4인 방 게임 중 | 카드 선택 메시지 발행 후 ROUND_RESULT 수신까지 | 4인 기준 브로드캐스트 지연 200ms 이내 | Medium |
| TC-PERF-03 | 분산락 타임아웃 시 503 반환 확인 | Redis 락 응답 지연 시뮬레이션 | 매칭 요청 중 Redis 일시 불가 상태 유도 | HTTP 503, `{ "error": "MATCH_UNAVAILABLE" }` — 서버 크래시 없음 | Medium |

---

## TC-ACCESS: 접근성 (2개)

| TC-ID | 테스트 항목 | 전제조건 | 입력/동작 | 기대 결과 | 우선순위 |
|---|---|---|---|---|---|
| TC-ACCESS-01 | 키보드만으로 카드 선택 가능 여부 | 게임 화면, PLAYING 상태 | Tab으로 카드(ROCK/PAPER/SCISSORS) 포커스 이동, Enter/Space로 선택 | 마우스 없이 키보드만으로 카드 선택 완료 가능 | Low |
| TC-ACCESS-02 | 색상 대비 — 승/패/무 결과 텍스트 | 결과 화면 | 결과 텍스트 색상과 배경 색상 측정 | WCAG AA 기준 최소 4.5:1 대비비 충족 | Low |

---

## 모드 검증 섹션

Excel 모드: **N/A** — PRD §3에서 명시적으로 제외됨. "일반 모드만" 지시 확인됨.
Excel 모드 검증 항목 없음. 향후 사용자 요청 시 별도 TC 추가.

---

## EC 전수 매핑표

PRD §10 엣지케이스 EC-1 ~ EC-19 전수 TC 대응:

| EC-ID | 상황 요약 | 대응 TC |
|---|---|---|
| EC-1 | 정원 초과 입장 | TC-MATCH-05 (새 방 생성으로 처리) |
| EC-2 | PLAYING 방 입장 시도 | TC-EDGE-03 |
| EC-3 | 방장 아닌 유저 `/start` | TC-WS-01 포함 (GAME_NOT_ACTIVE 상황), 구현 후 추가 TC 실행 가능 |
| EC-4 | 방장 아닌 유저 `/rematch` | 구현 후 TC 추가 예정 (MVP 카운트다운 방식이므로 /rematch 사용 여부 확인 필요) |
| EC-5 | 선택 후 재선택 | TC-EDGE-02 |
| EC-6 | 2인 미만 시작 | 카운트다운 자동 시작 방식이므로 직접 start 없음 — MATCH_COUNTDOWN 2인 미만 취소로 커버 (TC-WAIT-04) |
| EC-7 | 비방장 미준비 상태 시작 | 카운트다운 자동 방식으로 ready/start 불필요 — N/A |
| EC-8 | 전원 미선택 타임아웃 | TC-TIMEOUT-02 |
| EC-9 | 게임 중 전원 끊김 | ROOM_CLOSED(EMPTY) — 구현 후 TC 추가 예정 |
| EC-10 | 방장 게임 중 끊김 → 방장 이전 + 라운드 진행 | TC-CONN-04 + HOST_CHANGED 확인 |
| EC-11 | 활성 방 있는데 재매칭 | TC-MATCH-03, TC-MATCH-04 |
| EC-12 | 소문자 choice | TC-EDGE-01 |
| EC-13 | 삭제됨 | — |
| EC-14 | 매칭 rate limit | TC-EDGE-04 |
| EC-15 | `/leave` 없이 브라우저 닫음 | TC-CONN-01 (SessionDisconnectEvent) |
| EC-16 | 아무도 `/join` 안 하고 창 닫음 | TTL 10분 자동 close — 구현 후 OQ-3 답변 기반 TC 추가 |
| EC-17 | 카운트다운 중 1인 감소 | TC-WAIT-04 |
| EC-18 | Redis 락 타임아웃 | TC-PERF-03 |
| EC-19 | 동시 매칭 race condition | TC-EDGE-05 |

---

## 회귀 영향 평가

### 공통 모듈 변경 영향

| 변경 영역 | 영향 범위 | 회귀 검증 항목 |
|---|---|---|
| WebSocket `/ws` 엔드포인트 공유 | 기존 채팅 기능 전체 | TC-REG-05, TC-REG-06 (채팅 smoke test) |
| `/user/queue/errors` 채널 공유 | 기존 채팅 에러 처리 | 에러 코드 충돌 없음 확인 (채팅 에러코드 vs RPS 에러코드 네임스페이스 분리) |
| SecurityConfig `/api/rps/**` 규칙 추가 | 기존 SecurityConfig 전체 | 기존 `/api/admin/**`, `/api/chat/**` 규칙 우선순위 변경 없음 확인 |
| SessionDisconnectEvent 리스너 공유 | 기존 채팅 끊김 처리 | `rpsSubscribedRoomIds` 키가 기존 `subscribedRoomIds`(채팅)와 분리됨 확인 |

### 기존 게임 Smoke Test 필수 항목

Online RPS 배포 후 아래 기존 게임들의 기본 동작 확인 필수:

| 게임 | 확인 항목 |
|---|---|
| BlockfallBoard (일반) | 게임 시작, 점수 등록, 랭킹 조회 정상 |
| BlockfallInsaneBoard | 게임 시작, insane 이벤트 발동, 점수 등록 정상 |
| AppleCanvas | 게임 시작, 점수 등록 정상 |
| BaseballBoard | 게임 시작, 점수 등록 정상 |
| MinesweeperBoard | 게임 시작, 점수 등록 정상 |
| SudokuBoard | 게임 시작, 완료 처리 정상 |
| CardBoard (Solitaire) | 게임 시작, 완료 처리 정상 |
| RspBoard (제거 확인) | TC-REG-01 ~ TC-REG-04 — 라우트/API 404 확인 |
| 채팅 (chat-testroom) | TC-REG-05, TC-REG-06 — 채팅 방 목록/메시지 정상 |

---

## 반려 기준 체크리스트

다음 조건 중 하나라도 해당되면 PR 반려 + 담당 developer에게 차단 메시지:

- [ ] PRD §3: "Excel 모드 N/A" 명시인데 Excel 관련 코드가 추가된 경우
- [ ] TC-REG-01 ~ TC-REG-04: 기존 admin-rsp 엔드포인트/라우트가 여전히 동작하는 경우
- [ ] TC-REG-05, TC-REG-06: 채팅 기능 회귀 파손 발견 시
- [ ] TC-GAME-01 ~ TC-GAME-06: 판정 로직 오류 (바위-가위-보 상성 버그)
- [ ] TC-SEC-01 ~ TC-SEC-03: 비인증 접근 허용 발견 시
- [ ] TC-TIMEOUT-01 ~ TC-TIMEOUT-02: 타임아웃 미동작 (10초 후 결과 미전송)
- [ ] TC-DB-01: rps_round_result row 미생성 (DB 저장 누락)
- [ ] Critical 버그 미해결 상태로 완료 요청

---

## 테스트 환경 요구사항

| 항목 | 요구사항 |
|---|---|
| 브라우저 | Chrome 최신 (기준), Firefox 추가 확인 |
| 동시 접속 유저 시뮬레이션 | 최소 4개 탭/브라우저 세션 (4인 게임 TC) |
| 네트워크 | 일반망 + 지연 시뮬레이션 (DevTools Network Throttle) |
| DB 접근 | 읽기 전용 조회 (TC-DB 항목) — Railway 프로덕션 쓰기 쿼리 금지 |
| WebSocket 도구 | STOMP over SockJS 지원 클라이언트 (wscat + STOMP 라이브러리 또는 브라우저 DevTools) |
| 환경 | 로컬 개발 환경 우선 — 프로덕션 직접 E2E는 사용자 승인 후 |

---

## 미결 사항 (구현 확정 후 TC 업데이트 필요)

| ID | 항목 | 담당 | 시점 |
|---|---|---|---|
| OQ-3 | 방 TTL 자동 close 시간 (10분 제안) — 구현 확정 시 TC-EDGE 추가 | developer-backend | CP3 |
| OQ-5 | 재도전 시 rps_room 재사용 vs 새 row 생성 — 확정 시 TC-DB-04 조건 조정 | developer-backend | CP3 |
| OQ-9 | Rate Limit 임계치 (10초 내 N회) 최종 확정 | developer-backend | CP3 |
| OQ-10 | 카운트다운 중 4인 꽉 찼을 때 즉시 시작 vs 타이머 유지 — TC-WAIT-03 조건 조정 필요 | developer-backend | CP3 |
| EC-4 | /rematch STOMP 이벤트 사용 여부 — 카운트다운 자동 방식에서 방장 개념 잔존 여부 | developer-backend/planner | CP3 |
