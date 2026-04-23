import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { chatApi } from '../api/chat';
import type { ChatRoomSummary } from '../api/chat';
import NormalHeader from '../components/normal/NormalHeader';
import Footer from '../components/normal/Footer';
import ChatRoomList from '../components/chat/ChatRoomList';
import CreateRoomForm from '../components/chat/CreateRoomForm';
import styles from './DbgChatListPage.module.css';

export default function DbgChatListPage() {
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toastMsg = (location.state as { toast?: string } | null)?.toast;
  const [rooms, setRooms] = useState<ChatRoomSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [degraded, setDegraded] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const createBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (toastMsg) {
      window.history.replaceState({}, '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchRooms = async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setIsError(false);
    try {
      const res = await chatApi.getRooms(accessToken);
      setRooms(res.rooms);
      setDegraded(res.degraded);
    } catch {
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateSuccess = (roomId: string) => {
    navigate(`/dbgchat/${roomId}`);
  };

  const handleCancelCreate = () => {
    setShowCreateForm(false);
    setTimeout(() => createBtnRef.current?.focus(), 0);
  };

  const handleShowForm = () => {
    setShowCreateForm(true);
  };

  return (
    <div className={styles.page}>
      <NormalHeader />
      <div className={styles.container}>
        <div className={styles.pageHeader}>
          <span className={styles.pageTitle}>💬 실시간 채팅 Test Room</span>
          <span className={styles.labBadge}>실험</span>
        </div>
        <p className={styles.pageDesc}>내부 테스터 전용 실험 공간입니다.</p>

        {toastMsg && (
          <div className={styles.toastBanner}>
            {toastMsg}
          </div>
        )}

        {degraded && (
          <div className={styles.degradedBanner}>
            ⚠ 일시적인 서버 오류로 목록이 정확하지 않을 수 있습니다.
          </div>
        )}

        <div className={styles.listHeader}>
          <span className={styles.listTitle}>방 목록 ({rooms.length}개 활성)</span>
          <button
            ref={createBtnRef}
            className={styles.createBtn}
            onClick={handleShowForm}
            disabled={degraded}
            title={degraded ? '서버 점검 중입니다.' : undefined}
          >
            + 방 만들기
          </button>
        </div>

        {showCreateForm && (
          <CreateRoomForm
            onSuccess={handleCreateSuccess}
            onCancel={handleCancelCreate}
          />
        )}

        {isLoading ? (
          <div className={styles.skeletonList}>
            <div className={styles.skeletonCard} />
            <div className={styles.skeletonCard} />
            <div className={styles.skeletonCard} />
          </div>
        ) : isError ? (
          <div className={styles.errorState}>
            <p>목록을 불러오지 못했습니다.</p>
            <button className={styles.retryBtn} onClick={fetchRooms}>다시 시도</button>
          </div>
        ) : rooms.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>💬</span>
            <p className={styles.emptyTitle}>아직 열린 채팅방이 없습니다.</p>
            <p className={styles.emptyDesc}>첫 번째 방을 만들어 보세요.</p>
            <button className={styles.createBtn} onClick={handleShowForm} disabled={degraded}>
              + 방 만들기
            </button>
          </div>
        ) : (
          <ChatRoomList rooms={rooms} />
        )}
      </div>
      <Footer />
    </div>
  );
}
