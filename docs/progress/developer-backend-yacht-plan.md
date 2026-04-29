# 구현 계획서 — developer-backend : Yacht 멀티플레이

- 작성자: developer-backend
- 작성일: 2026-04-29
- 상태: 구현 중
- 기반 PRD: `docs/specs/yacht-prd.md` (CP1 승인 완료)
- API 계약: `docs/specs/yacht-api-contract.md`

---

## 1. 신규 파일 목록

### Entity (com.dobakggun.entity.yacht) — 5개
| 파일 | 역할 |
|---|---|
| `YachtRoomStatus.java` | WAITING/PLAYING/FINISHED enum |
| `YachtRoom.java` | yacht_room 테이블 JPA 엔티티 |
| `YachtParticipant.java` | yacht_participant 테이블 JPA 엔티티 |
| `YachtScore.java` | yacht_score 테이블 JPA 엔티티 |
| `YachtWin.java` | yacht_win 테이블 JPA 엔티티 (CP1-2) |

### Repository — 4개
| 파일 | 역할 |
|---|---|
| `YachtRoomRepository.java` | |
| `YachtParticipantRepository.java` | |
| `YachtScoreRepository.java` | |
| `YachtWinRepository.java` | |

### DTO (com.dobakggun.dto.yacht) — 약 15개
- 요청: YachtMatchResponse, YachtRoomResponse, YachtRollRequest, YachtScoreRequest, YachtReadyRequest
- 응답 봉투: YachtEnvelopeDto
- 이벤트 payload: RoomState/GameStarted/TurnState/RollResult/ScoreRecorded/TurnChanged/GameOver/PlayerLeft/RoomClosed payload DTO들

### Service — 2개
| 파일 | 역할 |
|---|---|
| `YachtMatchService.java` | Redis 분산락 yacht:match:lock, 매칭 로직 |
| `YachtGameService.java` | 인메모리 ConcurrentHashMap 게임 상태, 준비/시작/굴림/점수/퇴장 처리 |

### Controller — 2개
| 파일 | 역할 |
|---|---|
| `YachtController.java` | POST /api/yacht/match, GET /api/yacht/room/{roomId} |
| `YachtWebSocketController.java` | STOMP /app/yacht/room/{roomId}/{action} |

### 기타
- `SecurityConfig.java` — `/api/yacht/**` authenticated() 추가
- `DobakGgunGamesApplicationTests.java` — YachtMatchService, YachtGameService @MockBean 추가

---

## 2. 아키텍처 결정

| 항목 | 결정 |
|---|---|
| 게임 상태 저장 | ConcurrentHashMap<String, YachtGameState> 서버 인메모리 (RPS 패턴 재사용) |
| 턴 타임아웃 | CP1-1: 없음 |
| 분산락 | Redis yacht:match:global, TTL 3초, 3회 재시도 |
| Rate Limit | yacht:rate:{userId}, 10초 내 5회 초과 → 429 |
| 세션 속성 키 | yachtSubscribedRoomIds (chat/rps와 완전 분리) |
| 준비/시작 | CP1-3: /ready (비방장 토글) + /start (방장+전원준비) |
| 방 TTL | 10분 @Scheduled 스윕 |
| 서버 재시작 | @EventListener(ApplicationReadyEvent) 좀비방 FINISHED |

---

## 3. YachtGameState 구조

```java
class YachtGameState {
    String roomId;
    Long hostUserId;
    int maxPlayers;
    YachtRoomStatus status;
    List<YachtPlayer> participants; // 입장 순서
    Set<Long> readySet;            // 준비 완료 userId
    
    // PLAYING 상태에서만 사용
    List<Long> turnOrder;          // 랜덤 셔플된 순서 (고정)
    int turnOrderIndex;            // 현재 turn의 turnOrder 내 인덱스
    int roundIndex;                // 0-based (총 12라운드)
    int[] dice;                    // [5] 현재 주사위값 (0=미굴림)
    List<Integer> keptIndices;
    int rollsLeft;                 // 3→2→1→0
    boolean hasRolled;             // 이번 턴에 최소 1회 굴렸는지
}
```

---

## 4. 구현 순서

1. Entity 5개 (YachtRoomStatus → YachtRoom → YachtParticipant → YachtScore → YachtWin)
2. Repository 4개
3. DTO 15개
4. SecurityConfig 수정
5. YachtMatchService
6. YachtGameService
7. YachtController (REST)
8. YachtWebSocketController (STOMP)
9. DobakGgunGamesApplicationTests 수정
10. 테스트 작성 (YachtScoreCalculatorTest, YachtControllerSecurityTest)
11. ./gradlew test 통과 확인

---

## 5. 점수 계산 규칙 구현 노트

- `FOUR_OF_A_KIND`: 5개 동일 포함 인정 → `face * 4`
- `FULL_HOUSE`: 정확히 counts=[2,3]인 경우만. [5]이면 0
- `LITTLE_STRAIGHT`: sorted unique set == {1,2,3,4,5}
- `BIG_STRAIGHT`: sorted unique set == {2,3,4,5,6}
- `YACHT`: distinct count == 1 → 50

---

## 6. 연결 끊김 처리 (SessionDisconnectEvent)

대기 중:
- 참가자 제거 + PLAYER_LEFT + ROOM_STATE
- 방장 끊김 → HOST_CHANGED (다음 입장자로 이전)
- 전원 끊김 → ROOM_CLOSED(EMPTY)

게임 중:
- 끊긴 유저의 미기록 족보 전체 0점 자동 기록 (SCORE_RECORDED per 족보)
- 끊긴 유저가 현재 턴이면 → 0점 기록 완료 후 TURN_CHANGED
- 잔존 1명 → ROOM_CLOSED(INSUFFICIENT_PLAYERS)
- 전원 끊김 → ROOM_CLOSED(EMPTY)
- 0점 자동 기록 후 게임 종료 조건 충족 시 → GAME_OVER 트리거
