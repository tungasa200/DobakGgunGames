import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { adminStatsApi } from '../../api/admin';
import type { StatsSummary } from '../../api/admin';
import s from './admin.module.css';

const GAME_LABELS: Record<string, string> = {
  minesweeper: '지뢰찾기',
  solitaire: '솔리테어',
  apple: '사과게임',
  baseball: '숫자야구',
  blockfall: '블록폴',
};

export default function AdminDashboardPage() {
  const { accessToken } = useAuth();
  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [sessions, setSessions] = useState<{ date: string; count: number }[]>([]);
  const [games, setGames] = useState<{ game: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    Promise.all([
      adminStatsApi.summary(accessToken),
      adminStatsApi.sessions(accessToken, 30),
      adminStatsApi.games(accessToken),
    ])
      .then(([s, sess, g]) => { setSummary(s); setSessions(sess); setGames(g); })
      .catch(() => setError('통계를 불러오지 못했습니다'))
      .finally(() => setLoading(false));
  }, [accessToken]);

  if (loading) return <div style={{ padding: 40, color: '#2a2a2a', fontSize: 12, letterSpacing: '1px' }}>LOADING...</div>;
  if (error) return <div className={s.error} style={{ padding: 20 }}>{error}</div>;
  if (!summary) return null;

  const totalSessions = sessions.reduce((a, b) => a + Number(b.count), 0);
  const maxCount = Math.max(...sessions.map(s => Number(s.count)), 1);
  const maxGame = Math.max(...games.map(g => Number(g.count)), 1);

  return (
    <div className={s.page}>

      {/* 지표 카드 6개 */}
      <div className={s.cardGrid}>
        <StatCard label="전체 유저" value={summary.totalUsers} />
        <StatCard label="활성 유저" value={summary.activeUsers} color="#3a9a50" />
        <StatCard label="대기 유저" value={summary.pendingUsers} color="#a08040" />
        <StatCard label="차단 유저" value={summary.bannedUsers} color="#c05050" />
        <StatCard label="전체 세션" value={summary.totalSessions} />
        <StatCard
          label="미답변 문의"
          value={summary.unreadContacts}
          color={summary.unreadContacts > 0 ? '#c05050' : undefined}
        />
      </div>

      {/* 하단 2패널 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid #141414' }}>

        {/* 게임별 세션 */}
        <div style={{ padding: '20px', background: '#050505', borderRight: '1px solid #141414' }}>
          <div style={{ marginBottom: 20 }}>
            <div className={s.sectionTitle}>게임별 전체 세션</div>
          </div>
          {games.length === 0
            ? <div className={s.empty}>데이터 없음</div>
            : games.map(g => (
              <div key={g.game} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: '#888', fontWeight: 500 }}>{GAME_LABELS[g.game] ?? g.game}</span>
                  <span style={{ fontSize: 11, color: '#333', fontVariantNumeric: 'tabular-nums' }}>{Number(g.count).toLocaleString()}</span>
                </div>
                <div style={{ background: '#0f0f0f', height: 1, position: 'relative' }}>
                  <div style={{
                    position: 'absolute',
                    left: 0, top: 0,
                    width: `${(Number(g.count) / maxGame) * 100}%`,
                    height: '100%',
                    background: '#e8e8e8',
                    transition: 'width 0.6s ease',
                  }} />
                </div>
              </div>
            ))
          }
        </div>

        {/* 30일 세션 추이 */}
        <div style={{ padding: '20px', background: '#050505' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div className={s.sectionTitle}>최근 30일 세션 추이</div>
            <span style={{ fontSize: 11, color: '#2a2a2a', fontVariantNumeric: 'tabular-nums' }}>
              합계 {totalSessions.toLocaleString()}
            </span>
          </div>
          {sessions.length === 0
            ? <div className={s.empty}>데이터 없음</div>
            : (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 90 }}>
                  {sessions.map(item => (
                    <div
                      key={item.date}
                      title={`${item.date}: ${item.count}`}
                      style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}
                    >
                      <div style={{
                        width: '100%',
                        height: `${Math.max((Number(item.count) / maxCount) * 100, 2)}%`,
                        background: Number(item.count) === maxCount ? '#e8e8e8' : '#222',
                        transition: 'height 0.4s ease',
                      }} />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, color: '#222', letterSpacing: '0.5px' }}>
                  <span>{sessions[0]?.date?.slice(5)}</span>
                  <span>{sessions[sessions.length - 1]?.date?.slice(5)}</span>
                </div>
              </>
            )
          }
        </div>
      </div>

    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className={s.card}>
      <div className={s.cardLabel}>{label}</div>
      <div className={s.cardValue} style={color ? { color } : undefined}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}
