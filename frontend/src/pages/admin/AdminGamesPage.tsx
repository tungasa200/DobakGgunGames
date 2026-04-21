import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { adminGameApi } from '../../api/admin';
import type { AdminGameStatus } from '../../api/admin';
import s from './admin.module.css';

const GAME_LABELS: Record<string, { name: string; icon: string }> = {
  minesweeper: { name: '지뢰찾기', icon: '💣' },
  baseball:    { name: '숫자야구', icon: '⚾' },
  blockfall:   { name: '블록폴',   icon: '🟦' },
  apple:       { name: '사과게임', icon: '🍎' },
  solitaire:   { name: '솔리테어', icon: '🃏' },
};

export default function AdminGamesPage() {
  const { accessToken } = useAuth();
  const [games, setGames] = useState<AdminGameStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function load() {
    if (!accessToken) return;
    setLoading(true);
    try {
      setGames(await adminGameApi.list(accessToken));
    } catch {
      setError('목록을 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [accessToken]);

  async function handleToggle(key: string, currentActive: boolean) {
    if (!accessToken) return;
    const label = GAME_LABELS[key]?.name ?? key;
    const next = !currentActive;
    const msg = next
      ? `${label}을(를) 활성화하시겠습니까?`
      : `${label}을(를) 비활성화하시겠습니까?\n일반 사용자는 해당 게임에 접근할 수 없습니다.`;
    if (!confirm(msg)) return;

    setToggling(key);
    try {
      const updated = await adminGameApi.setActive(accessToken, key, next);
      setGames(prev => prev.map(g => g.gameKey === key ? updated : g));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '변경 실패');
    } finally {
      setToggling(null);
    }
  }

  return (
    <div className={s.page}>
      <div className={s.heading}>게임 관리</div>

      {error && <div className={s.error}>{error}</div>}

      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>게임</th>
              <th>상태</th>
              <th>설명</th>
              <th>활성/비활성</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className={s.empty}>불러오는 중...</td></tr>
            ) : games.length === 0 ? (
              <tr><td colSpan={4} className={s.empty}>게임 목록이 없습니다</td></tr>
            ) : games.map(g => {
              const meta = GAME_LABELS[g.gameKey];
              const isToggling = toggling === g.gameKey;
              return (
                <tr key={g.gameKey}>
                  <td>
                    <span style={{ marginRight: 6 }}>{meta?.icon}</span>
                    <strong>{meta?.name ?? g.gameKey}</strong>
                    <span style={{ marginLeft: 6, fontSize: 11, color: '#aaa' }}>{g.gameKey}</span>
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 10px',
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: 700,
                      background: g.active ? '#e8f5e9' : '#fce4ec',
                      color: g.active ? '#2e7d32' : '#c62828',
                    }}>
                      {g.active ? '활성' : '비활성'}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: '#888' }}>
                    {g.active
                      ? '모든 사용자가 접근 가능합니다'
                      : '일반 사용자 접근 불가 (점검 중)'}
                  </td>
                  <td>
                    <button
                      className={`${s.btn} ${g.active ? s.btnDanger : s.btnPrimary}`}
                      style={{ fontSize: 12, padding: '4px 14px', minWidth: 70 }}
                      onClick={() => handleToggle(g.gameKey, g.active)}
                      disabled={isToggling}
                    >
                      {isToggling ? '처리 중...' : g.active ? '비활성화' : '활성화'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 16, fontSize: 12, color: '#999', lineHeight: 1.6 }}>
        * 비활성화된 게임은 메인 페이지와 헤더에서 점검 중으로 표시됩니다.<br />
        * 일반 사용자가 URL로 직접 접근하면 메인으로 리다이렉트됩니다.<br />
        * 어드민은 비활성화 상태에서도 게임에 정상 접근할 수 있습니다.
      </div>
    </div>
  );
}
