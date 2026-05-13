import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { postYachtBotMatch, getYachtRoom } from '../../../api/yacht';
import { connectYacht } from '../../../lib/yachtStompClient';
import type { YachtStompClientHandle } from '../../../lib/yachtStompClient';
import type {
  DiceType,
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
} from '../../yacht/types/yacht.types';
import { SERVER_KEY_MAP, MAX_ROLLS_BY_MODE } from '../../yacht/types/yacht.types';

export interface UseYachtBotGameReturn {
  phase: YachtPhase;
  roomId: string | null;
  diceType: DiceType;
  participants: Participant[];
  hostUserId: number | null;
  currentTurnUserId: number | null;
  dice: number[];
  keptIndices: number[];
  rollsLeft: number;
  playerScores: PlayerScore[];
  rankings: RankEntry[];
  gameOverData: GameOverPayload | null;
  myUserId: number | null;
  isMyTurn: boolean;
  isSpectator: boolean;
  isRolling: boolean;
  errorMessage: string | null;
  wsStatus: ConnectionStatus;
  toastMessage: string | null;
  roundNum: number;
  startMatch: () => Promise<void>;
  enterExistingRoom: (roomId: string) => void;
  toggleKeep: (index: number) => void;
  rollDice: () => void;
  recordScore: (scoreKey: ScoreKey) => void;
  readyToggle: (isReady: boolean) => void;
  startGame: () => void;
  leave: () => void;
  dismissError: () => void;
  dismissToast: () => void;
}

export function useYachtBotGame(initialDiceType: DiceType = 'D6'): UseYachtBotGameReturn {
  const { user, accessToken } = useAuth();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<YachtPhase>('idle');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [diceType, setDiceType] = useState<DiceType>(initialDiceType);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [hostUserId, setHostUserId] = useState<number | null>(null);
  const [currentTurnUserId, setCurrentTurnUserId] = useState<number | null>(null);
  const [dice, setDice] = useState<number[]>([0, 0, 0, 0, 0]);
  const [keptIndices, setKeptIndices] = useState<number[]>([]);
  const [rollsLeft, setRollsLeft] = useState<number>(MAX_ROLLS_BY_MODE[initialDiceType]);
  const [playerScores, setPlayerScores] = useState<PlayerScore[]>([]);
  const [rankings, setRankings] = useState<RankEntry[]>([]);
  const [gameOverData, setGameOverData] = useState<GameOverPayload | null>(null);
  const [isRolling, setIsRolling] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [wsStatus, setWsStatus] = useState<ConnectionStatus>('connecting');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [roundNum, setRoundNum] = useState<number>(1);

  const clientRef = useRef<YachtStompClientHandle | null>(null);
  const roomIdRef = useRef<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rollingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydratedRef = useRef<boolean>(false);
  const diceTypeRef = useRef<DiceType>(initialDiceType);

  useEffect(() => {
    diceTypeRef.current = diceType;
  }, [diceType]);

  const makeRandomDice = (): number[] => {
    const max = diceTypeRef.current === 'D8' ? 8 : 6;
    return Array.from({ length: 5 }, () => Math.floor(Math.random() * max) + 1);
  };

  const myUserId = user?.id ?? null;
  const isMyTurn = currentTurnUserId !== null && myUserId !== null && currentTurnUserId === myUserId;

  const isSpectator = useMemo(() => {
    if (myUserId === null) return false;
    const me = participants.find((p) => p.userId === myUserId);
    return !!me?.isSpectator;
  }, [participants, myUserId]);

  const showToast = useCallback((msg: string, durationMs = 4000) => {
    setToastMessage(msg);
    if (toastTimerRef.current !== null) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, durationMs);
  }, []);

  const goHome = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const hydrateFromSnapshot = useCallback(async (id: string, token: string | null) => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const snap = await getYachtRoom(id, token);
    if (!snap) return;

    if (snap.diceType) {
      setDiceType(snap.diceType);
      diceTypeRef.current = snap.diceType;
    }
    setHostUserId(snap.hostUserId);
    if (snap.currentTurnUserId != null) setCurrentTurnUserId(snap.currentTurnUserId);
    if (typeof snap.roundIndex === 'number') setRoundNum(snap.roundIndex + 1);

    if (snap.scoreboard) {
      const hydrated: PlayerScore[] = snap.scoreboard.map((sb) => {
        const localScores: Partial<Record<ScoreKey, number>> = {};
        for (const [serverKey, value] of Object.entries(sb.scores)) {
          if (value == null) continue;
          const localKey = SERVER_KEY_MAP[serverKey];
          if (localKey) localScores[localKey] = value;
        }
        return {
          userId: sb.userId,
          scores: localScores,
          upperTotal: sb.upperTotal,
          bonusEarned: sb.bonusEarned,
          grandTotal: sb.grandTotal,
        };
      });
      setPlayerScores(hydrated);
    }

    if (Array.isArray(snap.currentDice) && snap.currentDice.some((d) => d > 0)) setDice(snap.currentDice);
    if (Array.isArray(snap.currentKeptIndices)) setKeptIndices(snap.currentKeptIndices);
    if (typeof snap.currentRollsLeft === 'number') setRollsLeft(snap.currentRollsLeft);
  }, []);

  const connectWs = useCallback((id: string, token: string | null) => {
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }

    const handle = connectYacht(token, id, {
      onRoomState: (payload: RoomStatePayload) => {
        setParticipants(payload.participants);
        setHostUserId(payload.hostUserId);
        if (payload.diceType) {
          setDiceType(payload.diceType);
          diceTypeRef.current = payload.diceType;
        }
        if (payload.status === 'PLAYING') {
          setPhase((prev) => (prev === 'playing' ? prev : 'playing'));
          void hydrateFromSnapshot(payload.roomId, token);
        } else {
          setPhase((prev) => {
            if (prev === 'playing') return prev;
            if (prev === 'connecting' || prev === 'waiting') return 'waiting';
            return prev;
          });
        }
      },
      onGameStarted: (payload: GameStartedPayload) => {
        if (payload.diceType) {
          setDiceType(payload.diceType);
          diceTypeRef.current = payload.diceType;
        }
        setCurrentTurnUserId(payload.currentTurnUserId);
        setRollsLeft(payload.rollsLeft);
        setDice(makeRandomDice());
        setKeptIndices([]);
        setRoundNum(1);
        setPlayerScores(payload.turnOrder.map((uid) => ({
          userId: uid,
          scores: {},
          upperTotal: 0,
          bonusEarned: false,
          grandTotal: 0,
        })));
        setGameOverData(null);
        setRankings([]);
        setPhase('playing');
      },
      onTurnState: (payload: TurnStatePayload) => {
        setCurrentTurnUserId(payload.currentTurnUserId);
        setRollsLeft(payload.rollsLeft);
        if (payload.dice?.some((d) => d > 0)) setDice(payload.dice);
        setKeptIndices(payload.keptIndices ?? []);
      },
      onRollResult: (payload: RollResultPayload) => {
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
        setKeptIndices([]);
        setRoundNum(payload.roundNum);
      },
      onGameOver: (payload: GameOverPayload) => {
        setRankings(payload.rankings);
        setGameOverData(payload);
      },
      onPlayerLeft: (payload: PlayerLeftPayload) => {
        showToast(`${payload.nickname}님이 나갔습니다`);
        setParticipants((prev) => prev.filter((p) => p.userId !== payload.userId));
      },
      onRoomClosed: () => {
        setErrorMessage('방이 닫혔습니다. 홈으로 이동합니다.');
        setTimeout(() => goHome(), 3000);
      },
      onPlayerReconnecting: () => {},
      onPlayerReturned: () => {},
      onKickVote: () => {},
      onChat: () => {},
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
  }, [goHome, showToast, hydrateFromSnapshot]);

  const enterExistingRoom = useCallback((id: string) => {
    setErrorMessage(null);
    hydratedRef.current = false;
    setRoomId(id);
    roomIdRef.current = id;
    setPhase('connecting');
    connectWs(id, accessToken);
  }, [accessToken, connectWs]);

  // 봇 전용 매칭 (postYachtBotMatch 사용)
  const startMatch = useCallback(async () => {
    setPhase('matching');
    setErrorMessage(null);
    hydratedRef.current = false;

    const outcome = await postYachtBotMatch(accessToken, diceTypeRef.current);

    if (outcome.ok) {
      const id = outcome.data.roomId;
      if (outcome.data.diceType) {
        setDiceType(outcome.data.diceType as DiceType);
        diceTypeRef.current = outcome.data.diceType as DiceType;
      }
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

  const toggleKeep = useCallback((index: number) => {
    if (!isMyTurn || rollsLeft === MAX_ROLLS_BY_MODE[diceType]) return;
    setKeptIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  }, [isMyTurn, rollsLeft, diceType]);

  const rollDice = useCallback(() => {
    if (!clientRef.current || !isMyTurn || rollsLeft <= 0) return;
    clientRef.current.roll(keptIndices);
  }, [isMyTurn, rollsLeft, keptIndices]);

  const recordScore = useCallback((scoreKey: ScoreKey) => {
    if (!clientRef.current || !isMyTurn) return;
    if (rollsLeft === MAX_ROLLS_BY_MODE[diceType]) {
      showToast('먼저 주사위를 굴려야 합니다');
      return;
    }
    clientRef.current.score(scoreKey);
  }, [isMyTurn, rollsLeft, showToast, diceType]);

  const readyToggle = useCallback((isReady: boolean) => {
    if (!clientRef.current) return;
    clientRef.current.ready(isReady);
    if (myUserId !== null) {
      setParticipants((prev) =>
        prev.map((p) => (p.userId === myUserId ? { ...p, ready: isReady } : p))
      );
    }
  }, [myUserId]);

  const startGame = useCallback(() => {
    if (!clientRef.current) return;
    clientRef.current.start();
  }, []);

  const leave = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.leave();
      clientRef.current.disconnect();
      clientRef.current = null;
    }
    goHome();
  }, [goHome]);

  const dismissError = useCallback(() => setErrorMessage(null), []);
  const dismissToast = useCallback(() => setToastMessage(null), []);

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
    phase, roomId, diceType, participants, hostUserId, currentTurnUserId,
    dice, keptIndices, rollsLeft, playerScores, rankings, gameOverData,
    myUserId, isMyTurn, isSpectator, isRolling, errorMessage, wsStatus,
    toastMessage, roundNum,
    startMatch, enterExistingRoom, toggleKeep, rollDice, recordScore,
    readyToggle, startGame, leave, dismissError, dismissToast,
  };
}
