import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { adminStatsApi, adminGameApi } from '../../api/admin';
import type { StatsSummary, AdminGameStatus } from '../../api/admin';
import s from './admin.module.css';

const GAME_LABELS: Record<string, string> = {
  minesweeper: '지뢰찾기',
  solitaire: '솔리테어',
  apple: '사과게임',
  baseball: '숫자야구',
  blockfall: '블록폴',
  sudoku: '스도쿠',
};

const GAME_ORDER = ['minesweeper', 'solitaire', 'apple', 'baseball', 'blockfall', 'sudoku'];

export default function AdminDashboardPage() {
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [rankings, setRankings] = useState<{ game: string; count: number }[]>([]);
  const [weeklyRankings, setWeeklyRankings] = useState<{ date: string; count: number }[]>([]);
  const [gameStatuses, setGameStatuses] = useState<AdminGameStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    Promise.all([
      adminStatsApi.summary(accessToken),
      adminStatsApi.rankings(accessToken),
      adminStatsApi.weeklyRankings(accessToken),
      adminGameApi.list(accessToken),
    ])
      .then(([sum, rank, weekly, games]) => {
        setSummary(sum);
        setRankings(rank);
        setWeeklyRankings(weekly);
        setGameStatuses(games);
      })
      .catch(() => setError('통계를 불러오지 못했습니다'))
      .finally(() => setLoading(false));
  }, [accessToken]);

  if (loading) return <div style={{ padding: 40, color: '#999', fontSize: 12, letterSpacing: '1px' }}>LOADING...</div>;
  if (error) return <div className={s.error} style={{ padding: 20 }}>{error}</div>;
  if (!summary) return null;

  const totalWeeklyRankings = weeklyRankings.reduce((a, b) => a + Number(b.count), 0);
  const maxRanking = Math.max(...rankings.map(r => Number(r.count)), 1);
  const maxWeekly = Math.max(...weeklyRankings.map(r => Number(r.count)), 1);

  const sortedRankings = GAME_ORDER
    .map(key => rankings.find(r => r.game === key) ?? { game: key, count: 0 });

  return (
    <div className={s.page}>

      {/* ── 유저 현황 ── */}
      <SectionLabel>유저 관리</SectionLabel>
      <div className={s.cardGrid} style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 1 }}>
        <StatCard label="전체 유저" value={summary.totalUsers} onClick={() => navigate('/admin/users')} />
        <StatCard label="활성" value={summary.activeUsers} color="#16a34a" onClick={() => navigate('/admin/users?status=ACTIVE')} />
        <StatCard label="대기" value={summary.pendingUsers} color="#d97706" onClick={() => navigate('/admin/users?status=PENDING')} />
        <StatCard label="차단" value={summary.bannedUsers} color="#dc2626" onClick={() => navigate('/admin/users?status=BANNED')} />
      </div>

      {/* ── 시스템 현황 ── */}
      <SectionLabel style={{ marginTop: 24 }}>시스템 현황</SectionLabel>
      <div className={s.cardGrid} style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 1 }}>
        <StatCard
          label="미답변 문의"
          value={summary.unreadContacts}
          subLabel={`전체 ${summary.totalContacts.toLocaleString()}`}
          color={summary.unreadContacts > 0 ? '#dc2626' : undefined}
          onClick={() => navigate('/admin/contacts')}
        />
        <StatCard
          label="IP 차단"
          value={summary.ipBanCount}
          onClick={() => navigate('/admin/ip-bans')}
        />
        <StatCard
          label="패치노트"
          value={summary.patchNoteCount}
          onClick={() => navigate('/admin/patch-notes')}
        />
        <StatCard
          label="활성 게임"
          value={summary.activeGames}
          subLabel={`전체 ${summary.totalGames}`}
          color="#16a34a"
          onClick={() => navigate('/admin/games')}
        />
      </div>

      {/* ── 기록 현황 + 주간 랭킹 ── */}
      <SectionLabel style={{ marginTop: 24 }}>기록 현황</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid #e8e8e8', gap: 1, background: '#e8e8e8' }}>

        {/* 게임별 기록 레코드 수 */}
        <div style={{ padding: '20px', background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <span className={s.sectionTitle}>게임별 등록 기록 수</span>
            <span style={{ fontSize: 11, color: '#888' }}>DB 레코드</span>
          </div>
          {sortedRankings.map(r => (
            <div key={r.game} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: '#333', fontWeight: 500 }}>{GAME_LABELS[r.game] ?? r.game}</span>
                <span style={{ fontSize: 11, color: '#888', fontVariantNumeric: 'tabular-nums' }}>{Number(r.count).toLocaleString()}</span>
              </div>
              <div style={{ background: '#e0e0e0', height: 2 }}>
                <div style={{
                  width: `${(Number(r.count) / maxRanking) * 100}%`,
                  height: '100%',
                  background: '#111',
                  transition: 'width 0.6s ease',
                }} />
              </div>
            </div>
          ))}
        </div>

        {/* 이번 주 랭킹 등록 추이 */}
        <div style={{ padding: '20px', background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <span className={s.sectionTitle}>이번 주 랭킹 등록 (월~일)</span>
            <span style={{ fontSize: 11, color: '#888', fontVariantNumeric: 'tabular-nums' }}>
              합계 {totalWeeklyRankings.toLocaleString()}
            </span>
          </div>
          {weeklyRankings.length === 0
            ? <div className={s.empty}>데이터 없음</div>
            : (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 100 }}>
                  {weeklyRankings.map(item => (
                    <div
                      key={item.date}
                      title={`${item.date}: ${item.count}건`}
                      style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}
                    >
                      <div style={{
                        width: '100%',
                        height: `${Math.max((Number(item.count) / maxWeekly) * 100, maxWeekly > 0 ? 2 : 0)}%`,
                        background: Number(item.count) === maxWeekly && maxWeekly > 0 ? '#111' : '#d4d4d4',
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
                        {weeklyRankings[i] ? Number(weeklyRankings[i].count).toLocaleString() : 0}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )
          }
        </div>
      </div>

      {/* ── 게임 관리 현황 ── */}
      <SectionLabel style={{ marginTop: 24 }}>게임 관리</SectionLabel>
      <div style={{ border: '1px solid #e8e8e8', background: '#fff', padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {GAME_ORDER.map(key => {
            const gs = gameStatuses.find(g => g.gameKey === key);
            const active = gs?.active ?? false;
            return (
              <div
                key={key}
                onClick={() => navigate('/admin/games')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 14px',
                  border: `1px solid ${active ? '#bbf7d0' : '#e5e5e5'}`,
                  borderRadius: 3,
                  background: active ? '#f0fdf4' : '#fafafa',
                  cursor: 'pointer',
                  transition: 'opacity 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: active ? '#16a34a' : '#d4d4d4',
                }} />
                <span style={{ fontSize: 12, color: '#333', fontWeight: 500 }}>{GAME_LABELS[key] ?? key}</span>
                <span style={{ fontSize: 10, color: active ? '#16a34a' : '#aaa', fontWeight: 600 }}>
                  {active ? 'ON' : 'OFF'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}

function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      fontSize: 9,
      fontWeight: 700,
      color: '#999',
      letterSpacing: '1.5px',
      textTransform: 'uppercase',
      marginBottom: 8,
      ...style,
    }}>
      {children}
    </div>
  );
}

function StatCard({
  label, value, subLabel, color, onClick,
}: {
  label: string;
  value: number;
  subLabel?: string;
  color?: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={s.card}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : undefined, transition: 'background 0.1s' }}
      onMouseEnter={e => { if (onClick) (e.currentTarget as HTMLElement).style.background = '#fafafa'; }}
      onMouseLeave={e => { if (onClick) (e.currentTarget as HTMLElement).style.background = '#fff'; }}
    >
      <div className={s.cardLabel}>{label}</div>
      <div className={s.cardValue} style={color ? { color } : undefined}>
        {value.toLocaleString()}
      </div>
      {subLabel && (
        <div style={{ fontSize: 10, color: '#aaa', marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
          {subLabel}
        </div>
      )}
    </div>
  );
}
