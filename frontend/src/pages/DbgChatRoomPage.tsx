import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { chatApi, ChatApiError } from '../api/chat';
import type { ChatMessageData, StompErrorData } from '../api/chat';
import { createStompClient } from '../lib/stompClient';
import type { ConnectionStatus } from '../lib/stompClient';
import ConnectionStatusBadge from '../components/chat/ConnectionStatus';
import ChatMessageList from '../components/chat/ChatMessageList';
import ChatInput from '../components/chat/ChatInput';
import styles from './DbgChatRoomPage.module.css';

export default function DbgChatRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user, accessToken } = useAuth();

  const [roomName, setRoomName] = useState('');
  const [creatorId, setCreatorId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [historyLoading, setHistoryLoading] = useState(true);
  const [degraded, setDegraded] = useState(false);
  const [degradedDismissed, setDegradedDismissed] = useState(false);
  const [serverError, setServerError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const stompRef = useRef<ReturnType<typeof createStompClient> | null>(null);

  const handleRoomDeleted = useCallback(() => {
    if (window.opener) {
      window.close();
    } else {
      navigate('/dbgchat', { replace: true, state: { toast: '채팅방이 종료되었습니다.' } });
    }
  }, [navigate]);

  const handleMessage = useCallback((msg: ChatMessageData) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const handleError = useCallback((err: StompErrorData) => {
    setServerError(err.message);
  }, []);

  const handleStatusChange = useCallback((status: ConnectionStatus) => {
    setConnectionStatus(status);
    if (status === 'error') {
      if (window.opener) {
        window.close();
      } else {
        navigate('/dbgchat', { replace: true, state: { toast: '서버와 연결이 끊어졌습니다.' } });
      }
    }
  }, [navigate]);

  useEffect(() => {
    if (!roomId || !accessToken) return;

    let stompClient: ReturnType<typeof createStompClient> | null = null;
    let cancelled = false;

    const init = async () => {
      try {
        const history = await chatApi.getHistory(accessToken, roomId);
        if (cancelled) return;
        setRoomName(history.roomName);
        setCreatorId(history.creatorId ?? null);
        setMessages(history.messages);
        setDegraded(history.degraded);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ChatApiError && err.status === 404) {
          navigate('/dbgchat', { replace: true, state: { toast: '채팅방이 종료되었습니다.' } });
          return;
        }
        setDegraded(true);
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }

      if (cancelled) return;

      stompClient = createStompClient({
        roomId,
        token: accessToken,
        onMessage: handleMessage,
        onError: handleError,
        onStatusChange: handleStatusChange,
        onRoomDeleted: handleRoomDeleted,
      });
      stompRef.current = stompClient;
      stompClient.connect();
    };

    init();

    return () => {
      cancelled = true;
      stompClient?.disconnect();
      stompRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, accessToken]);

  const handleSend = (text: string) => {
    stompRef.current?.send(text);
    setServerError('');
  };

  const canDelete = user && (user.role === 'ADMIN' || String(user.id) === creatorId);

  const handleDelete = async () => {
    if (!accessToken || !roomId) return;
    if (!window.confirm('채팅방을 삭제하시겠습니까?')) return;
    setIsDeleting(true);
    try {
      await chatApi.deleteRoom(accessToken, roomId);
    } catch {
      // 삭제 후 서버에서 SYSTEM 메시지로 navigate 처리되므로 에러만 무시
      setIsDeleting(false);
    }
  };

  return (
    <div className={styles.roomPage}>
      <div className={styles.roomHeader}>
        <Link to="/dbgchat" className={styles.backLink}>← 목록</Link>
        <span className={styles.roomName}>💬 {roomName || '채팅방'}</span>
        <ConnectionStatusBadge status={connectionStatus} />
        {canDelete && (
          <button
            className={styles.deleteBtn}
            onClick={handleDelete}
            disabled={isDeleting}
            aria-label="채팅방 삭제"
          >
            {isDeleting ? '삭제 중…' : '방 삭제'}
          </button>
        )}
      </div>

      {degraded && !degradedDismissed && (
        <div className={styles.degradedBanner}>
          <span>⚠ 히스토리를 불러올 수 없습니다. 새 메시지는 계속 받을 수 있습니다.</span>
          <button
            className={styles.degradedClose}
            onClick={() => setDegradedDismissed(true)}
            aria-label="배너 닫기"
          >
            ✕
          </button>
        </div>
      )}

      <ChatMessageList
        messages={messages}
        currentUserId={user?.id}
        loading={historyLoading}
      />

      <ChatInput
        disabled={connectionStatus !== 'connected'}
        onSend={handleSend}
        serverError={serverError}
      />

    </div>
  );
}
