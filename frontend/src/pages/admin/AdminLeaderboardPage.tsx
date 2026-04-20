import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { adminRankingApi } from '../../api/admin';
import type { AdminLeaderboard, AdminLeaderboardEntry } from '../../api/admin';
import s from './admin.module.css';

const GAMES = [
  { key: 'minesweeper', label: '지뢰찾기' },
  { key: 'solitaire',   label: '솔리테어' },
  { key: 'apple',       label: '사과게임' },
  { key: 'baseball',    label: '숫자야구' },
  { key: 'blockfall',   label: '블록폴' },
];

const LEVEL_LABELS: Record<string, string> = {
  beginner:     '초급',
  intermediate: '중급',
  expert:       '고급',
  easy:         '쉬움',
  normal:       '보통 / 일반',
  hard:         '어려움',
  draw1:        '1장뽑기',
  draw3:        '3장뽑기',
};

function formatScore(game: string, entry: AdminLeaderboardEntry): string {
  switch (game) {
    case 'minesweeper':
      return entry.time != null ? `${Number(entry.time).toFixed(3)}초` : '-';
    case 'solitaire':
      return entry.time != null
        ? `${Number(entry.time).toFixed(1)}초 / ${entry.moves ?? '?'}수`
        : '-';
    case 'baseball':
      return entry.attempts != null
        ? `${entry.attempts}회 시도 / ${entry.time != null ? Number(entry.time).toFixed(1) + '초' : ''}`
        : '-';
    case 'apple':
      return entry.score != null ? `${entry.score}점` : '-';
    case 'blockfall':
      return entry.score != null
        ? `${entry.score.toLocaleString()}점 (Lv.${entry.gameLevel ?? '?'})`
        : '-';
    default:
      return '-';
  }
}

const RANK_BADGE = ['🥇', '🥈', '🥉'];

interface EntryRowProps {
  rank: number;
  entry: AdminLeaderboardEntry;
  game: string;
}
function EntryRow({ rank, entry, game }: EntryRowProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
      <span style={{ fontSize: 16, width: 24, textAlign: 'center' }}>{RANK_BADGE[rank] ?? `${rank + 1}`}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: '#111' }}>{entry.name || '-'}</div>
        <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{formatScore(game, entry)}</div>
      </div>
      <div style={{ fontSize: 10, color: '#bbb' }}>{String(entry.createdAt).slice(0, 10)}</div>
    </div>
  );
}

export default function AdminLeaderboardPage() {
  const { accessToken } = useAuth();
  const [game, setGame]           = useState(GAMES[0].key);
  const [data, setData]           = useState<AdminLeaderboard | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const res = await adminRankingApi.leaderboard(accessToken, game);
      setData(res);
    } catch {
      setError('랭킹 데이터를 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  }, [accessToken, game]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className={s.page}>
      <div className={s.heading}>랭킹 관리</div>

      {/* 게임 탭 */}
      <div className={s.tabs}>
        {GAMES.map(g => (
          <button
            key={g.key}
            className={`${s.tab} ${game === g.key ? s.tabActive : ''}`}
            onClick={() => setGame(g.key)}
          >{g.label}</button>
        ))}
      </div>

      {error && <div className={s.error}>{error}</div>}

      {loading ? (
        <div style={{ padding: 40, color: '#999', fontSize: 12, letterSpacing: '1px' }}>LOADING...</div>
      ) : !data ? null : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {data.levels.map(level => {
            const weeklyList  = data.weekly[level]  ?? [];
            const alltimeBest = data.alltime[level] as AdminLeaderboardEntry | null;

            return (
              <div key={level} style={{ border: '1px solid #e8e8e8', background: '#fff' }}>
                {/* 레벨 헤더 */}
                <div style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #e8e8e8',
                  background: '#fafafa',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#111' }}>
                    {LEVEL_LABELS[level] ?? level}
                  </span>
                </div>

                <div style={{ padding: '0 16px' }}>
                  {/* 이전 주 1~3위 */}
                  <div style={{ paddingTop: 14, paddingBottom: 4 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#999', letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 8 }}>
                      이전 주 1~3위
                    </div>
                    {weeklyList.length === 0 ? (
                      <div style={{ fontSize: 12, color: '#bbb', padding: '8px 0 12px' }}>기록 없음</div>
                    ) : (
                      weeklyList.map((entry, i) => (
                        <EntryRow key={entry.id} rank={i} entry={entry} game={game} />
                      ))
                    )}
                  </div>

                  {/* 역대 1위 */}
                  <div style={{ paddingTop: 12, paddingBottom: 16, borderTop: '1px solid #f0f0f0', marginTop: 4 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#999', letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 8 }}>
                      역대 1위
                    </div>
                    {!alltimeBest ? (
                      <div style={{ fontSize: 12, color: '#bbb', padding: '8px 0' }}>기록 없음</div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
                        <span style={{ fontSize: 16 }}>👑</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: '#111' }}>{alltimeBest.name || '-'}</div>
                          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{formatScore(game, alltimeBest)}</div>
                        </div>
                        <div style={{ fontSize: 10, color: '#bbb' }}>{String(alltimeBest.createdAt).slice(0, 10)}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
