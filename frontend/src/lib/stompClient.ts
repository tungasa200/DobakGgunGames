import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import type { ChatMessageData, StompErrorData } from '../api/chat';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'error';

export interface StompClientOptions {
  roomId: string;
  token: string;
  onMessage: (msg: ChatMessageData) => void;
  onError: (err: StompErrorData) => void;
  onStatusChange: (status: ConnectionStatus) => void;
  onRoomDeleted: () => void;
}

const WS_URL = import.meta.env.VITE_WS_URL as string | undefined;
const MAX_RETRY = 3;
const RETRY_DELAYS = [2000, 4000, 8000];

export function createStompClient(opts: StompClientOptions): {
  connect: () => void;
  disconnect: () => void;
  send: (message: string) => void;
} {
  const { roomId, token, onMessage, onError, onStatusChange, onRoomDeleted } = opts;

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

      client.subscribe(`/topic/room/${roomId}`, (frame) => {
        try {
          const msg = JSON.parse(frame.body) as ChatMessageData;
          if (msg.type === 'SYSTEM' && msg.message === '채팅방이 종료되었습니다.') {
            onRoomDeleted();
            return;
          }
          onMessage(msg);
        } catch {
          // 파싱 실패 무시
        }
      });

      client.subscribe('/user/queue/errors', (frame) => {
        try {
          const err = JSON.parse(frame.body) as StompErrorData;
          if (err.code === 'ROOM_NOT_FOUND' || err.code === 'ROOM_DELETED' || err.code === 'FORBIDDEN') {
            onRoomDeleted();
            return;
          }
          onError(err);
        } catch {
          // 파싱 실패 무시
        }
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

  return {
    connect: () => {
      disconnectRequested = false;
      retryCount = 0;
      onStatusChange('connecting');
      client.activate();
    },
    disconnect: () => {
      disconnectRequested = true;
      client.deactivate().catch(() => {});
    },
    send: (message: string) => {
      if (!client.connected) return;
      client.publish({
        destination: `/app/chat/${roomId}`,
        body: JSON.stringify({ message }),
      });
    },
  };
}
