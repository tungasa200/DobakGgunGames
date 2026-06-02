import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import {
  joinAppleBattle,
  createAppleBattle,
  joinAppleBattleRoom,
  getAbWaitingRooms,
  saveAbJoinInfo,
  getStoredAbJoinInfo,
  getStoredAbGuestToken,
  clearAbJoinInfo,
  cancelAppleBattle,
} from '../../../api/appleBattle';
import type { AbWaitingRoomInfo } from '../../../api/appleBattle';
import { useAppleBattleGame } from './useAppleBattleGame';
import { useAppleBattleSocket } from './useAppleBattleSocket';
import type {
  AbBattleState,
  AbBattleAction,
  MatchReadyPayload,
  GameStartedPayload,
  AppleRemovedPayload,
  GameResultPayload,
  StateSnapshotPayload,
  AbPlayerInfo,
} from './types';
import AppleBattleWaiting from './AppleBattleWaiting';
import AppleBattleGameView from './AppleBattleGameView';
import AppleBattleResult from './AppleBattleResult';
import NormalHeader from '../../../components/normal/NormalHeader';
import styles from './AppleBattleBoard.module.css';

// ── AbBattleState 초기값 ───────────────────────────────────
const initialBattleState: AbBattleState = {
  phase: 'idle',
  roomId: null,
  myPlayerId: null,
  myNickname: null,
  opponentInfo: null,
  board: null,
  myScore: 0,
  opponentScore: 0,
  gameStartedAt: null,
  result: null,
  errorMessage: null,
  reconnecting: false,
  myRematchRequested: false,
  opponentRematchRequested: false,
  countdownSec: 3,
};

// ── Reducer ────────────────────────────────────────────────
function battleReducer(state: AbBattleState, action: AbBattleAction): AbBattleState {
  switch (action.type) {
    case 'JOIN_REQUESTED':
      return {
        ...initialBattleState,
        phase: 'waiting',
        roomId: action.roomId,
        myPlayerId: action.playerId,
        myNickname: action.nickname,
      };
    case 'MATCH_READY': {
      const { payload, myPlayerId } = action;
      const me = payload.players.find(p => p.playerId === myPlayerId);
      const opponent = payload.players.find(p => p.playerId !== myPlayerId);
      return {
        ...state,
        phase: 'matched',
        myNickname: me?.nickname ?? state.myNickname,
        opponentInfo: opponent ?? null,
        countdownSec: 3,
        myRematchRequested: false,
        opponentRematchRequested: false,
      };
    }
    case 'GAME_STARTED':
      return {
        ...state,
        phase: 'playing',
        board: action.payload.board,
        gameStartedAt: new Date(action.payload.serverStartAt).getTime(),
        myScore: 0,
        opponentScore: 0,
      };
    case 'APPLE_REMOVED': {
      const { scores } = action.payload;
      const myId = action.myPlayerId;
      const opponentId = Object.keys(scores).find(id => id !== myId);
      const myScore = scores[myId] ?? state.myScore;
      const opponentScore = opponentId ? (scores[opponentId] ?? state.opponentScore) : state.opponentScore;
      return { ...state, myScore, opponentScore };
    }
    case 'GAME_RESULT':
      return { ...state, phase: 'finished', result: action.payload };
    case 'STATE_SNAPSHOT': {
      const { payload, myPlayerId } = action;
      const me = payload.players.find(p => p.playerId === myPlayerId);
      const opponent = payload.players.find(p => p.playerId !== myPlayerId);
      const myScore = payload.scores[myPlayerId] ?? state.myScore;
      const opponentScore = opponent ? (payload.scores[opponent.playerId] ?? state.opponentScore) : state.opponentScore;
      const statusMap: Record<string, AbBattleState['phase']> = {
        WAITING: 'waiting',
        MATCHED: 'matched',
        PLAYING: 'playing',
        FINISHED: 'finished',
      };
      const newPhase = statusMap[payload.roomStatus] ?? state.phase;
      const newGameStartedAt = payload.elapsedMs != null
        ? Date.now() - payload.elapsedMs
        : state.gameStartedAt;
      return {
        ...state,
        phase: newPhase,
        myNickname: me?.nickname ?? state.myNickname,
        opponentInfo: opponent ?? state.opponentInfo,
        board: payload.board ?? state.board,
        myScore,
        opponentScore,
        gameStartedAt: newGameStartedAt,
        reconnecting: false,
      };
    }
    case 'OPPONENT_DISCONNECTED':
      return { ...state, reconnecting: true };
    case 'OPPONENT_RECONNECTED':
      return { ...state, reconnecting: false };
    case 'COUNTDOWN_TICK':
      return { ...state, countdownSec: Math.max(0, state.countdownSec - 1) };
    case 'START_PLAYING':
      return { ...state, phase: 'playing' };
    case 'ERROR':
      return { ...state, errorMessage: action.message };
    case 'MY_REMATCH_SENT':
      return { ...state, myRematchRequested: true };
    case 'REMATCH_REQUESTED':
      return { ...state, opponentRematchRequested: true };
    case 'REMATCH_DECLINED':
      return { ...state, phase: 'idle', myRematchRequested: false, opponentRematchRequested: false };
    case 'RESET':
      return initialBattleState;
    default:
      return state;
  }
}

export default function AppleBattleBoard() {
  const { user, accessToken } = useAuth();
  const navigate = useNavigate();

  const [battleState, dispatchBattle] = useReducer(battleReducer, initialBattleState);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error'>('connecting');

  // 방 목록 화면 상태
  const [showSelectScreen, setShowSelectScreen] = useState(true);
  const [browseMode, setBrowseMode] = useState(false);
  const [waitingRooms, setWaitingRooms] = useState<AbWaitingRoomInfo[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);

  // 상대 끊김 추적 (reconnecting은 상대 끊김, 내 재연결과 구분)
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);

  // 게임 로직 훅
  const {
    state: gameState,
    initBattle,
    startTimer,
    stopTimer,
    removeApples,
    removeExternal,
    syncBoard,
    syncTime,
    end: endGame,
  } = useAppleBattleGame();


  // 카운트다운 ref
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 페이지 타이틀
  useEffect(() => {
    document.title = '사과게임 배틀 | DobakGgun';
    return () => { document.title = '도박꾼게임즈'; };
  }, []);

  // 카운트다운 로직 — phase가 matched가 되면 시작
  useEffect(() => {
    if (battleState.phase === 'matched') {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = setInterval(() => {
        dispatchBattle({ type: 'COUNTDOWN_TICK' });
      }, 1000);
    } else {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    }
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    };
  }, [battleState.phase]);

  // countdownSec가 0이 되면 playing 단계로 전환
  useEffect(() => {
    if (battleState.phase === 'matched' && battleState.countdownSec === 0) {
      dispatchBattle({ type: 'START_PLAYING' });
    }
  }, [battleState.phase, battleState.countdownSec]);

  // phase가 playing으로 전환되면 타이머 시작
  useEffect(() => {
    if (battleState.phase === 'playing' && battleState.gameStartedAt !== null) {
      startTimer();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battleState.phase, battleState.gameStartedAt]);

  // timeLeft === 0 → 게임 종료 처리 (서버 결과 대기)
  useEffect(() => {
    if (battleState.phase === 'playing' && gameState.timeLeft <= 0) {
      stopTimer();
    }
  }, [battleState.phase, gameState.timeLeft, stopTimer]);

  // 게임 결과 → 타이머 정지
  useEffect(() => {
    if (battleState.phase === 'finished') {
      stopTimer();
      endGame();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battleState.phase]);

  // ── WebSocket 활성화 조건 ─────────────────────────────────
  const wsEnabled = battleState.roomId !== null && (
    battleState.phase === 'waiting' ||
    battleState.phase === 'matched' ||
    battleState.phase === 'countdown' ||
    battleState.phase === 'playing' ||
    battleState.phase === 'finished'
  );

  const stored = getStoredAbJoinInfo();
  const authParam = stored?.isGuest
    ? (stored.guestToken ?? accessToken ?? '')
    : (accessToken ?? '');

  // stable handler refs (stale closure 방지)
  const myPlayerIdRef = useRef(battleState.myPlayerId);
  useEffect(() => { myPlayerIdRef.current = battleState.myPlayerId; }, [battleState.myPlayerId]);

  const onMatchReadyStable = useCallback((payload: MatchReadyPayload) => {
    const myId = myPlayerIdRef.current ?? '';
    dispatchBattle({ type: 'MATCH_READY', payload, myPlayerId: myId });
  }, []);

  const onGameStartedStable = useCallback((payload: GameStartedPayload) => {
    initBattle(payload.board);
    dispatchBattle({ type: 'GAME_STARTED', payload });
  }, [initBattle]);

  const onAppleRemovedStable = useCallback((payload: AppleRemovedPayload) => {
    const myId = myPlayerIdRef.current ?? '';
    const coords = payload.cells.map(([r, c]) => ({ r, c }));
    if (payload.playerId === myId) {
      // 내 제거 확인 — 이미 낙관적 업데이트로 처리됐으므로 scores만 업데이트
      dispatchBattle({ type: 'APPLE_REMOVED', payload, myPlayerId: myId });
    } else {
      // 상대방 제거 반영
      removeExternal(coords);
      dispatchBattle({ type: 'APPLE_REMOVED', payload, myPlayerId: myId });
    }
  }, [removeExternal]);

  const onGameResultStable = useCallback((payload: GameResultPayload) => {
    dispatchBattle({ type: 'GAME_RESULT', payload });
  }, []);

  const onStateSnapshotStable = useCallback((payload: StateSnapshotPayload) => {
    const myId = myPlayerIdRef.current ?? '';
    if (payload.board) {
      syncBoard(payload.board);
    }
    if (payload.remainingMs != null) {
      syncTime(payload.remainingMs);
    }
    dispatchBattle({ type: 'STATE_SNAPSHOT', payload, myPlayerId: myId });
  }, [syncBoard, syncTime]);

  const onOpponentDisconnectedStable = useCallback(() => {
    setOpponentDisconnected(true);
    dispatchBattle({ type: 'OPPONENT_DISCONNECTED' });
  }, []);

  const onOpponentReconnectedStable = useCallback(() => {
    setOpponentDisconnected(false);
    dispatchBattle({ type: 'OPPONENT_RECONNECTED' });
  }, []);

  const onRematchRequestedStable = useCallback(() => {
    dispatchBattle({ type: 'REMATCH_REQUESTED' });
  }, []);

  const onRematchDeclinedStable = useCallback(() => {
    dispatchBattle({ type: 'REMATCH_DECLINED' });
    setTimeout(() => {
      clearAbJoinInfo();
      setShowSelectScreen(true);
      setBrowseMode(false);
      setWaitingRooms([]);
      setOpponentDisconnected(false);
    }, 50);
  }, []);

  const onErrorStable = useCallback((_code: string, message: string) => {
    dispatchBattle({ type: 'ERROR', message });
  }, []);

  const ws = useAppleBattleSocket({
    roomId: battleState.roomId,
    playerId: battleState.myPlayerId,
    authParam: wsEnabled ? authParam : null,
    enabled: wsEnabled,
    onMatchReady: onMatchReadyStable,
    onGameStarted: onGameStartedStable,
    onAppleRemoved: onAppleRemovedStable,
    onGameResult: onGameResultStable,
    onStateSnapshot: onStateSnapshotStable,
    onOpponentDisconnected: onOpponentDisconnectedStable,
    onOpponentReconnected: onOpponentReconnectedStable,
    onRematchRequested: onRematchRequestedStable,
    onRematchDeclined: onRematchDeclinedStable,
    onError: onErrorStable,
    onStatusChange: setWsStatus,
  });

  // ── 매칭 참가 ──────────────────────────────────────────────
  const startJoin = useCallback(async () => {
    setShowSelectScreen(false);
    const storedToken = getStoredAbGuestToken();
    try {
      const res = await joinAppleBattle({
        accessToken,
        guestToken: storedToken ?? undefined,
      });
      saveAbJoinInfo({
        roomId: res.roomId,
        playerId: res.playerId,
        isGuest: res.isGuest,
        guestToken: res.guestToken,
      });
      const nickname = res.isGuest ? '손님' : (user?.nickname ?? '나');
      dispatchBattle({ type: 'JOIN_REQUESTED', roomId: res.roomId, playerId: res.playerId, nickname });
    } catch (err) {
      const e = err as Error & { code?: string; roomId?: string; playerId?: string };
      if (e.code === 'ALREADY_IN_ROOM') {
        const storedInfo = getStoredAbJoinInfo();
        const roomId = storedInfo?.roomId ?? e.roomId;
        const playerId = storedInfo?.playerId ?? e.playerId;
        if (roomId && playerId) {
          const nickname = user?.nickname ?? '나';
          if (!storedInfo && roomId && playerId) {
            saveAbJoinInfo({ roomId, playerId, isGuest: !accessToken, guestToken: null });
          }
          dispatchBattle({ type: 'JOIN_REQUESTED', roomId, playerId, nickname });
          return;
        }
      }
      dispatchBattle({ type: 'ERROR', message: e.message ?? '배틀 참가에 실패했습니다.' });
    }
  }, [accessToken, user]);

  // ── 방 만들기 ─────────────────────────────────────────────
  const startCreate = useCallback(async () => {
    setShowSelectScreen(false);
    const storedToken = getStoredAbGuestToken();
    try {
      const res = await createAppleBattle({
        accessToken,
        guestToken: storedToken ?? undefined,
      });
      saveAbJoinInfo({
        roomId: res.roomId,
        playerId: res.playerId,
        isGuest: res.isGuest,
        guestToken: res.guestToken,
      });
      const nickname = res.isGuest ? '손님' : (user?.nickname ?? '나');
      dispatchBattle({ type: 'JOIN_REQUESTED', roomId: res.roomId, playerId: res.playerId, nickname });
    } catch (err) {
      const e = err as Error & { code?: string; roomId?: string; playerId?: string };
      if (e.code === 'ALREADY_IN_ROOM') {
        const storedInfo = getStoredAbJoinInfo();
        const roomId = storedInfo?.roomId ?? e.roomId;
        const playerId = storedInfo?.playerId ?? e.playerId;
        if (roomId && playerId) {
          const nickname = user?.nickname ?? '나';
          if (!storedInfo && roomId && playerId) {
            saveAbJoinInfo({ roomId, playerId, isGuest: !accessToken, guestToken: null });
          }
          dispatchBattle({ type: 'JOIN_REQUESTED', roomId, playerId, nickname });
          return;
        }
      }
      dispatchBattle({ type: 'ERROR', message: e.message ?? '방 생성에 실패했습니다.' });
    }
  }, [accessToken, user]);

  // ── 대기 방 목록 로드 ─────────────────────────────────────
  const loadWaitingRooms = useCallback(async () => {
    setRoomsLoading(true);
    const rooms = await getAbWaitingRooms();
    setWaitingRooms(rooms);
    setRoomsLoading(false);
  }, []);

  // ── 특정 방 입장 ──────────────────────────────────────────
  const startJoinRoom = useCallback(async (roomId: string) => {
    setShowSelectScreen(false);
    const storedToken = getStoredAbGuestToken();
    try {
      const res = await joinAppleBattleRoom(roomId, {
        accessToken,
        guestToken: storedToken ?? undefined,
      });
      saveAbJoinInfo({
        roomId: res.roomId,
        playerId: res.playerId,
        isGuest: res.isGuest,
        guestToken: res.guestToken,
      });
      const nickname = res.isGuest ? '손님' : (user?.nickname ?? '나');
      dispatchBattle({ type: 'JOIN_REQUESTED', roomId: res.roomId, playerId: res.playerId, nickname });
    } catch (err) {
      const e = err as Error & { code?: string; roomId?: string; playerId?: string };
      if (e.code === 'ALREADY_IN_ROOM') {
        const storedInfo = getStoredAbJoinInfo();
        const rId = storedInfo?.roomId ?? e.roomId;
        const pId = storedInfo?.playerId ?? e.playerId;
        if (rId && pId) {
          const nickname = user?.nickname ?? '나';
          if (!storedInfo && rId && pId) {
            saveAbJoinInfo({ roomId: rId, playerId: pId, isGuest: !accessToken, guestToken: null });
          }
          dispatchBattle({ type: 'JOIN_REQUESTED', roomId: rId, playerId: pId, nickname });
          return;
        }
      }
      dispatchBattle({ type: 'ERROR', message: e.message ?? '방 입장에 실패했습니다.' });
    }
  }, [accessToken, user]);

  // ── 취소 ─────────────────────────────────────────────────
  const handleCancel = useCallback(() => {
    const roomId = battleState.roomId;
    if (roomId) {
      const storedInfo = getStoredAbJoinInfo();
      cancelAppleBattle(roomId, {
        guestToken: storedInfo?.guestToken ?? null,
        accessToken: accessToken ?? null,
      });
    }
    ws.sendLeave();
    clearAbJoinInfo();
    navigate('/');
  }, [ws, navigate, battleState.roomId, accessToken]);

  // ── 재대결 ────────────────────────────────────────────────
  const handleRematch = useCallback(() => {
    dispatchBattle({ type: 'MY_REMATCH_SENT' });
    ws.sendRematch();
  }, [ws]);

  // ── 게임 내 사과 제거 (낙관적 업데이트) ─────────────────
  const handleRemove = useCallback((cells: { r: number; c: number }[]) => {
    // 1. 로컬 즉시 반영
    removeApples(cells);
    // 2. 서버 전송
    ws.sendRemove(cells.map(({ r, c }) => [r, c] as [number, number]));
  }, [removeApples, ws]);

  // ── 재연결 배너 ───────────────────────────────────────────
  const renderReconnectBanner = () => wsStatus === 'reconnecting' ? (
    <div className={styles.reconnectBanner}>재연결 시도 중...</div>
  ) : null;

  // ── 렌더 ──────────────────────────────────────────────────

  // 방 선택 화면 (idle 진입 전)
  if (showSelectScreen) {
    return (
      <div className={styles.battlePage}>
        <NormalHeader currentGame="apple" gameName="사과게임 배틀" accentColor="#f18064" />
        <div className={styles.battleContent}>
          <div className={styles.selectScreen}>
            <h2 className={styles.selectTitle}>사과게임 배틀</h2>
            <p className={styles.selectSub}>합이 10이 되는 사과를 더 많이 없애세요!</p>
            {!browseMode ? (
              <div className={styles.selectOptions}>
                <button
                  className={styles.btnPrimary}
                  onClick={() => { void startJoin(); }}
                  type="button"
                >
                  자동 매칭
                </button>
                <button
                  className={styles.btnPrimary}
                  onClick={() => { void startCreate(); }}
                  type="button"
                >
                  방 만들기
                </button>
                <button
                  className={styles.btnSecondary}
                  onClick={() => { setBrowseMode(true); void loadWaitingRooms(); }}
                  type="button"
                >
                  방 입장
                </button>
                <button
                  className={styles.btnSecondary}
                  onClick={() => navigate('/')}
                  type="button"
                >
                  홈으로
                </button>
              </div>
            ) : (
              <div className={styles.roomList}>
                <div className={styles.roomListHeader}>
                  <button className={styles.btnSecondary} onClick={() => setBrowseMode(false)} type="button">
                    뒤로
                  </button>
                  <button className={styles.btnSecondary} onClick={() => void loadWaitingRooms()} disabled={roomsLoading} type="button">
                    새로고침
                  </button>
                </div>
                {roomsLoading ? (
                  <div className={styles.spinner} role="status" aria-label="불러오는 중" />
                ) : waitingRooms.length === 0 ? (
                  <p className={styles.roomListEmpty}>현재 대기 중인 방이 없습니다</p>
                ) : (
                  <ul className={styles.roomListItems}>
                    {waitingRooms.map(room => (
                      <li key={room.roomId} className={styles.roomItem}>
                        <span className={styles.roomHost}>{room.hostNickname ?? '익명'}</span>
                        <span className={styles.roomCount}>{room.currentPlayers}/{room.maxPlayers}명</span>
                        <button
                          className={styles.btnPrimary}
                          style={{ padding: '6px 14px', fontSize: 13 }}
                          onClick={() => { void startJoinRoom(room.roomId); }}
                          type="button"
                        >
                          입장
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 에러 화면
  if (battleState.phase === 'idle' && battleState.errorMessage) {
    return (
      <div className={styles.battlePage}>
        <NormalHeader currentGame="apple" gameName="사과게임 배틀" accentColor="#f18064" />
        <div className={styles.battleContent}>
          <div className={styles.errorScreen}>
            <div className={styles.errorTitle}>오류가 발생했습니다</div>
            <div className={styles.errorMsg}>{battleState.errorMessage}</div>
            <div className={styles.errorBtns}>
              <button
                className={styles.btnPrimary}
                onClick={() => { void startJoin(); }}
                type="button"
              >
                다시 시도
              </button>
              <button
                className={styles.btnSecondary}
                onClick={() => navigate('/')}
                type="button"
              >
                홈으로
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 로딩 (idle)
  if (battleState.phase === 'idle') {
    return (
      <div className={styles.battlePage}>
        <NormalHeader currentGame="apple" gameName="사과게임 배틀" accentColor="#f18064" />
        <div className={styles.battleContent}>
          <div className={styles.loadingScreen}>
            <div className={styles.spinner} role="status" aria-label="매칭 중" />
            <div className={styles.loadingText}>매칭 중...</div>
          </div>
        </div>
      </div>
    );
  }

  // 대기 화면
  if (battleState.phase === 'waiting') {
    return (
      <div className={styles.battlePage}>
        <NormalHeader currentGame="apple" gameName="사과게임 배틀" accentColor="#f18064" />
        {renderReconnectBanner()}
        <div className={styles.battleContent}>
          <AppleBattleWaiting
            opponentNickname={null}
            onCancel={handleCancel}
            connectionStatus={wsStatus}
          />
        </div>
      </div>
    );
  }

  // 카운트다운 오버레이 (matched 단계)
  if (battleState.phase === 'matched') {
    return (
      <div className={styles.battlePage}>
        <NormalHeader currentGame="apple" gameName="사과게임 배틀" accentColor="#f18064" />
        <div className={styles.battleContent}>
          <div style={{ color: '#2c3e50', fontSize: 16, fontWeight: 'bold' }}>
            {battleState.opponentInfo?.nickname ?? '상대'}님과 매칭되었습니다!
          </div>
        </div>
        <div className={styles.countdownOverlay}>
          <div className={styles.countdownLabel}>게임 시작까지</div>
          <div className={styles.countdownNumber}>
            {battleState.countdownSec}
          </div>
          <div className={styles.countdownLabel}>
            {battleState.myNickname ?? '나'} vs {battleState.opponentInfo?.nickname ?? '상대'}
          </div>
        </div>
      </div>
    );
  }

  // 게임 진행 + 결과 (playing / finished)
  if (battleState.phase === 'playing' || battleState.phase === 'finished') {
    const board = gameState.apples as (number | null)[][];
    const myNickname = battleState.myNickname ?? '나';
    const opponentNickname = battleState.opponentInfo?.nickname ?? '상대';
    const players: AbPlayerInfo[] = [
      { playerId: battleState.myPlayerId ?? '', nickname: myNickname, isGuest: false },
      ...(battleState.opponentInfo ? [battleState.opponentInfo] : []),
    ];

    return (
      <div className={styles.battlePage}>
        <NormalHeader currentGame="apple" gameName="사과게임 배틀" accentColor="#f18064" />
        {renderReconnectBanner()}
        <div className={styles.battleContent} style={{ justifyContent: 'flex-start', paddingTop: 12 }}>
          <AppleBattleGameView
            myNickname={myNickname}
            opponentNickname={opponentNickname}
            myScore={battleState.myScore}
            opponentScore={battleState.opponentScore}
            timeLeft={gameState.timeLeft}
            reconnecting={wsStatus === 'reconnecting'}
            opponentDisconnected={opponentDisconnected}
            board={board.length ? board : (battleState.board ?? [])}
            onRemove={handleRemove}
          />
        </div>
        {battleState.phase === 'finished' && battleState.result && (
          <AppleBattleResult
            result={battleState.result}
            myPlayerId={battleState.myPlayerId ?? ''}
            players={players}
            onRematch={handleRematch}
            onExit={() => {
              ws.sendLeave();
              clearAbJoinInfo();
              navigate('/apple');
            }}
            myRematchRequested={battleState.myRematchRequested}
            opponentRematchRequested={battleState.opponentRematchRequested}
          />
        )}
      </div>
    );
  }

  // 기본: 로딩
  return (
    <div className={styles.battlePage}>
      <NormalHeader currentGame="apple" gameName="사과게임 배틀" accentColor="#f18064" />
      <div className={styles.battleContent}>
        <div className={styles.loadingScreen}>
          <div className={styles.spinner} role="status" />
          <div className={styles.loadingText}>로딩 중...</div>
        </div>
      </div>
    </div>
  );
}
