import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { rankingsApi, startSession } from '../../api/rankings';
import { containsProfanity } from '../../utils/profanity';
import { useExcelShell } from '../../components/excel/ExcelShellContext';
import { useAuth } from '../../context/AuthContext';
import { useAdminTest } from '../../context/AdminTestContext';
import { useBgm } from '../../hooks/useBgm';
import styles from './BlockfallBoard.module.css';

const BGM_SRC = '/bgm/blockfall/blockfall_default.mp3';

// ===== 엑셀 랭킹/룰 시트 상수 (원본 blockfall/excel.html 동일) =====
const XL_CELL = 30; // 원본: CELL_SIZE = 30
const RANK_COLS_BF = [
  { label: '순위', span: 2 },
  { label: '이름', span: 4 },
  { label: '점수', span: 4 },
  { label: '날짜', span: 3 },
];
const RANK_TOTAL_BF = RANK_COLS_BF.reduce((s, c) => s + c.span, 0); // 13
const RULES_TOTAL_BF = 12; // 원본: RULES_TOTAL_SPAN = 12

function bfWeekRangeStr(): string {
  const now = new Date();
  const day = now.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const mon = new Date(now); mon.setDate(now.getDate() + diffToMon);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  return `주간 랭킹 (${fmt(mon)} ~ ${fmt(sun)})`;
}

function bfColLabel(i: number): string {
  let label = '';
  let n = i + 1;
  while (n > 0) {
    n--;
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26);
  }
  return label;
}

// ===== 상수 =====
const BOARD_W = 11, VISIBLE_H = 21, BUFFER_H = 2, BOARD_H = VISIBLE_H + BUFFER_H, CELL = 30;

const COLORS_NORMAL = [
  null,
  '#ffaa0d', // 1: T
  '#f4b0c6', // 2: O
  '#ABEE62', // 3: L
  '#0DC2FF', // 4: J
  '#F7597C', // 5: I
  '#FFE138', // 6: S
  '#CA41D9', // 7: Z
];

const COLORS_EXCEL = [
  null,
  '#F4B942', // T
  '#E8C4CE', // O
  '#C5E89A', // L
  '#7DD3E8', // J
  '#7B9ED9', // I
  '#F0DB70', // S
  '#D98FE0', // Z
];

const PIECES = 'TOLJISZ';

const DROP_SPEEDS: Record<string, number[]> = {
  easy:   [800, 690, 600, 520, 450, 390, 340, 300, 265, 235, 210],
  normal: [400, 340, 290, 248, 213, 183, 158, 137, 119, 104,  91],
  hard:   [180, 150, 125, 105,  88,  74,  63,  53,  45,  38,  32],
};

const LINE_SCORES = [0, 100, 300, 500, 800];
const TSPIN_SCORES = {
  full: [400, 800, 1200, 1600],
  mini: [100, 200, 400],
};
// 싹슬이(Perfect Clear) 보너스 — 줄 제거 후 보드가 완전히 빈 상태일 때 추가 지급
// 인덱스: [미사용, 1줄, 2줄, 3줄, 4줄]
const PERFECT_CLEAR_BONUS = [0, 800, 1200, 1800, 2000];

const T_FRONT_CORNERS = [
  [0, 1], [1, 3], [2, 3], [0, 2],
];

const LOCK_DELAY = 500;
const MAX_LOCK_RESETS = 15;

type Level = 'easy' | 'normal' | 'hard';
type GameStatus = 'idle' | 'playing' | 'paused' | 'over';

type Matrix = number[][];
interface Player { pos: { x: number; y: number }; matrix: Matrix | null }

// ===== 헬퍼 =====
function createMatrix(w: number, h: number): Matrix {
  return Array.from({ length: h }, () => new Array(w).fill(0));
}

function createPiece(type: string): Matrix {
  // 표준 SRS 가이드라인 spawn 형태 — 모든 블록이 buffer zone(2줄) 안에 들어오게 정의.
  // 평평한 면이 아래를 향하고, I는 가로로 spawn.
  const P: Record<string, Matrix> = {
    T: [[0,1,0],[1,1,1],[0,0,0]],
    O: [[2,2],[2,2]],
    L: [[0,0,3],[3,3,3],[0,0,0]],
    J: [[4,0,0],[4,4,4],[0,0,0]],
    I: [[0,0,0,0],[5,5,5,5],[0,0,0,0],[0,0,0,0]],
    S: [[0,6,6],[6,6,0],[0,0,0]],
    Z: [[7,7,0],[0,7,7],[0,0,0]],
  };
  return P[type].map(row => [...row]);
}

function shuffleBag(): string[] {
  const bag = [...PIECES];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

function pieceFromType(type: string): Matrix {
  if (type === 'I' && Math.random() < 1 / 30) {
    return createPiece('I').map(row => row.map(v => v !== 0 ? 8 : 0));
  }
  return createPiece(type);
}

function collide(arena: Matrix, player: Player): boolean {
  const m = player.matrix!;
  const o = player.pos;
  for (let y = 0; y < m.length; y++) {
    for (let x = 0; x < m[y].length; x++) {
      if (m[y][x] !== 0 && (arena[y + o.y] === undefined || arena[y + o.y][x + o.x] !== 0)) {
        return true;
      }
    }
  }
  return false;
}

// Block Out 전용: buffer zone 안의 piece 셀만 충돌 검사.
// visible 영역 셀이 막혀있어도 spawn은 허용 → 사용자가 옆으로 빼낼 기회 부여.
// 만약 옆으로 못 빼고 그대로 lockPiece로 가면 일반 collide 검사가 게임오버 처리.
function collideInBuffer(arena: Matrix, player: Player): boolean {
  const m = player.matrix!;
  const o = player.pos;
  for (let y = 0; y < m.length; y++) {
    for (let x = 0; x < m[y].length; x++) {
      if (m[y][x] !== 0 && (y + o.y) < BUFFER_H) {
        if (arena[y + o.y] === undefined || arena[y + o.y][x + o.x] !== 0) return true;
      }
    }
  }
  return false;
}

function mergeInto(arena: Matrix, player: Player) {
  player.matrix!.forEach((row, y) => {
    row.forEach((val, x) => {
      if (val !== 0) arena[y + player.pos.y][x + player.pos.x] = val;
    });
  });
}

function rotateMatrix(matrix: Matrix, dir: number) {
  for (let y = 0; y < matrix.length; y++)
    for (let x = 0; x < y; x++)
      [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
  if (dir > 0) matrix.forEach(row => row.reverse());
  else matrix.reverse();
}

type RankEntry = { id: number; name: string; score: number; gameLevel?: number; createdAt: string };

interface Props { excel?: boolean }

export default function BlockfallBoard({ excel = false }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const initDifficulty = (location.state as { initDifficulty?: Level } | null)?.initDifficulty;

  const handleInsaneClick = useCallback(() => {
    if (!user) {
      alert('로그인이 필요한 기능입니다.');
      return;
    }
    navigate('/blockfall-insane');
  }, [user, navigate]);

  // ===== 캔버스 refs =====
  const boardRef    = useRef<HTMLCanvasElement>(null);
  const nextRef     = useRef<HTMLCanvasElement>(null);
  const holdRef     = useRef<HTMLCanvasElement>(null);
  const bagPanelRef = useRef<HTMLCanvasElement>(null);

  // ===== 게임 상태 (ref — 렌더링 없이 갱신) =====
  const arena       = useRef<Matrix>(createMatrix(BOARD_W, BOARD_H));
  const player      = useRef<Player>({ pos: { x: 0, y: 0 }, matrix: null });
  const nextPiece   = useRef<Matrix | null>(null);
  const holdPiece   = useRef<Matrix | null>(null);
  const bagRef      = useRef<string[]>([]);
  const bagIdxRef   = useRef<number>(0);
  const holdUsed    = useRef(false);
  const scoreRef    = useRef(0);
  const gameLevelRef = useRef(1);
  const linesRef    = useRef(0);
  const comboCount  = useRef(0);
  const comboText   = useRef('');
  const comboAlpha  = useRef(0);
  const tspinText   = useRef('');
  const tspinAlpha  = useRef(0);
  const dropCounter = useRef(0);
  const dropInterval = useRef(400);
  const lastTime    = useRef(0);
  const animId      = useRef<number | null>(null);
  const isLanding   = useRef(false);
  const lockCounter = useRef(0);
  const lockResets  = useRef(0);
  const lastActionRot = useRef(false);
  const tPieceRot   = useRef(0);
  const isPieceT    = useRef(false);
  const holdPieceIsT = useRef(false);
  const holdPieceRot = useRef(0);
  const currentLevelRef = useRef<Level>(initDifficulty ?? 'normal');

  // 세션 ID
  const sessionIdRef = useRef<string>('');
  const sessionFailedRef = useRef<boolean>(false);
  const [sessionFailed, setSessionFailed] = useState(false);

  // ===== React 상태 (UI 표시용) =====
  const [gameStatus, setGameStatus] = useState<GameStatus>('idle');
  const [score, setScore]       = useState(0);
  const [gameLevel, setGameLevel] = useState(1);
  const [lines, setLines]       = useState(0);
  const [combo, setCombo]       = useState(0);
  const [difficulty, setDifficulty] = useState<Level>(initDifficulty ?? 'normal');
  // 보드 위에 띄우는 콤보/보너스 오버레이 (canvas 밖으로 잘리지 않도록 HTML로 표시)
  const [comboOverlay, setComboOverlay] = useState<{ text: string; key: number } | null>(null);
  const comboOverlayKey = useRef(0);

  // ===== 랭킹 =====
  const [rankLevel, setRankLevel] = useState<Level>('normal');
  const [rankings, setRankings]   = useState<RankEntry[]>([]);
  const [rankLoading, setRankLoading] = useState(false);
  const [alltimeBest, setAlltimeBest] = useState<RankEntry | null>(null);
  const [showRules, setShowRules] = useState(false);

  // ===== 모달 =====
  const [modalOpen, setModalOpen]     = useState(false);
  const [playerName, setPlayerName]   = useState('');
  const [submitState, setSubmitState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [nameBanned, setNameBanned]   = useState(false);

  // 모달이 열릴 때 로그인된 닉네임 자동 완성
  useEffect(() => {
    if (modalOpen) setPlayerName(user?.nickname ?? '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen]);

  const COLORS = excel ? COLORS_EXCEL : COLORS_NORMAL;

  // ===== BGM =====
  const bgm = useBgm(BGM_SRC, { volume: 0.4 });

  // ===== Excel Shell 연동 =====
  const { setFormula, setStatusItems, activeSheet, setRibbonGameGroup, sheetSize, registerNewGame } = useExcelShell();
  useEffect(() => {
    if (!excel) return;
    const colLabel = (n: number) => String.fromCharCode(65 + n);
    const cell = `${colLabel(player.current.pos.x)}${player.current.pos.y + 1}`;
    const formula = gameStatus === 'playing'
      ? `=BLOCKFALL_DROP(level,${gameLevelRef.current},speed,${dropInterval.current}ms)`
      : gameStatus === 'over'
      ? `=GAME_OVER(score,${scoreRef.current})`
      : '=IF(ISBLANK(A1),"",BLOCKFALL_SCORE())';
    setFormula(gameStatus === 'playing' ? cell : 'A1', formula);
    setStatusItems([
      { label: '점수', value: score.toLocaleString() },
      { label: '레벨', value: gameLevel },
      { label: '줄', value: lines },
    ]);
  }, [excel, score, gameLevel, lines, gameStatus, setFormula, setStatusItems]);

  // ===== 보조 =====
  function isCornerBlocked(bx: number, by: number): boolean {
    if (bx < 0 || bx >= BOARD_W || by >= BOARD_H) return true;
    if (by < 0) return false;
    return arena.current[by][bx] !== 0;
  }

  function detectTspin(): 'full' | 'mini' | null {
    if (!isPieceT.current || !lastActionRot.current) return null;
    const px = player.current.pos.x;
    const py = player.current.pos.y;
    const corners = [
      [px,     py    ],
      [px + 2, py    ],
      [px,     py + 2],
      [px + 2, py + 2],
    ];
    const blocked = corners.map(([cx, cy]) => isCornerBlocked(cx, cy));
    if (blocked.filter(Boolean).length < 3) return null;
    const front = T_FRONT_CORNERS[tPieceRot.current];
    return front.filter(i => blocked[i]).length === 2 ? 'full' : 'mini';
  }

  function isOnGround(): boolean {
    return collide(arena.current, { pos: { x: player.current.pos.x, y: player.current.pos.y + 1 }, matrix: player.current.matrix });
  }

  // ===== 점수 업데이트 =====
  function updateDisplay() {
    setScore(scoreRef.current);
    setGameLevel(gameLevelRef.current);
    setLines(linesRef.current);
    setCombo(comboCount.current);
  }

  // ===== 캔버스 그리기 =====
  const draw = useCallback(() => {
    const canvas = boardRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bgColor   = excel ? '#FFFFFF' : '#111827';
    const gridColor = excel ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.3)';

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, BOARD_W, BOARD_H);

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.02;
    for (let x = 1; x < BOARD_W; x++) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, BOARD_H); ctx.stroke();
    }
    for (let y = 1; y < BOARD_H; y++) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(BOARD_W, y); ctx.stroke();
    }

    // 쌓인 블록
    arena.current.forEach((row, y) => {
      row.forEach((val, x) => {
        if (val !== 0) drawCell(ctx, x, y, val);
      });
    });

    const p = player.current;
    if (p.matrix) {
      // 고스트 (쉬움)
      if (currentLevelRef.current === 'easy') {
        let gy = p.pos.y;
        while (!collide(arena.current, { pos: { x: p.pos.x, y: gy + 1 }, matrix: p.matrix })) gy++;
        if (gy > p.pos.y) {
          ctx.globalAlpha = 0.25;
          p.matrix.forEach((row, y) => {
            row.forEach((val, x) => {
              if (val !== 0) drawCell(ctx, x + p.pos.x, y + gy, val);
            });
          });
          ctx.globalAlpha = 1.0;
        }
      }
      // 현재 피스
      p.matrix.forEach((row, y) => {
        row.forEach((val, x) => {
          if (val !== 0) drawCell(ctx, x + p.pos.x, y + p.pos.y, val);
        });
      });
    }

    // ===== Buffer zone 시각 표시 =====
    // 위 BUFFER_H 줄은 vanish zone — 반투명 박스로 흐리게 표시
    ctx.save();
    ctx.fillStyle = excel ? 'rgba(0, 0, 0, 0.18)' : 'rgba(255, 255, 255, 0.22)';
    ctx.fillRect(0, 0, BOARD_W, BUFFER_H);
    ctx.restore();

    // ===== Block Out 위험 셀 X 마크 (TETR.IO 스타일) =====
    // 다음 블록(nextPiece)의 buffer zone 안 spawn 셀만 X로 표시 (4셀 고정).
    // 위험 임계선: 보드 전체 최상단 블록이 buffer + 위 3줄 안(y < 5)에 있을 때만 표시.
    const DANGER_LIMIT_Y = BUFFER_H + 3;
    let globalTopY = BOARD_H;
    findTop: for (let y = 0; y < DANGER_LIMIT_Y && y < BOARD_H; y++) {
      for (let x = 0; x < BOARD_W; x++) {
        if (arena.current[y][x] !== 0) { globalTopY = y; break findTop; }
      }
    }
    const next = nextPiece.current;
    if (next && globalTopY < DANGER_LIMIT_Y) {
      ctx.save();
      ctx.strokeStyle = excel ? 'rgba(220, 0, 0, 0.85)' : 'rgba(255, 80, 80, 0.95)';
      ctx.lineWidth = 0.13;
      ctx.lineCap = 'round';
      ctx.setLineDash([]);
      const npx = (BOARD_W / 2 | 0) - (next[0].length / 2 | 0);
      for (let ny = 0; ny < next.length; ny++) {
        if (ny >= BUFFER_H) break; // buffer zone 밖 (이론상 표준 SRS면 발생 안 함)
        for (let nx = 0; nx < next[ny].length; nx++) {
          if (next[ny][nx] === 0) continue;
          const dx = nx + npx;
          const dy = ny;
          if (!arena.current[dy] || arena.current[dy][dx] !== 0) continue;
          ctx.beginPath();
          ctx.moveTo(dx + 0.25, dy + 0.25);
          ctx.lineTo(dx + 0.75, dy + 0.75);
          ctx.moveTo(dx + 0.75, dy + 0.25);
          ctx.lineTo(dx + 0.25, dy + 0.75);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // T-스핀 오버레이
    if (tspinAlpha.current > 0) {
      const alpha = Math.min(1, tspinAlpha.current);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 1.1px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.lineWidth = 0.12;
      // 캔버스 전체(BOARD_H) 중 buffer zone을 제외한 visible 영역의 중앙
      const tspinY = BUFFER_H + VISIBLE_H / 2 - 4;
      ctx.strokeText(tspinText.current, BOARD_W / 2, tspinY);
      ctx.fillStyle = '#ff6ec7';
      ctx.fillText(tspinText.current, BOARD_W / 2, tspinY);
      ctx.restore();
      tspinAlpha.current -= 0.025;
    }

    // 콤보 오버레이는 canvas 밖으로 잘리는 것을 방지하기 위해 HTML div 오버레이로 이동
    // (.comboOverlay + comboOverlayPop 애니메이션 참고)

    // NEXT 캔버스 — 게임 전(nextPiece=null)에도 배경을 항상 채움
    const nc = nextRef.current;
    if (nc) {
      const nctx = nc.getContext('2d');
      if (nctx) {
        nctx.fillStyle = excel ? '#FFFFFF' : '#111827';
        nctx.fillRect(0, 0, 4, 4);
        if (nextPiece.current) {
          const m = nextPiece.current;
          const ox = Math.floor((4 - m[0].length) / 2);
          const oy = Math.floor((4 - m.length) / 2);
          m.forEach((row, y) => {
            row.forEach((val, x) => {
              if (val !== 0) drawCell(nctx, x + ox, y + oy, val);
            });
          });
        }
      }
    }

    // HOLD 캔버스
    const hc = holdRef.current;
    if (hc) {
      const hctx = hc.getContext('2d');
      if (hctx) {
        hctx.fillStyle = excel ? '#FFFFFF' : '#111827';
        hctx.fillRect(0, 0, 4, 4);
        if (holdPiece.current) {
          hctx.globalAlpha = holdUsed.current ? 0.4 : 1.0;
          const m = holdPiece.current;
          const ox = Math.floor((4 - m[0].length) / 2);
          const oy = Math.floor((4 - m.length) / 2);
          m.forEach((row, y) => {
            row.forEach((val, x) => {
              if (val !== 0) drawCell(hctx, x + ox, y + oy, val);
            });
          });
          hctx.globalAlpha = 1.0;
        }
      }
    }

    // BAG 패널 캔버스 — 현재 bag에서 남은 피스 목록 (일반 모드 전용)
    const bp = bagPanelRef.current;
    if (bp && !excel) {
      const bctx = bp.getContext('2d');
      if (bctx) {
        bctx.fillStyle = '#111827';
        bctx.fillRect(0, 0, 4, VISIBLE_H);
        const remaining = bagRef.current.slice(bagIdxRef.current);
        const slotH = VISIBLE_H / 5;
        remaining.forEach((type, i) => {
          const m = createPiece(type);
          const ox = Math.floor((4 - m[0].length) / 2);
          const oy = slotH * i + (slotH - m.length) / 2;
          m.forEach((row, ry) => {
            row.forEach((val, rx) => {
              if (val !== 0) drawCell(bctx, rx + ox, ry + oy, val);
            });
          });
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excel]);

  function drawCell(context: CanvasRenderingContext2D, x: number, y: number, colorIndex: number) {
    if (excel) {
      // 엑셀 모드: 원본처럼 단일 미색
      context.fillStyle = '#EEEEEE';
      context.fillRect(x, y, 1, 1);
      context.strokeStyle = '#D2D2D2';
      context.lineWidth = 0.04;
      context.strokeRect(x, y, 1, 1);
    } else {
      if (colorIndex === 8) {
        const hue = (Date.now() / 500 * 60 + x * 36 + y * 18) % 360;
        context.fillStyle = `hsl(${hue}, 100%, 60%)`;
      } else {
        context.fillStyle = COLORS[colorIndex] ?? '#ccc';
      }
      context.fillRect(x, y, 1, 1);
      context.fillStyle = 'rgba(255,255,255,0.25)';
      context.fillRect(x, y, 1, 0.07);
      context.fillRect(x, y, 0.07, 1);
      context.fillStyle = 'rgba(0,0,0,0.25)';
      context.fillRect(x, y + 0.93, 1, 0.07);
      context.fillRect(x + 0.93, y, 0.07, 1);
    }
  }

  // ===== 줄 제거 & 점수 =====
  function arenaSweep(tspin: 'full' | 'mini' | null) {
    let count = 0;
    outer: for (let y = arena.current.length - 1; y > 0; y--) {
      for (let x = 0; x < arena.current[y].length; x++) {
        if (arena.current[y][x] === 0) continue outer;
      }
      const row = arena.current.splice(y, 1)[0].fill(0);
      arena.current.unshift(row);
      y++;
      count++;
    }

    if (count > 0) {
      let baseScore = 0;
      if (tspin) {
        const tbl = tspin === 'full' ? TSPIN_SCORES.full : TSPIN_SCORES.mini;
        baseScore = (tbl[Math.min(count, tbl.length - 1)]) * gameLevelRef.current;
        const label = tspin === 'mini' ? 'T-SPIN MINI'
          : count === 1 ? 'T-SPIN SINGLE'
          : count === 2 ? 'T-SPIN DOUBLE' : 'T-SPIN TRIPLE';
        tspinText.current = `${label}  +${baseScore.toLocaleString()}`;
        tspinAlpha.current = 2.0;
      } else {
        baseScore = (LINE_SCORES[count] ?? LINE_SCORES[4]) * gameLevelRef.current;
      }
      comboCount.current++;
      const comboBonus = comboCount.current >= 2 ? 50 * (comboCount.current - 1) * gameLevelRef.current : 0;
      scoreRef.current += baseScore + comboBonus;
      linesRef.current += count;
      if (comboCount.current >= 2) {
        const text = `COMBO x${comboCount.current}  +${comboBonus.toLocaleString()}`;
        comboText.current = text;
        comboAlpha.current = 1.5;
        setComboOverlay({ text, key: ++comboOverlayKey.current });
      }
      // 싹슬이(Perfect Clear) 판정 — 줄 제거 후 arena 전체가 비었는지 검사.
      // 발동 시 콤보 오버레이를 ALL CLEAR 메시지로 덮어씀 (기존 score/combo 로직은 유지)
      const isPerfectClear = arena.current.every(row => row.every(cell => cell === 0));
      if (isPerfectClear) {
        const pcBonus = (PERFECT_CLEAR_BONUS[Math.min(count, 4)] ?? PERFECT_CLEAR_BONUS[4]) * gameLevelRef.current;
        scoreRef.current += pcBonus;
        const text = `ALL CLEAR BONUS  +${pcBonus.toLocaleString()}`;
        comboText.current = text;
        comboAlpha.current = 2.0;
        setComboOverlay({ text, key: ++comboOverlayKey.current });
      }
      const newLv = Math.min(Math.floor(linesRef.current / 10) + 1, 11);
      if (newLv > gameLevelRef.current) {
        gameLevelRef.current = newLv;
        const sp = DROP_SPEEDS[currentLevelRef.current];
        dropInterval.current = sp[Math.min(gameLevelRef.current - 1, sp.length - 1)];
      }
      updateDisplay();
    } else {
      comboCount.current = 0;
    }
  }

  // ===== 7-bag 드로우 =====
  // 미리보기가 끊기지 않도록, 큐에 PIECES.length 미만 남으면 다음 bag을 즉시 이어 붙임
  function drawFromBag(): Matrix {
    if (bagRef.current.length - bagIdxRef.current < PIECES.length) {
      bagRef.current = bagRef.current.slice(bagIdxRef.current).concat(shuffleBag());
      bagIdxRef.current = 0;
    }
    return pieceFromType(bagRef.current[bagIdxRef.current++]);
  }

  // ===== 플레이어 리셋 =====
  function playerReset() {
    holdUsed.current = false;
    isLanding.current = false;
    lockCounter.current = 0;
    lockResets.current = 0;
    lastActionRot.current = false;
    tPieceRot.current = 0;
    player.current.matrix = nextPiece.current ?? drawFromBag();
    nextPiece.current = drawFromBag();
    isPieceT.current = player.current.matrix.some(row => row.includes(1));
    player.current.pos.y = 0;
    player.current.pos.x = (BOARD_W / 2 | 0) - (player.current.matrix[0].length / 2 | 0);
    // Block Out: buffer zone 안의 spawn 셀만 검사. visible 영역 spawn 셀이 막혀도 게임오버 X.
    if (collideInBuffer(arena.current, player.current)) {
      doGameOver();
    }
  }

  // ===== 블록 고정 =====
  // TETR.IO 스타일: Lock Out 룰 미사용. Block Out(다음 spawn 충돌)만으로 게임오버 판정.
  function lockPiece() {
    if (collide(arena.current, player.current)) {
      doGameOver();
      return;
    }
    const tspin = detectTspin();
    mergeInto(arena.current, player.current);
    playerReset();
    arenaSweep(tspin);
    isLanding.current = false;
    lockCounter.current = 0;
  }

  // ===== 게임 오버 =====
  function doGameOver() {
    if (animId.current) { cancelAnimationFrame(animId.current); animId.current = null; }
    if (!excel) bgm.stop();
    setGameStatus('over');
    // Block Out 직후 spawn된 블록이 화면에 잔존해 "낙하 중"처럼 보이는 문제 방지
    player.current.matrix = null;
    isLanding.current = false;
    draw();
    if (!sessionFailedRef.current) setTimeout(() => setModalOpen(true), 100);
  }

  // 어드민 강제 클리어
  const { register } = useAdminTest();
  const forceClearRef = useRef<() => void>(() => {});
  forceClearRef.current = async () => {
    try {
      const id = await startSession('blockfall', difficulty);
      sessionIdRef.current = id;
    } catch { /* ignore */ }
    setModalOpen(true);
  };
  useEffect(() => {
    register(() => forceClearRef.current());
    return () => register(() => {});
  }, [register]);

  // ===== 게임 루프 =====
  const gameLoop = useCallback((time: number) => {
    const dt = time - lastTime.current;
    lastTime.current = time;
    dropCounter.current += dt;

    if (isLanding.current) {
      lockCounter.current += dt;
      if (lockCounter.current >= LOCK_DELAY) {
        lockPiece();
        // doGameOver() 가 호출된 경우 animId 가 null 로 초기화됨.
        // 이 경우 requestAnimationFrame 재등록 없이 즉시 종료.
        if (animId.current === null) return;
      }
    }

    if (dropCounter.current > dropInterval.current) {
      // 소프트 드롭 (자동 낙하)
      player.current.pos.y++;
      if (collide(arena.current, player.current)) {
        player.current.pos.y--;
        if (!isLanding.current) { isLanding.current = true; lockCounter.current = 0; }
      } else {
        isLanding.current = false;
        lockCounter.current = 0;
      }
      dropCounter.current = 0;
      updateDisplay();
    }

    draw();
    animId.current = requestAnimationFrame(gameLoop);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draw]);

  // ===== 컨트롤 함수 =====
  const playerMove = useCallback((dir: number) => {
    player.current.pos.x += dir;
    if (collide(arena.current, player.current)) {
      player.current.pos.x -= dir;
    } else {
      lastActionRot.current = false;
      if (isLanding.current) {
        if (lockResets.current < MAX_LOCK_RESETS) { lockCounter.current = 0; lockResets.current++; }
        if (!isOnGround()) isLanding.current = false;
      }
    }
  }, []);

  const playerDrop = useCallback((isSoft = false) => {
    player.current.pos.y++;
    if (collide(arena.current, player.current)) {
      player.current.pos.y--;
      if (!isLanding.current) { isLanding.current = true; lockCounter.current = 0; }
    } else {
      isLanding.current = false;
      lockCounter.current = 0;
    }
    if (isSoft) scoreRef.current++;
    dropCounter.current = 0;
    updateDisplay();
  }, []);

  const playerHardDrop = useCallback(() => {
    let gy = player.current.pos.y;
    while (!collide(arena.current, { pos: { x: player.current.pos.x, y: gy + 1 }, matrix: player.current.matrix })) gy++;
    if (collide(arena.current, { pos: { x: player.current.pos.x, y: gy }, matrix: player.current.matrix })) {
      doGameOver(); return;
    }
    scoreRef.current += (gy - player.current.pos.y) * 2;
    player.current.pos.y = gy;
    const tspin = detectTspin();
    lastActionRot.current = false;
    mergeInto(arena.current, player.current);
    playerReset();
    arenaSweep(tspin);
    dropCounter.current = 0;
    updateDisplay();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playerRotate = useCallback((dir: number) => {
    const posX = player.current.pos.x;
    let offset = 1;
    rotateMatrix(player.current.matrix!, dir);
    while (collide(arena.current, player.current)) {
      player.current.pos.x += offset;
      offset = -(offset + (offset > 0 ? 1 : -1));
      if (Math.abs(offset) > player.current.matrix![0].length) {
        rotateMatrix(player.current.matrix!, -dir);
        player.current.pos.x = posX;
        return;
      }
    }
    lastActionRot.current = true;
    if (isPieceT.current) tPieceRot.current = (tPieceRot.current + (dir > 0 ? 1 : 3)) % 4;
    if (isLanding.current) {
      if (lockResets.current < MAX_LOCK_RESETS) { lockCounter.current = 0; lockResets.current++; }
      if (!isOnGround()) isLanding.current = false;
    }
  }, []);

  const playerHold = useCallback(() => {
    if (holdUsed.current) return;
    holdUsed.current = true;
    if (!holdPiece.current) {
      holdPiece.current = player.current.matrix;
      holdPieceIsT.current = isPieceT.current;
      holdPieceRot.current = tPieceRot.current;
      playerReset();
    } else {
      const tmp = holdPiece.current;
      const tmpIsT = holdPieceIsT.current;
      const tmpRot = holdPieceRot.current;
      holdPiece.current = player.current.matrix;
      holdPieceIsT.current = isPieceT.current;
      holdPieceRot.current = tPieceRot.current;
      player.current.matrix = tmp;
      isPieceT.current = tmpIsT;
      tPieceRot.current = tmpRot;
      lastActionRot.current = false;
      player.current.pos.y = 0;
      player.current.pos.x = (BOARD_W / 2 | 0) - (tmp[0].length / 2 | 0);
      isLanding.current = false;
      lockCounter.current = 0;
      lockResets.current = 0;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== 게임 시작 =====
  const startGame = useCallback((lv?: Level) => {
    const level = lv ?? currentLevelRef.current;
    currentLevelRef.current = level;
    if (animId.current) { cancelAnimationFrame(animId.current); animId.current = null; }
    arena.current = createMatrix(BOARD_W, BOARD_H);
    scoreRef.current = 0;
    gameLevelRef.current = 1;
    linesRef.current = 0;
    comboCount.current = 0;
    comboAlpha.current = 0;
    tspinAlpha.current = 0;
    lastActionRot.current = false;
    tPieceRot.current = 0;
    isPieceT.current = false;
    holdPieceIsT.current = false;
    holdPieceRot.current = 0;
    dropCounter.current = 0;
    holdPiece.current = null;
    holdUsed.current = false;
    isLanding.current = false;
    lockCounter.current = 0;
    lockResets.current = 0;
    const sp = DROP_SPEEDS[level];
    dropInterval.current = sp[0];
    player.current.matrix = null;
    bagRef.current = shuffleBag();
    bagIdxRef.current = 0;
    nextPiece.current = drawFromBag();
    playerReset();
    updateDisplay();
    setGameStatus('playing');
    lastTime.current = 0;
    animId.current = requestAnimationFrame(gameLoop);
    if (!excel) bgm.play();
    // 세션 생성 최대 3회 재시도
    (async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const id = await startSession('blockfall', level);
          sessionIdRef.current = id;
          sessionFailedRef.current = false;
          setSessionFailed(false);
          return;
        } catch {
          if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
        }
      }
      sessionIdRef.current = '';
      sessionFailedRef.current = true;
      setSessionFailed(true);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameLoop]);

  // ===== 일시정지 =====
  const togglePause = useCallback(() => {
    setGameStatus(prev => {
      if (prev === 'playing') {
        if (animId.current) { cancelAnimationFrame(animId.current); animId.current = null; }
        draw();
        if (!excel) bgm.pause();
        return 'paused';
      } else if (prev === 'paused') {
        lastTime.current = 0;
        animId.current = requestAnimationFrame(gameLoop);
        if (!excel) bgm.resume();
        return 'playing';
      }
      return prev;
    });
  }, [draw, gameLoop, bgm, excel]);

  // ===== 키보드 =====
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const status = gameStatus;
      if (status !== 'playing' && status !== 'paused') return;
      if (status === 'paused' && (e.key === 'p' || e.key === 'P')) { togglePause(); return; }
      if (status !== 'playing') return;
      switch (e.key) {
        case 'ArrowLeft':  e.preventDefault(); playerMove(-1); break;
        case 'ArrowRight': e.preventDefault(); playerMove(1);  break;
        case 'ArrowDown':  e.preventDefault(); playerDrop(true); break;
        case 'ArrowUp':    e.preventDefault(); if (!e.repeat) playerRotate(1); break;
        case ' ':          e.preventDefault(); playerHardDrop(); break;
        case 'Shift':      e.preventDefault(); playerHold(); break;
        case 'p': case 'P': togglePause(); break;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gameStatus, playerMove, playerDrop, playerRotate, playerHardDrop, playerHold, togglePause]);

  // ===== 캔버스 초기화 =====
  useEffect(() => {
    const canvas = boardRef.current;
    const nc = nextRef.current;
    const hc = holdRef.current;
    const bp = bagPanelRef.current;
    if (canvas) { const ctx = canvas.getContext('2d'); if (ctx) ctx.scale(CELL, CELL); }
    if (nc)     { const ctx = nc.getContext('2d');     if (ctx) ctx.scale(CELL, CELL); }
    if (hc)     { const ctx = hc.getContext('2d');     if (ctx) ctx.scale(CELL, CELL); }
    if (bp)     { const ctx = bp.getContext('2d');     if (ctx) ctx.scale(CELL, CELL); }
    arena.current = createMatrix(BOARD_W, BOARD_H);
    draw();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== 터치 (캔버스 스와이프) =====
  useEffect(() => {
    const canvas = boardRef.current;
    if (!canvas) return;
    let sx = 0, sy = 0, st = 0;
    function onStart(e: TouchEvent) {
      e.preventDefault();
      sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now();
    }
    function onEnd(e: TouchEvent) {
      e.preventDefault();
      if (gameStatus !== 'playing') return;
      const dx = e.changedTouches[0].clientX - sx;
      const dy = e.changedTouches[0].clientY - sy;
      const dt = Date.now() - st;
      const ax = Math.abs(dx), ay = Math.abs(dy);
      if (ax < 15 && ay < 15 && dt < 250) {
        playerRotate(1);
      } else if (ax > ay && ax > 20) {
        playerMove(dx > 0 ? 1 : -1);
      } else if (ay > ax && dy > 40) {
        playerHardDrop();
      }
    }
    // touchmove: 스와이프 제스처 중 페이지 스크롤 방지
    function onMove(e: TouchEvent) { e.preventDefault(); }
    canvas.addEventListener('touchstart', onStart, { passive: false });
    canvas.addEventListener('touchmove', onMove,  { passive: false });
    canvas.addEventListener('touchend', onEnd, { passive: false });
    return () => {
      canvas.removeEventListener('touchstart', onStart);
      canvas.removeEventListener('touchmove', onMove);
      canvas.removeEventListener('touchend', onEnd);
    };
  }, [gameStatus, playerMove, playerRotate, playerHardDrop]);

  // ===== 언마운트 정리 =====
  useEffect(() => {
    return () => { if (animId.current) cancelAnimationFrame(animId.current); };
  }, []);

  // ===== 랭킹 로드 =====
  async function loadRanking(lv: Level) {
    setRankLoading(true);
    try {
      const data = await rankingsApi.getWeekly('blockfall', lv);
      setRankings(data as RankEntry[]);
    } catch { setRankings([]); }
    finally { setRankLoading(false); }
  }

  async function loadAlltime(lv: Level) {
    try {
      const data = await rankingsApi.getAlltimeBest('blockfall', lv);
      if (data && (data as RankEntry).id) setAlltimeBest(data as RankEntry);
      else setAlltimeBest(null);
    } catch { setAlltimeBest(null); }
  }

  useEffect(() => {
    loadRanking('normal');
    loadAlltime('normal');
  }, []);

  // ===== 랭킹 등록 =====
  async function handleSubmitRanking() {
    const name = playerName.trim();
    if (!name) return;
    if (containsProfanity(name)) { setNameBanned(true); return; }
    setNameBanned(false);
    setSubmitState('loading');
    try {
      await rankingsApi.submit('blockfall', {
        level: difficulty,
        name,
        score: scoreRef.current,
        gameLevel: gameLevelRef.current,
        linesCleared: linesRef.current,
        sessionId: sessionIdRef.current,
      });
      setModalOpen(false);
      setPlayerName('');
      setSubmitState('idle');
      loadRanking(difficulty);
      loadAlltime(difficulty);
    } catch {
      setSubmitState('error');
    }
  }

  function handleDifficultyChange(lv: Level) {
    setDifficulty(lv);
    currentLevelRef.current = lv;
    if (gameStatus === 'playing' || gameStatus === 'over') startGame(lv);
  }

  function handleRankTabChange(lv: Level) {
    setRankLevel(lv);
    loadRanking(lv);
    loadAlltime(lv);
    setShowRules(false);
  }

  // ===== 엑셀 모드: 리본 게임 그룹 =====
  useEffect(() => {
    if (!excel) { setRibbonGameGroup(null); return; }
    const ICONS: Record<Level, string> = { easy: '📈', normal: '📊', hard: '📉' };
    setRibbonGameGroup(
      <div className={styles.xrgGame}>
        <div className={styles.xrgBtns}>
          {(['easy', 'normal', 'hard'] as Level[]).map(lv => (
            <div
              key={lv}
              className={`${styles.xrb} ${difficulty === lv ? styles.xrbActive : ''}`}
              onClick={() => handleDifficultyChange(lv)}
            >
              <span className={styles.xrbIcon}>{ICONS[lv]}</span>
              <span>{{ easy: '쉬움', normal: '보통', hard: '어려움' }[lv]}</span>
            </div>
          ))}
          <div
            className={`${styles.xrb} ${styles.xrbInsane}`}
            onClick={handleInsaneClick}
            title={user ? '인세인 모드로 이동' : '로그인이 필요한 기능입니다'}
          >
            <span className={styles.xrbIcon}>🔥</span>
            <span>인세인</span>
          </div>
          <div className={styles.xrb} onClick={() => startGame()}>
            <span className={styles.xrbIcon}>▶</span>
            <span>{gameStatus === 'idle' ? '시작' : '다시하기'}</span>
          </div>
          <div
            className={`${styles.xrb} ${gameStatus !== 'playing' && gameStatus !== 'paused' ? styles.xrbDisabled : ''}`}
            onClick={togglePause}
          >
            <span className={styles.xrbIcon}>{gameStatus === 'paused' ? '▶' : '⏸'}</span>
            <span>{gameStatus === 'paused' ? '계속' : '일시정지'}</span>
          </div>
        </div>
        <div className={styles.xrgLabel}>블록폴</div>
      </div>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excel, difficulty, gameStatus, setRibbonGameGroup, user, handleInsaneClick]);

  // 엑셀모드 플러스 버튼 새 게임 콜백 등록
  const newGameFnRef = useRef<() => void>(() => {});
  newGameFnRef.current = () => startGame();
  useEffect(() => {
    if (excel) registerNewGame(() => newGameFnRef.current());
  }, [excel, registerNewGame]);

  // ===== 엑셀 모드: ranking 시트 활성 시 랭킹 로드 =====
  useEffect(() => {
    if (!excel || activeSheet !== 'ranking') return;
    loadRanking(rankLevel);
    loadAlltime(rankLevel);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excel, activeSheet]);

  // ===== 상태 텍스트 =====
  const LEVELS: { value: Level; label: string }[] = [
    { value: 'easy',   label: '쉬움' },
    { value: 'normal', label: '보통' },
    { value: 'hard',   label: '어려움' },
  ];

  const statusText =
    gameStatus === 'over' ? 'GAME OVER' : difficulty.toUpperCase();

  // 엑셀 모드: 시트에 따라 보이는 영역 결정
  const showGameArea  = !excel || activeSheet === 'game';
  const showRulesArea = !excel ? showRules : activeSheet === 'rules';

  return (
    <div className={`${styles.wrap} ${excel ? styles.excelMode : ''}`}>
    <div className={styles.playWrapper}>
      {/* 난이도 — 일반 모드에서만 */}
      {!excel && (
        <div className={styles.diffRow}>
          {LEVELS.map(lv => (
            <button
              key={lv.value}
              className={`${styles.diffBtn} ${difficulty === lv.value ? styles.diffActive : ''}`}
              onClick={() => handleDifficultyChange(lv.value)}
            >
              {lv.label}
            </button>
          ))}
          <button
            className={`${styles.diffBtn} ${styles.insaneBtn}`}
            onClick={handleInsaneClick}
            title={user ? '인세인 모드로 이동' : '로그인이 필요한 기능입니다'}
          >
            🔥 인세인
          </button>
        </div>
      )}

      {/* 상단 infoBar 제거 — 점수/줄/레벨/콤보는 boardWrapper 내부 좌하단으로 이동 (TETR.IO 스타일) */}

      {/* 상태 메시지는 boardBox 안으로 이동 */}

      {/* 세션 생성 실패 경고 배너 */}
      {!excel && sessionFailed && gameStatus === 'playing' && (
        <div className={styles.sessionFailBanner}>
          네트워크 오류로 이 게임은 랭킹에 등록되지 않습니다
        </div>
      )}

      {/* 게임 영역 — 게임 시트 활성 시 */}
      {showGameArea && (
        <>
          <div className={styles.gameArea}>
            {/* 사이드 패널 */}
            <div className={styles.sidePanel}>
              <div className={styles.sideBox}>
                <div className={styles.sideTitle}>NEXT</div>
                <canvas ref={nextRef} width={4 * CELL} height={4 * CELL} className={styles.miniCanvas} />
              </div>
              <div className={styles.sideBox}>
                <div className={styles.sideTitle}>HOLD</div>
                <canvas ref={holdRef} width={4 * CELL} height={4 * CELL} className={styles.miniCanvas} />
              </div>
              {/* 일반 모드 스탯 — TETR.IO 스타일 (사이드패널 하단으로 밀려남) */}
              {!excel && (
                <div className={styles.statsArea}>
                  <div className={styles.statRow}>
                    <div className={styles.statLabel}>SCORE</div>
                    <div className={styles.statValue}>{score.toLocaleString()}</div>
                  </div>
                  <div className={styles.statRow}>
                    <div className={styles.statLabel}>LINES</div>
                    <div className={styles.statValue}>{lines}</div>
                  </div>
                  <div className={styles.statRow}>
                    <div className={styles.statLabel}>LEVEL</div>
                    <div className={styles.statValue}>{gameLevel}</div>
                  </div>
                  <div className={styles.statRow}>
                    <div className={styles.statLabel}>COMBO</div>
                    <div className={`${styles.statValue} ${combo >= 2 ? styles.statCombo : ''}`}>
                      {combo >= 2 ? `x${combo}` : '-'}
                    </div>
                  </div>
                </div>
              )}
              {/* 엑셀 모드: 점수/레벨/줄 — 원본 tside-label/tside-value */}
              {excel && (
                <>
                  <div className={styles.tsideLabel}>Score</div>
                  <div className={styles.tsideValue}>{score.toLocaleString()}</div>
                  <div className={styles.tsideLabel}>Level</div>
                  <div className={styles.tsideValue}>{gameLevel}</div>
                  <div className={styles.tsideLabel}>Lines</div>
                  <div className={styles.tsideValue}>{lines}</div>
                </>
              )}
            </div>

            {/* 엑셀 모드: 사이드패널과 보드 사이 gap 컬럼 (원본: #blockfall-col-gap) */}
            {excel && <div className={styles.blockfallColGap} />}

            {/* 보드 — 흰 박스로 감싸고 상태 메시지를 내부 헤더로 표시 */}
            <div className={styles.boardBox}>
              {!excel && (
                <div className={`${styles.boardStatusLine} ${gameStatus === 'over' ? styles.boardStatusOver : gameStatus === 'idle' ? styles.boardStatusIdle : ''}`}>
                  {statusText}
                </div>
              )}
              <div className={styles.boardWrapper}>
                <canvas
                  ref={boardRef}
                  width={BOARD_W * CELL}
                  height={BOARD_H * CELL}
                  className={styles.board}
                />
                {gameStatus === 'paused' && <div className={styles.pauseOverlay}>PAUSE</div>}
                {comboOverlay && (
                  <div
                    key={comboOverlay.key}
                    className={styles.comboOverlay}
                    onAnimationEnd={() => setComboOverlay(null)}
                  >
                    {comboOverlay.text}
                  </div>
                )}
              </div>
            </div>

            {/* BAG 패널 — 일반 모드 전용 */}
            {!excel && (
              <div className={styles.bagPanel}>
                <div className={styles.sideBox}>
                  <div className={styles.sideTitle}>BAG</div>
                  <canvas
                    ref={bagPanelRef}
                    width={4 * CELL}
                    height={VISIBLE_H * CELL}
                    className={styles.bagPanelCanvas}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 버튼 */}
          <div className={styles.controls}>
            <button
              className={styles.startBtn}
              onClick={(e) => { e.currentTarget.blur(); startGame(); }}
            >
              {gameStatus === 'idle' ? '▶ 시작' : '↺ 다시하기'}
            </button>
            <button
              className={styles.pauseBtn}
              disabled={gameStatus !== 'playing' && gameStatus !== 'paused'}
              onClick={togglePause}
            >
              {gameStatus === 'paused' ? '▶ 계속' : '⏸ 일시정지'}
            </button>
            {!excel && (
              <div className={styles.bgmControl}>
                <button
                  className={styles.bgmMuteBtn}
                  onClick={bgm.toggleMute}
                  aria-label={bgm.muted ? '음소거 해제' : '음소거'}
                >
                  {bgm.muted ? '🔇' : '🔊'}
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(bgm.volume * 100)}
                  onChange={e => bgm.setVolume(Number(e.target.value) / 100)}
                  className={styles.bgmSlider}
                  aria-label="BGM 볼륨"
                />
              </div>
            )}
          </div>

          {/* 모바일 버튼 */}
          <div className={styles.mobileControls}>
            <div className={styles.mobileRow}>
              <button className={styles.mobileBtn} style={{ width: 80, fontSize: '0.75em' }}
                onClick={() => { if (gameStatus === 'playing') playerHold(); }}>HOLD</button>
              <button className={styles.mobileBtn}
                onClick={() => { if (gameStatus === 'playing') playerRotate(1); }}>↺</button>
            </div>
            <div className={styles.mobileRow}>
              <button className={styles.mobileBtn} onClick={() => { if (gameStatus === 'playing') playerMove(-1); }}>←</button>
              <button className={styles.mobileBtn} onClick={() => { if (gameStatus === 'playing') playerDrop(true); }}>↓</button>
              <button className={styles.mobileBtn} onClick={() => { if (gameStatus === 'playing') playerMove(1); }}>→</button>
            </div>
            <div className={styles.mobileRow}>
              <button className={`${styles.mobileBtn} ${styles.mobileDrop}`}
                onClick={() => { if (gameStatus === 'playing') playerHardDrop(); }}>급강하</button>
            </div>
          </div>
        </>
      )}

      {/* ══ 일반 모드: 랭킹 섹션 ══ */}
      {!excel && (
        <div className={styles.rankSection}>
          <h3 className={styles.rankTitle}>주간 RANK</h3>
          {!showRulesArea && alltimeBest && (
            <div className={styles.alltimeBanner}>
              <span className={styles.atLabel}>👑 역대 1위</span>
              <span className={styles.atContent}>
                {alltimeBest.name} · {(alltimeBest.score ?? 0).toLocaleString()}점 · Lv.{alltimeBest.gameLevel ?? 1} · {new Date(alltimeBest.createdAt).toLocaleDateString('ko-KR')}
              </span>
            </div>
          )}
          <div className={styles.rankTabs}>
            {LEVELS.map(lv => (
              <button
                key={lv.value}
                className={`${styles.rankTab} ${rankLevel === lv.value && !showRules ? styles.rankTabActive : ''}`}
                onClick={() => handleRankTabChange(lv.value)}
              >
                {lv.label}
              </button>
            ))}
            <button
              className={`${styles.rankTab} ${showRules ? styles.rankTabActive : ''}`}
              onClick={() => setShowRules(true)}
            >룰</button>
          </div>
          {showRulesArea ? (
            <div className={styles.rulesPanel}>
              <h4>조작법</h4>
              <ul>
                <li>← → 방향키: 좌우 이동</li>
                <li>↑ 방향키: 회전</li>
                <li>↓ 방향키: 빠른 낙하 (+1점)</li>
                <li>Space / 더블탭: 급강하 (+2점/칸)</li>
                <li>Shift / HOLD 버튼: 블록 홀드 (블록당 1회)</li>
                <li>P: 일시정지</li>
              </ul>
              <h4>점수 계산</h4>
              <ul>
                <li>1줄: 100 × 레벨</li>
                <li>2줄: 300 × 레벨</li>
                <li>3줄: 500 × 레벨</li>
                <li>4줄 (블록폴): 800 × 레벨</li>
              </ul>
              <h4>콤보 · 레벨</h4>
              <ul>
                <li>연속 줄 제거 시 콤보 보너스: 50 × (콤보-1) × 레벨</li>
                <li>싹슬이(Perfect Clear): 줄 제거 후 보드가 비었을 때 800~2000 × 레벨 추가</li>
                <li>10줄 제거마다 레벨 상승, 최대 레벨 11</li>
              </ul>
              <h4>난이도별 초기 낙하속도</h4>
              <ul>
                <li>쉬움: 0.8초/칸 → 최대 0.21초</li>
                <li>보통: 0.4초/칸 → 최대 0.09초</li>
                <li>어려움: 0.18초/칸 → 최대 0.03초</li>
              </ul>
            </div>
          ) : rankLoading ? (
            <p className={styles.placeholder}>불러오는 중...</p>
          ) : (
            <table className={styles.table}>
              <thead><tr><th>순위</th><th>이름</th><th>점수</th><th>레벨</th><th>날짜</th></tr></thead>
              <tbody>
                {rankings.length === 0 ? (
                  <tr><td colSpan={5} className={styles.placeholder}>기록 없음</td></tr>
                ) : rankings.map((r, i) => (
                  <tr key={r.id}>
                    <td>{i + 1}</td>
                    <td>{r.name}</td>
                    <td>{(r.score ?? 0).toLocaleString()}점</td>
                    <td>Lv.{r.gameLevel ?? 1}</td>
                    <td>{new Date(r.createdAt).toLocaleDateString('ko-KR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ══ 엑셀 모드: 랭킹 시트 — 원본 buildRankingGrid() 구조 ══ */}
      {excel && activeSheet === 'ranking' && (() => {
        const extraCols = Math.max(10, Math.ceil((sheetSize.width || 600) / XL_CELL));
        const totalHeaderCols = RANK_TOTAL_BF + extraCols;
        const dataRowCount = rankings.length > 0 ? rankings.length : 1;
        const contentRows = 3 + dataRowCount + 1; // title + filter + header + data + alltime
        const extraRows = Math.max(20, Math.ceil((sheetSize.height || 400) / XL_CELL));
        const totalRows = contentRows + extraRows;

        const RCell = (
          text: string,
          colStart: number,
          span: number,
          cls: string[],
          extraStyle?: CSSProperties,
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
                <div key={i} className={styles.xch} style={{ width: XL_CELL, minWidth: XL_CELL }}>{bfColLabel(i)}</div>
              ))}
            </div>
            <div className={styles.xBodyArea}>
              <div className={styles.xRowNums}>
                {Array.from({ length: totalRows }, (_, i) => (
                  <div key={i} className={styles.xrn} style={{ height: XL_CELL }}>{i + 1}</div>
                ))}
              </div>
              <div
                className={styles.xRankGrid}
                style={{ gridTemplateColumns: `repeat(${RANK_TOTAL_BF}, ${XL_CELL}px)`, gridAutoRows: `${XL_CELL}px` }}
              >
                {/* 1행: 주간 랭킹 타이틀 */}
                {RCell(bfWeekRangeStr(), 1, RANK_TOTAL_BF, ['xrcWeekTitle'], { fontWeight: 'bold' }, 'title')}

                {/* 2행: 필터 버튼 */}
                <div
                  key="filter"
                  className={`${styles.xrankCell} ${styles.xrcFilter}`}
                  style={{ gridColumn: `1 / span ${RANK_TOTAL_BF}` }}
                >
                  {LEVELS.map(lv => (
                    <button
                      key={lv.value}
                      className={`${styles.xrankFilterBtn} ${rankLevel === lv.value ? styles.xrankFilterBtnActive : ''}`}
                      onClick={() => handleRankTabChange(lv.value)}
                    >
                      {lv.label}
                    </button>
                  ))}
                </div>

                {/* 3행: 컬럼 헤더 */}
                {(() => {
                  let cs = 1;
                  return RANK_COLS_BF.map(col => {
                    const start = cs; cs += col.span;
                    return RCell(col.label, start, col.span, ['xrcHeader'], undefined, `h-${col.label}`);
                  });
                })()}

                {/* 데이터 행 */}
                {rankLoading
                  ? RCell('불러오는 중...', 1, RANK_TOTAL_BF, [], { color: '#888' }, 'loading')
                  : rankings.length === 0
                    ? RCell('기록 없음', 1, RANK_TOTAL_BF, [], { color: '#aaa' }, 'empty')
                    : rankings.map((row, i) => {
                        const alt = i % 2 === 1 ? styles.xrcAlt : '';
                        const top = i === 0 ? styles.xrcTop : '';
                        const date = row.createdAt ? new Date(row.createdAt).toLocaleDateString('ko-KR') : '-';
                        const values = [String(i + 1), row.name, `${(row.score ?? 0).toLocaleString()}점`, date];
                        let cs = 1;
                        return RANK_COLS_BF.map(col => {
                          const start = cs; cs += col.span;
                          const val = values[RANK_COLS_BF.indexOf(col)];
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

                {/* 역대 1위 */}
                {alltimeBest
                  ? RCell(
                      `👑 역대 1위  ${alltimeBest.name} · ${(alltimeBest.score ?? 0).toLocaleString()}점 · Lv.${alltimeBest.gameLevel ?? 1} · ${new Date(alltimeBest.createdAt).toLocaleDateString('ko-KR')}`,
                      1, RANK_TOTAL_BF, ['xrcWeekTitle'], { paddingLeft: 8, fontWeight: 'bold' }, 'alltime'
                    )
                  : RCell('👑 역대 1위  기록 없음', 1, RANK_TOTAL_BF, [], { color: '#aaa', paddingLeft: 8 }, 'alltime-empty')
                }
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══ 엑셀 모드: 룰 시트 — 원본 buildRulesSheet() 구조 ══ */}
      {excel && activeSheet === 'rules' && (() => {
        const extraCols = Math.max(10, Math.ceil((sheetSize.width || 600) / XL_CELL));
        const totalHeaderCols = RULES_TOTAL_BF + extraCols;

        type RuleCell = { text: string; colStart: number; span: number; cls: string[]; style?: CSSProperties };
        const rows: RuleCell[][] = [];

        function addRow(...cells: RuleCell[]) { rows.push(cells); }
        function addSection(title: string) {
          addRow({ text: title, colStart: 1, span: RULES_TOTAL_BF, cls: [], style: { background: '#e8f5e9', color: '#1a5c38', fontWeight: 'bold', borderTop: '1px solid #a5d6a7' } });
        }
        function addData(col1: string, col2: string, altIdx: number) {
          const alt = altIdx % 2 === 1 ? ['xrcAlt'] : [] as string[];
          addRow(
            { text: col1, colStart: 1, span: 1, cls: alt, style: { justifyContent: 'center', color: '#888' } },
            { text: col2, colStart: 2, span: RULES_TOTAL_BF - 1, cls: alt },
          );
        }

        // 원본: buildRulesSheet() 구조
        addRow({ text: '도박꾼 블록폴  —  게임 규칙', colStart: 1, span: RULES_TOTAL_BF, cls: ['xrcHeader'], style: { justifyContent: 'center', fontSize: 14, letterSpacing: 1 } });
        addRow({ text: '', colStart: 1, span: RULES_TOTAL_BF, cls: [] });

        addSection('■  조작법');
        [
          ['←→', '좌우 이동'],
          ['↑', '회전'],
          ['↓', '빠른 낙하 (+1점)'],
          ['Space', '급강하 (+2점/칸)'],
          ['Shift', '블록 홀드 (보관/교환, 블록당 1회)'],
          ['P', '일시정지'],
        ].forEach(([k, d], i) => addData(k, d, i));

        addRow({ text: '', colStart: 1, span: RULES_TOTAL_BF, cls: [] });
        addSection('■  점수 계산');
        [
          ['1줄', '100 × 레벨'],
          ['2줄', '300 × 레벨'],
          ['3줄', '500 × 레벨'],
          ['4줄', '800 × 레벨 (블록폴)'],
        ].forEach(([l, p], i) => addData(l, p, i));

        addRow({ text: '', colStart: 1, span: RULES_TOTAL_BF, cls: [] });
        addSection('■  레벨 시스템');
        [
          ['레벨', '10줄 제거마다 레벨 상승 (최대 11)'],
          ['속도', '레벨이 높을수록 낙하 속도 증가'],
        ].forEach(([k, v], i) => addData(k, v, i));

        addRow({ text: '', colStart: 1, span: RULES_TOTAL_BF, cls: [] });
        addSection('■  난이도별 시작 속도');
        [
          ['쉬움', '0.8초/칸 → 최대 0.21초'],
          ['보통', '0.4초/칸 → 최대 0.09초'],
          ['어려움', '0.18초/칸 → 최대 0.03초'],
        ].forEach(([d, s], i) => addData(d, s, i));

        addRow({ text: '', colStart: 1, span: RULES_TOTAL_BF, cls: [] });
        addSection('■  점수 등록');
        [
          ['①', '게임 오버 후 이름을 입력하면 랭킹에 등록됩니다'],
          ['②', '높은 점수일수록 높은 순위'],
          ['③', '쉬움 / 보통 / 어려움 각각 별도 랭킹 운영'],
        ].forEach(([n, t], i) => addData(n, t, i));

        const extraRows = Math.max(10, Math.ceil((sheetSize.height || 400) / XL_CELL));
        const totalRows = rows.length + extraRows;

        return (
          <div className={styles.xSheetWrapper}>
            <div className={styles.xColHeaderRow}>
              <div className={styles.xcorner} />
              {Array.from({ length: totalHeaderCols }, (_, i) => (
                <div key={i} className={styles.xch} style={{ width: XL_CELL, minWidth: XL_CELL }}>{bfColLabel(i)}</div>
              ))}
            </div>
            <div className={styles.xBodyArea}>
              <div className={styles.xRowNums}>
                {Array.from({ length: totalRows }, (_, i) => (
                  <div key={i} className={styles.xrn} style={{ height: XL_CELL }}>{i + 1}</div>
                ))}
              </div>
              <div
                className={styles.xRankGrid}
                style={{ gridTemplateColumns: `repeat(${RULES_TOTAL_BF}, ${XL_CELL}px)`, gridAutoRows: `${XL_CELL}px` }}
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

    </div>{/* end playWrapper */}

      {/* 게임 오버 모달 */}
      {modalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>🎮 게임 오버</h3>
            <p>최종 점수: <strong>{score.toLocaleString()}점</strong> (레벨 {gameLevel}, {lines}줄)</p>
            <input
              className={styles.nameInput}
              type="text"
              placeholder="이름을 입력하세요"
              value={playerName}
              onChange={e => { setPlayerName(e.target.value); setNameBanned(false); }}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmitRanking(); }}
              autoFocus
              maxLength={50}
            />
            <p className={styles.ipNotice}>어뷰징 방지를 위해 IP 주소가 수집됩니다.</p>
            {nameBanned && <p className={styles.hint}>사용할 수 없는 닉네임입니다.</p>}
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
