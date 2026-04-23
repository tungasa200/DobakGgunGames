import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import type { ChatMessageData } from '../../api/chat';
import ChatMessage from './ChatMessage';
import styles from './ChatMessageList.module.css';

interface ChatMessageListProps {
  messages: ChatMessageData[];
  currentUserId: number | null | undefined;
  loading: boolean;
}

function formatDateLabel(isoString: string): string {
  const d = new Date(isoString);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${year}년 ${month}월 ${day}일`;
}

function getDateKey(isoString: string): string {
  return new Date(isoString).toDateString();
}

export default function ChatMessageList({
  messages,
  currentUserId,
  loading,
}: ChatMessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const prevMessagesLenRef = useRef(0);
  const [newMessageCount, setNewMessageCount] = useState(0);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' });
    setNewMessageCount(0);
    isNearBottomRef.current = true;
  }, []);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    const near = dist < 100;
    if (near && !isNearBottomRef.current) {
      setNewMessageCount(0);
    }
    isNearBottomRef.current = near;
  }, []);

  // 히스토리 최초 로딩 완료 후 즉시 맨 아래 스크롤
  useEffect(() => {
    if (!loading && messages.length > 0) {
      scrollToBottom(false);
      prevMessagesLenRef.current = messages.length;
    }
  // loading 완료 시 1회만 실행
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // 새 메시지 수신 시 처리
  useEffect(() => {
    if (loading) return;
    const added = messages.length - prevMessagesLenRef.current;
    if (added <= 0) return;
    prevMessagesLenRef.current = messages.length;

    if (isNearBottomRef.current) {
      scrollToBottom();
    } else {
      setNewMessageCount((c) => c + added);
    }
  }, [messages.length, loading, scrollToBottom]);

  if (loading) {
    return (
      <div className={styles.messageList} ref={containerRef}>
        <div className={`${styles.skeleton} ${styles.skeletonLeft}`} style={{ width: '60%' }} />
        <div className={`${styles.skeleton} ${styles.skeletonRight}`} style={{ width: '45%' }} />
        <div className={`${styles.skeleton} ${styles.skeletonLeft}`} style={{ width: '70%' }} />
        <div className={`${styles.skeleton} ${styles.skeletonRight}`} style={{ width: '50%' }} />
      </div>
    );
  }

  const items: ReactNode[] = [];
  let prevDateKey = '';
  let prevUserId: number | null = null;
  let prevType = '';

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const dateKey = getDateKey(msg.timestamp);

    if (dateKey !== prevDateKey) {
      items.push(
        <div key={`date-${dateKey}-${i}`} className={styles.dateDivider}>
          {formatDateLabel(msg.timestamp)}
        </div>,
      );
      prevDateKey = dateKey;
    }

    const showNickname =
      msg.type === 'CHAT' &&
      (prevType !== 'CHAT' || prevUserId !== msg.userId);

    items.push(
      <ChatMessage
        key={`msg-${i}-${msg.timestamp}`}
        message={msg}
        currentUserId={currentUserId}
        showNickname={showNickname}
      />,
    );

    if (msg.type === 'CHAT') {
      prevUserId = msg.userId;
      prevType = 'CHAT';
    } else {
      prevUserId = null;
      prevType = 'SYSTEM';
    }
  }

  return (
    <div className={styles.messageList} ref={containerRef} onScroll={handleScroll}>
      {items}
      <div ref={bottomRef} />
      {newMessageCount > 0 && (
        <button className={styles.newMsgBadge} onClick={() => scrollToBottom()}>
          ↓ 새 메시지 {newMessageCount}개
        </button>
      )}
    </div>
  );
}
