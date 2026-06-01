import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import type {
  WsEventType,
  WsMessage,
  RoomStatePayload,
  GameStartedPayload,
  TurnStatePayload,
  RollResultPayload,
  ScoreRecordedPayload,
  TurnChangedPayload,
  GameOverPayload,
  PlayerLeftPayload,
  RoomClosedPayload,
  WsErrorPayload,
  ConnectionStatus,
  PlayerReconnectingPayload,
  PlayerReturnedPayload,
  KickVotePayload,
  ChatPayload,
} from '../games/yacht/types/yacht.types';
import type { ScoreKey } from '../games/yacht/types/yacht.types';
import { CLIENT_KEY_MAP } from '../games/yacht/types/yacht.types';

export type { ConnectionStatus };

export interface YachtEventHandlers {
  onRoomState: (payload: RoomStatePayload) => void;
  onGameStarted: (payload: GameStartedPayload) => void;
  onTurnState: (payload: TurnStatePayload) => void;
  onRollResult: (payload: RollResultPayload) => void;
  onScoreRecorded: (payload: ScoreRecordedPayload) => void;
  onTurnChanged: (payload: TurnChangedPayload) => void;
  onGameOver: (payload: GameOverPayload) => void;
  onPlayerLeft: (payload: PlayerLeftPayload) => void;
  onRoomClosed: (payload: RoomClosedPayload) => void;
  onError: (code: string, message: string) => void;
  onStatusChange: (status: ConnectionStatus) => void;
  onPlayerReconnecting: (payload: PlayerReconnectingPayload) => void;
  onPlayerReturned: (payload: PlayerReturnedPayload) => void;
  onKickVote: (payload: KickVotePayload) => void;
  onChat: (payload: ChatPayload) => void;
}

export interface YachtStompClientHandle {
  join: () => void;
  ready: (isReady: boolean) => void;
  start: () => void;
  roll: (keptIndices: number[]) => void;
  score: (scoreKey: ScoreKey) => void;
  leave: () => void;
  disconnect: () => void;
  voteKick: (targetUserId: number) => void;
  chat: (message: string) => void;
}

const WS_URL = import.meta.env.VITE_WS_URL as string | undefined;
const MAX_RETRY = 3;
const RETRY_DELAYS = [2000, 4000, 8000];

export function connectYacht(
  token: string | null,
  roomId: string,
  handlers: YachtEventHandlers,
): YachtStompClientHandle {
  const {
    onRoomState,
    onGameStarted,
    onTurnState,
    onRollResult,
    onScoreRecorded,
    onTurnChanged,
    onGameOver,
    onPlayerLeft,
    onRoomClosed,
    onError,
    onStatusChange,
    onPlayerReconnecting,
    onPlayerReturned,
    onKickVote,
    onChat,
  } = handlers;

  let retryCount = 0;
  let disconnectRequested = false;
  let leaveSent = false;

  // 기존 /ws 엔드포인트 공유 (chat, rps와 동일)
  const wsBase = WS_URL ?? (import.meta.env.DEV ? 'http://localhost:8080/ws' : '');
  const wsUrl = token ? `${wsBase}?token=${encodeURIComponent(token)}` : wsBase;

  const client = new Client({
    webSocketFactory: () => new SockJS(wsUrl) as unknown as WebSocket,
    connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
    reconnectDelay: 0,
    onConnect: () => {
      retryCount = 0;
      onStatusChange('connected');

      // 방 이벤트 구독
      client.subscribe(`/topic/yacht/room/${roomId}`, (frame) => {
        try {
          const msg = JSON.parse(frame.body) as WsMessage<unknown>;
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

      // 방 입장 자동 발행
      client.publish({
        destination: `/app/yacht/room/${roomId}/join`,
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

  function dispatchEvent(type: WsEventType, payload: unknown) {
    switch (type) {
      case 'ROOM_STATE':
        onRoomState(payload as RoomStatePayload);
        break;
      case 'GAME_STARTED':
        onGameStarted(payload as GameStartedPayload);
        break;
      case 'TURN_STATE':
        onTurnState(payload as TurnStatePayload);
        break;
      case 'ROLL_RESULT':
        onRollResult(payload as RollResultPayload);
        break;
      case 'SCORE_RECORDED':
        onScoreRecorded(payload as ScoreRecordedPayload);
        break;
      case 'TURN_CHANGED':
        onTurnChanged(payload as TurnChangedPayload);
        break;
      case 'GAME_OVER':
        onGameOver(payload as GameOverPayload);
        break;
      case 'PLAYER_LEFT':
        onPlayerLeft(payload as PlayerLeftPayload);
        break;
      case 'ROOM_CLOSED':
        onRoomClosed(payload as RoomClosedPayload);
        break;
      case 'PLAYER_RECONNECTING':
        onPlayerReconnecting(payload as PlayerReconnectingPayload);
        break;
      case 'PLAYER_RETURNED':
        onPlayerReturned(payload as PlayerReturnedPayload);
        break;
      case 'KICK_VOTE':
        onKickVote(payload as KickVotePayload);
        break;
      case 'CHAT':
        onChat(payload as ChatPayload);
        break;
      // MATCH_COUNTDOWN / MATCH_COUNTDOWN_CANCELLED 는 CP1-3에 따라 미사용
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
    join: () => {
      if (!client.connected) return;
      client.publish({
        destination: `/app/yacht/room/${roomId}/join`,
        body: JSON.stringify({}),
      });
    },
    ready: (isReady: boolean) => {
      if (!client.connected) return;
      client.publish({
        destination: `/app/yacht/room/${roomId}/ready`,
        body: JSON.stringify({ ready: isReady }),
      });
    },
    start: () => {
      if (!client.connected) return;
      client.publish({
        destination: `/app/yacht/room/${roomId}/start`,
        body: JSON.stringify({}),
      });
    },
    roll: (keptIndices: number[]) => {
      if (!client.connected) return;
      client.publish({
        destination: `/app/yacht/room/${roomId}/roll`,
        body: JSON.stringify({ keptIndices }),
      });
    },
    score: (scoreKey: ScoreKey) => {
      if (!client.connected) return;
      const serverKey = CLIENT_KEY_MAP[scoreKey];
      client.publish({
        destination: `/app/yacht/room/${roomId}/score`,
        body: JSON.stringify({ scoreKey: serverKey }),
      });
    },
    leave: () => {
      if (!client.connected) return;
      leaveSent = true;
      client.publish({
        destination: `/app/yacht/room/${roomId}/leave`,
        body: JSON.stringify({}),
      });
    },
    disconnect: () => {
      disconnectRequested = true;
      if (client.connected && !leaveSent) {
        leaveSent = true;
        client.publish({
          destination: `/app/yacht/room/${roomId}/leave`,
          body: JSON.stringify({}),
        });
      }
      client.deactivate().catch(() => {});
    },
    voteKick: (targetUserId: number) => {
      if (!client.connected) return;
      client.publish({
        destination: `/app/yacht/room/${roomId}/vote-kick`,
        body: JSON.stringify({ targetUserId }),
      });
    },
    chat: (message: string) => {
      if (!client.connected) return;
      client.publish({
        destination: `/app/yacht/room/${roomId}/chat`,
        body: JSON.stringify({ message }),
      });
    },
  };
}
