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
  const myResult = result.results.find(r => r.playerId === myPlayerId);
  const opResult = result.results.find(r => r.playerId !== myPlayerId);
  const isWin = myPlayerId === result.winnerId;

  return (
    <div className={styles.resultScreen}>
      <div className={`${styles.resultTitle} ${isWin ? styles.resultWin : styles.resultLose}`}>
        {isWin ? '승리!' : '패배...'}
      </div>

      <div className={styles.resultRecords}>
        {myResult && (
          <div className={styles.resultRecord}>
            <span className={styles.resultRecordLabel}>내 기록</span>
            <span>{myResult.elapsedMs > 0 ? `${myResult.elapsedSeconds.toFixed(2)}초` : '-'}</span>
          </div>
        )}
        {opResult && (
          <div className={styles.resultRecord}>
            <span className={styles.resultRecordLabel}>상대 기록</span>
            <span>{opResult.elapsedMs > 0 ? `${opResult.elapsedSeconds.toFixed(2)}초` : '-'}</span>
          </div>
        )}
      </div>

      <div className={styles.resultBtns}>
        <button className={styles.btnPrimary} onClick={onPlayAgain} type="button">
          다시 매칭
        </button>
        <button className={styles.btnSecondary} onClick={onLeave} type="button">
          나가기
        </button>
      </div>
    </div>
  );
}
