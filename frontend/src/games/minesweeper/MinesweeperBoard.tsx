import { useCallback, useEffect, useRef, useState } from 'react';
import { useMinesweeperGame, type Level } from './useMinesweeperGame';
import { rankingsApi } from '../../api/rankings';
import { createToken } from '../../utils/hmac';
import { useExcelShell } from '../../components/excel/ExcelShellContext';
import styles from './MinesweeperBoard.module.css';

const PRESET_LEVELS: { value: Exclude<Level, 'custom'>; label: string; shortLabel: string; icon: string }[] = [
  { value: 'beginner',     label: '초급 (9×9, 10개)',    shortLabel: '쉬움',   icon: '📈' },
  { value: 'intermediate', label: '중급 (16×16, 40개)',   shortLabel: '보통',   icon: '📊' },
  { value: 'expert',       label: '고급 (16×30, 99개)',   shortLabel: '어려움', icon: '📉' },
];

const NUM_COLORS = ['', '#0000ff','#007b00','#ff0000','#00007b','#7b0000','#007b7b','#000000','#7b7b7b'];

interface Props { excel?: boolean }

export default function MinesweeperBoard({ excel = false }: Props) {
  const [level, setLevel] = useState<Level>('beginner');
  const { state, reset, resetCustom, revealCell, chordClick, toggleMark } = useMinesweeperGame('beginner');

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

  // 랭킹
  const [rankLevel, setRankLevel] = useState<Exclude<Level, 'custom'>>('beginner');
  const [activeTab, setActiveTab] = useState<'beginner' | 'intermediate' | 'expert' | 'rules'>('beginner');
  const [rankings, setRankings] = useState<unknown[]>([]);
  const [rankLoading, setRankLoading] = useState(false);

  // 양클릭 추적
  const mouseButtonsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (state.status === 'won') setModalOpen(true);
  }, [state.status]);

  // ===== Excel Shell 연동 =====
  const { setFormula, setStatusItems, activeSheet, setRibbonGameGroup } = useExcelShell();

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
    setSubmitState('loading');
    try {
      const rankLv = level === 'custom' ? 'beginner' : level;
      const { token, timestamp } = await createToken('minesweeper', rankLv, state.elapsed.toFixed(2));
      await rankingsApi.submit('minesweeper', { level: rankLv, name, time: state.elapsed, token, timestamp });
      setModalOpen(false);
      loadRanking(rankLv);
    } catch {
      setSubmitState('error');
    }
  }

  async function loadRanking(lv: Exclude<Level, 'custom'>) {
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
      {excel && showRankingArea && (
        <div className={styles.rankSection}>
          <div className={styles.rankTabs}>
            {PRESET_LEVELS.map((lv) => (
              <button
                key={lv.value}
                className={`${styles.rankTab} ${rankLevel === lv.value ? styles.rankTabActive : ''}`}
                onClick={() => { setRankLevel(lv.value); loadRanking(lv.value); }}
              >
                {lv.shortLabel}
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

      {/* ── 엑셀 모드: 룰 시트 ── */}
      {excel && showRulesArea && activeSheet === 'rules' && (
        <div className={styles.rulesPanel}>
          <h4>기본 규칙</h4>
          <ul>
            <li>좌클릭: 칸 열기 (첫 클릭은 항상 안전)</li>
            <li>우클릭 / 길게 누르기: 🚩 깃발 → ❓ 물음표 → 빈칸 순환</li>
            <li>숫자는 주변 8칸 안에 있는 지뢰 수를 나타냄</li>
            <li>지뢰를 클릭하면 게임 오버 💥</li>
            <li>지뢰 없는 모든 칸을 열면 승리 🎉</li>
          </ul>
          <h4>난이도</h4>
          <ul>
            <li>쉬움: 9×9 격자, 지뢰 10개</li>
            <li>보통: 16×16 격자, 지뢰 40개</li>
            <li>어려움: 16×30 격자, 지뢰 99개</li>
          </ul>
        </div>
      )}

      {/* ── 클리어 모달 ── */}
      {modalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h2>🎉 클리어!</h2>
            <p id="modal-time-text">클리어 시간: {state.elapsed.toFixed(2)}초</p>
            <input
              className={styles.nameInput}
              type="text"
              placeholder="이름을 입력하세요"
              maxLength={50}
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitRanking(); }}
              autoFocus
            />
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
