import styles from './yacht.module.css';
import type { Participant } from '../types/yacht.types';

interface YachtWaitingRoomProps {
  participants: Participant[];
  maxPlayers: number;
  myUserId: number | null;
  hostUserId: number | null;
  onReady: (isReady: boolean) => void;
  onStart: () => void;
  onLeave: () => void;
}

export default function YachtWaitingRoom({
  participants,
  maxPlayers,
  myUserId,
  hostUserId,
  onReady,
  onStart,
  onLeave,
}: YachtWaitingRoomProps) {
  const me = participants.find((p) => p.userId === myUserId);
  const isHost = myUserId === hostUserId;
  const isReady = me?.ready ?? false;

  // 방장 외 모든 참가자가 준비 완료 시 시작 버튼 활성화
  const nonHostParticipants = participants.filter((p) => p.userId !== hostUserId);
  const allNonHostReady = nonHostParticipants.length > 0 && nonHostParticipants.every((p) => p.ready);
  const canStart = isHost && allNonHostReady && participants.length >= 2;

  return (
    <div className={styles.waitingRoom}>
      <h2 className={styles.waitingTitle}>대기실</h2>
      <p className={styles.waitingCount}>
        {participants.length} / {maxPlayers} 명 입장
      </p>

      <ul className={styles.participantList} role="list">
        {participants.map((p) => {
          const isMe = p.userId === myUserId;
          const isThisHost = p.userId === hostUserId;
          return (
            <li
              key={p.userId}
              className={[
                styles.participantItem,
                isMe ? styles.participantItemMe : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-label={`${p.nickname}${isMe ? ' (나)' : ''}${isThisHost ? ' (방장)' : ''}${p.ready ? ' 준비완료' : ''}`}
            >
              <span className={styles.participantNickname}>
                {p.nickname}
                {isMe && <span style={{ color: 'var(--yacht-accent)', marginLeft: '4px' }}>(나)</span>}
              </span>
              {isThisHost && (
                <span className={`${styles.participantBadge} ${styles.badgeHost}`}>
                  방장
                </span>
              )}
              {!isThisHost && (
                <span
                  className={`${styles.participantBadge} ${
                    p.ready ? styles.badgeReady : styles.badgeNotReady
                  }`}
                >
                  {p.ready ? '준비완료' : '대기중'}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <div className={styles.waitingBtns}>
        {/* 비방장: 준비/준비취소 버튼 */}
        {!isHost && (
          <button
            type="button"
            className={isReady ? styles.btnSecondary : styles.btnPrimary}
            onClick={() => onReady(!isReady)}
          >
            {isReady ? '준비 취소' : '준비'}
          </button>
        )}

        {/* 방장: 게임 시작 버튼 */}
        {isHost && (
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={onStart}
            disabled={!canStart}
            title={
              !canStart
                ? participants.length < 2
                  ? '2명 이상 필요합니다'
                  : '모든 참가자가 준비를 완료해야 합니다'
                : undefined
            }
          >
            게임 시작
          </button>
        )}

        {isHost && !canStart && (
          <p className={styles.waitingInfo}>
            {participants.length < 2
              ? '2명 이상 모여야 시작할 수 있습니다'
              : '모든 참가자가 준비를 완료해야 시작할 수 있습니다'}
          </p>
        )}

        <button
          type="button"
          className={styles.btnDanger}
          onClick={onLeave}
        >
          나가기
        </button>
      </div>
    </div>
  );
}
