import NormalHeader from '../../../components/normal/NormalHeader';
import styles from './RpsScreens.module.css';
import type { RpsParticipant } from '../types/rps.types';

interface WaitingScreenProps {
  participants: RpsParticipant[];
  countdown: number | null;
  maxPlayers: number;
  myUserId: number | null;
  onLeave: () => void;
}

export default function WaitingScreen({
  participants,
  countdown,
  maxPlayers,
  myUserId,
  onLeave,
}: WaitingScreenProps) {
  const isCountingDown = countdown !== null && countdown > 0;

  return (
    <>
      <NormalHeader currentGame="online-rps" gameName="가위바위보" accentColor="#3b82f6" />

      <div className={styles.content}>
        {/* 아이콘 */}
        {isCountingDown ? (
          <img
            src="/games/rcp/rock.png"
            alt="바위"
            className={styles.waitingIconStatic}
          />
        ) : (
          <img
            src="/games/rcp/rock.png"
            alt="바위"
            className={styles.waitingIcon}
          />
        )}

        {/* 상태 메시지 */}
        {isCountingDown ? (
          <>
            <p className={styles.waitingCountdownTitle}>
              {countdown}초 후 게임이 시작됩니다!
            </p>
            <div
              className={styles.countdownNumber}
              key={countdown}
              aria-live="polite"
              aria-atomic="true"
            >
              {countdown}
            </div>
          </>
        ) : (
          <>
            <p className={styles.waitingTitle}>플레이어를 기다리는 중...</p>
            <p className={styles.waitingSub}>
              다른 플레이어가 입장하면 자동으로 시작됩니다
            </p>
          </>
        )}

        {/* 참가자 목록 */}
        <ul
          className={styles.participantList}
          role="list"
          aria-label="참가자 목록"
        >
          {participants.map((p) => (
            <li key={p.userId} className={styles.participantItem} role="listitem">
              <span className={styles.dot} />
              <span>{p.nickname}</span>
              {p.userId === myUserId && (
                <span className={styles.meBadge}>(나)</span>
              )}
              <span className={styles.winRate}>
                {p.winRate != null ? `${p.winRate.toFixed(2)}%` : '-'}
              </span>
            </li>
          ))}
        </ul>

        {/* 인원 표시 */}
        <p className={styles.playerCount}>
          현재 인원:{' '}
          <span className={styles.playerCountNum}>{participants.length}</span>{' '}
          / {maxPlayers}
        </p>

        {/* 나가기 버튼 */}
        <button
          className={styles.leaveBtn}
          onClick={onLeave}
          type="button"
        >
          나가기
        </button>
      </div>
    </>
  );
}
