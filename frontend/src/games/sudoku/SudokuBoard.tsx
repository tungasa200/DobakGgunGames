import { useCallback, useEffect, useRef, useState } from 'react';
import { useSudokuGame, type Difficulty } from './useSudokuGame';
import { startSudokuSession } from '../../api/sudoku';
import { rankingsApi, type RankingEntry } from '../../api/rankings';
import { containsProfanity } from '../../utils/profanity';
import { useExcelShell } from '../../components/excel/ExcelShellContext';
import { useAuth } from '../../context/AuthContext';
import { useAdminTest } from '../../context/AdminTestContext';
import styles from './SudokuBoard.module.css';

const DIFF_LABELS: Record<Difficulty, string> = {
  easy: '초급',
  normal: '중급',
  hard: '고급',
};
const DIFF_ICONS: Record<Difficulty, string> = {
  easy: '📈',
  normal: '📊',
  hard: '📉',
};

function colLabel(i: number): string {
  let label = '';
  let n = i + 1;
  while (n > 0) {
    n--;
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26);
  }
  return label;
}

function formatTime(elapsed: number): string {
  const total = Math.floor(elapsed);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function weekRange(): string {
  const now = new Date();
  const day = now.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const mon = new Date(now); mon.setDate(now.getDate() + diffToMon);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  return `주간 랭킹 (${fmt(mon)} ~ ${fmt(sun)})`;
}

function hasConflict(board: number[][], r: number, c: number): boolean {
  const val = board[r][c];
  if (val === 0) return false;
  for (let j = 0; j < 9; j++) {
    if (j !== c && board[r][j] === val) return true;
    if (j !== r && board[j][c] === val) return true;
  }
  const boxR = Math.floor(r / 3) * 3;
  const boxC = Math.floor(c / 3) * 3;
  for (let i = boxR; i < boxR + 3; i++)
    for (let j = boxC; j < boxC + 3; j++)
      if ((i !== r || j !== c) && board[i][j] === val) return true;
  return false;
}

function isInSameGroup(r: number, c: number, sel: [number, number] | null): boolean {
  if (!sel) return false;
  const [sr, sc] = sel;
  return r === sr || c === sc;
}

function countInBoard(board: number[][], n: number): number {
  let count = 0;
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (board[r][c] === n) count++;
  return count;
}

interface Props { excel?: boolean }

export default function SudokuBoard({ excel = false }: Props) {
  const { user } = useAuth();
  const { state, startGame, selectCell, inputNumber, deleteCell, toggleNote, useHint, reset } =
    useSudokuGame();

  const solutionRef  = useRef<number[][] | null>(null);
  const sessionIdRef = useRef<string>('');
  const handleStartRef = useRef<(diff: Difficulty) => void>(() => {});
  const clearTimeRef = useRef<number>(0);

  const [difficulty, setDifficulty]     = useState<Difficulty>('easy');
  const [isLoading, setIsLoading]       = useState(false);
  const [sessionFailed, setSessionFailed] = useState(false);

  const [modalOpen, setModalOpen]       = useState(false);
  const [playerName, setPlayerName]     = useState('');
  const [submitState, setSubmitState]   = useState<'idle' | 'loading' | 'error'>('idle');
  const [nameBanned, setNameBanned]     = useState(false);

  const [rankings, setRankings]   = useState<RankingEntry[]>([]);
  const [alltime, setAlltime]     = useState<RankingEntry | null>(null);
  const [rankLevel, setRankLevel] = useState<Difficulty>('easy');
  const [rankLoading, setRankLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Difficulty | 'rules'>('easy');

  const { setFormula, setStatusItems, activeSheet, setRibbonGameGroup, sheetSize, registerNewGame } =
    useExcelShell();

  /* ── 자동완성 ── */
  useEffect(() => {
    if (modalOpen) setPlayerName(user?.nickname ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen]);

  useEffect(() => {
    if (state.status === 'won') {
      clearTimeRef.current = state.elapsed;
      setModalOpen(true);
    }
  }, [state.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // 어드민 강제 클리어
  const { register } = useAdminTest();
  const forceClearRef = useRef<() => void>(() => {});
  forceClearRef.current = async () => {
    try {
      const res = await startSudokuSession(difficulty);
      sessionIdRef.current = res.sessionId;
    } catch { /* ignore */ }
    setModalOpen(true);
  };
  useEffect(() => {
    register(() => forceClearRef.current());
    return () => register(() => {});
  }, [register]);

  /* ── 초기 랭킹 로드 ── */
  useEffect(() => {
    if (!excel) loadRanking('easy');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!excel || activeSheet !== 'ranking') return;
    loadRanking(rankLevel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excel, activeSheet]);

  /* ── Excel 수식바 / 상태바 ── */
  useEffect(() => {
    if (!excel) return;
    const addr = state.selected
      ? `${String.fromCharCode(65 + state.selected[1])}${state.selected[0] + 1}`
      : 'A1';
    const cellVal = state.selected ? (state.board[state.selected[0]][state.selected[1]] || '') : '';
    setFormula(addr, cellVal !== '' ? `=${cellVal}` : '');
    setStatusItems([
      { label: '⏱', value: formatTime(state.elapsed) },
      { label: '💡', value: `힌트 ${state.hintsLeft}` },
    ]);
  }, [excel, state.selected, state.board, state.elapsed, state.hintsLeft, setFormula, setStatusItems]);

  /* ── Excel 리본 ── */
  useEffect(() => {
    if (!excel) { setRibbonGameGroup(null); return; }
    setRibbonGameGroup(
      <div className={styles.xrgGame}>
        <div className={styles.xrgBtns}>
          {(['easy', 'normal', 'hard'] as Difficulty[]).map(d => (
            <div
              key={d}
              className={`${styles.xrb} ${difficulty === d ? styles.xrbActive : ''}`}
              onClick={() => handleStartRef.current(d)}
            >
              <span className={styles.xrbIcon}>{DIFF_ICONS[d]}</span>
              <span>{DIFF_LABELS[d]}</span>
            </div>
          ))}
          <div className={styles.xrb} onClick={() => handleStartRef.current(difficulty)}>
            <span className={styles.xrbIcon}>🔄</span>
            <span>새 시트</span>
          </div>
        </div>
        <div className={styles.xrgLabel}>스도쿠</div>
      </div>
    );
  }, [excel, difficulty, setRibbonGameGroup]);

  /* ── 새 게임 콜백 등록 ── */
  const newGameFnRef = useRef<() => void>(() => {});
  newGameFnRef.current = () => handleStartRef.current(difficulty);
  useEffect(() => {
    if (excel) registerNewGame(() => newGameFnRef.current());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excel, registerNewGame]);

  /* ── 키보드 ── */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (state.status !== 'playing') return;
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      const num = parseInt(e.key);
      if (num >= 1 && num <= 9) { inputNumber(num); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { deleteCell(); return; }
      if (e.key === 'n' || e.key === 'N') { toggleNote(); return; }
      if (state.selected) {
        const [r, c] = state.selected;
        if (e.key === 'ArrowUp')    { e.preventDefault(); selectCell(Math.max(0, r - 1), c); return; }
        if (e.key === 'ArrowDown')  { e.preventDefault(); selectCell(Math.min(8, r + 1), c); return; }
        if (e.key === 'ArrowLeft')  { e.preventDefault(); selectCell(r, Math.max(0, c - 1)); return; }
        if (e.key === 'ArrowRight') { e.preventDefault(); selectCell(r, Math.min(8, c + 1)); return; }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.status, state.selected, inputNumber, deleteCell, toggleNote, selectCell]);

  /* ── 게임 시작 ── */
  async function handleStart(diff: Difficulty) {
    setDifficulty(diff);
    setIsLoading(true);
    setSessionFailed(false);
    solutionRef.current = null;
    try {
      const res = await startSudokuSession(diff);
      solutionRef.current = res.solution;
      sessionIdRef.current = res.sessionId;
      startGame(res.puzzle, res.sessionId, diff);
    } catch {
      setSessionFailed(true);
    } finally {
      setIsLoading(false);
    }
  }
  handleStartRef.current = handleStart;

  /* ── 힌트 ── */
  function handleHint() {
    if (!solutionRef.current || state.hintsLeft <= 0 || state.status !== 'playing') return;
    if (state.selected) {
      const [r, c] = state.selected;
      if (!state.fixed[r][c] && state.board[r][c] === 0) {
        useHint(r, c, solutionRef.current[r][c]);
        return;
      }
    }
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 9; c++)
        if (!state.fixed[r][c] && state.board[r][c] === 0) {
          useHint(r, c, solutionRef.current![r][c]);
          return;
        }
  }

  /* ── 랭킹 제출 ── */
  async function handleSubmitRanking() {
    const name = playerName.trim();
    if (!name) return;
    if (containsProfanity(name)) { setNameBanned(true); return; }
    setNameBanned(false);
    setSubmitState('loading');
    try {
      await rankingsApi.submit('sudoku', {
        level: state.difficulty,
        name,
        time: Math.round(clearTimeRef.current),
        sessionId: sessionIdRef.current,
      });
      setModalOpen(false);
      setPlayerName('');
      setSubmitState('idle');
      setActiveTab(state.difficulty);
      setRankLevel(state.difficulty);
      loadRanking(state.difficulty);
    } catch {
      setSubmitState('error');
    }
  }

  /* ── 랭킹 로드 ── */
  const loadRanking = useCallback(async (diff: Difficulty) => {
    setRankLoading(true);
    try {
      const [data, at] = await Promise.all([
        rankingsApi.getWeekly('sudoku', diff),
        rankingsApi.getAlltimeBest('sudoku', diff),
      ]);
      setRankings(data);
      setAlltime('id' in at ? (at as RankingEntry) : null);
    } catch {
      setRankings([]);
      setAlltime(null);
    } finally {
      setRankLoading(false);
    }
  }, []);

  const selectedVal   = state.selected ? state.board[state.selected[0]][state.selected[1]] : 0;
  const showGameArea    = !excel || activeSheet === 'game';
  const showRankingArea = !excel || activeSheet === 'ranking';
  const showRulesArea   = !excel || activeSheet === 'rules';

  return (
    <div className={`${styles.wrap} ${excel ? styles.excelMode : ''}`}>

      {/* ── 일반 모드: 난이도 탭 ── */}
      {!excel && (
        <div className={styles.diffRow}>
          {(['easy', 'normal', 'hard'] as Difficulty[]).map(d => (
            <button
              key={d}
              className={`${styles.diffBtn} ${difficulty === d ? styles.diffActive : ''}`}
              onClick={() => handleStart(d)}
            >
              {DIFF_LABELS[d]}
            </button>
          ))}
        </div>
      )}

      {/* ── 게임 영역 ── */}
      {showGameArea && (
        <>
          {!excel && state.status !== 'idle' && (
            <div className={styles.infoBar}>
              <span className={styles.timerDisplay}>⏱ {formatTime(state.elapsed)}</span>
              <span className={styles.hintDisplay}>💡 힌트 {state.hintsLeft}개</span>
            </div>
          )}

          <div className={styles.boardArea}>
            {/* ── 9×9 보드 — 항상 표시 (idle 시 빈 보드) ── */}
            <div className={`${styles.board} ${state.status === 'idle' ? styles.boardIdle : ''}`}>
              {(() => {
                const boxBorder  = excel ? '2px solid #bbb' : '2px solid #2c3e50';
                const cellBorder = excel ? '1px solid #d0d0d0' : '1px solid #bdc3c7';
                return Array.from({ length: 9 }, (_, r) =>
                Array.from({ length: 9 }, (_, c) => {
                  const val      = state.board[r][c];
                  const isFixed  = state.fixed[r][c];
                  const isSel    = state.selected?.[0] === r && state.selected?.[1] === c;
                  const isHL     = !isSel && isInSameGroup(r, c, state.selected);
                  const isSameN  = !isSel && val !== 0 && val === selectedVal && selectedVal !== 0;
                  const conflict = !isFixed && hasConflict(state.board, r, c);
                  const notes    = state.notes[r][c];

                  let cls = styles.cell;
                  if (state.status !== 'idle') {
                    if (isSel)        cls += ' ' + styles.cellSelected;
                    else if (isSameN) cls += ' ' + styles.cellSameNum;
                    else if (isHL)    cls += ' ' + styles.cellHighlighted;
                  }
                  if (isFixed) cls += ' ' + styles.cellFixed;

                  const borderStyle: React.CSSProperties = {
                    borderRight:  (c + 1) % 3 === 0 ? boxBorder : cellBorder,
                    borderBottom: (r + 1) % 3 === 0 ? boxBorder : cellBorder,
                  };

                  return (
                    <div
                      key={`${r}-${c}`}
                      className={cls}
                      style={borderStyle}
                      onClick={() => state.status !== 'idle' && selectCell(r, c)}
                    >
                      {val !== 0 ? (
                        <span
                          className={`${styles.cellVal} ${
                            isFixed ? styles.valFixed : conflict ? styles.valConflict : styles.valUser
                          }`}
                        >
                          {val}
                        </span>
                      ) : notes.size > 0 ? (
                        <div className={styles.noteGrid}>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                            <span key={n} className={styles.noteNum}>
                              {notes.has(n) ? n : ''}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })
                );
              })()}
            </div>

            {/* ── idle: 게임 시작 버튼 ── */}
            {state.status === 'idle' && (
              <button
                className={styles.startBtn}
                disabled={isLoading}
                onClick={() => handleStart(difficulty)}
              >
                {isLoading ? '로딩 중...' : '게임 시작'}
              </button>
            )}

            {/* ── playing/won: 컨트롤 ── */}
            {state.status !== 'idle' && (
              <div className={styles.controls}>
                <div className={styles.numPad}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => {
                    const placed = countInBoard(state.board, n);
                    const done   = placed >= 9;
                    return (
                      <button
                        key={n}
                        className={`${styles.numBtn} ${done ? styles.numBtnDone : ''}`}
                        onClick={() => inputNumber(n)}
                        disabled={done}
                      >
                        <span className={styles.numBtnDigit}>{n}</span>
                        {!done && <span className={styles.numBtnCount}>{9 - placed}</span>}
                      </button>
                    );
                  })}
                  <button className={styles.deleteBtn} onClick={deleteCell}>⌫</button>
                </div>
                <div className={styles.actionRow}>
                  <button
                    className={`${styles.actionBtn} ${state.isNoteMode ? styles.actionBtnActive : ''}`}
                    onClick={toggleNote}
                  >
                    {excel ? '' : '✏️ '}메모 {state.isNoteMode ? 'ON' : 'OFF'}
                  </button>
                  <button
                    className={styles.actionBtn}
                    disabled={state.hintsLeft <= 0 || !solutionRef.current}
                    onClick={handleHint}
                  >
                    {excel ? '' : '💡 '}힌트 ({state.hintsLeft})
                  </button>
                </div>
              </div>
            )}
          </div>

          {!excel && state.status !== 'idle' && (
            <button className={styles.resetBtn} onClick={() => reset(difficulty)}>
              새 게임
            </button>
          )}
        </>
      )}

      {/* ── 세션 실패 배너 ── */}
      {sessionFailed && state.status === 'playing' && (
        <div className={styles.sessionFailBanner}>
          네트워크 오류로 이 게임은 랭킹에 등록되지 않습니다
        </div>
      )}

      {/* ── 일반 모드: 랭킹 ── */}
      {!excel && showRankingArea && (
        <div className={styles.rankSection}>
          <h3 className={styles.rankTitle}>{weekRange()}</h3>
          {activeTab !== 'rules' && alltime && (
            <div className={styles.alltimeBanner}>
              <span>👑 역대 1위</span>
              <span>
                {alltime.name} · {formatTime(alltime.time ?? 0)} ·{' '}
                {new Date(alltime.createdAt).toLocaleDateString('ko-KR')}
              </span>
            </div>
          )}
          <div className={styles.rankTabs}>
            {(['easy', 'normal', 'hard', 'rules'] as const).map(tab => (
              <button
                key={tab}
                className={`${styles.rankTab} ${activeTab === tab ? styles.rankTabActive : ''}`}
                onClick={() => {
                  setActiveTab(tab);
                  if (tab !== 'rules') { setRankLevel(tab); loadRanking(tab); }
                }}
              >
                {tab === 'rules' ? '룰' : DIFF_LABELS[tab]}
              </button>
            ))}
          </div>

          {activeTab === 'rules' ? (
            <div className={styles.rulesPanel}>
              <h4>기본 규칙</h4>
              <ul>
                <li>빈 칸에 1~9를 채워 모든 행·열·3×3 박스에 각 숫자가 한 번씩 나타나게 만들기</li>
                <li>같은 행, 열, 박스에 중복 숫자 입력 시 빨간색으로 표시</li>
                <li>메모 모드: 후보 숫자를 작게 기록 (단축키: N)</li>
                <li>키보드: 숫자 1~9 입력, 방향키 이동, Del/Backspace 삭제</li>
              </ul>
              <h4>힌트</h4>
              <ul>
                <li>게임당 최대 3회 사용 가능</li>
                <li>선택한 빈 칸에 정답을 채워줌</li>
                <li>힌트 사용은 랭킹 점수에 영향 없음</li>
              </ul>
              <h4>랭킹</h4>
              <ul>
                <li>클리어 시간 기준으로 순위 결정 (빠른 순)</li>
                <li>힌트 사용은 기록에 영향 없음</li>
              </ul>
            </div>
          ) : rankLoading ? (
            <p className={styles.placeholder}>불러오는 중...</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr><th>순위</th><th>이름</th><th>기록</th><th>날짜</th></tr>
              </thead>
              <tbody>
                {rankings.length === 0 ? (
                  <tr>
                    <td colSpan={4} className={styles.placeholder}>기록 없음</td>
                  </tr>
                ) : (
                  rankings.map((row, i) => (
                    <tr key={row.id}>
                      <td>{i + 1}</td>
                      <td>{row.name}</td>
                      <td>{formatTime(row.time ?? 0)}</td>
                      <td>{new Date(row.createdAt).toLocaleDateString('ko-KR')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── 엑셀 모드: 랭킹 시트 ── */}
      {excel && showRankingArea && (() => {
        const CELL = 40;
        const RANK_COLS = [
          { label: '순위', span: 2 },
          { label: '이름', span: 5 },
          { label: '기록', span: 3 },
          { label: '날짜', span: 3 },
        ];
        const RANK_TOTAL = RANK_COLS.reduce((s, c) => s + c.span, 0); // 13
        const extraCols  = Math.max(10, Math.ceil(sheetSize.width / CELL));
        const totalHeaderCols = RANK_TOTAL + extraCols;

        const dataRowCount = rankings.length > 0 ? rankings.length : 1;
        const contentRows  = 3 + dataRowCount + 1;
        const extraRows    = Math.max(20, Math.ceil(sheetSize.height / CELL));
        const totalRows    = contentRows + extraRows;

        const RankCell = (
          text: string,
          colStart: number,
          span: number,
          cls: string[],
          extraStyle?: React.CSSProperties,
          key?: string | number,
          children?: React.ReactNode,
        ) => (
          <div
            key={key ?? `${colStart}-${text}`}
            className={[styles.xrankCell, ...cls.map(c => styles[c as keyof typeof styles])].filter(Boolean).join(' ')}
            style={{ gridColumn: `${colStart} / span ${span}`, ...extraStyle }}
            title={text}
          >
            {children ?? text}
          </div>
        );

        return (
          <div className={styles.xSheetWrapper}>
            <div className={styles.xColHeaderRow}>
              <div className={styles.xcorner} />
              {Array.from({ length: totalHeaderCols }, (_, i) => (
                <div key={i} className={styles.xch} style={{ width: CELL, minWidth: CELL }}>
                  {colLabel(i)}
                </div>
              ))}
            </div>
            <div className={styles.xBodyArea}>
              <div className={styles.xRowNums}>
                {Array.from({ length: totalRows }, (_, i) => (
                  <div key={i} className={styles.xrn} style={{ height: CELL }}>{i + 1}</div>
                ))}
              </div>
              <div
                className={styles.xRankGrid}
                style={{ gridTemplateColumns: `repeat(${RANK_TOTAL}, ${CELL}px)`, gridAutoRows: `${CELL}px` }}
              >
                {/* 1행: 주간 랭킹 타이틀 */}
                {RankCell(weekRange(), 1, RANK_TOTAL, ['xrcWeekTitle'], { fontWeight: 'bold' }, 'title')}

                {/* 2행: 난이도 필터 */}
                <div
                  key="filter"
                  className={`${styles.xrankCell} ${styles.xrcFilter}`}
                  style={{ gridColumn: `1 / span ${RANK_TOTAL}` }}
                >
                  {(['easy', 'normal', 'hard'] as Difficulty[]).map(d => (
                    <button
                      key={d}
                      className={`${styles.xrankFilterBtn} ${rankLevel === d ? styles.xrankFilterBtnActive : ''}`}
                      onClick={() => { setRankLevel(d); loadRanking(d); }}
                    >
                      {DIFF_LABELS[d]}
                    </button>
                  ))}
                </div>

                {/* 3행: 컬럼 헤더 */}
                {(() => {
                  let cs = 1;
                  return RANK_COLS.map(col => {
                    const start = cs; cs += col.span;
                    return RankCell(col.label, start, col.span, ['xrcHeader'], undefined, `h-${col.label}`);
                  });
                })()}

                {/* 데이터 행 */}
                {rankLoading ? (
                  RankCell('불러오는 중...', 1, RANK_TOTAL, [], { color: '#888' }, 'loading')
                ) : rankings.length === 0 ? (
                  RankCell('기록 없음', 1, RANK_TOTAL, [], { color: '#aaa' }, 'empty')
                ) : (
                  rankings.map((row, i) => {
                    const alt = i % 2 === 1 ? styles.xrcAlt : '';
                    const top = i === 0 ? styles.xrcTop : '';
                    const date = new Date(row.createdAt).toLocaleDateString('ko-KR');
                    const values = [String(i + 1), row.name, formatTime(row.time ?? 0), date];
                    let cs = 1;
                    return RANK_COLS.map(col => {
                      const start = cs; cs += col.span;
                      return (
                        <div
                          key={`${row.id}-${col.label}`}
                          className={[styles.xrankCell, alt, top].filter(Boolean).join(' ')}
                          style={{ gridColumn: `${start} / span ${col.span}` }}
                        >
                          {values[RANK_COLS.indexOf(col)]}
                        </div>
                      );
                    });
                  })
                )}

                {/* 역대 1위 */}
                {alltime
                  ? RankCell(
                      `👑 역대 1위  ${alltime.name} · ${formatTime(alltime.time ?? 0)} · ${new Date(alltime.createdAt).toLocaleDateString('ko-KR')}`,
                      1, RANK_TOTAL, ['xrcWeekTitle'], { paddingLeft: 8 }, 'alltime'
                    )
                  : RankCell('👑 역대 1위  기록 없음', 1, RANK_TOTAL, [], { color: '#aaa', paddingLeft: 8 }, 'alltime-empty')
                }
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── 엑셀 모드: 룰 시트 ── */}
      {excel && showRulesArea && (() => {
        const CELL = 40;
        const RULES_TOTAL = 17;
        const extraCols   = Math.max(10, Math.ceil(sheetSize.width / CELL));
        const totalHeaderCols = RULES_TOTAL + extraCols;
        const contentRows = 15;
        const extraRows   = Math.max(20, Math.ceil(sheetSize.height / CELL));
        const totalRows   = contentRows + extraRows;

        type CellDef = { text: string; colStart: number; span: number; cls: string[]; style?: React.CSSProperties };
        const rows: CellDef[][] = [];

        function addRow(...cells: CellDef[]) { rows.push(cells); }
        function fullCell(text: string, cls: string[], style?: React.CSSProperties): CellDef {
          return { text, colStart: 1, span: RULES_TOTAL, cls, style };
        }
        function sectionRow(title: string): CellDef[] {
          return [fullCell(title, [], {
            background: '#e8f5e9', color: '#1a5c38', fontWeight: 'bold',
            borderTop: '1px solid #a5d6a7',
          })];
        }
        function emptyRow(): CellDef[] { return [fullCell('', [])]; }

        // 1행: 타이틀
        addRow(fullCell('도박꾼 스도쿠  —  게임 규칙', ['xrcHeader'], { justifyContent: 'center', fontSize: 14, letterSpacing: 1 }));
        addRow(...emptyRow());
        // 기본 규칙
        addRow(...sectionRow('■  기본 규칙'));
        [
          ['①', '빈 칸에 1~9를 채워 모든 행·열·3×3 박스에 각 숫자가 한 번씩 나타나게 만들기'],
          ['②', '같은 행, 열, 박스에 중복 숫자 입력 시 빨간색으로 표시'],
          ['③', '메모 모드: 후보 숫자를 작게 기록 (단축키: N)'],
          ['④', '키보드: 숫자 1~9 입력, 방향키 이동, Del/Backspace 삭제'],
        ].forEach(([num, text], i) => {
          const alt = i % 2 === 1 ? ['xrcAlt'] : [] as string[];
          addRow(
            { text: num, colStart: 1, span: 1, cls: alt, style: { justifyContent: 'center', color: '#888' } },
            { text, colStart: 2, span: RULES_TOTAL - 1, cls: alt },
          );
        });
        addRow(...emptyRow());
        // 힌트
        addRow(...sectionRow('■  힌트'));
        [
          ['①', '게임당 최대 3회 사용 가능'],
          ['②', '선택한 빈 칸에 정답을 채워줌 (랭킹 점수에 영향 없음)'],
        ].forEach(([num, text], i) => {
          const alt = i % 2 === 1 ? ['xrcAlt'] : [] as string[];
          addRow(
            { text: num, colStart: 1, span: 1, cls: alt, style: { justifyContent: 'center', color: '#888' } },
            { text, colStart: 2, span: RULES_TOTAL - 1, cls: alt },
          );
        });
        addRow(...emptyRow());
        // 랭킹
        addRow(...sectionRow('■  랭킹'));
        [
          ['①', '클리어 시간 기준으로 순위 결정 (빠른 순)'],
          ['②', '힌트 사용은 기록에 영향 없음'],
        ].forEach(([num, text], i) => {
          const alt = i % 2 === 1 ? ['xrcAlt'] : [] as string[];
          addRow(
            { text: num, colStart: 1, span: 1, cls: alt, style: { justifyContent: 'center', color: '#888' } },
            { text, colStart: 2, span: RULES_TOTAL - 1, cls: alt },
          );
        });

        return (
          <div className={styles.xSheetWrapper}>
            <div className={styles.xColHeaderRow}>
              <div className={styles.xcorner} />
              {Array.from({ length: totalHeaderCols }, (_, i) => (
                <div key={i} className={styles.xch} style={{ width: CELL, minWidth: CELL }}>
                  {colLabel(i)}
                </div>
              ))}
            </div>
            <div className={styles.xBodyArea}>
              <div className={styles.xRowNums}>
                {Array.from({ length: totalRows }, (_, i) => (
                  <div key={i} className={styles.xrn} style={{ height: CELL }}>{i + 1}</div>
                ))}
              </div>
              <div
                className={styles.xRankGrid}
                style={{ gridTemplateColumns: `repeat(${RULES_TOTAL}, ${CELL}px)`, gridAutoRows: `${CELL}px` }}
              >
                {rows.map((rowCells, ri) =>
                  rowCells.map((cell, ci) => (
                    <div
                      key={`${ri}-${ci}`}
                      className={[styles.xrankCell, ...cell.cls.map(c => styles[c as keyof typeof styles])].filter(Boolean).join(' ')}
                      style={{ gridColumn: `${cell.colStart} / span ${cell.span}`, ...cell.style }}
                    >
                      {cell.text}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── 클리어 모달 ── */}
      {modalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h2>CLEAR!</h2>
            <p>{DIFF_LABELS[state.difficulty]} · {formatTime(state.elapsed)}</p>
            <input
              className={styles.nameInput}
              type="text"
              placeholder="이름을 입력하세요"
              maxLength={50}
              value={playerName}
              onChange={e => { setPlayerName(e.target.value); setNameBanned(false); }}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmitRanking(); }}
              autoFocus
            />
            <p className={styles.ipNotice}>
              어뷰징 방지를 위해 IP 주소가 수집됩니다.
            </p>
            {nameBanned    && <p className={styles.hint}>사용할 수 없는 닉네임입니다.</p>}
            {submitState === 'error' && <p className={styles.hint}>등록 실패. 다시 시도해 주세요.</p>}
            <div className={styles.modalBtns}>
              <button
                className={`${styles.primaryBtn} ${excel ? styles.primaryBtnExcel : ''}`}
                disabled={submitState === 'loading'}
                onClick={handleSubmitRanking}
              >
                {submitState === 'loading' ? '등록 중...' : '등록'}
              </button>
              <button className={styles.secondaryBtn} onClick={() => setModalOpen(false)}>
                건너뛰기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
