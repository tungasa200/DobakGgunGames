# 테스트 플랜 — 실시간 채팅 Test Room

- 작성자: qa-tester
- 작성일: 2026-04-23
- 기준 문서: `docs/specs/chat-testroom.md` r2 (확정)
- 상태: 초안 — 구현 완료 대기 중 (developer-frontend / developer-backend 착수 가능 상태)
- Excel 모드 범위: **미적용** (PRD 2장 모드 적용 범위 확인 완료 — 일반 모드만)

---

## 0. 테스트 전제 조건 및 방침

- **Excel 모드 검증 항목 없음**: PRD 2장에서 Excel 모드 적용을 명시적으로 제외함. 일반 모드만 검증.
- **Redis 직접 조작**: 로컬 환경에서 Redis CLI로 키/TTL 확인. Railway 프로덕션 DB 읽기 전용.
- **STOMP 직접 테스트**: `wscat` 또는 STOMP over WebSocket 클라이언트(예: STOMP.js 스크립트)로 핸드셰이크 수준 테스트.
- **테스트 계정 준비 필요**: USER 등급 1개 / FRIEND 등급 2개 이상 / ADMIN 등급 1개.
- **등급명 노출 감사**: 브라우저 DevTools Network/Console 포함 UI 전체에서 "도박꾼", "FRIEND" 문자열 노출 여부 확인.
- **EC-13 (Rate Limit)**: PRD 8-2 에서 MVP 미포함(Nice-to-have)으로 확인. 테스트 플랜에 포함하되 구현 여부에 따라 선택 실행.

---

## 1. 섹션 1: 보안 시나리오 (최우선)

| TC ID | 시나리오 | 전제 조건 | 입력/행동 | 기대 결과 | 판정 기준 |
|---|---|---|---|---|---|
| TC-SEC-01 | 비로그인 상태에서 `/dbgchat` 직접 URL 진입 | 로그아웃 상태 (세션 없음) | 브라우저 주소창에 `/dbgchat` 입력 후 접근 | `/login`으로 리다이렉트 | 302/리다이렉트 발생, `/dbgchat` 렌더링 없음 |
| TC-SEC-02 | USER 등급 계정으로 `/dbgchat` 진입 — 차단 페이지 문구 확인 | USER 등급 계정으로 로그인 완료 | `/dbgchat`로 이동 | URL 유지 + 차단 페이지 표출. 헤더: "접근 권한이 없습니다", 본문: "이 기능은 특별 등급 이상만 이용할 수 있습니다. 공개 채팅 기능은 준비 중입니다.", 버튼: "홈으로 돌아가기" | (1) URL이 `/dbgchat`로 유지되는지. (2) "도박꾼", "FRIEND", "USER" 등 등급명이 화면/콘솔/네트워크 응답에 노출되지 않는지. (3) "홈으로 돌아가기" 클릭 시 `/`로 이동하는지 |
| TC-SEC-03 | USER 등급으로 WebSocket 직접 연결 시도 | USER 등급 유효 JWT 보유 | wscat 또는 스크립트로 `/ws`에 STOMP CONNECT 프레임 발송 (USER JWT 사용) | 서버가 403 Forbidden으로 연결 거부 후 Close | HTTP 업그레이드 응답 또는 STOMP 에러 프레임에서 403 코드 확인. 연결이 즉시 Close됨 |
| TC-SEC-04 | 만료된 JWT로 WebSocket 연결 시도 | 만료된 JWT 토큰 (exp 과거) | STOMP CONNECT 헤더에 만료 JWT 포함하여 `/ws` 접속 | 서버가 401 Unauthorized로 연결 거부 후 Close | 401 응답 코드 확인. EC-2 문구 "세션이 만료되었습니다. 다시 로그인해주세요." 가 프론트 토스트로 표출되는지 확인 |
| TC-SEC-05 | 위조된 JWT (서명 불일치)로 WebSocket 연결 시도 | 임의로 조작된 JWT 문자열 | STOMP CONNECT 헤더에 위조 JWT 포함하여 `/ws` 접속 | 서버가 401 Unauthorized로 연결 거부 후 Close | 401 응답 코드 확인. EC-3 문구 "유효하지 않은 토큰입니다." 처리 확인. 서버 로그에 ERROR 레벨 예외 기록 여부 확인 |
| TC-SEC-06 | FRIEND 등급 계정 — 정상 접근 | FRIEND 등급 계정으로 로그인 | `/dbgchat` 진입 → 방 목록 페이지 로딩 | 방 목록 페이지 정상 렌더링. WebSocket 연결 성공 | 방 목록 API 200 응답. STOMP CONNECTED 프레임 수신. 차단 페이지 미표출 |
| TC-SEC-07 | ADMIN 등급 계정 — 정상 접근 + 방 삭제 버튼 노출 | ADMIN 등급 계정으로 로그인 | `/dbgchat` 진입 → 방 목록 확인 → 개별 방 입장 | 방 목록/채팅방 정상 렌더링. 방 카드 또는 채팅방 내부에 "방 삭제" 버튼(또는 동등한 ADMIN 전용 UI)이 FRIEND 계정에서는 보이지 않고 ADMIN 계정에서만 노출됨 | FRIEND 계정으로 동일 방 접근 시 삭제 버튼 미노출 확인 (비교 검증) |
| TC-SEC-08 | 클라이언트가 STOMP SEND 페이로드에 nickname 필드 위조 시도 | FRIEND 등급으로 WebSocket 연결 완료 | SEND `/app/chat/{roomId}` 페이로드에 `{"message": "test", "nickname": "해커닉"}` 포함하여 발송 | 브로드캐스트 메시지의 nickname이 서버 세션 Principal에서 주입한 실제 닉네임으로 덮어쓰여 수신됨 | 다른 클라이언트(B 계정)가 수신한 메시지의 nickname이 "해커닉"이 아닌 서버 주입 실제 닉네임인지 확인 |

---

## 2. 섹션 2: 채팅방 생성/목록 시나리오

| TC ID | 시나리오 | 전제 조건 | 입력/행동 | 기대 결과 | 판정 기준 |
|---|---|---|---|---|---|
| TC-ROOM-01 | 방 이름 1자 입력 → 생성 성공 | FRIEND 등급 로그인. 활성 방 50개 미만 | `POST /api/chat/rooms` body: `{"name": "A"}` | 201 Created. roomId 8자리 `[a-z0-9]` 코드 반환 | 응답 roomId가 `^[a-z0-9]{8}$` 정규식 통과. Redis `chat:room:meta:{roomId}` HGETALL로 name="A" 확인 |
| TC-ROOM-02 | 방 이름 30자 입력 → 생성 성공 | FRIEND 등급 로그인. 활성 방 50개 미만 | `POST /api/chat/rooms` body: `{"name": "가나다라마바사아자차카타파하가나다라마바사아자차카타파하가나다라"}` (30자) | 201 Created | 응답 body의 name이 입력값과 동일한지 확인 |
| TC-ROOM-03 | 방 이름 31자 입력 → ROOM_NAME_TOO_LONG | FRIEND 등급 로그인 | `POST /api/chat/rooms` body: `{"name": "가나다라마바사아자차카타파하가나다라마바사아자차카타파하가나다라마"}` (31자) | 400 Bad Request, code: `ROOM_NAME_TOO_LONG`, message: `방 이름은 30자를 넘을 수 없습니다.` | HTTP 400 코드. 응답 JSON에 code/message 필드 확인 |
| TC-ROOM-04 | 방 이름 빈 문자열 → ROOM_NAME_REQUIRED | FRIEND 등급 로그인 | `POST /api/chat/rooms` body: `{"name": ""}` 및 `{"name": "   "}` (공백만) | 400 Bad Request, code: `ROOM_NAME_REQUIRED`, message: `방 이름을 입력해주세요.` | 빈 문자열과 공백만 있는 경우 모두 동일한 400 응답 |
| TC-ROOM-05 | 금칙어 포함 방 이름 → ROOM_NAME_INVALID | FRIEND 등급 로그인. `shared/badwords.json`에 등록된 금칙어 1개 확인 필요 | `POST /api/chat/rooms` body: `{"name": "{금칙어}포함방이름"}` | 400 Bad Request, code: `ROOM_NAME_INVALID`, message: `사용할 수 없는 단어가 포함되어 있습니다.` | HTTP 400 코드. 백엔드 2차 체크에서 차단됨을 확인 (프론트 1차 체크 우회 시나리오도 포함) |
| TC-ROOM-06 | 같은 이름으로 방 2개 생성 → 중복 허용 | FRIEND 등급 로그인. 활성 방 50개 미만 | `POST /api/chat/rooms` body `{"name": "중복테스트방"}`을 2회 연속 호출 | 두 번 모두 201 Created. 서로 다른 roomId 반환 | 두 roomId가 다른 값. 방 목록 API에서 같은 이름의 방 2개가 각각 별도 항목으로 조회됨 |
| TC-ROOM-07 | 활성 방 50개 존재 중 신규 생성 → ROOM_LIMIT_EXCEEDED | Redis `chat:rooms` Sorted Set에 50개 원소 존재 (로컬에서 직접 ZADD로 세팅 또는 50번 생성) | `POST /api/chat/rooms` body: `{"name": "51번째방"}` | 429 Too Many Requests, code: `ROOM_LIMIT_EXCEEDED`, message: `채팅방이 너무 많습니다. 잠시 후 다시 시도해주세요.` | HTTP 429 코드 확인. 방 목록에 새 방이 추가되지 않음 |
| TC-ROOM-08 | 방 목록 조회 → 활성 방만 반환 | FRIEND 등급 로그인. TTL 만료된 roomId가 `chat:rooms`에 잔존하도록 수동 세팅 (로컬 테스트) | `GET /api/chat/rooms` | 200 OK. TTL 만료된 방의 메타 키(`chat:room:meta:{roomId}`) 없는 항목은 응답 rooms 배열에서 제외됨. `degraded: false` | lazy cleanup 동작 확인: 응답에 만료된 roomId 없음. Redis `chat:rooms`에서 해당 원소가 ZREM 처리되었는지 확인 |

---

## 3. 섹션 3: 실시간 채팅 기능 시나리오

| TC ID | 시나리오 | 전제 조건 | 입력/행동 | 기대 결과 | 판정 기준 |
|---|---|---|---|---|---|
| TC-CHAT-01 | 채팅방 입장 시 히스토리 최대 50개 로딩 | Redis `chat:room:{roomId}` List에 60개 메시지 LPUSH (로컬). FRIEND 등급 로그인 | `GET /api/chat/rooms/{roomId}/history` 호출 또는 `/dbgchat/{roomId}` 페이지 진입 | messages 배열 50개. 가장 오래된 것이 index 0 (ASC 정렬). `degraded: false` | messages.length === 50. 61번째 이후(LTRIM으로 삭제된) 메시지는 미포함. roomName 필드 존재 |
| TC-CHAT-02 | 실시간 메시지 A 계정 전송 → B 계정 수신 | A/B 모두 FRIEND 등급으로 동일 roomId에 SUBSCRIBE 완료 | A 계정 브라우저에서 메시지 "안녕하세요" 입력 후 전송 | B 계정 브라우저에서 동일 메시지 실시간 수신. type: CHAT, userId: A의 userId, nickname: A의 닉네임(서버 주입), timestamp 포함 | B 수신 메시지 payload 필드 전수 확인: type/userId/nickname/message/timestamp 모두 존재. 전송~수신 지연 P95 < 800ms (프로덕션 기준) |
| TC-CHAT-03 | nickname 서버 주입 확인 (클라이언트 위조 불가) | TC-SEC-08과 연계 | SEND 페이로드에 nickname 필드 포함하여 발송 | 수신 측 nickname이 서버 세션 Principal 기준 닉네임으로 고정됨 | 위조 nickname 값이 수신 메시지에 절대 반영되지 않음 |
| TC-CHAT-04 | 200자 메시지 전송 성공 | FRIEND 등급. 유효한 roomId에 SUBSCRIBE | 정확히 200자 문자열 SEND | 브로드캐스트 수신 성공. type: CHAT, message 필드 200자 그대로 | 에러 없이 브로드캐스트. `/user/queue/errors`에 에러 메시지 없음 |
| TC-CHAT-05 | 201자 메시지 전송 → MESSAGE_TOO_LONG 또는 UI 단 차단 | FRIEND 등급. 유효한 roomId에 SUBSCRIBE | 201자 문자열 SEND (UI 단 체크가 있으면 우회하여 직접 STOMP SEND) | `/user/queue/errors`로 `MESSAGE_TOO_LONG` 에러 수신. 브로드캐스트 미발생 | (1) 서버가 201자 메시지를 브로드캐스트하지 않음. (2) 에러 큐 응답 code: "MESSAGE_TOO_LONG", message: "메시지는 200자를 넘을 수 없습니다." |
| TC-CHAT-06 | 빈 메시지 전송 차단 확인 | FRIEND 등급. 유효한 roomId에 SUBSCRIBE | 빈 문자열 `{"message": ""}` SEND (UI 단 체크 우회) | `/user/queue/errors`로 `MESSAGE_EMPTY` 에러 수신. 브로드캐스트 미발생 | 에러 큐 code: "MESSAGE_EMPTY", message: "메시지를 입력해주세요." 확인 |
| TC-CHAT-07 | 입장 시스템 메시지 표출 확인 | 방에 B가 먼저 접속 중. A가 신규 입장 | A 계정으로 `/dbgchat/{roomId}` 진입 → SUBSCRIBE | B 브라우저에서 시스템 메시지 수신: type: "SYSTEM", userId: null, nickname: "system", message: "{A의 닉네임}님이 입장하셨습니다." | B 수신 payload 필드 확인. UI에서 시스템 메시지 스타일로 렌더링되는지 확인 |
| TC-CHAT-08 | 퇴장 시스템 메시지 표출 확인 | A/B 모두 동일 방에 접속 중 | A 계정 브라우저에서 탭 닫기 또는 `/dbgchat`로 이동 (연결 해제) | B 브라우저에서 시스템 메시지 수신: type: "SYSTEM", message: "{A의 닉네임}님이 퇴장하셨습니다." | B 수신 payload 확인. Redis `chat:room:{roomId}` List에 퇴장 메시지 JSON이 LPUSH되어 있는지 확인 |

---

## 4. 섹션 4: 재연결 / 연결 상태 시나리오

| TC ID | 시나리오 | 전제 조건 | 입력/행동 | 기대 결과 | 판정 기준 |
|---|---|---|---|---|---|
| TC-CONN-01 | 네트워크 임시 끊김 → 자동 재연결 동작 확인 | FRIEND 등급. 방에 입장 및 채팅 중 | DevTools > Network > Offline 토글 ON → 5초 후 OFF (또는 실제 네트워크 차단) | 오프라인 중 연결 상태 UI 표출. 재연결 시도 (최대 3회). 네트워크 복구 후 재연결 성공 | (1) 재연결 시도 로그 확인 (3회 이내). (2) 재연결 성공 후 STOMP CONNECTED 상태 복귀. (3) 자동 재연결 3회 모두 실패 시 UI에 최종 실패 안내 |
| TC-CONN-02 | 재연결 중 연결 상태 UI 표출 확인 | TC-CONN-01 연계 | 네트워크 끊김 직후 UI 상태 관찰 | 화면에 "서버와 연결이 끊어졌습니다. 재연결 중..." 토스트 또는 배너 표출 | EC-11 문구 정확히 표출. 재연결 성공 시 메시지 사라짐 |
| TC-CONN-03 | 재연결 성공 후 메시지 수신 재개 확인 | TC-CONN-01 연계. 오프라인 중 다른 계정(B)이 메시지 발송 | 재연결 성공 후 B가 메시지 전송 | 재연결 후 B의 메시지가 A 화면에 정상 수신됨 | 오프라인 중 놓친 메시지는 수신 불가(Redis 히스토리 새로 로딩 여부는 구현 의존). 재연결 후 신규 메시지는 반드시 수신 |

---

## 5. 섹션 5: Redis 시나리오

| TC ID | 시나리오 | 전제 조건 | 입력/행동 | 기대 결과 | 판정 기준 |
|---|---|---|---|---|---|
| TC-REDIS-01 | 메시지 101개 전송 → Redis List 100개 유지 | 로컬 환경. FRIEND 등급. 유효한 방. Redis CLI 접근 가능 | 동일 방에 메시지 101개 연속 전송 | Redis CLI `LLEN chat:room:{roomId}` 결과가 100 이하 | LTRIM 0 99 동작 확인. 101번째 메시지 전송 후 LLEN == 100. 가장 오래된 1개가 삭제됨 |
| TC-REDIS-02 | 채팅방 1시간 비활성 → TTL 만료 후 방 목록에서 사라짐 | 로컬 환경. 방 생성 후 메시지 미전송 상태. Redis CLI로 TTL 수동 조작 가능 | `EXPIRE chat:room:meta:{roomId} 1` 로 TTL 1초로 단축 → 대기 후 `GET /api/chat/rooms` 호출 | TTL 만료된 방이 목록 응답에서 제외됨. `chat:rooms` Sorted Set에서 해당 roomId ZREM 처리됨 | lazy cleanup 동작: `EXISTS chat:room:meta:{roomId}` == 0. 방 목록 응답에서 미포함 |
| TC-REDIS-03 | 히스토리 100개 초과 저장 시 조회는 50개만 반환 | Redis `chat:room:{roomId}` List에 100개 LPUSH (로컬 세팅) | `GET /api/chat/rooms/{roomId}/history` 호출 | messages 배열 정확히 50개 반환 (LRANGE 0 49). ASC 정렬 | messages.length === 50. LLEN은 100이지만 LRANGE 0~49만 응답에 포함 |

---

## 6. 섹션 6: ADMIN 기능 시나리오

| TC ID | 시나리오 | 전제 조건 | 입력/행동 | 기대 결과 | 판정 기준 |
|---|---|---|---|---|---|
| TC-ADMIN-01 | ADMIN 계정으로 방 즉시 삭제 → SYSTEM 메시지 브로드캐스트 | ADMIN 계정 + FRIEND 계정 B가 동일 방에 SUBSCRIBE 중 | `DELETE /api/chat/rooms/{roomId}` 호출 (ADMIN JWT) | (1) 204 No Content 응답. (2) B 브라우저에서 type: "SYSTEM", message: "채팅방이 종료되었습니다." 수신 | HTTP 204 확인. B 수신 payload: type=="SYSTEM", message=="채팅방이 종료되었습니다." |
| TC-ADMIN-02 | 삭제된 방의 참여자 세션 해제 확인 | TC-ADMIN-01 연계. B가 방에 SUBSCRIBE 중 | ADMIN이 방 삭제 후 B 브라우저 상태 관찰 | B의 WebSocket 구독이 해제됨. 이후 B가 해당 roomId로 SEND 시 `ROOM_NOT_FOUND` 에러 반환 | B 연결 상태 변화 확인. B가 삭제된 방 URL에서 `/dbgchat`로 리다이렉트되거나 "채팅방이 종료되었습니다." 토스트 표출 |
| TC-ADMIN-03 | FRIEND 등급이 방 삭제 시도 → 403 반환 | FRIEND 등급 계정. 유효한 roomId | `DELETE /api/chat/rooms/{roomId}` 호출 (FRIEND JWT) | 403 Forbidden | HTTP 403 코드 확인. 방은 삭제되지 않음 |
| TC-ADMIN-04 | ADMIN이 존재하지 않는 roomId 삭제 시도 → 404 반환 | ADMIN 계정 로그인 | `DELETE /api/chat/rooms/zzzzzzzz` (존재하지 않는 roomId) | 404 Not Found | HTTP 404 코드 확인 |

---

## 7. 섹션 7: 엣지 케이스

| TC ID | 시나리오 | 전제 조건 | 입력/행동 | 기대 결과 | 판정 기준 |
|---|---|---|---|---|---|
| TC-EDGE-01 | 동시 다수 연결 시 메시지 순서 보장 확인 | FRIEND 등급 계정 3개. 동일 방에 SUBSCRIBE | A, B, C 계정이 빠르게 연속 메시지 전송 (각 10개씩 30개) | 수신 측에서 각 발신자의 메시지 순서가 발신 순서와 동일하게 수신됨 | 같은 발신자의 메시지 순서가 역전되지 않음. timestamp 오름차순 일관성 확인 |
| TC-EDGE-02 | 공백만 있는 메시지 (trim 후 빈 문자열) 차단 확인 | FRIEND 등급. 유효한 방에 SUBSCRIBE | `{"message": "   "}` (공백 3칸) SEND | `/user/queue/errors` `MESSAGE_EMPTY` 에러 수신. 브로드캐스트 미발생 | trim 처리 후 빈 문자열 처리됨. UI 단에서도 전송 버튼 비활성화 여부 확인 |
| TC-EDGE-03 | 존재하지 않는 roomId로 직접 URL 진입 | FRIEND 등급 로그인 | 브라우저에서 `/dbgchat/zzzzzzzz` 직접 진입 | 적절한 에러 처리: "채팅방이 종료되었습니다." 토스트 + `/dbgchat`로 이동 또는 404 에러 페이지 | EC-18 처리 확인. 빈 채팅방 화면이 렌더링된 채로 방치되지 않음 |
| TC-EDGE-04 | roomId 패턴 위반 URL 진입 | FRIEND 등급 로그인 | `/dbgchat/INVALID!!` (정규식 `^[a-z0-9]{8}$` 불일치) | 400 Bad Request 또는 프론트에서 에러 처리 | 서버가 400 반환 또는 프론트 가드에서 유효하지 않은 roomId 처리 |
| TC-EDGE-05 | 다중 탭 동일 방 접속 시 입장 메시지 중복 발송 | FRIEND 등급 계정 A. 동일 방에 탭 2개로 접속 | A 계정으로 탭 1에서 입장 후 탭 2에서 동일 방 재입장 | 입장 시스템 메시지 2회 발송됨 (PRD OQ-3 결정 — 매번 발행이 정책) | 2개 탭 모두 SUBSCRIBE 완료 시 "{A닉네임}님이 입장하셨습니다." 2번 브로드캐스트. 이는 버그 아님(정책 확인) |
| TC-EDGE-06 | 세션 중 등급 FRIEND → USER 강등 (EC-12) | FRIEND 등급으로 방에 입장 중. DB에서 직접 Role 변경(로컬 테스트 전용) | Role 강등 후 SEND 시도 | ChannelInterceptor에서 재인증. `FORBIDDEN` 에러 수신 + 연결 종료 | `/user/queue/errors` code: "FORBIDDEN". 연결 Close 확인 |
| TC-EDGE-07 | 입장 중이던 방이 TTL 만료 (EC-18) | FRIEND 등급으로 방에 입장 중. Redis TTL 수동 단축 | TTL 만료 후 재연결 시도 시 | 재연결 후 히스토리 API 404 응답 → "채팅방이 종료되었습니다." 토스트 + `/dbgchat`로 이동 | EC-18 흐름 전체 확인. 무한 재연결 루프 미발생 |

---

## 8. 섹션 8: Redis Graceful Degradation 시나리오

| TC ID | 시나리오 | 전제 조건 | 입력/행동 | 기대 결과 | 판정 기준 |
|---|---|---|---|---|---|
| TC-DEGRADE-01 | Redis 장애 중 방 생성 시도 → 503 반환 (EC-16) | 로컬 Redis 중단 (`redis-cli shutdown` 또는 컨테이너 중지) | `POST /api/chat/rooms` 호출 | 503 Service Unavailable. code: `REDIS_UNAVAILABLE`, message: "일시적인 오류입니다. 잠시 후 다시 시도해주세요." | HTTP 503 코드. 애플리케이션 전체가 죽지 않음 |
| TC-DEGRADE-02 | Redis 장애 중 방 목록 조회 → degraded 플래그 (EC-10 연관) | 로컬 Redis 중단 | `GET /api/chat/rooms` 호출 | 200 OK. `{"rooms": [], "degraded": true}` | HTTP 200. degraded: true. rooms 빈 배열 |
| TC-DEGRADE-03 | Redis 장애 중 히스토리 조회 → degraded 플래그 (EC-10) | 로컬 Redis 중단. 유효한 roomId (메모리 기준) | `GET /api/chat/rooms/{roomId}/history` 호출 | 200 OK. `{"messages": [], "degraded": true}` | HTTP 200. degraded: true. 프론트가 "히스토리를 불러올 수 없습니다. 새 메시지는 계속 받을 수 있습니다." 배너 표출 |
| TC-DEGRADE-04 | Redis 장애 중 메시지 SEND → 브로드캐스트 성공 (EC-9) | 로컬 Redis 중단. STOMP 연결 유지 중 | 방에서 메시지 SEND | 브로드캐스트는 성공 (다른 구독자가 수신). Redis LPUSH만 실패 (WARN 로그) | 수신 측에서 메시지 수신 확인. Redis 없이도 실시간 메시지 동작. 서버 WARN 레벨 로그 확인 |

---

## 9. 섹션 9: Test Lab 섹션 / HomePage 진입 시나리오

| TC ID | 시나리오 | 전제 조건 | 입력/행동 | 기대 결과 | 판정 기준 |
|---|---|---|---|---|---|
| TC-HOME-01 | 비로그인 상태 — Test Lab 섹션 미노출 | 로그아웃 상태 | 메인 페이지(`/`) 접근 | Test Lab 섹션 전체 미노출 (숨김) 또는 "실시간 채팅 랩" 버튼 클릭 시 `/login`으로 이동 | PRD 5-2에 따라 기본 정책: 비로그인 시 섹션 숨김 |
| TC-HOME-02 | USER 등급 로그인 — Test Lab 섹션 노출 + 진입 시 차단 | USER 등급으로 로그인 | 메인 페이지 → "실시간 채팅 랩" 버튼 클릭 | 버튼은 클릭 가능. `/dbgchat` 이동 후 FriendRoute 가드가 차단 페이지 표출 | TC-SEC-02와 연계 |
| TC-HOME-03 | FRIEND 등급 로그인 — "실시간 채팅 랩" 버튼 클릭 → 정상 진입 | FRIEND 등급으로 로그인 | 메인 페이지 → "실시간 채팅 랩" 버튼 클릭 | `/dbgchat` 방 목록 페이지 정상 렌더링 | 버튼 라벨 "실시간 채팅 랩" 정확히 표시. 클릭 후 `/dbgchat`로 라우팅 |

---

## 10. 섹션 10: 에러 시나리오 전수 검증 (EC-1 ~ EC-18)

PRD 8장 에러 시나리오와 TC 매핑 정리:

| EC ID | PRD 시나리오 | 대응 TC | 우선순위 |
|---|---|---|---|
| EC-1 | 토큰 없이 `/ws` 접속 → 401 Close | TC-SEC-01 | Critical |
| EC-2 | 만료된 JWT → 401 Close | TC-SEC-04 | Critical |
| EC-3 | 위조 JWT → 401 Close | TC-SEC-05 | Critical |
| EC-4 | USER 등급 `/dbgchat` 접근 → 차단 페이지 | TC-SEC-02, TC-HOME-02 | Critical |
| EC-5 | USER 등급 직접 `/ws` 핸드셰이크 → 403 Close | TC-SEC-03 | Critical |
| EC-6 | 빈 문자열 SEND → MESSAGE_EMPTY | TC-CHAT-06, TC-EDGE-02 | High |
| EC-7 | 200자 초과 SEND → MESSAGE_TOO_LONG | TC-CHAT-05 | High |
| EC-8 | 존재하지 않는 roomId로 SEND/SUBSCRIBE → ROOM_NOT_FOUND | TC-EDGE-03, TC-EDGE-04 | High |
| EC-9 | Redis 장애 (LPUSH 실패) → 브로드캐스트 유지 | TC-DEGRADE-04 | High |
| EC-10 | Redis 장애 (LRANGE 실패) → degraded 플래그 | TC-DEGRADE-03 | High |
| EC-11 | WebSocket 연결 끊김 → 재연결 UI | TC-CONN-01, TC-CONN-02 | High |
| EC-12 | 세션 중 등급 강등 → FORBIDDEN + 종료 | TC-EDGE-06 | High |
| EC-13 | 1초 5회 초과 SEND → RATE_LIMITED (선택) | 구현 시 별도 TC 추가 | Nice-to-have |
| EC-14 | 방 이름 금칙어 → ROOM_NAME_INVALID | TC-ROOM-05 | High |
| EC-15 | 활성 방 50개 초과 → ROOM_LIMIT_EXCEEDED | TC-ROOM-07 | High |
| EC-16 | Redis 장애 중 방 생성 → 503 | TC-DEGRADE-01 | High |
| EC-17 | ADMIN 방 삭제 → SYSTEM 브로드캐스트 | TC-ADMIN-01 | High |
| EC-18 | 입장 중 방 TTL 만료 → 404 후 리다이렉트 | TC-EDGE-07 | High |

---

## 11. 섹션 11: 보안 상세 검증

| TC ID | 시나리오 | 전제 조건 | 입력/행동 | 기대 결과 | 판정 기준 |
|---|---|---|---|---|---|
| TC-SEC-09 | 방 이름 XSS 입력 시도 | FRIEND 등급 로그인 | `POST /api/chat/rooms` body: `{"name": "<script>alert(1)</script>"}` | 서버에서 허용 문자 외 판단 → 400 `ROOM_NAME_INVALID` 또는 이스케이프 처리 | 브라우저에서 스크립트 실행 없음. HTML 이스케이프 또는 차단 |
| TC-SEC-10 | 메시지 XSS 입력 시도 | FRIEND 등급. 유효한 방 | `{"message": "<img src=x onerror=alert(1)>"}` SEND | 브로드캐스트는 성공하되, 수신 측 UI에서 HTML 이스케이프 처리되어 스크립트 미실행 | 브라우저 DOM에 script/이벤트핸들러 삽입 없음. React의 기본 이스케이프 동작 확인 |
| TC-SEC-11 | 방 이름 SQL Injection 시도 | FRIEND 등급 로그인 | `POST /api/chat/rooms` body: `{"name": "'; DROP TABLE users; --"}` | 400 `ROOM_NAME_INVALID` (허용 문자 외) 또는 안전하게 처리됨 | 서비스 오류 없음. DB/Redis 이상 없음 |
| TC-SEC-12 | WebSocket SEND에 과도하게 큰 페이로드 시도 | FRIEND 등급. 유효한 방 | 10,000자 문자열 SEND | `MESSAGE_TOO_LONG` 에러 수신. 서버 메모리/성능 이상 없음 | 서버가 정상 에러 처리. 연결 강제 종료 없음 |
| TC-SEC-13 | ADMIN 방 삭제 API를 FRIEND JWT로 호출 | FRIEND 등급 JWT | `DELETE /api/chat/rooms/{roomId}` (FRIEND JWT) | 403 Forbidden | TC-ADMIN-03과 동일. HTTP 403 확인 |

---

## 12. 섹션 12: 성능 기준 검증

| TC ID | 시나리오 | 전제 조건 | 입력/행동 | 기대 결과 | 판정 기준 |
|---|---|---|---|---|---|
| TC-PERF-01 | 메시지 왕복 지연 측정 | FRIEND 2개 계정. 프로덕션 환경 | A에서 전송 타임스탬프 기록 → B 수신 시각 측정 (10회 반복) | P95 < 800ms (프로덕션 기준), P95 < 300ms (로컬 기준) | PRD 12장 성공 지표 기준 |
| TC-PERF-02 | 방 목록 다수 조회 | 로컬에서 방 50개 세팅 | `GET /api/chat/rooms` 반복 10회 | 응답 시간 1초 이내 안정적 | lazy cleanup + HGETALL 50회가 허용 범위 내 처리되는지 확인 |

---

## 13. 섹션 13: 회귀 영향 평가

### 변경된 공통 영역 식별

| 변경 영역 | 영향 범위 | 회귀 검증 항목 |
|---|---|---|
| `FriendRoute` 가드 컴포넌트 신규 추가 | 기존 `AdminRoute` 패턴 재사용 — AdminRoute 동작에 영향 없어야 함 | AdminRoute로 보호된 기존 페이지(Blockfall Insane 등) 정상 접근 여부 확인 |
| `frontend/src/pages/HomePage.tsx` 수정 (Test Lab 섹션 빈 카드에 버튼 추가) | 홈페이지 전체 렌더링, 기존 게임 카드, Test Lab 섹션 기존 UI | 홈페이지 전체 smoke test. 기존 게임 진입 버튼 정상 동작 |
| WebSocket 설정 (`WebSocketConfig.java`) 신규 추가 | 기존 REST API 엔드포인트에 영향 없어야 함 | 기존 REST API (랭킹, 인증 등) 정상 응답 확인 |
| `StompChannelInterceptor.java` 신규 추가 | 기존 Spring Security 필터 체인과 충돌 없어야 함 | 기존 로그인/로그아웃/OAuth2 흐름 정상 동작 확인 |

### 회귀 smoke test 항목 (신규 게임 추가 기준)

- RSP 게임: 방 목록 진입, 게임 플레이, 점수 등록, 랭킹 조회 정상 동작
- Blockfall 일반 모드: 게임 진입, 블럭 낙하, 점수 등록 정상 동작
- Blockfall Insane 모드 (AdminRoute 보호): ADMIN 이상만 접근 가능한지 재확인
- 공통 인증 플로우: JWT 로그인, 로그아웃, 토큰 갱신 정상 동작
- 홈페이지: 기존 게임 카드 렌더링 및 진입 정상 동작

---

## 14. 반려 기준 체크리스트

구현 완료 PR 검토 시 다음 항목 중 하나라도 해당되면 PR 반려 및 해당 developer에게 차단 메시지 전달:

- [ ] USER 등급이 `/dbgchat`에 접근 차단되지 않음 (Critical)
- [ ] USER 등급으로 WebSocket 직접 연결이 성공함 (Critical)
- [ ] 비로그인 상태에서 `/dbgchat` 진입이 차단되지 않음 (Critical)
- [ ] 등급명("도박꾼", "FRIEND", "USER")이 사용자 UI/응답에 노출됨 (Critical)
- [ ] nickname 위조가 브로드캐스트 메시지에 반영됨 (Critical — TC-SEC-08)
- [ ] 200자 초과 메시지가 브로드캐스트됨 (High)
- [ ] 빈/공백 메시지가 브로드캐스트됨 (High)
- [ ] Redis 장애 시 애플리케이션 전체가 다운됨 (High)
- [ ] 방 생성 시 roomId가 `^[a-z0-9]{8}$` 패턴을 따르지 않음 (High)
- [ ] 기존 게임(RSP, Blockfall, Blockfall Insane) smoke test에서 파손 발견 (Critical — 회귀)
- [ ] AdminRoute로 보호된 기존 페이지 접근 제어가 깨짐 (Critical — 회귀)
- [ ] Excel 모드가 적용되어 있음 (반려 불필요 — PRD에서 미적용 확정이므로 오히려 제거 필요)

---

## 15. 테스트 환경 요구사항

| 항목 | 요구사항 |
|---|---|
| 테스트 계정 | USER x1, FRIEND x2, ADMIN x1 (로컬 DB 또는 스테이징) |
| 브라우저 | Chrome 최신 + Firefox 최신 (크로스 브라우저 WebSocket 확인) |
| 도구 | Redis CLI (로컬), wscat 또는 Node.js STOMP 클라이언트 스크립트, Chrome DevTools |
| 환경 | 로컬 개발 환경 (Redis 중단 테스트 포함) + 프로덕션 smoke test |
| 신규 환경변수 | `VITE_WS_URL` — Vercel UI에 추가 필요 (developer-frontend가 머지 전 안내해야 함) |

---

## 16. 미결 사항 / 구현 완료 대기 항목

- developer-backend: 백엔드 전체 구현 미완료 (STOMP 설정, 인터셉터, Redis 서비스, REST 컨트롤러)
- developer-frontend: 페이지 컴포넌트, FriendRoute 가드, STOMP 클라이언트 미구현
- 구현 완료 시 TC 재실행 및 판정 결과 기록 예정
- `VITE_WS_URL` Vercel 환경변수 추가 사용자 안내 수신 확인 필요 (developer-frontend 책임)

---

## 17. 정적 코드 검증 결과 (2026-04-23)

- 검증 방식: 코드 리뷰 기반 정적 분석 (런타임 미실행)
- 검증 완료 파일: Backend 11개, Frontend 10개 (명세 기준 전부)
- 최종 판정: **CONDITIONAL PASS**

### 버그 목록

---

**[CRITICAL] StompChannelInterceptor 컴파일 오류 — import 누락**
- 파일: `backend/src/main/java/com/dobakggun/security/StompChannelInterceptor.java:62`
- 문제: `Map<String, Object> sessionAttributes = ...` 코드가 있으나 파일 상단에 `import java.util.Map`이 없음. 컴파일 실패로 서비스 기동 불가.
- 기대: `import java.util.Map;` 추가
- 담당: developer-backend

---

**[HIGH] StompChannelInterceptor: SUBSCRIBE/SEND 에러 시 메시지 차단 미동작**
- 파일: `backend/src/main/java/com/dobakggun/security/StompChannelInterceptor.java:83~119`
- 문제: `handleSubscribe`/`handleSend` 에서 `FORBIDDEN` 또는 `ROOM_NOT_FOUND` 에러를 발생시킬 때 `preSend` 메서드가 `null` 을 반환하지 않고 원본 `message` 를 그대로 반환. ChannelInterceptor 스펙상 `preSend` 에서 `null` 반환 시 메시지가 차단되어야 함. 현재는 에러 큐에 에러를 보내면서 동시에 메시지도 통과시킴.
- 기대: 에러 조건 발생 시 `preSend`가 `null` 을 반환하여 메시지 파이프라인 차단. `handleSubscribe`/`handleSend`를 boolean 반환으로 리팩터링 후 `preSend` 내에서 `return null` 처리 필요.
- 담당: developer-backend

---

**[HIGH] ChatController: roomId 패턴 검증 누락**
- 파일: `backend/src/main/java/com/dobakggun/controller/ChatController.java:46`
- 문제: `@MessageMapping("/chat/{roomId}")` 에서 roomId 가 `^[a-z0-9]{8}$` 패턴인지 검증하는 코드 없음. StompChannelInterceptor 가 차단에 실패할 경우(`null` 미반환 버그 연계) 유효하지 않은 roomId 로 ChatRedisService 까지 도달하여 임의 Redis 키 접근 가능.
- 기대: `handleMessage` 메서드 상단에 roomId 패턴 검증 추가. 불일치 시 `sendError(ROOM_NOT_FOUND)` 후 return.
- 담당: developer-backend

---

**[HIGH] ChatController: handleDisconnect 다중 방 구독 미처리**
- 파일: `backend/src/main/java/com/dobakggun/controller/ChatController.java:111~136`
- 문제: 세션 속성 `lastRoomId` 단일 String 값만 저장하므로 사용자가 다중 탭으로 여러 방에 접속했을 때 마지막으로 입장한 방 하나에만 퇴장 메시지가 발송됨. 이전 방들에는 퇴장 메시지 미발송.
- 기대: `lastRoomId` → `subscribedRoomIds` (Set) 로 변경하여 모든 구독 방에 퇴장 메시지 발송. 또는 PRD OQ-3 결정(단순화 허용)을 근거로 스펙을 명시적으로 재확인 후 LOW로 조정 가능 — planner 확인 필요.
- 담당: developer-backend

---

**[HIGH] StompChannelInterceptor: handleConnect에서 역할 부족 시 연결 강제 종료 미처리**
- 파일: `backend/src/main/java/com/dobakggun/security/StompChannelInterceptor.java:61~80`
- 문제: `handleConnect` 에서 userId가 null이거나 `isAllowedRole` 이 false 인 경우 `ChatPrincipal` 을 세팅하지 않고 그냥 반환. 에러 응답이나 연결 강제 종료 코드가 없어서 불충분한 자격 증명을 가진 STOMP CONNECT 가 무시만 될 뿐 연결이 유지될 수 있음. `JwtHandshakeInterceptor` 가 1차 방어를 하지만 SockJS fallback 경로에서 세션 속성이 누락된 엣지 케이스에서 2차 방어가 동작하지 않음.
- 기대: 인증 실패 시 `SimpMessageHeaderAccessor` 를 통해 연결 종료하거나 에러 프레임 전송 후 null 반환으로 연결 차단.
- 담당: developer-backend

---

**[MEDIUM] FriendRoute: 화이트리스트 방식이 아닌 블랙리스트 방식 — 미지 role 허용**
- 파일: `frontend/src/components/guards/FriendRoute.tsx:27`
- 문제: `user.role === 'USER'` 만 차단. role 이 `USER` 와 `FRIEND`/`ADMIN` 사이의 알 수 없는 값일 경우(예: DB 직접 수정, 신규 role 추가 시) 차단되지 않음.
- 기대: `user.role !== 'FRIEND' && user.role !== 'ADMIN'` 으로 화이트리스트 방식으로 전환. 또는 `['FRIEND', 'ADMIN'].includes(user.role)` 검사.
- 담당: developer-frontend

---

**[MEDIUM] ChatController: ROOM_NOT_FOUND 도달 시 에러 큐 전송 없이 브로드캐스트**
- 파일: `backend/src/main/java/com/dobakggun/controller/ChatController.java:46~74`
- 문제: StompChannelInterceptor 에서 SEND 시 ROOM_NOT_FOUND 에러를 큐에 보내지만 메시지를 차단하지 않으므로 `handleMessage` 까지 도달. `handleMessage` 내에는 방 존재 여부 재확인 코드가 없어서 삭제된 방에도 브로드캐스트됨.
- 기대: `handleMessage` 상단에 `chatRedisService.roomExists(roomId)` 재확인 추가.
- 담당: developer-backend

---

**[MEDIUM] ChatController: 퇴장 메시지 저장이 TTL 갱신 부작용**
- 파일: `backend/src/main/java/com/dobakggun/controller/ChatController.java:126~136`
- 문제: `handleDisconnect` 에서 퇴장 시스템 메시지를 `chatRedisService.saveMessage` 로 저장. `saveMessage` 내부에서 `EXPIRE historyKey 3600` + `EXPIRE metaKey 3600` 을 실행하므로, 사용자가 퇴장할 때마다 방 TTL 이 1시간 갱신됨. PRD 4-6 에서 TTL 갱신 기준은 "메시지 수신 시" 이지만, 퇴장은 비활성 상태이므로 갱신하는 것이 부적절할 수 있음.
- 기대: 퇴장 시스템 메시지는 `saveMessage` 대신 TTL 갱신 없는 별도 메서드로 저장하거나, saveMessage에서 시스템 메시지 타입 예외 처리 추가. — planner 정책 확인 필요 (Medium 보류).
- 담당: developer-backend (planner 정책 확인 후)

---

**[LOW] DbgChatListPage: location.state.toast 미처리**
- 파일: `frontend/src/pages/DbgChatListPage.tsx`
- 문제: `DbgChatRoomPage` 에서 재연결 실패/방 삭제 시 `navigate('/dbgchat', { state: { toast: '...' } })` 로 이동하지만, `DbgChatListPage` 에서 `useLocation().state?.toast` 를 읽어 토스트를 표시하는 코드가 없음. 토스트 메시지가 사용자에게 전달되지 않음.
- 기대: `DbgChatListPage` 에서 `useLocation` 으로 `state.toast` 를 읽어 토스트/알림 표시 코드 추가.
- 담당: developer-frontend

---

**[LOW] ChatController: SessionSubscribeEvent에서 Principal 타입 불일치 가능성**
- 파일: `backend/src/main/java/com/dobakggun/controller/ChatController.java:78~108`
- 문제: `event.getUser()` 반환값이 `ChatPrincipal` 인스턴스가 아닐 경우 입장 메시지가 발송되지 않음. SockJS 폴백(xhr-streaming 등) 환경에서 세션 Principal 이 다른 타입으로 주입될 수 있음.
- 기대: 로그 추가(`WARN: Principal 타입 불일치`) 또는 `Principal` 타입에서 getName() 으로 userId 를 추출하는 fallback 로직.
- 담당: developer-backend

---

### TC 항목별 정적 검증 결과 (Pass 여부)

| 항목 | 결과 | 비고 |
|---|---|---|
| JwtHandshakeInterceptor 401/403 분기 | Pass | 정상 구현 |
| STOMP 헤더 + 쿼리 파라미터 토큰 전달 | Pass | extractToken 양쪽 처리 |
| ChatSendRequest: message 필드만 존재 | Pass | userId/nickname 필드 없음 |
| StompChannelInterceptor SUBSCRIBE/SEND role 재확인 | Conditional | 재확인 코드 존재하나 메시지 차단 미동작 |
| ChatController nickname: Principal 에서 주입 | Pass | chatPrincipal.getNickname() 사용 |
| FriendRoute 차단 문구 등급명 미노출 | Pass | "특별 등급 이상" 문구 사용 |
| LPUSH + LTRIM 100 | Pass | trim(0, 99) 사용 |
| LRANGE 0 49 | Pass | range(0, 49) 사용 |
| EXPIRE 3600 TTL 갱신 | Pass | saveMessage 내 EXPIRE 호출 |
| Redis 키 이름 일치 | Pass | chat:room:{roomId}, chat:room:meta:{roomId}, chat:rooms 정확히 일치 |
| Graceful degradation (try-catch + degraded=true) | Pass | 전 서비스 레이어에서 try-catch 처리 |
| 방 이름 1~30자 유효성 | Pass | DTO @Size + 서비스 레이어 이중 체크 |
| 금칙어 필터 적용 | Pass | BadWordFilter.containsBadWord 호출 |
| 최대 50개 제한 | Pass | countActiveRooms >= MAX_ROOMS 체크 |
| roomId 8자 랜덤 + 중복 체크 | Pass | SecureRandom + roomExists 5회 재시도 |
| 빈 문자열 서버 차단 | Pass | trim 후 isEmpty 체크 |
| 200자 초과 서버 차단 | Pass | MAX_MESSAGE_LENGTH = 200 체크 |
| ChatInput 200자 UI 제한 | Pass | maxLength=200 + onChange guard |
| ChatInput trim 후 빈 문자열 전송 차단 | Pass | handleSend에서 trimmed 체크 |
| /dbgchat, /dbgchat/:roomId FriendRoute 래핑 | Pass | App.tsx 양쪽 경로 FriendRoute 적용 |
| 비로그인 → /login 리다이렉트 | Pass | Navigate to="/login" |
| USER 등급 → 차단 페이지 인라인 렌더 | Pass | AccessDeniedPage 렌더, URL 유지 |
| 토큰 STOMP 헤더 + 쿼리 둘 다 전달 | Pass | connectHeaders + wsUrl에 ?token= 포함 |
| 재연결 로직 | Pass | MAX_RETRY=3, RETRY_DELAYS 구현 |
| 언마운트 시 disconnect | Pass | useEffect cleanup에서 stompClient?.disconnect() |
| 입장/퇴장 시스템 메시지 | Pass | SessionSubscribeEvent/SessionDisconnectEvent 리스너 |
| type: "SYSTEM" 브로드캐스트 | Pass | type("SYSTEM") 설정 |
| ADMIN DELETE API 권한 체크 | Pass | SecurityConfig hasRole("ADMIN") |
| 삭제 후 SYSTEM 메시지 브로드캐스트 | Pass | deleteRoom에서 convertAndSend |

### 회귀 영향 평가 (정적 검증 기준)

- FriendRoute 신규 추가: AdminRoute 와 별개 컴포넌트 독립 구현. AdminRoute 침범 없음.
- App.tsx: /dbgchat 경로 추가가 기존 `/:game` 라우트 위에 선언됨. 정상.
- WebSocketConfig 신규 추가: 기존 REST SecurityFilterChain 과 분리된 STOMP 설정. 충돌 없음.
- SecurityConfig: /ws/** permitAll 추가 및 /api/chat/** 규칙 추가. 기존 /api/** 규칙은 영향 없음.
- HomePage: `user && (...)` 조건부 렌더로 Test Lab 섹션 추가. 비로그인 시 미노출. 기존 게임 카드 렌더링 로직 변경 없음.
