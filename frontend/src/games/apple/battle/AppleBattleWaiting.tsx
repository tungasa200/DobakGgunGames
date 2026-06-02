import styles from './AppleBattleBoard.module.css';

interface Props {
  opponentNickname?: string | null;
  onCancel: () => void;
  connectionStatus: 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';
}

export default function AppleBattleWaiting({ opponentNickname, onCancel, connectionStatus }: Props) {
  const isConnected = connectionStatus === 'connected';

  return (
    <div className={styles.waitingScreen}>
      <div className={styles.waitingSpinner} role="status" aria-label="상대를 기다리는 중" />
      <div className={styles.waitingTitle}>
        {opponentNickname ? `${opponentNickname}님과 매칭 중...` : '상대를 기다리는 중...'}
      </div>
      <div
        className={`${styles.connectionBadge} ${isConnected ? styles.connectionBadgeConnected : styles.connectionBadgeConnecting}`}
      >
        {isConnected ? '연결됨' : '연결 중...'}
      </div>
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
