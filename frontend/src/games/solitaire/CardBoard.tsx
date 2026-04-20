import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useSolitaireGame, type DrawMode, type Card, type Selection } from './useSolitaireGame';
import { rankingsApi } from '../../api/rankings';
import { sendMovesBatch, startSolitaireSession } from '../../api/solitaire';
import { containsProfanity } from '../../utils/profanity';
import { useExcelShell } from '../../components/excel/ExcelShellContext';
import { useAuth } from '../../context/AuthContext';
import styles from './CardBoard.module.css';

// ── 일반 모드 상수 ──────────────────────────────────────────────────
// \uFE0E = text variation selector: iOS Safari에서 컬러 이모지 대신 텍스트로 렌더링
const SUIT_HINTS = ['♠\uFE0E', '♣\uFE0E', '♥\uFE0E', '♦\uFE0E'];

// ── 엑셀 모드 상수 ──────────────────────────────────────────────────
const XCW = 96;          // cell width (원본: --xcw: 96px)
const XCH = 29;          // cell height (원본: XCH = 29)
const TOTAL_COLS = 18;   // A ~ R (원본: TOTAL_COLS = 18)
const RANK_COLS = [
  { label: '순위', span: 2 },
  { label: '이름', span: 4 },
  { label: '시간', span: 2 },
  { label: '수',   span: 2 },
  { label: '날짜', span: 2 },
];
const RANK_TOTAL  = RANK_COLS.reduce((s, c) => s + c.span, 0); // 12
const RULES_TOTAL = 14;

// ── 헬퍼 ────────────────────────────────────────────────────────────
function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}분 ${String(sec).padStart(2, '0')}초` : `${s}초`;
}

function suitInit(suit: string): string {
  return ({ '♠': 'S', '♣': 'C', '♥': 'H', '♦': 'D' } as Record<string, string>)[suit] ?? suit;
}

function cardText(card: Card): string {
  return card.val + suitInit(card.suit);
}

function isCardRed(card: Card): boolean {
  return card.suit === '♥' || card.suit === '♦';
}

function getXColLabel(i: number): string {
  let label = '';
  let n = i + 1;
  while (n > 0) {
    n--;
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26);
  }
  return label;
}

function weekRangeStr(): string {
  const now = new Date();
  const day = now.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const mon = new Date(now); mon.setDate(now.getDate() + diffToMon);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  return `주간 랭킹 (${fmt(mon)} ~ ${fmt(sun)})`;
}

function calcDimensions(vw: number) {
  const gap = Math.max(5, Math.min(14, Math.round(vw * 0.018)));
  const cw  = Math.max(44, Math.min(100, Math.floor((vw - 32 - gap * 6) / 7)));
  const ch  = Math.round(cw * 1.4);
  return { cw, ch, gap };
}

// ── 타입 ─────────────────────────────────────────────────────────────
interface Dims { cw: number; ch: number; gap: number }
interface Props { excel?: boolean }

interface XCellInfo {
  text: string;
  bg: string;
  color: string;
  selected: boolean;
  onClick?: () => void;
  onDblClick?: () => void;
}

// ── CardEl 컴포넌트 (일반 모드 전용) ────────────────────────────────
function CardEl({
  card, zone, col, index, selected, dims, onSelect, onDblClick,
}: {
  card: Card;
  zone: Selection['zone'];
  col: number;
  index: number;
  selected: Selection | null;
  dims: Dims;
  onSelect: (zone: Selection['zone'], col: number, index: number) => void;
  onDblClick: (zone: Selection['zone'], col: number, index: number) => void;
}) {
  const { cw, ch } = dims;

  if (!card.faceUp) {
    return (
      <div
        className={styles.cardBack}
        style={{ width: cw, height: ch }}
        onClick={(e) => { e.stopPropagation(); }}
      />
    );
  }

  const isSelected = selected && selected.zone === zone && selected.col === col &&
    (zone === 'tableau' ? index >= selected.index : index === selected.index);

  const fs = Math.max(9, Math.min(15, Math.round(cw * 0.155)));

  return (
    <div
      className={`${styles.card} ${card.color === 'red' ? styles.red : styles.black} ${isSelected ? styles.selected : ''}`}
      style={{ width: cw, height: ch, fontSize: fs }}
      onClick={(e) => { e.stopPropagation(); onSelect(zone, col, index); }}
      onDoubleClick={(e) => { e.stopPropagation(); onDblClick(zone, col, index); }}
    >
      <div className={styles.cardTl}>{card.val}<br />{card.suit + '\uFE0E'}</div>
      <div className={styles.cardCenter}>{card.suit + '\uFE0E'}</div>
      <div className={styles.cardBr}>{card.val}<br />{card.suit + '\uFE0E'}</div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
export default function CardBoard({ excel = false }: Props) {
  const { user } = useAuth();
  const [drawMode, setDrawMode] = useState<DrawMode>('draw1');
  const {
    state, startGame, startGameWithDeck, drawStock,
    selectOrMove, clickWaste, clickFoundation, clickTableau,
    autoMoveToFoundation, undo,
  } = useSolitaireGame(drawMode);

  const sessionIdRef = useRef<string>('');
  const lastSentMovesRef = useRef<number>(0);  // 마지막으로 서버에 보낸 누적 이동 수
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState<Dims>({ cw: 70, ch: 98, gap: 8 });

  // 반응형 치수 — clientWidth 에서 padding(20px×2) 제거해 카드가 wrap 안에 맞게 수정
  // iOS Safari에서 초기 마운트 시 clientWidth가 0을 반환하는 문제를 방지하기 위해
  // ?? 대신 || 를 사용하고 ResizeObserver로 레이아웃 확정 후 재계산
  useEffect(() => {
    function update() {
      const raw = wrapRef.current?.clientWidth || window.innerWidth;
      const vw = raw - 40; // wrap padding: 20px 양쪽
      setDims(calcDimensions(Math.min(Math.max(vw, 200), 760)));
    }
    update();
    const ro = new ResizeObserver(update);
    if (wrapRef.current) ro.observe(wrapRef.current);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  // ── 모달 ──
  const [modalOpen, setModalOpen] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [submitState, setSubmitState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [nameBanned, setNameBanned] = useState(false);
  const [sessionFailed, setSessionFailed] = useState(false);

  // 모달이 열릴 때 로그인된 닉네임 자동 완성
  useEffect(() => {
    if (modalOpen) setPlayerName(user?.nickname ?? '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen]);

  // ── 랭킹 ──
  const [rankLevel, setRankLevel] = useState<DrawMode>('draw1');
  const [rankings, setRankings] = useState<{ weekly: unknown[]; alltime: unknown | null }>({ weekly: [], alltime: null });
  const [rankLoading, setRankLoading] = useState(false);
  const [showRules, setShowRules] = useState(false);

  // 이동 수 변화 감지 → 500ms 디바운스 후 배치 전송
  useEffect(() => {
    if (!sessionIdRef.current || state.status === 'idle') return;
    const delta = state.moves - lastSentMovesRef.current;
    if (delta <= 0) return;

    if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
    batchTimerRef.current = setTimeout(async () => {
      const sid = sessionIdRef.current;
      const d = state.moves - lastSentMovesRef.current;
      if (sid && d > 0) {
        lastSentMovesRef.current = state.moves;  // 낙관적 업데이트: flush와 중복 전송 방지
        try {
          await sendMovesBatch(sid, d);
        } catch {
          // 네트워크 오류 시 롤백 후 다음 배치에서 재전송
          lastSentMovesRef.current -= d;
        }
      }
    }, 500);
  }, [state.moves, state.status]);

  useEffect(() => {
    if (state.status === 'won' && !sessionFailed) {
      setTimeout(() => setModalOpen(true), 400);
    }
  }, [state.status, sessionFailed]);

  // ── Excel Shell 연동 ──────────────────────────────────────────────
  const { setFormula, setStatusItems, activeSheet, setRibbonGameGroup, sheetSize, registerNewGame } = useExcelShell();

  // 상태바 업데이트
  useEffect(() => {
    if (!excel) return;
    setStatusItems([
      { label: '이동', value: state.moves },
      { label: '시간', value: formatTime(state.elapsed) },
    ]);
  }, [excel, state.moves, state.elapsed, setStatusItems]);

  // 수식바 업데이트 — 선택 카드 기반 (원본: updateFormulaBar)
  const g = state.game;
  useEffect(() => {
    if (!excel) return;
    const sel = g.selected;
    if (!sel) {
      setFormula('A1', '=SOLITAIRE()');
    } else if (sel.zone === 'waste') {
      const card = g.waste[sel.index];
      const wasteCol = drawMode === 'draw3' ? 'D' : 'B';
      setFormula(`${wasteCol}1`, card ? `=VLOOKUP("${cardText(card)}",CardDeck,2,FALSE)` : '');
    } else if (sel.zone === 'foundation') {
      const fCols = ['E', 'F', 'G', 'H'];
      const card = g.foundations[sel.col][sel.index];
      setFormula(`${fCols[sel.col]}1`, card ? `=VLOOKUP("${cardText(card)}",Foundation,2,FALSE)` : '');
    } else if (sel.zone === 'tableau') {
      const col = getXColLabel(sel.col);
      const row = sel.index + 3;
      const card = g.tableaus[sel.col][sel.index];
      setFormula(`${col}${row}`, card ? `=MATCH("${cardText(card)}",${col}:${col},0)` : '');
    }
  }, [excel, g.selected, g.waste, g.foundations, g.tableaus, drawMode, setFormula]);

  // 리본 게임 그룹 — 드로우 모드 + 새 시트 + 되돌리기
  useEffect(() => {
    if (!excel) { setRibbonGameGroup(null); return; }
    setRibbonGameGroup(
      <div className={styles.xrgGame}>
        <div className={styles.xrgBtns}>
          {(['draw1', 'draw3'] as DrawMode[]).map(dm => (
            <div
              key={dm}
              className={`${styles.xrb} ${drawMode === dm ? styles.xrbActive : ''}`}
              onClick={() => { setDrawMode(dm); handleStartGame(dm); }}
            >
              <span className={styles.xrbIcon}>{dm === 'draw1' ? '🃏' : '🎴'}</span>
              <span>{dm === 'draw1' ? '드로우1' : '드로우3'}</span>
            </div>
          ))}
          <div className={styles.xrb} onClick={() => handleStartGame(drawMode)}>
            <span className={styles.xrbIcon}>🔄</span>
            <span>새 시트</span>
          </div>
          <div
            className={`${styles.xrb} ${!state.history.length ? styles.xrbDisabled : ''}`}
            onClick={() => { if (state.history.length) undo(); }}
          >
            <span className={styles.xrbIcon}>↩</span>
            <span>되돌리기</span>
          </div>
        </div>
        <div className={styles.xrgLabel}>데이터 분석</div>
      </div>
    );
  }, [excel, drawMode, state.history.length, setRibbonGameGroup, startGame, undo]);

  // 엑셀모드 플러스 버튼 새 게임 콜백 등록
  const newGameFnRef = useRef<() => void>(() => {});
  newGameFnRef.current = () => handleStartGame(drawMode);
  useEffect(() => {
    if (excel) registerNewGame(() => newGameFnRef.current());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excel, registerNewGame]);

  // 일반 모드: 최초 로딩 시 자동 로드
  useEffect(() => {
    if (excel) return;
    loadRanking(rankLevel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 랭킹 시트 전환 시 자동 로드
  useEffect(() => {
    if (!excel) return;
    if (activeSheet === 'ranking') loadRanking(rankLevel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excel, activeSheet]);

  async function handleStartGame(dm: DrawMode) {
    lastSentMovesRef.current = 0;
    if (batchTimerRef.current) clearTimeout(batchTimerRef.current);

    // 세션 생성 최대 3회 재시도
    let res = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        res = await startSolitaireSession(dm);
        break;
      } catch {
        if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
      }
    }

    if (res) {
      sessionIdRef.current = res.sessionId;
      setSessionFailed(false);
      startGameWithDeck(dm, res.deck);
    } else {
      // 3회 모두 실패 → 랭킹 등록 불가 상태로 클라이언트 셔플 폴백
      sessionIdRef.current = '';
      setSessionFailed(true);
      startGame(dm);
    }
  }

  // ── 데이터 ──────────────────────────────────────────────────────────
  function handleDrawModeChange(dm: DrawMode) {
    setDrawMode(dm);
    handleStartGame(dm);
  }

  async function handleSubmitRanking() {
    const name = playerName.trim();
    if (!name) return;
    if (containsProfanity(name)) { setNameBanned(true); return; }
    setNameBanned(false);
    setSubmitState('loading');

    // 잔여 이동 배치 플러시 (디바운스 취소 후 즉시 전송)
    if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
    const sid = sessionIdRef.current;
    const remaining = state.moves - lastSentMovesRef.current;
    if (sid && remaining > 0) {
      try {
        await sendMovesBatch(sid, remaining);
        lastSentMovesRef.current = state.moves;
      } catch { /* 무시 */ }
    }

    try {
      await rankingsApi.submit('solitaire', {
        level: drawMode,
        name,
        time: state.elapsed,
        moves: state.moves,
        sessionId: sessionIdRef.current,
      });
      setModalOpen(false);
      setPlayerName('');
      setSubmitState('idle');
      loadRanking(drawMode);
    } catch {
      setSubmitState('error');
    }
  }

  async function loadRanking(lv: DrawMode) {
    setRankLoading(true);
    try {
      const [weekly, alltime] = await Promise.all([
        rankingsApi.getWeekly('solitaire', lv),
        rankingsApi.getAlltimeBest('solitaire', lv),
      ]);
      setRankings({ weekly: weekly as unknown[], alltime });
    } catch {
      setRankings({ weekly: [], alltime: null });
    } finally {
      setRankLoading(false);
    }
  }

  // ── 엑셀 게임 그리드 셀 계산 (원본: getCellInfo) ───────────────────
  function getXCell(r: number, c: number): XCellInfo {
    const sel = g.selected;
    const empty: XCellInfo = { text: '', bg: 'white', color: '#333', selected: false };

    if (r === 0) {
      // A열: Stock
      if (c === 0) {
        if (g.stock.length > 0)
          return { text: `▼ ${g.stock.length}`, bg: '#e0e0e0', color: '#555', selected: false, onClick: drawStock };
        return { text: '↺', bg: '#ebebeb', color: '#888', selected: false, onClick: drawStock };
      }
      // B~D열: Waste
      if (c >= 1 && c <= 3) {
        if (drawMode === 'draw1') {
          if (c !== 1) return empty;
          if (!g.waste.length) return { ...empty, bg: '#f5f5f5' };
          const card = g.waste[g.waste.length - 1];
          const idx  = g.waste.length - 1;
          const isSel = !!(sel && sel.zone === 'waste');
          return {
            text: cardText(card),
            bg: isSel ? '#dbeafe' : 'white',
            color: isCardRed(card) ? '#c00000' : '#1a1a1a',
            selected: isSel,
            onClick:    () => selectOrMove('waste', 0, idx),
            onDblClick: () => autoMoveToFoundation('waste', 0, idx),
          };
        }
        // draw3: c=1(oldest), c=2(middle), c=3(top/클릭가능)
        const show = Math.min(3, g.waste.length);
        const slotFromTop = 3 - c; // c=3→0(top), c=2→1, c=1→2(oldest)
        if (slotFromTop >= show) return { ...empty, bg: '#f5f5f5' };
        const wasteIdx = g.waste.length - 1 - slotFromTop;
        const card = g.waste[wasteIdx];
        const isTop = slotFromTop === 0;
        if (isTop) {
          const isSel = !!(sel && sel.zone === 'waste');
          return {
            text: cardText(card),
            bg: isSel ? '#dbeafe' : 'white',
            color: isCardRed(card) ? '#c00000' : '#1a1a1a',
            selected: isSel,
            onClick:    () => selectOrMove('waste', 0, wasteIdx),
            onDblClick: () => autoMoveToFoundation('waste', 0, wasteIdx),
          };
        }
        return { text: cardText(card), bg: '#efefef', color: isCardRed(card) ? '#c87878' : '#999', selected: false };
      }
      // E~H열: Foundation 0~3
      if (c >= 4 && c <= 7) {
        const fi = c - 4;
        const f  = g.foundations[fi];
        const hints      = ['S', 'C', 'H', 'D'];
        const hintColors = ['#bbb', '#bbb', '#e8a0a0', '#e8a0a0'];
        if (!f.length)
          return { text: hints[fi], bg: '#f5f5f5', color: hintColors[fi], selected: false, onClick: () => clickFoundation(fi) };
        const card = f[f.length - 1];
        const isSel = !!(sel && sel.zone === 'foundation' && sel.col === fi);
        return {
          text: cardText(card),
          bg: isSel ? '#dbeafe' : 'white',
          color: isCardRed(card) ? '#c00000' : '#1a1a1a',
          selected: isSel,
          onClick: () => clickFoundation(fi),
        };
      }
      return empty;
    }

    // 행 1: 구분자 (빈 행)
    if (r === 1) return empty;

    // 행 2+: Tableau (A~G열)
    const tIdx = r - 2;
    if (c >= 0 && c <= 6) {
      const pile = g.tableaus[c];
      if (tIdx < pile.length) {
        const card = pile[tIdx];
        if (!card.faceUp) return { ...empty, bg: '#e8e8e8' };
        const isSel = !!(sel && sel.zone === 'tableau' && sel.col === c && tIdx >= sel.index);
        return {
          text: cardText(card),
          bg: isSel ? '#dbeafe' : 'white',
          color: isCardRed(card) ? '#c00000' : '#1a1a1a',
          selected: isSel,
          onClick:    () => selectOrMove('tableau', c, tIdx),
          onDblClick: () => autoMoveToFoundation('tableau', c, tIdx),
        };
      }
      // 파일 바로 아래 빈 셀 → 드롭 타겟
      if (tIdx === pile.length)
        return { ...empty, bg: '#fafafa', onClick: () => clickTableau(c) };
    }
    return empty;
  }

  // ── 렌더 보조 ────────────────────────────────────────────────────────
  const { cw, ch, gap } = dims;

  function getTopOffset(pile: Card[], idx: number) {
    let top = 0;
    for (let i = 0; i < idx; i++)
      top += pile[i].faceUp ? Math.round(ch * 0.28) : Math.round(ch * 0.14);
    return top;
  }

  const statusText = state.status === 'won' ? '🎉 클리어!' : '';

  // ── 엑셀 셀 렌더 헬퍼 ──────────────────────────────────────────────
  function renderXCell(info: XCellInfo, key: string | number) {
    return (
      <div
        key={key}
        style={{
          width: XCW, minWidth: XCW, height: XCH,
          borderRight: '1px solid #d0d0d0',
          borderBottom: '1px solid #d0d0d0',
          display: 'flex', alignItems: 'center',
          padding: '0 5px',
          fontFamily: 'Calibri,sans-serif',
          fontSize: 12, fontWeight: 'bold',
          background: info.bg, color: info.color,
          outline: info.selected ? '2px solid #1a73e8' : 'none',
          outlineOffset: '-2px',
          cursor: info.onClick ? 'pointer' : 'default',
          overflow: 'hidden', whiteSpace: 'nowrap' as const,
          userSelect: 'none' as const,
          position: info.selected ? 'relative' as const : undefined,
          zIndex: info.selected ? 2 : undefined,
          flexShrink: 0,
        }}
        onClick={info.onClick}
        onDoubleClick={info.onDblClick}
      >
        {info.text}
      </div>
    );
  }

  // ═══════════════ JSX ════════════════════════════════════════════════
  return (
    <div className={`${styles.wrap} ${excel ? styles.excelMode : ''}`} ref={wrapRef}>

      {/* ── 일반 모드 전용: 컨트롤 바 ── */}
      {!excel && (
        <div className={styles.controls}>
          <div className={styles.drawBtns}>
            {(['draw1', 'draw3'] as DrawMode[]).map((dm) => (
              <button
                key={dm}
                className={`${styles.diffBtn} ${drawMode === dm ? styles.diffActive : ''}`}
                onClick={() => handleDrawModeChange(dm)}
              >
                {dm === 'draw1' ? '드로우1' : '드로우3'}
              </button>
            ))}
          </div>
          <button className={styles.startBtn} onClick={() => handleStartGame(drawMode)}>새 게임</button>
        </div>
      )}

      {/* ── 일반 모드 전용: 상태 바 ── */}
      {!excel && (
        <div className={styles.statusBar}>
          <span className={styles.statusText}>{statusText}</span>
          <span className={styles.timer}>⏱ {formatTime(state.elapsed)}</span>
          <span className={styles.moves}>🃏 {state.moves}수</span>
          <button className={styles.undoBtn} disabled={!state.history.length} onClick={undo}>↩ 되돌리기</button>
        </div>
      )}

      {/* ── 세션 생성 실패 경고 배너 ── */}
      {!excel && sessionFailed && state.status !== 'idle' && (
        <div className={styles.sessionFailBanner}>
          네트워크 오류로 이 게임은 랭킹에 등록되지 않습니다
        </div>
      )}

      {/* ── 일반 모드 보드 ── */}
      {!excel && (
        <div className={styles.board} style={{ gap }}>
          {/* 상단 행: Stock | Waste | spacer | Foundation×4 */}
          <div className={styles.topRow} style={{ gap }}>
            {/* Stock */}
            <div className={styles.zone} style={{ width: cw, height: ch }} onClick={drawStock}>
              {g.stock.length > 0 ? (
                <div className={styles.cardBack} style={{ width: cw, height: ch }} />
              ) : (
                <span className={styles.stockEmpty}>↺</span>
              )}
            </div>

            {/* Waste */}
            <div
              className={styles.zone}
              style={{ width: drawMode === 'draw3' ? cw + Math.round(cw * 0.22) * 2 : cw, height: ch, position: 'relative' }}
              onClick={clickWaste}
            >
              {g.waste.length > 0 && (
                drawMode === 'draw3' ? (() => {
                  const show = Math.min(3, g.waste.length);
                  const offset = Math.round(cw * 0.22);
                  return Array.from({ length: show }, (_, k) => {
                    const idx = g.waste.length - show + k;
                    return (
                      <div key={idx} style={{ position: 'absolute', top: 0, left: k * offset, zIndex: k + 1, pointerEvents: k < show - 1 ? 'none' : undefined }}>
                        <CardEl card={g.waste[idx]} zone="waste" col={0} index={idx} selected={g.selected} dims={dims}
                          onSelect={selectOrMove} onDblClick={autoMoveToFoundation} />
                      </div>
                    );
                  });
                })() : (
                  <CardEl card={g.waste[g.waste.length - 1]} zone="waste" col={0} index={g.waste.length - 1}
                    selected={g.selected} dims={dims} onSelect={selectOrMove} onDblClick={autoMoveToFoundation} />
                )
              )}
            </div>

            {/* spacer */}
            <div style={{ width: cw, height: ch }} />

            {/* Foundation ×4 */}
            {g.foundations.map((f, fi) => (
              <div key={fi} className={styles.zone} style={{ width: cw, height: ch }} onClick={() => clickFoundation(fi)}>
                <span className={styles.fHint}>{SUIT_HINTS[fi]}</span>
                {f.length > 0 && (
                  <div style={{ position: 'absolute', top: 0, left: 0 }}>
                    <CardEl card={f[f.length - 1]} zone="foundation" col={fi} index={f.length - 1}
                      selected={g.selected} dims={dims} onSelect={selectOrMove} onDblClick={autoMoveToFoundation} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Tableau */}
          <div className={styles.tableauRow} style={{ gap, minHeight: ch * 5 }}>
            {g.tableaus.map((pile, ti) => {
              const h = pile.length ? getTopOffset(pile, pile.length - 1) + ch : ch;
              return (
                <div key={ti} className={styles.tableauCol} style={{ width: cw, height: h, minHeight: ch }} onClick={() => clickTableau(ti)}>
                  {pile.map((card, j) => (
                    <div key={j} style={{ position: 'absolute', top: getTopOffset(pile, j), left: 0, zIndex: j + 1 }}>
                      <CardEl card={card} zone="tableau" col={ti} index={j}
                        selected={g.selected} dims={dims} onSelect={selectOrMove} onDblClick={autoMoveToFoundation} />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ 엑셀 모드: 게임 시트 ══════════════════════════════════════ */}
      {excel && activeSheet === 'game' && (() => {
        const maxT = Math.max(...g.tableaus.map(t => t.length), 1);
        const numRows = 2 + maxT + 4;
        return (
          <>
            {Array.from({ length: numRows }, (_, r) => (
              <div key={r} style={{ display: 'flex' }}>
                {Array.from({ length: TOTAL_COLS }, (_, c) =>
                  renderXCell(getXCell(r, c), c)
                )}
              </div>
            ))}
          </>
        );
      })()}

      {/* ══ 엑셀 모드: 랭킹 시트 ══════════════════════════════════════ */}
      {excel && activeSheet === 'ranking' && (() => {
        const xcell = sheetSize.width > 0
          ? Math.max(XCH, Math.min(48, Math.floor((sheetSize.width - 40) / RANK_TOTAL)))
          : 30;
        const extraCols = Math.max(10, Math.ceil((sheetSize.width || 600) / xcell));
        const totalHeaderCols = RANK_TOTAL + extraCols;
        const dataRows = (rankings.weekly as Array<unknown>).length > 0 ? (rankings.weekly as Array<unknown>).length : 1;
        const contentRows = 3 + dataRows + 1; // title + filter + header + data + alltime
        const extraRows = Math.max(20, Math.ceil((sheetSize.height || 400) / XCH));
        const totalRows = contentRows + extraRows;

        type RankRow = { id: number; name: string; time: number; moves: number; createdAt: string };
        type AlltimeRow = { name: string; time: number; moves: number; createdAt: string };

        const RCell = (
          text: string,
          colStart: number,
          span: number,
          cls: string[],
          extraStyle?: CSSProperties,
          key?: string | number,
          children?: ReactNode,
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
                <div key={i} className={styles.xch} style={{ width: xcell, minWidth: xcell }}>{getXColLabel(i)}</div>
              ))}
            </div>
            <div className={styles.xBodyArea}>
              <div className={styles.xRowNums}>
                {Array.from({ length: totalRows }, (_, i) => (
                  <div key={i} className={styles.xrn} style={{ height: XCH }}>{i + 1}</div>
                ))}
              </div>
              <div
                className={styles.xRankGrid}
                style={{ gridTemplateColumns: `repeat(${RANK_TOTAL}, ${xcell}px)`, gridAutoRows: `${XCH}px` }}
              >
                {/* 1행: 주간 랭킹 타이틀 */}
                {RCell(weekRangeStr(), 1, RANK_TOTAL, ['xrcWeekTitle'], { fontWeight: 'bold' }, 'title')}

                {/* 2행: 필터 버튼 */}
                <div
                  key="filter"
                  className={`${styles.xrankCell} ${styles.xrcFilter}`}
                  style={{ gridColumn: `1 / span ${RANK_TOTAL}` }}
                >
                  {(['draw1', 'draw3'] as DrawMode[]).map((lv) => (
                    <button
                      key={lv}
                      className={`${styles.xrankFilterBtn} ${rankLevel === lv ? styles.xrankFilterBtnActive : ''}`}
                      onClick={() => { setRankLevel(lv); loadRanking(lv); }}
                    >
                      {lv === 'draw1' ? '드로우 1' : '드로우 3'}
                    </button>
                  ))}
                </div>

                {/* 3행: 컬럼 헤더 */}
                {(() => {
                  let cs = 1;
                  return RANK_COLS.map((col) => {
                    const start = cs; cs += col.span;
                    return RCell(col.label, start, col.span, ['xrcHeader'], undefined, `h-${col.label}`);
                  });
                })()}

                {/* 데이터 행 */}
                {rankLoading
                  ? RCell('불러오는 중...', 1, RANK_TOTAL, [], { color: '#888' }, 'loading')
                  : (rankings.weekly as RankRow[]).length === 0
                    ? RCell('기록 없음', 1, RANK_TOTAL, [], { color: '#aaa' }, 'empty')
                    : (rankings.weekly as RankRow[]).map((row, i) => {
                        const alt = i % 2 === 1 ? styles.xrcAlt : '';
                        const top = i === 0 ? styles.xrcTop : '';
                        const date = new Date(row.createdAt).toLocaleDateString('ko-KR');
                        const min = Math.floor(row.time / 60), sec = row.time % 60;
                        const tStr = min > 0 ? `${min}분 ${sec}초` : `${row.time}초`;
                        const values = [String(i + 1), row.name, tStr, `${row.moves}수`, date];
                        let cs = 1;
                        return RANK_COLS.map((col) => {
                          const start = cs; cs += col.span;
                          const val = values[RANK_COLS.indexOf(col)];
                          return (
                            <div
                              key={`${row.id}-${col.label}`}
                              className={[styles.xrankCell, alt, top].filter(Boolean).join(' ')}
                              style={{ gridColumn: `${start} / span ${col.span}` }}
                              title={val}
                            >{val}</div>
                          );
                        });
                      })
                }

                {/* 역대 1위 — alltime이 {} (기록 없음) 일 때는 id 없음 */}
                {(rankings.alltime as { id?: number })?.id
                  ? (() => {
                      const at = rankings.alltime as AlltimeRow;
                      const atTime = at.time ?? 0;
                      const atDate = at.createdAt ? new Date(at.createdAt).toLocaleDateString('ko-KR') : '-';
                      const atMin = Math.floor(atTime / 60), atSec = atTime % 60;
                      const atTStr = atMin > 0 ? `${atMin}분 ${atSec}초` : `${atTime}초`;
                      return RCell(
                        `👑 역대 1위  ${at.name} · ${atTStr} · ${at.moves}수 · ${atDate}`,
                        1, RANK_TOTAL, ['xrcWeekTitle'], { paddingLeft: 8 }, 'alltime'
                      );
                    })()
                  : RCell('👑 역대 1위  기록 없음', 1, RANK_TOTAL, [], { color: '#aaa', paddingLeft: 8 }, 'alltime-empty')
                }
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══ 엑셀 모드: 룰 시트 ════════════════════════════════════════ */}
      {excel && activeSheet === 'rules' && (() => {
        const cellW = sheetSize.width > 0
          ? Math.max(XCH, Math.min(48, Math.floor((sheetSize.width - 40) / RULES_TOTAL)))
          : 30;
        const extraCols = Math.max(10, Math.ceil((sheetSize.width || 600) / cellW));
        const totalHeaderCols = RULES_TOTAL + extraCols;

        type CellDef = { text: string; colStart: number; span: number; cls: string[]; style?: CSSProperties };
        const rows: CellDef[][] = [];
        const addRow = (...cells: CellDef[]) => rows.push(cells);
        const full = (text: string, cls: string[], style?: CSSProperties): CellDef =>
          ({ text, colStart: 1, span: RULES_TOTAL, cls, style });
        const section = (title: string): CellDef[] => [
          full(title, [], { background: '#e8f5e9', color: '#1a5c38', fontWeight: 'bold', borderTop: '1px solid #a5d6a7' })
        ];
        const empty = (): CellDef[] => [full('', [])];

        // 타이틀
        addRow(full('도박꾼 솔리테어  —  게임 규칙', ['xrcHeader'], { justifyContent: 'center', fontSize: 14, letterSpacing: '1px' }));
        addRow(...empty());

        // 기본 조작
        addRow(...section('■  기본 조작'));
        [
          ['①', '카드를 클릭해 선택하고, 놓을 위치를 클릭하세요'],
          ['②', '카드를 더블클릭하면 파운데이션으로 자동 이동'],
          ['③', '맨 왼쪽 위 더미(A1)를 클릭하면 카드를 뒤집습니다'],
          ['④', '더미가 비면 클릭하여 버린 카드를 다시 가져옵니다'],
          ['⑤', '↩ 되돌리기로 한 수 취소 가능 (최대 50회)'],
        ].forEach(([num, text], i) => {
          const alt = i % 2 === 1 ? ['xrcAlt'] : [] as string[];
          addRow(
            { text: num, colStart: 1, span: 1, cls: alt, style: { justifyContent: 'center', color: '#888' } },
            { text, colStart: 2, span: RULES_TOTAL - 1, cls: alt },
          );
        });
        addRow(...empty());

        // 태블로 규칙
        addRow(...section('■  태블로 규칙'));
        [
          ['①', '빨강↔검정 교대, 숫자는 1씩 감소해야 합니다'],
          ['②', '빈 칸에는 K만 놓을 수 있습니다'],
          ['③', '앞면 보이는 카드 여러 장을 한번에 이동 가능'],
        ].forEach(([num, text], i) => {
          const alt = i % 2 === 1 ? ['xrcAlt'] : [] as string[];
          addRow(
            { text: num, colStart: 1, span: 1, cls: alt, style: { justifyContent: 'center', color: '#888' } },
            { text, colStart: 2, span: RULES_TOTAL - 1, cls: alt },
          );
        });
        addRow(...empty());

        // 파운데이션 규칙
        addRow(...section('■  파운데이션 규칙 (E~H 열)'));
        [
          ['①', '같은 무늬로 A → K 순서로 쌓습니다'],
          ['②', '4개를 모두 채우면 승리!'],
        ].forEach(([num, text], i) => {
          const alt = i % 2 === 1 ? ['xrcAlt'] : [] as string[];
          addRow(
            { text: num, colStart: 1, span: 1, cls: alt, style: { justifyContent: 'center', color: '#888' } },
            { text, colStart: 2, span: RULES_TOTAL - 1, cls: alt },
          );
        });
        addRow(...empty());

        // 카드 표기
        addRow(...section('■  카드 표기'));
        addRow(
          { text: '카드', colStart: 1, span: 3, cls: ['xrcHeader'] },
          { text: '설명', colStart: 4, span: RULES_TOTAL - 3, cls: ['xrcHeader'] },
        );
        [
          ['회색 셀', '뒷면 카드'],
          ['AS, KC 등', '숫자/문자 + 무늬 이니셜 (S/C=검정, H/D=빨강)'],
        ].forEach(([card, desc], i) => {
          const alt = i % 2 === 1 ? ['xrcAlt'] : [] as string[];
          addRow(
            { text: card, colStart: 1, span: 3, cls: alt },
            { text: desc, colStart: 4, span: RULES_TOTAL - 3, cls: alt },
          );
        });
        addRow(...empty());

        // 드로우 모드
        addRow(...section('■  드로우 모드'));
        addRow(
          { text: '모드', colStart: 1, span: 3, cls: ['xrcHeader'] },
          { text: '설명', colStart: 4, span: RULES_TOTAL - 3, cls: ['xrcHeader'] },
        );
        [
          ['드로우 1', '한 번에 카드 1장씩 뒤집기 (기본)'],
          ['드로우 3', '한 번에 카드 3장씩 뒤집기 (어려움)'],
        ].forEach(([mode, desc], i) => {
          const alt = i % 2 === 1 ? ['xrcAlt'] : [] as string[];
          addRow(
            { text: mode, colStart: 1, span: 3, cls: alt },
            { text: desc, colStart: 4, span: RULES_TOTAL - 3, cls: alt },
          );
        });
        addRow(...empty());

        // 점수 등록
        addRow(...section('■  점수 등록'));
        [
          ['①', '클리어 시 소요 시간과 수가 기록됨'],
          ['②', '짧은 시간, 적은 수일수록 높은 순위'],
          ['③', '드로우 1 / 드로우 3 각각 별도 랭킹 운영'],
        ].forEach(([num, text], i) => {
          const alt = i % 2 === 1 ? ['xrcAlt'] : [] as string[];
          addRow(
            { text: num, colStart: 1, span: 1, cls: alt, style: { justifyContent: 'center', color: '#888' } },
            { text, colStart: 2, span: RULES_TOTAL - 1, cls: alt },
          );
        });

        const extraRows = Math.max(10, Math.ceil((sheetSize.height || 400) / XCH));
        const totalRows = rows.length + extraRows;

        return (
          <div className={styles.xSheetWrapper}>
            <div className={styles.xColHeaderRow}>
              <div className={styles.xcorner} />
              {Array.from({ length: totalHeaderCols }, (_, i) => (
                <div key={i} className={styles.xch} style={{ width: cellW, minWidth: cellW }}>{getXColLabel(i)}</div>
              ))}
            </div>
            <div className={styles.xBodyArea}>
              <div className={styles.xRowNums}>
                {Array.from({ length: totalRows }, (_, i) => (
                  <div key={i} className={styles.xrn} style={{ height: XCH }}>{i + 1}</div>
                ))}
              </div>
              <div
                className={styles.xRankGrid}
                style={{ gridTemplateColumns: `repeat(${RULES_TOTAL}, ${cellW}px)`, gridAutoRows: `${XCH}px` }}
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

      {/* ── 일반 모드: 랭킹 패널 ── */}
      {!excel && (
        <div className={styles.rankSection}>
          <h3 className={styles.rankTitle}>주간 RANK</h3>
          {!!(rankings.alltime as { id?: number })?.id && (
            <div className={styles.alltimeBanner}>
              <span className={styles.atLabel}>👑 역대 1위</span>
              <span className={styles.atContent}>
                {(rankings.alltime as { name: string; time: number; moves: number; createdAt: string }).name}
                {' · '}
                {formatTime(Math.round((rankings.alltime as { name: string; time: number; moves: number; createdAt: string }).time ?? 0))}
                {' · '}
                {(rankings.alltime as { name: string; time: number; moves: number; createdAt: string }).moves}수
                {' · '}
                {new Date((rankings.alltime as { name: string; time: number; moves: number; createdAt: string }).createdAt).toLocaleDateString('ko-KR')}
              </span>
            </div>
          )}
          <div className={styles.rankTabs}>
            {(['draw1', 'draw3'] as DrawMode[]).map((dm) => (
              <button
                key={dm}
                className={`${styles.rankTab} ${rankLevel === dm && !showRules ? styles.rankTabActive : ''}`}
                onClick={() => { setRankLevel(dm); loadRanking(dm); setShowRules(false); }}
              >
                {dm === 'draw1' ? '드로우1' : '드로우3'}
              </button>
            ))}
            <button
              className={`${styles.rankTab} ${showRules ? styles.rankTabActive : ''}`}
              onClick={() => setShowRules(true)}
            >룰</button>
          </div>
          {showRules ? (
            <div className={styles.rulesPanel}>
              <h4>기본 조작</h4>
              <ul>
                <li>카드를 <b>클릭</b>해 선택하고, 놓을 위치를 클릭하세요</li>
                <li>카드를 <b>더블클릭</b>하면 파운데이션으로 자동 이동</li>
                <li>왼쪽 위 더미를 클릭하면 카드를 뒤집습니다</li>
                <li>더미가 비면 클릭하여 버린 카드를 다시 가져옵니다</li>
                <li>↩ 되돌리기로 한 수 취소 가능 (최대 50회)</li>
              </ul>
              <h4>태블로 규칙</h4>
              <ul>
                <li>빨강↔검정 교대, 숫자는 1씩 감소해야 합니다</li>
                <li>빈 칸에는 <b>K</b>만 놓을 수 있습니다</li>
                <li>앞면 보이는 카드 여러 장을 한번에 이동 가능</li>
              </ul>
              <h4>파운데이션 규칙</h4>
              <ul>
                <li>같은 무늬로 <b>A → K</b> 순서로 쌓습니다</li>
                <li>4개를 모두 채우면 승리! 🎉</li>
              </ul>
              <h4>드로우 모드</h4>
              <ul>
                <li><b>드로우 1:</b> 한 번에 카드 1장씩 뒤집기 (기본)</li>
                <li><b>드로우 3:</b> 한 번에 카드 3장씩 뒤집기 (어려움)</li>
              </ul>
            </div>
          ) : rankLoading ? (
            <p className={styles.placeholder}>불러오는 중...</p>
          ) : (
            <table className={styles.rankTable}>
              <thead><tr><th>순위</th><th>이름</th><th>시간</th><th>수</th><th>날짜</th></tr></thead>
              <tbody>
                {(rankings.weekly as Array<{ id: number; name: string; time: number; moves: number; createdAt: string }>).length === 0 ? (
                  <tr><td colSpan={5} className={styles.placeholder}>기록 없음</td></tr>
                ) : (
                  (rankings.weekly as Array<{ id: number; name: string; time: number; moves: number; createdAt: string }>).map((r, i) => (
                    <tr key={r.id}>
                      <td>{i + 1}</td><td>{r.name}</td>
                      <td>{formatTime(Math.round(r.time))}</td>
                      <td>{r.moves}수</td>
                      <td>{new Date(r.createdAt).toLocaleDateString('ko-KR')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── 클리어 모달 ── */}
      {modalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h2>🎉 클리어!</h2>
            <p>{formatTime(state.elapsed)} / {state.moves}수</p>
            <input
              className={styles.nameInput}
              type="text"
              placeholder="이름을 입력하세요"
              value={playerName}
              onChange={(e) => { setPlayerName(e.target.value); setNameBanned(false); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitRanking(); }}
              autoFocus
            />
            <p className={styles.ipNotice}>랭킹 등록 시 어뷰징 방지를 위해 IP 주소가 수집됩니다.</p>
            {nameBanned && <p className={styles.hint}>사용할 수 없는 닉네임입니다.</p>}
            {submitState === 'error' && <p className={styles.hint}>등록 실패. 다시 시도해 주세요.</p>}
            <div className={styles.modalBtns}>
              <button className={styles.submitBtn} disabled={submitState === 'loading'} onClick={handleSubmitRanking}>
                {submitState === 'loading' ? '등록 중...' : '등록'}
              </button>
              <button className={styles.skipBtn} onClick={() => setModalOpen(false)}>건너뛰기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
