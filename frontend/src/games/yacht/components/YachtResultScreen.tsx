import styles from './yacht.module.css';
import type { RankEntry } from '../types/yacht.types';

interface YachtResultScreenProps {
  rankings: RankEntry[];
  myUserId: number | null;
  isSpectator?: boolean;
  onLeave: () => void;
}

const RANK_ICONS = ['1st', '2nd', '3rd', '4th', '5th', '6th'];

export default function YachtResultScreen({
  rankings,
  myUserId,
  isSpectator = false,
  onLeave,
}: YachtResultScreenProps) {
  const myResult = rankings.find((r) => r.userId === myUserId);
  const isWinner = myResult?.isWinner ?? false;

  return (
    <div className={styles.resultScreen}>
      <h2 className={styles.resultTitle}>
        {isSpectator ? 'Game Over' : isWinner ? 'Victory!' : 'Game Over'}
      </h2>

      {isSpectator && (
        <p style={{ color: 'var(--yacht-text-sub)', fontSize: '0.95rem', margin: 0 }}>
          관전 종료 — 게임이 끝났습니다
        </p>
      )}

      {myResult && (
        <p style={{ color: 'var(--yacht-text-sub)', fontSize: '0.95rem', margin: 0 }}>
          내 순위: {myResult.rank}위 ({myResult.grandTotal}점)
        </p>
      )}

      <ol className={styles.rankingList} aria-label="최종 순위">
        {rankings.map((entry) => {
          const isMe = entry.userId === myUserId;
          return (
            <li
              key={entry.userId}
              className={[
                styles.rankItem,
                isMe ? styles.rankItemMe : '',
                entry.isWinner ? styles.rankItemWinner : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-label={`${entry.rank}위 ${entry.nickname} ${entry.grandTotal}점${entry.isWinner ? ' (우승)' : ''}${isMe ? ' (나)' : ''}`}
            >
              <span
                className={[
                  styles.rankNumber,
                  entry.rank === 1 ? styles.rankNumberFirst : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-hidden="true"
              >
                {RANK_ICONS[entry.rank - 1] ?? `${entry.rank}th`}
              </span>
              <span className={styles.rankNickname}>
                {entry.nickname}
                {isMe && (
                  <span style={{ color: 'var(--yacht-accent)', marginLeft: '6px', fontSize: '0.8rem' }}>
                    (나)
                  </span>
                )}
              </span>
              {entry.isWinner && (
                <span className={styles.winnerBadge}>WIN</span>
              )}
              <span className={styles.rankScore}>{entry.grandTotal.toLocaleString()}점</span>
            </li>
          );
        })}
      </ol>

      <button
        type="button"
        className={styles.btnSecondary}
        onClick={onLeave}
        style={{ marginTop: '8px' }}
      >
        홈으로 돌아가기
      </button>
    </div>
  );
}
