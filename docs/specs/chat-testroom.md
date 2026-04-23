# PRD — 실시간 채팅 Test Room (사용자 생성 방 방식)

- 작성자: planner
- 최초 작성일: 2026-04-23
- 개정일: 2026-04-23 (r2)
- 상태: **확정 (Phase 1) — 사용자 OQ 응답 반영 완료**
- 승인자: 프로젝트 오너 (사용자)
- 관련 문서:
  - `docs/장기개발목표.md` — Phase 2 (실시간 채팅) 근거
  - `backend/src/main/java/com/dobakggun/entity/User.java` — Role enum (USER / FRIEND / ADMIN)
  - `frontend/src/pages/HomePage.tsx` — Test Lab 섹션 (빈 카드 존재, 본 기능 진입점)

---

## 1. 개요

### 1-1. 기능 목적

- 장기 로드맵 Phase 2 "실시간 채팅"의 **선행 실험 공간(Test Room)** 을 구축한다.
- Spring WebSocket + STOMP + Redis 구성을 낮은 리스크로 검증하고, 추후 **온라인 멀티플레이 게임 로비 채팅**으로 확장할 수 있는 기반 코드를 확보한다.
- 이번 단계는 공개 서비스 기능이 아니라 **내부 테스터 전용 폐쇄 실험실** 이다.
- 테스터가 직접 **채팅방을 생성**하고, 다른 테스터가 **방 목록에서 골라 입장**하여 대화하는 구조를 검증한다.

### 1-2. 타겟 유저

| 등급 | 접근 |
|---|---|
| `ADMIN` | 허용 (관리자 테스트 목적) |
| `FRIEND` | 허용 (내부 테스터) |
| `USER` | **차단** |
| 비로그인 (게스트) | **차단** |

- FRIEND 등급은 이미 `User.Role` enum 에 정의되어 있음(2025-04 커밋 `20ca439` 기준).
- ADMIN 은 별도 분기 없이 "FRIEND 이상" 조건으로 포함되며, 추가로 방 강제 삭제 권한을 갖는다(5장/7장 참고).
- **중요**: 사용자 노출 문구에서 "도박꾼" / "FRIEND" 등급명을 직접 노출하지 않는다 (5-4 참고).

### 1-3. 출시 조건 (Definition of Done)

- FRIEND 이상 계정으로 로그인 → 메인 페이지 **Test Lab** 섹션 → `/dbgchat` 진입 → 방 목록 조회 → 방 생성 → 메시지 왕복 확인.
- 다른 FRIEND 이상 계정이 방 목록에서 해당 방에 입장 → 실시간 수신 확인.
- USER 로그인 상태로 `/dbgchat` 진입 시 차단 페이지 표출 및 WebSocket 핸드셰이크 거부 확인.
- Redis 재시작 후에도 서비스가 죽지 않음 (graceful degradation 검증).
- 1시간 비활성 방이 TTL 만료로 자동 삭제됨 검증.
- 메인 페이지 **Test Lab 섹션에 "실시간 채팅 랩" 진입 버튼**이 보임 (FRIEND 이상만 클릭 가능).

### 1-4. 비목표 (Out of Scope)

- 1:1 DM, 친구 목록, 귓속말, 멘션, 이모지 리액션.
- 파일/이미지 업로드, 링크 프리뷰.
- 채팅 로그 영속 저장 (DB 저장 금지 — Redis 휘발성만).
- 모바일 네이티브 push 알림.
- USER 등급 공개 오픈 (→ Phase 2 본편에서 별도 PRD).
- 비밀번호로 잠그는 방, 초대 전용 방 (→ Phase 2 본편).
- Excel 모드 (사용자 지시 없음 — 아래 "모드 적용 범위" 참고).

---

## 2. 모드 적용 범위

- **일반 모드: 필수 (Must)**
- **Excel 모드: 적용하지 않음**
- 근거: 사용자가 기능 요청 시 Excel 모드 적용을 명시하지 않음. 본 기능은 실험용 Test Room 으로 공개 UI 표준화 대상이 아님.
- 향후 Phase 2 본편에서 공개 채팅으로 확장할 때 Excel 모드 반영 여부를 재검토.

---

## 3. 유저 스토리

- **US-1 (핵심)** — As a FRIEND-tier tester, I want to create a chat room with a custom name, so that I can invite other testers to a topic-specific space.
- **US-2** — As a tester, I want to see the list of currently active chat rooms, so that I can pick one to join without coordinating out-of-band.
- **US-3** — As a tester, I want to join an existing room with one click, so that I can start chatting immediately.
- **US-4** — As a tester, I want my nickname and the timestamp on each message to be server-injected, so that I can trust who said what during debugging.
- **US-5** — As a tester, I want to see the last ~50 messages when I enter a room, so that I do not open an empty screen.
- **US-6** — As a tester, I want the server to reject empty or too-long messages with a clear error, so that I can confirm validation works.
- **US-7** — As an admin, I want non-FRIEND accounts to be completely blocked at both the HTTP route and the WebSocket handshake, so that this experimental room does not leak.
- **US-8** — As an admin, I want the chat service to keep running (without saving messages) even if Redis is down, so that an outage of the cache layer does not take the site down.
- **US-9** — As an admin, I want to forcibly delete a room, so that I can clean up abuse or stale rooms without waiting for TTL.

---

## 4. 채팅방 구조 결정 및 근거

### 4-1. 결정: **사용자 생성 방 방식 (user-generated rooms)**

이전 r1 초안의 "고정 룸 방식"은 폐기. 사용자 OQ-1 응답에 따라 **테스터가 직접 방을 개설**하고 목록에서 골라 입장하는 구조로 변경.

### 4-2. 근거

- Phase 2 본편의 게임 로비 채팅은 결국 "방이 여러 개 동적으로 생성되는" 구조가 될 것이므로, 이번 Test Room 에서도 그 구조를 미리 검증하는 것이 합리적.
- 고정 룸에 비해 **방 라이프사이클 관리(생성/TTL/삭제)** 와 **방 메타데이터 조회** 를 함께 검증할 수 있음.
- 방 생성 UI/목록 UI 패턴을 이번에 확보하면 Phase 2 본편 개발 속도가 빨라짐.

### 4-3. 방 ID 생성 방식

**결정: 8자리 소문자+숫자 랜덤 코드** — 예: `a7b2q9m3`.

- UUID(32자) 대신 짧은 코드를 쓰는 이유: URL `/dbgchat/{roomId}` 에 노출되므로 사람이 공유하기 쉬워야 함.
- 생성 로직: `[a-z0-9]` 에서 8자 랜덤. 충돌 시 재시도 최대 5회(현실적으로 충돌 확률 극소). 5회 모두 실패하면 500.
- 정규식 검증: `^[a-z0-9]{8}$`. 외 패턴으로 SUBSCRIBE/SEND 요청 오면 400/`ROOM_NOT_FOUND`.

### 4-4. 방 이름 제약

| 항목 | 값 |
|---|---|
| 최소 길이 | 1자 (trim 후) |
| 최대 길이 | 30자 |
| 허용 문자 | 한글, 영문, 숫자, 공백, 기본 특수문자 (`! ? . , - _ ( ) [ ] #`) |
| 금칙어 | `shared/badwords.json` 기반 필터링 **적용** |
| 중복 | **허용** (같은 이름의 방 여러 개 생성 가능, roomId 로 구분) |

- 금칙어 필터는 방 이름이 공개 목록에 노출되므로 적용. 프론트 입력 단계 1차 체크 + 백엔드 생성 시 2차 체크 (백엔드 우선).
- 금칙어 검출 시 에러 코드 `ROOM_NAME_INVALID`, 문구: `사용할 수 없는 단어가 포함되어 있습니다.`
- badwords.json 수정은 본 PRD 범위 밖 (planner 승인 별도).

### 4-5. 최대 방 개수

**결정: 동시 활성 방 최대 50개**.

- 본 기능은 내부 테스터(수명~수십 명) 전용이므로 50개면 실사용에 충분.
- 50개 초과 상태에서 추가 생성 시도 → `ROOM_LIMIT_EXCEEDED` 에러, 문구: `채팅방이 너무 많습니다. 잠시 후 다시 시도해주세요.`
- 카운트 기준: `chat:rooms` Sorted Set 의 원소 수 (TTL 만료된 방은 주기 스윕으로 제거).
- 추후 확장: 유저 1명당 동시 생성 제한(예: 3개). **본 PRD 에서는 생략**.

### 4-6. 방 라이프사이클 / TTL

| 상태 | 설명 |
|---|---|
| 생성 | `POST /api/chat/rooms` → roomId 발급, 메타/목록/히스토리 키 세팅, TTL 1시간 |
| 활성 | 메시지 수신 시마다 TTL 갱신 (채팅 키 + 메타 키 동시) |
| 만료 | 마지막 메시지로부터 1시간 비활성 시 자동 만료 |
| 강제 삭제 | ADMIN 이 `DELETE /api/chat/rooms/{roomId}` 호출 시 즉시 삭제 |

- 일반 유저(FRIEND 포함)는 **명시적 방 삭제 불가**. 빈 방을 만들었어도 TTL 대기.
- ADMIN 만 즉시 삭제 가능. 삭제 시 방 안의 모든 참가자에게 `ROOM_DELETED` 시스템 알림 후 강제 disconnect.
- 생성자 본인이 나중에 삭제 요청하는 기능은 **Phase 2 본편**으로 유보.

---

## 5. 접근 제어 정책

### 5-1. 프론트 라우트 가드

- 경로:
  - `/dbgchat` — 방 목록 페이지
  - `/dbgchat/{roomId}` — 개별 방 페이지
- `App` 라우트에 `FriendRoute` 가드 컴포넌트 적용 (AdminRoute 패턴 재사용):
  - 비로그인 → `/login` 으로 리다이렉트
  - 로그인했으나 `role < FRIEND` → **차단 페이지 표출** (리다이렉트 아님, URL 유지)
- 차단 페이지 문구 (등급명 노출 금지):
  - 헤더: `접근 권한이 없습니다`
  - 본문: `이 기능은 특별 등급 이상만 이용할 수 있습니다. 공개 채팅 기능은 준비 중입니다.`
  - 버튼: `홈으로 돌아가기` → `/`

### 5-2. 메인 페이지 Test Lab 섹션

- `frontend/src/pages/HomePage.tsx` 에 **Test Lab 섹션이 이미 존재** (빈 카드 형태, 2026-04-23 시점 확인).
- 본 PRD 에서는 이 빈 카드 내부에 **"실시간 채팅 랩"** 진입 버튼을 추가한다.
- 노출 규칙:
  - **모든 로그인 유저에게 Test Lab 섹션은 보임** (FRIEND 이상만 진입 가능한 경고/안내는 버튼 클릭 후 라우트 가드에서 처리).
  - 비로그인 유저에게는 Test Lab 섹션 자체를 숨기거나, 버튼 클릭 시 `/login` 으로 유도 (designer 재량, 기본은 **숨김** 권장).
  - Excel 모드 홈페이지에는 노출하지 않음 (Excel 모드 out of scope).
- 버튼 라벨: `실시간 채팅 랩`
- 버튼 클릭 동작: `/dbgchat` 로 이동 (FriendRoute 가드가 등급 검증).

### 5-3. WebSocket 핸드셰이크 단계

- `/ws` 핸드셰이크에서 JWT 검증.
- JWT 전달 방식:
  - **1차**: STOMP CONNECT 프레임의 `Authorization: Bearer <JWT>` 헤더
  - **2차 (fallback)**: 최초 HTTP 핸드셰이크 쿼리 `?token=<JWT>` — SockJS 환경 대응
- 검증 실패/토큰 없음: **401 Unauthorized** 로 연결 거부.
- JWT 유효하지만 `role < FRIEND`: **403 Forbidden** 로 연결 거부.
- 거부 시 서버는 연결을 끊고 프론트는 "접근 권한이 없습니다" 토스트 + 방 목록으로 이동.

### 5-4. STOMP SUBSCRIBE / SEND 단계 재확인

- `SUBSCRIBE /topic/room/{roomId}` 수신 시 `ChannelInterceptor` 에서 다시 등급 검증 + 방 존재 여부 확인.
- `SEND /app/chat/{roomId}` 수신 시 세션에 저장된 Principal 로 등급 재확인 + 방 존재 여부 확인.
- 이유: 핸드셰이크 이후 등급이 강등된 엣지 케이스(`USER` 로 변경)와 방이 TTL 만료된 엣지 케이스 방어. **이중 체크가 원칙**.

### 5-5. 사용자 노출 에러 문구

**정책: 등급명("도박꾼", "FRIEND") 을 사용자에게 직접 노출하지 않는다.**

| 상황 | 문구 |
|---|---|
| 토큰 없음 | `로그인이 필요합니다.` |
| 토큰 만료 | `세션이 만료되었습니다. 다시 로그인해주세요.` |
| 등급 부족 (USER) | `이 기능은 특별 등급 이상만 이용할 수 있습니다.` |
| WebSocket 연결 끊김 | `서버와 연결이 끊어졌습니다. 재연결 중...` |
| Redis 장애 | `히스토리를 불러올 수 없습니다. 새 메시지는 계속 받을 수 있습니다.` |
| 방 삭제/만료됨 | `채팅방이 종료되었습니다.` |

---

## 6. 메시지 / Redis 키 스펙

### 6-1. 메시지 DTO

서버가 발신자 정보와 타임스탬프를 주입한다. 클라이언트는 `message` 만 보낸다.

#### 클라이언트 → 서버 (SEND payload)

```json
{
  "message": "hello world"
}
```

| 필드 | 타입 | 필수 | 제약 |
|---|---|---|---|
| `message` | `string` | O | 1~200자 (trim 후), 빈 문자열 금지, `\n` 허용 |

#### 서버 → 클라이언트 (TOPIC payload)

```json
{
  "type": "CHAT",
  "userId": 42,
  "nickname": "익명테스터",
  "message": "hello world",
  "timestamp": "2026-04-23T12:34:56.789Z"
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `type` | `string` (enum) | `CHAT` / `SYSTEM` |
| `userId` | `number \| null` | `SYSTEM` 이면 null |
| `nickname` | `string` | `SYSTEM` 이면 `"system"` |
| `message` | `string` | 본문 |
| `timestamp` | `string` (ISO-8601 UTC) | 서버 시각, 밀리초 포함 |

### 6-2. 시스템 메시지 (입장/퇴장/방 삭제)

서버가 브로드캐스트, Redis 히스토리에도 동일한 포맷으로 저장:

| 이벤트 | message 포맷 (한국어) |
|---|---|
| 입장 | `{nickname}님이 입장하셨습니다.` |
| 퇴장 | `{nickname}님이 퇴장하셨습니다.` |
| 방 삭제 | `채팅방이 종료되었습니다.` (ADMIN 삭제 시) |

- `type: "SYSTEM"`, `userId: null`, `nickname: "system"` 로 직렬화.
- 동일 유저가 다중 탭으로 여러 번 접속해도 매 연결마다 브로드캐스트 (단순화). 중복 제거는 Phase 2 본편에서 재고.

### 6-3. Redis 키 전체 네임스페이스

| 키 | 타입 | 용도 | TTL |
|---|---|---|---|
| `chat:room:{roomId}` | List | 메시지 히스토리 (JSON 직렬화된 DTO) | 3600s, 매 쓰기마다 갱신 |
| `chat:room:meta:{roomId}` | Hash | 방 메타데이터 (이름, 생성자, 생성 시각) | 3600s, 메시지 쓰기 시 갱신 |
| `chat:rooms` | Sorted Set | 활성 방 ID 목록 (score = 마지막 활성 시각 epoch ms) | 없음 (원소 개별 정리) |

#### 6-3-1. 메시지 히스토리 (기존)

```
Key:     chat:room:{roomId}
Type:    List
Write:   LPUSH chat:room:{roomId} <json>
         LTRIM chat:room:{roomId} 0 99
Read:    LRANGE chat:room:{roomId} 0 49
TTL:     EXPIRE chat:room:{roomId} 3600   (매 쓰기마다 갱신)
```

- **최대 보관 100개**, **히스토리 조회는 최근 50개**.

#### 6-3-2. 방 메타데이터 (신규)

```
Key:     chat:room:meta:{roomId}
Type:    Hash
Fields:
  name       (string)  — 방 표시명 (1~30자)
  creatorId  (number)  — 생성자 userId
  creatorNick(string)  — 생성자 닉네임 (스냅샷)
  createdAt  (number)  — 생성 시각 epoch ms
Write:   HSET chat:room:meta:{roomId} name <name> creatorId <id> creatorNick <nick> createdAt <ts>
         EXPIRE chat:room:meta:{roomId} 3600
Read:    HGETALL chat:room:meta:{roomId}
TTL:     3600s, 메시지 쓰기 시마다 갱신 (히스토리 키와 동시)
```

#### 6-3-3. 방 목록 인덱스 (신규)

```
Key:     chat:rooms
Type:    Sorted Set
Member:  roomId
Score:   마지막 활성 시각 epoch ms
Write:   ZADD chat:rooms <now_ms> <roomId>      (생성/메시지 시)
         ZREM chat:rooms <roomId>                (ADMIN 삭제 / TTL 만료 감지 시)
Read:    ZREVRANGE chat:rooms 0 49              (최신 활성 순 50개)
```

- `chat:rooms` 에는 TTL 없음. 대신 **lazy cleanup**: 방 목록 조회 시 각 roomId 에 대해 `EXISTS chat:room:meta:{roomId}` 체크 → 없으면 `ZREM` 으로 제거 후 결과 반환.
- 추가로 스케줄러(5분 주기) 가 `ZRANGEBYSCORE chat:rooms -inf <now - 3600000>` 로 오래된 원소 주기 스윕.

### 6-4. 저장 정책

- **DB 저장 없음**: MySQL 에 `chat_message` 류 테이블을 만들지 않는다.
- Redis 장애 시:
  - 방 생성 API: **503 Service Unavailable** (Redis 가 유일 저장소이므로).
  - 방 목록 API: 200 + 빈 배열 + `degraded: true`.
  - SEND: 브로드캐스트 먼저 하고 LPUSH 실패는 로깅만 (기존 정책 유지).
  - 히스토리 조회: 빈 배열 + `degraded: true`.

### 6-5. 히스토리 조회 응답 (REST)

```json
{
  "roomId": "a7b2q9m3",
  "roomName": "랜덤 토론방",
  "messages": [ /* ChatMessage[] — 오래된 것이 먼저 (ASC) */ ],
  "degraded": false
}
```

- `degraded: true` 는 Redis 가 응답하지 않았음을 의미. 프론트는 "히스토리 없음" 배너만 띄우고 실시간 채팅은 계속 활성화.

---

## 7. STOMP + REST API 스펙

### 7-1. WebSocket / STOMP

| 종류 | 경로 | 방향 | 용도 |
|---|---|---|---|
| Endpoint | `/ws` | 양방향 | SockJS 폴백 지원, JWT 핸드셰이크 |
| SUBSCRIBE | `/topic/room/{roomId}` | 서버→클라이언트 | 채팅방 메시지 브로드캐스트 |
| SEND | `/app/chat/{roomId}` | 클라이언트→서버 | 메시지 발신 |
| SUBSCRIBE | `/user/queue/errors` | 서버→클라이언트 | 개인 에러 수신 (유효성 실패 등) |

- `roomId` 파라미터 검증: `^[a-z0-9]{8}$` 외 패턴은 400.
- `roomId` 가 `chat:room:meta:{roomId}` 로 조회되지 않으면 **ROOM_NOT_FOUND** 반환.

### 7-2. 에러 메시지 (개인 큐 `/user/queue/errors`)

```json
{
  "code": "MESSAGE_TOO_LONG",
  "message": "메시지는 200자를 넘을 수 없습니다."
}
```

| code | 조건 | message |
|---|---|---|
| `MESSAGE_EMPTY` | trim 후 빈 문자열 | `메시지를 입력해주세요.` |
| `MESSAGE_TOO_LONG` | 200자 초과 | `메시지는 200자를 넘을 수 없습니다.` |
| `RATE_LIMITED` | (선택) 1초당 5건 초과 | `잠시 후 다시 시도해주세요.` |
| `FORBIDDEN` | 등급 강등 감지 | `이 방에 메시지를 보낼 수 없습니다.` |
| `ROOM_NOT_FOUND` | 존재하지 않는 roomId | `채팅방이 종료되었습니다.` |
| `ROOM_DELETED` | ADMIN 이 강제 삭제함 (브로드캐스트) | `채팅방이 종료되었습니다.` |

### 7-3. REST 엔드포인트

#### 7-3-1. GET /api/chat/rooms — 방 목록 조회

FRIEND 이상 인증 필요. 최근 활성 순 최대 50개.

**Request**
```
GET /api/chat/rooms
Authorization: Bearer <JWT>
```

**Response 200 OK**
```json
{
  "rooms": [
    {
      "roomId": "a7b2q9m3",
      "name": "랜덤 토론방",
      "creatorNick": "익명테스터",
      "createdAt": "2026-04-23T12:30:00.000Z",
      "lastActiveAt": "2026-04-23T12:34:56.789Z"
    }
  ],
  "degraded": false
}
```

**에러**
| HTTP | 조건 |
|---|---|
| 401 | JWT 없음/만료 |
| 403 | FRIEND 미만 등급 |

#### 7-3-2. POST /api/chat/rooms — 방 생성

FRIEND 이상 인증 필요.

**Request**
```
POST /api/chat/rooms
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "name": "랜덤 토론방"
}
```

| 필드 | 타입 | 필수 | 제약 |
|---|---|---|---|
| `name` | `string` | O | 1~30자 (trim 후), 허용 문자, 금칙어 필터 통과 |

**Response 201 Created**
```json
{
  "roomId": "a7b2q9m3",
  "name": "랜덤 토론방",
  "creatorNick": "익명테스터",
  "createdAt": "2026-04-23T12:30:00.000Z"
}
```

**에러**
| HTTP | code | 조건 | message |
|---|---|---|---|
| 400 | `ROOM_NAME_REQUIRED` | name 누락/빈 문자열 | `방 이름을 입력해주세요.` |
| 400 | `ROOM_NAME_TOO_LONG` | 30자 초과 | `방 이름은 30자를 넘을 수 없습니다.` |
| 400 | `ROOM_NAME_INVALID` | 허용 문자 외 / 금칙어 | `사용할 수 없는 단어가 포함되어 있습니다.` |
| 401 | — | JWT 없음/만료 | — |
| 403 | — | FRIEND 미만 | 5-5 문구 |
| 429 | `ROOM_LIMIT_EXCEEDED` | 활성 방 50개 초과 | `채팅방이 너무 많습니다. 잠시 후 다시 시도해주세요.` |
| 503 | `REDIS_UNAVAILABLE` | Redis 장애 | `일시적인 오류입니다. 잠시 후 다시 시도해주세요.` |

#### 7-3-3. GET /api/chat/rooms/{roomId}/history — 히스토리 조회

히스토리 + 방 메타 동봉 (최근 50개, ASC 정렬).

**Request**
```
GET /api/chat/rooms/a7b2q9m3/history
Authorization: Bearer <JWT>
```

**Response 200 OK**
```json
{
  "roomId": "a7b2q9m3",
  "roomName": "랜덤 토론방",
  "messages": [
    {
      "type": "SYSTEM",
      "userId": null,
      "nickname": "system",
      "message": "익명테스터님이 입장하셨습니다.",
      "timestamp": "2026-04-23T12:34:00.000Z"
    },
    {
      "type": "CHAT",
      "userId": 42,
      "nickname": "익명테스터",
      "message": "안녕",
      "timestamp": "2026-04-23T12:34:12.345Z"
    }
  ],
  "degraded": false
}
```

**에러**
| HTTP | 조건 |
|---|---|
| 401 | JWT 없음/만료 |
| 403 | FRIEND 미만 |
| 404 | roomId 가 존재하지 않거나 TTL 만료 (`ROOM_NOT_FOUND`) |

#### 7-3-4. DELETE /api/chat/rooms/{roomId} — 방 강제 삭제 (ADMIN 전용)

**Request**
```
DELETE /api/chat/rooms/a7b2q9m3
Authorization: Bearer <JWT>
```

**Response 204 No Content**

- 동작:
  1. `chat:room:{roomId}`, `chat:room:meta:{roomId}` 키 삭제
  2. `chat:rooms` 에서 ZREM
  3. `/topic/room/{roomId}` 로 `{ type: "SYSTEM", message: "채팅방이 종료되었습니다." }` 브로드캐스트
  4. 해당 토픽의 구독자 세션을 강제 해제 (선택적, 프론트 재연결 루프 방지 차원에서 권장)

**에러**
| HTTP | 조건 |
|---|---|
| 401 | JWT 없음/만료 |
| 403 | ADMIN 미만 (FRIEND 라도 403) |
| 404 | roomId 존재하지 않음 |

### 7-4. 인증 헤더 규약 (WebSocket)

- 1차: `Authorization: Bearer <JWT>` 를 STOMP CONNECT 프레임 헤더에 포함.
- 2차(SockJS fallback): 최초 HTTP 핸드셰이크 쿼리 `?token=<JWT>` 허용.
- **쿠키 기반 인증 금지**: 토큰은 명시적으로 STOMP 헤더 또는 쿼리로만.

---

## 8. 에러 시나리오 + 에러 메시지

| ID | 시나리오 | 처리 계층 | HTTP/STOMP | 사용자 문구 |
|---|---|---|---|---|
| EC-1 | 토큰 없이 `/ws` 접속 | 핸드셰이크 | 401 Close | `로그인이 필요합니다.` |
| EC-2 | 만료된 JWT | 핸드셰이크 | 401 Close | `세션이 만료되었습니다. 다시 로그인해주세요.` |
| EC-3 | 위조/서명 불일치 JWT | 핸드셰이크 | 401 Close | `유효하지 않은 토큰입니다.` |
| EC-4 | USER 등급이 `/dbgchat` 접근 | 프론트 라우트 가드 | - | `이 기능은 특별 등급 이상만 이용할 수 있습니다.` |
| EC-5 | USER 등급이 직접 `/ws` 핸드셰이크 | 핸드셰이크 | 403 Close | 동일 |
| EC-6 | 빈 문자열 SEND | STOMP 인터셉터 | `/user/queue/errors` `MESSAGE_EMPTY` | `메시지를 입력해주세요.` |
| EC-7 | 200자 초과 SEND | STOMP 인터셉터 | `MESSAGE_TOO_LONG` | `메시지는 200자를 넘을 수 없습니다.` |
| EC-8 | 존재하지 않거나 만료된 roomId 로 SEND/SUBSCRIBE | STOMP 인터셉터 | `ROOM_NOT_FOUND` | `채팅방이 종료되었습니다.` |
| EC-9 | Redis 장애 (LPUSH 실패) | 서비스 레이어 | 브로드캐스트는 성공, LPUSH 는 WARN 로깅 | (사용자 무감지) |
| EC-10 | Redis 장애 (LRANGE 실패) — 히스토리 조회 | REST | 200 `{ messages: [], degraded: true }` | `히스토리를 불러올 수 없습니다. 새 메시지는 계속 받을 수 있습니다.` |
| EC-11 | WebSocket 연결 끊김 | 프론트 | - | `서버와 연결이 끊어졌습니다. 재연결 중...` (자동 재연결 3회 시도) |
| EC-12 | 세션 중 등급이 FRIEND→USER 로 강등 | ChannelInterceptor | `FORBIDDEN` + 연결 종료 | `이 방에 메시지를 보낼 수 없습니다.` |
| EC-13 | (선택) 1초에 5회 초과 SEND | RateLimiter (Phase 2 권장) | `RATE_LIMITED` | `잠시 후 다시 시도해주세요.` |
| EC-14 | 방 이름 금칙어 | REST (POST /rooms) | 400 `ROOM_NAME_INVALID` | `사용할 수 없는 단어가 포함되어 있습니다.` |
| EC-15 | 활성 방 50개 초과 생성 시도 | REST (POST /rooms) | 429 `ROOM_LIMIT_EXCEEDED` | `채팅방이 너무 많습니다. 잠시 후 다시 시도해주세요.` |
| EC-16 | Redis 장애 중 방 생성 시도 | REST (POST /rooms) | 503 `REDIS_UNAVAILABLE` | `일시적인 오류입니다. 잠시 후 다시 시도해주세요.` |
| EC-17 | ADMIN 방 삭제 시 구독자 대응 | STOMP 브로드캐스트 | `SYSTEM` 메시지 | `채팅방이 종료되었습니다.` |
| EC-18 | 입장 중이던 방이 TTL 만료 | 프론트 재연결 시 404 | - | `채팅방이 종료되었습니다.` 토스트 + `/dbgchat` 로 이동 |

### 8-1. Graceful degradation 원칙

- **Redis 는 보조 저장소이지만 방 생성/목록만은 Redis 의존**. 방 생성/목록은 Redis 장애 시 실패를 허용한다 (503 / degraded 플래그).
- 브로드캐스트 자체는 Redis 와 독립적으로 동작해야 한다.
- 히스토리 조회 경로는 Redis 실패 시 빈 배열 + `degraded: true`.
- Redis 장애 로그는 WARN 레벨, 5분 내 N건 이상이면 관리자 알림 (Phase 3 이후 모니터링 훅).

### 8-2. Rate Limit (Nice-to-have)

- MVP 에는 필수 아님. 테스트 공간이므로 악성 트래픽 가능성 낮음.
- 단, Phase 2 본편 확장 전 **설계 자리(인터셉터 구조)** 만 남겨둔다. 구현 유보.
- 방 생성에 대한 rate limit (유저당 1분 3회 등) 은 Phase 2 본편에서 재검토.

---

## 9. 기능 요구사항 우선순위

### Must (출시 필수)
- FR-M1: FRIEND 이상만 `/dbgchat` 접근 가능 (프론트 가드 + WebSocket 핸드셰이크)
- FR-M2: 사용자 생성 방 방식, roomId 는 8자리 소문자+숫자 랜덤 코드
- FR-M3: `POST /api/chat/rooms` — 방 이름(1~30자, 금칙어 필터) 으로 방 생성
- FR-M4: `GET /api/chat/rooms` — 활성 방 목록 (최근 활성순 50개)
- FR-M5: `GET /api/chat/rooms/{roomId}/history` — 히스토리 50개
- FR-M6: `DELETE /api/chat/rooms/{roomId}` — ADMIN 전용 강제 삭제
- FR-M7: STOMP 실시간 메시지 송수신 (`/topic/room/{roomId}`, `/app/chat/{roomId}`)
- FR-M8: 서버가 발신자 정보/타임스탬프 주입
- FR-M9: 메시지 유효성 검증 (1~200자, trim)
- FR-M10: Redis 키 3종 (히스토리 List / 메타 Hash / 목록 Sorted Set), TTL 3600s
- FR-M11: 입장/퇴장 시스템 메시지 브로드캐스트
- FR-M12: 메인 페이지 Test Lab 섹션에 "실시간 채팅 랩" 진입 버튼 (기존 빈 카드 활용)
- FR-M13: Redis 장애 시 graceful degradation (방 생성만 503, 그 외는 degraded 플래그)
- FR-M14: 동시 활성 방 최대 50개 제한
- FR-M15: 등급명("도박꾼", "FRIEND") 사용자 노출 금지

### Should (품질 요구)
- FR-S1: WebSocket 연결 끊김 시 자동 재연결 (3회)
- FR-S2: ChannelInterceptor 에서 SUBSCRIBE/SEND 재인증
- FR-S3: 히스토리/방 목록 조회 시 `degraded` 플래그 제공
- FR-S4: 로그 레벨 분리 (INFO: 입퇴장, WARN: Redis 실패, ERROR: 핸드셰이크 예외)
- FR-S5: TTL 만료 방 lazy cleanup + 5분 주기 스케줄러 스윕
- FR-S6: 방 삭제 시 구독자에게 SYSTEM 알림 후 세션 해제

### Nice-to-have (Phase 2 본편 이후)
- FR-N1: 동일 유저 다중 탭 dedup
- FR-N2: 1초당 5건 rate limit + 방 생성 rate limit
- FR-N3: 생성자 본인이 자기 방을 삭제할 수 있는 API
- FR-N4: 방에 비밀번호 설정 / 초대 전용 방
- FR-N5: 유저당 동시 생성 방 개수 제한
- FR-N6: 관리자 UI 에서 방 목록/삭제 제공

---

## 10. 미포함 기능 (명시적 제외)

- 1:1 DM, 멘션(@닉네임), 이모지 리액션
- 파일/이미지 업로드, 링크 프리뷰, OG 카드
- MySQL 영속 저장, 채팅 로그 검색
- USER 등급 공개 오픈 (→ Phase 2 본편 별도 PRD)
- 모바일 네이티브 push, 브라우저 Notification API
- Excel 모드 UI
- 비밀번호 잠금 방, 초대 전용 방
- 생성자 본인 방 삭제 (Phase 2)
- 관리자 채팅 모더레이션 UI (차단/뮤트) — Phase 2 본편에서 재검토

---

## 11. 향후 확장 포인트 (Phase 2 본편 준비)

1. **USER 등급 공개 오픈**: `FriendRoute` → `AuthRoute` 로 교체, 백엔드 `hasRole("FRIEND")` → `isAuthenticated()` 로 완화.
2. **게임 로비 채팅**: roomId 네임스페이스 분리 (예: `lobby-{gameKey}-{code}`), 또는 별도 `lobby:rooms` Sorted Set.
3. **중복 접속 제어**: 같은 userId 의 세션을 Redis Set(`chat:room:{roomId}:members`) 으로 관리, 입장/퇴장을 세션 카운트 기반으로 발행.
4. **영속 로그**: 운영상 필요해지면 MySQL `chat_message` 테이블 추가 + 비동기 write-behind.
5. **Rate Limit**: Bucket4j 또는 Redis 기반 슬라이딩 윈도우. 인터셉터 자리 미리 확보.
6. **관리자 모더레이션**: 메시지 삭제, 유저 뮤트, 방 강제 비우기 UI. 어드민 페이지 쪽 스펙 별도.
7. **Presence**: 현재 접속 인원 뱃지. Redis Set + 주기적 pong 기반.
8. **Excel 모드 확장**: 공개 시점에 Excel UI 표준에 맞춘 채팅 셀/시트 UI 설계.
9. **짧은 공유 코드 복사/QR**: 방 코드를 공유하기 위한 UI.

---

## 12. 성공 지표

| 지표 | 기준 |
|---|---|
| 핸드셰이크 거부율 (USER/게스트) | 100% 거부 |
| FRIEND 메시지 왕복 지연 | P95 < 300ms (로컬), < 800ms (프로덕션) |
| Redis 장애 시 SEND 가용성 | 100% 유지 (브로드캐스트 성공) |
| 불법 페이로드(200자 초과/빈 문자열) 차단 | 100% 서버 차단 |
| 금칙어 방 이름 차단 | 100% |
| 노출 사고 (등급명 노출 / 일반 유저 접근) | 0건 |
| TTL 만료 방 자동 제거 | 1시간 비활성 기준 ±5분 이내 |

---

## 13. 결정 사항 (OQ 응답 정리)

| OQ | 질문 | 결정 |
|---|---|---|
| OQ-1 | 방 구조 | **사용자 생성 방 방식** (이전 고정 룸 안 폐기) |
| OQ-2 | JWT 전달 방식 | **STOMP 헤더 1차 + `?token=` 쿼리 fallback 2차** |
| OQ-3 | 다중 탭 입장 메시지 | **매번 발행** (dedup 은 Phase 2) |
| OQ-4 | Rate Limit MVP 포함 | **미포함** (Nice-to-have) |
| OQ-5 | 히스토리 개수 | **저장 100 / 조회 50** 유지 |
| OQ-6 | 등급명 노출 | **노출 불허**. `이 기능은 특별 등급 이상만 이용할 수 있습니다.` 로 모호하게 표기 |
| OQ-7 | URL 경로 | **`/dbgchat`** 확정 |
| OQ-8 (신규) | roomId 생성 방식 | **8자리 `[a-z0-9]` 랜덤 코드** |
| OQ-9 (신규) | 최대 방 개수 | **동시 50개** |
| OQ-10 (신규) | 방 이름 중복 | **허용** (roomId 로 구분) |
| OQ-11 (신규) | 방 이름 금칙어 필터 | **적용** (`shared/badwords.json`) |
| OQ-12 (신규) | 생성자 본인 방 삭제 | **불가** (Phase 2) — TTL 대기 또는 ADMIN 요청 |
| OQ-13 (신규) | ADMIN 즉시 삭제 | **가능** (`DELETE /api/chat/rooms/{roomId}`) |
| OQ-14 (신규) | Test Lab 섹션 | **기존 HomePage 에 빈 카드 존재**, 내부에 "실시간 채팅 랩" 버튼 추가 |

---

## 14. 파일 소유권 / 작업 분장 (참고)

- **planner**: 본 PRD. r2 개정 커밋 (2026-04-23).
- **designer**:
  - `docs/design/chat-testroom.md` — 방 목록/생성 폼/채팅 UI 와이어프레임, 차단 페이지, 시스템 메시지 스타일.
  - HomePage Test Lab 섹션 내부 "실시간 채팅 랩" 버튼 디자인 사양.
- **developer-backend**:
  - `backend/.../config/WebSocketConfig.java` (STOMP 설정, `/ws` 엔드포인트)
  - `backend/.../security/StompChannelInterceptor.java` (CONNECT/SUBSCRIBE/SEND 인증)
  - `backend/.../controller/ChatController.java` (`@MessageMapping`)
  - `backend/.../controller/ChatRestController.java` (방 목록/생성/히스토리/삭제)
  - `backend/.../service/ChatService.java` (Redis 3종 키 관리, graceful degradation, TTL 스윕)
  - `backend/.../service/ChatRoomService.java` (방 생성/삭제/목록 + 금칙어 필터)
  - `backend/.../dto/ChatMessageDto.java`, `ChatRoomDto.java`, `CreateChatRoomRequest.java`
  - API 계약 문서 `docs/specs/chat-testroom-api.md` (필요 시 별도 작성)
- **developer-frontend**:
  - `frontend/src/pages/DbgChatListPage.tsx` (방 목록 + 생성 폼)
  - `frontend/src/pages/DbgChatRoomPage.tsx` (개별 방)
  - `frontend/src/components/chat/*` (메시지 리스트, 입력창, 방 카드, 방 생성 모달)
  - `frontend/src/api/chat.ts` (REST 래퍼 — 기존 api 패턴 준수, 신규 fetch 래퍼 생성 금지)
  - `frontend/src/lib/stompClient.ts` (WebSocket 연결 / 재연결 정책)
  - `frontend/src/components/guards/FriendRoute.tsx`
  - `frontend/src/pages/HomePage.tsx` — Test Lab 섹션 빈 카드 내부에 "실시간 채팅 랩" 버튼 추가 (FRIEND 이상 판단은 라우트 가드에 위임)
- **qa-tester**: `docs/review/chat-testroom-testplan.md` — 8장 에러 시나리오 전수 검증 (EC-1 ~ EC-18).

---

## 15. 환경변수 / 인프라 요구사항

- **Railway (backend)**:
  - `REDIS_URL` — 이미 있을 가능성 높음. 없으면 사용자에게 추가 요청.
  - `JWT_SECRET` — 기존 사용 중.
  - 신규 환경변수 없음.
- **Vercel (frontend)**:
  - `VITE_API_BASE_URL` — 기존 사용 중.
  - `VITE_WS_URL` — **신규**. 값 예시: `wss://api.dobakggun.com/ws` (프로덕션), `ws://localhost:8080/ws` (로컬). 사용자에게 Vercel UI 에 추가 요청 필요.
  - developer-frontend 는 코드 머지 전에 사용자에게 "Vercel UI 에 `VITE_WS_URL` 추가 필요" 안내할 것.

---

## 16. 변경 이력

| 날짜 | 개정 | 변경 | 담당 |
|---|---|---|---|
| 2026-04-23 | r1 | 최초 초안 작성 (고정 룸 방식) | planner |
| 2026-04-23 | r2 | 사용자 OQ 응답 반영: 사용자 생성 방 방식으로 전환, URL `/dbgchat` 확정, 등급명 노출 금지, JWT 헤더+쿼리 fallback 확정, 신규 API(POST/DELETE rooms) 추가, Redis 키 3종(메타/목록 Sorted Set) 추가, 방 이름 금칙어 필터, 최대 50개, 방 이름 중복 허용, roomId 8자리 랜덤 코드, ADMIN 강제 삭제, Test Lab 섹션 버튼 추가 반영 | planner |
