import styles from './MinesweeperBattleBoard.module.css';

interface OpponentProgressProps {
  nickname: string;
  progressPercent: number;
  revealedCount: number;
}

export default function OpponentProgress({ nickname, progressPercent, revealedCount }: OpponentProgressProps) {
  return (
    <div className={`${styles.playerCard} ${styles.playerCardOpponent}`}>
      <div className={styles.playerNickname} title={nickname}>{nickname}</div>
      <div className={styles.progressBarWrap}>
        <div
          className={`${styles.progressBarFill} ${styles.progressBarFillOpponent}`}
          style={{ width: `${Math.min(100, progressPercent)}%` }}
        />
      </div>
      <div className={styles.progressText}>
        상대 진행률 {progressPercent}% ({revealedCount} / 71 셀)
      </div>
    </div>
  );
}
