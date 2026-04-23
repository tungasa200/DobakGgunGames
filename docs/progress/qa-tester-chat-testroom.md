# Progress — qa-tester — chat-testroom

## 2026-04-23 (초안 작성)

### 상태
테스트 플랜 초안 작성 완료. 구현 완료 대기 중.

### Completed
- `docs/specs/chat-testroom.md` r2 전체 정독 완료
  - 에러 시나리오 EC-1 ~ EC-18 전수 파악
  - 모드 적용 범위 확인: Excel 모드 미적용 확정 → 일반 모드만 검증
  - 접근 제어 정책(5장), 메시지/Redis 스펙(6장), API 스펙(7장), 에러 시나리오(8장) 상세 검토
- `docs/review/chat-testroom-test-plan.md` 작성 완료
  - 섹션 1: 보안 (TC-SEC-01 ~ TC-SEC-13) — 8개 필수 + 5개 보안 상세
  - 섹션 2: 채팅방 생성/목록 (TC-ROOM-01 ~ TC-ROOM-08)
  - 섹션 3: 실시간 채팅 (TC-CHAT-01 ~ TC-CHAT-08)
  - 섹션 4: 재연결/연결 상태 (TC-CONN-01 ~ TC-CONN-03)
  - 섹션 5: Redis (TC-REDIS-01 ~ TC-REDIS-03)
  - 섹션 6: ADMIN 기능 (TC-ADMIN-01 ~ TC-ADMIN-04)
  - 섹션 7: 엣지 케이스 (TC-EDGE-01 ~ TC-EDGE-07)
  - 섹션 8: Redis Graceful Degradation (TC-DEGRADE-01 ~ TC-DEGRADE-04)
  - 섹션 9: Test Lab / HomePage (TC-HOME-01 ~ TC-HOME-03)
  - 섹션 10: EC-1 ~ EC-18 전수 TC 매핑표
  - 섹션 11: 보안 상세 (XSS, SQL Injection, 과대 페이로드)
  - 섹션 12: 성능 기준 (TC-PERF-01 ~ TC-PERF-02)
  - 섹션 13: 회귀 영향 평가 (FriendRoute, HomePage 수정, WebSocket 신규 추가)
  - 섹션 14: 반려 기준 체크리스트
  - 섹션 15: 테스트 환경 요구사항
  - 섹션 16: 미결 사항

### Key Decisions (테스트 플랜 수립 시)

- **Excel 모드 검증 항목 없음**: PRD 2장 명시적 제외 확인.
- **TC 총계**: 필수 TC 약 50개 + 보안/성능 보조 TC. 구현 완료 후 전수 실행 예정.
- **Critical 우선 실행 순서**: TC-SEC-01 → TC-SEC-02 → TC-SEC-03 → TC-SEC-04 → TC-SEC-05 → TC-SEC-08 순으로 보안 시나리오 먼저.
- **회귀 영향**: FriendRoute 신규 추가 및 HomePage 수정이 기존 AdminRoute 및 게임 카드에 영향 없는지 반드시 smoke test 포함.
- **EC-13 Rate Limit**: PRD 8-2에서 MVP 미포함 확인. 구현 여부에 따라 선택 실행.

### Blockers (해소)
- developer-backend 구현 완료 (확인됨)
- developer-frontend 구현 완료 (확인됨)

---

## 2026-04-23 (정적 코드 검증 완료)

### 상태
정적 검증(코드 리뷰) 완료. 최종 판정: **CONDITIONAL PASS** (CRITICAL 1건, HIGH 4건, MEDIUM 3건, LOW 2건 발견)

### 발견된 버그 요약

#### CRITICAL
1. [StompChannelInterceptor.java:62] `Map<String, Object>` 사용하나 `import java.util.Map` 누락 — 컴파일 오류, 서비스 기동 불가

#### HIGH
1. [StompChannelInterceptor.java:83~119] SUBSCRIBE/SEND 에러 발생 시 `preSend`가 `null` 대신 원본 메시지를 반환 → 에러를 보내면서 메시지가 실제로 통과됨 (차단 미동작)
2. [ChatController.java:46] `@MessageMapping("/chat/{roomId}")` 에서 roomId 패턴 검증(`^[a-z0-9]{8}$`) 없음 — 8자 외 roomId로 SEND 시 ChatRedisService까지 도달
3. [ChatController.java:111~136] `handleDisconnect`가 세션 속성 `lastRoomId` 단일 값만 추적 — 다중 방 구독 시 마지막 방 하나만 퇴장 메시지 발송
4. [StompChannelInterceptor.java:61~80] `handleConnect`에서 핸드셰이크 거부(403/401) 이후에도 STOMP CONNECT 프레임이 도달할 경우 재검증 시 `isAllowedRole`이 false여도 연결을 강제 종료하지 않고 단순 무시 — 403 거부 후 STOMP 브로커 연결이 우회 가능할 수 있음

#### MEDIUM
1. [ChatController.java:110] 퇴장 시스템 메시지가 Redis `saveMessage` 로 저장되는데, `roomExists` 체크 후 실제 saveMessage 내부에서 TTL이 갱신됨 — 퇴장 메시지가 TTL을 1시간 연장하는 부작용 (스펙에 비활성 TTL 개념과 충돌)
2. [FriendRoute.tsx:27] `user.role === 'USER'` 만 체크 — role이 `USER`가 아닌 다른 알 수 없는 값일 경우 차단 안 됨 (화이트리스트 방식으로 전환 권장: FRIEND/ADMIN만 허용)
3. [ChatController.java:46~74] `handleMessage`에서 `roomId` 파라미터가 `@DestinationVariable`로 주입되나 StompChannelInterceptor에서 차단되지 않으면 존재하지 않는 방에 메시지가 브로드캐스트됨 (ROOM_NOT_FOUND 에러 에러큐 전송 없이 그냥 처리)

#### LOW
1. [DbgChatRoomPage.tsx:44~46] 재연결 3회 실패 시 `/dbgchat`로 navigate하고 "서버와 연결이 끊어졌습니다." 토스트를 state로 전달 — 그러나 DbgChatListPage에서 `location.state.toast`를 읽어 표시하는 코드가 확인되지 않음 (토스트 미표출 가능)
2. [ChatController.java:78] `handleSubscribe` 이벤트 리스너에서 `event.getUser()`가 `ChatPrincipal`이 아닌 일반 `Principal`일 경우 입장 메시지 미발송 — SockJS 폴백 환경에서 Principal 타입이 다를 수 있음

### 판정
CONDITIONAL PASS — CRITICAL 버그(컴파일 오류) 수정 + HIGH 버그 수정 후 재검증 필요

### Next Step
1. developer-backend 에 CRITICAL(StompChannelInterceptor Map import 누락) 즉시 수정 요청
2. developer-backend 에 HIGH 버그(메시지 차단 미동작, roomId 검증 누락, 퇴장 단일 방 한계) 수정 요청
3. 수정 완료 후 로컬 환경 런타임 TC 실행
4. MEDIUM/LOW 버그는 수정 후 MEDIUM 재검증 필요
5. 회귀 smoke test: 기존 RSP, Blockfall, Blockfall Insane 동작 확인
