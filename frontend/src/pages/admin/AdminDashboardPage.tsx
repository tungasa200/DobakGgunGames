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

  if (loading) return <div style={{ padding: 32, color: '#333', fontSize: 13 }}>불러오는 중...</div>;
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
          <div className={s.cardValue} style={{ color: '#4ade80' }}>{summary.activeUsers.toLocaleString()}</div>
        </div>
        <div className={s.card}>
          <div className={s.cardLabel}>대기 유저</div>
          <div className={s.cardValue} style={{ color: '#fbbf24' }}>{summary.pendingUsers.toLocaleString()}</div>
        </div>
        <div className={s.card}>
          <div className={s.cardLabel}>차단 유저</div>
          <div className={s.cardValue} style={{ color: '#f87171' }}>{summary.bannedUsers.toLocaleString()}</div>
        </div>
        <div className={s.card}>
          <div className={s.cardLabel}>전체 세션</div>
          <div className={s.cardValue}>{summary.totalSessions.toLocaleString()}</div>
        </div>
        <div className={s.card}>
          <div className={s.cardLabel}>미답변 문의</div>
          <div className={s.cardValue} style={{ color: summary.unreadContacts > 0 ? '#f87171' : '#fff' }}>
            {summary.unreadContacts}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: '#1c1c1c', border: '1px solid #1c1c1c', borderRadius: 4, overflow: 'hidden', marginTop: 16 }}>
        {/* 게임별 플레이 수 */}
        {games.length > 0 && (
          <div style={{ background: '#111', padding: '18px 20px' }}>
            <div className={s.sectionTitle}>게임별 전체 세션</div>
            {games.map(g => (
              <div key={g.game} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 12 }}>
                  <span style={{ color: '#aaa', fontWeight: 500 }}>{GAME_LABELS[g.game] ?? g.game}</span>
                  <span style={{ color: '#444' }}>{Number(g.count).toLocaleString()}</span>
                </div>
                <div style={{ background: '#1a1a1a', height: 2, overflow: 'hidden' }}>
                  <div style={{
                    width: `${(Number(g.count) / maxGame) * 100}%`,
                    height: '100%',
                    background: '#fff',
                    transition: 'width 0.5s',
                  }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 최근 30일 세션 추이 */}
        {sessions.length > 0 && (
          <div style={{ background: '#111', padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className={s.sectionTitle} style={{ marginBottom: 0 }}>최근 30일 세션 추이</div>
              <span style={{ fontSize: 11, color: '#333', letterSpacing: '0.5px' }}>합계: {totalSessions.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 80, overflowX: 'auto' }}>
              {sessions.map(item => (
                <div key={item.date} title={`${item.date}: ${item.count}`} style={{ flex: '0 0 auto', width: 16 }}>
                  <div style={{
                    width: '100%',
                    height: `${(Number(item.count) / maxCount) * 100}%`,
                    minHeight: 1,
                    background: '#fff',
                    opacity: 0.6,
                  }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: '#2a2a2a', letterSpacing: '0.5px' }}>
              <span>{sessions[0]?.date?.slice(5)}</span>
              <span>{sessions[sessions.length - 1]?.date?.slice(5)}</span>
            </div>
          </div>
        )}
      </div>

      {sessions.length === 0 && games.length === 0 && (
        <div className={s.empty}>세션 데이터가 없습니다</div>
      )}
    </div>
  );
}
