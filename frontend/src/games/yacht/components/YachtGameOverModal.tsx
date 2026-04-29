import styles from './yacht.module.css';
import type { Participant, RankEntry } from '../types/yacht.types';

interface YachtGameOverModalProps {
  rankings: RankEntry[];
  participants: Participant[];
  myUserId: number | null;
  hostUserId: number | null;
  isSpectator: boolean;
  onReady: (isReady: boolean) => void;
  onRestart: () => void;
  onLeave: () => void;
}

const RANK_ICONS = ['1st', '2nd', '3rd', '4th', '5th', '6th'];

export default function YachtGameOverModal({
  rankings,
  participants,
  myUserId,
  hostUserId,
  isSpectator,
  onReady,
  onRestart,
  onLeave,
}: YachtGameOverModalProps) {
  const me = participants.find((p) => p.userId === myUserId);
  const isHost = myUserId !== null && myUserId === hostUserId;
  const isReady = me?.ready ?? false;

  // 방장 외 모두(플레이어+관전자) 준비 완료해야 재시작 가능
  const nonHostParticipants = participants.filter((p) => p.userId !== hostUserId);
  const allNonHostReady = nonHostParticipants.length > 0 && nonHostParticipants.every((p) => p.ready);
  const canRestart = isHost && allNonHostReady && participants.length >= 2;

  const myResult = rankings.find((r) => r.userId === myUserId);
  const isWinner = myResult?.isWinner ?? false;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="yacht-gameover-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: 'var(--yacht-surface, #ffffff)',
          borderRadius: '12px',
          maxWidth: '420px',
          width: '100%',
          maxHeight: '85vh',
          overflowY: 'auto',
          padding: '20px',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <h2
          id="yacht-gameover-title"
          className={styles.resultTitle}
          style={{ margin: 0, textAlign: 'center' }}
        >
          {isSpectator ? 'Game Over' : isWinner ? 'Victory!' : 'Game Over'}
        </h2>

        {isSpectator && (
          <p style={{ color: 'var(--yacht-text-sub)', fontSize: '0.9rem', margin: 0, textAlign: 'center' }}>
            관전 종료 — 이번 판은 게임에 합류하지 않았습니다
          </p>
        )}

        {myResult && (
          <p style={{ color: 'var(--yacht-text-sub)', fontSize: '0.9rem', margin: 0, textAlign: 'center' }}>
            내 순위: {myResult.rank}위 ({myResult.grandTotal}점)
          </p>
        )}

        <ol className={styles.rankingList} aria-label="최종 순위" style={{ margin: 0 }}>
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
                {entry.isWinner && <span className={styles.winnerBadge}>WIN</span>}
                <span className={styles.rankScore}>{entry.grandTotal.toLocaleString()}점</span>
              </li>
            );
          })}
        </ol>

        {/* 참가자 준비 상태 (관전자 포함) */}
        {participants.length > 0 && (
          <div
            style={{
              fontSize: '0.78rem',
              color: 'var(--yacht-text-sub)',
              borderTop: '1px solid var(--yacht-border)',
              paddingTop: '10px',
            }}
          >
            <div style={{ marginBottom: '6px', fontWeight: 600 }}>다음 판 참가</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {participants.map((p) => {
                const pIsHost = p.userId === hostUserId;
                return (
                  <li key={p.userId} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>
                      {p.nickname}
                      {p.userId === myUserId && ' (나)'}
                      {pIsHost && ' · 방장'}
                    </span>
                    <span style={{ color: pIsHost || p.ready ? 'var(--yacht-accent2)' : 'var(--yacht-text-sub)' }}>
                      {pIsHost ? '대기' : p.ready ? '준비완료' : '준비 안함'}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* 액션 버튼 */}
        <div className={styles.waitingBtns} style={{ marginTop: '4px' }}>
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
              onClick={onRestart}
              disabled={!canRestart}
              title={
                !canRestart
                  ? participants.length < 2
                    ? '2명 이상 필요합니다'
                    : '모든 참가자가 준비를 완료해야 합니다'
                  : undefined
              }
            >
              재시작
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
