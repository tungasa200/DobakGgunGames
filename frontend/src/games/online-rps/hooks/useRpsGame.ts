import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { postMatch } from '../../../api/rps';
import { connectRps } from '../../../lib/rpsStompClient';
import type { RpsStompClientHandle } from '../../../lib/rpsStompClient';
import type {
  RpsPhase,
  RpsChoice,
  RoomStatePayload,
  MatchCountdownPayload,
  GameStartedPayload,
  RoundResultPayload,
  PlayerLeftPayload,
  HostChangedPayload,
  ConnectionStatus,
} from '../types/rps.types';

export interface UseRpsGameReturn {
  phase: RpsPhase;
  roomId: string | null;
  room: RoomStatePayload | null;
  countdown: number;
  gameDeadline: Date | null;
  gameTimeLeft: number;
  myUserId: number | null;
  myChoice: RpsChoice | null;
  chosenUserIds: Set<number>;
  roundResult: RoundResultPayload | null;
  errorMessage: string | null;
  wsStatus: ConnectionStatus;
  toastMessage: string | null;
  startMatch: () => Promise<void>;
  choose: (choice: RpsChoice) => void;
  rematch: () => void;
  leave: () => void;
  dismissError: () => void;
  dismissToast: () => void;
}

export function useRpsGame(): UseRpsGameReturn {
  const { user, accessToken } = useAuth();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<RpsPhase>('idle');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomStatePayload | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const [gameDeadline, setGameDeadline] = useState<Date | null>(null);
  const [gameTimeLeft, setGameTimeLeft] = useState<number>(10);
  const [myChoice, setMyChoice] = useState<RpsChoice | null>(null);
  const [chosenUserIds, setChosenUserIds] = useState<Set<number>>(new Set());
  const [roundResult, setRoundResult] = useState<RoundResultPayload | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [wsStatus, setWsStatus] = useState<ConnectionStatus>('connecting');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const clientRef = useRef<RpsStompClientHandle | null>(null);
  const roomIdRef = useRef<string | null>(null);
  const gameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const myUserId = user?.id ?? null;

  // 게임 타이머 정리
  const clearGameTimer = useCallback(() => {
    if (gameTimerRef.current !== null) {
      clearInterval(gameTimerRef.current);
      gameTimerRef.current = null;
    }
  }, []);

  // 토스트 표시
  const showToast = useCallback((msg: string, durationMs = 4000) => {
    setToastMessage(msg);
    if (toastTimerRef.current !== null) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, durationMs);
  }, []);

  // 홈으로 이동 (cleanup 포함)
  const goHome = useCallback(() => {
    clearGameTimer();
    navigate('/');
  }, [clearGameTimer, navigate]);

  // WebSocket 연결
  const connectWs = useCallback((id: string, token: string) => {
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }

    const handle = connectRps(token, id, {
      onRoomState: (payload: RoomStatePayload) => {
        setRoom(payload);
        setPhase((prev) => {
          if (prev === 'connecting' || prev === 'waiting' || prev === 'countdown') return 'waiting';
          return prev;
        });
      },
      onMatchCountdown: (payload: MatchCountdownPayload) => {
        setCountdown(payload.secondsRemaining);
        setPhase((prev) => {
          // 결과 화면 중엔 countdown으로 전환하지 않음 — 결과가 사라지는 버그 방지
          if (prev === 'result') return 'result';
          return 'countdown';
        });
      },
      onMatchCountdownCancelled: () => {
        setCountdown(0);
        setPhase('waiting');
      },
      onGameStarted: (payload: GameStartedPayload) => {
        const deadline = new Date(payload.deadlineAt);
        setGameDeadline(deadline);
        setGameTimeLeft(payload.timeoutSeconds);
        setMyChoice(null);
        setChosenUserIds(new Set());
        setRoundResult(null);
        setPhase('playing');

        clearGameTimer();
        gameTimerRef.current = setInterval(() => {
          const remaining = Math.max(0, Math.ceil((deadline.getTime() - Date.now()) / 1000));
          setGameTimeLeft(remaining);
          if (remaining <= 0) clearGameTimer();
        }, 200);
      },
      onRoundResult: (payload: RoundResultPayload) => {
        clearGameTimer();
        setRoundResult(payload);
        // 결과에서 선택 현황 업데이트
        const chosen = new Set(payload.results.map((r) => r.userId));
        setChosenUserIds(chosen);
        setPhase('result');
      },
      onPlayerLeft: (payload: PlayerLeftPayload) => {
        const reason = payload.reason === 'DISCONNECT' ? '연결이 끊겼습니다' : '나갔습니다';
        showToast(`${payload.nickname}님이 ${reason}`);
      },
      onHostChanged: (payload: HostChangedPayload) => {
        showToast(`${payload.newHostNickname}님이 새로운 호스트가 되었습니다`);
      },
      onRoomClosed: () => {
        setErrorMessage('방이 닫혔습니다. 홈으로 이동합니다.');
        clearGameTimer();
        setTimeout(() => {
          goHome();
        }, 3000);
      },
      onError: (code: string, message: string) => {
        if (code === 'UNAUTHORIZED' || code === 'ROOM_NOT_FOUND') {
          setErrorMessage(message || '연결 오류가 발생했습니다');
          setPhase('error');
        } else {
          showToast(message || `오류: ${code}`);
        }
      },
      onStatusChange: (status: ConnectionStatus) => {
        setWsStatus(status);
        if (status === 'error') {
          setErrorMessage('서버와의 연결이 실패했습니다. 다시 시도해 주세요.');
          setPhase('error');
        }
      },
    });

    clientRef.current = handle;
  }, [clearGameTimer, goHome, showToast]);

  // 매칭 시작
  const startMatch = useCallback(async () => {
    if (!accessToken) {
      navigate('/login');
      return;
    }

    setPhase('matching');
    setErrorMessage(null);

    const outcome = await postMatch(accessToken);

    if (outcome.ok) {
      const id = outcome.data.roomId;
      setRoomId(id);
      roomIdRef.current = id;
      setPhase('connecting');
      connectWs(id, accessToken);
    } else if (!outcome.ok && outcome.alreadyInRoom) {
      const id = outcome.roomId;
      setRoomId(id);
      roomIdRef.current = id;
      showToast('이미 진행 중인 방이 있습니다. 재진입합니다.');
      setPhase('connecting');
      connectWs(id, accessToken);
    } else {
      setErrorMessage(`매칭 실패: ${outcome.error}`);
      setPhase('error');
    }
  }, [accessToken, connectWs, navigate, showToast]);

  // 카드 선택
  const choose = useCallback((choice: RpsChoice) => {
    if (!clientRef.current || myChoice !== null) return;
    clientRef.current.choose(choice);
    setMyChoice(choice);
    if (myUserId !== null) {
      setChosenUserIds((prev) => new Set([...prev, myUserId]));
    }
    // 모바일 햅틱
    if ('vibrate' in navigator) {
      navigator.vibrate(60);
    }
  }, [myChoice, myUserId]);

  // 재도전
  const rematch = useCallback(() => {
    if (!clientRef.current) return;
    clientRef.current.rematch();
  }, []);

  // 나가기
  const leave = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.leave();
      clientRef.current.disconnect();
      clientRef.current = null;
    }
    clearGameTimer();
    goHome();
  }, [clearGameTimer, goHome]);

  const dismissError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  const dismissToast = useCallback(() => {
    setToastMessage(null);
  }, []);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.leave();
        clientRef.current.disconnect();
        clientRef.current = null;
      }
      clearGameTimer();
      if (toastTimerRef.current !== null) clearTimeout(toastTimerRef.current);
    };
  }, [clearGameTimer]);

  return {
    phase,
    roomId,
    room,
    countdown,
    gameDeadline,
    gameTimeLeft,
    myUserId,
    myChoice,
    chosenUserIds,
    roundResult,
    errorMessage,
    wsStatus,
    toastMessage,
    startMatch,
    choose,
    rematch,
    leave,
    dismissError,
    dismissToast,
  };
}
