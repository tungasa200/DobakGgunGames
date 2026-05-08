import { useRef, useEffect, useState, useCallback } from 'react';
import styles from './yacht.module.css';
import type { ChatMessage } from '../hooks/useYachtGame';

interface YachtChatProps {
  messages: ChatMessage[];
  myUserId: number | null;
  onSend: (message: string) => void;
}

export default function YachtChat({ messages, myUserId, onSend }: YachtChatProps) {
  const [open, setOpen] = useState(true);
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  const submit = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft('');
  }, [draft, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className={styles.chatPanel}>
      <button
        type="button"
        className={styles.chatHeader}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>채팅</span>
        <span className={styles.chatToggleIcon}>{open ? '▼' : '▲'}</span>
      </button>

      {open && (
        <>
          <div className={styles.chatMessages} role="log" aria-live="polite">
            {messages.length === 0 && (
              <p className={styles.chatEmpty}>아직 메시지가 없습니다</p>
            )}
            {messages.map((msg, i) => {
              const isMe = msg.userId === myUserId;
              return (
                <div
                  key={i}
                  className={[styles.chatMessageItem, isMe ? styles.chatMine : ''].filter(Boolean).join(' ')}
                >
                  {!isMe && <span className={styles.chatNickname}>{msg.nickname}</span>}
                  <span className={styles.chatText}>{msg.message}</span>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <div className={styles.chatInputRow}>
            <input
              type="text"
              className={styles.chatInput}
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 200))}
              onKeyDown={handleKeyDown}
              placeholder="메시지 입력..."
              maxLength={200}
              aria-label="채팅 메시지 입력"
            />
            <button
              type="button"
              className={styles.chatSendBtn}
              onClick={submit}
              disabled={!draft.trim()}
            >
              전송
            </button>
          </div>
        </>
      )}
    </div>
  );
}
