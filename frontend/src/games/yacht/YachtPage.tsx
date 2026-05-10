import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import NormalHeader from '../../components/normal/NormalHeader';
import { useYachtGame } from './hooks/useYachtGame';
import YachtWaitingRoom from './components/YachtWaitingRoom';
import YachtGameScreen from './components/YachtGameScreen';
import YachtGameOverModal from './components/YachtGameOverModal';
import YachtResultScreen from './components/YachtResultScreen';
import type { DiceType } from './types/yacht.types';
import styles from './components/yacht.module.css';

function parseDiceType(raw: string | null): DiceType | null {
  if (raw === 'D6' || raw === 'D8') return raw;
  return null;
}

const ACCENT_BY_DICE_TYPE: Record<DiceType, string> = {
  D6: '#4f6cd8',
  D8: '#d86a4f',
};

export default function YachtPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  // URL ?mode= 또는 location.state.diceType 에서 diceType 결정
  const modeParam = parseDiceType(searchParams.get('mode'));
  const stateType = parseDiceType(
    (location.state as { diceType?: string } | null)?.diceType ?? null,
  );
  const resolvedDiceType: DiceType | null = modeParam ?? stateType;

  // diceType이 없거나 잘못된 경우 → select 화면으로 리다이렉트
  useEffect(() => {
    if (!resolvedDiceType) {
      navigate('/yacht/select', { replace: true });
    }
  }, [resolvedDiceType, navigate]);

  const diceType: DiceType = resolvedDiceType ?? 'D6';
  const accentColor = ACCENT_BY_DICE_TYPE[diceType];

  // YachtSelectPage에서 이미 매칭을 완료하고 roomId + diceType을 state로 넘겨줌
  // → useYachtGame은 initialDiceType만 받고, startMatch를 자동 호출
  const {
    phase,
    diceType: gameDiceType,
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
    reconnectingPlayers,
    kickVoteState,
    startMatch,
    toggleKeep,
    rollDice,
    recordScore,
    readyToggle,
    startGame,
    leave,
    dismissError,
    dismissToast,
    voteKick,
    chatMessages,
    sendChat,
  } = useYachtGame(diceType);

  const startedRef = useRef(false);

  // 페이지 마운트 시 매칭 시작 (1회만)
  // YachtSelectPage에서 이미 postYachtMatch를 호출했으므로,
  // 여기서는 useYachtGame이 ALREADY_IN_ROOM으로 기존 방을 찾아 들어가게 됨
  useEffect(() => {
    if (!resolvedDiceType) return; // 리다이렉트 대기 중
    if (!startedRef.current) {
      startedRef.current = true;
      void startMatch();
    }
    // startMatch는 useCallback — 의도적으로 빈 배열
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedDiceType]);

  useEffect(() => {
    document.title = `Yacht ${diceType} — DobakGgun Games`;
  }, [diceType]);

  // 유효하지 않은 mode → 리다이렉트 중 (빈 화면)
  if (!resolvedDiceType) {
    return null;
  }

  // 실제 게임에서 확정된 diceType (서버 응답 기반)
  const effectiveDiceType: DiceType = gameDiceType ?? diceType;

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
              onClick={() => navigate('/yacht/select')}
            >
              모드 선택으로
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
            {phase === 'matching' ? `${diceType} 매칭 중...` : '연결 중...'}
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
        <NormalHeader
          currentGame="yacht"
          gameName={`Yacht ${effectiveDiceType}`}
          accentColor={accentColor}
        />
        <YachtWaitingRoom
          participants={participants}
          maxPlayers={6}
          myUserId={myUserId}
          hostUserId={hostUserId}
          onReady={readyToggle}
          onStart={startGame}
          onLeave={leave}
          chatMessages={chatMessages}
          onSendChat={sendChat}
          diceType={effectiveDiceType}
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
          reconnectingPlayers={reconnectingPlayers}
          kickVoteState={kickVoteState}
          onToggleKeep={toggleKeep}
          onRoll={rollDice}
          onSelectScore={recordScore}
          onLeave={leave}
          onVoteKick={voteKick}
          chatMessages={chatMessages}
          onSendChat={sendChat}
          diceType={effectiveDiceType}
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
        <NormalHeader
          currentGame="yacht"
          gameName={`Yacht ${effectiveDiceType}`}
          accentColor={accentColor}
        />
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
