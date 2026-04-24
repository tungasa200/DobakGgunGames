import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRpsGame } from '../games/online-rps/hooks/useRpsGame';
import WaitingScreen from '../games/online-rps/components/WaitingScreen';
import GameScreen from '../games/online-rps/components/GameScreen';
import ResultScreen from '../games/online-rps/components/ResultScreen';
import styles from '../games/online-rps/components/RpsScreens.module.css';

// 최대 카운트다운 값 (대기 화면에서 서버가 보내는 최초 secondsRemaining)
const MATCH_COUNTDOWN_MAX = 5;

export default function OnlineRpsPage() {
  const navigate = useNavigate();
  const {
    phase,
    room,
    countdown,
    gameDeadline,
    myUserId,
    myChoice,
    chosenUserIds,
    roundResult,
    errorMessage,
    wsStatus,
    toastMessage,
    startMatch,
    choose,
    leave,
    dismissError,
    dismissToast,
  } = useRpsGame();

  const startedRef = useRef(false);

  // 페이지 마운트 시 매칭 시작 (1회만)
  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      void startMatch();
    }
  // startMatch는 useCallback이지만 deps에 포함하면 재실행 위험 — 의도적으로 빈 배열
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  document.title = 'Online RPS';

  // 에러 화면
  if (phase === 'error') {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <button
            className={styles.headerBack}
            onClick={() => navigate('/')}
            type="button"
          >
            ← 홈으로
          </button>
          <span className={styles.headerTitle}>Online RPS</span>
          <span />
        </header>
        <div className={styles.errorScreen}>
          <span className={styles.errorIcon}>⚠</span>
          <p className={styles.errorTitle}>연결 오류가 발생했습니다</p>
          {errorMessage && (
            <p className={styles.errorMessage}>{errorMessage}</p>
          )}
          <div className={styles.errorBtns}>
            <button
              className={styles.btnPrimary}
              onClick={() => {
                dismissError();
                void startMatch();
              }}
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
    );
  }

  // 로딩/매칭/연결 중
  if (phase === 'idle' || phase === 'matching' || phase === 'connecting') {
    return (
      <>
        {wsStatus === 'reconnecting' && (
          <div className={styles.reconnectBanner}>
            ⚠ 연결이 불안정합니다. 재연결 시도 중...
          </div>
        )}
        <div className={styles.loadingScreen}>
          <div className={styles.spinner} />
          <p className={styles.loadingTitle}>
            {phase === 'matching' ? '매칭 중...' : '연결 중...'}
          </p>
          <p className={styles.loadingSub}>잠시만 기다려주세요</p>
        </div>
        {/* 토스트 (409 ALREADY_IN_ROOM 등) */}
        {toastMessage && (
          <div
            className={`${styles.toast} ${styles.toastInfo}`}
            role="alert"
            aria-live="assertive"
            onClick={dismissToast}
          >
            ℹ {toastMessage}
          </div>
        )}
      </>
    );
  }

  // 대기/카운트다운 화면
  if ((phase === 'waiting' || phase === 'countdown') && room) {
    return (
      <div className={styles.page}>
        {wsStatus === 'reconnecting' && (
          <div className={styles.reconnectBanner}>
            ⚠ 연결이 불안정합니다. 재연결 시도 중...
          </div>
        )}
        <WaitingScreen
          participants={room.participants}
          countdown={phase === 'countdown' ? countdown : null}
          maxPlayers={room.maxPlayers}
          myUserId={myUserId}
          onLeave={leave}
        />
        {toastMessage && (
          <div
            className={`${styles.toast} ${styles.toastWarn}`}
            role="alert"
            aria-live="assertive"
            onClick={dismissToast}
          >
            🔌 {toastMessage}
          </div>
        )}
      </div>
    );
  }

  // 게임 화면
  if (phase === 'playing' && room && gameDeadline) {
    return (
      <>
        {wsStatus === 'reconnecting' && (
          <div className={styles.reconnectBanner}>
            ⚠ 연결이 불안정합니다. 재연결 시도 중...
          </div>
        )}
        <GameScreen
          participants={room.participants}
          myUserId={myUserId}
          myChoice={myChoice}
          deadlineAt={gameDeadline}
          timeoutSeconds={10}
          chosenUserIds={chosenUserIds}
          onChoose={choose}
          onLeave={leave}
        />
        {toastMessage && (
          <div
            className={`${styles.toast} ${styles.toastWarn}`}
            role="alert"
            aria-live="assertive"
            onClick={dismissToast}
          >
            🔌 {toastMessage}
          </div>
        )}
      </>
    );
  }

  // 결과 화면
  if (phase === 'result' && roundResult) {
    return (
      <>
        <ResultScreen
          roundResult={roundResult}
          myUserId={myUserId}
          countdown={phase === 'result' && countdown > 0 ? countdown : null}
          maxCountdown={MATCH_COUNTDOWN_MAX}
          onLeave={leave}
        />
        {toastMessage && (
          <div
            className={`${styles.toast} ${styles.toastWarn}`}
            role="alert"
            aria-live="assertive"
            onClick={dismissToast}
          >
            🔌 {toastMessage}
          </div>
        )}
      </>
    );
  }

  // fallback
  return (
    <div className={styles.loadingScreen}>
      <div className={styles.spinner} />
      <p className={styles.loadingTitle}>준비 중...</p>
    </div>
  );
}
