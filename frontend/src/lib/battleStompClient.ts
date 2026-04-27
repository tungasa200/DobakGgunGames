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
  onError: (code: string, message: string) => void;
  onStatusChange: (status: ConnectionStatus) => void;
}

export interface BattleStompClientHandle {
  sendBoardState: (board: number[][], score: number, lines: number, level: number, combo: number) => void;
  sendComboAttack: (combo: number, targetPlayerId?: string | null) => void;
  sendLeave: () => void;
  disconnect: () => void;
}

const WS_BATTLE_URL = import.meta.env.VITE_WS_BATTLE_URL as string | undefined;
const MAX_RETRY = 3;
const RETRY_DELAYS = [2000, 4000, 8000];

export function connectBattle(
  roomId: string,
  playerId: string,
  authParam: string, // JWT token (logged-in) or guestToken
  isGuest: boolean,
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
    onError,
    onStatusChange,
  } = handlers;

  let retryCount = 0;
  let disconnectRequested = false;

  // /ws-battle 엔드포인트 (기존 /ws와 분리)
  const baseUrl = WS_BATTLE_URL
    ?? (import.meta.env.DEV ? 'http://localhost:8080/ws-battle' : '');

  const tokenParam = isGuest
    ? `guestToken=${encodeURIComponent(authParam)}`
    : `token=${encodeURIComponent(authParam)}`;
  const wsUrl = `${baseUrl}?${tokenParam}`;

  const connectHeaders: Record<string, string> = {};
  if (!isGuest) {
    connectHeaders['Authorization'] = `Bearer ${authParam}`;
  } else {
    connectHeaders['X-Guest-Token'] = authParam;
  }

  const client = new Client({
    webSocketFactory: () => new SockJS(wsUrl) as unknown as WebSocket,
    connectHeaders,
    reconnectDelay: 0,
    onConnect: () => {
      retryCount = 0;
      onStatusChange('connected');

      // 방 이벤트 구독
      client.subscribe(`/topic/blockfall-battle/room/${roomId}`, (frame) => {
        try {
          const msg = JSON.parse(frame.body) as BattleWsMessage<unknown>;
          dispatchEvent(msg.type, msg.payload);
        } catch {
          // 파싱 실패 무시
        }
      });

      // 개인 에러 구독
      client.subscribe('/user/queue/blockfall-battle/errors', (frame) => {
        try {
          const err = JSON.parse(frame.body) as WsErrorPayload;
          onError(err.code, err.message ?? '오류가 발생했습니다');
        } catch {
          // 파싱 실패 무시
        }
      });

      // 방 입장 알림 발행
      client.publish({
        destination: `/app/blockfall-battle/room/${roomId}/join`,
        body: JSON.stringify({ playerId }),
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
      client.publish({
        destination: `/app/blockfall-battle/room/${roomId}/board-state`,
        body: JSON.stringify({
          type: 'BOARD_STATE',
          board,
          score,
          lines,
          level,
          combo,
        }),
      });
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
    sendLeave: () => {
      if (!client.connected) return;
      client.publish({
        destination: `/app/blockfall-battle/room/${roomId}/leave`,
        body: JSON.stringify({ type: 'LEAVE_BATTLE' }),
      });
    },
    disconnect: () => {
      disconnectRequested = true;
      client.deactivate().catch(() => {});
    },
  };
}
