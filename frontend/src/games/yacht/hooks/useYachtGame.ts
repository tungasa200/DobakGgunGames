import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { postYachtMatch } from '../../../api/yacht';
import { connectYacht } from '../../../lib/yachtStompClient';
import type { YachtStompClientHandle } from '../../../lib/yachtStompClient';
import type {
  YachtPhase,
  ConnectionStatus,
  Participant,
  PlayerScore,
  RoomStatePayload,
  GameStartedPayload,
  TurnStatePayload,
  RollResultPayload,
  ScoreRecordedPayload,
  TurnChangedPayload,
  GameOverPayload,
  PlayerLeftPayload,
  RankEntry,
  ScoreKey,
} from '../types/yacht.types';
import { SERVER_KEY_MAP } from '../types/yacht.types';

export interface UseYachtGameReturn {
  phase: YachtPhase;
  roomId: string | null;
  participants: Participant[];
  hostUserId: number | null;
  currentTurnUserId: number | null;
  dice: number[];          // [0,0,0,0,0] = 미굴림
  keptIndices: number[];
  rollsLeft: number;
  playerScores: PlayerScore[];
  rankings: RankEntry[];
  myUserId: number | null;
  isMyTurn: boolean;
  isRolling: boolean;
  errorMessage: string | null;
  wsStatus: ConnectionStatus;
  toastMessage: string | null;
  roundNum: number;
  startMatch: () => Promise<void>;
  toggleKeep: (index: number) => void;
  rollDice: () => void;
  recordScore: (scoreKey: ScoreKey) => void;
  readyToggle: (isReady: boolean) => void;
  startGame: () => void;
  leave: () => void;
  dismissError: () => void;
  dismissToast: () => void;
}

export function useYachtGame(): UseYachtGameReturn {
  const { user, accessToken } = useAuth();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<YachtPhase>('idle');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [hostUserId, setHostUserId] = useState<number | null>(null);
  const [currentTurnUserId, setCurrentTurnUserId] = useState<number | null>(null);
  const [dice, setDice] = useState<number[]>([0, 0, 0, 0, 0]);
  const [keptIndices, setKeptIndices] = useState<number[]>([]);
  const [rollsLeft, setRollsLeft] = useState<number>(3);
  const [playerScores, setPlayerScores] = useState<PlayerScore[]>([]);
  const [rankings, setRankings] = useState<RankEntry[]>([]);
  const [isRolling, setIsRolling] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [wsStatus, setWsStatus] = useState<ConnectionStatus>('connecting');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [roundNum, setRoundNum] = useState<number>(1);

  const clientRef = useRef<YachtStompClientHandle | null>(null);
  const roomIdRef = useRef<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rollingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 게임 시작 시 한 번 무작위 표시용 (이후 턴부터는 직전 결과 유지)
  const makeRandomDice = (): number[] =>
    Array.from({ length: 5 }, () => Math.floor(Math.random() * 6) + 1);

  const myUserId = user?.id ?? null;

  const isMyTurn = currentTurnUserId !== null && myUserId !== null && currentTurnUserId === myUserId;

  // 토스트 표시
  const showToast = useCallback((msg: string, durationMs = 4000) => {
    setToastMessage(msg);
    if (toastTimerRef.current !== null) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, durationMs);
  }, []);

  // 홈으로 이동
  const goHome = useCallback(() => {
    navigate('/');
  }, [navigate]);

  // WebSocket 연결
  const connectWs = useCallback((id: string, token: string | null) => {
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }

    const handle = connectYacht(token, id, {
      onRoomState: (payload: RoomStatePayload) => {
        setParticipants(payload.participants);
        setHostUserId(payload.hostUserId);
        setPhase((prev) => {
          if (prev === 'connecting' || prev === 'waiting') return 'waiting';
          return prev;
        });
      },
      onGameStarted: (payload: GameStartedPayload) => {
        setCurrentTurnUserId(payload.currentTurnUserId);
        setRollsLeft(payload.rollsLeft);
        // 최초 1회: 무작위 눈금으로 표시 (실제 굴림은 ROLL_RESULT가 덮어씀)
        setDice(makeRandomDice());
        setKeptIndices([]);
        setRoundNum(1);
        // turnOrder 기준으로 플레이어 점수 초기화
        setPlayerScores((prev) => {
          const existing = new Map(prev.map((ps) => [ps.userId, ps]));
          return payload.turnOrder.map((uid) => {
            const ex = existing.get(uid);
            return ex ?? {
              userId: uid,
              scores: {},
              upperTotal: 0,
              bonusEarned: false,
              grandTotal: 0,
            };
          });
        });
        setPhase('playing');
      },
      onTurnState: (payload: TurnStatePayload) => {
        setCurrentTurnUserId(payload.currentTurnUserId);
        setRollsLeft(payload.rollsLeft);
        // 서버가 [0,0,0,0,0]을 보내는 턴 시작 직후엔 직전 dice를 유지한다.
        // 진짜 dice 값(1~6)이 하나라도 들어오면 그때만 덮어쓴다.
        const incoming = payload.dice;
        if (incoming && incoming.some((d) => d > 0)) {
          setDice(incoming);
        }
        setKeptIndices(payload.keptIndices ?? []);
      },
      onRollResult: (payload: RollResultPayload) => {
        // 애니메이션 플래그 설정 후 해제
        setIsRolling(true);
        if (rollingTimerRef.current !== null) clearTimeout(rollingTimerRef.current);
        rollingTimerRef.current = setTimeout(() => {
          setIsRolling(false);
          rollingTimerRef.current = null;
        }, 900);

        setDice(payload.dice);
        setKeptIndices(payload.keptIndices);
        setRollsLeft(payload.rollsLeft);
      },
      onScoreRecorded: (payload: ScoreRecordedPayload) => {
        const localKey = SERVER_KEY_MAP[payload.scoreKey];
        if (!localKey) return;

        setPlayerScores((prev) =>
          prev.map((ps) => {
            if (ps.userId !== payload.userId) return ps;
            return {
              ...ps,
              scores: { ...ps.scores, [localKey]: payload.score },
              upperTotal: payload.upperTotal,
              bonusEarned: payload.bonusEarned,
              grandTotal: payload.grandTotal,
            };
          })
        );
      },
      onTurnChanged: (payload: TurnChangedPayload) => {
        setCurrentTurnUserId(payload.currentTurnUserId);
        setRollsLeft(payload.rollsLeft);
        // 직전 굴림 결과를 그대로 유지 (사용자 요청). dice 초기화 안 함.
        setKeptIndices([]);
        setRoundNum(payload.roundNum);
      },
      onGameOver: (payload: GameOverPayload) => {
        setRankings(payload.rankings);
        setPhase('result');
      },
      onPlayerLeft: (payload: PlayerLeftPayload) => {
        const reason = payload.reason === 'DISCONNECT' ? '연결이 끊겼습니다' : '나갔습니다';
        showToast(`${payload.nickname}님이 ${reason}`);
        setParticipants((prev) => prev.filter((p) => p.userId !== payload.userId));
      },
      onRoomClosed: () => {
        setErrorMessage('방이 닫혔습니다. 홈으로 이동합니다.');
        setTimeout(() => goHome(), 3000);
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
  }, [goHome, showToast]);

  // 매칭 시작
  const startMatch = useCallback(async () => {
    setPhase('matching');
    setErrorMessage(null);

    const outcome = await postYachtMatch(accessToken);

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
  }, [accessToken, connectWs, showToast]);

  // 주사위 인덱스 keep 토글 (내 턴이고 주사위가 있을 때만)
  const toggleKeep = useCallback((index: number) => {
    if (!isMyTurn || rollsLeft === 3) return; // 첫 굴림 전엔 keep 불가
    setKeptIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  }, [isMyTurn, rollsLeft]);

  // 주사위 굴리기
  const rollDice = useCallback(() => {
    if (!clientRef.current || !isMyTurn || rollsLeft <= 0) return;
    clientRef.current.roll(keptIndices);
  }, [isMyTurn, rollsLeft, keptIndices]);

  // 점수 기록
  const recordScore = useCallback((scoreKey: ScoreKey) => {
    if (!clientRef.current || !isMyTurn) return;
    // 최소 1회 굴린 뒤에만 허용 (rollsLeft가 3이면 아직 굴리지 않은 상태)
    if (rollsLeft === 3) {
      showToast('먼저 주사위를 굴려야 합니다');
      return;
    }
    clientRef.current.score(scoreKey);
  }, [isMyTurn, rollsLeft, showToast]);

  // 준비 토글
  const readyToggle = useCallback((isReady: boolean) => {
    if (!clientRef.current) return;
    clientRef.current.ready(isReady);
    // 로컬 즉시 반영 (서버 ROOM_STATE로 최종 동기화됨)
    if (myUserId !== null) {
      setParticipants((prev) =>
        prev.map((p) => (p.userId === myUserId ? { ...p, ready: isReady } : p))
      );
    }
  }, [myUserId]);

  // 게임 시작 (방장 전용)
  const startGame = useCallback(() => {
    if (!clientRef.current) return;
    clientRef.current.start();
  }, []);

  // 나가기
  const leave = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.leave();
      clientRef.current.disconnect();
      clientRef.current = null;
    }
    goHome();
  }, [goHome]);

  const dismissError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  const dismissToast = useCallback(() => {
    setToastMessage(null);
  }, []);

  // 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.leave();
        clientRef.current.disconnect();
        clientRef.current = null;
      }
      if (toastTimerRef.current !== null) clearTimeout(toastTimerRef.current);
      if (rollingTimerRef.current !== null) clearTimeout(rollingTimerRef.current);
    };
  }, []);

  return {
    phase,
    roomId,
    participants,
    hostUserId,
    currentTurnUserId,
    dice,
    keptIndices,
    rollsLeft,
    playerScores,
    rankings,
    myUserId,
    isMyTurn,
    isRolling,
    errorMessage,
    wsStatus,
    toastMessage,
    roundNum,
    startMatch,
    toggleKeep,
    rollDice,
    recordScore,
    readyToggle,
    startGame,
    leave,
    dismissError,
    dismissToast,
  };
}
