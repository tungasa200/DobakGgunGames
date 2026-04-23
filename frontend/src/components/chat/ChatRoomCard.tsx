import { Link } from 'react-router-dom';
import type { ChatRoomSummary } from '../../api/chat';
import styles from './ChatRoomCard.module.css';

interface ChatRoomCardProps {
  room: ChatRoomSummary;
}

function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const d = new Date(isoString);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${min}`;
}

export default function ChatRoomCard({ room }: ChatRoomCardProps) {
  return (
    <Link
      to={`/dbgchat/${room.roomId}`}
      className={styles.card}
      aria-label={`${room.name} 채팅방 입장`}
    >
      <div className={styles.cardMain}>
        <span className={styles.roomName}>{room.name}</span>
        <span className={styles.meta}>
          개설: {room.creatorNick} · 최근 활동: {relativeTime(room.lastActiveAt)}
        </span>
      </div>
      <span className={styles.enterHint}>입장 →</span>
    </Link>
  );
}
