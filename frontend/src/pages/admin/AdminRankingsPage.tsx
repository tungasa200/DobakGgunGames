import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { adminRankingApi } from '../../api/admin';
import type { AdminRanking } from '../../api/admin';
import s from './admin.module.css';

const GAMES = [
  { key: 'minesweeper', label: '지뢰찾기' },
  { key: 'solitaire',   label: '솔리테어' },
  { key: 'apple',       label: '사과게임' },
  { key: 'baseball',    label: '숫자야구' },
  { key: 'blockfall',   label: '블록폴' },
];

interface GameConfig {
  levels: string[];
  levelLabel: Record<string, string>;
  columns: { key: string; label: string; fmt: (r: AdminRanking) => string }[];
}

const GAME_CONFIG: Record<string, GameConfig> = {
  minesweeper: {
    levels: ['beginner', 'intermediate', 'expert'],
    levelLabel: { beginner: '초급', intermediate: '중급', expert: '고급' },
    columns: [
      { key: 'time', label: '기록(초)', fmt: r => r.time != null ? Number(r.time).toFixed(3) : '-' },
    ],
  },
  solitaire: {
    levels: ['draw1', 'draw3'],
    levelLabel: { draw1: '1장뽑기', draw3: '3장뽑기' },
    columns: [
      { key: 'time',  label: '기록(초)', fmt: r => r.time  != null ? Number(r.time).toFixed(1)  : '-' },
      { key: 'moves', label: '이동 수',  fmt: r => r.moves != null ? String(r.moves) : '-' },
    ],
  },
  apple: {
    levels: ['normal'],
    levelLabel: { normal: '일반' },
    columns: [
      { key: 'score', label: '점수', fmt: r => r.score != null ? String(r.score) : '-' },
    ],
  },
  baseball: {
    levels: ['easy', 'normal', 'hard'],
    levelLabel: { easy: '쉬움', normal: '보통', hard: '어려움' },
    columns: [
      { key: 'attempts', label: '시도 횟수', fmt: r => r.attempts != null ? String(r.attempts) : '-' },
      { key: 'time',     label: '시간(초)',  fmt: r => r.time     != null ? Number(r.time).toFixed(1) : '-' },
    ],
  },
  blockfall: {
    levels: ['normal'],
    levelLabel: { normal: '일반' },
    columns: [
      { key: 'score',     label: '점수',      fmt: r => r.score     != null ? String(r.score)     : '-' },
      { key: 'gameLevel', label: '도달 레벨', fmt: r => r.gameLevel != null ? String(r.gameLevel) : '-' },
    ],
  },
};

export default function AdminRankingsPage() {
  const { accessToken } = useAuth();
  const [game, setGame]             = useState(GAMES[0].key);
  const [level, setLevel]           = useState('');
  const [fromDate, setFromDate]     = useState('');
  const [toDate, setToDate]         = useState('');
  const [rankings, setRankings]     = useState<AdminRanking[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage]             = useState(0);
  const [hasNext, setHasNext]       = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  const cfg = GAME_CONFIG[game];

  // 게임 변경 시 레벨 초기화
  const handleGameChange = (g: string) => {
    setGame(g);
    setLevel('');
    setPage(0);
  };

  const load = useCallback(async (p = 0) => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const res = await adminRankingApi.list(accessToken, game, {
        level:  level  || undefined,
        from:   fromDate || undefined,
        to:     toDate   || undefined,
        page:   p,
      });
      setRankings(res.content);
      setTotalCount(res.totalCount);
      setHasNext(res.hasNext);
      setPage(p);
    } catch {
      setError('기록을 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  }, [accessToken, game, level, fromDate, toDate]);

  useEffect(() => { load(0); }, [load]);

  async function handleDelete(id: number) {
    if (!accessToken || !confirm('이 기록을 삭제하시겠습니까?')) return;
    try {
      await adminRankingApi.deleteOne(accessToken, game, id);
      load(page);
    } catch { setError('삭제 실패'); }
  }

  const colSpan = 4 + cfg.columns.length;

  return (
    <div className={s.page}>
      <div className={s.heading}>기록 관리</div>

      {/* 게임 탭 */}
      <div className={s.tabs}>
        {GAMES.map(g => (
          <button
            key={g.key}
            className={`${s.tab} ${game === g.key ? s.tabActive : ''}`}
            onClick={() => handleGameChange(g.key)}
          >{g.label}</button>
        ))}
      </div>

      {/* 필터 툴바 */}
      <div className={s.toolbar}>
        {/* 난이도 필터 */}
        <select
          className={s.select}
          value={level}
          onChange={e => { setLevel(e.target.value); setPage(0); }}
        >
          <option value="">전체 난이도</option>
          {cfg.levels.map(l => (
            <option key={l} value={l}>{cfg.levelLabel[l] ?? l}</option>
          ))}
        </select>

        {/* 날짜 범위 */}
        <input
          type="date"
          className={s.searchInput}
          style={{ width: 140 }}
          value={fromDate}
          onChange={e => { setFromDate(e.target.value); setPage(0); }}
        />
        <span style={{ fontSize: 12, color: '#aaa', alignSelf: 'center' }}>~</span>
        <input
          type="date"
          className={s.searchInput}
          style={{ width: 140 }}
          value={toDate}
          onChange={e => { setToDate(e.target.value); setPage(0); }}
        />

        <button
          className={`${s.btn} ${s.btnGhost}`}
          onClick={() => { setLevel(''); setFromDate(''); setToDate(''); setPage(0); }}
        >초기화</button>

        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#aaa', alignSelf: 'center', fontVariantNumeric: 'tabular-nums' }}>
          총 {totalCount.toLocaleString()}건
        </span>
      </div>

      {error && <div className={s.error}>{error}</div>}

      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>닉네임</th>
              <th>난이도</th>
              {cfg.columns.map(c => <th key={c.key}>{c.label}</th>)}
              <th>등록일</th>
              <th>삭제</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={colSpan} className={s.empty}>불러오는 중...</td></tr>
            ) : rankings.length === 0 ? (
              <tr><td colSpan={colSpan} className={s.empty}>기록 데이터가 없습니다</td></tr>
            ) : rankings.map((r, i) => (
              <tr key={r.id}>
                <td style={{ color: '#aaa', fontSize: 11 }}>{page * 50 + i + 1}</td>
                <td style={{ fontWeight: 500 }}>{r.name || '-'}</td>
                <td>
                  <span className={`${s.badge} ${s.badgeGray}`}>
                    {cfg.levelLabel[r.level] ?? r.level}
                  </span>
                </td>
                {cfg.columns.map(c => (
                  <td key={c.key} style={{ fontVariantNumeric: 'tabular-nums' }}>{c.fmt(r)}</td>
                ))}
                <td style={{ fontSize: 12, color: '#888' }}>{String(r.createdAt)?.slice(0, 10)}</td>
                <td>
                  <button
                    className={`${s.btn} ${s.btnDanger}`}
                    style={{ fontSize: 12, padding: '4px 8px' }}
                    onClick={() => handleDelete(r.id)}
                  >삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {(page > 0 || hasNext) && (
        <div className={s.pagination}>
          <button
            className={s.pageBtn}
            disabled={page === 0}
            onClick={() => load(page - 1)}
          >이전</button>
          <span style={{ fontSize: 12, color: '#888', padding: '0 8px' }}>{page + 1}페이지</span>
          <button
            className={s.pageBtn}
            disabled={!hasNext}
            onClick={() => load(page + 1)}
          >다음</button>
        </div>
      )}
    </div>
  );
}
