import { useState, useRef, useCallback, useEffect } from 'react';
import styles from './yacht.module.css';
import type { Participant, PlayerScore, ScoreKey, KickVotePayload, DiceType } from '../types/yacht.types';
import { MAX_ROLLS_BY_MODE } from '../types/yacht.types';
import YachtDiceRow3D from './YachtDiceRow3D';
import YachtScoreBoard from './YachtScoreBoard';
import YachtChat from './YachtChat';
import YachtModeBadge from './YachtModeBadge';
import type { ChatMessage } from '../hooks/useYachtGame';

interface YachtGameScreenProps {
  participants: Participant[];
  playerScores: PlayerScore[];
  currentTurnUserId: number | null;
  myUserId: number | null;
  dice: number[];
  keptIndices: number[];
  rollsLeft: number;
  isMyTurn: boolean;
  isSpectator: boolean;
  isRolling: boolean;
  roundNum: number;
  reconnectingPlayers: Array<{ userId: number; nickname: string }>;
  kickVoteState: KickVotePayload | null;
  onToggleKeep: (index: number) => void;
  onRoll: () => void;
  onSelectScore: (key: ScoreKey) => void;
  onLeave: () => void;
  onVoteKick: (targetUserId: number) => void;
  chatMessages: ChatMessage[];
  onSendChat: (message: string) => void;
  diceType?: DiceType;
  isBotGame?: boolean;
}

const SCORE_MIN = 200;
const SCORE_MAX = 640;
const SCORE_DEFAULT = 320;


export default function YachtGameScreen({
  participants,
  playerScores,
  currentTurnUserId,
  myUserId,
  dice,
  keptIndices,
  rollsLeft,
  isMyTurn,
  isSpectator,
  isRolling,
  roundNum,
  reconnectingPlayers,
  kickVoteState,
  onToggleKeep,
  onRoll,
  onSelectScore,
  onLeave,
  onVoteKick,
  chatMessages,
  onSendChat,
  diceType = 'D6',
  isBotGame = false,
}: YachtGameScreenProps) {
  const currentPlayer = participants.find((p) => p.userId === currentTurnUserId);
  const maxRolls = MAX_ROLLS_BY_MODE[diceType];
  const rollsUsed = maxRolls - rollsLeft;
  const isFirstRoll = rollsLeft === maxRolls;
  const hasDice = dice.every((d) => d > 0);

  const [scoreBoardWidth, setScoreBoardWidth] = useState(SCORE_DEFAULT);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const { startX, startWidth } = dragRef.current;
      const next = Math.max(SCORE_MIN, Math.min(SCORE_MAX, startWidth + (startX - e.clientX)));
      setScoreBoardWidth(next);
    };
    const onMouseUp = () => {
      if (dragRef.current) {
        dragRef.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const onDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startWidth: scoreBoardWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [scoreBoardWidth]);

  return (
    <div className={styles.gameScreen}>
      {/* 헤더 */}
      <header className={styles.header}>
        <h1 className={`${styles.headerTitle} ${styles.headerTitleFlex}`}>
          Yacht
          <YachtModeBadge diceType={diceType} />
        </h1>
        <span className={styles.headerSub}>라운드 {roundNum}</span>
        <button
          type="button"
          className={styles.btnDanger}
          onClick={onLeave}
          style={{ padding: '6px 16px', fontSize: '0.82rem' }}
        >
          나가기
        </button>
      </header>

      <div
        className={styles.gameBody}
        style={{ gridTemplateColumns: `1fr 6px ${scoreBoardWidth}px` }}
      >
        {/* 좌측: 주사위 + 조작 */}
        <div className={styles.gameLeft}>
          {/* 재접속 대기 패널 */}
          {reconnectingPlayers.length > 0 && (
            <div className={styles.reconnectingPanel}>
              {reconnectingPlayers.map((rp) => (
                <div key={rp.userId} className={styles.reconnectingItem}>
                  <span className={styles.reconnectingDot} />
                  <span>{rp.nickname}님 재접속 대기 중</span>
                  {myUserId !== rp.userId && currentTurnUserId === rp.userId && (
                    <button
                      type="button"
                      className={styles.btnVoteKick}
                      onClick={() => onVoteKick(rp.userId)}
                    >
                      강퇴 투표
                    </button>
                  )}
                </div>
              ))}
              {kickVoteState && (
                <div className={styles.kickVoteStatus}>
                  {kickVoteState.targetNickname} 강퇴 투표: {kickVoteState.voteCount}/{kickVoteState.requiredCount}
                </div>
              )}
            </div>
          )}

          {/* 관전 안내 배너 */}
          {isSpectator && (
            <div
              role="status"
              aria-live="polite"
              style={{
                background: 'var(--yacht-bg-soft, #fff7e6)',
                color: 'var(--yacht-warn, #b35900)',
                border: '1px solid var(--yacht-warn, #ffb84d)',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '0.85rem',
                textAlign: 'center',
              }}
            >
              관전 중 — 진행 중인 게임에 합류했습니다. 게임 종료까지 시청만 가능합니다.
            </div>
          )}

          {/* 턴 인디케이터 */}
          <div
            className={[
              styles.turnIndicator,
              isMyTurn ? styles.turnIndicatorMyTurn : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <span className={styles.turnLabel}>현재 턴:</span>
            <span
              className={[
                styles.turnNickname,
                isMyTurn ? styles.turnMyTurnText : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {currentPlayer?.nickname ?? '...'}
              {isMyTurn && ' (내 턴)'}
            </span>
            <span
              className={[
                styles.rollsLeftBadge,
                rollsLeft > 0 ? styles.rollsLeftBadgeActive : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              굴림 {rollsLeft}회 남음
            </span>
          </div>

          {/* 주사위 영역 */}
          <div className={styles.diceArea}>
            <YachtDiceRow3D
              dice={dice}
              keptIndices={keptIndices}
              isMyTurn={isMyTurn && !isSpectator}
              isRolling={isRolling}
              onToggleKeep={onToggleKeep}
              diceType={diceType}
            />

            {/* 굴리기 버튼 — 관전자에게는 숨김 */}
            {isMyTurn && !isSpectator && (
              <button
                type="button"
                className={styles.rollBtn}
                onClick={onRoll}
                disabled={rollsLeft <= 0 || isRolling}
                aria-label={
                  rollsLeft <= 0
                    ? '굴림 횟수를 모두 사용했습니다. 족보를 선택하세요.'
                    : `주사위 굴리기 (${rollsLeft}회 남음)`
                }
              >
                {isRolling ? '굴리는 중...' : isFirstRoll ? '굴리기!' : '다시 굴리기'}
              </button>
            )}

            {!isMyTurn && (
              <button
                type="button"
                className={styles.rollBtn}
                disabled
                aria-label={`${currentPlayer?.nickname ?? '상대방'}의 턴입니다`}
              >
                {currentPlayer?.nickname ?? '상대방'}의 턴입니다
              </button>
            )}
          </div>

          {/* 채팅 (봇전 제외) */}
          {!isBotGame && (
            <YachtChat
              messages={chatMessages}
              myUserId={myUserId}
              onSend={onSendChat}
            />
          )}
        </div>

        {/* 드래그 핸들 */}
        <div
          className={styles.resizeDivider}
          onMouseDown={onDividerMouseDown}
          role="separator"
          aria-label="점수판 너비 조절"
        />

        {/* 우측: 점수판 */}
        <div className={styles.gameRight}>
          <YachtScoreBoard
            players={participants}
            playerScores={playerScores}
            currentTurnUserId={currentTurnUserId ?? 0}
            myUserId={myUserId}
            currentDice={hasDice ? dice : null}
            isMyTurn={isMyTurn && !isSpectator}
            rollsUsed={rollsUsed}
            onSelectScore={onSelectScore}
            diceType={diceType}
          />
        </div>
      </div>
    </div>
  );
}
