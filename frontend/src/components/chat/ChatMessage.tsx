import type { ChatMessageData } from '../../api/chat';
import styles from './ChatMessage.module.css';

interface ChatMessageProps {
  message: ChatMessageData;
  currentUserId: number | null | undefined;
  showNickname: boolean;
}

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function SystemMessage({ text }: { text: string }) {
  return (
    <div className={styles.systemMsgWrap} role="status" aria-live="polite">
      <span className={styles.systemText}>{text}</span>
    </div>
  );
}

function MyMessage({ message }: { message: ChatMessageData }) {
  return (
    <div className={styles.myMsgWrap}>
      <span className={styles.timestamp}>{formatTime(message.timestamp)}</span>
      <div className={`${styles.bubble} ${styles.myBubble}`}>{message.message}</div>
    </div>
  );
}

function OtherMessage({ message, showNickname }: { message: ChatMessageData; showNickname: boolean }) {
  return (
    <div className={styles.otherMsgWrap}>
      {showNickname && <span className={styles.nickname}>{message.nickname}</span>}
      <div className={styles.otherBubbleRow}>
        <div className={`${styles.bubble} ${styles.otherBubble}`}>{message.message}</div>
        <span className={styles.timestamp}>{formatTime(message.timestamp)}</span>
      </div>
    </div>
  );
}

export default function ChatMessage({ message, currentUserId, showNickname }: ChatMessageProps) {
  if (message.type === 'SYSTEM') {
    return <SystemMessage text={message.message} />;
  }
  const isMe = message.userId !== null && message.userId === currentUserId;
  if (isMe) {
    return <MyMessage message={message} />;
  }
  return <OtherMessage message={message} showNickname={showNickname} />;
}
