import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import type {
  BattleEventType,
  BattleWsMessage,
  RoomStatePayload,
  GameStartedPayload,
  BoardUpdatePayload,
  GarbageAttackPayload,
  PlayerFinishedPayload,
  GameResultPayload,
  QueuePositionPayload,
  PlayerLeftPayload,
  MatchCountdownPayload,
  MatchCountdownCancelledPayload,
  ReadyStatePayload,
  MyGameStatePayload,
  WsErrorPayload,
  ConnectionStatus,
} from '../games/blockfall/types/battle.types';

export type { ConnectionStatus };

export interface BattleEventHandlers {
  onRoomState: (payload: RoomStatePayload) => void;
  onGameStarted: (payload: GameStartedPayload) => void;
  onBoardUpdate: (payload: BoardUpdatePayload) => void;
  onGarbageAttack: (payload: GarbageAttackPayload) => void;
  onPlayerFinished: (payload: PlayerFinishedPayload) => void;
  onGameResult: (payload: GameResultPayload) => void;
  onQueuePosition: (payload: QueuePositionPayload) => void;
  onPlayerLeft: (payload: PlayerLeftPayload) => void;
  onMatchCountdown: (payload: MatchCountdownPayload) => void;
  onMatchCountdownCancelled: (payload: MatchCountdownCancelledPayload) => void;
  onReadyState: (payload: ReadyStatePayload) => void;
  onMyGameState: (payload: MyGameStatePayload) => void;
  onError: (code: string, message: string) => void;
  onStatusChange: (status: ConnectionStatus) => void;
}

export interface BattleStompClientHandle {
  sendBoardState: (board: number[][], score: number, lines: number, level: number, combo: number) => void;
  sendComboAttack: (combo: number, targetPlayerId?: string | null) => void;
  sendPlayerFinished: () => void;
  sendLeave: () => void;
  sendPlayerReady: () => void;
  disconnect: () => void;
}

const WS_BATTLE_URL = (import.meta.env.VITE_WS_BATTLE_URL as string | undefined)?.trim();
const MAX_RETRY = 3;
const RETRY_DELAYS = [2000, 4000, 8000];

export function connectBattle(
  roomId: string,
  _playerId: string,
  authParam: string, // JWT token (logged-in) or guest_<uuid>
  _isGuest: boolean,
  handlers: BattleEventHandlers,
): BattleStompClientHandle {
  const {
    onRoomState,
    onGameStarted,
    onBoardUpdate,
    onGarbageAttack,
    onPlayerFinished,
    onGameResult,
    onQueuePosition,
    onPlayerLeft,
    onMatchCountdown,
    onMatchCountdownCancelled,
    onReadyState,
    onMyGameState,
    onError,
    onStatusChange,
  } = handlers;

  let retryCount = 0;
  let disconnectRequested = false;
  let boardStateThrottleTimer: ReturnType<typeof setTimeout> | null = null;
  let lastBoardStateJson = '';

  // /ws-battle 엔드포인트 (기존 /ws와 분리)
  const baseUrl = WS_BATTLE_URL
    ?? (import.meta.env.DEV ? 'http://localhost:8080/ws-battle' : '');

  // JWT 유저: ?token=<JWT>
  // 게스트:   ?token=guest_<uuid>  (joinBattle 응답의 guestToken 값 그대로)
  const wsUrl = `${baseUrl}?token=${encodeURIComponent(authParam)}&gameType=blockfall`;

  const connectHeaders: Record<string, string> = {};

  const client = new Client({
    webSocketFactory: () => new SockJS(wsUrl) as unknown as WebSocket,
    connectHeaders,
    reconnectDelay: 0,
    onConnect: () => {
      retryCount = 0;
      onStatusChange('connected');

      // 방 이벤트 구독 (ROOM_STATE, GAME_STARTED, PLAYER_FINISHED, GAME_RESULT, PLAYER_LEFT)
      client.subscribe(`/topic/blockfall-battle/room/${roomId}`, (frame) => {
        try {
          const msg = JSON.parse(frame.body) as BattleWsMessage<unknown>;
          dispatchEvent(msg.type, msg.payload);
        } catch {
          // 파싱 실패 무시
        }
      });

      // 개인 채널: 상대 보드 업데이트 (발신자 에코 방지를 위해 개인 채널로 수신)
      client.subscribe('/user/queue/blockfall-battle/board', (frame) => {
        try {
          const msg = JSON.parse(frame.body) as BattleWsMessage<unknown>;
          dispatchEvent(msg.type, msg.payload);
        } catch {
          // 파싱 실패 무시
        }
      });

      // 개인 채널: 큐 포지션
      client.subscribe('/user/queue/blockfall-battle/queue', (frame) => {
        try {
          const msg = JSON.parse(frame.body) as BattleWsMessage<unknown>;
          dispatchEvent(msg.type, msg.payload);
        } catch {
          // 파싱 실패 무시
        }
      });

      // 개인 채널: 에러
      client.subscribe('/user/queue/blockfall-battle/errors', (frame) => {
        try {
          const err = JSON.parse(frame.body) as WsErrorPayload;
          onError(err.code, err.message ?? '오류가 발생했습니다');
        } catch {
          // 파싱 실패 무시
        }
      });

      // 개인 채널: 상태 catch-up (WS 연결 직후 ROOM_STATE + MATCH_COUNTDOWN 수신)
      client.subscribe('/user/queue/blockfall-battle/state', (frame) => {
        try {
          const msg = JSON.parse(frame.body) as BattleWsMessage<unknown>;
          dispatchEvent(msg.type, msg.payload);
        } catch {
          // 파싱 실패 무시
        }
      });

      // WS 구독 완료 직후 현재 방 상태 요청
      // REST join → WS 구독 사이 타이밍 갭으로 놓친 MATCH_COUNTDOWN catch-up용
      client.publish({
        destination: `/app/blockfall-battle/room/${roomId}/request-state`,
        body: '{}',
      });
    },
    onDisconnect: () => {
      if (disconnectRequested) return;
      attemptReconnect();
    },
    onStompError: () => {
      if (disconnectRequested) return;
      attemptReconnect();
    },
    onWebSocketError: () => {
      if (disconnectRequested) return;
      attemptReconnect();
    },
  });

  function dispatchEvent(type: BattleEventType, payload: unknown) {
    switch (type) {
      case 'ROOM_STATE':
        onRoomState(payload as RoomStatePayload);
        break;
      case 'GAME_STARTED':
        onGameStarted(payload as GameStartedPayload);
        break;
      case 'BOARD_UPDATE':
        onBoardUpdate(payload as BoardUpdatePayload);
        break;
      case 'GARBAGE_ATTACK':
        onGarbageAttack(payload as GarbageAttackPayload);
        break;
      case 'PLAYER_FINISHED':
        onPlayerFinished(payload as PlayerFinishedPayload);
        break;
      case 'GAME_RESULT':
        onGameResult(payload as GameResultPayload);
        break;
      case 'QUEUE_POSITION':
        onQueuePosition(payload as QueuePositionPayload);
        break;
      case 'PLAYER_LEFT':
        onPlayerLeft(payload as PlayerLeftPayload);
        break;
      case 'MATCH_COUNTDOWN':
        onMatchCountdown(payload as MatchCountdownPayload);
        break;
      case 'MATCH_COUNTDOWN_CANCELLED':
        onMatchCountdownCancelled(payload as MatchCountdownCancelledPayload);
        break;
      case 'READY_STATE':
        onReadyState(payload as ReadyStatePayload);
        break;
      case 'MY_GAME_STATE':
        onMyGameState(payload as MyGameStatePayload);
        break;
      case 'ERROR': {
        const errPayload = payload as WsErrorPayload;
        onError(errPayload.code, errPayload.message ?? '오류가 발생했습니다');
        break;
      }
      default:
        break;
    }
  }

  function attemptReconnect() {
    if (disconnectRequested) return;
    if (retryCount >= MAX_RETRY) {
      onStatusChange('error');
      return;
    }
    retryCount += 1;
    onStatusChange('reconnecting');
    const delay = RETRY_DELAYS[retryCount - 1] ?? 8000;
    setTimeout(() => {
      if (!disconnectRequested) {
        try {
          client.activate();
        } catch {
          attemptReconnect();
        }
      }
    }, delay);
  }

  onStatusChange('connecting');
  client.activate();

  return {
    sendBoardState: (board, score, lines, level, combo) => {
      if (!client.connected) return;
      const payload = JSON.stringify({ board, score, lines, level, combo });
      if (payload === lastBoardStateJson) return;
      if (boardStateThrottleTimer !== null) return;
      boardStateThrottleTimer = setTimeout(() => {
        boardStateThrottleTimer = null;
        if (!client.connected) return;
        const currentPayload = JSON.stringify({ board, score, lines, level, combo });
        lastBoardStateJson = currentPayload;
        client.publish({
          destination: `/app/blockfall-battle/room/${roomId}/board-state`,
          body: currentPayload,
        });
      }, 100);
    },
    sendComboAttack: (combo, targetPlayerId = null) => {
      if (!client.connected) return;
      client.publish({
        destination: `/app/blockfall-battle/room/${roomId}/combo-attack`,
        body: JSON.stringify({
          type: 'COMBO_ATTACK',
          combo,
          targetPlayerId,
        }),
      });
    },
    sendPlayerFinished: () => {
      if (!client.connected) return;
      client.publish({
        destination: `/app/blockfall-battle/room/${roomId}/player-finished`,
        body: '{}',
      });
    },
    sendLeave: () => {
      if (!client.connected) return;
      client.publish({
        destination: `/app/blockfall-battle/room/${roomId}/leave`,
        body: JSON.stringify({ type: 'LEAVE_BATTLE' }),
      });
    },
    sendPlayerReady: () => {
      if (!client.connected) return;
      client.publish({
        destination: `/app/blockfall-battle/room/${roomId}/player-ready`,
        body: '{}',
      });
    },
    disconnect: () => {
      disconnectRequested = true;
      if (boardStateThrottleTimer !== null) {
        clearTimeout(boardStateThrottleTimer);
        boardStateThrottleTimer = null;
      }
      client.deactivate().catch(() => {});
    },
  };
}
