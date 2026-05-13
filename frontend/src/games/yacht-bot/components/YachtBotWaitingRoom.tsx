import styles from '../../yacht/components/yacht.module.css';
import type { Participant, DiceType } from '../../yacht/types/yacht.types';

const BOT_USER_ID = 9999;

const AVATAR_COLORS = [
  '#4f6cd8', '#16a34a', '#d97706', '#dc2626',
  '#7c3aed', '#0891b2', '#db2777', '#65a30d',
];
function getAvatarColor(userId: number): string {
  return AVATAR_COLORS[userId % AVATAR_COLORS.length];
}

interface YachtBotWaitingRoomProps {
  participants: Participant[];
  myUserId: number | null;
  hostUserId: number | null;
  onStart: () => void;
  onLeave: () => void;
  diceType: DiceType;
}

export default function YachtBotWaitingRoom({
  participants,
  myUserId,
  hostUserId,
  onStart,
  onLeave,
  diceType,
}: YachtBotWaitingRoomProps) {
  const isHost = myUserId === hostUserId;
  const botPresent = participants.some((p) => p.userId === BOT_USER_ID);
  const canStart = isHost && botPresent && participants.length >= 2;

  return (
    <div className={styles.waitingRoom}>
      <div className={styles.waitingHeader}>
        <h2 className={styles.waitingTitle}>AI봇 대결 대기</h2>
        <span className={styles.waitingCount}>{diceType} 모드</span>
      </div>

      <p className={styles.waitingModeSub}>
        AI봇이 준비됐습니다. 게임 시작을 눌러주세요.
      </p>

      <div className={styles.waitingSection}>
        <ul className={styles.participantList} role="list">
          {participants.map((p) => {
            const isMe = p.userId === myUserId;
            const isBot = p.userId === BOT_USER_ID;
            const isThisHost = p.userId === hostUserId;
            return (
              <li
                key={p.userId}
                className={[
                  styles.participantItem,
                  isMe ? styles.participantItemMe : '',
                ].filter(Boolean).join(' ')}
              >
                {isBot ? (
                  <div
                    className={styles.participantAvatarLetter}
                    style={{ background: '#6366f1' }}
                    aria-hidden="true"
                  >
                    AI
                  </div>
                ) : p.profileImageUrl ? (
                  <img src={p.profileImageUrl} className={styles.participantAvatar} alt={p.nickname} />
                ) : (
                  <div
                    className={styles.participantAvatarLetter}
                    style={{ background: getAvatarColor(p.userId) }}
                    aria-hidden="true"
                  >
                    {p.nickname.charAt(0)}
                  </div>
                )}
                <span className={styles.participantNickname}>
                  {p.nickname}
                  {isMe && <span className={styles.participantMeTag}>(나)</span>}
                </span>
                {isThisHost && !isBot
                  ? <span className={`${styles.participantBadge} ${styles.badgeHost}`}>방장</span>
                  : <span className={`${styles.participantBadge} ${styles.badgeReady}`}>준비완료</span>
                }
              </li>
            );
          })}
        </ul>
      </div>

      <div className={styles.waitingSection}>
        <div className={styles.waitingBtns}>
          {isHost && (
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={onStart}
              disabled={!canStart}
            >
              게임 시작
            </button>
          )}
          <button type="button" className={styles.btnDanger} onClick={onLeave}>
            나가기
          </button>
        </div>
      </div>
    </div>
  );
}
