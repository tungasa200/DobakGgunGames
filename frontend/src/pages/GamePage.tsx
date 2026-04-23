import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ExcelShell from '../components/excel/ExcelShell';
import NormalHeader from '../components/normal/NormalHeader';
import ErrorBoundary from '../components/ErrorBoundary';
import { useAuth } from '../context/AuthContext';
import { fetchGameStatus } from '../api/games';

const BaseballBoard    = lazy(() => import('../games/baseball/BaseballBoard'));
const MinesweeperBoard = lazy(() => import('../games/minesweeper/MinesweeperBoard'));
const AppleCanvas      = lazy(() => import('../games/apple/AppleCanvas'));
const CardBoard        = lazy(() => import('../games/solitaire/CardBoard'));
const BlockfallBoard         = lazy(() => import('../games/blockfall/BlockfallBoard'));
const BlockfallInsaneBoard   = lazy(() => import('../games/blockfall/BlockfallInsaneBoard'));
const SudokuBoard            = lazy(() => import('../games/sudoku/SudokuBoard'));

const GAME_NAMES: Record<string, string> = {
  minesweeper:       '지뢰찾기',
  baseball:          '숫자야구',
  blockfall:         '블록폴',
  solitaire:         '솔리테어',
  apple:             '사과게임',
  sudoku:            '스도쿠',
  'blockfall-insane': '블록폴: 인세인',
};

const FILE_TITLES: Record<string, string> = {
  minesweeper:       'minesweeper_score.xlsx',
  baseball:          'baseball_score.xlsx',
  blockfall:         'blockfall_score.xlsx',
  solitaire:         'solitaire_score.xlsx',
  apple:             'apple_game.xlsx',
  sudoku:            'sudoku.xlsx',
  'blockfall-insane': 'blockfall_insane.xlsx',
};

// 게임별 그리드 셀 크기 (엑셀 모드) — 열 너비
const CELL_SIZES: Record<string, number> = {
  blockfall:         30,
  minesweeper:       30,
  baseball:          96,
  apple:             30, // 원본: SIZE=30, PAD=SIZE (고정)
  solitaire:         96, // 원본: --xcw: 96px
  sudoku:            40,
  'blockfall-insane': 30,
};

// 게임별 행 높이 (열 너비와 다른 경우만 명시)
const ROW_HEIGHTS: Record<string, number> = {
  baseball:  29,
  solitaire: 29, // 원본: XCH = 29
};

// 게임별 배경색 — 원본 body { background-color } 와 동일
const BG_COLORS: Record<string, string> = {
  minesweeper:       '#f0f0f0',
  baseball:          '#e8ecf4',
  blockfall:         '#f0f0f0',
  solitaire:         '#0b5e20',
  apple:             '#f0f0f0',
  sudoku:            '#f8f9fa',
  'blockfall-insane': '#0a0a0a',
};

// 솔리테어 배경 선택지 (일반 모드에서 사용자가 직접 변경)
const SOLITAIRE_BG_KEY = 'dobakggun-solitaire-bg';
const SOLITAIRE_BG_ALLOWED = new Set(['#0b5e20', '#f5ead6', '#ffffff', '#c0c0c0']);

// 게임별 강조색 — 원본 NORMAL_GAME_CONFIG.accentColor 와 동일
const ACCENT_COLORS: Record<string, string> = {
  minesweeper:       '#3498db',
  baseball:          '#1e3a6e',
  blockfall:         '#8e44ad',
  solitaire:         '#27ae60',
  apple:             '#f18064',
  sudoku:            '#2980b9',
  'blockfall-insane': '#ff2d55',
};

// blockfall-insane은 AdminRoute로 보호되므로 게임 상태 점검 제외
const ADMIN_ONLY_GAMES = new Set(['blockfall-insane']);

export default function GamePage({ excel, gameKey }: { excel: boolean; gameKey?: string }) {
  const { game: paramGame } = useParams<{ game: string }>();
  const game = gameKey ?? paramGame;
  const name = game ? GAME_NAMES[game] : undefined;
  const { user } = useAuth();
  const navigate = useNavigate();

  // blockfall-insane 헤더 강조색 + 배경색 — 첫 이벤트 전: 일반 블록폴 스타일, 이후: 인세인 스타일
  const [insaneAccentColor, setInsaneAccentColor] = useState('#8e44ad');
  const [insaneBgColor, setInsaneBgColor] = useState('#f0f0f0');

  // 솔리테어 배경색 (사용자 선택, localStorage 영속)
  const [solitaireBg, setSolitaireBg] = useState<string>(() => {
    if (typeof window === 'undefined') return '#0b5e20';
    const saved = window.localStorage.getItem(SOLITAIRE_BG_KEY);
    return saved && SOLITAIRE_BG_ALLOWED.has(saved) ? saved : '#0b5e20';
  });
  const handleSolitaireBgChange = useCallback((color: string) => {
    if (!SOLITAIRE_BG_ALLOWED.has(color)) return;
    setSolitaireBg(color);
    try { window.localStorage.setItem(SOLITAIRE_BG_KEY, color); } catch { /* ignore */ }
  }, []);
  // 테마 전환 시 깜빡임 오버라이드 (null이면 insaneBgColor 사용)
  const [flickerBg, setFlickerBg] = useState<string | null>(null);
  const handleInsaneThemeChange = useCallback((phase: 'normal' | 'insane') => {
    setInsaneAccentColor(phase === 'insane' ? '#ff2d55' : '#8e44ad');
    if (phase === 'insane') {
      // 밝↔어두움 2회 깜빡인 뒤 어둠으로 정착
      const frames = ['#0a0a0a', '#f0f0f0', '#0a0a0a', '#f0f0f0', '#0a0a0a'];
      frames.forEach((color, i) => {
        setTimeout(() => {
          if (i === frames.length - 1) {
            setFlickerBg(null);
            setInsaneBgColor('#0a0a0a');
          } else {
            setFlickerBg(color);
          }
        }, i * 110);
      });
    } else {
      setFlickerBg(null);
      setInsaneBgColor('#f0f0f0');
    }
  }, []);

  useEffect(() => {
    if (!name || !game) return;
    document.title = excel ? (FILE_TITLES[game] ?? game) : name;
  }, [game, excel, name]);

  // 비활성 게임 URL 직접 접근 차단 (어드민 전용 게임 및 어드민 유저 제외)
  useEffect(() => {
    if (!game || ADMIN_ONLY_GAMES.has(game) || user?.role === 'ADMIN') return;
    fetchGameStatus().then(status => {
      if (status[game] === false) {
        alert('현재 점검 중인 게임입니다.\n이용에 불편을 드려 죄송합니다.');
        navigate('/', { replace: true });
      }
    });
  }, [game, user, navigate]);

  // blockfall-insane은 엑셀 모드 미지원 — 일반 모드로 강제 리다이렉트
  if (game === 'blockfall-insane' && excel) {
    navigate('/blockfall-insane', { replace: true });
    return null;
  }

  if (!name || !game) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p>존재하지 않는 게임입니다.</p>
        <a href="/">홈으로</a>
      </div>
    );
  }

  const board =
    game === 'baseball'         ? <BaseballBoard       excel={excel} /> :
    game === 'minesweeper'      ? <MinesweeperBoard    excel={excel} /> :
    game === 'apple'            ? <AppleCanvas         excel={excel} /> :
    game === 'solitaire'        ? <CardBoard           excel={excel} bgColor={solitaireBg} onBgColorChange={handleSolitaireBgChange} /> :
    game === 'blockfall'        ? <BlockfallBoard      excel={excel} /> :
    game === 'sudoku'           ? <SudokuBoard         excel={excel} /> :
    game === 'blockfall-insane' ? <BlockfallInsaneBoard onThemeChange={handleInsaneThemeChange} /> :
    null;

  if (excel) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>로딩 중...</div>}>
          <ExcelShell
            game={game}
            gameName={name}
            fileTitle={FILE_TITLES[game]}
            cellSize={CELL_SIZES[game]}
            rowHeight={ROW_HEIGHTS[game]}
          >
            {board}
          </ExcelShell>
        </Suspense>
      </ErrorBoundary>
    );
  }

  // 일반 모드: 원본 HTML처럼 전체화면 + 게임별 배경색 + 공통 헤더
  return (
    <ErrorBoundary>
      <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>로딩 중...</div>}>
        <div style={{
          position: 'fixed',
          inset: 0,
          overflow: 'auto',
          background: game === 'blockfall-insane' ? (flickerBg ?? insaneBgColor) : (game === 'solitaire' ? solitaireBg : (BG_COLORS[game] ?? '#f0f0f0')),
          fontFamily: 'sans-serif',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <NormalHeader
            currentGame={game}
            gameName={name}
            accentColor={game === 'blockfall-insane' ? insaneAccentColor : (ACCENT_COLORS[game] ?? '#2c3e50')}
          />
          {board}
        </div>
      </Suspense>
    </ErrorBoundary>
  );
}
