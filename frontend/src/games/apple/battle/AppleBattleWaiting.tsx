import { useState } from 'react';
import styles from './AppleBattleBoard.module.css';

interface Props {
  opponentNickname?: string | null;
  onCancel: () => void;
  connectionStatus: 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';
  roomCode?: string;
  timeoutMessage?: string | null;
}

// navigator.clipboard 실패 시 window.prompt로 폴백 (LoginPage.tsx copyLink() 패턴)
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    window.prompt('아래 코드를 복사하세요:', text);
    return false;
  }
}

export default function AppleBattleWaiting({ opponentNickname, onCancel, connectionStatus, roomCode, timeoutMessage }: Props) {
  const isConnected = connectionStatus === 'connected';
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    if (!roomCode) return;
    void copyToClipboard(roomCode).then(ok => {
      if (ok) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    });
  };

  return (
    <div className={styles.waitingScreen}>
      {roomCode && (
        <div className={styles.roomCodeBox}>
          <span className={styles.roomCodeLabel}>방 코드</span>
          <span className={styles.roomCodeValue}>{roomCode}</span>
          <button
            className={styles.btnSecondary}
            style={{ padding: '4px 12px', fontSize: 12 }}
            onClick={handleCopyCode}
            type="button"
          >
            {copied ? '복사됨!' : '복사'}
          </button>
        </div>
      )}
      <div className={styles.waitingSpinner} role="status" aria-label="상대를 기다리는 중" />
      <div className={styles.waitingTitle}>
        {opponentNickname ? `${opponentNickname}님과 매칭 중...` : '상대를 기다리는 중...'}
      </div>
      {timeoutMessage && (
        <div className={styles.waitingTimeoutMsg}>{timeoutMessage}</div>
      )}
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
