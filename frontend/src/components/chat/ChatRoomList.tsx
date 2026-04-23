import type { ChatRoomSummary } from '../../api/chat';
import ChatRoomCard from './ChatRoomCard';
import styles from './ChatRoomList.module.css';

interface ChatRoomListProps {
  rooms: ChatRoomSummary[];
}

export default function ChatRoomList({ rooms }: ChatRoomListProps) {
  return (
    <ul className={styles.roomList} role="list">
      {rooms.map((room) => (
        <li key={room.roomId}>
          <ChatRoomCard room={room} />
        </li>
      ))}
    </ul>
  );
}
