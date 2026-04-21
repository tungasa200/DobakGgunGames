import { useCallback, useEffect, useRef, useState } from 'react';
import { useSudokuGame, type Difficulty } from './useSudokuGame';
import { startSudokuSession } from '../../api/sudoku';
import { rankingsApi, type RankingEntry } from '../../api/rankings';
import { containsProfanity } from '../../utils/profanity';
import { useExcelShell } from '../../components/excel/ExcelShellContext';
import { useAuth } from '../../context/AuthContext';
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
  if (r === sr || c === sc) return true;
  return Math.floor(r / 3) === Math.floor(sr / 3) && Math.floor(c / 3) === Math.floor(sc / 3);
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

  const { setFormula, setStatusItems, activeSheet, setRibbonGameGroup, registerNewGame } =
    useExcelShell();

  /* ── 자동완성 ── */
  useEffect(() => {
    if (modalOpen) setPlayerName(user?.nickname ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen]);

  useEffect(() => {
    if (state.status === 'won') setModalOpen(true);
  }, [state.status]);

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
        score: 0, // 실제 점수는 서버에서 세션 시간 기반으로 계산
        sessionId: sessionIdRef.current,
      });
      setModalOpen(false);
      setPlayerName('');
      setSubmitState('idle');
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
                    ✏️ 메모 {state.isNoteMode ? 'ON' : 'OFF'}
                  </button>
                  <button
                    className={styles.actionBtn}
                    disabled={state.hintsLeft <= 0 || !solutionRef.current}
                    onClick={handleHint}
                  >
                    💡 힌트 ({state.hintsLeft})
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
                {alltime.name} · {(alltime.score ?? 0).toLocaleString()}점 ·{' '}
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
              <h4>점수 계산</h4>
              <ul>
                <li>초급: 최대 1,000점 (기준 10분)</li>
                <li>중급: 최대 2,000점 (기준 15분)</li>
                <li>고급: 최대 3,500점 (기준 20분)</li>
                <li>풀이 시간이 빠를수록 높은 점수 (최소 100점)</li>
              </ul>
            </div>
          ) : rankLoading ? (
            <p className={styles.placeholder}>불러오는 중...</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr><th>순위</th><th>이름</th><th>점수</th><th>날짜</th></tr>
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
                      <td>{(row.score ?? 0).toLocaleString()}점</td>
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
      {excel && showRankingArea && (
        <div className={styles.xRankWrap}>
          <div className={styles.xRankHeader}>
            <span>{weekRange()}</span>
            <div>
              {(['easy', 'normal', 'hard'] as Difficulty[]).map(d => (
                <button
                  key={d}
                  className={`${styles.xRankTab} ${rankLevel === d ? styles.xRankTabActive : ''}`}
                  onClick={() => { setRankLevel(d); loadRanking(d); }}
                >
                  {DIFF_LABELS[d]}
                </button>
              ))}
            </div>
          </div>
          {rankLoading ? (
            <p className={styles.placeholder}>불러오는 중...</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr><th>순위</th><th>이름</th><th>점수</th><th>날짜</th></tr>
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
                      <td>{(row.score ?? 0).toLocaleString()}점</td>
                      <td>{new Date(row.createdAt).toLocaleDateString('ko-KR')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── 엑셀 모드: 룰 시트 ── */}
      {excel && showRulesArea && (
        <div className={styles.xRulesWrap}>
          <h4>스도쿠 규칙</h4>
          <ul>
            <li>빈 칸에 1~9를 채워 모든 행·열·3×3 박스에 각 숫자가 한 번씩 나타나게 만들기</li>
            <li>중복 숫자 입력 시 빨간색 표시</li>
            <li>힌트는 게임당 3회 (랭킹 점수에 영향 없음)</li>
          </ul>
          <h4>점수</h4>
          <ul>
            <li>초급 최대 1,000점 / 중급 2,000점 / 고급 3,500점</li>
            <li>풀이 시간이 빠를수록 높은 점수</li>
          </ul>
        </div>
      )}

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
              랭킹 등록 시 어뷰징 방지를 위해 IP 주소가 수집됩니다.
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
