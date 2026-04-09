import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSolitaireGame, type DrawMode, type Card, type Selection } from './useSolitaireGame';
import { rankingsApi } from '../../api/rankings';
import { createToken } from '../../utils/hmac';
import { useExcelShell } from '../../components/excel/ExcelShellContext';
import styles from './CardBoard.module.css';

const SUIT_HINTS = ['♠', '♣', '♥', '♦'];

interface Props { excel?: boolean }

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}분 ${String(sec).padStart(2, '0')}초` : `${s}초`;
}

function calcDimensions(vw: number) {
  const gap = Math.max(5, Math.min(14, Math.round(vw * 0.018)));
  const cw  = Math.max(44, Math.min(100, Math.floor((vw - 32 - gap * 6) / 7)));
  const ch  = Math.round(cw * 1.4);
  return { cw, ch, gap };
}

interface Dims { cw: number; ch: number; gap: number }

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
      <div className={styles.cardTl}>{card.val}<br />{card.suit}</div>
      <div className={styles.cardCenter}>{card.suit}</div>
      <div className={styles.cardBr}>{card.val}<br />{card.suit}</div>
    </div>
  );
}

export default function CardBoard({ excel = false }: Props) {
  const [drawMode, setDrawMode] = useState<DrawMode>('draw1');
  const {
    state, startGame, drawStock,
    selectOrMove, clickWaste, clickFoundation, clickTableau,
    autoMoveToFoundation, undo,
  } = useSolitaireGame(drawMode);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState<Dims>({ cw: 70, ch: 98, gap: 8 });

  // 반응형 치수
  useEffect(() => {
    function update() {
      const vw = wrapRef.current?.clientWidth ?? window.innerWidth;
      setDims(calcDimensions(Math.min(vw, 760)));
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // 모달
  const [modalOpen, setModalOpen] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [submitState, setSubmitState] = useState<'idle' | 'loading' | 'error'>('idle');

  // 랭킹
  const [rankLevel, setRankLevel] = useState<DrawMode>('draw1');
  const [rankings, setRankings] = useState<unknown[]>([]);
  const [rankLoading, setRankLoading] = useState(false);

  useEffect(() => {
    if (state.status === 'won') {
      setTimeout(() => setModalOpen(true), 400);
    }
  }, [state.status]);

  // ===== Excel Shell 연동 =====
  const { setFormula, setStatusItems, activeSheet } = useExcelShell();
  useEffect(() => {
    if (!excel) return;
    setFormula('A1', `=SOLITAIRE_MOVE(count,${state.moves})`);
    setStatusItems([
      { label: '이동', value: state.moves },
      { label: '시간', value: formatTime(state.elapsed) },
    ]);
  }, [excel, state.moves, state.elapsed, setFormula, setStatusItems]);

  function handleDrawModeChange(dm: DrawMode) {
    setDrawMode(dm);
    startGame(dm);
  }

  async function handleSubmitRanking() {
    const name = playerName.trim();
    if (!name) return;
    setSubmitState('loading');
    try {
      const { token, timestamp } = await createToken('solitaire', drawMode, state.elapsed);
      await rankingsApi.submit('solitaire', {
        level: drawMode,
        name,
        time: state.elapsed,
        moves: state.moves,
        token,
        timestamp,
      });
      setModalOpen(false);
      loadRanking(drawMode);
    } catch {
      setSubmitState('error');
    }
  }

  async function loadRanking(lv: DrawMode) {
    setRankLoading(true);
    try {
      const data = await rankingsApi.getWeekly('solitaire', lv);
      setRankings(data as unknown[]);
    } catch {
      setRankings([]);
    } finally {
      setRankLoading(false);
    }
  }

  const { cw, ch, gap } = dims;
  const g = state.game;

  // tableau 카드 오프셋
  function getTopOffset(pile: Card[], idx: number) {
    let top = 0;
    for (let i = 0; i < idx; i++)
      top += pile[i].faceUp ? Math.round(ch * 0.28) : Math.round(ch * 0.14);
    return top;
  }

  const statusText = state.status === 'won' ? '🎉 클리어!' : '';

  const showGameArea    = !excel || activeSheet === 'game';
  const showRankingArea = !excel || activeSheet === 'ranking';

  return (
    <div className={`${styles.wrap} ${excel ? styles.excelMode : ''}`} ref={wrapRef}>
      {!excel && (
        <div className={styles.header}>
          <Link to="/" className={styles.backLink}>← 홈</Link>
          <h2 className={styles.title}>🃏 솔리테어</h2>
        </div>
      )}

      {/* 컨트롤 바 — 일반 모드에서만 */}
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
          <button className={styles.startBtn} onClick={() => startGame(drawMode)}>새 게임</button>
          <button className={styles.undoBtn} disabled={!state.history.length} onClick={undo}>↩ 되돌리기</button>
        </div>
      )}

      {/* 상태 바 — 일반 모드에서만 */}
      {!excel && (
        <div className={styles.statusBar}>
          <span className={styles.statusText}>{statusText}</span>
          <span className={styles.timer}>⏱ {formatTime(state.elapsed)}</span>
          <span className={styles.moves}>🃏 {state.moves}수</span>
        </div>
      )}

      {/* 보드 — 게임 시트 */}
      {showGameArea && <div className={styles.board} style={{ gap }}>
        {/* 상단 행: Stock | Waste | spacer | Foundation×4 */}
        <div className={styles.topRow} style={{ gap }}>
          {/* Stock */}
          <div
            className={styles.zone}
            style={{ width: cw, height: ch }}
            onClick={drawStock}
          >
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
            <div
              key={fi}
              className={styles.zone}
              style={{ width: cw, height: ch }}
              onClick={() => clickFoundation(fi)}
            >
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
        <div className={styles.tableauRow} style={{ gap }}>
          {g.tableaus.map((pile, ti) => {
            const h = pile.length ? getTopOffset(pile, pile.length - 1) + ch : ch;
            return (
              <div
                key={ti}
                className={styles.tableauCol}
                style={{ width: cw, height: h, minHeight: ch }}
                onClick={() => clickTableau(ti)}
              >
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
      </div>}

      {/* 랭킹 — 랭킹 시트 */}
      {showRankingArea && <div className={styles.rankSection}>
        <div className={styles.rankTabs}>
          {(['draw1', 'draw3'] as DrawMode[]).map((dm) => (
            <button
              key={dm}
              className={`${styles.rankTab} ${rankLevel === dm ? styles.rankTabActive : ''}`}
              onClick={() => { setRankLevel(dm); loadRanking(dm); }}
            >
              {dm === 'draw1' ? '드로우1' : '드로우3'}
            </button>
          ))}
        </div>
        {rankLoading ? (
          <p className={styles.placeholder}>불러오는 중...</p>
        ) : (
          <table className={styles.table}>
            <thead><tr><th>순위</th><th>이름</th><th>시간</th><th>수</th><th>날짜</th></tr></thead>
            <tbody>
              {(rankings as Array<{ id: number; name: string; time: number; moves: number; createdAt: string }>).length === 0 ? (
                <tr><td colSpan={5} className={styles.placeholder}>기록 없음</td></tr>
              ) : (
                (rankings as Array<{ id: number; name: string; time: number; moves: number; createdAt: string }>).map((r, i) => (
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
      </div>}

      {/* 클리어 모달 */}
      {modalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>🎉 클리어!</h3>
            <p>{formatTime(state.elapsed)} / {state.moves}수</p>
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
