# Blockfall Battle Backend — 설계 플랜 (B-1)

- 소유 팀원: developer-backend
- 기능 키: `blockfall-battle`
- 최초 작성: 2026-04-27
- 상태: **구현 진행 중 (Phase 2)**
- 기반 PRD: `docs/specs/blockfall-battle-prd.md`

---

## API 계약 (developer-frontend 공유용)

### REST API

#### POST /api/blockfall-battle/join

**요청**
- Headers: `Authorization: Bearer <JWT>` (선택)
- Body:
```json
{ "guestToken": "string|null" }
```

**응답 200/201**
```json
{
  "roomId": "string(8)",
  "status": "WAITING|PLAYING",
  "playerCount": 2,
  "maxPlayers": 4,
  "queuePosition": null,
  "isGuest": false,
  "guestToken": null,
  "playerId": "string"
}
```

**에러**
- 401 `UNAUTHORIZED_GUEST_TOKEN` — guestToken 형식 불량
- 409 `ALREADY_IN_ROOM` — 이미 활성 방 참가 중 (roomId 포함)
- 503 `MATCH_UNAVAILABLE`

#### GET /api/blockfall-battle/rankings

**응답 200**
```json
{
  "topRankings": [
    { "rank": 1, "userId": 101, "nickname": "닉네임", "winCount": 24, "totalGames": 50, "lastPlayedAt": "ISO8601" }
  ]
}
```

---

### WebSocket

**엔드포인트**: `/ws-battle` (SockJS, 신규) — JWT 또는 guestToken 쿼리 파라미터 허용

**구독**
- `/topic/blockfall-battle/room/{roomId}` — 방 이벤트 수신
- `/user/queue/blockfall-battle/errors` — 개인 에러 수신

**발행 (클라이언트 → 서버)**
- `/app/blockfall-battle/room/{roomId}/board-state` — 보드 상태 200ms 주기
- `/app/blockfall-battle/room/{roomId}/combo-attack` — 콤보 공격
- `/app/blockfall-battle/room/{roomId}/leave` — 배틀 이탈

**서버 브로드캐스트 메시지 타입 (envelope: {type, timestamp, payload})**
- `ROOM_STATE` — 방 상태 변경 시 전체 브로드캐스트
- `MATCH_COUNTDOWN` — 카운트다운 시작
- `MATCH_COUNTDOWN_CANCELLED` — 카운트다운 취소
- `GAME_STARTED` — 게임 시작
- `BOARD_UPDATE` — 상대방 보드 전파 (발신자 에코 제외)
- `GARBAGE_ATTACK` — garbage line 수신 알림
- `PLAYER_FINISHED` — 플레이어 게임오버
- `GAME_RESULT` — 배틀 최종 결과 + topRankings
- `QUEUE_POSITION` — 개인 큐 위치 (개인 채널)
- `PLAYER_LEFT` — 플레이어 이탈
- `ERROR` — 에러 (개인 채널)

---

## 설계 결정 사항

| 항목 | 결정 |
|---|---|
| 게스트 인증 | 방안 A — `/ws-battle` 신규 엔드포인트 + `BlockfallBattleHandshakeInterceptor` |
| 인메모리 방 상태 | `BattleRoomManager` (@Component, ConcurrentHashMap) |
| 타이머 | `battleTaskScheduler` Bean (poolSize=5, "battle-timer-") |
| 카운트다운 | 5초. 4인 꽉 참 시 즉시 만료. |
| Principal | `BattlePrincipal` (별도, ChatPrincipal 재사용 X — isGuest 필드 필요) |
| StompChannelInterceptor 수정 | 최소화 — battle 경로(`/app/blockfall-battle/**`) + `/topic/blockfall-battle/**` 는 검사 제외 처리 |
| 결과 자동 다음 라운드 | 10초 후 `WAITING` 전이 + 큐 승격 (ScheduledFuture) |
| 전적 저장 트랜잭션 | `BattleRankingService.updateRecord()` — `@Transactional` (WebSocket 핸들러 밖에서 호출) |
| EC-15 콤보 중복 | `BattleRoomManager.lastComboSeq` — clientSeq 필드 BoardStateMessage에 추가 (선택 구현) |
| OQ-3 (4인 만원 즉시 시작) | 즉시 카운트다운 만료 — 4인 합류 즉시 GAME_STARTED |
| OQ-9 (콤보 시퀀스) | 미구현 (Phase 2) |

---

## 구현 순서

1. Migration SQL (`blockfall-battle-schema.sql`)
2. Entity: `BattleRoom`, `BattleRecord`
3. Repository: `BattleRoomRepository`, `BattleRecordRepository`
4. DTO: `battle/` 패키지 아래 DTO 클래스들
5. Security: `BattlePrincipal`, `BlockfallBattleHandshakeInterceptor`
6. Config: `BattleSchedulerConfig`, `WebSocketConfig` 수정
7. Service: `BattleRoomManager`, `BattleRoomService`, `BattleRankingService`
8. Controller: `BlockfallBattleWebSocketController`, `BattleRoomController`
9. Test: `DobakGgunGamesApplicationTests` MockBean 추가
10. SecurityConfig: `/ws-battle/**` permitAll, `/api/blockfall-battle/join` permitAll, `/api/blockfall-battle/rankings` permitAll

---

## 신규 환경변수

없음 — 기존 설정 재활용.
