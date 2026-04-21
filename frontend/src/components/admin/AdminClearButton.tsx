import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { adminRankingApi } from '../../api/admin';
import s from './AdminClearButton.module.css';

const GAMES = [
  { key: 'baseball',       label: '숫자야구' },
  { key: 'minesweeper',    label: '지뢰찾기' },
  { key: 'apple',          label: '사과게임' },
  { key: 'solitaire',      label: '솔리테어' },
  { key: 'sudoku',         label: '스도쿠' },
  { key: 'blockfall',      label: '블록폴' },
  { key: 'blockfall-insane', label: '블록폴 인세인' },
];

export default function AdminClearButton() {
  const { user, accessToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  if (user?.role !== 'ADMIN') return null;

  async function handleClear(gameKey: string) {
    if (!accessToken) return;
    if (!confirm(`[${GAMES.find(g => g.key === gameKey)?.label}] 랭킹을 전체 초기화할까요?`)) return;
    setLoading(gameKey);
    setMsg(null);
    try {
      await adminRankingApi.deleteAll(accessToken, gameKey);
      setMsg({ text: `${gameKey} 랭킹 초기화 완료`, ok: true });
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : '오류 발생', ok: false });
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className={s.wrapper}>
      {open && (
        <div className={s.panel}>
          <div className={s.panelHeader}>랭킹 초기화</div>
          {msg && (
            <div className={`${s.msg} ${msg.ok ? s.msgOk : s.msgErr}`}>{msg.text}</div>
          )}
          <ul className={s.list}>
            {GAMES.map(g => (
              <li key={g.key} className={s.item}>
                <span className={s.gameLabel}>{g.label}</span>
                <button
                  className={s.clearBtn}
                  onClick={() => handleClear(g.key)}
                  disabled={loading === g.key}
                >
                  {loading === g.key ? '...' : 'Clear'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button
        className={`${s.fab} ${open ? s.fabOpen : ''}`}
        onClick={() => { setOpen(v => !v); setMsg(null); }}
        title="API 테스트 — 랭킹 초기화"
      >
        {open ? '✕' : '🧹'}
      </button>
    </div>
  );
}
