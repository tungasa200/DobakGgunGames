import type { ConnectionStatus as StatusType } from '../../lib/stompClient';
import styles from './ConnectionStatus.module.css';

interface ConnectionStatusProps {
  status: StatusType;
}

const STATUS_MAP: Record<StatusType, { color: string; text: string; pulse: boolean }> = {
  connecting: { color: '#f59e0b', text: '연결 중', pulse: true },
  connected: { color: '#22c55e', text: '연결됨', pulse: false },
  reconnecting: { color: '#ef4444', text: '재연결 중', pulse: true },
  error: { color: '#ef4444', text: '연결 오류', pulse: false },
};

export default function ConnectionStatus({ status }: ConnectionStatusProps) {
  const { color, text, pulse } = STATUS_MAP[status];
  return (
    <div
      className={styles.statusBadge}
      aria-live="polite"
      aria-label={`연결 상태: ${text}`}
    >
      <span
        className={`${styles.dot} ${pulse ? styles.dotPulse : ''}`}
        style={{ background: color }}
      />
      <span className={styles.statusText}>{text}</span>
    </div>
  );
}
