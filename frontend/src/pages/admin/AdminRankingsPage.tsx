import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { adminRankingApi } from '../../api/admin';
import type { AdminRanking } from '../../api/admin';
import s from './admin.module.css';

const GAMES = [
  { key: 'minesweeper', label: '지뢰찾기' },
  { key: 'solitaire', label: '솔리테어' },
  { key: 'apple', label: '사과게임' },
  { key: 'baseball', label: '숫자야구' },
  { key: 'blockfall', label: '블록폴' },
];

export default function AdminRankingsPage() {
  const { accessToken } = useAuth();
  const [game, setGame] = useState(GAMES[0].key);
  const [rankings, setRankings] = useState<AdminRanking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetConfirm, setResetConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const res = await adminRankingApi.list(accessToken, game);
      setRankings(res);
    } catch { setError('랭킹을 불러오지 못했습니다'); }
    finally { setLoading(false); }
  }, [accessToken, game]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: number) {
    if (!accessToken || !confirm('이 기록을 삭제하시겠습니까?')) return;
    try {
      await adminRankingApi.deleteOne(accessToken, game, id);
      load();
    } catch { setError('삭제 실패'); }
  }

  async function handleResetAll() {
    if (!accessToken) return;
    setActionLoading(true);
    try {
      await adminRankingApi.deleteAll(accessToken, game);
      setResetConfirm(false);
      load();
    } catch { setError('초기화 실패'); }
    finally { setActionLoading(false); }
  }

  const gameLabel = GAMES.find(g => g.key === game)?.label ?? game;

  return (
    <div className={s.page}>
      <div className={s.heading}>랭킹 관리</div>

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

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button
          className={`${s.btn} ${s.btnDanger}`}
          onClick={() => setResetConfirm(true)}
          disabled={rankings.length === 0}
        >
          전체 초기화
        </button>
      </div>

      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr><th>#</th><th>닉네임</th><th>점수</th><th>등록일</th><th>삭제</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className={s.empty}>불러오는 중...</td></tr>
            ) : rankings.length === 0 ? (
              <tr><td colSpan={5} className={s.empty}>랭킹 데이터가 없습니다</td></tr>
            ) : rankings.map((r, i) => (
              <tr key={r.id}>
                <td>{i + 1}</td>
                <td>{r.nickname}</td>
                <td>{r.score}</td>
                <td style={{ fontSize: 12, color: '#9ca3af' }}>{String(r.createdAt)?.slice(0, 10)}</td>
                <td>
                  <button className={`${s.btn} ${s.btnDanger}`} style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => handleDelete(r.id)}>삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {resetConfirm && (
        <div className={s.overlay} onClick={() => setResetConfirm(false)}>
          <div className={s.modal} onClick={e => e.stopPropagation()}>
            <div className={s.modalTitle}>{gameLabel} 랭킹 전체 초기화</div>
            <div style={{ fontSize: 14, color: '#6b7280' }}>
              {gameLabel} 랭킹 {rankings.length}개를 모두 삭제합니다. 복구할 수 없습니다.
            </div>
            <div className={s.modalActions}>
              <button className={`${s.btn} ${s.btnGhost}`} onClick={() => setResetConfirm(false)}>취소</button>
              <button className={`${s.btn} ${s.btnDanger}`} onClick={handleResetAll} disabled={actionLoading}>
                {actionLoading ? '초기화 중...' : '전체 삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
