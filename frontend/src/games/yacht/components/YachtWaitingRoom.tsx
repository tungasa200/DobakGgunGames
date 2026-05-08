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

        <button
          type="button"
          className={styles.btnDanger}
          onClick={onLeave}
        >
          나가기
        </button>
      </div>

      <div style={{ width: '100%', maxWidth: '400px' }}>
        <YachtChat
          messages={chatMessages}
          myUserId={myUserId}
          onSend={onSendChat}
        />
      </div>

      {rankings.length > 0 && (
        <div className={styles.rankingSection}>
          <h3 className={styles.rankingSectionTitle}>역대 랭킹</h3>
          <ol className={styles.rankingList} aria-label="야추 역대 랭킹">
            {rankings.map((entry) => {
              const isMe = entry.userId === myUserId;
              return (
                <li
                  key={entry.userId}
                  className={[styles.rankItem, isMe ? styles.rankItemMe : '']
                    .filter(Boolean)
                    .join(' ')}
                >
                  <span className={[styles.rankNumber, entry.rank === 1 ? styles.rankNumberFirst : ''].filter(Boolean).join(' ')}>
                    {entry.rank}
                  </span>
                  <span className={styles.rankNickname}>
                    {entry.nickname}
                    {isMe && (
                      <span style={{ color: 'var(--yacht-accent)', marginLeft: '4px', fontSize: '0.8rem' }}>
                        (나)
                      </span>
                    )}
                  </span>
                  <span className={styles.rankScore}>
                    {entry.winCount}승
                    {entry.totalGames > 0 && (
                      <span style={{ color: 'var(--yacht-text-sub)', fontSize: '0.8rem', marginLeft: '4px' }}>
                        / {entry.totalGames}판
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
