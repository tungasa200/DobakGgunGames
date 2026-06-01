import { useEffect, useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import {
  joinMinesweeperBattle,
  createMinesweeperBattle,
  joinMinesweeperBattleRoom,
  getMbWaitingRooms,
  saveMbJoinInfo,
  getStoredMbJoinInfo,
  getStoredMbGuestToken,
  clearMbJoinInfo,
} from '../../../api/minesweeperBattle';
import type { MbWaitingRoomInfo, MbDifficulty } from '../../../api/minesweeperBattle';
import { useMinesweeperBattleGame } from './useMinesweeperBattleGame';
import { useMinesweeperBattleSocket } from './useMinesweeperBattleSocket';
import type { MatchReadyPayload, ProgressUpdatePayload, StateSnapshotPayload } from './types';
import MinesweeperBattleWaiting from './MinesweeperBattleWaiting';
import MinesweeperBattleReady from './MinesweeperBattleReady';
import MinesweeperBattleGameView from './MinesweeperBattleGameView';
import MinesweeperBattleResult from './MinesweeperBattleResult';
import NormalHeader from '../../../components/normal/NormalHeader';
import styles from './MinesweeperBattleBoard.module.css';

export default function MinesweeperBattleBoard() {
  const { user, accessToken } = useAuth();
  const navigate = useNavigate();

  const {
    battleState,
    boardState,
    dispatchBattle,
    revealCell,
    toggleMark,
    chordClick,
    handleMatchReady,
    handleGameStarted,
    handleProgress,
    handleGameResult,
    handleStateSnapshot,
    handleOpponentFirstClickConfirmed,
    handleOpponentDisconnected,
    handleOpponentReconnected,
    handleError,
    resetGame,
  } = useMinesweeperBattleGame();

  // WS 연결 상태
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error'>('connecting');

  const [firstClickTimeoutMs, setFirstClickTimeoutMs] = useState(30000);

  const startedRef = useRef(false);

  // ── 방 선택 화면 상태 ────────────────────────────────────
  const [showSelectScreen, setShowSelectScreen] = useState(true);
  const [selectedDifficulty, setSelectedDifficulty] = useState<MbDifficulty>('BEGINNER');
  const [browseMode, setBrowseMode] = useState(false);
  const [waitingRooms, setWaitingRooms] = useState<MbWaitingRoomInfo[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);

  // ── 매칭 참가 ──────────────────────────────────────────────
  const startJoin = useCallback(async () => {
    setShowSelectScreen(false);
    const storedToken = getStoredMbGuestToken();

    try {
      const res = await joinMinesweeperBattle({
        accessToken,
        guestToken: storedToken ?? undefined,
        difficulty: selectedDifficulty,
      });

      saveMbJoinInfo({
        roomId: res.roomId,
        playerId: res.playerId,
        isGuest: res.isGuest,
        guestToken: res.guestToken,
      });

      const nickname = res.isGuest
        ? '손님'
        : (user?.nickname ?? '나');

      dispatchBattle({
        type: 'JOIN_REQUESTED',
        roomId: res.roomId,
        playerId: res.playerId,
        nickname,
      });

      // MATCH_READY 상태면 즉시 ready 단계 진입 (2번째 플레이어가 join한 경우)
      // WS 연결 후 서버가 MATCH_READY 이벤트를 발송하므로 별도 처리 불필요

    } catch (err) {
      const e = err as Error & { code?: string };

      if (e.code === 'ALREADY_IN_ROOM') {
        // 새로고침 등으로 인한 재진입 → 저장된 joinInfo로 WS 재연결
        const stored = getStoredMbJoinInfo();
        if (stored) {
          const nickname = user?.nickname ?? '나';
          dispatchBattle({
            type: 'JOIN_REQUESTED',
            roomId: stored.roomId,
            playerId: stored.playerId,
            nickname,
          });
          return;
        }
      }

      dispatchBattle({
        type: 'ERROR',
        message: e.message ?? '배틀 참가에 실패했습니다.',
      });
    }
  }, [accessToken, user, dispatchBattle, selectedDifficulty]);

  // ── 대기 방 목록 로드 ────────────────────────────────────
  const loadWaitingRooms = useCallback(async () => {
    setRoomsLoading(true);
    const rooms = await getMbWaitingRooms();
    setWaitingRooms(rooms);
    setRoomsLoading(false);
  }, []);

  // ── 방 만들기 ─────────────────────────────────────────────
  const startCreate = useCallback(async () => {
    setShowSelectScreen(false);
    const storedToken = getStoredMbGuestToken();
    try {
      const res = await createMinesweeperBattle({
        accessToken,
        guestToken: storedToken ?? undefined,
        difficulty: selectedDifficulty,
      });
      saveMbJoinInfo({
        roomId: res.roomId,
        playerId: res.playerId,
        isGuest: res.isGuest,
        guestToken: res.guestToken,
      });
      const nickname = res.isGuest ? '손님' : (user?.nickname ?? '나');
      dispatchBattle({ type: 'JOIN_REQUESTED', roomId: res.roomId, playerId: res.playerId, nickname });
    } catch (err) {
      const e = err as Error & { code?: string };
      if (e.code === 'ALREADY_IN_ROOM') {
        const stored = getStoredMbJoinInfo();
        if (stored) {
          const nickname = user?.nickname ?? '나';
          dispatchBattle({ type: 'JOIN_REQUESTED', roomId: stored.roomId, playerId: stored.playerId, nickname });
          return;
        }
      }
      dispatchBattle({ type: 'ERROR', message: e.message ?? '방 생성에 실패했습니다.' });
    }
  }, [accessToken, user, dispatchBattle, selectedDifficulty]);

  // ── 특정 방 입장 ──────────────────────────────────────────
  const startJoinRoom = useCallback(async (roomId: string) => {
    setShowSelectScreen(false);
    const storedToken = getStoredMbGuestToken();
    try {
      const res = await joinMinesweeperBattleRoom(roomId, {
        accessToken,
        guestToken: storedToken ?? undefined,
      });
      saveMbJoinInfo({
        roomId: res.roomId,
        playerId: res.playerId,
        isGuest: res.isGuest,
        guestToken: res.guestToken,
      });
      const nickname = res.isGuest ? '손님' : (user?.nickname ?? '나');
      dispatchBattle({ type: 'JOIN_REQUESTED', roomId: res.roomId, playerId: res.playerId, nickname });
    } catch (err) {
      const e = err as Error & { code?: string };
      if (e.code === 'ALREADY_IN_ROOM') {
        const stored = getStoredMbJoinInfo();
        if (stored) {
          const nickname = user?.nickname ?? '나';
          dispatchBattle({ type: 'JOIN_REQUESTED', roomId: stored.roomId, playerId: stored.playerId, nickname });
          return;
        }
      }
      dispatchBattle({ type: 'ERROR', message: e.message ?? '방 입장에 실패했습니다.' });
    }
  }, [accessToken, user, dispatchBattle]);

  // 페이지 타이틀
  useEffect(() => {
    document.title = '지뢰찾기 배틀 | DobakGgun';
    return () => { document.title = '도박꾼게임즈'; };
  }, []);

  // ── WebSocket 활성화 조건 ─────────────────────────────────
  const wsEnabled = battleState.roomId !== null && (
    battleState.phase === 'waiting' ||
    battleState.phase === 'ready' ||
    battleState.phase === 'playing' ||
    battleState.phase === 'finished'
  );

  // ── authParam 계산 ─────────────────────────────────────────
  // battleState에서 직접 추적하는 playerId 기반으로 저장 정보 확인
  const stored = getStoredMbJoinInfo();
  const authParam = stored?.isGuest
    ? (stored.guestToken ?? accessToken ?? '')
    : (accessToken ?? '');

  // stable 핸들러 ref — ws hook에 인라인 함수 대신 ref 기반 핸들러 전달 (stale closure 방지)
  const myPlayerIdRef = useRef(battleState.myPlayerId);
  useEffect(() => { myPlayerIdRef.current = battleState.myPlayerId; }, [battleState.myPlayerId]);

  const onMatchReadyStable = useCallback((payload: MatchReadyPayload) => {
    setFirstClickTimeoutMs(payload.firstClickTimeoutMs);
    handleMatchReady(payload, myPlayerIdRef.current ?? '');
  }, [handleMatchReady]);

  const onProgressStable = useCallback((payload: ProgressUpdatePayload) => {
    handleProgress(payload, myPlayerIdRef.current ?? '');
  }, [handleProgress]);

  const onStateSnapshotStable = useCallback((payload: StateSnapshotPayload) => {
    handleStateSnapshot(payload, myPlayerIdRef.current ?? '');
  }, [handleStateSnapshot]);

  const ws = useMinesweeperBattleSocket({
    roomId: battleState.roomId,
    playerId: battleState.myPlayerId,
    authParam: wsEnabled ? authParam : null,
    enabled: wsEnabled,
    onMatchReady: onMatchReadyStable,
    onGameStarted: handleGameStarted,
    onProgress: onProgressStable,
    onGameResult: handleGameResult,
    onStateSnapshot: onStateSnapshotStable,
    onOpponentFirstClickConfirmed: handleOpponentFirstClickConfirmed,
    onOpponentDisconnected: handleOpponentDisconnected,
    onOpponentReconnected: handleOpponentReconnected,
    onError: handleError,
    onStatusChange: setWsStatus,
  });

  // ── 게임 이벤트 핸들러 ────────────────────────────────────

  const handleCellReveal = useCallback((r: number, c: number) => {
    if (battleState.phase !== 'playing') return;
    const result = revealCell(r, c);
    const elapsed = battleState.myElapsedMs;

    if (result.hitMine) {
      ws.sendMineHit(elapsed, r, c);
      return;
    }

    // 진행률 업데이트 전송
    ws.sendProgress(result.newCount);

    // 클리어 체크
    if (result.cleared || result.newCount >= battleState.totalSafeCells) {
      ws.sendBoardClear(elapsed);
    }
  }, [battleState.phase, battleState.myElapsedMs, battleState.totalSafeCells, revealCell, ws]);

  const handleToggleMark = useCallback((r: number, c: number) => {
    if (battleState.phase !== 'playing') return;
    toggleMark(r, c);
  }, [battleState.phase, toggleMark]);

  const handleChord = useCallback((r: number, c: number) => {
    if (battleState.phase !== 'playing') return;
    const result = chordClick(r, c);
    const elapsed = battleState.myElapsedMs;

    if (result.hitMine) {
      ws.sendMineHit(elapsed, r, c);
      return;
    }

    if (result.newCount !== boardState.revealedCount) {
      ws.sendProgress(result.newCount);
    }

    if (result.cleared || result.newCount >= battleState.totalSafeCells) {
      ws.sendBoardClear(elapsed);
    }
  }, [battleState.phase, battleState.myElapsedMs, battleState.totalSafeCells, chordClick, boardState.revealedCount, ws]);

  const handleFirstClick = useCallback(() => {
    dispatchBattle({ type: 'FIRST_CLICK_SENT' });
    ws.sendFirstClick(battleState.designatedCell ?? { r: 4, c: 4 });
  }, [dispatchBattle, ws, battleState.designatedCell]);

  const handleForfeit = useCallback(() => {
    ws.sendLeave();
    clearMbJoinInfo();
    setTimeout(() => navigate('/'), 100);
  }, [ws, navigate]);

  const handleCancel = useCallback(() => {
    ws.sendLeave();
    clearMbJoinInfo();
    navigate('/');
  }, [ws, navigate]);

  const handlePlayAgain = useCallback(() => {
    clearMbJoinInfo();
    resetGame();
    startedRef.current = false;
    setShowSelectScreen(true);
    setBrowseMode(false);
    setWaitingRooms([]);
  }, [resetGame]);

  // ── 렌더 ──────────────────────────────────────────────────

  const renderReconnectBanner = () => wsStatus === 'reconnecting' ? (
    <div className={styles.reconnectBanner}>
      재연결 시도 중...
    </div>
  ) : null;

  // 로그인 필요 화면
  if (!user) {
    return (
      <div className={styles.battlePage}>
        <NormalHeader currentGame="minesweeper" gameName="지뢰찾기 배틀" accentColor="#3498db" />
        <div className={styles.battleContent}>
          <div className={styles.errorScreen}>
            <div className={styles.errorTitle}>로그인이 필요합니다</div>
            <div className={styles.errorMsg}>지뢰찾기 배틀은 로그인 후 이용할 수 있습니다.</div>
            <div className={styles.errorBtns}>
              <button className={styles.btnPrimary} onClick={() => navigate('/login')} type="button">
                로그인
              </button>
              <button className={styles.btnSecondary} onClick={() => navigate('/games/minesweeper')} type="button">
                나가기
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 방 선택 화면
  if (showSelectScreen) {
    return (
      <div className={styles.battlePage}>
        <NormalHeader currentGame="minesweeper" gameName="지뢰찾기 배틀" accentColor="#3498db" />
        <div className={styles.battleContent}>
          <div className={styles.selectScreen}>
            <h2 className={styles.selectTitle}>지뢰찾기 배틀</h2>
            <p className={styles.selectSub}>플레이 방식을 선택하세요</p>
            <div className={styles.difficultyGroup}>
              <button
                className={`${styles.difficultyBtn} ${selectedDifficulty === 'BEGINNER' ? styles.difficultyBtnActive : ''}`}
                onClick={() => setSelectedDifficulty('BEGINNER')}
                type="button"
              >
                초급<br /><span style={{ fontSize: 11, fontWeight: 'normal' }}>9×9 · 지뢰 10개</span>
              </button>
              <button
                className={`${styles.difficultyBtn} ${selectedDifficulty === 'INTERMEDIATE' ? styles.difficultyBtnActive : ''}`}
                onClick={() => setSelectedDifficulty('INTERMEDIATE')}
                type="button"
              >
                중급<br /><span style={{ fontSize: 11, fontWeight: 'normal' }}>16×16 · 지뢰 40개</span>
              </button>
            </div>
            {!browseMode ? (
              <div className={styles.selectOptions}>
                <button
                  className={styles.btnPrimary}
                  onClick={() => { startedRef.current = false; void startJoin(); }}
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
                    ← 뒤로
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
                        <span className={styles.roomCount}>{room.difficulty === 'INTERMEDIATE' ? '중급' : '초급'}</span>
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
        <NormalHeader currentGame="minesweeper" gameName="지뢰찾기 배틀" accentColor="#3498db" />
        <div className={styles.battleContent}>
          <div className={styles.errorScreen}>
            <div className={styles.errorTitle}>오류가 발생했습니다</div>
            <div className={styles.errorMsg}>{battleState.errorMessage}</div>
            <div className={styles.errorBtns}>
              <button
                className={styles.btnPrimary}
                onClick={() => { startedRef.current = false; void startJoin(); }}
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

  // 로딩 (idle: 매칭 요청 전)
  if (battleState.phase === 'idle') {
    return (
      <div className={styles.battlePage}>
        <NormalHeader currentGame="minesweeper" gameName="지뢰찾기 배틀" accentColor="#3498db" />
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
        <NormalHeader currentGame="minesweeper" gameName="지뢰찾기 배틀" accentColor="#3498db" />
        {renderReconnectBanner()}
        <div className={styles.battleContent}>
          <MinesweeperBattleWaiting
            myNickname={battleState.myNickname}
            onCancel={handleCancel}
          />
        </div>
      </div>
    );
  }

  // 준비 화면
  if (battleState.phase === 'ready') {
    return (
      <div className={styles.battlePage}>
        <NormalHeader currentGame="minesweeper" gameName="지뢰찾기 배틀" accentColor="#3498db" />
        {renderReconnectBanner()}
        <div className={styles.battleContent}>
          <MinesweeperBattleReady
            opponentNickname={battleState.opponentNickname}
            myNickname={battleState.myNickname}
            designatedCell={battleState.designatedCell ?? { r: 4, c: 4 }}
            myFirstClickConfirmed={battleState.myFirstClickConfirmed}
            opponentFirstClickConfirmed={battleState.opponentFirstClickConfirmed}
            firstClickTimeoutMs={firstClickTimeoutMs}
            onFirstClick={handleFirstClick}
            onLeave={handleCancel}
          />
        </div>
      </div>
    );
  }

  // 게임 진행 화면 + 결과 모달 (finished 시 보드 위에 오버레이)
  if (battleState.phase === 'playing' || battleState.phase === 'finished') {
    return (
      <div className={styles.battlePage}>
        <NormalHeader currentGame="minesweeper" gameName="지뢰찾기 배틀" accentColor="#3498db" />
        {renderReconnectBanner()}
        <div className={styles.battleContent} style={{ justifyContent: 'flex-start', paddingTop: 16 }}>
          <MinesweeperBattleGameView
            board={boardState.board}
            rows={battleState.rows}
            cols={battleState.cols}
            totalSafe={battleState.totalSafeCells}
            elapsedMs={battleState.myElapsedMs}
            revealedCount={boardState.revealedCount}
            myNickname={battleState.myNickname}
            opponentNickname={battleState.opponentNickname}
            opponentProgressPercent={battleState.opponentProgress.progressPercent}
            opponentRevealedCount={battleState.opponentProgress.revealedCount}
            opponentReconnecting={battleState.reconnecting}
            onReveal={handleCellReveal}
            onToggleMark={handleToggleMark}
            onChord={handleChord}
            onForfeit={handleForfeit}
          />
        </div>
        {battleState.phase === 'finished' && battleState.result && (
          <MinesweeperBattleResult
            result={battleState.result}
            myPlayerId={battleState.myPlayerId}
            onPlayAgain={handlePlayAgain}
            onLeave={() => { clearMbJoinInfo(); navigate('/games/minesweeper'); }}
          />
        )}
      </div>
    );
  }

  // 기본: 로딩
  return (
    <div className={styles.battlePage}>
      <NormalHeader currentGame="minesweeper" gameName="지뢰찾기 배틀" accentColor="#3498db" />
      <div className={styles.battleContent}>
        <div className={styles.loadingScreen}>
          <div className={styles.spinner} role="status" />
          <div className={styles.loadingText}>로딩 중...</div>
        </div>
      </div>
    </div>
  );
}
