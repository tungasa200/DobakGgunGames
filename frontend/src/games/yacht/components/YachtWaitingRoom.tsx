import { useEffect, useState } from 'react';
import styles from './yacht.module.css';
import type { Participant, YachtRankingEntry } from '../types/yacht.types';
import { getYachtRankings } from '../../../api/yacht';
import YachtChat from './YachtChat';
import type { ChatMessage } from '../hooks/useYachtGame';

interface YachtWaitingRoomProps {
  participants: Participant[];
  maxPlayers: number;
  myUserId: number | null;
  hostUserId: number | null;
  onReady: (isReady: boolean) => void;
  onStart: () => void;
  onLeave: () => void;
  chatMessages: ChatMessage[];
  onSendChat: (message: string) => void;
}

const AVATAR_COLORS = [
  '#4f6cd8', '#16a34a', '#d97706', '#dc2626',
  '#7c3aed', '#0891b2', '#db2777', '#65a30d',
];
function getAvatarColor(userId: number): string {
  return AVATAR_COLORS[userId % AVATAR_COLORS.length];
}

export default function YachtWaitingRoom({
  participants,
  maxPlayers,
  myUserId,
  hostUserId,
  onReady,
  onStart,
  onLeave,
  chatMessages,
  onSendChat,
}: YachtWaitingRoomProps) {
  const me = participants.find((p) => p.userId === myUserId);
  const isHost = myUserId === hostUserId;
  const isReady = me?.ready ?? false;

  const nonHostParticipants = participants.filter((p) => p.userId !== hostUserId);
  const allNonHostReady = nonHostParticipants.length > 0 && nonHostParticipants.every((p) => p.ready);
  const canStart = isHost && allNonHostReady && participants.length >= 2;

  const [rankings, setRankings] = useState<YachtRankingEntry[]>([]);

  useEffect(() => {
    getYachtRankings().then((res) => {
      if (res) setRankings(res.topRankings);
    });
  }, []);

  return (
    <div className={styles.waitingRoom}>
      {/* 헤더 */}
      <div className={styles.waitingHeader}>
        <h2 className={styles.waitingTitle}>대기실</h2>
        <span className={styles.waitingCount}>{participants.length} / {maxPlayers} 명 입장</span>
      </div>

      {/* 참여자 섹션 */}
      <div className={styles.waitingSection}>
        <p className={styles.waitingSectionTitle}>참여자</p>
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
                ].filter(Boolean).join(' ')}
                aria-label={`${p.nickname}${isMe ? ' (나)' : ''}${isThisHost ? ' (방장)' : ''}${p.ready ? ' 준비완료' : ''}`}
              >
                {p.profileImageUrl
                  ? <img src={p.profileImageUrl} className={styles.participantAvatar} alt={p.nickname} />
                  : (
                    <div
                      className={styles.participantAvatarLetter}
                      style={{ background: getAvatarColor(p.userId) }}
                      aria-hidden="true"
                    >
                      {p.nickname.charAt(0)}
                    </div>
                  )
                }
                <span className={styles.participantNickname}>
                  {p.nickname}
                  {isMe && <span className={styles.participantMeTag}>(나)</span>}
                </span>
                {isThisHost
                  ? <span className={`${styles.participantBadge} ${styles.badgeHost}`}>방장</span>
                  : (
                    <span className={`${styles.participantBadge} ${p.ready ? styles.badgeReady : styles.badgeNotReady}`}>
                      {p.ready ? '준비완료' : '대기중'}
                    </span>
                  )
                }
              </li>
            );
          })}
        </ul>
      </div>

      {/* 게임 준비 / 시작 섹션 */}
      <div className={styles.waitingSection}>
        <p className={styles.waitingSectionTitle}>게임 준비</p>
        <div className={styles.waitingBtns}>
          {!isHost && (
            <button
              type="button"
              className={isReady ? styles.btnSecondary : styles.btnPrimary}
              onClick={() => onReady(!isReady)}
            >
              {isReady ? '준비 취소' : '준비'}
            </button>
          )}
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
          <button type="button" className={styles.btnDanger} onClick={onLeave}>
            나가기
          </button>
        </div>
      </div>

      {/* 채팅 (자체 패널 스타일 유지) */}
      <div style={{ width: '100%', maxWidth: '440px' }}>
        <YachtChat
          messages={chatMessages}
          myUserId={myUserId}
          onSend={onSendChat}
        />
      </div>

      {/* 역대 랭킹 */}
      {rankings.length > 0 && (
        <div className={styles.waitingSection}>
          <p className={styles.waitingSectionTitle}>역대 랭킹</p>
          <table className={styles.rankTable} aria-label="야추 역대 랭킹">
            <thead>
              <tr>
                <th>순위</th>
                <th>닉네임</th>
                <th>승수</th>
                <th>판수</th>
              </tr>
            </thead>
            <tbody>
              {rankings.map((entry) => {
                const isMe = entry.userId === myUserId;
                return (
                  <tr key={entry.userId} className={isMe ? styles.rankRowMe : ''}>
                    <td>{entry.rank}</td>
                    <td>{entry.nickname}{isMe && ' (나)'}</td>
                    <td>{entry.winCount}승</td>
                    <td>{entry.totalGames}판</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
