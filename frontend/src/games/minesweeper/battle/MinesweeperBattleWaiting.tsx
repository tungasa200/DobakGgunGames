import styles from './MinesweeperBattleBoard.module.css';

interface MinesweeperBattleWaitingProps {
  myNickname: string | null;
  onCancel: () => void;
}

export default function MinesweeperBattleWaiting({ myNickname, onCancel }: MinesweeperBattleWaitingProps) {
  return (
    <div className={styles.waitingScreen}>
      {myNickname && (
        <div style={{ fontSize: 14, color: '#9ca3af' }}>
          {myNickname}
        </div>
      )}
      <div className={styles.waitingTitle}>다른 플레이어를 기다리는 중...</div>
      <div className={styles.spinner} role="status" aria-label="매칭 대기 중" />
      <button
        className={styles.btnSecondary}
        onClick={onCancel}
        type="button"
      >
        취소
      </button>
    </div>
  );
}
