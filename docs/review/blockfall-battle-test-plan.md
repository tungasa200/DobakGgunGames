# 테스트 플랜 — Blockfall Battle (블록폴 통신배틀 모드)

- 작성자: qa-tester
- 작성일: 2026-04-27
- 기반 문서: `docs/specs/blockfall-battle-prd.md` (CP1 작성 완료본)
- 모드 적용 범위: **일반 모드만** (Excel 모드 N/A — PRD §3 명시: "Excel 모드 이번 버전 제외")
- 상태: **선행 초안 (구현 전 작성)** — developer-backend / developer-frontend 구현 완료 후 TC 실행 예정
- TC 총계: **51개**
  - TC-SEC 5 | TC-JOIN 6 | TC-MATCH 5 | TC-GAME 7 | TC-COMBO 6 | TC-CONN 5 | TC-RESULT 4 | TC-EDGE 8 | TC-REG 5 | TC-PERF 3 | TC-ACCESS 2

---

## 우선순위 정의

| 우선순위 | 기준 |
|---|---|
| P1 Critical | 서비스 기동 불가 / 보안 홀 / 데이터 오염 / 회귀로 기존 기능 파손 |
| P2 High | 핵심 배틀 플로우 차단 / 잘못된 전적 저장 / 인증 우회 / 게임 진행 불가 |
| P3 Medium | 비정상 에러 응답 / UX 흐름 깨짐 / 비기능 엣지케이스 미처리 |
| P4 Low | 텍스트 오류 / 미세 타이밍 / 접근성 권장 사항 |

---

## 모드 검증 확인

Excel 모드: **N/A** — PRD §3에서 명시적으로 제외됨.
- "Excel 모드 이번 버전 제외", "일반 모드만 구현", "qa-tester는 일반 모드만 검증" 지시 확인.
- Excel 모드 검증 항목 없음. 향후 사용자 추가 지시 시 별도 TC 추가.
- PRD 반려 기준: Excel 관련 코드가 추가되어 있다면 즉시 반려.

---

## TC-SEC: 보안/인증 (5개)

### TC-SEC-01: JWT 없는 유저의 join API → 게스트 처리

- **테스트 유형**: 기능 / 보안
- **사전 조건**: JWT 없는 클라이언트 (비로그인 상태)
- **테스트 절차**:
  1. `POST /api/blockfall-battle/join` 호출, Authorization 헤더 없음, body `{ "guestToken": null }`
  2. 응답 상태 코드 및 body 확인
- **기대 결과**: HTTP 200/201, `{ isGuest: true, guestToken: "guest_..." }` 응답. 401 반환 시 실패.
- **검증 방법**: API 응답 body 검사. guestToken 포맷 `guest_{uuid v4}` 정규식 확인.
- **우선순위**: P1 Critical

---

### TC-SEC-02: 잘못된 guestToken 형식 → 401 반환

- **테스트 유형**: 보안
- **사전 조건**: 없음
- **테스트 절차**:
  1. `POST /api/blockfall-battle/join` 호출, body `{ "guestToken": "invalid-token-no-prefix" }`
  2. 응답 상태 코드 및 에러 코드 확인
- **기대 결과**: HTTP 401, 에러 코드 `UNAUTHORIZED_GUEST_TOKEN`
- **검증 방법**: API 응답 HTTP 상태코드 및 body `{ "error": "UNAUTHORIZED_GUEST_TOKEN" }` 확인
- **우선순위**: P1 Critical

---

### TC-SEC-03: 기존 `/ws` 엔드포인트에 guestToken으로 연결 → 거부

- **테스트 유형**: 보안
- **사전 조건**: 게스트 토큰 보유 (`guest_xxx` 형식)
- **테스트 절차**:
  1. 기존 `/ws?token=guest_xxx` 로 WebSocket 연결 시도
  2. 핸드셰이크 응답 확인
- **기대 결과**: 핸드셰이크 거부 (HTTP 401 또는 403). 기존 JwtHandshakeInterceptor가 JWT 형식이 아닌 토큰 차단 확인. 배틀 전용 `/ws-battle`과 분리됨.
- **검증 방법**: 브라우저 DevTools > Network > WS 탭에서 연결 응답 코드 확인
- **우선순위**: P1 Critical

---

### TC-SEC-04: 만료된 JWT로 `/ws-battle` 연결 시도

- **테스트 유형**: 보안
- **사전 조건**: 만료된 JWT 보유
- **테스트 절차**:
  1. `/ws-battle?token=<만료_JWT>` 로 SockJS+STOMP 연결 시도
  2. STOMP CONNECT 프레임 전송
- **기대 결과**: `UNAUTHORIZED` 에러 수신 또는 연결 거부. 만료 JWT로 배틀 게임 불가.
- **검증 방법**: `/user/queue/blockfall-battle/errors` 에서 `{ "type": "ERROR", "code": "UNAUTHORIZED" }` 수신 또는 핸드셰이크 거부 확인
- **우선순위**: P1 Critical

---

### TC-SEC-05: `GET /api/blockfall-battle/rankings` 인증 없이 공개 접근 가능

- **테스트 유형**: 보안
- **사전 조건**: 비로그인 클라이언트
- **테스트 절차**:
  1. Authorization 헤더 없이 `GET /api/blockfall-battle/rankings` 호출
  2. 응답 확인
- **기대 결과**: HTTP 200, `{ "topRankings": [...] }` 응답. 401 반환 시 실패 (랭킹은 공개 API).
- **검증 방법**: API 응답 상태코드 200 및 topRankings 배열 필드 존재 확인
- **우선순위**: P2 High

---

## TC-JOIN: 배틀 참가 및 매칭 (6개)

### TC-JOIN-01 (TC-01): 로그인 유저 2인 매칭 자동 시작 및 전적 저장

- **테스트 유형**: E2E / 기능 / 통합
- **사전 조건**: 로그인 유저 2명 준비 (브라우저 세션 2개), 활성 배틀방 없음
- **테스트 절차**:
  1. 유저A: `POST /api/blockfall-battle/join` 호출 → roomId 수신, status `WAITING`
  2. 유저A: `/ws-battle` 연결 후 `/topic/blockfall-battle/room/{roomId}` 구독
  3. 유저B: 동일 `POST /api/blockfall-battle/join` 호출 → 같은 roomId 반환 확인
  4. 유저B: 동일 구독 설정
  5. 서버가 `MATCH_COUNTDOWN(secondsRemaining=5)` 브로드캐스트 수신 확인
  6. 5초 후 `GAME_STARTED` 브로드캐스트 수신 확인
  7. 게임 진행: 유저B 게임오버 유발 → `PLAYER_FINISHED(rank=2)` 수신 확인
  8. `GAME_RESULT` 브로드캐스트 수신 확인 (유저A rank=1, 유저B rank=2)
  9. DB 조회: `SELECT * FROM battle_record WHERE user_id IN (A, B)` 확인
- **기대 결과**:
  - 5단계: 양쪽 모두 MATCH_COUNTDOWN 수신
  - 6단계: GAME_STARTED 수신 (startAt 필드 ISO8601 포맷)
  - 7단계: `PLAYER_FINISHED` payload에 `playerId`, `rank=2`, `score` 필드 존재
  - 8단계: GAME_RESULT의 `results` 배열에 2명, `topRankings` 배열 존재
  - 9단계: 유저A `win_count=1, lose_count=0, total_games=1`, 유저B `win_count=0, lose_count=1, total_games=1`
- **검증 방법**: UI WebSocket 이벤트 캡처 + DB 읽기 전용 조회 (Railway 프로덕션 쓰기 금지)
- **우선순위**: P1 Critical

---

### TC-JOIN-02 (TC-02): 게스트 + 로그인 유저 혼합 매칭

- **테스트 유형**: E2E / 기능
- **사전 조건**: 로그인 유저 1명, 비로그인 클라이언트 1명
- **테스트 절차**:
  1. 게스트: Authorization 없이 `POST /api/blockfall-battle/join` → `isGuest=true`, `guestToken: "guest_xxx"` 수신 확인
  2. 게스트: 수신한 guestToken을 localStorage에 저장 후 `/ws-battle?guestToken=guest_xxx` 연결
  3. 로그인 유저: JWT 포함 `POST /api/blockfall-battle/join` → 같은 roomId 매칭 확인
  4. 로그인 유저: `/ws-battle?token=<JWT>` 연결
  5. 2인 MATCH_COUNTDOWN → GAME_STARTED 정상 수신 확인
  6. 배틀 진행 후 GAME_RESULT 수신
  7. DB 조회: `battle_record` 테이블에 게스트 데이터 없음, 로그인 유저 전적만 저장 확인
- **기대 결과**:
  - 1단계: guestToken 포맷 `guest_{uuid v4}`, 닉네임 `손님-{4자리 대문자}` 형식
  - 5단계: 혼합 배틀 GAME_STARTED 정상
  - 6단계: GAME_RESULT의 `results` 배열에 `isGuest` 필드 정확히 반영
  - 7단계: 게스트 user_id에 해당하는 battle_record row 없음
- **검증 방법**: API 응답 검사 + DB SELECT 조회 (`SELECT * FROM battle_record WHERE ...`)
- **우선순위**: P1 Critical

---

### TC-JOIN-03: 이미 활성 방에 참가 중인 유저 재참가 시도 → 409

- **테스트 유형**: 기능 / 에러 상태
- **사전 조건**: 로그인 유저가 WAITING 또는 PLAYING 방에 이미 참가 중
- **테스트 절차**:
  1. 로그인 유저 `POST /api/blockfall-battle/join` → 방 참가
  2. 동일 유저로 `POST /api/blockfall-battle/join` 재호출
- **기대 결과**: HTTP 409, body `{ "error": "ALREADY_IN_ROOM", "roomId": "<기존 roomId>" }`
- **검증 방법**: 두 번째 API 응답 HTTP 상태 409, 에러 코드 및 기존 roomId 확인
- **우선순위**: P2 High

---

### TC-JOIN-04 (TC-04): PLAYING 중 방에 도중 입장 → 큐 진입

- **테스트 유형**: 기능 / E2E
- **사전 조건**: 2인이 이미 PLAYING 상태인 배틀방 존재
- **테스트 절차**:
  1. 새 유저(5번째): `POST /api/blockfall-battle/join` 호출
  2. 응답에서 `status: "PLAYING"`, `queuePosition: 1` 수신 확인
  3. 유저: `/ws-battle` 연결 후 `/user/queue/blockfall-battle/...` 개인 큐 구독
  4. `QUEUE_POSITION(position=1, totalInQueue=1)` 수신 확인
  5. 기존 방 참가자에게 `ROOM_STATE(queueCount=1)` 브로드캐스트 수신 확인
  6. 현재 게임 종료 → GAME_RESULT 후 WAITING 전이
  7. 큐 대기자가 다음 라운드 ROOM_STATE에 포함되는지 확인
- **기대 결과**:
  - 2단계: queuePosition 1 반환
  - 4단계: QUEUE_POSITION 메시지 수신
  - 7단계: 다음 ROOM_STATE의 `players` 배열에 신규 참가자 포함
- **검증 방법**: WebSocket 메시지 이벤트 캡처, ROOM_STATE payload 검사
- **우선순위**: P2 High

---

### TC-JOIN-05 (TC-13): 4인 정원 초과 → 큐 자동 라우팅

- **테스트 유형**: 기능
- **사전 조건**: 4인이 WAITING 방에 꽉 찬 상태 (또는 PLAYING 중)
- **테스트 절차**:
  1. 5번째 유저 `POST /api/blockfall-battle/join`
  2. 응답 `queuePosition: 1` 확인
  3. 기존 방에 5명이 합류되지 않음 확인 (players 배열 4명 유지)
- **기대 결과**: 5번째 유저는 큐에 진입. 방 정원 초과 없음. `playerCount` 여전히 4.
- **검증 방법**: join 응답 queuePosition 필드, ROOM_STATE players 배열 길이 확인
- **우선순위**: P2 High

---

### TC-JOIN-06: 신규 방 생성 — 대기방 없을 때

- **테스트 유형**: 기능
- **사전 조건**: 활성 WAITING 방 없음
- **테스트 절차**:
  1. 첫 유저 `POST /api/blockfall-battle/join` 호출
  2. 응답 확인
- **기대 결과**: HTTP 201, `{ roomId: "8자리", status: "WAITING", playerCount: 1, maxPlayers: 4, queuePosition: null, isGuest: false/true }` 응답
- **검증 방법**: 응답 body의 roomId 길이(8자리), status 값, queuePosition null 확인
- **우선순위**: P2 High

---

## TC-MATCH: 방 상태 머신 및 카운트다운 (5개)

### TC-MATCH-01: 2인 충족 → MATCH_COUNTDOWN 브로드캐스트 (OQ-3 반영 갱신)

- **테스트 유형**: 기능
- **사전 조건**: 1인 WAITING 방
- **테스트 절차 [Case A: 2~3인]**:
  1. 2번째 유저 join 후 WebSocket 구독
  2. 서버가 `MATCH_COUNTDOWN` 브로드캐스트 전송 대기
  3. 5초 경과 후 `GAME_STARTED` 수신 확인
- **테스트 절차 [Case B: 4인 동시 충족]**:
  1. 1~3번째 유저 순차 join 후 4번째 유저 join
  2. 서버가 `MATCH_COUNTDOWN` 브로드캐스트 전송 대기
  3. GAME_STARTED 즉시 수신 여부 확인 (5초 대기 불필요)
- **기대 결과**:
  - Case A: 양쪽 모두 `MATCH_COUNTDOWN` payload `seconds=5` 수신. 5초 후 `GAME_STARTED`.
  - Case B: `MATCH_COUNTDOWN` payload `seconds=0` 수신 직후 즉시 `GAME_STARTED` 브로드캐스트.
- **구현 근거**: `BattleRoomService.tryStartCountdown()` — count >= MAX_PLAYERS(4)이면 즉시 startGame() 호출.
- **검증 방법**: WebSocket 이벤트 수신 및 payload `seconds` 필드값 확인, timestamp 간격 측정
- **우선순위**: P2 High

---

### TC-MATCH-02: 카운트다운 중 1명 이탈 → 취소

- **테스트 유형**: 기능
- **사전 조건**: 2인 카운트다운 진행 중 (MATCH_COUNTDOWN 수신 후)
- **테스트 절차**:
  1. 유저B가 LEAVE_BATTLE 메시지 발행 또는 연결 끊김
  2. 유저A의 이벤트 수신 확인
- **기대 결과**: `MATCH_COUNTDOWN_CANCELLED` 브로드캐스트 수신. 카운트다운 중단, 방은 WAITING 유지.
- **검증 방법**: 유저A WebSocket 이벤트 캡처, MATCH_COUNTDOWN_CANCELLED type 확인
- **우선순위**: P2 High

---

### TC-MATCH-03 (TC-03): 3인 배틀 중 1인 중도 이탈

- **테스트 유형**: 기능 / E2E
- **사전 조건**: 3인 PLAYING 배틀
- **테스트 절차**:
  1. 3인 배틀 GAME_STARTED 후 진행 중
  2. 유저C: `LEAVE_BATTLE` 메시지 발행 (`/app/blockfall-battle/room/{roomId}/leave`)
  3. 유저A, 유저B의 이벤트 수신 확인
  4. 배틀 계속 진행 여부 확인
  5. 이탈한 유저C의 DB 전적 저장 없음 확인
- **기대 결과**:
  - 3단계: `PLAYER_LEFT(playerId=C, nickname=...)` 브로드캐스트 수신
  - 3단계: `PLAYER_FINISHED` (C의 자동 게임오버) 함께 수신
  - 4단계: 유저A, 유저B 배틀 계속 정상 진행
  - 5단계: DB battle_record에 유저C의 해당 게임 전적 없음 (total_games 미증가)
- **검증 방법**: WebSocket 이벤트 캡처, DB 읽기 전용 조회
- **우선순위**: P2 High

---

### TC-MATCH-04: FINISHED 상태 → 10초 후 WAITING 자동 전이

- **테스트 유형**: 기능
- **사전 조건**: 배틀 종료 직후 FINISHED 상태
- **테스트 절차**:
  1. 배틀 종료 후 GAME_RESULT 수신
  2. 10초 대기
  3. ROOM_STATE(status="WAITING") 수신 여부 확인
- **기대 결과**: 10초 후 `ROOM_STATE(status="WAITING")` 수신. 방이 다음 라운드 매칭 준비 상태 전환.
- **검증 방법**: ROOM_STATE payload의 status 필드 확인
- **우선순위**: P2 High

---

### TC-MATCH-05: 결과 화면 후 큐 대기자 자동 합류 (FIFO 4인 상한)

- **테스트 유형**: 기능
- **사전 조건**: 배틀 종료 후 FINISHED, 큐에 5명 대기 중
- **테스트 절차**:
  1. FINISHED → WAITING 전이 발생
  2. 큐 앞 4명이 다음 라운드 참가자로 승격되는지 확인
  3. 5번째 대기자는 `QUEUE_POSITION(position=1)` 갱신 수신 확인
- **기대 결과**: 다음 ROOM_STATE의 players 배열에 FIFO 순서 4명. 5번째는 여전히 큐 대기.
- **검증 방법**: ROOM_STATE players 배열 길이 4 이하, 5번째 유저 QUEUE_POSITION 갱신 확인
- **우선순위**: P3 Medium

---

## TC-GAME: 게임 플레이 및 보드 동기화 (7개)

### TC-GAME-01: GAME_STARTED 후 BOARD_STATE 발행 → 상대에게 BOARD_UPDATE 수신

- **테스트 유형**: 기능
- **사전 조건**: 2인 PLAYING 상태
- **테스트 절차**:
  1. 유저A: 200ms 주기로 `BOARD_STATE` 발행 (`/app/blockfall-battle/room/{roomId}/board-state`)
  2. 유저B의 수신 이벤트 확인
  3. 유저A 자신에게 BOARD_UPDATE가 에코되지 않는지 확인
- **기대 결과**: 유저B에게 `BOARD_UPDATE(playerId=A, board=..., score, lines, level)` 수신. 유저A 자신에게는 BOARD_UPDATE 미전송(에코 방지).
- **검증 방법**: WebSocket 이벤트 캡처. 유저A 수신 이벤트 목록에 BOARD_UPDATE 없음 확인.
- **우선순위**: P2 High

---

### TC-GAME-02: 게임오버(Block Out) → PLAYER_FINISHED 즉시 브로드캐스트

- **테스트 유형**: 기능
- **사전 조건**: 2인 PLAYING 상태
- **테스트 절차**:
  1. 유저B의 보드가 Block Out (최상단 초과) 상태 유발
  2. 서버 이벤트 수신 확인
- **기대 결과**: `PLAYER_FINISHED(playerId=B, rank=2, score=N)` 브로드캐스트 즉시 수신. 유저A에게도 전파.
- **검증 방법**: WebSocket 이벤트 timestamp 확인 (Block Out 발생 직후 수신)
- **우선순위**: P1 Critical

---

### TC-GAME-03 (TC-16): 게임 중 1명만 남음 → 자동 우승 처리

- **테스트 유형**: 기능
- **사전 조건**: 3인 PLAYING, 2명이 게임오버
- **테스트 절차**:
  1. 유저B, 유저C 순서로 게임오버
  2. 유저A만 남은 시점 확인
  3. 자동 우승 처리 이벤트 수신 확인
- **기대 결과**: 유저A에게 `PLAYER_FINISHED(rank=1)` 및 `GAME_RESULT` 즉시 브로드캐스트. 유저A가 직접 게임오버하지 않아도 종료 처리.
- **검증 방법**: GAME_RESULT의 results 배열 확인 (유저A rank=1)
- **우선순위**: P2 High

---

### TC-GAME-04: BOARD_STATE 형식 불량 → INVALID_BOARD 에러

- **테스트 유형**: 에러 상태
- **사전 조건**: PLAYING 상태, 유저A WebSocket 연결 중
- **테스트 절차**:
  1. 유저A: board 배열 크기 불일치 (예: 10열 × 22행 대신 5 × 5)로 BOARD_STATE 발행
  2. 에러 수신 확인
- **기대 결과**: `/user/queue/blockfall-battle/errors` 에서 `{ "type": "ERROR", "code": "INVALID_BOARD" }` 수신. 게임은 계속 진행 (중단 X).
- **검증 방법**: 개인 에러 큐 메시지 확인, 다른 참가자 게임 상태 정상 유지 확인
- **우선순위**: P3 Medium

---

### TC-GAME-05: COMBO_ATTACK 음수 콤보 값 → INVALID_COMBO 에러

- **테스트 유형**: 에러 상태
- **사전 조건**: PLAYING 상태
- **테스트 절차**:
  1. `combo: -1` 값으로 `COMBO_ATTACK` 발행
  2. 에러 수신 확인
- **기대 결과**: `{ "type": "ERROR", "code": "INVALID_COMBO" }` 에러 수신. GARBAGE_ATTACK 미발송.
- **검증 방법**: 개인 에러 큐 및 다른 참가자의 GARBAGE_ATTACK 미수신 확인
- **우선순위**: P3 Medium

---

### TC-GAME-06: 본인 이외 다른 생존자 없을 때 콤보 발동 → GARBAGE_ATTACK 미발송

- **테스트 유형**: 기능 / 엣지 케이스
- **사전 조건**: 2인 배틀, 상대방이 이미 게임오버 (PLAYER_FINISHED 수신 완료)
- **테스트 절차**:
  1. 유저A만 생존 상태에서 2콤보 이상 발동
  2. `COMBO_ATTACK(combo=2)` 발행
  3. 유저A에게 GARBAGE_ATTACK 미수신 확인
- **기대 결과**: GARBAGE_ATTACK 미발송. 에러 없음. 게임 계속 진행.
- **검증 방법**: 모든 WebSocket 이벤트 캡처, GARBAGE_ATTACK 타입 이벤트 없음 확인
- **우선순위**: P2 High

---

### TC-GAME-07: 존재하지 않는 roomId에 메시지 발행 → ROOM_NOT_FOUND 에러

- **테스트 유형**: 에러 상태
- **사전 조건**: 없음
- **테스트 절차**:
  1. `/app/blockfall-battle/room/XXXXXXXX/board-state` 로 존재하지 않는 방에 발행
  2. 에러 수신 확인
- **기대 결과**: `{ "type": "ERROR", "code": "ROOM_NOT_FOUND" }` 에러 수신
- **검증 방법**: 개인 에러 큐 메시지 확인
- **우선순위**: P3 Medium

---

## TC-COMBO: 콤보 공격 및 Garbage Line (6개)

### TC-COMBO-01 (TC-05): 2콤보 → Garbage 1줄 전송

- **테스트 유형**: 기능 / P1
- **사전 조건**: 2인 PLAYING 상태
- **테스트 절차**:
  1. 유저A: 2콤보 달성 → `COMBO_ATTACK(combo=2)` 발행
  2. 서버 처리 후 유저B 이벤트 수신 확인
  3. 유저B: 다음 piece lock 시점에 보드 하단 변화 확인
- **기대 결과**: 유저B에게 `GARBAGE_ATTACK(targetPlayerId=B, lines=1, fromPlayerId=A)` 수신. 다음 lock 시 보드 하단에 회색 줄 1개 추가, 기존 내용 1줄 위로 이동.
- **검증 방법**: WebSocket 이벤트 + 프론트엔드 보드 렌더링 확인
- **우선순위**: P1 Critical

---

### TC-COMBO-02: 3콤보 → Garbage 2줄 / 4콤보 → 3줄 / 5콤보+ → 4줄

- **테스트 유형**: 기능
- **사전 조건**: 2인 PLAYING 상태
- **테스트 절차**:
  1. 유저A: `COMBO_ATTACK(combo=3)` 발행 → `GARBAGE_ATTACK(lines=2)` 수신 확인
  2. 유저A: `COMBO_ATTACK(combo=4)` 발행 → `GARBAGE_ATTACK(lines=3)` 수신 확인
  3. 유저A: `COMBO_ATTACK(combo=5)` 발행 → `GARBAGE_ATTACK(lines=4)` 수신 확인
  4. 유저A: `COMBO_ATTACK(combo=10)` 발행 → `GARBAGE_ATTACK(lines=4)` 수신 확인 (상한 4줄 고정)
- **기대 결과**: PRD §7.1 매핑 정확히 적용. 5콤보 이상은 4줄 고정.
- **검증 방법**: 각 GARBAGE_ATTACK 메시지의 `lines` 필드 값 확인
- **우선순위**: P1 Critical

---

### TC-COMBO-03: 1콤보 → Garbage 미발송

- **테스트 유형**: 기능
- **사전 조건**: 2인 PLAYING 상태
- **테스트 절차**:
  1. 유저A: `COMBO_ATTACK(combo=1)` 발행
  2. 유저B: GARBAGE_ATTACK 미수신 확인
- **기대 결과**: GARBAGE_ATTACK 미발송. 1콤보는 공격 없음(자기 점수만).
- **검증 방법**: 유저B WebSocket 이벤트 목록에 GARBAGE_ATTACK 없음
- **우선순위**: P2 High

---

### TC-COMBO-04: Garbage Line 형식 — 랜덤 구멍 1개, 회색 블록

- **테스트 유형**: 기능
- **사전 조건**: 2인 PLAYING, 유저B가 Garbage 수신 후 적용
- **테스트 절차**:
  1. Garbage 2줄 수신 후 piece lock 대기
  2. piece lock 시 보드 하단 2줄 상태 확인
- **기대 결과**:
  - 하단 2줄: 회색 블록(#888888 계열)으로 채워짐
  - 각 줄에 랜덤 1칸이 비어있음 (0~10 중 1칸)
  - 같은 공격 배치에서 두 줄의 빈칸 위치가 동일 (PRD §7.2: 동일 공격의 여러 줄은 같은 hole)
  - 기존 보드 내용이 위로 밀려 올라감
- **검증 방법**: 프론트엔드 보드 렌더링 시각 확인 + 보드 배열 dump
- **우선순위**: P1 Critical

---

### TC-COMBO-05 (TC-17): Garbage 8줄 누적 → 즉시 게임오버

- **테스트 유형**: 기능 / 엣지 케이스
- **사전 조건**: 유저B의 보드가 충분히 채워진 상태 (top 근처)
- **테스트 절차**:
  1. 유저B에게 총 8줄 이상의 Garbage 누적 적용 (여러 번 공격으로 누적)
  2. 8줄째 적용 시점에 즉시 게임오버 처리 여부 확인
- **기대 결과**: 8줄 초과 시 보드 상단을 넘어 Block Out → `PLAYER_FINISHED(playerId=B)` 즉시 브로드캐스트
- **검증 방법**: 정확히 8줄 이상 누적 시 PLAYER_FINISHED 수신 확인
- **우선순위**: P2 High

---

### TC-COMBO-06 (TC-10): 4인 동시 Garbage 교차 공격 (동시성)

- **테스트 유형**: 기능 / 통합 / 동시성
- **사전 조건**: 4인 PLAYING 상태
- **테스트 절차**:
  1. 4인이 동시에 `COMBO_ATTACK(combo=2)` 발행 (타이밍 최대한 동시)
  2. 각 플레이어의 이벤트 수신 확인
  3. 서버 로그에서 예외(NullPointerException, ConcurrentModificationException 등) 없음 확인
- **기대 결과**: 4명 각각 올바른 대상에게 `GARBAGE_ATTACK(lines=1)` 전송. race condition 없이 처리. 게임 상태 일관성 유지.
- **검증 방법**: WebSocket 이벤트 캡처, 서버 에러 로그 점검
- **우선순위**: P2 High

---

## TC-CONN: 연결 끊김 처리 (5개)

### TC-CONN-01 (TC-09): 게임 중 클라이언트 WebSocket 강제 끊김

- **테스트 유형**: 기능 / 에러 상태
- **사전 조건**: 2인 이상 PLAYING 상태
- **테스트 절차**:
  1. 유저B: 브라우저 탭 강제 닫기 (SessionDisconnectEvent 유발)
  2. 유저A의 이벤트 수신 확인
  3. 유저B 재연결 시도: `/ws-battle` 재연결 후 구독
  4. `ROOM_STATE` 수신 여부 확인
  5. 유저B 전적 저장 여부 확인
- **기대 결과**:
  - 2단계: 유저A에게 `PLAYER_LEFT(playerId=B)` 브로드캐스트 수신
  - 4단계: 재연결 후 `ROOM_STATE` 수신하여 현재 방 상태 복구 가능
  - 5단계: 연결 끊김은 total_games 미집계 (battle_record 변화 없음)
- **검증 방법**: WebSocket 이벤트 캡처, DB 읽기 전용 조회
- **우선순위**: P2 High

---

### TC-CONN-02: 대기 중 전원 이탈 → 방 소멸

- **테스트 유형**: 기능 / 엣지 케이스
- **사전 조건**: 1인 WAITING 방
- **테스트 절차**:
  1. 유저A만 대기 중 → `LEAVE_BATTLE` 발행
  2. DB 조회: `battle_room.closed_at` 기록 확인
  3. 서버 인메모리에서 방 제거 확인 (다음 join 시 새 방 생성)
- **기대 결과**: `closed_at` 기록됨. 서버 인메모리 방 맵에서 제거. 이후 join 시 새 방 생성 (201).
- **검증 방법**: DB `SELECT closed_at FROM battle_room WHERE room_id = ?`, 이후 join API 새 roomId 반환 확인
- **우선순위**: P2 High

---

### TC-CONN-03 (TC-06): 게임 중 전원 연결 끊김 → 방 FINISHED + closed_at

- **테스트 유형**: 기능 / 엣지 케이스
- **사전 조건**: 2인 PLAYING 상태
- **테스트 절차**:
  1. 유저A, 유저B 모두 동시에 연결 끊김 (탭 닫기)
  2. DB 조회: `battle_room` 상태 및 `closed_at` 확인
- **기대 결과**: `battle_room.status = FINISHED`, `closed_at` 기록됨. DB soft-close 처리.
- **검증 방법**: DB 읽기 전용 조회
- **우선순위**: P2 High

---

### TC-CONN-04: 큐 대기 중 연결 끊김 → 큐 제거 + 다른 대기자 position 갱신

- **테스트 유형**: 기능
- **사전 조건**: 2명이 큐에 대기 중 (position 1, 2)
- **테스트 절차**:
  1. position=1 유저가 연결 끊김
  2. position=2 유저의 이벤트 수신 확인
- **기대 결과**: position=2였던 유저에게 `QUEUE_POSITION(position=1)` 갱신 수신
- **검증 방법**: WebSocket 이벤트 캡처
- **우선순위**: P3 Medium

---

### TC-CONN-05: 게임 중 1인 남기고 상대 연결 끊김 → 자동 우승

- **테스트 유형**: 기능
- **사전 조건**: 2인 PLAYING
- **테스트 절차**:
  1. 유저B 연결 끊김
  2. 유저A 이벤트 수신 확인
- **기대 결과**: `PLAYER_LEFT` + `PLAYER_FINISHED(B, rank=2)` + `GAME_RESULT(A rank=1)` 순차 수신
- **검증 방법**: WebSocket 이벤트 순서 및 payload 확인
- **우선순위**: P2 High

---

## TC-RESULT: 결과 화면 및 랭킹 (4개)

### TC-RESULT-01 (TC-07): 랭킹 조회 API 정상 응답

- **테스트 유형**: 기능
- **사전 조건**: battle_record 데이터 존재 (최소 1건)
- **테스트 절차**:
  1. `GET /api/blockfall-battle/rankings` 호출
  2. 응답 body 확인
  3. 정렬 순서 확인
- **기대 결과**: HTTP 200, `{ "topRankings": [...] }` 형식. win_count DESC, last_played_at DESC 정렬. 최대 10건.
- **검증 방법**: 응답 body의 topRankings 배열, 각 항목에 `rank`, `userId`, `nickname`, `winCount`, `totalGames`, `lastPlayedAt` 필드 존재 확인
- **우선순위**: P2 High

---

### TC-RESULT-02: 랭킹 데이터 없을 때 → 빈 배열 반환

- **테스트 유형**: 기능 / 엣지 케이스
- **사전 조건**: battle_record 데이터 없는 환경 (개발/스테이징)
- **테스트 절차**:
  1. `GET /api/blockfall-battle/rankings` 호출
- **기대 결과**: HTTP 200, `{ "topRankings": [] }`. 500 에러 또는 null 반환 시 실패.
- **검증 방법**: 응답 상태코드 200, topRankings 빈 배열 확인
- **우선순위**: P2 High

---

### TC-RESULT-03 (TC-08): 게스트 랭킹 미집계

- **테스트 유형**: 기능 / 데이터 무결성
- **사전 조건**: 게스트 유저가 1위로 배틀 종료
- **테스트 절차**:
  1. 게스트와 로그인 유저 배틀: 게스트 1위, 로그인 유저 2위
  2. `GET /api/blockfall-battle/rankings` 호출
  3. DB 조회
- **기대 결과**:
  - 랭킹 API에 게스트 닉네임(`손님-XXXX` 형식) 미포함
  - DB `battle_record` 테이블에 게스트 user_id 데이터 없음
  - 로그인 유저의 lose_count만 증가 (2위)
- **검증 방법**: 랭킹 API 응답 + DB SELECT 조회
- **우선순위**: P1 Critical

---

### TC-RESULT-04 (TC-12): 배틀 결과 화면 전적 및 랭킹 표시

- **테스트 유형**: E2E / 기능
- **사전 조건**: 배틀 종료 (GAME_RESULT 수신)
- **테스트 절차**:
  1. 배틀 종료 후 결과 화면 표시 확인
  2. 결과 화면 내 표시 요소 확인
  3. 홈화면 접근 후 랭킹 요소 미노출 확인
- **기대 결과**:
  - 결과 화면: 순위, 닉네임, 점수 표시
  - 결과 화면 내 "역대 승수 TOP 10" 랭킹 패널 존재
  - 홈화면 DOM에 배틀 랭킹 관련 요소 없음 (class/id 확인)
- **검증 방법**: UI 확인 + 홈화면 DOM 검사
- **우선순위**: P1 Critical

---

## TC-EDGE: 엣지 케이스 (8개)

### TC-EDGE-01 (TC-11): Test Lab 섹션을 통해서만 배틀 모드 진입 가능

- **테스트 유형**: 기능 / E2E
- **사전 조건**: 홈화면 로드
- **테스트 절차**:
  1. 홈화면 로드 → Test Lab 섹션 존재 확인
  2. 홈 메인 네비게이션에 배틀 모드 링크 없음 확인
  3. 일반 게임 카드 목록에 배틀 모드 카드 없음 확인
  4. Test Lab → 배틀 카드 클릭 → `/test-lab/blockfall-battle` 이동 확인
  5. "테스트 단계" 배너 표시 확인
- **기대 결과**:
  - 1단계: Test Lab 섹션 존재
  - 2~3단계: 배틀 카드/링크 일반 영역 미노출
  - 4단계: URL `/test-lab/blockfall-battle` 라우팅 성공
  - 5단계: "테스트 단계 — 운영 게임 아님" 배너 또는 이에 준하는 문구 표시
- **검증 방법**: UI + 브라우저 URL 확인 + DOM 검사 (일반 게임 목록에 배틀 링크 없음)
- **우선순위**: P1 Critical

---

### TC-EDGE-02 (TC-14): 잘못된 guestToken 형식 다양한 패턴

- **테스트 유형**: 보안 / 에러 상태
- **사전 조건**: 없음
- **테스트 절차**:
  1. `guestToken: "abc123"` (guest_ 접두사 없음) → 401 확인
  2. `guestToken: "guest_"` (uuid 없음) → 401 확인
  3. `guestToken: "GUEST_b3f1a2d4"` (대문자 접두사) → 401 확인
  4. `guestToken: ""` (빈 문자열) → 401 확인
- **기대 결과**: 모든 케이스에서 HTTP 401, `UNAUTHORIZED_GUEST_TOKEN`
- **검증 방법**: 각 패턴별 API 응답 코드 확인
- **우선순위**: P1 Critical

---

### TC-EDGE-03 (TC-15): 동일 user_id 이중 방 참가 시도 → 409 ALREADY_IN_ROOM

- **테스트 유형**: 기능 / 에러 상태
- **사전 조건**: 로그인 유저가 PLAYING 방에 활성 참가 중
- **테스트 절차**:
  1. 해당 유저로 `POST /api/blockfall-battle/join` 재호출
  2. 응답 확인
- **기대 결과**: HTTP 409, `{ "error": "ALREADY_IN_ROOM", "roomId": "<기존 방 ID>" }`
- **검증 방법**: API 응답 상태코드 409, 에러 코드, 기존 roomId 일치 확인
- **우선순위**: P1 Critical

---

### TC-EDGE-04: 카운트다운 직전 이탈로 인원 1명 → MATCH_COUNTDOWN_CANCELLED

- **테스트 유형**: 기능 / 엣지 케이스
- **사전 조건**: 2인 카운트다운 시작 직후
- **테스트 절차**:
  1. MATCH_COUNTDOWN 수신 직후 유저B 이탈
  2. 유저A 이벤트 확인
- **기대 결과**: `MATCH_COUNTDOWN_CANCELLED` 수신. 방 WAITING 유지. 카운트다운 중단.
- **검증 방법**: WebSocket 이벤트 MATCH_COUNTDOWN_CANCELLED 수신 확인
- **우선순위**: P2 High

---

### TC-EDGE-05: FINISHED 상태 방에 join 시도 → ROOM_NOT_AVAILABLE

- **테스트 유형**: 에러 상태
- **사전 조건**: 방이 FINISHED 상태 (결과 화면 표시 중)
- **테스트 절차**:
  1. FINISHED 상태의 방 roomId를 직접 지정하여 WebSocket 메시지 발행 시도
  2. 에러 수신 확인
- **기대 결과**: `{ "type": "ERROR", "code": "ROOM_NOT_AVAILABLE" }` 수신
- **검증 방법**: 개인 에러 큐 메시지 확인
- **우선순위**: P3 Medium

---

### TC-EDGE-06: 참가하지 않은 방에 메시지 발행 → NOT_IN_ROOM 에러

- **테스트 유형**: 보안 / 에러 상태
- **사전 조건**: 유저A가 방 B에 참가하지 않은 상태
- **테스트 절차**:
  1. 유저A: `/app/blockfall-battle/room/{roomId_B}/board-state` 발행 (참가하지 않은 방)
  2. 에러 수신 확인
- **기대 결과**: `{ "type": "ERROR", "code": "NOT_IN_ROOM" }` 수신
- **검증 방법**: 개인 에러 큐 메시지 확인
- **우선순위**: P2 High

---

### TC-EDGE-07: 결과 화면 10초 후 대기자 없으면 1명만 → 카운트다운 미시작

- **테스트 유형**: 기능 / 엣지 케이스
- **사전 조건**: 배틀 종료 후 1명만 남은 방
- **테스트 절차**:
  1. 2인 배틀 종료 → 1명만 방에 남음
  2. 10초 후 WAITING 전이
  3. 새 카운트다운 시작 여부 확인
- **기대 결과**: MATCH_COUNTDOWN 미발송. 방은 WAITING 상태 유지. 다음 유저 입장 대기.
- **검증 방법**: 10초 이후 MATCH_COUNTDOWN 이벤트 미수신 확인
- **우선순위**: P2 High

---

### TC-EDGE-08: guestToken 재사용으로 다른 방 재입장 가능

- **테스트 유형**: 기능
- **사전 조건**: 게스트 배틀 종료 후 guestToken 보유
- **테스트 절차**:
  1. 배틀 종료 (FINISHED) 후 동일 guestToken으로 `POST /api/blockfall-battle/join` 재호출
  2. 새 방 입장 확인
- **기대 결과**: 동일 guestToken으로 재입장 성공. 새 방 또는 WAITING 방에 합류.
- **검증 방법**: join API 응답 정상(200/201), isGuest=true 확인
- **우선순위**: P3 Medium

---

## TC-REG: 회귀 테스트 (5개)

### TC-REG-01 (RT-01): 싱글 블록폴 정상 동작

- **테스트 유형**: 회귀 / Smoke
- **사전 조건**: 배틀 모드 배포 완료
- **테스트 절차**:
  1. `/blockfall` 페이지 접속
  2. 게임 시작 및 기본 플레이
  3. 점수 등록 API 호출 (HMAC 포함)
  4. 랭킹 조회
- **기대 결과**: 싱글 블록폴 모든 기능 정상. `/ws-battle` 신규 엔드포인트 추가가 기존 `/ws` 에 영향 없음.
- **검증 방법**: 게임 완료 후 점수 등록 성공 (200), 랭킹 API 정상 응답 (200)
- **우선순위**: P1 Critical

---

### TC-REG-02 (RT-02): 인세인 블록폴 정상 동작

- **테스트 유형**: 회귀 / Smoke
- **사전 조건**: 배틀 모드 배포 완료
- **테스트 절차**:
  1. `/blockfall-insane` 또는 어드민 접근 경로로 인세인 페이지 접속
  2. 게임 시작, insane 이벤트 발동 확인
  3. 점수 등록 정상 확인
- **기대 결과**: 인세인 블록폴 기능 정상. `battle_record` 신규 테이블 추가가 기존 `rankings` 테이블/API에 영향 없음.
- **검증 방법**: 이벤트 발동, 랭킹 API (`/api/rankings/blockfall-insane`) 정상 응답
- **우선순위**: P1 Critical

---

### TC-REG-03 (RT-03): RPS 온라인 정상 동작

- **테스트 유형**: 회귀 / Smoke
- **사전 조건**: 배틀 모드 배포 완료
- **테스트 절차**:
  1. `/online-rps` 접속, 2인 매칭
  2. 기존 `/ws` WebSocket 연결
  3. `ROOM_STATE`, `MATCH_COUNTDOWN`, `GAME_STARTED`, `ROUND_RESULT` 정상 수신
- **기대 결과**: RPS 게임 전체 플로우 정상. `/ws-battle` 신규 엔드포인트 추가가 기존 `/ws` + `/topic/rps/**` 에 영향 없음. SecurityConfig 신규 경로 추가가 기존 인증 규칙 변경 없음.
- **검증 방법**: RPS 전체 E2E 플로우 확인
- **우선순위**: P1 Critical

---

### TC-REG-04 (RT-04): 채팅/룸 기능 정상 동작

- **테스트 유형**: 회귀 / Smoke
- **사전 조건**: 배틀 모드 배포 완료
- **테스트 절차**:
  1. `GET /api/chat/rooms` 정상 응답 확인
  2. WebSocket 채팅 메시지 발행/수신 (`/topic/room/**`)
  3. 입장/퇴장 SYSTEM 메시지 정상
- **기대 결과**: 채팅 기능 회귀 없음. `SessionDisconnectEvent` 처리 코드 변경 시 채팅 끊김 처리 영향 없음 확인.
- **검증 방법**: 채팅 API + WebSocket 이벤트 정상 확인
- **우선순위**: P1 Critical

---

### TC-REG-05 (RT-05): 홈화면 기존 게임 카드 정상 표시

- **테스트 유형**: 회귀 / Smoke
- **사전 조건**: 배틀 모드 배포 완료
- **테스트 절차**:
  1. 홈화면 로드
  2. 기존 게임 카드 목록 확인 (Blockfall, Apple, Baseball 등)
  3. 배틀 카드가 일반 게임 목록에 없음 확인
- **기대 결과**: 기존 게임 카드 전부 정상 표시. 배틀 카드는 Test Lab 섹션에만 존재.
- **검증 방법**: UI 확인 + DOM 검사
- **우선순위**: P1 Critical

---

## TC-PERF: 성능 (3개)

### TC-PERF-01: `POST /api/blockfall-battle/join` 응답 시간

- **테스트 유형**: 성능
- **사전 조건**: 서버 정상 운영 상태
- **테스트 절차**:
  1. `POST /api/blockfall-battle/join` 순차 10회 호출 (로그인/게스트 혼합)
  2. 응답 시간 측정
- **기대 결과**: p95 응답 시간 500ms 이내
- **검증 방법**: 브라우저 DevTools Network 탭 응답 시간 확인
- **우선순위**: P3 Medium

---

### TC-PERF-02: 4인 BOARD_STATE 동시 발행 → 브로드캐스트 지연

- **테스트 유형**: 성능
- **사전 조건**: 4인 PLAYING 상태
- **테스트 절차**:
  1. 4인이 200ms 주기로 BOARD_STATE 발행
  2. 각 플레이어의 BOARD_UPDATE 수신까지 지연 측정
- **기대 결과**: 4인 기준 브로드캐스트 지연 200ms 이내 (PRD §14: 클라이언트 발송 즉시 전파)
- **검증 방법**: WebSocket 이벤트 timestamp 비교
- **우선순위**: P3 Medium

---

### TC-PERF-03: `GET /api/blockfall-battle/rankings` 다수 데이터 응답 시간

- **테스트 유형**: 성능
- **사전 조건**: battle_record 데이터 다수 존재 (100건 이상)
- **테스트 절차**:
  1. `GET /api/blockfall-battle/rankings` 10회 호출
  2. 응답 시간 측정
- **기대 결과**: p95 응답 시간 300ms 이내. `idx_battle_record_wins` 인덱스 활용 확인.
- **검증 방법**: 응답 시간 측정
- **우선순위**: P3 Medium

---

## TC-ACCESS: 접근성 (2개)

### TC-ACCESS-01: 키보드만으로 배틀 입장 및 게임 가능 여부

- **테스트 유형**: 접근성
- **사전 조건**: 홈화면 로드
- **테스트 절차**:
  1. Tab 키로 Test Lab 섹션 카드까지 포커스 이동
  2. Enter/Space로 배틀 카드 진입
  3. 배틀 중 블록폴 키보드 조작 (방향키, Space: hard drop 등) 확인
- **기대 결과**: 마우스 없이 키보드만으로 배틀 진입 및 게임 플레이 가능. 기존 BlockfallBoard 키 조작 정상 유지.
- **검증 방법**: 마우스 미사용 실제 조작 테스트
- **우선순위**: P4 Low

---

### TC-ACCESS-02: 색상 대비 — 결과 화면 및 게스트 배지

- **테스트 유형**: 접근성
- **사전 조건**: 배틀 결과 화면 표시 중
- **테스트 절차**:
  1. 결과 화면 순위 텍스트, 승/패 결과 텍스트의 색상 대비 측정
  2. 게스트 표시 배지 색상 대비 측정
- **기대 결과**: WCAG AA 기준 최소 4.5:1 대비비 충족
- **검증 방법**: Chrome DevTools > Accessibility 또는 color contrast checker 도구 사용
- **우선순위**: P4 Low

---

## PRD §15 엣지 케이스 전수 매핑

| EC-ID | 상황 요약 | 대응 TC |
|---|---|---|
| EC-1 | 방 정원(4명) 초과 입장 시도 | TC-JOIN-05 |
| EC-2 | 게스트가 JWT 없이 WebSocket 연결 | TC-SEC-01, TC-JOIN-02 |
| EC-3 | 잘못된 guestToken 형식 | TC-SEC-02, TC-EDGE-02 |
| EC-4 | 콤보 발동 시 생존자 본인밖에 없음 | TC-GAME-06 |
| EC-5 | 큐 대기 중 LEAVE_BATTLE | TC-CONN-04 |
| EC-6 | 게임 중 전원 연결 끊김 | TC-CONN-03 |
| EC-7 | 게임 중 1명만 남음 → 자동 우승 | TC-GAME-03 |
| EC-8 | 동일 user_id 두 개 방 동시 참가 | TC-EDGE-03, TC-JOIN-03 |
| EC-9 | 콤보 값 음수/비정상 | TC-GAME-05 |
| EC-10 | board 배열 형식 불량 | TC-GAME-04 |
| EC-11 | Garbage 누적 8줄 초과 | TC-COMBO-05 |
| EC-12 | 결과 후 1명만 → 카운트다운 미시작 | TC-EDGE-07 |
| EC-13 | 시작 직전 1명 이탈 → 카운트다운 취소 | TC-MATCH-02, TC-EDGE-04 |
| EC-14 | 게스트 닉네임 충돌 | TC-JOIN-02 (닉네임 포맷 검증) |
| EC-15 | 중복 콤보 메시지 시퀀스 | 구현 확정 후 TC 추가 예정 (OQ-9) |

---

## 반려 기준 체크리스트

다음 조건 중 하나라도 해당되면 PR 반려 + 담당 developer에게 차단 메시지:

- [ ] PRD §3: "Excel 모드 N/A" 명시인데 Excel 관련 코드가 배틀 모드에 추가된 경우
- [ ] TC-EDGE-01: Test Lab 외 경로(홈 게임 목록, 메인 네비게이션)에 배틀 모드 노출 발견 시
- [ ] TC-RESULT-04: 홈화면에 배틀 랭킹 요소 노출 발견 시
- [ ] TC-JOIN-02 / TC-RESULT-03: 게스트 전적이 battle_record에 저장되는 경우
- [ ] TC-REG-01 ~ TC-REG-04: 기존 싱글 블록폴, 인세인 블록폴, RPS, 채팅 기능 회귀 파손 발견 시
- [ ] TC-COMBO-01 / TC-COMBO-02: 콤보-Garbage 줄 수 매핑 오류 발견 시
- [ ] TC-SEC-03: 기존 `/ws` 엔드포인트가 guestToken을 허용하는 경우 (격리 파손)
- [ ] P1 Critical 버그 미해결 상태로 완료 요청

---

## 모드 검증 섹션

- Excel 모드: **N/A** — PRD §3에서 "Excel 모드 이번 버전 제외" 명시 확인.
- developer-frontend는 일반 모드만 구현 의무. Excel 관련 코드 발견 시 즉시 반려.

---

## 회귀 영향 평가

### 배틀 모드 신규 도입으로 인한 공통 모듈 변경 영향

| 변경 영역 | 영향 범위 | 회귀 검증 TC |
|---|---|---|
| 신규 WebSocket 엔드포인트 `/ws-battle` | 기존 `/ws` (채팅, RPS) 영향 없음 확인 | TC-REG-03, TC-REG-04 |
| `BlockfallBattleHandshakeInterceptor` 신규 추가 | 기존 `JwtHandshakeInterceptor` 변경 여부 확인 | TC-SEC-03, TC-REG-03 |
| `SecurityConfig` `/api/blockfall-battle/**` 규칙 추가 | 기존 인증 규칙 우선순위 변경 없음 | TC-REG-01~05 |
| `SessionDisconnectEvent` 처리 코드 | 채팅/RPS 끊김 처리에 배틀 처리 코드 혼입 없음 | TC-REG-03, TC-REG-04 |
| `battle_record` 신규 테이블 추가 | 기존 `rankings` 테이블 API 영향 없음 | TC-REG-01, TC-REG-02 |

### 방안 B 선택 시 추가 회귀 위험

PRD §6.4: "방안 B(기존 `/ws` 재사용 + JwtHandshakeInterceptor 수정)는 다른 게임 영향 가능 — 회귀 위험"
developer-backend가 방안 B를 선택한 경우, 회귀 TC 범위를 전체 기존 게임으로 확장 필요.

---

## 테스트 환경 요구사항

| 항목 | 요구사항 |
|---|---|
| 브라우저 | Chrome 최신 (기준), Edge 추가 확인 |
| 동시 접속 시뮬레이션 | 최소 4개 탭/브라우저 세션 (4인 게임 TC) |
| 게스트 시뮬레이션 | 시크릿 탭 또는 별도 브라우저 (JWT 미포함 세션) |
| 네트워크 | 일반망 + DevTools Network Throttle (연결 끊김 시뮬레이션) |
| DB 접근 | 읽기 전용 조회만 — Railway 프로덕션 쓰기 쿼리 절대 금지 |
| WebSocket 도구 | STOMP over SockJS. 브라우저 DevTools WS 탭으로 이벤트 캡처 |
| 환경 | 로컬 개발 환경 우선 — 프로덕션 직접 E2E는 사용자 승인 후 |

---

## 미결 사항 (구현 확정 후 TC 업데이트 필요)

| ID | 항목 | 담당 | 시점 | 상태 |
|---|---|---|---|---|
| OQ-1 | 게스트 인증 방안 A/B 최종 선택 | developer-backend | CP3 | **확정: 방안 A** — /ws-battle 신규 엔드포인트. TC-SEC-03 기준 유지. |
| OQ-3 | 4인 꽉 찼을 때 카운트다운 즉시 만료 여부 | developer-backend | CP3 | **확정: 즉시 만료** — TC-MATCH-01 조건 갱신 완료(아래 참고). |
| OQ-9 | 콤보 메시지 중복 시퀀스 ID 도입 | developer-backend | Phase 2 | **미구현 유지** — EC-15 TC는 Phase 2 이후 추가. |
| OQ-5 | 결과 화면 후 큐 대기자 컨펌 여부 | designer | CP2 | 미확정 — TC-MATCH-05 플로우 현행 유지. |

---

## OQ 확정에 따른 TC 조정 내역

### OQ-1 확정 (방안 A) — TC 영향 없음

기존 TC-SEC-03 기준 그대로 유지: 기존 `/ws` 엔드포인트에 guestToken 전달 시 거부 확인.
회귀 범위 확대 불필요. TC-SEC 전체 기준 변경 없음.

### OQ-3 확정 (4인 즉시 만료) — TC-MATCH-01 조건 갱신

**수정 전**: "2인 이상 충족 시 MATCH_COUNTDOWN(secondsRemaining=5) 브로드캐스트"
**수정 후 (아래 TC-MATCH-01 참고)**:
- 2~3인: MATCH_COUNTDOWN(seconds=5) 후 5초 경과 시 GAME_STARTED
- 4인 동시 충족: MATCH_COUNTDOWN(seconds=0) + 즉시 GAME_STARTED (카운트다운 없음)

TC-MATCH-01 본문은 아래 갱신된 버전을 기준으로 실행.

### Block Out 감지 방식 — TC-GAME-02 조정 필요

developer-backend 통보 내용: "Block Out 감지 미정의 — 서버가 BOARD_STATE에서 암묵적 감지" 방식 선택.
이는 PRD §10.3.5에서 명시한 "PLAYER_FINISHED: 한 플레이어의 보드가 Block Out → 서버가 즉시 브로드캐스트" 흐름과 구현 방식이 일치하지 않음.

**현재 구현**: 클라이언트가 자신의 Block Out을 감지하고 서버에 `PLAYER_FINISHED` 신호를 별도 메시지로 보내는 명시적 경로가 없음.
`BlockfallBattleWebSocketController`에 PLAYER_FINISHED 수신 핸들러(`@MessageMapping("...player-finished")`)가 없음.
`BattleRoomService.handlePlayerFinished()`는 존재하나 WebSocket 컨트롤러에서 노출되지 않음.

이에 따라 TC-GAME-02의 트리거 조건을 조정:
- **조정 전**: 유저B 보드 Block Out 상태 유발 → 서버가 즉시 PLAYER_FINISHED 브로드캐스트
- **조정 후**: 클라이언트가 Block Out 감지 시 서버에 게임오버 신호를 보내는 메시지 경로 필요 여부를 developer-backend에 확인 후 실행. 현재 TC-GAME-02는 "보류" 상태로 전환.

**이 항목은 BUG-001로 제기됨 (docs/review/blockfall-battle-bugs.md 참조).**
