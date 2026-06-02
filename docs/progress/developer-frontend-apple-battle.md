# developer-frontend — 사과게임 배틀 진행 로그

## 작업 날짜
2026-06-02

## 구현 완료 파일 목록

| 파일 | 역할 |
|------|------|
| `frontend/src/games/apple/battle/types.ts` | 배틀 타입 정의 (AbBattlePhase, AbBattleState, 페이로드 타입 등) |
| `frontend/src/api/appleBattle.ts` | REST API 래퍼 (join, create, joinRoom, cancel, waitingRooms, localStorage 헬퍼) |
| `frontend/src/games/apple/battle/useAppleBattleSocket.ts` | STOMP WebSocket 훅 (gameType=apple-battle, MAX_RETRY=3, sendRemove/Leave/Rematch/RequestState) |
| `frontend/src/games/apple/battle/useAppleBattleGame.ts` | 배틀 게임 상태 훅 (INIT_BATTLE, REMOVE, REMOVE_EXTERNAL, SYNC_BOARD, TICK, END) |
| `frontend/src/games/apple/battle/AppleBattleBoard.module.css` | 배틀 전용 CSS (HUD, 카운트다운 오버레이, 결과 모달, 재연결 배너 등) |
| `frontend/src/games/apple/battle/AppleBattleWaiting.tsx` | 대기 화면 컴포넌트 (스피너, 연결 상태 배지, 취소 버튼) |
| `frontend/src/games/apple/battle/AppleBattleGameView.tsx` | 게임 뷰 (캔버스 드래그 로직, HUD, 낙관적 업데이트, 재연결 오버레이) |
| `frontend/src/games/apple/battle/AppleBattleResult.tsx` | 결과 화면 (승/패/무, 재대결 버튼, 종료 이유 표시) |
| `frontend/src/games/apple/battle/AppleBattleBoard.tsx` | 메인 진입점 (전체 배틀 플로우, AbBattleState reducer, WS 이벤트 핸들러) |
| `frontend/src/App.tsx` | `/games/apple/battle` 라우트 추가 (AppleBattleBoard lazy 임포트) |

## 구현 패턴 요약

- `useMinesweeperBattleSocket.ts` 패턴을 100% 따름 (handlersRef, MAX_RETRY=3, RETRY_DELAYS, sendBeacon)
- 낙관적 업데이트: 드래그 UP → 로컬 즉시 제거 → WS sendRemove 전송
- stale closure 방지: `handlersRef` 패턴 (매 render마다 최신 핸들러 갱신)
- 카운트다운: matched phase → 1초 interval → countdownSec 0 → playing phase 전환
- 상대방 제거: `removeExternal(coords)` — 점수 반영 없이 보드만 업데이트
- STATE_SNAPSHOT: `syncBoard(board)` + dispatchBattle로 전체 상태 동기화

## 블로커 / 백엔드 의존사항

developer-backend에게 다음 API 계약 구현 요청 필요:

### REST 엔드포인트
- `POST /api/apple-battle/join`
- `POST /api/apple-battle/create`
- `POST /api/apple-battle/join/{roomId}`
- `GET /api/apple-battle/rooms/waiting`
- `POST /api/apple-battle/room/{roomId}/cancel`

### WebSocket 채널 (STOMP)
- 연결: `/ws-battle?token=...&gameType=apple-battle`
- 구독 (공개): `/topic/apple-battle/room/{roomId}` — MATCH_READY, APPLE_REMOVED, GAME_RESULT
- 구독 (개인): `/user/queue/apple-battle/state` — STATE_SNAPSHOT
- 구독 (개인): `/user/queue/apple-battle/board` — GAME_STARTED
- 구독 (개인): `/user/queue/apple-battle/errors` — ERROR
- 발행: `/app/apple-battle/room/{roomId}/remove` — body: `{ cells: [[r,c],...] }`
- 발행: `/app/apple-battle/room/{roomId}/request-state`
- 발행: `/app/apple-battle/room/{roomId}/leave`
- 발행: `/app/apple-battle/room/{roomId}/rematch`

### DTO 계약 (types.ts 기준)
- `MatchReadyPayload.players: AbPlayerInfo[]`
- `GameStartedPayload.board: number[][], startedAt: string, durationMs: number`
- `AppleRemovedPayload.playerId: string, cells: [number,number][], scores: Record<string,number>`
- `GameResultPayload.winnerId: string|null, scores: Record<string,number>, draw: boolean, reason: 'TIME_UP'|'BOARD_CLEARED'|'OPPONENT_LEFT'`
- `StateSnapshotPayload.status: string, board: (number|null)[][], scores, players, gameStartedAt, gameElapsedMs`

## 다음 세션에서 할 것

1. developer-backend가 API를 구현하면 실제 배포 환경에서 E2E 테스트
2. STATE_SNAPSHOT 서버 응답 status 문자열 매핑 확인 ('WAITING'|'MATCHED'|'PLAYING'|'FINISHED')
3. qa-tester에게 검증 요청
4. 필요시 모바일 터치 드래그 UX 미세 조정
