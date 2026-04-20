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

  if (loading) return <div style={{ padding: 40, color: '#9ca3af' }}>불러오는 중...</div>;
  if (error) return <div className={s.error} style={{ padding: 20 }}>{error}</div>;
  if (!summary) return null;

  const totalSessions = sessions.reduce((a, b) => a + Number(b.count), 0);
  const maxCount = Math.max(...sessions.map(s => Number(s.count)), 1);
  const maxGame = Math.max(...games.map(g => Number(g.count)), 1);

  return (
    <div className={s.page}>
      <div className={s.heading}>대시보드</div>

      {/* 요약 카드 */}
      <div className={s.cardGrid}>
        <div className={s.card}>
          <div className={s.cardLabel}>전체 유저</div>
          <div className={s.cardValue}>{summary.totalUsers.toLocaleString()}</div>
        </div>
        <div className={s.card}>
          <div className={s.cardLabel}>활성 유저</div>
          <div className={s.cardValue} style={{ color: '#10b981' }}>{summary.activeUsers.toLocaleString()}</div>
        </div>
        <div className={s.card}>
          <div className={s.cardLabel}>대기 유저</div>
          <div className={s.cardValue} style={{ color: '#f59e0b' }}>{summary.pendingUsers.toLocaleString()}</div>
        </div>
        <div className={s.card}>
          <div className={s.cardLabel}>차단 유저</div>
          <div className={s.cardValue} style={{ color: '#ef4444' }}>{summary.bannedUsers.toLocaleString()}</div>
        </div>
        <div className={s.card}>
          <div className={s.cardLabel}>전체 세션</div>
          <div className={s.cardValue}>{summary.totalSessions.toLocaleString()}</div>
        </div>
        <div className={s.card}>
          <div className={s.cardLabel}>미답변 문의</div>
          <div className={s.cardValue} style={{ color: summary.unreadContacts > 0 ? '#ef4444' : '#1f2937' }}>
            {summary.unreadContacts}
          </div>
        </div>
      </div>

      {/* 게임별 플레이 수 */}
      {games.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 10, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: 28 }}>
          <div className={s.sectionTitle}>게임별 전체 세션</div>
          {games.map(g => (
            <div key={g.game} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                <span style={{ color: '#374151', fontWeight: 500 }}>{GAME_LABELS[g.game] ?? g.game}</span>
                <span style={{ color: '#6b7280' }}>{Number(g.count).toLocaleString()}</span>
              </div>
              <div style={{ background: '#f3f4f6', borderRadius: 4, height: 10, overflow: 'hidden' }}>
                <div style={{
                  width: `${(Number(g.count) / maxGame) * 100}%`,
                  height: '100%',
                  background: '#6366f1',
                  borderRadius: 4,
                  transition: 'width 0.5s',
                }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 최근 30일 세션 추이 */}
      {sessions.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 10, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div className={s.sectionTitle} style={{ marginBottom: 0 }}>최근 30일 세션 추이</div>
            <span style={{ fontSize: 13, color: '#6b7280' }}>합계: {totalSessions.toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 100, overflowX: 'auto' }}>
            {sessions.map(item => (
              <div key={item.date} title={`${item.date}: ${item.count}`} style={{ flex: '0 0 auto', width: 20 }}>
                <div style={{
                  width: '100%',
                  height: `${(Number(item.count) / maxCount) * 100}%`,
                  minHeight: 2,
                  background: '#6366f1',
                  borderRadius: '2px 2px 0 0',
                  opacity: 0.8,
                }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11, color: '#9ca3af' }}>
            <span>{sessions[0]?.date?.slice(5)}</span>
            <span>{sessions[sessions.length - 1]?.date?.slice(5)}</span>
          </div>
        </div>
      )}

      {sessions.length === 0 && games.length === 0 && (
        <div className={s.empty}>세션 데이터가 없습니다</div>
      )}
    </div>
  );
}
