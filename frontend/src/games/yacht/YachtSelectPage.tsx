import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  postYachtMatch,
  postYachtCreate,
  postYachtJoinRoom,
  getYachtWaitingRooms,
  getYachtRoomStatus,
} from '../../api/yacht';
import type { YachtWaitingRoomInfo } from '../../api/yacht';
import type { DiceType } from './types/yacht.types';
import YachtModeCard from './components/YachtModeCard';
import styles from './components/yacht.module.css';

export default function YachtSelectPage() {
  const navigate = useNavigate();
  const { accessToken } = useAuth();

  const [activeD6, setActiveD6] = useState<number | null>(null);
  const [activeD8, setActiveD8] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 방 입장 흐름 상태
  const [selectedDice, setSelectedDice] = useState<DiceType | null>(null);
  const [entryMode, setEntryMode] = useState<'select' | 'browse' | null>(null);
  const [waitingRooms, setWaitingRooms] = useState<YachtWaitingRoomInfo[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [matchLoading, setMatchLoading] = useState(false);

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

  /** 매칭 결과 처리 — 세 진입 방식 공통 */
  const handleMatchOutcome = (
    outcome: Awaited<ReturnType<typeof postYachtMatch>>,
    diceType: DiceType,
  ) => {
    if (outcome.ok) {
      navigate(`/yacht?mode=${diceType}`, {
        state: { roomId: outcome.data.roomId, diceType },
      });
    } else if (!outcome.ok && outcome.alreadyInRoom) {
      showToast('이미 진행 중인 방이 있습니다. 재진입합니다.');
      navigate(`/yacht?mode=${diceType}`, {
        state: { roomId: outcome.roomId, diceType },
      });
    } else {
      showToast(`오류: ${outcome.error}`);
    }
  };

  /** 모드 카드 클릭 — 진입 방식 선택 단계로 이동 */
  const handleModeCardClick = async (diceType: DiceType): Promise<void> => {
    setSelectedDice(diceType);
    setEntryMode('select');
  };

  /** 자동 매칭 */
  const handleAutoMatch = async () => {
    if (!selectedDice || matchLoading) return;
    setMatchLoading(true);
    try {
      const outcome = await postYachtMatch(accessToken, selectedDice);
      handleMatchOutcome(outcome, selectedDice);
    } catch {
      showToast('자동 매칭 요청 중 오류가 발생했습니다.');
    } finally {
      setMatchLoading(false);
    }
  };

  /** 방 만들기 */
  const handleCreateRoom = async () => {
    if (!selectedDice || matchLoading) return;
    setMatchLoading(true);
    try {
      const outcome = await postYachtCreate(accessToken, selectedDice);
      handleMatchOutcome(outcome, selectedDice);
    } catch {
      showToast('방 생성 요청 중 오류가 발생했습니다.');
    } finally {
      setMatchLoading(false);
    }
  };

  /** 방 입장 — 대기 방 목록 조회 후 browse 모드 전환 */
  const handleBrowseRooms = async () => {
    if (!selectedDice || matchLoading) return;
    setEntryMode('browse');
    setRoomsLoading(true);
    try {
      const rooms = await getYachtWaitingRooms(selectedDice);
      setWaitingRooms(rooms);
    } catch {
      showToast('방 목록을 불러오지 못했습니다.');
      setWaitingRooms([]);
    } finally {
      setRoomsLoading(false);
    }
  };

  /** 방 목록 새로고침 */
  const handleRefreshRooms = async () => {
    if (!selectedDice || roomsLoading) return;
    setRoomsLoading(true);
    try {
      const rooms = await getYachtWaitingRooms(selectedDice);
      setWaitingRooms(rooms);
    } catch {
      showToast('방 목록을 불러오지 못했습니다.');
    } finally {
      setRoomsLoading(false);
    }
  };

  /** 특정 방 입장 */
  const handleJoinRoom = async (roomId: string) => {
    if (!selectedDice || matchLoading) return;
    setMatchLoading(true);
    try {
      const outcome = await postYachtJoinRoom(accessToken, roomId);
      handleMatchOutcome(outcome, selectedDice);
    } catch {
      showToast('방 입장 요청 중 오류가 발생했습니다.');
    } finally {
      setMatchLoading(false);
    }
  };

  /** 모드 선택으로 초기화 */
  const handleResetToModeSelect = () => {
    setSelectedDice(null);
    setEntryMode(null);
    setWaitingRooms([]);
  };

  // roomId 표시용 축약
  const truncateRoomId = (id: string) =>
    id.length > 12 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;

  const isD8 = selectedDice === 'D8';

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
        {/* ─── 모드 카드 (아직 모드를 선택하지 않은 경우) ─── */}
        {selectedDice === null && (
          <>
            <h2 className={styles.modeSelectTitle}>모드를 선택하세요</h2>
            <p className={styles.modeSelectSub}>원하는 주사위 모드로 매칭이 시작됩니다</p>

            <div className={styles.modeCardRow}>
              <YachtModeCard
                diceType="D6"
                onSelect={handleModeCardClick}
                activeRooms={activeD6}
              />
              <YachtModeCard
                diceType="D8"
                onSelect={handleModeCardClick}
                activeRooms={activeD8}
              />
            </div>
          </>
        )}

        {/* ─── 진입 방식 선택 패널 ─── */}
        {selectedDice !== null && entryMode === 'select' && (
          <div
            style={{
              width: '100%',
              maxWidth: '440px',
              background: 'var(--yacht-surface)',
              border: '1px solid var(--yacht-border)',
              borderRadius: '16px',
              padding: '28px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {/* 선택된 모드 표시 */}
            <div style={{ textAlign: 'center' }}>
              <h2 className={styles.modeSelectTitle} style={{ fontSize: '18px' }}>
                {selectedDice === 'D6' ? '정육면체 (D6)' : '정팔면체 (D8)'}
              </h2>
              <p className={styles.modeSelectSub} style={{ marginTop: '4px' }}>
                입장 방식을 선택하세요
              </p>
            </div>

            {/* 자동 매칭 */}
            <button
              type="button"
              className={`${styles.modeCardCta} ${isD8 ? styles.modeCardCtaD8 : ''}`}
              disabled={matchLoading}
              aria-busy={matchLoading}
              onClick={() => void handleAutoMatch()}
            >
              {matchLoading ? '처리 중...' : '자동 매칭'}
            </button>

            {/* 방 만들기 */}
            <button
              type="button"
              className={styles.btnSecondary}
              disabled={matchLoading}
              onClick={() => void handleCreateRoom()}
              style={{ width: '100%' }}
            >
              방 만들기
            </button>

            {/* 방 입장 */}
            <button
              type="button"
              className={styles.btnSecondary}
              disabled={matchLoading}
              onClick={() => void handleBrowseRooms()}
              style={{ width: '100%' }}
            >
              방 입장
            </button>

            {/* 뒤로 */}
            <button
              type="button"
              className={styles.modeSelectBackBtn}
              disabled={matchLoading}
              onClick={handleResetToModeSelect}
              style={{ alignSelf: 'center', marginTop: '4px' }}
            >
              ← 모드 선택
            </button>
          </div>
        )}

        {/* ─── 대기 방 목록 패널 ─── */}
        {selectedDice !== null && entryMode === 'browse' && (
          <div
            style={{
              width: '100%',
              maxWidth: '560px',
              background: 'var(--yacht-surface)',
              border: '1px solid var(--yacht-border)',
              borderRadius: '16px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {/* 패널 헤더 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <h2
                className={styles.modeSelectTitle}
                style={{ fontSize: '17px', margin: 0 }}
              >
                대기 중인 방 ({selectedDice})
              </h2>
              <button
                type="button"
                className={styles.btnSecondary}
                disabled={roomsLoading || matchLoading}
                onClick={() => void handleRefreshRooms()}
                style={{ padding: '6px 14px', fontSize: '13px', flexShrink: 0 }}
              >
                {roomsLoading ? '로딩...' : '새로고침'}
              </button>
            </div>

            {/* 방 목록 */}
            {roomsLoading ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div className={styles.spinner} style={{ margin: '0 auto' }} />
                <p
                  className={styles.loadingSub}
                  style={{ marginTop: '12px' }}
                >
                  방 목록을 불러오는 중...
                </p>
              </div>
            ) : waitingRooms.length === 0 ? (
              <p
                className={styles.modeSelectSub}
                style={{ textAlign: 'center', padding: '24px 0' }}
              >
                현재 대기 중인 방이 없습니다
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '14px',
                  }}
                >
                  <thead>
                    <tr>
                      <th
                        style={{
                          textAlign: 'left',
                          padding: '8px 10px',
                          borderBottom: '2px solid var(--yacht-border)',
                          color: 'var(--yacht-text-sub)',
                          fontWeight: 700,
                          fontSize: '12px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        방 ID
                      </th>
                      <th
                        style={{
                          textAlign: 'center',
                          padding: '8px 10px',
                          borderBottom: '2px solid var(--yacht-border)',
                          color: 'var(--yacht-text-sub)',
                          fontWeight: 700,
                          fontSize: '12px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        인원
                      </th>
                      <th
                        style={{
                          textAlign: 'left',
                          padding: '8px 10px',
                          borderBottom: '2px solid var(--yacht-border)',
                          color: 'var(--yacht-text-sub)',
                          fontWeight: 700,
                          fontSize: '12px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        방장
                      </th>
                      <th
                        style={{
                          textAlign: 'center',
                          padding: '8px 10px',
                          borderBottom: '2px solid var(--yacht-border)',
                          color: 'var(--yacht-text-sub)',
                          fontWeight: 700,
                          fontSize: '12px',
                        }}
                      >
                        {/* 입장 버튼 열 헤더 */}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {waitingRooms.map((room) => (
                      <tr key={room.roomId}>
                        <td
                          style={{
                            padding: '10px 10px',
                            borderBottom: '1px solid var(--yacht-border)',
                            fontFamily: 'monospace',
                            fontSize: '13px',
                            color: 'var(--yacht-text-sub)',
                            whiteSpace: 'nowrap',
                          }}
                          title={room.roomId}
                        >
                          {truncateRoomId(room.roomId)}
                        </td>
                        <td
                          style={{
                            padding: '10px 10px',
                            borderBottom: '1px solid var(--yacht-border)',
                            textAlign: 'center',
                            color: 'var(--yacht-text)',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {room.currentPlayers} / {room.maxPlayers}
                        </td>
                        <td
                          style={{
                            padding: '10px 10px',
                            borderBottom: '1px solid var(--yacht-border)',
                            color: 'var(--yacht-text)',
                            maxWidth: '120px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {room.hostNickname ?? '—'}
                        </td>
                        <td
                          style={{
                            padding: '10px 10px',
                            borderBottom: '1px solid var(--yacht-border)',
                            textAlign: 'center',
                          }}
                        >
                          <button
                            type="button"
                            className={`${styles.modeCardCta} ${isD8 ? styles.modeCardCtaD8 : ''}`}
                            disabled={matchLoading}
                            onClick={() => void handleJoinRoom(room.roomId)}
                            style={{
                              width: 'auto',
                              padding: '6px 16px',
                              fontSize: '13px',
                              margin: 0,
                            }}
                          >
                            입장
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 뒤로 */}
            <button
              type="button"
              className={styles.modeSelectBackBtn}
              disabled={matchLoading || roomsLoading}
              onClick={() => setEntryMode('select')}
              style={{ alignSelf: 'flex-start' }}
            >
              ← 뒤로
            </button>
          </div>
        )}
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
