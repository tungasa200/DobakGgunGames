import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import NormalHeader from '../../components/normal/NormalHeader';
import { useYachtBotGame } from './hooks/useYachtBotGame';
import YachtBotWaitingRoom from './components/YachtBotWaitingRoom';
import YachtGameScreen from '../yacht/components/YachtGameScreen';
import YachtGameOverModal from '../yacht/components/YachtGameOverModal';
import YachtResultScreen from '../yacht/components/YachtResultScreen';
import YachtModeCard from '../yacht/components/YachtModeCard';
import type { DiceType } from '../yacht/types/yacht.types';
import styles from '../yacht/components/yacht.module.css';

const ACCENT_BY_DICE_TYPE: Record<DiceType, string> = {
  D6: '#4f6cd8',
  D8: '#d86a4f',
};

export default function YachtBotPage() {
  const navigate = useNavigate();
  const [pickedMode, setPickedMode] = useState<DiceType | null>(null);

  const game = useYachtBotGame(pickedMode ?? 'D6');
  const startedRef = useRef(false);

  // 모드 선택 후 한 번만 matchBot 호출
  useEffect(() => {
    if (!pickedMode) return;
    if (startedRef.current) return;
    startedRef.current = true;
    void game.startMatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedMode]);

  useEffect(() => {
    if (pickedMode) {
      document.title = `Yacht Bot ${pickedMode} — DobakGgun Games`;
    } else {
      document.title = 'Yacht vs AI — DobakGgun Games';
    }
  }, [pickedMode]);

  const handlePickMode = useCallback(async (mode: DiceType) => {
    setPickedMode(mode);
  }, []);

  const effectiveDiceType: DiceType = game.diceType ?? pickedMode ?? 'D6';
  const accentColor = ACCENT_BY_DICE_TYPE[effectiveDiceType];

  // ── 모드 선택 화면 ──────────────────────────────────────────────────────────
  if (!pickedMode) {
    return (
      <div className={`${styles.page} ${styles.modeSelectPage}`}>
        <header className={styles.modeSelectHeader}>
          <button
            type="button"
            className={styles.modeSelectBackBtn}
            onClick={() => navigate('/')}
            aria-label="홈으로 돌아가기"
          >
            ← 홈으로
          </button>
          <h1 className={styles.modeSelectHeaderTitle}>Yacht vs AI</h1>
          <div style={{ width: '80px' }} />
        </header>
        <main className={styles.modeSelectScreen}>
          <h2 className={styles.modeSelectTitle}>AI봇과 야추 대결</h2>
          <p className={styles.modeSelectSub}>주사위 모드를 선택해주세요</p>
          <div className={styles.modeCardRow}>
            <YachtModeCard diceType="D6" onSelect={handlePickMode} activeRooms={null} />
            <YachtModeCard diceType="D8" onSelect={handlePickMode} activeRooms={null} />
          </div>
        </main>
      </div>
    );
  }

  // ── 에러 화면 ──────────────────────────────────────────────────────────────
  if (game.phase === 'error') {
    return (
      <div className={styles.page}>
        <div className={styles.errorScreen}>
          <span className={styles.errorIcon} aria-hidden="true">!</span>
          <p className={styles.errorTitle}>연결 오류가 발생했습니다</p>
          {game.errorMessage && <p className={styles.errorMessage}>{game.errorMessage}</p>}
          <div className={styles.errorBtns}>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => {
                game.dismissError();
                startedRef.current = false;
                setPickedMode(null);
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

  // ── 로딩/매칭/연결 중 ──────────────────────────────────────────────────────
  if (game.phase === 'idle' || game.phase === 'matching' || game.phase === 'connecting') {
    return (
      <>
        {game.wsStatus === 'reconnecting' && (
          <div className={styles.reconnectBanner} role="status" aria-live="polite">
            연결이 불안정합니다. 재연결 시도 중...
          </div>
        )}
        <div className={styles.loadingScreen}>
          <div className={styles.spinner} aria-hidden="true" />
          <p className={styles.loadingTitle}>AI봇 방 생성 중...</p>
          <p className={styles.loadingSub}>잠시만 기다려주세요</p>
        </div>
        {game.toastMessage && (
          <div
            className={`${styles.toast} ${styles.toastInfo}`}
            role="alert"
            aria-live="assertive"
            onClick={game.dismissToast}
          >
            {game.toastMessage}
          </div>
        )}
      </>
    );
  }

  // ── 대기 화면 ──────────────────────────────────────────────────────────────
  if (game.phase === 'waiting') {
    return (
      <div className={styles.page}>
        {game.wsStatus === 'reconnecting' && (
          <div className={styles.reconnectBanner} role="status" aria-live="polite">
            연결이 불안정합니다. 재연결 시도 중...
          </div>
        )}
        <NormalHeader
          currentGame="yacht"
          gameName={`Yacht vs AI (${effectiveDiceType})`}
          accentColor={accentColor}
        />
        <YachtBotWaitingRoom
          participants={game.participants}
          myUserId={game.myUserId}
          hostUserId={game.hostUserId}
          onStart={game.startGame}
          onLeave={game.leave}
          diceType={effectiveDiceType}
        />
        {game.toastMessage && (
          <div
            className={`${styles.toast} ${styles.toastWarn}`}
            role="alert"
            aria-live="assertive"
            onClick={game.dismissToast}
          >
            {game.toastMessage}
          </div>
        )}
      </div>
    );
  }

  // ── 게임 화면 ──────────────────────────────────────────────────────────────
  if (game.phase === 'playing') {
    return (
      <div className={styles.page}>
        {game.wsStatus === 'reconnecting' && (
          <div className={styles.reconnectBanner} role="status" aria-live="polite">
            연결이 불안정합니다. 재연결 시도 중...
          </div>
        )}
        <YachtGameScreen
          participants={game.participants}
          playerScores={game.playerScores}
          currentTurnUserId={game.currentTurnUserId}
          myUserId={game.myUserId}
          dice={game.dice}
          keptIndices={game.keptIndices}
          rollsLeft={game.rollsLeft}
          isMyTurn={game.isMyTurn}
          isSpectator={game.isSpectator}
          isRolling={game.isRolling}
          roundNum={game.roundNum}
          reconnectingPlayers={[]}
          kickVoteState={null}
          onToggleKeep={game.toggleKeep}
          onRoll={game.rollDice}
          onSelectScore={game.recordScore}
          onLeave={game.leave}
          onVoteKick={() => {}}
          isBotGame={true}
          chatMessages={[]}
          onSendChat={() => {}}
          diceType={effectiveDiceType}
        />
        {game.gameOverData && (
          <YachtGameOverModal
            rankings={game.rankings}
            participants={game.participants}
            myUserId={game.myUserId}
            hostUserId={game.hostUserId}
            isSpectator={game.isSpectator}
            onReady={game.readyToggle}
            onRestart={game.startGame}
            onLeave={game.leave}
          />
        )}
        {game.toastMessage && (
          <div
            className={`${styles.toast} ${styles.toastWarn}`}
            role="alert"
            aria-live="assertive"
            onClick={game.dismissToast}
          >
            {game.toastMessage}
          </div>
        )}
      </div>
    );
  }

  // ── 결과 화면 ──────────────────────────────────────────────────────────────
  if (game.phase === 'result') {
    return (
      <div className={styles.page}>
        <NormalHeader
          currentGame="yacht"
          gameName={`Yacht vs AI (${effectiveDiceType})`}
          accentColor={accentColor}
        />
        <YachtResultScreen
          rankings={game.rankings}
          myUserId={game.myUserId}
          isSpectator={game.isSpectator}
          onLeave={game.leave}
        />
        {game.toastMessage && (
          <div
            className={`${styles.toast} ${styles.toastWarn}`}
            role="alert"
            aria-live="assertive"
            onClick={game.dismissToast}
          >
            {game.toastMessage}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.loadingScreen}>
      <div className={styles.spinner} aria-hidden="true" />
      <p className={styles.loadingTitle}>준비 중...</p>
    </div>
  );
}
