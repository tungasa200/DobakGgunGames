import styles from './yacht.module.css';
import type { Participant, PlayerScore, ScoreKey } from '../types/yacht.types';
import YachtDice3D from './YachtDice3D';
import YachtScoreBoard from './YachtScoreBoard';

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
  onToggleKeep: (index: number) => void;
  onRoll: () => void;
  onSelectScore: (key: ScoreKey) => void;
  onLeave: () => void;
}

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
  onToggleKeep,
  onRoll,
  onSelectScore,
  onLeave,
}: YachtGameScreenProps) {
  const currentPlayer = participants.find((p) => p.userId === currentTurnUserId);
  const rollsUsed = 3 - rollsLeft;
  const hasDice = dice.every((d) => d > 0);

  return (
    <div className={styles.gameScreen}>
      {/* 헤더 */}
      <header className={styles.header}>
        <h1 className={styles.headerTitle}>Yacht</h1>
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

      <div className={styles.gameBody}>
        {/* 좌측: 주사위 + 조작 */}
        <div className={styles.gameLeft}>
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
            <div className={styles.diceRow} role="list" aria-label="주사위">
              {dice.map((val, i) => (
                <div key={i} role="listitem">
                  <YachtDice3D
                    value={val}
                    isKept={keptIndices.includes(i)}
                    isMyTurn={isMyTurn && !isSpectator}
                    isRolling={isRolling}
                    onToggleKeep={() => onToggleKeep(i)}
                  />
                </div>
              ))}
            </div>

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
                {isRolling ? '굴리는 중...' : rollsLeft === 3 ? '굴리기!' : '다시 굴리기'}
              </button>
            )}

            {!isMyTurn && (
              <p style={{ color: 'var(--yacht-text-sub)', fontSize: '0.9rem', margin: 0 }}>
                {currentPlayer?.nickname ?? '상대방'}의 턴입니다
              </p>
            )}
          </div>

          {/* 안내 메시지 — 관전자에게는 비표시 */}
          {!isSpectator && isMyTurn && hasDice && rollsLeft < 3 && (
            <p style={{ fontSize: '0.83rem', color: 'var(--yacht-text-sub)', textAlign: 'center', margin: 0 }}>
              고정할 주사위를 클릭하고 다시 굴리거나, 오른쪽 점수판에서 족보를 선택하세요
            </p>
          )}

          {!isSpectator && isMyTurn && rollsLeft === 0 && (
            <p style={{ fontSize: '0.9rem', color: 'var(--yacht-warn)', textAlign: 'center', margin: 0 }}>
              굴림 횟수를 모두 사용했습니다. 족보를 선택해 주세요.
            </p>
          )}
        </div>

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
          />
        </div>
      </div>
    </div>
  );
}
