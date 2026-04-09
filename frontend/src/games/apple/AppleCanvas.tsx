import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppleGame } from './useAppleGame';
import { rankingsApi } from '../../api/rankings';
import { createToken } from '../../utils/hmac';
import { useExcelShell } from '../../components/excel/ExcelShellContext';
import styles from './AppleCanvas.module.css';

interface Props { excel?: boolean }

// 엑셀 모드 색상 팔레트
const XL_CLR = {
  normal: { bg: '#FFFFFF', bd: '#D0D0D0', tx: '#555555' },
  hit:    { bg: '#E5F7E8', bd: '#9ED4A5', tx: '#276327' },
  low:    { bg: '#DCEEF8', bd: '#8BBDD8', tx: '#1F497D' },
  over:   { bg: '#E0E0E0', bd: '#B0B0B0', tx: '#666666' },
};

function drawAppleShape(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  fillColor: string, strokeColor: string | null
) {
  const scale = 0.27;
  ctx.save();
  ctx.translate(cx - 50 * scale, cy - 50 * scale);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.moveTo(50, 88);
  ctx.bezierCurveTo(30, 95, 10, 75, 15, 50);
  ctx.bezierCurveTo(20, 20, 40, 25, 50, 35);
  ctx.bezierCurveTo(60, 25, 80, 20, 85, 50);
  ctx.bezierCurveTo(90, 75, 70, 95, 50, 88);
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();
  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 8;
    ctx.setLineDash([]);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(34, 55, 8, 14, -Math.PI / 5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(50, 35); ctx.bezierCurveTo(48, 20, 52, 10, 55, 5);
  ctx.bezierCurveTo(57, 5, 53, 20, 50, 35); ctx.closePath();
  ctx.fillStyle = '#5C4033'; ctx.fill();
  ctx.beginPath();
  ctx.moveTo(55, 20); ctx.bezierCurveTo(65, 10, 80, 15, 80, 15);
  ctx.bezierCurveTo(80, 15, 75, 25, 65, 25);
  ctx.bezierCurveTo(55, 25, 55, 20, 55, 20);
  ctx.closePath(); ctx.fillStyle = '#4CBB17'; ctx.fill();
  ctx.restore();
}

function calcSelection(
  sx: number, sy: number, ex: number, ey: number,
  rows: number, cols: number, apples: (number | null)[][],
  pad: number, size: number
) {
  const x1 = Math.min(sx, ex), x2 = Math.max(sx, ex);
  const y1 = Math.min(sy, ey), y2 = Math.max(sy, ey);
  const selected: { r: number; c: number }[] = [];
  let sum = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (apples[r][c] === null) continue;
      const ax = pad + c * size + size / 2;
      const ay = pad + r * size + size / 2;
      if (ax >= x1 && ax <= x2 && ay >= y1 && ay <= y2) {
        selected.push({ r, c });
        sum += apples[r][c] as number;
      }
    }
  }
  return { selected, sum };
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export default function AppleCanvas({ excel = false }: Props) {
  const { state, start, end, removeApples } = useAppleGame();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // 레이아웃
  const [layout, setLayout] = useState({ rows: 10, cols: 17, size: 28, pad: 8 });

  // 드래그 상태 (ref로 관리 — render 없이 draw만 트리거)
  const dragRef = useRef({ active: false, sx: 0, sy: 0, cx: 0, cy: 0 });

  // 드래그 합계 표시
  const [dragSum, setDragSum] = useState<number | null>(null);

  // 상태 메시지
  const [msg, setMsg] = useState('▶ 시작 버튼을 눌러주세요');

  // 모달
  const [modalOpen, setModalOpen] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [submitState, setSubmitState] = useState<'idle' | 'loading' | 'error'>('idle');

  // 랭킹
  const [rankings, setRankings] = useState<{ weekly: unknown[]; alltime: unknown | null }>({ weekly: [], alltime: null });
  const [rankLoading, setRankLoading] = useState(false);
  const [showRules, setShowRules] = useState(false);

  // 레이아웃 계산
  const calcLayout = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const isPortrait = window.innerHeight > window.innerWidth;
    const cols = excel ? 17 : (isPortrait ? 10 : 17);
    const rows = excel ? 10 : (isPortrait ? 17 : 10);
    const maxW = Math.min(wrap.clientWidth - 16, 560);
    const pad = excel ? 0 : 8;
    const size = Math.max(24, Math.min(excel ? 40 : 30, Math.floor((maxW - pad * 2) / cols)));
    setLayout({ rows, cols, size, pad });
    return { rows, cols, size, pad };
  }, [excel]);

  useEffect(() => {
    calcLayout();
    const handler = () => calcLayout();
    window.addEventListener('resize', handler);
    window.addEventListener('orientationchange', handler);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('orientationchange', handler);
    };
  }, [calcLayout]);

  // timeLeft === 0 → end
  useEffect(() => {
    if (state.status === 'playing' && state.timeLeft <= 0) {
      end();
    }
  }, [state.timeLeft, state.status, end]);

  // ===== Excel Shell 연동 =====
  const { setFormula, setStatusItems, activeSheet } = useExcelShell();
  useEffect(() => {
    if (!excel) return;
    setFormula('A1', `=APPLE_SCORE(sum,${state.score})`);
    setStatusItems([
      { label: '점수', value: state.score },
      { label: '남은 시간', value: `${state.timeLeft}s` },
    ]);
  }, [excel, state.score, state.timeLeft, setFormula, setStatusItems]);

  // 게임 종료 → 모달
  useEffect(() => {
    if (state.status === 'ended') {
      setMsg('GAME OVER');
      draw();
      setTimeout(() => setModalOpen(true), 300);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  // draw
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { rows, cols, size, pad } = layout;
    const { apples } = state;
    if (!apples.length) return;

    canvas.width  = pad * 2 + cols * size;
    canvas.height = pad * 2 + rows * size;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const drag = dragRef.current;
    let selSet = new Set<string>();
    let selSum = 0;
    if (drag.active) {
      const { selected, sum } = calcSelection(drag.sx, drag.sy, drag.cx, drag.cy, rows, cols, apples, pad, size);
      selected.forEach(({ r, c }) => selSet.add(`${r},${c}`));
      selSum = sum;
    }

    if (excel) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = pad + c * size + size / 2;
        const cy = pad + r * size + size / 2;
        const x  = pad + c * size;
        const y  = pad + r * size;
        const isSelected = selSet.has(`${r},${c}`);

        if (excel) {
          if (apples[r][c] === null) {
            ctx.strokeStyle = '#E0E0E0'; ctx.lineWidth = 1; ctx.setLineDash([]);
            ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
            continue;
          }
          let clr = XL_CLR.normal;
          if (isSelected) {
            if (selSum === 10)     clr = XL_CLR.hit;
            else if (selSum > 10) clr = XL_CLR.over;
            else                  clr = XL_CLR.low;
          }
          const fs = Math.max(10, Math.min(15, Math.floor(size * 0.44)));
          ctx.fillStyle = clr.bg;
          ctx.fillRect(x, y, size, size);
          ctx.strokeStyle = clr.bd; ctx.lineWidth = 1; ctx.setLineDash([]);
          ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
          ctx.fillStyle = clr.tx;
          ctx.font = `bold ${fs}px Calibri,sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(String(apples[r][c]), x + size / 2, y + size / 2);
        } else {
          if (apples[r][c] === null) continue;
          let bodyColor = '#e74c3c';
          let borderColor: string | null = null;
          if (isSelected) {
            if (selSum === 10)     { bodyColor = '#27ae60'; borderColor = '#1a8a4a'; }
            else if (selSum > 10) { bodyColor = '#e67e22'; borderColor = '#b05a00'; }
            else                  { bodyColor = '#3498db'; borderColor = '#1a6aa0'; }
          }
          drawAppleShape(ctx, cx, cy, bodyColor, borderColor);
          ctx.fillStyle = 'white';
          ctx.font = 'bold 12px Arial';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(String(apples[r][c]), cx, cy + 3);
        }
      }
    }

    // 게임 종료 오버레이
    if (state.status === 'ended') {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'white';
      ctx.font = excel ? 'bold 22px Calibri,sans-serif' : 'bold 28px Arial';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 18);
      ctx.font = excel ? '16px Calibri,sans-serif' : 'bold 20px Arial';
      ctx.fillStyle = excel ? '#FFEB9C' : '#ffe0e0';
      ctx.fillText(`최종 점수: ${state.score}점`, canvas.width / 2, canvas.height / 2 + 18);
    }

    // 드래그 선택 영역
    if (drag.active) {
      const x1 = Math.min(drag.sx, drag.cx), x2 = Math.max(drag.sx, drag.cx);
      const y1 = Math.min(drag.sy, drag.cy), y2 = Math.max(drag.sy, drag.cy);
      let rgb = excel ? '120,120,120' :
        selSum === 10 ? '39,174,96' : selSum > 10 ? '230,126,34' : '52,152,219';
      ctx.strokeStyle = `rgba(${rgb},0.8)`;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      ctx.setLineDash([]);
      ctx.fillStyle = `rgba(${rgb},0.07)`;
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
    }
  }, [state, layout, excel]);

  // state/layout 변경 시 재드로우
  useEffect(() => { draw(); }, [draw]);

  // 포인터 위치 변환
  function getPos(e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const src = 'touches' in e ? (e as TouchEvent).touches[0] : (e as MouseEvent);
    return {
      x: (src.clientX - rect.left) * (canvas.width / rect.width),
      y: (src.clientY - rect.top)  * (canvas.height / rect.height),
    };
  }

  function handlePointerDown(e: React.MouseEvent | React.TouchEvent) {
    if (state.status !== 'playing') return;
    const p = getPos(e);
    dragRef.current = { active: true, sx: p.x, sy: p.y, cx: p.x, cy: p.y };
    setDragSum(0);
    draw();
  }

  // document-level move/up (마우스가 canvas 밖으로 나가도 동작)
  useEffect(() => {
    function onMove(e: MouseEvent | TouchEvent) {
      if (!dragRef.current.active) return;
      const p = getPos(e);
      dragRef.current.cx = p.x;
      dragRef.current.cy = p.y;
      const { rows, cols, size, pad } = layout;
      const { sum } = calcSelection(
        dragRef.current.sx, dragRef.current.sy,
        dragRef.current.cx, dragRef.current.cy,
        rows, cols, state.apples, pad, size
      );
      setDragSum(sum);
      draw();
    }
    function onUp(e: MouseEvent | TouchEvent) {
      if (!dragRef.current.active) return;
      const p = getPos(e);
      dragRef.current.cx = p.x;
      dragRef.current.cy = p.y;

      // 합계 10이면 제거
      const { rows, cols, size, pad } = layout;
      const { selected, sum } = calcSelection(
        dragRef.current.sx, dragRef.current.sy,
        dragRef.current.cx, dragRef.current.cy,
        rows, cols, state.apples, pad, size
      );
      if (sum === 10 && selected.length > 0) {
        removeApples(selected);
        setMsg(`✅ +${selected.length}점!`);
        setTimeout(() => { if (state.status === 'playing') setMsg('사과를 드래그하세요!'); }, 700);
      }
      dragRef.current.active = false;
      setDragSum(null);
      draw();
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, state.apples, state.status, draw, removeApples]);

  function handleStart() {
    const l = calcLayout() ?? layout;
    start(l.rows, l.cols);
    setMsg('사과를 드래그하세요!');
    setModalOpen(false);
    setPlayerName('');
    setSubmitState('idle');
    setDragSum(null);
  }

  async function handleSubmitRanking() {
    const name = playerName.trim();
    if (!name) return;
    setSubmitState('loading');
    try {
      const { token, timestamp } = await createToken('apple', 'normal', state.score);
      await rankingsApi.submit('apple', { level: 'normal', name, score: state.score, token, timestamp });
      setModalOpen(false);
      loadRanking();
    } catch {
      setSubmitState('error');
    }
  }

  async function loadRanking() {
    setRankLoading(true);
    try {
      const [weekly, alltime] = await Promise.all([
        rankingsApi.getWeekly('apple', 'normal'),
        rankingsApi.getAlltimeBest('apple', 'normal'),
      ]);
      setRankings({ weekly: weekly as unknown[], alltime });
    } catch {
      setRankings({ weekly: [], alltime: null });
    } finally {
      setRankLoading(false);
    }
  }

  const timeWarning = state.status === 'playing' && state.timeLeft <= 30;
  const showGameArea    = !excel || activeSheet === 'game';
  const showRankingArea = !excel || activeSheet === 'ranking';

  return (
    <div className={`${styles.wrap} ${excel ? styles.excelMode : ''}`} ref={wrapRef}>

      {/* 정보 바 — 일반 모드에서만 */}
      {!excel && (
        <div className={styles.infoBar}>
          <div className={styles.infoItem}>
            <div className={styles.infoLabel}>점수</div>
            <div className={styles.infoValue}>{state.score}</div>
          </div>
          <div className={styles.infoItem}>
            <div className={styles.infoLabel}>남은 시간</div>
            <div className={`${styles.infoValue} ${timeWarning ? styles.timeWarning : ''}`}>
              {formatTime(state.timeLeft)}
            </div>
          </div>
          <div className={styles.infoItem}>
            <div className={styles.infoLabel}>선택 합계</div>
            <div className={styles.infoValue}>{dragSum !== null ? dragSum : '-'}</div>
          </div>
        </div>
      )}

      {/* 상태 메시지 — 일반 모드에서만 */}
      {!excel && <div className={styles.statusMsg}>{msg}</div>}

      {/* 캔버스 — 게임 시트 */}
      {showGameArea && (
        <div className={styles.canvasWrap}>
          <canvas
            ref={canvasRef}
            className={styles.canvas}
            onMouseDown={handlePointerDown}
            onTouchStart={(e) => { e.preventDefault(); handlePointerDown(e); }}
          />
        </div>
      )}

      {/* 시작 버튼 — 일반 모드에서만 */}
      {!excel && (
        <div className={styles.controls}>
          <button className={styles.startBtn} onClick={handleStart}>
            {state.status === 'idle' ? '▶ 시작' : '↺ 다시하기'}
          </button>
        </div>
      )}

      {/* 랭킹 — 랭킹 시트 */}
      {showRankingArea && (
        <div className={styles.rankSection}>
          {!excel && <h3 className={styles.rankTitle}>주간 RANK</h3>}
          {!excel && rankings.alltime && (
            <div className={styles.alltimeBanner}>
              <span className={styles.atLabel}>👑 역대 1위</span>
              <span className={styles.atContent}>
                {(rankings.alltime as { name: string; score: number; createdAt: string }).name}
                {' · '}
                {(rankings.alltime as { name: string; score: number; createdAt: string }).score.toLocaleString()}점
                {' · '}
                {new Date((rankings.alltime as { name: string; score: number; createdAt: string }).createdAt).toLocaleDateString('ko-KR')}
              </span>
            </div>
          )}
          <div className={styles.rankTabs}>
            <button
              className={`${styles.rankTab} ${!showRules ? styles.rankTabActive : ''}`}
              onClick={() => { setShowRules(false); loadRanking(); }}
            >랭킹</button>
            {!excel && (
              <button
                className={`${styles.rankTab} ${showRules ? styles.rankTabActive : ''}`}
                onClick={() => setShowRules(true)}
              >룰</button>
            )}
          </div>
          {showRules ? (
            <div className={styles.rulesPanel}>
              <h4>게임 방법</h4>
              <ul>
                <li>격자에 놓인 사과(1~9)를 마우스로 드래그해 직사각형 선택</li>
                <li>선택한 사과의 합이 <strong>10</strong>이면 사과가 사라지고 점수 획득</li>
                <li>합이 10이 아니면 선택이 취소됨</li>
                <li>사라진 자리는 빈 공간으로 남음 (중력 없음)</li>
              </ul>
              <h4>점수 계산</h4>
              <ul>
                <li>제거된 사과 1개당 1점</li>
                <li>시간 내에 최대한 많은 사과를 제거하세요</li>
              </ul>
              <h4>색상 안내 (드래그 중)</h4>
              <ul>
                <li>파란색: 합계 10 미만 (더 선택 가능)</li>
                <li>초록색: 합계 정확히 10 (제거 가능!)</li>
                <li>빨간색: 합계 10 초과 (범위 축소 필요)</li>
              </ul>
              <h4>제한시간</h4>
              <ul>
                <li>2분 (120초)</li>
              </ul>
            </div>
          ) : rankLoading ? (
            <p className={styles.placeholder}>불러오는 중...</p>
          ) : (
            <table className={styles.rankTable}>
              <thead><tr><th>순위</th><th>이름</th><th>점수</th><th>날짜</th></tr></thead>
              <tbody>
                {(rankings.weekly as Array<{ id: number; name: string; score: number; createdAt: string }>).length === 0 ? (
                  <tr><td colSpan={4} className={styles.placeholder}>기록 없음</td></tr>
                ) : (
                  (rankings.weekly as Array<{ id: number; name: string; score: number; createdAt: string }>).map((r, i) => (
                    <tr key={r.id}>
                      <td>{i + 1}</td><td>{r.name}</td>
                      <td>{r.score.toLocaleString()}점</td>
                      <td>{new Date(r.createdAt).toLocaleDateString('ko-KR')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* 게임 오버 모달 */}
      {modalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h2>GAME OVER</h2>
            <p>최종 점수: <strong>{state.score}점</strong></p>
            <input
              className={styles.nameInput}
              type="text"
              placeholder="이름을 입력하세요"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitRanking(); }}
              autoFocus
            />
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
