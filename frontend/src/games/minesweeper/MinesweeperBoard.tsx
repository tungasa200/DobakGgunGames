import { useCallback, useEffect, useRef, useState } from 'react';
import { useMinesweeperGame, type Level } from './useMinesweeperGame';
import { startMinesweeperSession } from '../../api/minesweeper';
import { rankingsApi, type RankingEntry } from '../../api/rankings';
import { containsProfanity } from '../../utils/profanity';
import { useExcelShell } from '../../components/excel/ExcelShellContext';
import styles from './MinesweeperBoard.module.css';

// 열 라벨 헬퍼 (A, B, C, ..., AA, ...)
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

// 주간 날짜 범위 문자열
function weekRange(): string {
  const now = new Date();
  const day = now.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const mon = new Date(now); mon.setDate(now.getDate() + diffToMon);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  return `주간 랭킹 (${fmt(mon)} ~ ${fmt(sun)})`;
}

const PRESET_LEVELS: { value: Exclude<Level, 'custom'>; label: string; shortLabel: string; icon: string }[] = [
  { value: 'beginner',     label: '초급 (9×9, 10개)',    shortLabel: '쉬움',   icon: '📈' },
  { value: 'intermediate', label: '중급 (16×16, 40개)',   shortLabel: '보통',   icon: '📊' },
  { value: 'expert',       label: '고급 (16×30, 99개)',   shortLabel: '어려움', icon: '📉' },
];

const NUM_COLORS = ['', '#0000ff','#007b00','#ff0000','#00007b','#7b0000','#007b7b','#000000','#7b7b7b'];

interface Props { excel?: boolean }

export default function MinesweeperBoard({ excel = false }: Props) {
  const [level, setLevel] = useState<Level>('beginner');
  const { state, reset, resetCustom, revealCell, revealFirstCellWithServerBoard, chordClick, toggleMark } = useMinesweeperGame('beginner');

  // 커스텀 패널
  const [showCustom, setShowCustom] = useState(false);
  const [customRows, setCustomRows]   = useState('10');
  const [customCols, setCustomCols]   = useState('10');
  const [customMines, setCustomMines] = useState('15');
  const [customHint, setCustomHint]   = useState('');

  // 모달
  const [modalOpen, setModalOpen] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [submitState, setSubmitState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [nameBanned, setNameBanned] = useState(false);

  // 랭킹
  const [rankLevel, setRankLevel] = useState<Exclude<Level, 'custom'>>('beginner');
  const [activeTab, setActiveTab] = useState<'beginner' | 'intermediate' | 'expert' | 'rules'>('beginner');
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [alltime, setAlltime] = useState<RankingEntry | null>(null);
  const [rankLoading, setRankLoading] = useState(false);

  // 세션 ID
  const sessionIdRef = useRef<string>('');

  // 최초 클릭 서버 요청 중 로딩 표시
  const [firstClickLoading, setFirstClickLoading] = useState(false);

  // 첫 클릭 시 세션 발급
  async function handleRevealCell(r: number, c: number) {
    if (state.status !== 'idle') {
      revealCell(r, c);
      return;
    }

    const rankLv = level === 'custom' ? 'beginner' : level as Exclude<typeof level, 'custom'>;

    if (level === 'custom') {
      // 커스텀 난이도: 서버 보드 없이 클라이언트 placeMines 사용, 세션은 fire-and-forget
      startMinesweeperSession(rankLv).then(res => { sessionIdRef.current = res.sessionId; }).catch(() => { sessionIdRef.current = ''; });
      revealCell(r, c);
      return;
    }

    // 프리셋 난이도: 서버에서 보드를 받아 적용 후 오픈 (Phase 3)
    setFirstClickLoading(true);
    try {
      const res = await startMinesweeperSession(rankLv, { r, c });
      sessionIdRef.current = res.sessionId;
      revealFirstCellWithServerBoard(res.adjMines, r, c);
    } catch {
      // 서버 오류 시 클라이언트 placeMines 로 폴백
      sessionIdRef.current = '';
      revealCell(r, c);
    } finally {
      setFirstClickLoading(false);
    }
  }

  // 양클릭 추적
  const mouseButtonsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (state.status === 'won') setModalOpen(true);
  }, [state.status]);

  // ===== Excel Shell 연동 =====
  const { setFormula, setStatusItems, activeSheet, setRibbonGameGroup, sheetSize, registerNewGame } = useExcelShell();

  // 일반 모드: 최초 로딩 시 자동 로드
  useEffect(() => {
    if (excel) return;
    loadRanking('beginner');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 엑셀 모드: 랭킹 시트 전환 시 자동 로드
  useEffect(() => {
    if (!excel || activeSheet !== 'ranking') return;
    loadRanking(rankLevel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excel, activeSheet]);

  // 엑셀 수식바 / 상태바
  useEffect(() => {
    if (!excel) return;
    const remaining = state.totalMines - state.flagCount;
    setFormula('A1', `=MINESWEEPER_FLAG(mines,${remaining})`);
    setStatusItems([
      { label: '💣', value: remaining },
      { label: '⏱', value: `${state.elapsed.toFixed(1)}s` },
    ]);
  }, [excel, state.totalMines, state.flagCount, state.elapsed, setFormula, setStatusItems]);

  // 엑셀 리본 게임 그룹
  const handleLevelChange = useCallback((lv: Level) => {
    setLevel(lv);
    setShowCustom(false);
    reset(lv);
  }, [reset]);

  useEffect(() => {
    if (!excel) {
      setRibbonGameGroup(null);
      return;
    }
    setRibbonGameGroup(
      <div className={styles.xrgGame}>
        <div className={styles.xrgBtns}>
          {PRESET_LEVELS.map((lv) => (
            <div
              key={lv.value}
              className={`${styles.xrb} ${level === lv.value ? styles.xrbActive : ''}`}
              onClick={() => handleLevelChange(lv.value)}
            >
              <span className={styles.xrbIcon}>{lv.icon}</span>
              <span>{lv.shortLabel}</span>
            </div>
          ))}
          <div className={styles.xrb} onClick={() => reset(level)}>
            <span className={styles.xrbIcon}>🔄</span>
            <span>새 시트</span>
          </div>
        </div>
        <div className={styles.xrgLabel}>데이터 분석</div>
      </div>
    );
  }, [excel, level, handleLevelChange, reset, setRibbonGameGroup]);

  // 엑셀모드 플러스 버튼 새 게임 콜백 등록
  const newGameFnRef = useRef<() => void>(() => {});
  newGameFnRef.current = () => reset(level);
  useEffect(() => {
    if (excel) registerNewGame(() => newGameFnRef.current());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excel, registerNewGame]);

  // 셀 크기: 엑셀 모드는 30px 고정, 일반 모드는 30px 고정 (원본과 동일)
  const CELL_SIZE = 30;

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

  // 커스텀 적용
  function applyCustom() {
    const r = parseInt(customRows);
    const c = parseInt(customCols);
    const m = parseInt(customMines);
    const maxMines = r * c - 9;
    if (isNaN(r) || isNaN(c) || isNaN(m) || r < 2 || c < 2 || m < 1) {
      setCustomHint('행/열은 2 이상, 지뢰는 1 이상이어야 합니다.');
      return;
    }
    if (m > maxMines) {
      setCustomHint(`지뢰는 최대 ${maxMines}개까지 가능합니다.`);
      return;
    }
    setCustomHint('');
    setLevel('custom');
    resetCustom(r, c, m);
  }

  async function handleSubmitRanking() {
    const name = playerName.trim();
    if (!name) return;
    if (containsProfanity(name)) { setNameBanned(true); return; }
    setNameBanned(false);
    setSubmitState('loading');
    try {
      const rankLv = level === 'custom' ? 'beginner' : level;
      const roundedTime = parseFloat(state.elapsed.toFixed(2));
      await rankingsApi.submit('minesweeper', { level: rankLv, name, time: roundedTime, sessionId: sessionIdRef.current });
      setModalOpen(false);
      setPlayerName('');
      setSubmitState('idle');
      loadRanking(rankLv);
    } catch {
      setSubmitState('error');
    }
  }

  async function loadRanking(lv: Exclude<Level, 'custom'>) {
    setRankLoading(true);
    try {
      const [data, at] = await Promise.all([
        rankingsApi.getWeekly('minesweeper', lv),
        rankingsApi.getAlltimeBest('minesweeper', lv),
      ]);
      setRankings(data);
      setAlltime('id' in at ? (at as RankingEntry) : null);
    } catch {
      setRankings([]);
      setAlltime(null);
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
  const showRulesArea   = !excel || activeSheet === 'rules';

  // 랭킹 탭 목록
  const RANK_TABS = [
    { key: 'beginner'     as const, label: '초급' },
    { key: 'intermediate' as const, label: '중급' },
    { key: 'expert'       as const, label: '고급' },
    { key: 'rules'        as const, label: '룰' },
  ];

  return (
    <div className={`${styles.wrap} ${excel ? styles.excelMode : ''}`}>

      {/* ── 일반 모드: 난이도 버튼 ── */}
      {!excel && (
        <>
          <div className={styles.diffRow}>
            {PRESET_LEVELS.map((lv) => (
              <button
                key={lv.value}
                className={`${styles.diffBtn} ${level === lv.value && !showCustom ? styles.diffActive : ''}`}
                onClick={() => handleLevelChange(lv.value)}
              >
                {lv.label}
              </button>
            ))}
            <button
              className={`${styles.diffBtn} ${showCustom ? styles.diffActive : ''}`}
              onClick={() => { setShowCustom(v => !v); }}
            >
              커스텀
            </button>
          </div>

          {/* 커스텀 패널 */}
          {showCustom && (
            <div className={styles.customPanel}>
              <label>행 <input type="number" value={customRows} min={2} max={30} onChange={e => setCustomRows(e.target.value)} /></label>
              <label>열 <input type="number" value={customCols} min={2} max={50} onChange={e => setCustomCols(e.target.value)} /></label>
              <label>지뢰 <input type="number" value={customMines} min={1} max={999} onChange={e => setCustomMines(e.target.value)} /></label>
              <button className={styles.applyBtn} onClick={applyCustom}>적용</button>
              {customHint && <span className={styles.customHint}>{customHint}</span>}
            </div>
          )}

          {/* 상태 바 */}
          <div className={styles.infoBar}>
            <span className={styles.mineCount}>💣 {remaining}</span>
            <span className={styles.timer}>⏱ {state.elapsed.toFixed(1)}초</span>
          </div>
          <div className={`${styles.status} ${state.status === 'won' ? styles.win : state.status === 'lost' ? styles.lose : ''}`}>
            {statusText}
          </div>
        </>
      )}

      {/* ── 보드 ── */}
      {showGameArea && (
        <div className={styles.boardWrapper}>
          {firstClickLoading && (
            <div className={styles.boardLoadingOverlay}>지뢰 배치 중...</div>
          )}
          <div
            className={styles.board}
            style={{
              gridTemplateColumns: `repeat(${state.cols}, ${CELL_SIZE}px)`,
              gridTemplateRows:    `repeat(${state.rows}, ${CELL_SIZE}px)`,
            }}
          >
            {state.board.map((row, r) =>
              row.map((cell, c) => {
                let content = '';
                let cls = styles.cell;

                if (cell.isRevealed) {
                  cls += ' ' + styles.revealed;
                  if (cell.isMine) { content = '💣'; cls += ' ' + styles.mine; }
                  else if (cell.adjMines > 0) content = String(cell.adjMines);
                } else if (cell.mark === 'flag')     { content = '🚩'; cls += ' ' + styles.flag; }
                else if (cell.mark === 'question')   { content = '?';  cls += ' ' + styles.question; }

                const numColor = !excel && cell.isRevealed && cell.adjMines > 0 && !cell.isMine
                  ? NUM_COLORS[cell.adjMines] : undefined;

                const cellKey = `${r}-${c}`;
                return (
                  <div
                    key={cellKey}
                    className={cls}
                    style={{ color: numColor }}
                    onClick={() => handleRevealCell(r, c)}
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

      {/* ── 일반 모드: 리셋 버튼 (보드 하단) ── */}
      {!excel && (
        <button className={styles.resetBtn} onClick={() => { reset(level); }}>
          RESET
        </button>
      )}

      {/* ── 랭킹 / 룰 (일반 모드) ── */}
      {!excel && showRankingArea && (
        <div className={styles.rankSection}>
          <h3 className={styles.rankTitle}>주간 RANK</h3>
          <div className={styles.rankTabs}>
            {RANK_TABS.map((tab) => (
              <button
                key={tab.key}
                className={`${styles.rankTab} ${activeTab === tab.key ? styles.rankTabActive : ''}`}
                onClick={() => {
                  setActiveTab(tab.key);
                  if (tab.key !== 'rules') {
                    setRankLevel(tab.key);
                    loadRanking(tab.key);
                  }
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'rules' ? (
            <div className={styles.rulesPanel}>
              <h4>기본 규칙</h4>
              <ul>
                <li>좌클릭: 칸 열기 (첫 클릭은 항상 안전)</li>
                <li>우클릭 / 길게 누르기: 🚩 깃발 → ❓ 물음표 → 빈칸 순환</li>
                <li>숫자는 주변 8칸 안에 있는 지뢰 수를 나타냄</li>
                <li>빈 칸 클릭 시 주변 빈 칸이 자동으로 열림</li>
                <li>지뢰를 클릭하면 게임 오버 💥</li>
                <li>지뢰 없는 모든 칸을 열면 승리 🎉</li>
              </ul>
              <h4>난이도</h4>
              <ul>
                <li>초급: 9×9 격자, 지뢰 10개</li>
                <li>중급: 16×16 격자, 지뢰 40개</li>
                <li>고급: 16×30 격자, 지뢰 99개</li>
              </ul>
              <h4>점수 등록</h4>
              <ul>
                <li>클리어 시 소요 시간이 기록됨</li>
                <li>짧은 시간일수록 높은 순위</li>
                <li>커스텀 난이도는 랭킹 등록 불가</li>
              </ul>
            </div>
          ) : rankLoading ? (
            <p className={styles.placeholder}>불러오는 중...</p>
          ) : (
            <table className={styles.table}>
              <thead><tr><th>순위</th><th>이름</th><th>시간</th><th>날짜</th></tr></thead>
              <tbody>
                {(rankings as Array<{ id: number; name: string; time: number; createdAt: string }>).length === 0 ? (
                  <tr><td colSpan={4} className={styles.placeholder}>기록 없음</td></tr>
                ) : (
                  (rankings as Array<{ id: number; name: string; time: number; createdAt: string }>).map((row, i) => (
                    <tr key={row.id}>
                      <td>{i + 1}</td><td>{row.name}</td>
                      <td>{row.time.toFixed(2)}초</td>
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
        const CELL = 30;
        // 원본: RANK_COLS = [{순위,2},{이름,5},{시간,3},{날짜,3}] → TOTAL=13
        const RANK_COLS = [
          { label: '순위', span: 2 },
          { label: '이름', span: 5 },
          { label: '시간', span: 3 },
          { label: '날짜', span: 3 },
        ];
        const RANK_TOTAL = RANK_COLS.reduce((s, c) => s + c.span, 0); // 13
        const extraCols = Math.max(10, Math.ceil(sheetSize.width / CELL));
        const totalHeaderCols = RANK_TOTAL + extraCols;

        // 데이터 행 수 계산
        const dataRowCount = rankings.length > 0 ? rankings.length : 1;
        const contentRows = 3 + dataRowCount + 1; // title + filter + header + data + alltime
        const extraRows = Math.max(20, Math.ceil(sheetSize.height / CELL));
        const totalRows = contentRows + extraRows;

        // 셀 렌더 헬퍼
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
            {/* 열 헤더 */}
            <div className={styles.xColHeaderRow}>
              <div className={styles.xcorner} />
              {Array.from({ length: totalHeaderCols }, (_, i) => (
                <div key={i} className={styles.xch} style={{ width: CELL, minWidth: CELL }}>
                  {colLabel(i)}
                </div>
              ))}
            </div>
            {/* 바디 */}
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
                {/* 1행: 주간 랭킹 타이틀 — 원본: background:#e8f4fd; color:#2471a3 */}
                {RankCell(weekRange(), 1, RANK_TOTAL, ['xrcWeekTitle'], { fontWeight: 'bold' }, 'title')}

                {/* 2행: 난이도 필터 버튼 — 원본: xrc-filter */}
                <div
                  key="filter"
                  className={`${styles.xrankCell} ${styles.xrcFilter}`}
                  style={{ gridColumn: `1 / span ${RANK_TOTAL}` }}
                >
                  {PRESET_LEVELS.map((lv) => (
                    <button
                      key={lv.value}
                      className={`${styles.xrankFilterBtn} ${rankLevel === lv.value ? styles.xrankFilterBtnActive : ''}`}
                      onClick={() => { setRankLevel(lv.value); loadRanking(lv.value); }}
                    >
                      {lv.shortLabel}
                    </button>
                  ))}
                </div>

                {/* 3행: 컬럼 헤더 — 원본: xrc-header (green) */}
                {(() => {
                  let cs = 1;
                  return RANK_COLS.map((col) => {
                    const start = cs;
                    cs += col.span;
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
                    const values = [String(i + 1), row.name, `${(row.time ?? 0).toFixed(2)}초`, date];
                    let cs = 1;
                    return RANK_COLS.map((col) => {
                      const start = cs;
                      cs += col.span;
                      return (
                        <div
                          key={`${row.id}-${col.label}`}
                          className={[styles.xrankCell, alt, top].filter(Boolean).join(' ')}
                          style={{ gridColumn: `${start} / span ${col.span}` }}
                          title={values[RANK_COLS.indexOf(col)]}
                        >
                          {values[RANK_COLS.indexOf(col)]}
                        </div>
                      );
                    });
                  })
                )}

                {/* 역대 1위 — 원본: background:#e8f4fd; color:#2471a3 */}
                {alltime
                  ? RankCell(
                      `👑 역대 1위  ${alltime.name} · ${(alltime.time ?? 0).toFixed(2)}초 · ${new Date(alltime.createdAt).toLocaleDateString('ko-KR')}`,
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
        const CELL = 30;
        // 원본: RULES_TOTAL_SPAN = 12
        const RULES_TOTAL = 12;
        const extraCols = Math.max(10, Math.ceil(sheetSize.width / CELL));
        const totalHeaderCols = RULES_TOTAL + extraCols;

        // 컨텐츠: 타이틀(1)+빈(1)+기본규칙섹션(1)+규칙6행+빈(1)+난이도섹션(1)+난이도헤더(1)+난이도3행+빈(1)+점수등록섹션(1)+점수3행 = 21
        const contentRows = 21;
        const extraRows = Math.max(20, Math.ceil(sheetSize.height / CELL));
        const totalRows = contentRows + extraRows;

        type CellDef = { text: string; colStart: number; span: number; cls: string[]; style?: React.CSSProperties };

        // 행 데이터 빌더
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
        function emptyRow(): CellDef[] {
          return [fullCell('', [])];
        }

        // 1행: 타이틀
        addRow(fullCell('도박꾼 지뢰찾기  —  게임 규칙', ['xrcHeader'], { justifyContent: 'center', fontSize: 14, letterSpacing: 1 }));
        // 2행: 빈
        addRow(...emptyRow());
        // 기본 규칙
        addRow(...sectionRow('■  기본 규칙'));
        [
          ['①', '좌클릭: 칸 열기 (첫 클릭은 항상 안전)'],
          ['②', '우클릭 / 길게 누르기: 🚩 깃발 → ❓ 물음표 → 빈칸 순환'],
          ['③', '숫자는 주변 8칸 안에 있는 지뢰 수를 나타냄'],
          ['④', '빈 칸 클릭 시 주변 빈 칸이 자동으로 열림'],
          ['⑤', '지뢰를 클릭하면 게임 오버  💥'],
          ['⑥', '지뢰 없는 모든 칸을 열면 승리  🎉'],
        ].forEach(([num, text], i) => {
          const alt = i % 2 === 1 ? ['xrcAlt'] : [] as string[];
          addRow(
            { text: num, colStart: 1, span: 1, cls: alt, style: { justifyContent: 'center', color: '#888' } },
            { text, colStart: 2, span: RULES_TOTAL - 1, cls: alt },
          );
        });
        addRow(...emptyRow());
        // 난이도
        addRow(...sectionRow('■  난이도'));
        addRow(
          { text: '난이도', colStart: 1, span: 3, cls: ['xrcHeader'] },
          { text: '격자 크기', colStart: 4, span: 4, cls: ['xrcHeader'], style: { justifyContent: 'center' } },
          { text: '지뢰 수', colStart: 8, span: 5, cls: ['xrcHeader'], style: { justifyContent: 'center' } },
        );
        [['쉬움', '9 × 9', '10개'], ['보통', '16 × 16', '40개'], ['어려움', '16 × 30', '99개']].forEach(([d, s, m], i) => {
          const alt = i % 2 === 1 ? ['xrcAlt'] : [] as string[];
          addRow(
            { text: d, colStart: 1, span: 3, cls: alt },
            { text: s, colStart: 4, span: 4, cls: alt, style: { justifyContent: 'center' } },
            { text: m, colStart: 8, span: 5, cls: alt, style: { justifyContent: 'center' } },
          );
        });
        addRow(...emptyRow());
        // 점수 등록
        addRow(...sectionRow('■  점수 등록'));
        [
          ['①', '클리어 시 소요 시간이 기록됨'],
          ['②', '짧은 시간일수록 높은 순위'],
          ['③', '커스텀 난이도는 랭킹 등록 불가'],
        ].forEach(([num, text], i) => {
          const alt = i % 2 === 1 ? ['xrcAlt'] : [] as string[];
          addRow(
            { text: num, colStart: 1, span: 1, cls: alt, style: { justifyContent: 'center', color: '#888' } },
            { text, colStart: 2, span: RULES_TOTAL - 1, cls: alt },
          );
        });

        return (
          <div className={styles.xSheetWrapper}>
            {/* 열 헤더 */}
            <div className={styles.xColHeaderRow}>
              <div className={styles.xcorner} />
              {Array.from({ length: totalHeaderCols }, (_, i) => (
                <div key={i} className={styles.xch} style={{ width: CELL, minWidth: CELL }}>
                  {colLabel(i)}
                </div>
              ))}
            </div>
            {/* 바디 */}
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
            <h2>CLEAR</h2>
            <p id="modal-time-text">클리어 시간: {state.elapsed.toFixed(2)}초</p>
            <input
              className={styles.nameInput}
              type="text"
              placeholder="이름을 입력하세요"
              maxLength={50}
              value={playerName}
              onChange={(e) => { setPlayerName(e.target.value); setNameBanned(false); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitRanking(); }}
              autoFocus
            />
            <p className={styles.ipNotice}>랭킹 등록 시 어뷰징 방지를 위해 IP 주소가 수집됩니다.</p>
            {nameBanned && <p className={styles.hint}>사용할 수 없는 닉네임입니다.</p>}
            {submitState === 'error' && <p className={styles.hint}>등록 실패. 다시 시도해 주세요.</p>}
            <div className={styles.modalBtns}>
              <button className={`${styles.primaryBtn} ${excel ? styles.primaryBtnExcel : ''}`} disabled={submitState === 'loading'} onClick={handleSubmitRanking}>
                {submitState === 'loading' ? '등록 중...' : '등록'}
              </button>
              <button className={styles.secondaryBtn} onClick={() => setModalOpen(false)}>건너뛰기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
