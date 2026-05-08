import { useRef, useEffect, useState, useCallback } from 'react';
import styles from './yacht.module.css';
import type { ChatMessage } from '../hooks/useYachtGame';

interface YachtChatProps {
  messages: ChatMessage[];
  myUserId: number | null;
  onSend: (message: string) => void;
}

const MIN_HEIGHT = 120;
const MAX_HEIGHT = 480;
const DEFAULT_HEIGHT = 200;
const CLOSE_ANIM_MS = 280;

const AVATAR_COLORS = [
  '#4f6cd8', '#16a34a', '#d97706', '#dc2626',
  '#7c3aed', '#0891b2', '#db2777', '#65a30d',
];

function getAvatarColor(userId: number): string {
  return AVATAR_COLORS[userId % AVATAR_COLORS.length];
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export default function YachtChat({ messages, myUserId, onSend }: YachtChatProps) {
  const [open, setOpen] = useState(true);
  const [overlayClosing, setOverlayClosing] = useState(false);
  const [draft, setDraft] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatHeight, setChatHeight] = useState(DEFAULT_HEIGHT);
  const [fabPos, setFabPos] = useState({ right: 16, bottom: 80 });

  const desktopBottomRef = useRef<HTMLDivElement>(null);
  const mobileBottomRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(messages.length);
  const heightDragRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const fabDragRef = useRef<{ startX: number; startY: number; startRight: number; startBottom: number } | null>(null);
  const fabDidDragRef = useRef(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const newCount = messages.length - prevLengthRef.current;
    if (newCount > 0 && !open) {
      setUnreadCount((c) => c + newCount);
    }
    prevLengthRef.current = messages.length;
  }, [messages.length, open]);

  useEffect(() => {
    if (open) setUnreadCount(0);
  }, [open]);

  useEffect(() => {
    if (open) desktopBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  useEffect(() => {
    if (open) mobileBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  useEffect(() => () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!heightDragRef.current) return;
      const delta = e.clientY - heightDragRef.current.startY;
      setChatHeight(Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, heightDragRef.current.startHeight + delta)));
    };
    const onUp = () => {
      if (heightDragRef.current) {
        heightDragRef.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!fabDragRef.current) return;
      fabDidDragRef.current = true;
      const dx = e.clientX - fabDragRef.current.startX;
      const dy = e.clientY - fabDragRef.current.startY;
      setFabPos({
        right: Math.max(8, Math.min(window.innerWidth - 64, fabDragRef.current.startRight - dx)),
        bottom: Math.max(8, Math.min(window.innerHeight - 64, fabDragRef.current.startBottom - dy)),
      });
    };
    const onMouseUp = () => {
      fabDragRef.current = null;
      document.body.style.userSelect = '';
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!fabDragRef.current) return;
      fabDidDragRef.current = true;
      e.preventDefault();
      const t = e.touches[0];
      const dx = t.clientX - fabDragRef.current.startX;
      const dy = t.clientY - fabDragRef.current.startY;
      setFabPos({
        right: Math.max(8, Math.min(window.innerWidth - 64, fabDragRef.current.startRight - dx)),
        bottom: Math.max(8, Math.min(window.innerHeight - 64, fabDragRef.current.startBottom - dy)),
      });
    };
    const onTouchEnd = () => { fabDragRef.current = null; };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  const onHeightHandleDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    heightDragRef.current = { startY: e.clientY, startHeight: chatHeight };
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  }, [chatHeight]);

  const onFabMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    fabDidDragRef.current = false;
    fabDragRef.current = { startX: e.clientX, startY: e.clientY, startRight: fabPos.right, startBottom: fabPos.bottom };
    document.body.style.userSelect = 'none';
  }, [fabPos]);

  const onFabTouchStart = useCallback((e: React.TouchEvent) => {
    fabDidDragRef.current = false;
    const t = e.touches[0];
    fabDragRef.current = { startX: t.clientX, startY: t.clientY, startRight: fabPos.right, startBottom: fabPos.bottom };
  }, [fabPos]);

  const onFabClick = useCallback(() => {
    if (!fabDidDragRef.current) setOpen((v) => !v);
  }, []);

  const closeOverlay = useCallback(() => {
    setOverlayClosing(true);
    closeTimerRef.current = setTimeout(() => {
      setOpen(false);
      setOverlayClosing(false);
    }, CLOSE_ANIM_MS);
  }, []);

  const submit = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft('');
  }, [draft, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  const renderAvatar = (msg: ChatMessage) => {
    if (msg.profileImageUrl) {
      return <img src={msg.profileImageUrl} className={styles.chatAvatar} alt={msg.nickname} />;
    }
    return (
      <div className={styles.chatAvatarLetter} style={{ background: getAvatarColor(msg.userId) }}>
        {msg.nickname.charAt(0)}
      </div>
    );
  };

  const renderMessages = (ref: React.RefObject<HTMLDivElement | null>) => (
    <div className={styles.chatMessages} role="log" aria-live="polite">
      {messages.length === 0 && <p className={styles.chatEmpty}>아직 메시지가 없습니다</p>}
      {messages.map((msg, i) => {
        const isMe = msg.userId === myUserId;
        const isFirstInGroup = i === 0 || messages[i - 1].userId !== msg.userId;
        const isLastInGroup = i === messages.length - 1 || messages[i + 1].userId !== msg.userId;

        return (
          <div
            key={i}
            className={[styles.chatRow, isMe ? styles.chatRowMine : ''].filter(Boolean).join(' ')}
            style={{ marginTop: isFirstInGroup && i > 0 ? 8 : 2 }}
          >
            {!isMe && (isFirstInGroup ? renderAvatar(msg) : <div className={styles.chatAvatarSpacer} />)}
            <div className={styles.chatBubbleGroup}>
              {!isMe && isFirstInGroup && (
                <span className={styles.chatNickname}>{msg.nickname}</span>
              )}
              <div className={styles.chatBubbleRow}>
                {isMe && isLastInGroup && <span className={styles.chatTimestamp}>{formatTime(msg.at)}</span>}
                <div className={[styles.chatBubble, isMe ? styles.chatBubbleMine : ''].filter(Boolean).join(' ')}>
                  {msg.message}
                </div>
                {!isMe && isLastInGroup && <span className={styles.chatTimestamp}>{formatTime(msg.at)}</span>}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={ref} />
    </div>
  );

  const inputRow = (
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
      <button type="button" className={styles.chatSendBtn} onClick={submit} disabled={!draft.trim()}>
        전송
      </button>
    </div>
  );

  return (
    <>
      {/* ── 데스크탑 패널 ── */}
      <div className={styles.chatPanelDesktop}>
        <button
          type="button"
          className={styles.chatHeader}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <span>채팅</span>
          <span className={styles.chatHeaderRight}>
            {!open && unreadCount > 0 && (
              <span className={styles.chatBadge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
            )}
            <span className={styles.chatToggleIcon}>{open ? '▼' : '▲'}</span>
          </span>
        </button>
        {open && (
          <>
            <div style={{ height: chatHeight, overflowY: 'auto', flexShrink: 0 }}>
              {renderMessages(desktopBottomRef)}
            </div>
            {inputRow}
            <div
              className={styles.chatHeightHandle}
              onMouseDown={onHeightHandleDown}
              role="separator"
              aria-label="채팅창 높이 조절"
            />
          </>
        )}
      </div>

      {/* ── 모바일 FAB ── */}
      <div
        className={[styles.chatFab, open ? styles.chatFabHidden : ''].filter(Boolean).join(' ')}
        style={{ right: fabPos.right, bottom: fabPos.bottom }}
        onMouseDown={onFabMouseDown}
        onTouchStart={onFabTouchStart}
        onClick={onFabClick}
        role="button"
        aria-label={open ? '채팅 닫기' : '채팅 열기'}
        tabIndex={0}
      >
        <span className={styles.chatFabIcon}>💬</span>
        {unreadCount > 0 && (
          <span className={styles.chatBadgeFab}>{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </div>

      {/* ── 모바일 채팅 오버레이 ── */}
      {open && (
        <div className={[styles.chatOverlay, overlayClosing ? styles.chatOverlayClosing : ''].filter(Boolean).join(' ')}>
          <div className={styles.chatOverlayHeader}>
            <span className={styles.chatOverlayTitle}>채팅</span>
            <button
              type="button"
              className={styles.chatOverlayClose}
              onClick={closeOverlay}
              aria-label="채팅 닫기"
            >
              ✕
            </button>
          </div>
          {renderMessages(mobileBottomRef)}
          {inputRow}
        </div>
      )}
    </>
  );
}
