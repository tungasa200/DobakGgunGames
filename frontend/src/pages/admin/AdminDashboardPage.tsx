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
      adminStatsApi.weeklySessions(accessToken),
      adminStatsApi.games(accessToken),
    ])
      .then(([s, sess, g]) => { setSummary(s); setSessions(sess); setGames(g); })
      .catch(() => setError('통계를 불러오지 못했습니다'))
      .finally(() => setLoading(false));
  }, [accessToken]);

  if (loading) return <div style={{ padding: 40, color: '#999', fontSize: 12, letterSpacing: '1px' }}>LOADING...</div>;
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
        <StatCard label="활성 유저" value={summary.activeUsers} color="#16a34a" />
        <StatCard label="대기 유저" value={summary.pendingUsers} color="#d97706" />
        <StatCard label="차단 유저" value={summary.bannedUsers} color="#dc2626" />
        <StatCard label="전체 세션" value={summary.totalSessions} />
        <StatCard
          label="미답변 문의"
          value={summary.unreadContacts}
          color={summary.unreadContacts > 0 ? '#dc2626' : undefined}
        />
      </div>

      {/* 하단 2패널 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid #e8e8e8', gap: 1, background: '#e8e8e8' }}>

        {/* 게임별 세션 */}
        <div style={{ padding: '20px', background: '#fff' }}>
          <div style={{ marginBottom: 20 }}>
            <div className={s.sectionTitle}>게임별 전체 세션</div>
          </div>
          {games.length === 0
            ? <div className={s.empty}>데이터 없음</div>
            : games.map(g => (
              <div key={g.game} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: '#333', fontWeight: 500 }}>{GAME_LABELS[g.game] ?? g.game}</span>
                  <span style={{ fontSize: 11, color: '#888', fontVariantNumeric: 'tabular-nums' }}>{Number(g.count).toLocaleString()}</span>
                </div>
                <div style={{ background: '#e0e0e0', height: 2 }}>
                  <div style={{
                    width: `${(Number(g.count) / maxGame) * 100}%`,
                    height: '100%',
                    background: '#111',
                    transition: 'width 0.6s ease',
                  }} />
                </div>
              </div>
            ))
          }
        </div>

        {/* 이번 주 세션 추이 (월~일) */}
        <div style={{ padding: '20px', background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div className={s.sectionTitle}>이번 주 세션 추이 (월~일)</div>
            <span style={{ fontSize: 11, color: '#888', fontVariantNumeric: 'tabular-nums' }}>
              합계 {totalSessions.toLocaleString()}
            </span>
          </div>
          {sessions.length === 0
            ? <div className={s.empty}>데이터 없음</div>
            : (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 90 }}>
                  {sessions.map(item => (
                    <div
                      key={item.date}
                      title={`${item.date}: ${item.count}세션`}
                      style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}
                    >
                      <div style={{
                        width: '100%',
                        height: `${Math.max((Number(item.count) / maxCount) * 100, maxCount > 0 ? 2 : 0)}%`,
                        background: Number(item.count) === maxCount && maxCount > 0 ? '#111' : '#e0e0e0',
                        transition: 'height 0.4s ease',
                      }} />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', marginTop: 8, fontSize: 10, color: '#aaa' }}>
                  {['월', '화', '수', '목', '금', '토', '일'].map((day, i) => (
                    <div key={day} style={{ flex: 1, textAlign: 'center' }}>
                      <div>{day}</div>
                      <div style={{ fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
                        {sessions[i] ? Number(sessions[i].count).toLocaleString() : 0}
                      </div>
                    </div>
                  ))}
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
