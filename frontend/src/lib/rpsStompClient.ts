import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import type {
  RpsChoice,
  RpsEventType,
  RpsWsMessage,
  RoomStatePayload,
  MatchCountdownPayload,
  MatchCountdownCancelledPayload,
  GameStartedPayload,
  RoundResultPayload,
  PlayerLeftPayload,
  HostChangedPayload,
  RoomClosedPayload,
  WsErrorPayload,
  ConnectionStatus,
} from '../games/online-rps/types/rps.types';

export type { ConnectionStatus };

export interface RpsEventHandlers {
  onRoomState: (payload: RoomStatePayload) => void;
  onMatchCountdown: (payload: MatchCountdownPayload) => void;
  onMatchCountdownCancelled: (payload: MatchCountdownCancelledPayload) => void;
  onGameStarted: (payload: GameStartedPayload) => void;
  onRoundResult: (payload: RoundResultPayload) => void;
  onPlayerLeft: (payload: PlayerLeftPayload) => void;
  onHostChanged: (payload: HostChangedPayload) => void;
  onRoomClosed: (payload: RoomClosedPayload) => void;
  onError: (code: string, message: string) => void;
  onStatusChange: (status: ConnectionStatus) => void;
}

export interface RpsStompClientHandle {
  choose: (choice: RpsChoice) => void;
  rematch: () => void;
  leave: () => void;
  disconnect: () => void;
}

const WS_URL = import.meta.env.VITE_WS_URL as string | undefined;
const MAX_RETRY = 3;
const RETRY_DELAYS = [2000, 4000, 8000];

export function connectRps(
  token: string,
  roomId: string,
  handlers: RpsEventHandlers,
): RpsStompClientHandle {
  const {
    onRoomState,
    onMatchCountdown,
    onMatchCountdownCancelled,
    onGameStarted,
    onRoundResult,
    onPlayerLeft,
    onHostChanged,
    onRoomClosed,
    onError,
    onStatusChange,
  } = handlers;

  let retryCount = 0;
  let disconnectRequested = false;

  const baseUrl = WS_URL ?? (import.meta.env.DEV ? 'http://localhost:8080/ws' : '');
  const wsUrl = `${baseUrl}?token=${encodeURIComponent(token)}`;

  const client = new Client({
    webSocketFactory: () => new SockJS(wsUrl) as unknown as WebSocket,
    connectHeaders: {
      Authorization: `Bearer ${token}`,
    },
    reconnectDelay: 0,
    onConnect: () => {
      retryCount = 0;
      onStatusChange('connected');

      // 방 이벤트 구독
      client.subscribe(`/topic/rps/room/${roomId}`, (frame) => {
        try {
          const msg = JSON.parse(frame.body) as RpsWsMessage<unknown>;
          dispatchEvent(msg.type, msg.payload);
        } catch {
          // 파싱 실패 무시
        }
      });

      // 개인 에러 구독
      client.subscribe('/user/queue/errors', (frame) => {
        try {
          const err = JSON.parse(frame.body) as WsErrorPayload;
          onError(err.code, err.message ?? '오류가 발생했습니다');
        } catch {
          // 파싱 실패 무시
        }
      });

      // 방 입장 알림 자동 발행
      client.publish({
        destination: `/app/rps/room/${roomId}/join`,
        body: JSON.stringify({}),
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

  function dispatchEvent(type: RpsEventType, payload: unknown) {
    switch (type) {
      case 'ROOM_STATE':
        onRoomState(payload as RoomStatePayload);
        break;
      case 'MATCH_COUNTDOWN':
        onMatchCountdown(payload as MatchCountdownPayload);
        break;
      case 'MATCH_COUNTDOWN_CANCELLED':
        onMatchCountdownCancelled(payload as MatchCountdownCancelledPayload);
        break;
      case 'GAME_STARTED':
        onGameStarted(payload as GameStartedPayload);
        break;
      case 'ROUND_RESULT':
        onRoundResult(payload as RoundResultPayload);
        break;
      case 'PLAYER_LEFT':
        onPlayerLeft(payload as PlayerLeftPayload);
        break;
      case 'HOST_CHANGED':
        onHostChanged(payload as HostChangedPayload);
        break;
      case 'ROOM_CLOSED':
        onRoomClosed(payload as RoomClosedPayload);
        break;
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

  // 연결 시작
  onStatusChange('connecting');
  client.activate();

  return {
    choose: (choice: RpsChoice) => {
      if (!client.connected) return;
      client.publish({
        destination: `/app/rps/room/${roomId}/choose`,
        body: JSON.stringify({ choice }),
      });
    },
    rematch: () => {
      if (!client.connected) return;
      client.publish({
        destination: `/app/rps/room/${roomId}/rematch`,
        body: JSON.stringify({}),
      });
    },
    leave: () => {
      if (!client.connected) return;
      client.publish({
        destination: `/app/rps/room/${roomId}/leave`,
        body: JSON.stringify({}),
      });
    },
    disconnect: () => {
      disconnectRequested = true;
      client.deactivate().catch(() => {});
    },
  };
}
