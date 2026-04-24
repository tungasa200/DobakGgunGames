# QA Report — Online RPS

> 담당: qa-tester
> 기능: Online RPS (실시간 멀티플레이 가위바위보)
> 최초 작성: 2026-04-24

---

## 최종 QA 상태

| 항목 | 결과 |
|---|---|
| BUG-1 (에러 메시지 포맷 불일치) | PASS — 2026-04-24 수정 확인 |
| BUG-2 (HOST_CHANGED 누락) | PASS — 2026-04-24 수정 확인 |
| BUG-3 (RPS 게임 에셋 경로 불일치) | PASS — 별도 경로 확인으로 해소 (재검증 불필요) |

**최종 승인일: 2026-04-24**

---

## 버그 수정 이력

### BUG-1 — [OnlineRpsWebSocketController] 에러 메시지 포맷 불일치

- **발견일**: 2026-04-24 (1차 코드 리뷰)
- **수정일**: 2026-04-24 (developer-backend)
- **원인**: `sendError()`가 `RpsEnvelopeDto`로 래핑하여 전송 — 클라이언트는 `{code, message}` 플랫 구조를 기대
- **수정 내용**: `RpsEnvelopeDto` 래핑 제거, `Map.of("code", code, "message", message)` 직접 전송으로 변경
- **검증 결과**: PASS (아래 상세 참조)

### BUG-2 — [RpsRoomService] 방장 퇴장 시 HOST_CHANGED 미발행

- **발견일**: 2026-04-24 (1차 코드 리뷰)
- **수정일**: 2026-04-24 (developer-backend)
- **원인**: `leaveRoom()`에 `remaining == 1 && WAITING → shouldClose = true` 분기가 있어, 2인 WAITING 방에서 방장 퇴장 시 HOST_CHANGED 대신 ROOM_CLOSED가 발행됨
- **수정 내용**: 해당 분기 제거 — `wasHost && !participants.isEmpty()` 조건 시 항상 HOST_CHANGED 발행하도록 변경
- **검증 결과**: PASS (아래 상세 참조)

---

## BUG-1 재검증 상세

### 검증 대상
- `OnlineRpsWebSocketController.java` L196-207
- `frontend/src/lib/rpsStompClient.ts` L89-96

### 서버 측 — sendError() 구현

```java
private void sendError(Principal principal, String code, String message) {
    if (principal == null) return;
    messagingTemplate.convertAndSendToUser(
            principal.getName(),
            "/queue/errors",
            Map.of("code", code, "message", message)
    );
}
```

확인 사항:
- `RpsEnvelopeDto` import 및 사용 없음 (컨트롤러 import 목록 L1-21에 없음)
- `Map.of("code", code, "message", message)` 플랫 맵 직접 전송
- 전송 경로 `/queue/errors` (STOMP prefix 포함 시 `/user/queue/errors`)

### 클라이언트 측 — 에러 수신 처리

```typescript
client.subscribe('/user/queue/errors', (frame) => {
  try {
    const err = JSON.parse(frame.body) as WsErrorPayload;
    onError(err.code, err.message ?? '오류가 발생했습니다');
  } catch {
    // 파싱 실패 무시
  }
});
```

확인 사항:
- 구독 경로 `/user/queue/errors` — 서버 전송 경로와 일치
- `WsErrorPayload` 타입으로 파싱: `err.code`, `err.message` 플랫 구조 접근
- `RpsEnvelopeDto` 래핑(`payload` 필드)을 가정하는 코드 없음

### 판정: PASS

서버 `Map.of("code", code, "message", message)` 직렬화 결과 `{"code":"...","message":"..."}`,  
클라이언트 `err.code` / `err.message` 접근 — 구조 일치. `RpsEnvelopeDto` 래핑 없음 확인.

---

## BUG-2 재검증 상세

### 검증 대상
- `RpsRoomService.java` L190-267 (`leaveRoom()` 메서드 전체)

### 시나리오별 코드 흐름 추적

**시나리오 A: 2인 WAITING 방에서 방장 퇴장 (핵심 수정 시나리오)**

조건: participants = [A(host), B], status = WAITING, A가 퇴장

1. L199-211 synchronized 블록: `leaving=A`, `wasHost=true`, participants에서 A 제거, `remaining=1`
2. L222-226: `remaining == 0` → false, closeRoom 미호출
3. L228-238 synchronized 블록: `wasHost=true && !state.participants.isEmpty()` (participants=[B]) → true
   - `newHost = B`, `state.hostUserId = B.userId`
   - `HOST_CHANGED` 브로드캐스트 발행 (roomId, newHostUserId=B, newHostNickname=B.nickname)
4. L240: `broadcastRoomState(state)` 호출
5. L244-247: `isPlaying = false` (WAITING 상태)
6. L261-265: `state.participants.size() == 1 < 2` → `cancelCountdown(state)` 호출

결과: HOST_CHANGED 발행 + MATCH_COUNTDOWN_CANCELLED 발행. **PASS**

---

**시나리오 B: 1인 방에서 방장 퇴장**

조건: participants = [A(host)], status = WAITING, A가 퇴장

1. L199-211: `leaving=A`, `wasHost=true`, participants에서 A 제거, `remaining=0`
2. L222-226: `remaining == 0` → true → `closeRoom(state, "EMPTY")` 호출 후 return
3. L228 이하 미실행

결과: ROOM_CLOSED(EMPTY) 발행. HOST_CHANGED 미발행. **PASS**

---

**시나리오 C: 2인 방에서 일반 참가자 퇴장**

조건: participants = [A(host), B], status = WAITING, B가 퇴장

1. L199-211: `leaving=B`, `wasHost=false`, participants에서 B 제거, `remaining=1`
2. L222-226: `remaining == 0` → false
3. L228-238: `wasHost=false` → HOST_CHANGED 블록 미진입
4. L240: `broadcastRoomState(state)` 호출
5. L261-265: `state.participants.size() == 1 < 2` → `cancelCountdown(state)` 호출

결과: HOST_CHANGED 미발행, ROOM_STATE만 브로드캐스트. **PASS**

---

**보조 검증 — PLAYING 중 방장 퇴장 (기존 동작 유지 확인)**

조건: participants = [A(host), B], status = PLAYING, A가 퇴장

1. L199-211: `leaving=A`, `wasHost=true`, remaining=1
2. L222-226: remaining != 0
3. L228-238: `wasHost=true && !participants.isEmpty()` → HOST_CHANGED 발행
4. L244-247: `isPlaying=true`
5. L249-255: `remaining == 1` → `cancelRoundTimeout`, `processRoundResult` 호출 후 return

결과: HOST_CHANGED 발행 + 잔존 1인으로 즉시 라운드 결과 처리. 의도된 동작.

### 판정: PASS

기존 `remaining == 1 && WAITING → shouldClose = true` 분기가 완전히 제거되었음을 확인.  
`wasHost && !participants.isEmpty()` 조건 하에 상태(WAITING/PLAYING) 무관하게 항상 HOST_CHANGED가 발행됨.  
3개 시나리오 모두 예상 동작과 일치.

---

## 추가 관찰 사항 (결함 수준 아님)

1. **동시성 주의 — `remaining` 변수 캡처 후 재확인 없음**: L249 `if (remaining == 1)` 조건은 synchronized 블록 외부에서 평가됨. `remaining`은 L211에서 synchronized 내부에서 캡처한 값이므로 현재 로직상 문제없으나, 향후 다중 퇴장 경쟁 조건 발생 시 재검토 권장. 현 구현에서는 `CopyOnWriteArrayList` 사용 + synchronized(state) 조합으로 충분히 보호됨. **Low / 권고 수준**.

2. **`HOST_CHANGED` 이후 `broadcastRoomState` 순서**: HOST_CHANGED 발행 후 broadcastRoomState가 호출됨 (L237 → L241). 클라이언트가 HOST_CHANGED 수신 직후 ROOM_STATE로 최신 방 상태를 받는 흐름이므로 의도된 순서. 정상.
