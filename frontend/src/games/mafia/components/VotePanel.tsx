import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import type { Player, Phase } from '../types';

interface VotePanelProps {
  players: Player[];
  phase: Phase;
  myVoteTarget: string | undefined;
  eliminatedThisRound: string | undefined;
  onVote: (id: string) => void;
  onConfirmVote: () => void;
}

function getVoteCounts(players: Player[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of players) {
    if (p.voteTarget) {
      counts[p.voteTarget] = (counts[p.voteTarget] ?? 0) + 1;
    }
  }
  return counts;
}

export default function VotePanel({
  players,
  phase,
  myVoteTarget,
  eliminatedThisRound,
  onVote,
  onConfirmVote,
}: VotePanelProps) {
  const barsRef = useRef<Record<string, HTMLDivElement | null>>({});

  const isVoteResult = phase === 'voteResult';
  const totalVoters = players.filter(p => p.alive).length;
  const voteCounts = getVoteCounts(players);

  // Animate bar widths via GSAP when entering voteResult phase
  useEffect(() => {
    if (!isVoteResult) return;
    const timeout = setTimeout(() => {
      for (const [id, el] of Object.entries(barsRef.current)) {
        if (!el) continue;
        const count = voteCounts[id] ?? 0;
        const pct = totalVoters > 0 ? (count / totalVoters) * 100 : 0;
        gsap.to(el, { width: `${pct}%`, duration: 0.9, ease: 'power2.out' });
      }
    }, 100);
    return () => clearTimeout(timeout);
  }, [isVoteResult]); // eslint-disable-line react-hooks/exhaustive-deps

  if (phase !== 'vote' && phase !== 'voteResult') return null;

  const alivePlayers = players.filter(p => p.alive);

  return (
    <div className="vote-panel glass-panel">
      <p className="vote-panel-title">
        {isVoteResult ? '투표 결과' : '마피아를 추방하세요'}
      </p>
      <div className="vote-players-grid">
        {alivePlayers.map(player => {
          const isSelected = myVoteTarget === player.id;
          const isEliminated = isVoteResult && eliminatedThisRound === player.id;
          const voteCount = voteCounts[player.id] ?? 0;

          return (
            <div
              key={player.id}
              className={[
                'vote-player-item',
                isSelected ? 'selected' : '',
                player.isMe ? 'is-me' : '',
              ].join(' ')}
              onClick={() => {
                if (!isVoteResult && !player.isMe) onVote(player.id);
              }}
            >
              {isSelected && !isVoteResult && (
                <span className="vote-check-icon">✓</span>
              )}
              <span className="vote-player-name">{player.name}</span>
              {player.isMe && (
                <span style={{ fontSize: '11px', color: 'var(--mafia-gold)', letterSpacing: '0.05em' }}>나</span>
              )}
              {isVoteResult && (
                <>
                  <div className="vote-player-votes-bar-wrap">
                    <div
                      className="vote-player-votes-bar"
                      ref={el => { barsRef.current[player.id] = el; }}
                      style={{ width: '0%' }}
                    />
                  </div>
                  <div className="vote-player-vote-count">
                    {voteCount > 0 ? `${voteCount}표` : ''}
                  </div>
                </>
              )}
              {isEliminated && (
                <div className="vote-eliminated-badge">💀</div>
              )}
            </div>
          );
        })}
      </div>
      {!isVoteResult && (
        <button
          className="vote-confirm-btn"
          onClick={onConfirmVote}
          disabled={!myVoteTarget}
        >
          투표 완료
        </button>
      )}
      {isVoteResult && eliminatedThisRound && (
        <div style={{
          textAlign: 'center',
          padding: '8px',
          fontSize: '14px',
          color: 'var(--mafia-red)',
          fontWeight: 700,
          letterSpacing: '0.05em',
        }}>
          {players.find(p => p.id === eliminatedThisRound)?.name} 님이 추방되었습니다
        </div>
      )}
    </div>
  );
}
