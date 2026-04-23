# Progress — planner — chat-testroom

## 2026-04-23 r1 (Phase 1 — PRD 초안)

### Completed
- `docs/specs/chat-testroom.md` 초안 작성 (고정 룸 방식)
- 기존 참조 문서 확인:
  - `docs/장기개발목표.md` Phase 2 (실시간 채팅) 명세
  - `backend/.../entity/User.java` Role enum (USER / FRIEND / ADMIN) 확인
  - 기존 PRD 포맷(`rsp-game.md`, `rsp-api-contract.md`) 참고

### Key Decisions (r1)
- 채팅방 구조: 고정 룸 채택. 출시 시 `test-general` 1개.
- 접근 제어: FRIEND 이상 + 이중 체크.
- 모드 적용 범위: 일반 모드만.
- Redis 스펙: `chat:room:{roomId}`, LPUSH+LTRIM 100, LRANGE 0 49, TTL 3600s.
- STOMP: `/ws` + SockJS, `/topic/room/{roomId}`, `/app/chat/{roomId}`, `/user/queue/errors`.
- REST: `GET /api/chat/rooms`, `GET /api/chat/rooms/{roomId}/history`.

---

## 2026-04-23 r2 (Phase 1 — 사용자 OQ 응답 반영, 확정)

### Completed
- `docs/specs/chat-testroom.md` r2 개정 (사용자 응답 전면 반영)
- HomePage Test Lab 섹션 기존 존재 확인 (`frontend/src/pages/HomePage.tsx` 242~251줄 빈 카드)
- `shared/badwords.json` 존재 확인 (금칙어 필터 적용 가능)

### Key Decisions (r2 — 변경 사항)

#### 구조 변경
- **채팅방 구조**: 고정 룸 → **사용자 생성 방** (OQ-1)
- **URL 경로**: `/test-room` → `/dbgchat` (OQ-7)
- **등급명 노출**: 허용 → **금지**, 모호 문구 사용 (OQ-6)

#### 신규 결정 (OQ-8 ~ OQ-14)
- roomId 생성: **8자리 `[a-z0-9]` 랜덤 코드**
- 최대 활성 방: **동시 50개**
- 방 이름: 1~30자, 중복 **허용**, 금칙어 필터 **적용** (badwords.json)
- 방 삭제: 일반 유저 불가 (TTL 대기), **ADMIN 만 즉시 삭제 가능**
- HomePage Test Lab 섹션 빈 카드에 "실시간 채팅 랩" 진입 버튼 추가

#### API 추가
- `POST /api/chat/rooms` — 방 생성 (신규)
- `DELETE /api/chat/rooms/{roomId}` — ADMIN 강제 삭제 (신규)
- `GET /api/chat/rooms` — 방 목록 응답 포맷 확장 (roomId, name, creatorNick, createdAt, lastActiveAt)
- `GET /api/chat/rooms/{roomId}/history` — roomName 필드 추가

#### Redis 키 네임스페이스 확장
- `chat:room:{roomId}` (List) — 히스토리 (기존 유지)
- `chat:room:meta:{roomId}` (Hash) — 방 메타데이터 (신규)
- `chat:rooms` (Sorted Set) — 활성 방 목록 인덱스 (신규)
- TTL 정책: 채팅/메타 키 3600s 동시 갱신, 목록은 lazy cleanup + 스케줄러 스윕

#### 에러 시나리오 추가
- EC-14 금칙어 방 이름 (400 `ROOM_NAME_INVALID`)
- EC-15 활성 방 50개 초과 (429 `ROOM_LIMIT_EXCEEDED`)
- EC-16 Redis 장애 중 방 생성 (503 `REDIS_UNAVAILABLE`)
- EC-17 ADMIN 방 삭제 시 SYSTEM 브로드캐스트
- EC-18 입장 중 방 TTL 만료 프론트 핸들링

### Confirmed Unchanged
- JWT 전달 방식: STOMP 헤더 1차 + `?token=` 쿼리 fallback 2차 (OQ-2)
- 히스토리: 저장 100 / 조회 50 (OQ-5)
- Rate limit: MVP 미포함 (OQ-4)
- 다중 탭: 매번 입장 메시지 발행 (OQ-3)
- Excel 모드: 미적용

### Next Step (Phase 2 착수 가능)
- PRD r2 확정 → designer / developer-backend / developer-frontend 착수 가능.
- designer: `docs/design/chat-testroom.md` 작성 (방 목록/생성 폼/채팅 UI 와이어프레임 + HomePage Test Lab 버튼 사양).
- developer-backend: `docs/specs/chat-testroom-api.md` 는 본 PRD 7장으로 충분, 별도 작성 불요. 즉시 구현 착수 가능.
- developer-frontend: HomePage Test Lab 빈 카드에 "실시간 채팅 랩" 버튼 추가 + `/dbgchat` 라우트 신규 2개 페이지.
- **환경변수 안내 필요**: Vercel UI 에 `VITE_WS_URL` 추가 (프로덕션/로컬 값 예시는 PRD 15장 참조). developer-frontend 가 코드 머지 전 사용자에게 직접 안내할 것.

### Blockers
- 없음. PRD 확정 상태.

### Open for Later Phases
- 생성자 본인 방 삭제 API (Phase 2)
- 방 rate limit / 유저당 동시 방 제한 (Phase 2)
- 비밀번호 잠금/초대 전용 방 (Phase 2)
- 관리자 모더레이션 UI (Phase 2)

---

## 2026-04-23 세션 최종 (Phase 1 — PRD 확정 및 커밋 완료)

### 최종 상태
- **완료 (DONE)** — planner 업무 클로즈

### 완료된 산출물
- `docs/specs/chat-testroom.md` (r2 확정본)
  - 사용자 OQ-1 ~ OQ-14 전체 응답 반영 완료
  - 16장 전체 구조 (개요 / 모드 범위 / 유저 스토리 / 방 구조 / 접근 제어 / 메시지·Redis 스펙 / API 스펙 / 에러 시나리오 / 기능 우선순위 / 미포함 / 확장 포인트 / 성공 지표 / 결정 사항 / 작업 분장 / 환경변수 / 변경 이력)
- `docs/progress/planner-chat-testroom.md` (r1 → r2 → 최종 완료 기록)

### 주요 결정 사항 요약
1. **채팅방 구조 변경**: 기존 r1의 고정 룸 방식 폐기 → **사용자 생성 방 방식** 채택
   - roomId = 8자리 `[a-z0-9]` 랜덤 코드
   - 동시 활성 방 최대 50개 제한
   - 방 이름 중복 허용, 금칙어 필터 적용 (`shared/badwords.json`)
2. **URL 경로 확정**: `/test-room` 안 폐기 → **`/dbgchat`** 으로 확정
   - `/dbgchat` (방 목록), `/dbgchat/{roomId}` (개별 방)
3. **고정룸 → 사용자 생성룸 전환에 따른 API 확장**
   - `POST /api/chat/rooms` (방 생성) 신규 추가
   - `DELETE /api/chat/rooms/{roomId}` (ADMIN 강제 삭제) 신규 추가
   - `GET /api/chat/rooms` 응답 스키마 확장 (roomId / name / creatorNick / createdAt / lastActiveAt)
   - `GET /api/chat/rooms/{roomId}/history` 응답에 roomName 필드 추가
4. **Redis 키 네임스페이스 3종 체제**
   - `chat:room:{roomId}` (List, 히스토리)
   - `chat:room:meta:{roomId}` (Hash, 방 메타데이터) — 신규
   - `chat:rooms` (Sorted Set, 활성 방 인덱스) — 신규
   - TTL 3600s, lazy cleanup + 5분 주기 스케줄러 스윕
5. **접근 제어**: FRIEND 이상 + 이중 체크 (핸드셰이크 + ChannelInterceptor), 등급명("도박꾼"/"FRIEND") 사용자 노출 금지 → 모호 문구 `이 기능은 특별 등급 이상만 이용할 수 있습니다.`
6. **JWT 전달 방식**: STOMP CONNECT 헤더 1차 + `?token=` 쿼리 fallback 2차 (SockJS 대응)
7. **HomePage Test Lab 섹션**: 기존 빈 카드에 "실시간 채팅 랩" 버튼 추가 (FRIEND 이상 판단은 라우트 가드에 위임)
8. **Excel 모드 미적용** 확정 (사용자 지시 없음)

### 커밋 상태
- **WIP 브랜치 커밋 완료**: `5d0f99b`
- 포함 파일:
  - `docs/specs/chat-testroom.md` (r2 확정본)
  - `docs/progress/planner-chat-testroom.md`

### 다음 단계
1. **main 머지 후 운영 반영**
   - 현 WIP 브랜치(`5d0f99b`) 를 main 에 머지
   - PRD 가 main 에 올라오면 designer / developer-backend / developer-frontend 가 공식 착수 가능
2. **FRIEND 등급 테스터에게 `/dbgchat` 안내**
   - 기능 배포 후 FRIEND 권한 보유 테스터에게 접속 경로 공지
   - 공지 시에도 등급명("도박꾼" / "FRIEND") 직접 노출 금지 — 내부 안내 문서에만 표기
3. **후속 팀 트리거 (planner 이슈 닫은 후)**
   - designer → `docs/design/chat-testroom.md`
   - developer-backend → WebSocket/STOMP/Redis/REST 4종 API 구현
   - developer-frontend → `/dbgchat` 라우트 2종 페이지 + HomePage Test Lab 버튼 + `VITE_WS_URL` 환경변수 안내

### Blockers
- 없음. planner 업무 종료.
