# Progress — developer-backend — chat-testroom

- 작성자: developer-backend
- 작성일: 2026-04-23
- 상태: **구현 완료 — QA 검증 요청**
- 기반 PRD: `docs/specs/chat-testroom.md` r2

---

## 현재 상태

### 구현 완료

**build.gradle**
- `spring-boot-starter-websocket` 의존성 추가
- `processResources` 태스크: `shared/badwords.json` → classpath 복사

**DTO (com.dobakggun.dto.chat)**
- `CreateRoomRequest.java`
- `ChatRoomResponse.java`
- `ChatRoomListResponse.java`
- `ChatSendRequest.java`
- `ChatMessageResponse.java`
- `ChatHistoryResponse.java`
- `ChatErrorResponse.java`

**service**
- `BadWordFilter.java` — classpath:badwords.json 로드, containsBadWord()
- `ChatRedisService.java` — Redis 3종 키 CRUD, TTL 갱신, @Scheduled 스윕
- `ChatRoomService.java` — 방 생성/목록/삭제 비즈니스 로직, 금칙어/최대방수 체크

**security**
- `ChatPrincipal.java` — java.security.Principal 구현체
- `JwtHandshakeInterceptor.java` — HTTP 핸드셰이크 JWT 검증 (Authorization 헤더 → ?token= 쿼리 fallback)
- `StompChannelInterceptor.java` — CONNECT/SUBSCRIBE/SEND 재인증, 방 존재 확인

**config**
- `WebSocketConfig.java` — STOMP 브로커 설정, /ws SockJS 엔드포인트, CORS

**controller**
- `ChatController.java` — @MessageMapping, 입/퇴장 @EventListener
- `ChatRestController.java` — GET/POST/GET/DELETE /api/chat/rooms/**

**기존 파일 수정**
- `SecurityConfig.java` — /ws/**, /api/chat/** 접근 제어 규칙 추가, /ws/** CORS 등록
- `JwtUtil.java` — getNicknameFromToken() 메서드 추가
- `DobakGgunGamesApplicationTests.java` — ChatRedisService @MockBean 추가

---

### 진행 중
- 없음

### 버그 수정 이력 (2026-04-23 QA 결과 대응)

#### StompChannelInterceptor.java
- [CRITICAL] `import java.util.Map;` 누락 → 추가
- [HIGH] CONNECT 인증 실패 시 조용히 통과하던 문제 수정
  - `handleConnect` 반환 타입 `void` → `boolean`
  - userId null 또는 isAllowedRole false 시 에러 전송 후 `return false`
  - `preSend`에서 `handleConnect` 반환값이 false면 `return null` (연결 차단)
- [HIGH] SUBSCRIBE/SEND 에러 시 원본 메시지 통과하던 문제 수정
  - `handleSubscribe`, `handleSend` 반환 타입 `void` → `boolean`
  - 에러 조건(FORBIDDEN, ROOM_NOT_FOUND) 충족 시 `return false`
  - `preSend`에서 각 핸들러가 false 반환 시 `return null` (메시지 파이프라인 차단)

#### ChatController.java
- [HIGH] `handleMessage`에 roomId 검증 추가
  - `^[a-z0-9]{8}$` 패턴 불일치 시 `INVALID_ROOM_ID` 에러 후 return
  - `chatRedisService.roomExists(roomId)` false 시 `ROOM_NOT_FOUND` 에러 후 return
- [MEDIUM] 삭제된 방 메시지 브로드캐스트: roomExists 체크로 자동 해결
- [HIGH] 다중 방 구독 처리
  - 세션 속성 `lastRoomId` (String) → `subscribedRoomIds` (Set\<String\>) 로 변경
  - `handleSubscribe`: `subscribedRoomIds` Set에 roomId add
  - `handleDisconnect`: Set 내 모든 roomId에 퇴장 메시지 발송
- [MEDIUM] 퇴장 메시지 TTL 갱신 부작용 수정
  - `chatRedisService.saveMessageWithoutTTLRefresh()` 신규 메서드 추가 (LPUSH+LTRIM만, EXPIRE 생략)
  - `handleDisconnect`에서 이 메서드 사용
- [LOW] `handleSubscribe`에서 Principal 타입 불일치 시 `log.warn` 추가 (type명, name 포함)

#### ChatRedisService.java
- `saveMessageWithoutTTLRefresh(String roomId, ChatMessageResponse msg)` 메서드 추가
  - LPUSH + LTRIM(0, 99)만 수행, EXPIRE 갱신 없음

### 블로커 / 질문
- 없음

---

## API 계약 (developer-frontend 공유용)

### REST

| Method | Path | Auth | 설명 |
|---|---|---|---|
| GET | `/api/chat/rooms` | FRIEND+ (JWT Bearer) | 방 목록 (최신 활성순 50개) |
| POST | `/api/chat/rooms` | FRIEND+ (JWT Bearer) | 방 생성 |
| GET | `/api/chat/rooms/{roomId}/history` | FRIEND+ (JWT Bearer) | 히스토리 최근 50개 (ASC) |
| DELETE | `/api/chat/rooms/{roomId}` | ADMIN | 방 강제 삭제 |

### WebSocket (STOMP over SockJS)

| 종류 | 경로 | 설명 |
|---|---|---|
| Endpoint | `/ws` (SockJS) | JWT: `Authorization: Bearer <JWT>` 헤더 or `?token=<JWT>` 쿼리 |
| SUBSCRIBE | `/topic/room/{roomId}` | 방 메시지 수신 |
| SEND | `/app/chat/{roomId}` | 메시지 발신 `{ "message": "..." }` |
| SUBSCRIBE | `/user/queue/errors` | 개인 에러 수신 |

### 에러 응답 형식
- REST: `{ "error": "<ERROR_CODE>" }` (GlobalExceptionHandler 패턴 준수)
- STOMP: `{ "code": "<ERROR_CODE>", "message": "<한글 메시지>" }` → `/user/queue/errors`

---

## 신규 환경변수
- 없음. 기존 `REDIS_URL`, `JWT_SECRET` 재사용.

---

## 다음 세션에서 할 것
- `./gradlew build` 결과 사용자 측 확인 후 빌드 에러 있으면 대응
- qa-tester 재검증 결과 수신 후 추가 버그 수정 대응
