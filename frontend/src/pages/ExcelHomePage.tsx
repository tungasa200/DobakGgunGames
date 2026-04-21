import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import ExcelShell from '../components/excel/ExcelShell';
import { useExcelShell } from '../components/excel/ExcelShellContext';
import { getCachedWeekly, type RankingEntry } from '../api/rankings';
import { fetchGameStatus } from '../api/games';
import { useAuth } from '../context/AuthContext';
import styles from './ExcelHomePage.module.css';

const COL_A = 96;
const COL_B = 192;

const GAME_LIST = [
  { key: 'minesweeper', label: '지뢰찾기' },
  { key: 'baseball',    label: '숫자야구' },
  { key: 'solitaire',   label: '솔리테어' },
  { key: 'blockfall',   label: '블록폴' },
  { key: 'apple',       label: '사과게임' },
  { key: 'sudoku',      label: '스도쿠' },
];

const RANK_COLS = [
  {
    key: 'ms', game: 'minesweeper', label: '지뢰찾기',
    levels: ['beginner', 'intermediate', 'expert'],
    levelLabels: ['초급', '중급', '고급'],
    fmt: (r: RankingEntry) => `${r.time!.toFixed(2)}초`,
  },
  {
    key: 'nb', game: 'baseball', label: '숫자야구',
    levels: ['easy', 'normal', 'hard'],
    levelLabels: ['쉬움', '보통', '어려움'],
    fmt: (r: RankingEntry) => `${r.attempts}번`,
  },
  {
    key: 'sl', game: 'solitaire', label: '솔리테어',
    levels: ['draw1', 'draw3'],
    levelLabels: ['드로우1', '드로우3'],
    fmt: (r: RankingEntry) => {
      const t = Math.round(r.time!);
      const m = Math.floor(t / 60), s = t % 60;
      return m > 0 ? `${m}분 ${String(s).padStart(2, '0')}초` : `${t}초`;
    },
  },
  {
    key: 'tt', game: 'blockfall', label: '블록폴',
    levels: ['easy', 'normal', 'hard'],
    levelLabels: ['쉬움', '보통', '어려움'],
    fmt: (r: RankingEntry) => `${r.score!.toLocaleString()}점`,
  },
  {
    key: 'ap', game: 'apple', label: '사과게임',
    levels: ['normal'],
    levelLabels: ['랭킹'],
    fmt: (r: RankingEntry) => `${r.score!.toLocaleString()}점`,
  },
  {
    key: 'su', game: 'sudoku', label: '스도쿠',
    levels: ['easy', 'normal', 'hard'],
    levelLabels: ['초급', '중급', '고급'],
    fmt: (r: RankingEntry) => {
      const t = Math.round(r.time!);
      const m = Math.floor(t / 60), s = t % 60;
      return m > 0 ? `${m}분 ${String(s).padStart(2, '0')}초` : `${t}초`;
    },
  },
];

type RankCache = Record<string, Record<string, RankingEntry[] | 'error'>>;

// ── 행 전체 너비: A(96) + B~G(192×6) = 1248 ──
const TOTAL_W = COL_A + COL_B * 6;
// 열 주소 (B=66, C=67, ...)
const COL_LETTERS = ['B', 'C', 'D', 'E', 'F', 'G'];

function HomeGrid() {
  const { setFormula, setStatusItems } = useExcelShell();
  const { user } = useAuth();
  const [cache, setCache] = useState<RankCache>({});
  const [activeLevels, setActiveLevels] = useState<Record<string, string>>({
    ms: 'beginner', nb: 'easy', sl: 'draw1', tt: 'easy', ap: 'normal', su: 'easy',
  });
  const [selected, setSelected] = useState('B7');
  const [gameStatus, setGameStatus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchGameStatus().then(setGameStatus);
  }, []);

  // 초기 수식바 / 상태바
  useEffect(() => {
    setFormula('B8', '=COUNTA(A3:A8)');
    setStatusItems([{ label: '게임', value: '6개' }]);
  }, [setFormula, setStatusItems]);

  const fetchLevel = (colKey: string, game: string, level: string) => {
    getCachedWeekly(game, level)
      .then(data => setCache(prev => ({
        ...prev,
        [colKey]: { ...(prev[colKey] ?? {}), [level]: data },
      })))
      .catch(() => setCache(prev => ({
        ...prev,
        [colKey]: { ...(prev[colKey] ?? {}), [level]: 'error' },
      })));
  };

  // 기본 레벨만 로딩
  useEffect(() => {
    RANK_COLS.forEach(col => fetchLevel(col.key, col.game, col.levels[0]));
  }, []);

  const handleCell = useCallback((addr: string, value: string, formula?: string) => {
    setSelected(addr);
    setFormula(addr, formula ?? value);
  }, [setFormula]);

  return (
    <div className={styles.homeGrid}>

      {/* Row 1: 게임 목록 섹션 헤더 */}
      <div className={styles.row}>
        <div
          className={`${styles.cell} ${styles.sh} ${selected === 'A1' ? styles.selected : ''}`}
          style={{ width: TOTAL_W }}
          onClick={() => handleCell('A1', '게임 목록')}
        >
          <span className={styles.cellCmt} />
          게임 목록
        </div>
      </div>

      {/* Row 2: 컬럼 헤더 */}
      <div className={styles.row}>
        {[
          { addr: 'A2', label: '게임명',   width: COL_A },
          { addr: 'B2', label: '기본 모드', width: COL_B },
          { addr: 'C2', label: '엑셀 모드', width: COL_B },
          { addr: 'D2', label: '',          width: COL_B },
          { addr: 'E2', label: '',          width: COL_B },
          { addr: 'F2', label: '',          width: COL_B },
          { addr: 'G2', label: '',          width: COL_B },
        ].map(({ addr, label, width }) => (
          <div
            key={addr}
            className={`${styles.cell} ${styles.ch} ${selected === addr ? styles.selected : ''}`}
            style={{ width }}
            onClick={() => handleCell(addr, label)}
          >
            {label}{label && <span className={styles.filtArrow}>▾</span>}
          </div>
        ))}
      </div>

      {/* Rows 3-8: 게임 목록 */}
      {GAME_LIST.map((game, idx) => {
        const row = idx + 3;
        const isEven = idx % 2 === 1;
        const addrA = `A${row}`;
        const addrB = `B${row}`;
        const addrC = `C${row}`;
        const isLastGame = row === 8;
        const isDisabled = user?.role !== 'ADMIN' && gameStatus[game.key] === false;
        return (
          <div key={game.key} className={styles.row}>
            <div
              className={`${styles.cell} ${styles.gameName} ${isEven ? styles.even : ''} ${selected === addrA ? styles.selected : ''}`}
              style={{ width: COL_A }}
              onClick={() => handleCell(addrA, game.label)}
            >{game.label}</div>
            <div
              className={`${styles.cell} ${isEven ? styles.even : ''} ${selected === addrB ? styles.selected : ''}`}
              style={{ width: COL_B }}
              onClick={() => handleCell(addrB, '일반 모드', isLastGame ? '=COUNTA(A3:A8)' : undefined)}
            >
              {isDisabled ? (
                <span className={`${styles.linkBtn} ${styles.linkDisabled}`}>🔧 점검 중</span>
              ) : (
                <Link
                  className={`${styles.linkBtn} ${styles.linkNormal}`}
                  to={`/${game.key}`}
                  onClick={e => e.stopPropagation()}
                >일반 모드</Link>
              )}
            </div>
            <div
              className={`${styles.cell} ${isEven ? styles.even : ''} ${selected === addrC ? styles.selected : ''}`}
              style={{ width: COL_B }}
              onClick={() => handleCell(addrC, '엑셀 모드')}
            >
              {isDisabled ? (
                <span className={`${styles.linkBtn} ${styles.linkDisabled}`}>🔧 점검 중</span>
              ) : (
                <Link
                  className={`${styles.linkBtn} ${styles.linkExcel}`}
                  to={`/${game.key}/excel`}
                  onClick={e => e.stopPropagation()}
                >엑셀 모드</Link>
              )}
            </div>
            {['D', 'E', 'F', 'G'].map(col => {
              const addr = `${col}${row}`;
              return (
                <div
                  key={addr}
                  className={`${styles.cell} ${isEven ? styles.even : ''} ${selected === addr ? styles.selected : ''}`}
                  style={{ width: COL_B }}
                  onClick={() => handleCell(addr, '')}
                />
              );
            })}
          </div>
        );
      })}

      {/* Row 8: 구분 행 */}
      <div className={styles.row}>
        <div
          className={`${styles.cell} ${styles.gap} ${selected === 'A8' ? styles.selected : ''}`}
          style={{ width: TOTAL_W }}
          onClick={() => handleCell('A8', '')}
        />
      </div>

      {/* Row 9: 주간 랭킹 섹션 헤더 */}
      <div className={styles.row}>
        <div
          className={`${styles.cell} ${styles.sh} ${selected === 'A9' ? styles.selected : ''}`}
          style={{ width: TOTAL_W }}
          onClick={() => handleCell('A9', '주간 랭킹 TOP 3')}
        >
          주간 랭킹 TOP 3
        </div>
      </div>

      {/* Row 10: 랭킹 컬럼 헤더 */}
      <div className={styles.row}>
        <div
          className={`${styles.cell} ${styles.ch} ${selected === 'A10' ? styles.selected : ''}`}
          style={{ width: COL_A }}
          onClick={() => handleCell('A10', '순위')}
        >
          순위 <span className={styles.filtArrow}>▾</span>
        </div>
        {RANK_COLS.map((col, ci) => {
          const addr = `${COL_LETTERS[ci]}10`;
          return (
            <div
              key={col.key}
              className={`${styles.cell} ${styles.rh} ${selected === addr ? styles.selected : ''}`}
              style={{ width: COL_B }}
              onClick={() => handleCell(addr, col.label)}
            >
              <span className={styles.rhName}>{col.label}</span>
              <div className={styles.rtabs} onClick={e => e.stopPropagation()}>
                {col.levels.map((lv, li) => (
                  <button
                    key={lv}
                    className={`${styles.rtab} ${activeLevels[col.key] === lv ? styles.rtabActive : ''}`}
                    onClick={() => {
                      setActiveLevels(prev => ({ ...prev, [col.key]: lv }));
                      if (!cache[col.key]?.[lv]) fetchLevel(col.key, col.game, lv);
                    }}
                  >{col.levelLabels[li]}</button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Rows 11-13: 1~3위 */}
      {[1, 2, 3].map(rank => {
        const row = 10 + rank;
        const isEven = rank === 2;
        const rnkClass = rank === 1 ? styles.rnk1 : rank === 2 ? styles.rnk2 : styles.rnk3;
        const addrA = `A${row}`;
        return (
          <div key={rank} className={styles.row}>
            <div
              className={`${styles.cell} ${styles.rnk} ${rnkClass} ${isEven ? styles.even : ''} ${selected === addrA ? styles.selected : ''}`}
              style={{ width: COL_A }}
              onClick={() => handleCell(addrA, String(rank))}
            >{rank}</div>
            {RANK_COLS.map((col, ci) => {
              const addr = `${COL_LETTERS[ci]}${row}`;
              const level = activeLevels[col.key];
              const data = cache[col.key]?.[level];
              const entry = Array.isArray(data) ? data[rank - 1] : undefined;
              return (
                <div
                  key={col.key}
                  className={`${styles.cell} ${styles.rd} ${isEven ? styles.even : ''} ${selected === addr ? styles.selected : ''}`}
                  style={{ width: COL_B }}
                  onClick={() => handleCell(addr, entry ? entry.name : '-')}
                >
                  {entry ? (
                    <>
                      <span className={styles.rdName}>{entry.name}</span>
                      <span className={styles.rdScore}>{col.fmt(entry)}</span>
                    </>
                  ) : (
                    <span className={styles.rdEmpty}>-</span>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

    </div>
  );
}

export default function ExcelHomePage() {
  useEffect(() => {
    document.title = 'dobakggun';
  }, []);

  return (
    <ExcelShell
      game=""
      gameName="게임 목록"
      fileTitle="DobakGgun.xlsx"
      rowHeight={29}
    >
      <HomeGrid />
    </ExcelShell>
  );
}
