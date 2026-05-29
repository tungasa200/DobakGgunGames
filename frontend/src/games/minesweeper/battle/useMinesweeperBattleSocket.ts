import { useEffect, useRef, useCallback, useState } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import type {
  MbEventType,
  MatchReadyPayload,
  GameStartedPayload,
  ProgressUpdatePayload,
  GameResultPayload,
  StateSnapshotPayload,
} from './types';

// WS 배틀 엔드포인트 (Blockfall Battle과 공유)
const WS_BATTLE_URL = (import.meta.env.VITE_WS_BATTLE_URL as string | undefined)?.trim();

interface MbWsMessage<T = unknown> {
  type: MbEventType | string;
  timestamp?: string;
  payload: T;
}

export interface UseMinesweeperBattleSocketOptions {
  roomId: string | null;
  playerId: string | null;
  authParam: string | null; // JWT or guestToken
  enabled: boolean;
  onMatchReady: (p: MatchReadyPayload) => void;
  onGameStarted: (p: GameStartedPayload) => void;
  onProgress: (p: ProgressUpdatePayload) => void;
  onGameResult: (p: GameResultPayload) => void;
  onStateSnapshot: (p: StateSnapshotPayload) => void;
  onOpponentFirstClickConfirmed: () => void;
  onOpponentDisconnected: () => void;
  onOpponentReconnected: () => void;
  onError: (code: string, message: string) => void;
  onStatusChange: (status: 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error') => void;
}

export interface UseMinesweeperBattleSocketReturn {
  isConnected: boolean;
  sendFirstClick: () => void;
  sendProgress: (revealedCount: number) => void;
  sendBoardClear: (elapsedMs: number) => void;
  sendMineHit: (elapsedMs: number, r: number, c: number) => void;
  sendLeave: () => void;
  requestState: () => void;
}

const MAX_RETRY = 3;
const RETRY_DELAYS = [2000, 4000, 8000];

export function useMinesweeperBattleSocket(
  opts: UseMinesweeperBattleSocketOptions,
): UseMinesweeperBattleSocketReturn {
  const {
    roomId,
    playerId,
    authParam,
    enabled,
    onMatchReady,
    onGameStarted,
    onProgress,
    onGameResult,
    onStateSnapshot,
    onOpponentFirstClickConfirmed,
    onOpponentDisconnected,
    onOpponentReconnected,
    onError,
    onStatusChange,
  } = opts;

  const clientRef = useRef<Client | null>(null);
  const isConnectedRef = useRef(false);
  const [isConnected, setIsConnected] = useState(false);
  const retryCountRef = useRef(0);
  const disconnectRequestedRef = useRef(false);

  // Progress throttle (200ms)
  const progressThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRevealedCountRef = useRef<number>(0);
  const pendingProgressRef = useRef<number | null>(null);

  // 핸들러 ref — 클로저에서 최신값 참조 (stale closure 방지)
  const handlersRef = useRef({
    onMatchReady,
    onGameStarted,
    onProgress,
    onGameResult,
    onStateSnapshot,
    onOpponentFirstClickConfirmed,
    onOpponentDisconnected,
    onOpponentReconnected,
    onError,
    onStatusChange,
  });
  useEffect(() => {
    handlersRef.current = {
      onMatchReady,
      onGameStarted,
      onProgress,
      onGameResult,
      onStateSnapshot,
      onOpponentFirstClickConfirmed,
      onOpponentDisconnected,
      onOpponentReconnected,
      onError,
      onStatusChange,
    };
  });

  const roomIdRef = useRef(roomId);
  useEffect(() => { roomIdRef.current = roomId; }, [roomId]);

  const dispatchMessage = useCallback((type: string, payload: unknown) => {
    const h = handlersRef.current;
    switch (type as MbEventType) {
      case 'MATCH_READY':
        h.onMatchReady(payload as MatchReadyPayload);
        break;
      case 'GAME_STARTED':
        h.onGameStarted(payload as GameStartedPayload);
        break;
      case 'PROGRESS_UPDATE':
        h.onProgress(payload as ProgressUpdatePayload);
        break;
      case 'GAME_RESULT':
        h.onGameResult(payload as GameResultPayload);
        break;
      case 'STATE_SNAPSHOT':
        h.onStateSnapshot(payload as StateSnapshotPayload);
        break;
      case 'FIRST_CLICK_CONFIRMED':
        h.onOpponentFirstClickConfirmed();
        break;
      case 'OPPONENT_DISCONNECTED':
        h.onOpponentDisconnected();
        break;
      case 'OPPONENT_RECONNECTED':
        h.onOpponentReconnected();
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

    const baseUrl = WS_BATTLE_URL
      ?? (import.meta.env.DEV ? 'http://localhost:8080/ws-battle' : '');

    const wsUrl = `${baseUrl}?token=${encodeURIComponent(authParam)}`;

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

        // 방 브로드캐스트 채널: MATCH_READY, PROGRESS_UPDATE, GAME_RESULT
        client.subscribe(`/topic/minesweeper-battle/room/${rid}`, (frame) => {
          try {
            const msg = JSON.parse(frame.body) as MbWsMessage;
            dispatchMessage(msg.type, msg.payload);
          } catch { /* 파싱 실패 무시 */ }
        });

        // 개인 채널: STATE_SNAPSHOT, OPPONENT_DISCONNECTED, OPPONENT_RECONNECTED
        client.subscribe('/user/queue/minesweeper-battle/state', (frame) => {
          try {
            const msg = JSON.parse(frame.body) as MbWsMessage;
            dispatchMessage(msg.type, msg.payload);
          } catch { /* 파싱 실패 무시 */ }
        });

        // 개인 채널: GAME_STARTED (adjMines 포함)
        client.subscribe('/user/queue/minesweeper-battle/board', (frame) => {
          try {
            const msg = JSON.parse(frame.body) as MbWsMessage;
            dispatchMessage(msg.type, msg.payload);
          } catch { /* 파싱 실패 무시 */ }
        });

        // 개인 채널: ERROR
        client.subscribe('/user/queue/minesweeper-battle/errors', (frame) => {
          try {
            const msg = JSON.parse(frame.body) as MbWsMessage;
            if (msg.type === 'ERROR') {
              const ep = msg.payload as { code?: string; message?: string };
              handlersRef.current.onError(ep.code ?? 'UNKNOWN', ep.message ?? '오류가 발생했습니다');
            }
          } catch { /* 파싱 실패 무시 */ }
        });

        // 연결 후 상태 요청 (재연결 시 STATE_SNAPSHOT 수신)
        client.publish({
          destination: `/app/minesweeper-battle/room/${rid}/request-state`,
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
      disconnectRequestedRef.current = true;
      isConnectedRef.current = false;
      setIsConnected(false);
      // progress throttle 정리
      if (progressThrottleRef.current) {
        clearTimeout(progressThrottleRef.current);
        progressThrottleRef.current = null;
      }
      client.deactivate().catch(() => {});
      clientRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, roomId, playerId, authParam]);

  // ── 발행 메서드 ──────────────────────────────────────────

  const sendFirstClick = useCallback(() => {
    const c = clientRef.current;
    const rid = roomIdRef.current;
    if (!c?.connected || !rid) return;
    c.publish({
      destination: `/app/minesweeper-battle/room/${rid}/first-click`,
      body: JSON.stringify({ r: 4, c: 4 }),
    });
  }, []);

  const sendProgress = useCallback((revealedCount: number) => {
    const c = clientRef.current;
    const rid = roomIdRef.current;
    if (!c?.connected || !rid) return;

    // 200ms throttle
    pendingProgressRef.current = revealedCount;

    if (progressThrottleRef.current !== null) return;

    const flush = () => {
      progressThrottleRef.current = null;
      const pending = pendingProgressRef.current;
      if (pending === null) return;
      if (pending === lastRevealedCountRef.current) return;
      lastRevealedCountRef.current = pending;
      pendingProgressRef.current = null;

      const cc = clientRef.current;
      const rrid = roomIdRef.current;
      if (!cc?.connected || !rrid) return;
      cc.publish({
        destination: `/app/minesweeper-battle/room/${rrid}/progress`,
        body: JSON.stringify({ revealedCount: pending }),
      });
    };

    progressThrottleRef.current = setTimeout(flush, 200);
  }, []);

  const sendBoardClear = useCallback((elapsedMs: number) => {
    const c = clientRef.current;
    const rid = roomIdRef.current;
    if (!c?.connected || !rid) return;
    // throttle 정리
    if (progressThrottleRef.current) {
      clearTimeout(progressThrottleRef.current);
      progressThrottleRef.current = null;
    }
    c.publish({
      destination: `/app/minesweeper-battle/room/${rid}/board-clear`,
      body: JSON.stringify({ elapsedMs }),
    });
  }, []);

  const sendMineHit = useCallback((elapsedMs: number, r: number, c: number) => {
    const cl = clientRef.current;
    const rid = roomIdRef.current;
    if (!cl?.connected || !rid) return;
    if (progressThrottleRef.current) {
      clearTimeout(progressThrottleRef.current);
      progressThrottleRef.current = null;
    }
    cl.publish({
      destination: `/app/minesweeper-battle/room/${rid}/mine-hit`,
      body: JSON.stringify({ elapsedMs, cell: { r, c } }),
    });
  }, []);

  const sendLeave = useCallback(() => {
    const c = clientRef.current;
    const rid = roomIdRef.current;
    if (!c?.connected || !rid) return;
    c.publish({
      destination: `/app/minesweeper-battle/room/${rid}/leave`,
      body: '{}',
    });
  }, []);

  const requestState = useCallback(() => {
    const c = clientRef.current;
    const rid = roomIdRef.current;
    if (!c?.connected || !rid) return;
    c.publish({
      destination: `/app/minesweeper-battle/room/${rid}/request-state`,
      body: '{}',
    });
  }, []);

  return {
    isConnected,
    sendFirstClick,
    sendProgress,
    sendBoardClear,
    sendMineHit,
    sendLeave,
    requestState,
  };
}
