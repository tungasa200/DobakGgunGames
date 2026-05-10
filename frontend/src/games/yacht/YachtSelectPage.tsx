import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { postYachtMatch, getYachtRoomStatus } from '../../api/yacht';
import type { DiceType } from './types/yacht.types';
import YachtModeCard from './components/YachtModeCard';
import styles from './components/yacht.module.css';

export default function YachtSelectPage() {
  const navigate = useNavigate();
  const { accessToken } = useAuth();

  const [activeD6, setActiveD6] = useState<number | null>(null);
  const [activeD8, setActiveD8] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Yacht — 모드 선택';

    // 방 상태 로드
    getYachtRoomStatus().then((res) => {
      if (res) {
        setActiveD6(res.D6?.activeRooms ?? 0);
        setActiveD8(res.D8?.activeRooms ?? 0);
      }
    });
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleSelectMode = async (diceType: DiceType) => {
    const outcome = await postYachtMatch(accessToken, diceType);

    if (outcome.ok) {
      const roomId = outcome.data.roomId;
      navigate(`/yacht?mode=${diceType}`, { state: { roomId, diceType } });
    } else if (!outcome.ok && outcome.alreadyInRoom) {
      showToast('이미 진행 중인 방이 있습니다. 재진입합니다.');
      // 기존 방으로 이동 (diceType은 서버에서 roomId로 알 수 있음)
      navigate(`/yacht?mode=${diceType}`, { state: { roomId: outcome.roomId, diceType } });
    } else {
      showToast(`매칭 실패: ${outcome.error}`);
    }
  };

  return (
    <div className={`${styles.page} ${styles.modeSelectPage}`}>
      {/* 헤더 */}
      <header className={styles.modeSelectHeader}>
        <button
          type="button"
          className={styles.modeSelectBackBtn}
          onClick={() => navigate('/')}
          aria-label="홈으로 돌아가기"
        >
          ← 홈으로
        </button>
        <h1 className={styles.modeSelectHeaderTitle}>Yacht</h1>
        <div style={{ width: '80px' }} />
      </header>

      {/* 본문 */}
      <main className={styles.modeSelectScreen}>
        <h2 className={styles.modeSelectTitle}>모드를 선택하세요</h2>
        <p className={styles.modeSelectSub}>원하는 주사위 모드로 매칭이 시작됩니다</p>

        <div className={styles.modeCardRow}>
          <YachtModeCard
            diceType="D6"
            onSelect={handleSelectMode}
            activeRooms={activeD6}
          />
          <YachtModeCard
            diceType="D8"
            onSelect={handleSelectMode}
            activeRooms={activeD8}
          />
        </div>
      </main>

      {/* 토스트 */}
      {toastMessage && (
        <div
          className={`${styles.toast} ${styles.toastWarn}`}
          role="alert"
          aria-live="assertive"
          onClick={() => setToastMessage(null)}
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
