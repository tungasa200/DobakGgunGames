# Progress — developer-backend — chat-testroom

- 작성자: developer-backend
- 작성일: 2026-04-23
- 상태: **구현 완료 — QA PASS**
- 기반 PRD: `docs/specs/chat-testroom.md` r2

---

## 최종 상태 (2026-04-23 세션 종료)

### 구현 완료 파일 목록 (18개)

**빌드 설정 수정 (1)**
- `build.gradle` — `spring-boot-starter-websocket` 의존성 추가, `shared/badwords.json` classpath 복사

**DTO (7) — com.dobakggun.dto.chat**
- `CreateRoomRequest.java`
- `ChatRoomResponse.java`
- `ChatRoomListResponse.java`
- `ChatSendRequest.java`
- `ChatMessageResponse.java`
- `ChatHistoryResponse.java`
- `ChatErrorResponse.java`

**service (3)**
- `BadWordFilter.java` — classpath:badwords.json 로드, containsBadWord()
- `ChatRedisService.java` — Redis 3종 키 CRUD, TTL 갱신, @Scheduled 스윕, saveMessageWithoutTTLRefresh() 추가
- `ChatRoomService.java` — 방 생성/목록/삭제 비즈니스 로직, 금칙어/최대방수 체크

**security (3)**
- `ChatPrincipal.java` — java.security.Principal 구현체
- `JwtHandshakeInterceptor.java` — HTTP 핸드셰이크 JWT 검증 (Authorization 헤더 → ?token= 쿼리 fallback)
- `StompChannelInterceptor.java` — CONNECT/SUBSCRIBE/SEND 재인증, 방 존재 확인, 파이프라인 차단 로직 (QA 버그 수정 적용)

**config (1)**
- `WebSocketConfig.java` — STOMP 브로커 설정, /ws SockJS 엔드포인트, CORS

**controller (2)**
- `ChatController.java` — @MessageMapping, 입/퇴장 @EventListener, roomId 검증 및 다중 방 구독 처리 (QA 버그 수정 적용)
- `ChatRestController.java` — GET/POST/GET/DELETE /api/chat/rooms/**

**기존 파일 수정 (3)**
- `SecurityConfig.java` — /ws/**, /api/chat/** 접근 제어 규칙 추가, /ws/** CORS 등록
- `JwtUtil.java` — getNicknameFromToken() 메서드 추가
- `DobakGgunGamesApplicationTests.java` — ChatRedisService @MockBean 추가

---

## QA 발견 버그 수정 완료 내역 (7건)

### CRITICAL (1건)

| # | 파일 | 내용 |
|---|---|---|
| 1 | `StompChannelInterceptor.java` | `import java.util.Map;` 누락 → 추가 (컴파일 에러) |

### HIGH (4건)

| # | 파일 | 내용 |
|---|---|---|
| 2 | `StompChannelInterceptor.java` | CONNECT 인증 실패 시 조용히 통과하던 문제 — `handleConnect` 반환 타입 `void` → `boolean`, userId null 또는 isAllowedRole false 시 에러 전송 후 `return false`, `preSend`에서 false면 `return null` (연결 차단) |
| 3 | `StompChannelInterceptor.java` | SUBSCRIBE/SEND 에러 시 원본 메시지 통과하던 문제 — `handleSubscribe`, `handleSend` 반환 타입 `void` → `boolean`, 에러 조건 충족 시 `return false`, `preSend`에서 `return null` (파이프라인 차단) |
| 4 | `ChatController.java` | `handleMessage`에 roomId 검증 누락 — `^[a-z0-9]{8}$` 패턴 불일치 시 `INVALID_ROOM_ID` 에러 후 return, `chatRedisService.roomExists(roomId)` false 시 `ROOM_NOT_FOUND` 에러 후 return |
| 5 | `ChatController.java` | 다중 방 구독 처리 미흡 — 세션 속성 `lastRoomId` (String) → `subscribedRoomIds` (Set\<String\>) 변경, `handleSubscribe`에서 Set에 add, `handleDisconnect`에서 Set 내 모든 roomId에 퇴장 메시지 발송 |

### MEDIUM (2건)

| # | 파일 | 내용 |
|---|---|---|
| 6 | `ChatController.java` | 삭제된 방 메시지 브로드캐스트 — roomExists 체크(버그 #4)로 자동 해결 |
| 7 | `ChatRedisService.java` / `ChatController.java` | 퇴장 메시지 TTL 갱신 부작용 — `saveMessageWithoutTTLRefresh()` 신규 메서드 추가 (LPUSH+LTRIM만, EXPIRE 생략), `handleDisconnect`에서 해당 메서드 사용 |

---

## 커밋/배포 이력

| 날짜 | 커밋 해시 | 브랜치 | 내용 |
|---|---|---|---|
| 2026-04-23 | `5d0f99b` | WIP | chat-testroom 전체 구현 + QA 7건 버그 수정 완료, 푸시 완료 |

---

## 사용자 확인 필요

- `./gradlew build` 실행 후 빌드 성공 여부 확인
  - 실패 시 로그를 developer-backend에게 제공하면 즉시 대응

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

## 다음 단계

1. 사용자가 로컬에서 `./gradlew build` 실행 확인
2. 빌드 성공 후 로컬 통합 테스트 (WebSocket 연결, 방 생성/입퇴장, 메시지 송수신, 금칙어 필터)
3. 통합 테스트 이상 없으면 WIP → main 머지
4. Railway 자동 배포 완료 확인
