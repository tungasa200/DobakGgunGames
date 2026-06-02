import { useEffect, useRef, useCallback, useState } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import type {
  AbEventType,
  MatchReadyPayload,
  GameStartedPayload,
  AppleRemovedPayload,
  GameResultPayload,
  StateSnapshotPayload,
} from './types';

const WS_BATTLE_URL = (import.meta.env.VITE_WS_BATTLE_URL as string | undefined)?.trim();

interface AbWsMessage<T = unknown> {
  type: AbEventType | string;
  timestamp?: string;
  payload: T;
}

export interface UseAppleBattleSocketOptions {
  roomId: string | null;
  playerId: string | null;
  authParam: string | null; // JWT or guestToken
  enabled: boolean;
  onMatchReady: (p: MatchReadyPayload) => void;
  onGameStarted: (p: GameStartedPayload) => void;
  onAppleRemoved: (p: AppleRemovedPayload) => void;
  onGameResult: (p: GameResultPayload) => void;
  onStateSnapshot: (p: StateSnapshotPayload) => void;
  onOpponentDisconnected: () => void;
  onOpponentReconnected: () => void;
  onRematchRequested: () => void;
  onRematchDeclined: () => void;
  onError: (code: string, message: string) => void;
  onStatusChange: (status: 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error') => void;
}

export interface UseAppleBattleSocketReturn {
  isConnected: boolean;
  sendRemove: (cells: [number, number][]) => void;
  sendRequestState: () => void;
  sendLeave: () => void;
  sendRematch: () => void;
}

const MAX_RETRY = 3;
const RETRY_DELAYS = [2000, 4000, 8000];

export function useAppleBattleSocket(
  opts: UseAppleBattleSocketOptions,
): UseAppleBattleSocketReturn {
  const {
    roomId,
    playerId,
    authParam,
    enabled,
    onMatchReady,
    onGameStarted,
    onAppleRemoved,
    onGameResult,
    onStateSnapshot,
    onOpponentDisconnected,
    onOpponentReconnected,
    onRematchRequested,
    onRematchDeclined,
    onError,
    onStatusChange,
  } = opts;

  const clientRef = useRef<Client | null>(null);
  const isConnectedRef = useRef(false);
  const [isConnected, setIsConnected] = useState(false);
  const retryCountRef = useRef(0);
  const disconnectRequestedRef = useRef(false);
  const leaveSentRef = useRef(false);
  const isReloadingRef = useRef(false);

  // 핸들러 ref — stale closure 방지
  const handlersRef = useRef({
    onMatchReady,
    onGameStarted,
    onAppleRemoved,
    onGameResult,
    onStateSnapshot,
    onOpponentDisconnected,
    onOpponentReconnected,
    onRematchRequested,
    onRematchDeclined,
    onError,
    onStatusChange,
  });
  useEffect(() => {
    handlersRef.current = {
      onMatchReady,
      onGameStarted,
      onAppleRemoved,
      onGameResult,
      onStateSnapshot,
      onOpponentDisconnected,
      onOpponentReconnected,
      onRematchRequested,
      onRematchDeclined,
      onError,
      onStatusChange,
    };
  });

  const roomIdRef = useRef(roomId);
  useEffect(() => { roomIdRef.current = roomId; }, [roomId]);

  const dispatchMessage = useCallback((type: string, payload: unknown) => {
    const h = handlersRef.current;
    switch (type as AbEventType) {
      case 'MATCH_READY':
        h.onMatchReady(payload as MatchReadyPayload);
        break;
      case 'GAME_STARTED':
        h.onGameStarted(payload as GameStartedPayload);
        break;
      case 'APPLE_REMOVED':
        h.onAppleRemoved(payload as AppleRemovedPayload);
        break;
      case 'GAME_RESULT':
        h.onGameResult(payload as GameResultPayload);
        break;
      case 'STATE_SNAPSHOT':
        h.onStateSnapshot(payload as StateSnapshotPayload);
        break;
      case 'OPPONENT_DISCONNECTED':
        h.onOpponentDisconnected();
        break;
      case 'OPPONENT_RECONNECTED':
        h.onOpponentReconnected();
        break;
      case 'REMATCH_REQUESTED':
        h.onRematchRequested();
        break;
      case 'REMATCH_DECLINED':
        h.onRematchDeclined();
        break;
      case 'ERROR': {
        const ep = payload as { code?: string; message?: string };
        h.onError(ep.code ?? 'UNKNOWN', ep.message ?? '오류가 발생했습니다');
        break;
      }
      default:
        break;
    }
  }, []);

  const attemptReconnectRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!enabled || !roomId || !playerId || !authParam) return;

    disconnectRequestedRef.current = false;
    retryCountRef.current = 0;
    leaveSentRef.current = false;
    isReloadingRef.current = false;

    const onBeforeUnload = () => {
      isReloadingRef.current = true;
      const rid = roomIdRef.current;
      const currentAuthParam = authParam;
      // 게스트만 sendBeacon cancel 가능 (sendBeacon은 커스텀 헤더 미지원)
      if (rid && currentAuthParam?.startsWith('guest_')) {
        const baseUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim() ?? '';
        const apiUrl = import.meta.env.DEV ? '' : baseUrl;
        const url = `${apiUrl}/api/apple-battle/room/${rid}/cancel`;
        try {
          navigator.sendBeacon(url, new Blob(
            [JSON.stringify({ guestToken: currentAuthParam })],
            { type: 'application/json' }
          ));
        } catch { /* 무시 */ }
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);

    const baseUrl = WS_BATTLE_URL
      ?? (import.meta.env.DEV ? 'http://localhost:8080/ws-battle' : '');

    const wsUrl = `${baseUrl}?token=${encodeURIComponent(authParam)}&gameType=apple-battle`;

    const client = new Client({
      webSocketFactory: () => new SockJS(wsUrl) as unknown as WebSocket,
      reconnectDelay: 0,
      onConnect: () => {
        retryCountRef.current = 0;
        isConnectedRef.current = true;
        setIsConnected(true);
        handlersRef.current.onStatusChange('connected');

        const rid = roomIdRef.current;
        if (!rid) return;

        // 방 브로드캐스트: MATCH_READY, APPLE_REMOVED, GAME_RESULT
        client.subscribe(`/topic/apple-battle/room/${rid}`, (frame) => {
          try {
            const msg = JSON.parse(frame.body) as AbWsMessage;
            dispatchMessage(msg.type, msg.payload);
          } catch { /* 파싱 실패 무시 */ }
        });

        // 개인 채널: STATE_SNAPSHOT, OPPONENT_DISCONNECTED, OPPONENT_RECONNECTED
        client.subscribe('/user/queue/apple-battle/state', (frame) => {
          try {
            const msg = JSON.parse(frame.body) as AbWsMessage;
            dispatchMessage(msg.type, msg.payload);
          } catch { /* 파싱 실패 무시 */ }
        });

        // 개인 채널: GAME_STARTED (보드 포함)
        client.subscribe('/user/queue/apple-battle/board', (frame) => {
          try {
            const msg = JSON.parse(frame.body) as AbWsMessage;
            dispatchMessage(msg.type, msg.payload);
          } catch { /* 파싱 실패 무시 */ }
        });

        // 개인 채널: ERROR
        client.subscribe('/user/queue/apple-battle/errors', (frame) => {
          try {
            const msg = JSON.parse(frame.body) as AbWsMessage;
            if (msg.type === 'ERROR') {
              const ep = msg.payload as { code?: string; message?: string };
              handlersRef.current.onError(ep.code ?? 'UNKNOWN', ep.message ?? '오류가 발생했습니다');
            }
          } catch { /* 파싱 실패 무시 */ }
        });

        // 연결 후 상태 요청 (재연결 시 STATE_SNAPSHOT 수신)
        client.publish({
          destination: `/app/apple-battle/room/${rid}/request-state`,
          body: '{}',
        });
      },
      onDisconnect: () => {
        isConnectedRef.current = false;
        setIsConnected(false);
        if (!disconnectRequestedRef.current) {
          handlersRef.current.onStatusChange('disconnected');
          attemptReconnectRef.current();
        }
      },
      onStompError: () => {
        isConnectedRef.current = false;
        setIsConnected(false);
        if (!disconnectRequestedRef.current) {
          attemptReconnectRef.current();
        }
      },
      onWebSocketError: () => {
        isConnectedRef.current = false;
        setIsConnected(false);
        if (!disconnectRequestedRef.current) {
          attemptReconnectRef.current();
        }
      },
    });

    attemptReconnectRef.current = () => {
      if (disconnectRequestedRef.current) return;
      if (retryCountRef.current >= MAX_RETRY) {
        handlersRef.current.onStatusChange('error');
        return;
      }
      retryCountRef.current += 1;
      handlersRef.current.onStatusChange('reconnecting');
      const delay = RETRY_DELAYS[retryCountRef.current - 1] ?? 10000;
      setTimeout(() => {
        if (!disconnectRequestedRef.current) {
          try {
            client.activate();
          } catch {
            attemptReconnectRef.current();
          }
        }
      }, delay);
    };

    handlersRef.current.onStatusChange('connecting');
    client.activate();
    clientRef.current = client;

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      disconnectRequestedRef.current = true;
      isConnectedRef.current = false;
      setIsConnected(false);
      const rid = roomIdRef.current;
      if (client.connected && rid && !leaveSentRef.current && !isReloadingRef.current) {
        leaveSentRef.current = true;
        client.publish({
          destination: `/app/apple-battle/room/${rid}/leave`,
          body: '{}',
        });
      }
      client.deactivate().catch(() => {});
      clientRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, roomId, playerId, authParam]);

  // ── 발행 메서드 ──────────────────────────────────────────

  const sendRemove = useCallback((cells: [number, number][]) => {
    const c = clientRef.current;
    const rid = roomIdRef.current;
    if (!c?.connected || !rid) return;
    c.publish({
      destination: `/app/apple-battle/room/${rid}/remove`,
      body: JSON.stringify({ cells }),
    });
  }, []);

  const sendRequestState = useCallback(() => {
    const c = clientRef.current;
    const rid = roomIdRef.current;
    if (!c?.connected || !rid) return;
    c.publish({
      destination: `/app/apple-battle/room/${rid}/request-state`,
      body: '{}',
    });
  }, []);

  const sendLeave = useCallback(() => {
    const c = clientRef.current;
    const rid = roomIdRef.current;
    if (!c?.connected || !rid) return;
    leaveSentRef.current = true;
    c.publish({
      destination: `/app/apple-battle/room/${rid}/leave`,
      body: '{}',
    });
  }, []);

  const sendRematch = useCallback(() => {
    const c = clientRef.current;
    const rid = roomIdRef.current;
    if (!c?.connected || !rid) return;
    c.publish({
      destination: `/app/apple-battle/room/${rid}/rematch`,
      body: '{}',
    });
  }, []);

  return {
    isConnected,
    sendRemove,
    sendRequestState,
    sendLeave,
    sendRematch,
  };
}
