import { useCallback, useEffect, useReducer, useRef } from 'react';

export type DrawMode = 'draw1' | 'draw3';
export type Suit = '♠' | '♣' | '♥' | '♦';
export type Color = 'black' | 'red';

export interface Card {
  suit: Suit;
  val: string;
  num: number;   // 1=A … 13=K
  color: Color;
  faceUp: boolean;
}

export interface Selection {
  zone: 'waste' | 'foundation' | 'tableau';
  col: number;
  index: number;
}

export interface GameState {
  stock: Card[];
  waste: Card[];
  foundations: Card[][];   // [0..3]
  tableaus: Card[][];      // [0..6]
  selected: Selection | null;
}

export type GameStatus = 'idle' | 'playing' | 'won';

interface State {
  drawMode: DrawMode;
  game: GameState;
  history: GameState[];   // undo 스택 (max 50)
  elapsed: number;
  moves: number;
  status: GameStatus;
  timerRunning: boolean;
  autoCompleting: boolean;
}

type Action =
  | { type: 'START'; drawMode: DrawMode }
  /**
   * Phase 3: 서버가 생성한 덱 순서("A♠", "10♥" …)를 사용해 게임 초기화.
   * 클라이언트 Fisher-Yates 셔플을 건너뜀.
   */
  | { type: 'START_WITH_DECK'; drawMode: DrawMode; deck: string[] }
  | { type: 'SET_GAME'; game: GameState; saveHistory?: boolean }
  | { type: 'UNDO' }
  | { type: 'TICK' }
  | { type: 'INC_MOVES' }
  | { type: 'START_TIMER' }
  | { type: 'WIN' }
  | { type: 'AUTO_COMPLETING'; value: boolean };

// ── 카드 생성 ──────────────────────────────────────────────────────
const SUITS: Suit[] = ['♠', '♣', '♥', '♦'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const REDS = new Set<Suit>(['♥', '♦']);

function buildDeck(): Card[] {
  const deck: Card[] = [];
  SUITS.forEach((suit) =>
    VALUES.forEach((val, i) =>
      deck.push({ suit, val, num: i + 1, color: REDS.has(suit) ? 'red' : 'black', faceUp: false })
    )
  );
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/** 서버 덱 문자열 ("A♠", "10♥" …) → Card 배열 */
function parseDeckStrings(deckStrings: string[]): Card[] {
  return deckStrings.map((s) => {
    // 마지막 문자가 suit
    const suit = s.slice(-1) as Suit;
    const val  = s.slice(0, -1);
    const num  = VALUES.indexOf(val) + 1;  // 1=A … 13=K
    return { suit, val, num, color: REDS.has(suit) ? 'red' : 'black', faceUp: false };
  });
}

/** Phase 3: 서버 덱 순서를 그대로 사용해 초기 게임 구성 (셔플 없음) */
function buildInitialGameFromDeck(deckStrings: string[]): GameState {
  const deck     = parseDeckStrings(deckStrings);
  const tableaus: Card[][] = Array.from({ length: 7 }, () => []);
  for (let i = 0; i < 7; i++) {
    for (let j = 0; j <= i; j++) {
      const card = deck.pop()!;
      if (j === i) card.faceUp = true;
      tableaus[i].push(card);
    }
  }
  return { stock: deck, waste: [], foundations: [[], [], [], []], tableaus, selected: null };
}

function buildInitialGame(drawMode: DrawMode): GameState {
  void drawMode;
  const deck = buildDeck();
  const tableaus: Card[][] = Array.from({ length: 7 }, () => []);
  for (let i = 0; i < 7; i++) {
    for (let j = 0; j <= i; j++) {
      const card = deck.pop()!;
      if (j === i) card.faceUp = true;
      tableaus[i].push(card);
    }
  }
  return {
    stock: deck,
    waste: [],
    foundations: [[], [], [], []],
    tableaus,
    selected: null,
  };
}

function cloneGame(g: GameState): GameState {
  return JSON.parse(JSON.stringify({ ...g, selected: null }));
}

function getStack(g: GameState, zone: Selection['zone'], col: number): Card[] {
  if (zone === 'waste')      return g.waste;
  if (zone === 'foundation') return g.foundations[col];
  return g.tableaus[col];
}

// ── Reducer ────────────────────────────────────────────────────────
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'START':
      return {
        drawMode: action.drawMode,
        game: buildInitialGame(action.drawMode),
        history: [],
        elapsed: 0,
        moves: 0,
        status: 'idle',
        timerRunning: false,
        autoCompleting: false,
      };

    case 'START_WITH_DECK':
      return {
        drawMode: action.drawMode,
        game: buildInitialGameFromDeck(action.deck),
        history: [],
        elapsed: 0,
        moves: 0,
        status: 'idle',
        timerRunning: false,
        autoCompleting: false,
      };

    case 'SET_GAME': {
      const newHistory = action.saveHistory
        ? [...state.history.slice(-49), cloneGame(state.game)]
        : state.history;
      return {
        ...state,
        game: action.game,
        history: newHistory,
        status: state.status === 'idle' ? 'playing' : state.status,
      };
    }

    case 'UNDO':
      if (!state.history.length) return state;
      return {
        ...state,
        game: { ...state.history[state.history.length - 1], selected: null },
        history: state.history.slice(0, -1),
      };

    case 'TICK':
      return { ...state, elapsed: state.elapsed + 1 };

    case 'INC_MOVES':
      return { ...state, moves: state.moves + 1 };

    case 'START_TIMER':
      return { ...state, timerRunning: true, status: 'playing' };

    case 'WIN':
      return { ...state, status: 'won', timerRunning: false };

    case 'AUTO_COMPLETING':
      return { ...state, autoCompleting: action.value };

    default:
      return state;
  }
}

// ── 이동 유효성 ────────────────────────────────────────────────────
function isValidDrop(
  top: Card,
  moving: Card[],
  toZone: Selection['zone'],
  dstTop: Card | undefined
): boolean {
  if (toZone === 'foundation') {
    if (moving.length !== 1) return false;
    if (!dstTop) return top.num === 1;
    return dstTop.suit === top.suit && dstTop.num + 1 === top.num;
  }
  if (toZone === 'tableau') {
    if (!dstTop) return top.num === 13;
    return dstTop.faceUp && dstTop.color !== top.color && dstTop.num - 1 === top.num;
  }
  return false;
}

// ── Hook ───────────────────────────────────────────────────────────
export function useSolitaireGame(initialDrawMode: DrawMode = 'draw1') {
  const [state, dispatch] = useReducer(reducer, initialDrawMode, (dm) => ({
    drawMode: dm,
    game: buildInitialGame(dm),
    history: [],
    elapsed: 0,
    moves: 0,
    status: 'idle' as GameStatus,
    timerRunning: false,
    autoCompleting: false,
  }));

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 타이머
  useEffect(() => {
    if (state.timerRunning) {
      timerRef.current = setInterval(() => dispatch({ type: 'TICK' }), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [state.timerRunning]);

  // 타이머 시작 (첫 액션)
  // state.status는 SET_GAME에서 첫 선택 시 'idle'→'playing'으로 바뀌므로
  // timerRunning 플래그를 직접 확인해야 함
  const ensureTimer = useCallback(() => {
    if (!state.timerRunning && state.status !== 'won') dispatch({ type: 'START_TIMER' });
  }, [state.timerRunning, state.status]);

  const startGame = useCallback((drawMode: DrawMode = state.drawMode) => {
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    dispatch({ type: 'START', drawMode });
  }, [state.drawMode]);

  /** Phase 3: 서버가 제공한 덱 순서로 게임 시작 (클라이언트 셔플 제거) */
  const startGameWithDeck = useCallback((drawMode: DrawMode, deck: string[]) => {
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    dispatch({ type: 'START_WITH_DECK', drawMode, deck });
  }, []);

  // ── 스톡 드로우 ────────────────────────────────────────────────
  const drawStock = useCallback(() => {
    const g = state.game;
    if (g.selected) {
      dispatch({ type: 'SET_GAME', game: { ...g, selected: null } });
      return;
    }
    ensureTimer();
    const next = cloneGame(g);
    if (next.stock.length > 0) {
      const count = state.drawMode === 'draw3' ? Math.min(3, next.stock.length) : 1;
      for (let i = 0; i < count; i++) {
        const card = next.stock.pop()!;
        card.faceUp = true;
        next.waste.push(card);
      }
    } else {
      next.stock = next.waste.reverse().map((c) => ({ ...c, faceUp: false }));
      next.waste = [];
    }
    dispatch({ type: 'SET_GAME', game: next, saveHistory: true });
    dispatch({ type: 'INC_MOVES' });
  }, [state.game, state.drawMode, ensureTimer]);

  // ── 카드 선택 / 이동 ───────────────────────────────────────────
  const selectOrMove = useCallback((zone: Selection['zone'], col: number, index: number) => {
    const g = state.game;
    const stack = getStack(g, zone, col);
    const card = stack[index];
    if (!card || !card.faceUp) return;

    const sel = g.selected;

    // 같은 카드 재클릭 → 선택 해제
    if (sel && sel.zone === zone && sel.col === col && sel.index === index) {
      dispatch({ type: 'SET_GAME', game: { ...g, selected: null } });
      return;
    }

    // 선택 상태에서 다른 위치 클릭 → 이동 시도
    if (sel) {
      if (tryDrop(zone, col)) return;
      // 이동 실패 → 새 카드 선택으로 교체
      dispatch({ type: 'SET_GAME', game: { ...g, selected: { zone, col, index } } });
      return;
    }

    dispatch({ type: 'SET_GAME', game: { ...g, selected: { zone, col, index } } });
  }, [state.game]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Waste 클릭 ─────────────────────────────────────────────────
  const clickWaste = useCallback(() => {
    const g = state.game;
    if (!g.waste.length) {
      if (g.selected) dispatch({ type: 'SET_GAME', game: { ...g, selected: null } });
      return;
    }
    selectOrMove('waste', 0, g.waste.length - 1);
  }, [state.game, selectOrMove]);

  // ── Foundation 클릭 ────────────────────────────────────────────
  const clickFoundation = useCallback((fi: number) => {
    const g = state.game;
    if (g.selected) {
      if (g.selected.zone === 'foundation' && g.selected.col === fi) {
        dispatch({ type: 'SET_GAME', game: { ...g, selected: null } });
        return;
      }
      tryDrop('foundation', fi);
    } else {
      const f = g.foundations[fi];
      if (f.length > 0)
        dispatch({ type: 'SET_GAME', game: { ...g, selected: { zone: 'foundation', col: fi, index: f.length - 1 } } });
    }
  }, [state.game]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tableau 클릭 ───────────────────────────────────────────────
  const clickTableau = useCallback((col: number) => {
    const g = state.game;
    if (!g.selected) return;
    if (g.selected.zone === 'tableau' && g.selected.col === col) {
      dispatch({ type: 'SET_GAME', game: { ...g, selected: null } });
      return;
    }
    tryDrop('tableau', col);
  }, [state.game]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 더블클릭 → 파운데이션 자동이동 ───────────────────────────
  const autoMoveToFoundation = useCallback((zone: Selection['zone'], col: number, index: number) => {
    const g = state.game;
    const stack = getStack(g, zone, col);
    const card = stack[index];
    if (!card || !card.faceUp) return;

    const withSel = { ...g, selected: { zone, col, index } };
    for (let fi = 0; fi < 4; fi++) {
      const dst = withSel.foundations[fi];
      const dstTop = dst[dst.length - 1];
      if (isValidDrop(card, [card], 'foundation', dstTop)) {
        const next = cloneGame(withSel);
        const src = getStack(next, zone, col);
        next.foundations[fi].push(src[index]);
        src.splice(index, 1);
        if (zone === 'tableau' && src.length > 0) src[src.length - 1].faceUp = true;
        next.selected = null;
        ensureTimer();
        dispatch({ type: 'SET_GAME', game: next, saveHistory: true });
        dispatch({ type: 'INC_MOVES' });
        checkWinAndAuto(next);
        return;
      }
    }
    // 이동 불가 → 선택만
    dispatch({ type: 'SET_GAME', game: { ...g, selected: { zone, col, index } } });
  }, [state.game, ensureTimer]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 내부: 이동 실행 ────────────────────────────────────────────
  function tryDrop(toZone: Selection['zone'], toCol: number): boolean {
    const g = state.game;
    if (!g.selected) return false;
    const { zone: fz, col: fc, index: fi } = g.selected;

    const src = getStack(g, fz, fc);
    const moving = fz === 'tableau' ? src.slice(fi) : [src[fi]];
    const top = moving[0];
    const dst = getStack(g, toZone, toCol);
    const dstTop = dst[dst.length - 1];

    if (!isValidDrop(top, moving, toZone, dstTop)) {
      dispatch({ type: 'SET_GAME', game: { ...g, selected: null } });
      return false;
    }

    const next = cloneGame(g);
    const nSrc = getStack(next, fz, fc);
    const nDst = getStack(next, toZone, toCol);
    nDst.push(...(fz === 'tableau' ? nSrc.slice(fi) : [nSrc[fi]]));
    nSrc.splice(fi, moving.length);
    if (fz === 'tableau' && nSrc.length > 0) nSrc[nSrc.length - 1].faceUp = true;
    next.selected = null;

    ensureTimer();
    dispatch({ type: 'SET_GAME', game: next, saveHistory: true });
    dispatch({ type: 'INC_MOVES' });
    checkWinAndAuto(next);
    return true;
  }

  function checkWinAndAuto(g: GameState) {
    if (g.foundations.every((f) => f.length === 13)) {
      dispatch({ type: 'WIN' });
      return;
    }
    if (!state.autoCompleting) maybeAutoComplete(g);
  }

  function canAutoComplete(g: GameState): boolean {
    if (g.stock.length > 0) return false;
    return g.tableaus.every((pile) => pile.every((c) => c.faceUp));
  }

  function maybeAutoComplete(g: GameState) {
    if (!canAutoComplete(g)) return;
    dispatch({ type: 'AUTO_COMPLETING', value: true });
    runAutoStep(g);
  }

  function runAutoStep(g: GameState) {
    if (g.foundations.every((f) => f.length === 13)) {
      dispatch({ type: 'AUTO_COMPLETING', value: false });
      dispatch({ type: 'WIN' });
      return;
    }

    let moved = false;
    let next = cloneGame(g);

    // waste 먼저
    if (!moved && next.waste.length > 0) {
      const idx = next.waste.length - 1;
      const card = next.waste[idx];
      for (let fi = 0; fi < 4; fi++) {
        const dst = next.foundations[fi];
        const dstTop = dst[dst.length - 1];
        if (isValidDrop(card, [card], 'foundation', dstTop)) {
          dst.push(next.waste.splice(idx, 1)[0]);
          moved = true; break;
        }
      }
    }

    // tableau
    if (!moved) {
      outer: for (let i = 0; i < 7; i++) {
        const pile = next.tableaus[i];
        if (!pile.length) continue;
        const card = pile[pile.length - 1];
        for (let fi = 0; fi < 4; fi++) {
          const dst = next.foundations[fi];
          const dstTop = dst[dst.length - 1];
          if (isValidDrop(card, [card], 'foundation', dstTop)) {
            dst.push(pile.pop()!);
            moved = true; break outer;
          }
        }
      }
    }

    if (moved) {
      dispatch({ type: 'SET_GAME', game: next });
      dispatch({ type: 'INC_MOVES' });
      autoTimerRef.current = setTimeout(() => runAutoStep(next), 80);
    } else {
      dispatch({ type: 'AUTO_COMPLETING', value: false });
    }
  }

  const undo = useCallback(() => {
    dispatch({ type: 'UNDO' });
  }, []);

  return {
    state,
    startGame,
    startGameWithDeck,
    drawStock,
    selectOrMove,
    clickWaste,
    clickFoundation,
    clickTableau,
    autoMoveToFoundation,
    undo,
  };
}
