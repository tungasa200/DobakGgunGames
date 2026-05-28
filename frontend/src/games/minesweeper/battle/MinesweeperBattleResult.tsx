import type { GameResultPayload } from './types';
import styles from './MinesweeperBattleBoard.module.css';

interface MinesweeperBattleResultProps {
  result: GameResultPayload;
  myPlayerId: string | null;
  onPlayAgain: () => void;
  onLeave: () => void;
}

export default function MinesweeperBattleResult({
  result,
  myPlayerId,
  onPlayAgain,
  onLeave,
}: MinesweeperBattleResultProps) {
  const isWin = myPlayerId === result.winnerId;
  const isMineHit = result.reason === 'MINE_HIT';
  const isClear = result.reason === 'BOARD_CLEAR';

  // 클리어 타임: 승자의 elapsed (BOARD_CLEAR 시에만 의미 있음)
  const winnerResult = result.results.find(r => r.playerId === result.winnerId);
  const clearTime = isClear && winnerResult && winnerResult.elapsedMs > 0
    ? winnerResult.elapsedSeconds.toFixed(2)
    : null;

  return (
    <div className={styles.resultModalBackdrop}>
      <div className={styles.resultModal}>
        {/* 메인 비주얼 */}
        {isMineHit && (
          <div className={styles.resultBoom}>💣 BOOM!</div>
        )}
        {isClear && clearTime && (
          <div className={styles.resultClearTime}>⏱ {clearTime}초</div>
        )}

        {/* 승리/패배 */}
        <div className={`${styles.resultOutcome} ${isWin ? styles.resultWin : styles.resultLose}`}>
          {isWin ? '승리!' : '패배...'}
        </div>

        {/* 버튼 */}
        <div className={styles.resultBtns}>
          <button className={styles.btnPrimary} onClick={onPlayAgain} type="button">
            다시 매칭
          </button>
          <button className={styles.btnSecondary} onClick={onLeave} type="button">
            나가기
          </button>
        </div>
      </div>
    </div>
  );
}
