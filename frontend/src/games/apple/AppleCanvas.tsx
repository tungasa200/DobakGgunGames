import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppleGame } from './useAppleGame';
import { rankingsApi } from '../../api/rankings';
import { startAppleSession } from '../../api/apple';
import { containsProfanity } from '../../utils/profanity';
import { useExcelShell } from '../../components/excel/ExcelShellContext';
import { useAuth } from '../../context/AuthContext';
import { useAdminTest } from '../../context/AdminTestContext';
import styles from './AppleCanvas.module.css';

interface Props { excel?: boolean }

// 엑셀 모드 고정 크기 — 원본: SIZE = 30, PAD = SIZE
const EXCEL_SIZE = 30;
const EXCEL_PAD  = 30;
const EXCEL_ROWS = 10;
const EXCEL_COLS = 17;

// 엑셀 모드 색상 팔레트 — 원본 XL_CLR
const XL_CLR = {
  normal: { bg: '#FFFFFF', bd: '#D0D0D0', tx: '#555555' },
  hit:    { bg: '#E5F7E8', bd: '#9ED4A5', tx: '#276327' },
  low:    { bg: '#DCEEF8', bd: '#8BBDD8', tx: '#1F497D' },
  over:   { bg: '#E0E0E0', bd: '#B0B0B0', tx: '#666666' },
};

// 열 라벨 (A, B, ..., AA, ...)
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

// 주간 날짜 범위
function weekRange(): string {
  const now = new Date();
  const day = now.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const mon = new Date(now); mon.setDate(now.getDate() + diffToMon);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  return `주간 랭킹 (${fmt(mon)} ~ ${fmt(sun)})`;
}

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

function drawPotatoShape(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  fillColor: string, strokeColor: string | null
) {
  // SVG viewBox 0 0 200 200, 몸통 범위 x:40~180 y:30~180
  // 시각적 중심 ≈ (110, 108)
  const scale = 0.18;
  ctx.save();
  ctx.translate(cx - 110 * scale, cy - 108 * scale);
  ctx.scale(scale, scale);

  // 몸통 경로 — SVG path 그대로
  ctx.beginPath();
  ctx.moveTo(60, 60);
  ctx.bezierCurveTo(40, 80, 40, 120, 70, 150);
  ctx.bezierCurveTo(100, 180, 150, 170, 165, 130);
  ctx.bezierCurveTo(180, 90, 160, 50, 120, 40);
  ctx.bezierCurveTo(90, 30, 70, 45, 60, 60);
  ctx.closePath();

  // 기본 상태: 방사형 그라디언트, 선택 상태: solid
  if (fillColor === '#C4A35A') {
    const grad = ctx.createRadialGradient(95, 88, 8, 110, 108, 82);
    grad.addColorStop(0, '#E8C9A3');
    grad.addColorStop(1, '#C09668');
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = fillColor;
  }
  ctx.fill();

  // 테두리 — 선택 시 강조색, 기본 시 SVG 원본색
  ctx.strokeStyle = strokeColor ?? '#966F47';
  ctx.lineWidth = strokeColor ? 9 : 5;
  ctx.setLineDash([]);
  ctx.stroke();

  // 눈 (SVG circle 위치 그대로)
  ctx.fillStyle = 'rgba(111,78,55,0.7)';
  ([ [85,75,2.5], [130,80,3], [110,115,2], [150,105,2.5], [95,140,3], [135,145,2] ] as [number,number,number][])
    .forEach(([ex, ey, er]) => {
      ctx.beginPath();
      ctx.arc(ex, ey, er, 0, Math.PI * 2);
      ctx.fill();
    });

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
  const { user } = useAuth();
  const { state, init, start, startWithBoard, end, removeApples, eventsRef } = useAppleGame();
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const wrapRef      = useRef<HTMLDivElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);

  // 레이아웃
  const [layout, setLayout] = useState(
    excel
      ? { rows: EXCEL_ROWS, cols: EXCEL_COLS, size: EXCEL_SIZE, pad: EXCEL_PAD }
      : { rows: 10, cols: 17, size: 28, pad: 8 }
  );

  // 세션 ID
  const sessionIdRef = useRef<string>('');
  const [sessionFailed, setSessionFailed] = useState(false);

  // 보드 크기 모드 — 일반 모드 전용
  const boardSizeModeRef = useRef<'normal' | 'large'>('normal');
  const [boardSizeMode, setBoardSizeMode] = useState<'normal' | 'large'>('normal');
  const handleBoardSizeChange = (mode: 'normal' | 'large') => {
    if (state.status === 'playing') return;
    boardSizeModeRef.current = mode;
    setBoardSizeMode(mode);
  };
  // 현재 진행 중인(또는 방금 끝낸) 게임 레벨 — 랭킹 제출 시 사용
  const currentLevelRef = useRef<'normal' | 'large'>('normal');

  // 세로 모드로 보드를 전치했는지 여부 (순위 등록 시 좌표 역전치에 사용)
  const boardTransposedRef = useRef(false);

  // 감자 테마
  const [potatoTheme, setPotatoTheme] = useState(() =>
    localStorage.getItem('dobakggun-apple-theme') === 'potato'
  );
  const togglePotatoTheme = () => setPotatoTheme(prev => {
    const next = !prev;
    localStorage.setItem('dobakggun-apple-theme', next ? 'potato' : 'apple');
    return next;
  });

  // 드래그 상태
  const dragRef = useRef({ active: false, sx: 0, sy: 0, cx: 0, cy: 0 });

  // 드래그 합계
  const [dragSum, setDragSum] = useState<number | null>(null);

  // 상태 메시지 (일반 모드)
  const [msg, setMsg] = useState('▶ 시작 버튼을 눌러주세요');

  // 모달
  const [modalOpen, setModalOpen] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [submitState, setSubmitState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [nameBanned, setNameBanned] = useState(false);

  // 모달이 열릴 때 로그인된 닉네임 자동 완성
  useEffect(() => {
    if (modalOpen) setPlayerName(user?.nickname ?? '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen]);

  // 일반 모드 랭킹
  const [rankings, setRankings] = useState<{ weekly: unknown[]; alltime: unknown | null }>({ weekly: [], alltime: null });
  const [rankLoading, setRankLoading] = useState(false);
  const [rankTab, setRankTab] = useState<'normal' | 'large' | 'rules'>('normal');
  const [displayCount, setDisplayCount] = useState(10);

  // 엑셀 모드 랭킹
  const [excelRankings, setExcelRankings] = useState<unknown[]>([]);
  const [excelAlltime, setExcelAlltime] = useState<unknown | null>(null);
  const [excelRankLoading, setExcelRankLoading] = useState(false);
  const [excelDisplayCount, setExcelDisplayCount] = useState(10);

  // 레이아웃 계산 — 원본 setupLayout() 에 대응
  const calcLayout = useCallback(() => {
    if (excel) {
      // 엑셀 모드: 고정 SIZE — 원본: PAD = SIZE
      const l = { rows: EXCEL_ROWS, cols: EXCEL_COLS, size: EXCEL_SIZE, pad: EXCEL_PAD };
      setLayout(l);
      return l;
    }
    const wrap = wrapRef.current;
    if (!wrap) return;
    const isPortrait = window.innerHeight > window.innerWidth;
    const isLarge = boardSizeModeRef.current === 'large';
    const pad = 8;
    let cols: number, rows: number, size: number;
    if (isLarge) {
      if (isPortrait) {
        // 모바일 세로: 12×25 = 300칸
        // 가용 폭 = clientWidth - wrap padding(40) - canvas pad(16) - canvas border(4)
        cols = 12; rows = 25;
        size = Math.max(24, Math.min(30, Math.floor((wrap.clientWidth - 60) / cols)));
      } else {
        // 데스크탑 가로: 20×15 = 300칸, 30px 고정
        cols = 20; rows = 15;
        size = 30;
      }
    } else {
      cols = isPortrait ? 10 : 17;
      rows = isPortrait ? 17 : 10;
      size = Math.max(24, Math.min(30, Math.floor((Math.min(wrap.clientWidth - 16, 560) - pad * 2) / cols)));
    }
    // 원본: canvas-wrap에 max-width 동적 설정 (큰 판은 제한 없음)
    if (canvasWrapRef.current) {
      canvasWrapRef.current.style.maxWidth = isLarge ? 'none' : `${pad * 2 + cols * size}px`;
    }
    const l = { rows, cols, size, pad };
    setLayout(l);
    return l;
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
  // boardSizeMode 변경 시 레이아웃 재계산 (boardSizeModeRef를 통해 최신값 읽음)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calcLayout, boardSizeMode]);

  // 마운트 및 보드 크기 모드 변경 시 사과 초기 배치
  useEffect(() => {
    if (state.status === 'playing') return; // 게임 중에는 재배치 금지
    if (excel) {
      init(EXCEL_ROWS, EXCEL_COLS);
    } else {
      const l = calcLayout();
      if (l) init(l.rows, l.cols);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excel, boardSizeMode]);

  // timeLeft === 0 → end
  useEffect(() => {
    if (state.status === 'playing' && state.timeLeft <= 0) {
      end();
    }
  }, [state.timeLeft, state.status, end]);

  // ===== Excel Shell 연동 =====
  const { setFormula, setStatusItems, activeSheet, setRibbonGameGroup, sheetSize, registerNewGame } = useExcelShell();

  // 일반 모드: 최초 로딩 시 자동 로드
  useEffect(() => {
    if (excel) return;
    loadRanking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 엑셀 모드: 랭킹 시트 전환 시 자동 로드
  useEffect(() => {
    if (!excel || activeSheet !== 'ranking') return;
    loadExcelRanking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excel, activeSheet]);

  // 수식바 / 상태바 — 원본: xl-score, xl-time, xl-sum
  useEffect(() => {
    if (!excel) return;
    setFormula('A1', `=APPLE_SCORE(sum,${state.score})`);
    setStatusItems([
      { label: '점수', value: state.score },
      { label: '시간', value: formatTime(state.timeLeft) },
      { label: '선택합계', value: dragSum !== null ? dragSum : '-' },
    ]);
  }, [excel, state.score, state.timeLeft, dragSum, setFormula, setStatusItems]);

  // 게임 종료 → 모달
  useEffect(() => {
    if (state.status === 'ended') {
      setMsg('GAME OVER');
      draw();
      setRankTab(currentLevelRef.current as 'normal' | 'large');
      if (!sessionFailed) setTimeout(() => setModalOpen(true), 300);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  // 어드민 강제 클리어
  const { register } = useAdminTest();
  const forceClearRef = useRef<() => void>(() => {});
  forceClearRef.current = async () => {
    try {
      const res = await startAppleSession();
      sessionIdRef.current = res.sessionId;
    } catch { /* ignore */ }
    setModalOpen(true);
  };
  useEffect(() => {
    register(() => forceClearRef.current());
    return () => register(() => {});
  }, [register]);

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
      // 원본: 테두리 빈 셀 한 줄 (배경과 동화되는 패딩 역할)
      ctx.strokeStyle = '#D0D0D0';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      for (let r = -1; r <= rows; r++) {
        for (let c = -1; c <= cols; c++) {
          if (r >= 0 && r < rows && c >= 0 && c < cols) continue;
          const bx = pad + c * size;
          const by = pad + r * size;
          ctx.strokeRect(bx + 0.5, by + 0.5, size - 1, size - 1);
        }
      }
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = pad + c * size + size / 2;
        const cy = pad + r * size + size / 2;
        const x  = pad + c * size;
        const y  = pad + r * size;
        const isSelected = selSet.has(`${r},${c}`);

        if (excel) {
          if (!apples[r] || apples[r][c] === null) {
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
          if (!apples[r] || apples[r][c] === null) continue;
          let bodyColor = potatoTheme ? '#C4A35A' : '#e03a27';
          let borderColor: string | null = null;
          if (isSelected) {
            if (selSum === 10)     { bodyColor = '#27ae60'; borderColor = '#1a8a4a'; }
            else if (selSum > 10) { bodyColor = '#e67e22'; borderColor = '#b05a00'; }
            else                  { bodyColor = '#3498db'; borderColor = '#1a6aa0'; }
          }
          if (potatoTheme) {
            drawPotatoShape(ctx, cx, cy, bodyColor, borderColor);
          } else {
            drawAppleShape(ctx, cx, cy, bodyColor, borderColor);
          }
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
  }, [state, layout, excel, potatoTheme]);

  useEffect(() => { draw(); }, [draw]);

  // 포인터 위치 변환
  function getPos(e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    // touchend 시 touches[]는 빈 배열 → changedTouches[0] 폴백
    const src = 'touches' in e
      ? ((e as TouchEvent).touches[0] ?? (e as TouchEvent).changedTouches[0])
      : (e as MouseEvent);
    if (!src) return { x: 0, y: 0 };
    return {
      x: (src.clientX - rect.left) * (canvas.width / rect.width),
      y: (src.clientY - rect.top)  * (canvas.height / rect.height),
    };
  }

  function handlePointerDown(e: React.MouseEvent | React.TouchEvent | TouchEvent) {
    if (state.status !== 'playing') return;
    const p = getPos(e as React.MouseEvent | React.TouchEvent);
    dragRef.current = { active: true, sx: p.x, sy: p.y, cx: p.x, cy: p.y };
    setDragSum(0);
    // draw() 호출 제거: stale closure로 인해 제거된 사과가 순간 다시 보이는 버그 방지.
    // onMove가 즉시 이어서 호출되므로 별도 draw 불필요.
  }

  // handlePointerDown을 항상 최신 버전으로 유지하는 ref
  const handlePointerDownRef = useRef(handlePointerDown);
  handlePointerDownRef.current = handlePointerDown;

  // touchstart를 non-passive로 등록 (React JSX onTouchStart는 passive라 preventDefault 불가)
  // 마운트 시 한 번만 등록하되, ref를 통해 항상 최신 핸들러를 호출
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    function onTouchStart(e: TouchEvent) {
      e.preventDefault();
      handlePointerDownRef.current(e);
    }
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    return () => canvas.removeEventListener('touchstart', onTouchStart);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onMove(e: MouseEvent | TouchEvent) {
      if (!dragRef.current.active) return;
      // 터치 드래그 중 페이지 스크롤 방지
      if ('touches' in e) e.preventDefault();
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
      const { rows, cols, size, pad } = layout;
      const { selected, sum } = calcSelection(
        dragRef.current.sx, dragRef.current.sy,
        dragRef.current.cx, dragRef.current.cy,
        rows, cols, state.apples, pad, size
      );
      dragRef.current.active = false;
      setDragSum(null);
      if (sum === 10 && selected.length > 0) {
        // removeApples가 상태 업데이트를 트리거하므로 draw()를 따로 호출하지 않음
        // (여기서 draw() 호출 시 구 상태로 잠깐 렌더되는 플리커 발생)
        removeApples(selected);
        setMsg(`✅ +${selected.length}점!`);
        setTimeout(() => { if (state.status === 'playing') setMsg('사과를 드래그하세요!'); }, 700);
      } else {
        // 제거 없을 때만 수동으로 draw() 호출해 드래그 선택 박스를 지움
        draw();
      }
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

  async function handleStart() {
    setMsg('사과를 드래그하세요!');
    setModalOpen(false);
    setPlayerName('');
    setSubmitState('idle');
    setDragSum(null);
    // 현재 선택된 크기 모드 확정
    const level = boardSizeMode;
    currentLevelRef.current = level;

    // 세션 생성 최대 3회 재시도
    let res = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        res = await startAppleSession(level, !excel && window.innerHeight > window.innerWidth);
        break;
      } catch {
        if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
      }
    }

    if (res) {
      sessionIdRef.current = res.sessionId;
      setSessionFailed(false);
      const base = (excel ? layout : calcLayout()) ?? layout;

      // 세로 모드일 때 서버의 가로형(10×17) 보드를 전치해 세로형(17×10)으로 변환
      let board = res.board;
      const isPortrait = !excel && base.rows > base.cols;
      const needsTranspose = isPortrait && board.length < (board[0]?.length ?? 0);
      if (needsTranspose) {
        board = Array.from({ length: board[0].length }, (_, c) =>
          Array.from({ length: board.length }, (_, r) => board[r][c])
        );
      }
      boardTransposedRef.current = needsTranspose;

      const syncedLayout = { rows: board.length, cols: board[0]?.length ?? base.cols, size: base.size, pad: base.pad };
      setLayout(syncedLayout);
      if (canvasWrapRef.current) {
        canvasWrapRef.current.style.maxWidth = level === 'large' ? 'none' : `${syncedLayout.pad * 2 + syncedLayout.cols * syncedLayout.size}px`;
      }
      startWithBoard(board);
    } else {
      // 3회 모두 실패 → 클라이언트 난수로 폴백
      sessionIdRef.current = '';
      setSessionFailed(true);
      boardTransposedRef.current = false;
      const l = (excel ? layout : calcLayout()) ?? layout;
      start(l.rows, l.cols);
    }
  }

  // 엑셀모드 플러스 버튼 새 게임 콜백 등록
  const handleStartRef = useRef(handleStart);
  handleStartRef.current = handleStart;
  useEffect(() => {
    if (excel) registerNewGame(() => handleStartRef.current());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excel, registerNewGame]);

  // 리본 게임 그룹 등록 — 원본 ribbonGroupHtml에 대응
  useEffect(() => {
    if (!excel) {
      setRibbonGameGroup(null);
      return;
    }
    setRibbonGameGroup(
      <div className={styles.xrgGame}>
        <div className={styles.xrgBtns}>
          <div className={styles.xrb} onClick={handleStart}>
            <span className={styles.xrbIcon}>▶</span>
            <span>시작</span>
          </div>
          <div className={styles.xrb} onClick={handleStart}>
            <span className={styles.xrbIcon}>↺</span>
            <span>다시하기</span>
          </div>
        </div>
        <div className={styles.xrgLabel}>사과게임</div>
      </div>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excel, state.status, setRibbonGameGroup]);

  async function handleSubmitRanking() {
    const name = playerName.trim();
    if (!name) return;
    if (containsProfanity(name)) { setNameBanned(true); return; }
    setNameBanned(false);
    setSubmitState('loading');
    try {
      // 세로 모드로 보드를 전치한 경우 서버 원본 좌표(r↔c 교환)로 역변환
      const submittedEvents = boardTransposedRef.current
        ? eventsRef.current.map(e => ({ ...e, cells: e.cells.map(([r, c]) => [c, r]) }))
        : eventsRef.current;
      await rankingsApi.submit('apple', {
        level: currentLevelRef.current,
        name,
        score: state.score,
        sessionId: sessionIdRef.current,
        events: submittedEvents,
      });
      setModalOpen(false);
      setPlayerName('');
      setSubmitState('idle');
      if (excel) {
        loadExcelRanking();
      } else {
        loadRanking();
      }
    } catch {
      setSubmitState('error');
    }
  }

  async function loadRanking(level?: 'normal' | 'large') {
    setRankLoading(true);
    setDisplayCount(10);
    const lv = level ?? 'normal';
    try {
      const [weekly, alltime] = await Promise.all([
        rankingsApi.getWeekly('apple', lv),
        rankingsApi.getAlltimeBest('apple', lv),
      ]);
      const safeAlltime = (alltime && typeof alltime === 'object' && 'id' in (alltime as object)) ? alltime : null;
      setRankings({ weekly: weekly as unknown[], alltime: safeAlltime });
    } catch {
      setRankings({ weekly: [], alltime: null });
    } finally {
      setRankLoading(false);
    }
  }

  async function loadExcelRanking() {
    setExcelRankLoading(true);
    setExcelDisplayCount(10);
    try {
      const [weekly, alltime] = await Promise.all([
        rankingsApi.getWeekly('apple', 'normal'),
        rankingsApi.getAlltimeBest('apple', 'normal'),
      ]);
      setExcelRankings(weekly as unknown[]);
      setExcelAlltime((alltime && typeof alltime === 'object' && 'id' in (alltime as object)) ? alltime : null);
    } catch {
      setExcelRankings([]);
      setExcelAlltime(null);
    } finally {
      setExcelRankLoading(false);
    }
  }

  const timeWarning = state.status === 'playing' && state.timeLeft <= 30;
  const showGameArea    = !excel || activeSheet === 'game';
  const showRankingArea = !excel || activeSheet === 'ranking';
  const showRulesArea   = !excel || activeSheet === 'rules';

  // 엑셀 랭킹 시트 — 원본 buildRankingGrid() 에 대응
  const RANK_COLS = [
    { label: '순위', span: 2 },
    { label: '이름', span: 5 },
    { label: '점수', span: 3 },
    { label: '날짜', span: 3 },
  ];
  const RANK_TOTAL = RANK_COLS.reduce((s, c) => s + c.span, 0); // 13
  const RANK_CELL_W = EXCEL_SIZE; // 배경 격자(30px)와 일치
  const RANK_ROW_H  = EXCEL_SIZE; // 배경 격자(30px)와 일치

  // 엑셀 룰 시트 — 원본 buildRulesSheet() 에 대응
  const RULES_TOTAL  = 12;
  const RULES_CELL_W = EXCEL_SIZE; // 배경 격자(30px)와 일치

  return (
    <div className={`${styles.wrap} ${excel ? styles.excelMode : ''} ${!excel && potatoTheme ? styles.potatoTheme : ''}`} ref={wrapRef}>

      {/* 정보 바 — 일반 모드 */}
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

      {/* 상태 메시지 — 일반 모드 */}
      {!excel && <div className={styles.statusMsg}>{msg}</div>}

      {/* 보드 크기 선택 + 테마 토글 — 일반 모드 */}
      {!excel && (
        <div className={styles.sizePicker}>
          <button
            className={`${styles.sizeBtn} ${boardSizeMode === 'normal' ? styles.sizeBtnActive : ''}`}
            onClick={() => handleBoardSizeChange('normal')}
            disabled={state.status === 'playing'}
          >기본</button>
          <button
            className={`${styles.sizeBtn} ${boardSizeMode === 'large' ? styles.sizeBtnActive : ''}`}
            onClick={() => handleBoardSizeChange('large')}
            disabled={state.status === 'playing'}
          >큰 판</button>
          <button
            className={`${styles.themeBtn} ${potatoTheme ? styles.themeBtnActive : ''}`}
            onClick={togglePotatoTheme}
          >
            {potatoTheme ? '🍎 사과' : '🥔 감자'}
          </button>
        </div>
      )}

      {/* 세션 생성 실패 경고 배너 */}
      {!excel && sessionFailed && state.status === 'playing' && (
        <div className={styles.sessionFailBanner}>
          네트워크 오류로 이 게임은 랭킹에 등록되지 않습니다
        </div>
      )}

      {/* 캔버스 — 게임 시트 */}
      {showGameArea && (
        <div className={`${styles.canvasWrap} ${!excel && boardSizeMode === 'large' ? styles.canvasWrapLarge : ''}`} ref={canvasWrapRef}>
          <canvas
            ref={canvasRef}
            className={`${styles.canvas} ${excel ? styles.canvasExcel : ''} ${!excel && boardSizeMode === 'large' ? styles.canvasLarge : ''}`}
            onMouseDown={handlePointerDown}
          />
        </div>
      )}

      {/* 시작 버튼 — 일반 모드 */}
      {!excel && (
        <div className={styles.controls}>
          <button className={styles.startBtn} onClick={handleStart}>
            {state.status === 'idle' ? '▶ 시작' : '↺ 다시하기'}
          </button>
        </div>
      )}

      {/* 일반 모드: 랭킹 패널 */}
      {!excel && showRankingArea && (
        <div className={styles.rankSection}>
          <h3 className={styles.rankTitle}>주간 RANK</h3>
          {rankTab !== 'rules' && !!rankings.alltime && (
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
              className={`${styles.rankTab} ${rankTab === 'normal' ? styles.rankTabActive : ''}`}
              onClick={() => { setRankTab('normal'); loadRanking('normal'); }}
            >기본</button>
            <button
              className={`${styles.rankTab} ${rankTab === 'large' ? styles.rankTabActive : ''}`}
              onClick={() => { setRankTab('large'); loadRanking('large'); }}
            >큰 판</button>
            <button
              className={`${styles.rankTab} ${rankTab === 'rules' ? styles.rankTabActive : ''}`}
              onClick={() => setRankTab('rules')}
            >룰</button>
          </div>
          {rankTab === 'rules' ? (
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
                  (rankings.weekly as Array<{ id: number; name: string; score: number; createdAt: string }>).slice(0, displayCount).map((r, i) => (
                    <tr key={r.id}>
                      <td>{i + 1}</td><td>{r.name}</td>
                      <td>{r.score.toLocaleString()}점</td>
                      <td>{new Date(r.createdAt).toLocaleDateString('ko-KR')}</td>
                    </tr>
                  ))
                )}
                {(rankings.weekly as Array<unknown>).length > displayCount && (
                  <tr>
                    <td colSpan={4} style={{ padding: '10px', textAlign: 'center', background: '#fafafa' }}>
                      <button
                        type="button"
                        onClick={() => setDisplayCount(c => c + 10)}
                        style={{
                          padding: '6px 24px', cursor: 'pointer',
                          background: '#fff', border: '1px solid #f18064',
                          borderRadius: '4px', color: '#f18064',
                          fontSize: '13px', fontWeight: 600,
                        }}
                      >
                        더보기
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* 엑셀 모드: 랭킹 시트 — 원본 buildRankingGrid() 구조 완전 이식 */}
      {excel && showRankingArea && (() => {
        const extraCols = Math.max(8, Math.ceil(sheetSize.width / RANK_CELL_W));
        const totalHeaderCols = RANK_TOTAL + extraCols;
        const excelLen = (excelRankings as unknown[]).length;
        const visibleRankCount = Math.min(excelLen, excelDisplayCount);
        const hasMore = excelLen > excelDisplayCount;
        const dataRowCount = (excelLen > 0 ? visibleRankCount : 1) + (hasMore ? 1 : 0);
        const contentRows = 3 + dataRowCount + 1; // title + header + data + alltime
        const extraRows = Math.max(20, Math.ceil(sheetSize.height / RANK_ROW_H));
        const totalRows = contentRows + extraRows;

        type RankRow = { id: number; name: string; score: number; createdAt: string };
        const rows = excelRankings as RankRow[];
        const at = excelAlltime as (RankRow | null);

        const RankCell = (
          text: string,
          colStart: number,
          span: number,
          cls: string[],
          extraStyle?: React.CSSProperties,
          key?: string | number,
        ) => (
          <div
            key={key ?? `${colStart}-${text}`}
            className={[styles.xrankCell, ...cls.map(c => styles[c as keyof typeof styles])].filter(Boolean).join(' ')}
            style={{ gridColumn: `${colStart} / span ${span}`, ...extraStyle }}
            title={text}
          >
            {text}
          </div>
        );

        return (
          <div className={styles.xSheetWrapper}>
            <div className={styles.xColHeaderRow}>
              <div className={styles.xcorner} />
              {Array.from({ length: totalHeaderCols }, (_, i) => (
                <div key={i} className={styles.xch} style={{ width: RANK_CELL_W, minWidth: RANK_CELL_W }}>{colLabel(i)}</div>
              ))}
            </div>
            <div className={styles.xBodyArea}>
              <div className={styles.xRowNums}>
                {Array.from({ length: totalRows }, (_, i) => (
                  <div key={i} className={styles.xrn} style={{ height: RANK_ROW_H }}>{i + 1}</div>
                ))}
              </div>
              <div
                className={styles.xRankGrid}
                style={{ gridTemplateColumns: `repeat(${RANK_TOTAL}, ${RANK_CELL_W}px)`, gridAutoRows: `${RANK_ROW_H}px` }}
              >
                {/* 1행: 주간 랭킹 타이틀 — 원본: background:#e8f5e9; color:#1b5e20 */}
                {RankCell(weekRange(), 1, RANK_TOTAL, ['xrcWeekTitle'], { fontWeight: 'bold' }, 'title')}

                {/* 2행: 컬럼 헤더 — 원본: xrc-header (초록) */}
                {(() => {
                  let cs = 1;
                  return RANK_COLS.map((col) => {
                    const start = cs;
                    cs += col.span;
                    return RankCell(col.label, start, col.span, ['xrcHeader'], undefined, `h-${col.label}`);
                  });
                })()}

                {/* 데이터 행 */}
                {excelRankLoading ? (
                  RankCell('불러오는 중...', 1, RANK_TOTAL, [], { color: '#888' }, 'loading')
                ) : rows.length === 0 ? (
                  RankCell('기록 없음', 1, RANK_TOTAL, [], { color: '#aaa' }, 'empty')
                ) : (
                  rows.slice(0, excelDisplayCount).map((row, i) => {
                    const alt = i % 2 === 1 ? styles.xrcAlt : '';
                    const top = i === 0 ? styles.xrcTop : '';
                    const date = new Date(row.createdAt).toLocaleDateString('ko-KR');
                    const values = [String(i + 1), row.name, `${row.score.toLocaleString()}점`, date];
                    let cs = 1;
                    return RANK_COLS.map((col, ci) => {
                      const start = cs;
                      cs += col.span;
                      return (
                        <div
                          key={`${row.id}-${col.label}`}
                          className={[styles.xrankCell, alt, top].filter(Boolean).join(' ')}
                          style={{ gridColumn: `${start} / span ${col.span}` }}
                          title={values[ci]}
                        >
                          {values[ci]}
                        </div>
                      );
                    });
                  })
                )}

                {/* 더보기 행 */}
                {hasMore && (
                  <div
                    key="more"
                    className={styles.xrankCell}
                    style={{
                      gridColumn: `1 / span ${RANK_TOTAL}`,
                      background: '#fafafa',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setExcelDisplayCount(c => c + 10)}
                      style={{
                        padding: '4px 18px', cursor: 'pointer',
                        background: '#fff', border: '1px solid #1b5e20',
                        borderRadius: '4px', color: '#1b5e20',
                        fontSize: '12px', fontWeight: 600,
                      }}
                    >
                      더보기
                    </button>
                  </div>
                )}

                {/* 역대 1위 — 원본: background:#e8f5e9; color:#1b5e20 */}
                {at
                  ? RankCell(
                      `👑 역대 1위  ${at.name} · ${at.score.toLocaleString()}점 · ${new Date(at.createdAt).toLocaleDateString('ko-KR')}`,
                      1, RANK_TOTAL, ['xrcWeekTitle'], { paddingLeft: 8 }, 'alltime'
                    )
                  : RankCell('👑 역대 1위  기록 없음', 1, RANK_TOTAL, [], { color: '#aaa', paddingLeft: 8 }, 'alltime-empty')
                }
              </div>
            </div>
          </div>
        );
      })()}

      {/* 엑셀 모드: 룰 시트 — 원본 buildRulesSheet() 구조 완전 이식 */}
      {excel && showRulesArea && (() => {
        const extraCols = Math.max(8, Math.ceil(sheetSize.width / RULES_CELL_W));
        const totalHeaderCols = RULES_TOTAL + extraCols;
        // 타이틀(1)+빈(1)+기본규칙섹션(1)+5행+빈(1)+색상안내섹션(1)+4행+빈(1)+점수계산섹션(1)+2행 = 18
        const contentRows = 18;
        const extraRows = Math.max(20, Math.ceil(sheetSize.height / RANK_ROW_H));
        const totalRows = contentRows + extraRows;

        type CellDef = { text: string; colStart: number; span: number; cls: string[]; style?: React.CSSProperties; children?: React.ReactNode };
        const rowDefs: CellDef[][] = [];

        function addRow(...cells: CellDef[]) { rowDefs.push(cells); }
        function fullCell(text: string, cls: string[], style?: React.CSSProperties): CellDef {
          return { text, colStart: 1, span: RULES_TOTAL, cls, style };
        }
        function sectionRow(title: string): CellDef[] {
          return [fullCell(title, [], { background: '#e8f5e9', color: '#1b5e20', fontWeight: 'bold', borderTop: '1px solid #a5d6a7' })];
        }
        function emptyRow(): CellDef[] { return [fullCell('', [])]; }

        // 1행: 타이틀
        addRow(fullCell('도박꾼 사과게임 — 게임 규칙', ['xrcHeader'], { justifyContent: 'center', fontSize: 14, letterSpacing: 1 }));
        // 2행: 빈
        addRow(...emptyRow());
        // 기본 규칙
        addRow(...sectionRow('■  기본 규칙'));
        [
          ['①', '격자에 놓인 숫자(1~9)를 마우스로 드래그해 직사각형 영역 선택'],
          ['②', '선택한 숫자들의 합이 정확히 10이면 해당 셀이 제거되고 점수 획득'],
          ['③', '합이 10이 아니면 선택이 취소됨'],
          ['④', '제거된 자리는 빈 셀로 남음 (중력 없음)'],
          ['⑤', '제한 시간(2분) 내에 최대한 많은 셀을 제거하세요'],
        ].forEach(([num, text], i) => {
          const alt = i % 2 === 1 ? ['xrcAlt'] : [] as string[];
          addRow(
            { text: num, colStart: 1, span: 1, cls: alt, style: { justifyContent: 'center', color: '#888' } },
            { text, colStart: 2, span: RULES_TOTAL - 1, cls: alt },
          );
        });
        addRow(...emptyRow());
        // 색상 안내 — 원본: xl-color-swatch 포함
        addRow(...sectionRow('■  선택 색상 안내 (드래그 중)'));
        const colors = [
          { bg: '#FFFFFF', tx: '#555555', label: '기본',   desc: '흰색 — 기본 (미선택)' },
          { bg: '#DCEEF8', tx: '#1F497D', label: '합<10',  desc: '연한 파랑 — 합계 10 미만 (더 선택 가능)' },
          { bg: '#E5F7E8', tx: '#276327', label: '합=10',  desc: '연한 초록 — 합계 정확히 10 (제거 가능!)' },
          { bg: '#E0E0E0', tx: '#666666', label: '합>10',  desc: '연한 회색 — 합계 10 초과 (범위 축소 필요)' },
        ];
        colors.forEach(({ bg, tx, label, desc }, i) => {
          const alt = i % 2 === 1 ? ['xrcAlt'] : [] as string[];
          addRow(
            { text: label, colStart: 1, span: 2, cls: alt, style: { background: bg, color: tx, fontWeight: 'bold', justifyContent: 'center' } },
            { text: desc,  colStart: 3, span: RULES_TOTAL - 2, cls: alt },
          );
        });
        addRow(...emptyRow());
        // 점수 계산
        addRow(...sectionRow('■  점수 계산'));
        [['①', '제거된 셀 1개당 1점'], ['②', '시간 내에 최대한 많은 셀을 제거하세요']].forEach(([num, text], i) => {
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
                <div key={i} className={styles.xch} style={{ width: RULES_CELL_W, minWidth: RULES_CELL_W }}>{colLabel(i)}</div>
              ))}
            </div>
            <div className={styles.xBodyArea}>
              <div className={styles.xRowNums}>
                {Array.from({ length: totalRows }, (_, i) => (
                  <div key={i} className={styles.xrn} style={{ height: RANK_ROW_H }}>{i + 1}</div>
                ))}
              </div>
              <div
                className={styles.xRankGrid}
                style={{ gridTemplateColumns: `repeat(${RULES_TOTAL}, ${RULES_CELL_W}px)`, gridAutoRows: `${RANK_ROW_H}px` }}
              >
                {rowDefs.map((cells, ri) =>
                  cells.map((cell, ci) => (
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
              onChange={(e) => { setPlayerName(e.target.value); setNameBanned(false); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitRanking(); }}
              autoFocus
            />
            <p className={styles.ipNotice}>어뷰징 방지를 위해 IP 주소가 수집됩니다.</p>
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
