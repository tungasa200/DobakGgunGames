import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMinesweeperGame, PRESETS, type Level } from './useMinesweeperGame';
import { rankingsApi } from '../../api/rankings';
import { createToken } from '../../utils/hmac';
import { useExcelShell } from '../../components/excel/ExcelShellContext';
import styles from './MinesweeperBoard.module.css';

const LEVELS: { value: Level; label: string }[] = [
  { value: 'beginner',     label: '초급 (9×9)' },
  { value: 'intermediate', label: '중급 (16×16)' },
  { value: 'expert',       label: '고급 (16×30)' },
];

const NUM_COLORS = ['', '#0000ff','#007b00','#ff0000','#00007b','#7b0000','#007b7b','#000000','#7b7b7b'];

interface Props { excel?: boolean }

export default function MinesweeperBoard({ excel = false }: Props) {
  const [level, setLevel] = useState<Level>('beginner');
  const { state, reset, revealCell, chordClick, toggleMark } = useMinesweeperGame(level);

  // 모달
  const [modalOpen, setModalOpen] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [submitState, setSubmitState] = useState<'idle' | 'loading' | 'error'>('idle');

  // 랭킹
  const [rankLevel, setRankLevel] = useState<Level>('beginner');
  const [rankings, setRankings] = useState<unknown[]>([]);
  const [rankLoading, setRankLoading] = useState(false);

  // 양클릭 추적
  const mouseButtonsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (state.status === 'won') setModalOpen(true);
  }, [state.status]);

  // ===== Excel Shell 연동 =====
  const { setFormula, setStatusItems, activeSheet } = useExcelShell();
  useEffect(() => {
    if (!excel) return;
    const remaining = state.totalMines - state.flagCount;
    setFormula('A1', `=MINESWEEPER_FLAG(mines,${remaining})`);
    setStatusItems([
      { label: '💣', value: remaining },
      { label: '⏱', value: `${state.elapsed.toFixed(1)}s` },
    ]);
  }, [excel, state.totalMines, state.flagCount, state.elapsed, setFormula, setStatusItems]);

  function handleLevelChange(lv: Level) {
    setLevel(lv);
    reset(lv);
  }

  // 셀 사이즈 반응형
  const [cellSize, setCellSize] = useState(28);
  useEffect(() => {
    function calc() {
      const available = Math.min(window.innerWidth - 40, 800);
      const cols = PRESETS[state.level].cols;
      setCellSize(Math.max(22, Math.min(Math.floor(available / cols), 36)));
    }
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [state.level]);

  // 모바일 long press
  const lpRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lpFiredRef = useRef(false);

  const handleTouchStart = useCallback((r: number, c: number, e: React.TouchEvent) => {
    lpFiredRef.current = false;
    const startX = e.touches[0].clientX;
    const startY = e.touches[0].clientY;
    lpRef.current = setTimeout(() => {
      lpFiredRef.current = true;
      navigator.vibrate?.(60);
      if (state.status === 'playing') toggleMark(r, c);
    }, 500);
    // store start position for move cancel
    (e.currentTarget as HTMLElement).dataset.tx = String(startX);
    (e.currentTarget as HTMLElement).dataset.ty = String(startY);
  }, [state.status, toggleMark]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const el = e.currentTarget as HTMLElement;
    const dx = e.touches[0].clientX - Number(el.dataset.tx);
    const dy = e.touches[0].clientY - Number(el.dataset.ty);
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      if (lpRef.current) clearTimeout(lpRef.current);
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (lpRef.current) clearTimeout(lpRef.current);
    if (lpFiredRef.current) e.preventDefault();
  }, []);

  async function handleSubmitRanking() {
    const name = playerName.trim();
    if (!name) return;
    setSubmitState('loading');
    try {
      const { token, timestamp } = await createToken('minesweeper', level, state.elapsed.toFixed(2));
      await rankingsApi.submit('minesweeper', { level, name, time: state.elapsed, token, timestamp });
      setModalOpen(false);
      loadRanking(level);
    } catch {
      setSubmitState('error');
    }
  }

  async function loadRanking(lv: Level) {
    setRankLoading(true);
    try {
      const data = await rankingsApi.getWeekly('minesweeper', lv);
      setRankings(data as unknown[]);
    } catch {
      setRankings([]);
    } finally {
      setRankLoading(false);
    }
  }

  const statusText = (() => {
    if (state.status === 'idle') return 'GAME START';
    if (state.status === 'won')  return `WIN ⏱ ${state.elapsed.toFixed(2)}초`;
    if (state.status === 'lost') return 'GAME OVER';
    return '';
  })();

  const remaining = state.totalMines - state.flagCount;
  const showGameArea    = !excel || activeSheet === 'game';
  const showRankingArea = !excel || activeSheet === 'ranking';

  return (
    <div className={`${styles.wrap} ${excel ? styles.excelMode : ''}`}>
      {!excel && (
        <div className={styles.header}>
          <Link to="/" className={styles.backLink}>← 홈</Link>
          <h2 className={styles.title}>💣 지뢰찾기</h2>
        </div>
      )}

      {/* 난이도 — 일반 모드에서만 */}
      {!excel && (
        <div className={styles.diffRow}>
          {LEVELS.map((lv) => (
            <button
              key={lv.value}
              className={`${styles.diffBtn} ${level === lv.value ? styles.diffActive : ''}`}
              onClick={() => handleLevelChange(lv.value)}
            >
              {lv.label}
            </button>
          ))}
          <button className={styles.resetBtn} onClick={() => reset(level)}>리셋</button>
        </div>
      )}

      {/* 상태 바 — 일반 모드에서만 */}
      {!excel && (
        <div className={styles.statusBar}>
          <span className={styles.mineCount}>💣 {remaining}</span>
          <span className={`${styles.status} ${state.status === 'won' ? styles.win : state.status === 'lost' ? styles.lose : ''}`}>
            {statusText}
          </span>
          <span className={styles.timer}>⏱ {state.elapsed.toFixed(1)}초</span>
        </div>
      )}

      {/* 보드 — 게임 시트 */}
      {showGameArea && (
        <div className={styles.boardWrapper} style={{ overflowX: 'auto' }}>
          <div
            className={styles.board}
            style={{
              gridTemplateColumns: `repeat(${state.cols}, ${cellSize}px)`,
              gridTemplateRows: `repeat(${state.rows}, ${cellSize}px)`,
            }}
          >
            {state.board.map((row, r) =>
              row.map((cell, c) => {
                let content = '';
                let className = styles.cell;

                if (cell.isRevealed) {
                  className += ' ' + styles.revealed;
                  if (cell.isMine) content = '💣';
                  else if (cell.adjMines > 0) content = String(cell.adjMines);
                } else if (cell.mark === 'flag')   { content = '🚩'; className += ' ' + styles.flag; }
                else if (cell.mark === 'question') { content = '?';  className += ' ' + styles.question; }

                const cellKey = `${r}-${c}`;
                return (
                  <div
                    key={cellKey}
                    className={className}
                    style={{
                      width: cellSize,
                      height: cellSize,
                      fontSize: cell.isRevealed && !cell.isMine && cell.adjMines > 0
                        ? Math.max(10, cellSize * 0.55) : undefined,
                      color: cell.isRevealed && cell.adjMines > 0 && !cell.isMine
                        ? NUM_COLORS[cell.adjMines] : undefined,
                    }}
                    onClick={() => revealCell(r, c)}
                    onContextMenu={(e) => { e.preventDefault(); toggleMark(r, c); }}
                    onMouseDown={(e) => {
                      mouseButtonsRef.current[cellKey] = (mouseButtonsRef.current[cellKey] ?? 0) | e.buttons;
                      if ((mouseButtonsRef.current[cellKey] & 3) === 3) chordClick(r, c);
                    }}
                    onMouseUp={() => { mouseButtonsRef.current[cellKey] = 0; }}
                    onMouseLeave={() => { mouseButtonsRef.current[cellKey] = 0; }}
                    onTouchStart={(e) => handleTouchStart(r, c, e)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                  >
                    {content}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 랭킹 — 랭킹 시트 */}
      {showRankingArea && (
        <div className={styles.rankSection}>
          <div className={styles.rankTabs}>
            {LEVELS.map((lv) => (
              <button
                key={lv.value}
                className={`${styles.rankTab} ${rankLevel === lv.value ? styles.rankTabActive : ''}`}
                onClick={() => { setRankLevel(lv.value); loadRanking(lv.value); }}
              >
                {lv.label.split(' ')[0]}
              </button>
            ))}
          </div>
          {rankLoading ? (
            <p className={styles.placeholder}>불러오는 중...</p>
          ) : (
            <table className={styles.table}>
              <thead><tr><th>순위</th><th>이름</th><th>시간</th><th>날짜</th></tr></thead>
              <tbody>
                {(rankings as Array<{ id: number; name: string; time: number; createdAt: string }>).length === 0 ? (
                  <tr><td colSpan={4} className={styles.placeholder}>기록 없음</td></tr>
                ) : (
                  (rankings as Array<{ id: number; name: string; time: number; createdAt: string }>).map((r, i) => (
                    <tr key={r.id}>
                      <td>{i + 1}</td><td>{r.name}</td>
                      <td>{r.time.toFixed(2)}초</td>
                      <td>{new Date(r.createdAt).toLocaleDateString('ko-KR')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* 클리어 모달 */}
      {modalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>🎉 클리어!</h3>
            <p>클리어 시간: {state.elapsed.toFixed(2)}초</p>
            <input
              className={styles.nameInput}
              type="text"
              placeholder="이름 입력"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitRanking(); }}
              autoFocus
            />
            {submitState === 'error' && <p className={styles.hint}>등록 실패. 다시 시도해 주세요.</p>}
            <div className={styles.modalBtns}>
              <button className={styles.primaryBtn} disabled={submitState === 'loading'} onClick={handleSubmitRanking}>
                {submitState === 'loading' ? '등록 중...' : '랭킹 등록'}
              </button>
              <button className={styles.secondaryBtn} onClick={() => setModalOpen(false)}>건너뛰기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
