import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import NormalHeader from '../../components/normal/NormalHeader';
import { useYachtGame } from './hooks/useYachtGame';
import YachtWaitingRoom from './components/YachtWaitingRoom';
import YachtGameScreen from './components/YachtGameScreen';
import YachtGameOverModal from './components/YachtGameOverModal';
import YachtResultScreen from './components/YachtResultScreen';
import styles from './components/yacht.module.css';

export default function YachtPage() {
  const navigate = useNavigate();
  const {
    phase,
    participants,
    hostUserId,
    currentTurnUserId,
    dice,
    keptIndices,
    rollsLeft,
    playerScores,
    rankings,
    gameOverData,
    myUserId,
    isMyTurn,
    isSpectator,
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
  } = useYachtGame();

  const startedRef = useRef(false);

  // 페이지 마운트 시 매칭 시작 (1회만)
  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      void startMatch();
    }
    // startMatch는 useCallback — 의도적으로 빈 배열
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.title = 'Yacht — DobakGgun Games';
  }, []);

  // 에러 화면
  if (phase === 'error') {
    return (
      <div className={styles.page}>
        <div className={styles.errorScreen}>
          <span className={styles.errorIcon} aria-hidden="true">!</span>
          <p className={styles.errorTitle}>연결 오류가 발생했습니다</p>
          {errorMessage && (
            <p className={styles.errorMessage}>{errorMessage}</p>
          )}
          <div className={styles.errorBtns}>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => {
                dismissError();
                void startMatch();
              }}
            >
              다시 시도
            </button>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => navigate('/')}
            >
              홈으로
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 로딩/매칭/연결 중
  if (phase === 'idle' || phase === 'matching' || phase === 'connecting') {
    return (
      <>
        {wsStatus === 'reconnecting' && (
          <div className={styles.reconnectBanner} role="status" aria-live="polite">
            연결이 불안정합니다. 재연결 시도 중...
          </div>
        )}
        <div className={styles.loadingScreen}>
          <div className={styles.spinner} aria-hidden="true" />
          <p className={styles.loadingTitle}>
            {phase === 'matching' ? '매칭 중...' : '연결 중...'}
          </p>
          <p className={styles.loadingSub}>잠시만 기다려주세요</p>
        </div>
        {toastMessage && (
          <div
            className={`${styles.toast} ${styles.toastInfo}`}
            role="alert"
            aria-live="assertive"
            onClick={dismissToast}
          >
            {toastMessage}
          </div>
        )}
      </>
    );
  }

  // 대기 화면
  if (phase === 'waiting') {
    return (
      <div className={styles.page}>
        {wsStatus === 'reconnecting' && (
          <div className={styles.reconnectBanner} role="status" aria-live="polite">
            연결이 불안정합니다. 재연결 시도 중...
          </div>
        )}
        <NormalHeader currentGame="yacht" gameName="야추" accentColor="#1a5c43" />
        <YachtWaitingRoom
          participants={participants}
          maxPlayers={6}
          myUserId={myUserId}
          hostUserId={hostUserId}
          onReady={readyToggle}
          onStart={startGame}
          onLeave={leave}
        />
        {toastMessage && (
          <div
            className={`${styles.toast} ${styles.toastWarn}`}
            role="alert"
            aria-live="assertive"
            onClick={dismissToast}
          >
            {toastMessage}
          </div>
        )}
      </div>
    );
  }

  // 게임 화면
  if (phase === 'playing') {
    return (
      <div className={styles.page}>
        {wsStatus === 'reconnecting' && (
          <div className={styles.reconnectBanner} role="status" aria-live="polite">
            연결이 불안정합니다. 재연결 시도 중...
          </div>
        )}
        <YachtGameScreen
          participants={participants}
          playerScores={playerScores}
          currentTurnUserId={currentTurnUserId}
          myUserId={myUserId}
          dice={dice}
          keptIndices={keptIndices}
          rollsLeft={rollsLeft}
          isMyTurn={isMyTurn}
          isSpectator={isSpectator}
          isRolling={isRolling}
          roundNum={roundNum}
          onToggleKeep={toggleKeep}
          onRoll={rollDice}
          onSelectScore={recordScore}
          onLeave={leave}
        />
        {gameOverData && (
          <YachtGameOverModal
            rankings={rankings}
            participants={participants}
            myUserId={myUserId}
            hostUserId={hostUserId}
            isSpectator={isSpectator}
            onReady={readyToggle}
            onRestart={startGame}
            onLeave={leave}
          />
        )}
        {toastMessage && (
          <div
            className={`${styles.toast} ${styles.toastWarn}`}
            role="alert"
            aria-live="assertive"
            onClick={dismissToast}
          >
            {toastMessage}
          </div>
        )}
      </div>
    );
  }

  // 결과 화면
  if (phase === 'result') {
    return (
      <div className={styles.page}>
        <NormalHeader currentGame="yacht" gameName="야추" accentColor="#1a5c43" />
        <YachtResultScreen
          rankings={rankings}
          myUserId={myUserId}
          isSpectator={isSpectator}
          onLeave={leave}
        />
        {toastMessage && (
          <div
            className={`${styles.toast} ${styles.toastWarn}`}
            role="alert"
            aria-live="assertive"
            onClick={dismissToast}
          >
            {toastMessage}
          </div>
        )}
      </div>
    );
  }

  // fallback
  return (
    <div className={styles.loadingScreen}>
      <div className={styles.spinner} aria-hidden="true" />
      <p className={styles.loadingTitle}>준비 중...</p>
    </div>
  );
}
