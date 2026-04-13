import { lazy, Suspense } from 'react';
import { useParams } from 'react-router-dom';
import ExcelShell from '../components/excel/ExcelShell';
import NormalHeader from '../components/normal/NormalHeader';

const BaseballBoard    = lazy(() => import('../games/baseball/BaseballBoard'));
const MinesweeperBoard = lazy(() => import('../games/minesweeper/MinesweeperBoard'));
const AppleCanvas      = lazy(() => import('../games/apple/AppleCanvas'));
const CardBoard        = lazy(() => import('../games/solitaire/CardBoard'));
const BlockfallBoard   = lazy(() => import('../games/blockfall/BlockfallBoard'));

const GAME_NAMES: Record<string, string> = {
  minesweeper: '지뢰찾기',
  baseball:    '숫자야구',
  blockfall:   '블록폴',
  solitaire:   '솔리테어',
  apple:       '사과게임',
};

const FILE_TITLES: Record<string, string> = {
  minesweeper: 'minesweeper_score.xlsx',
  baseball:    'baseball_score.xlsx',
  blockfall:   'blockfall_score.xlsx',
  solitaire:   'solitaire_score.xlsx',
  apple:       'apple_game.xlsx',
};

// 게임별 그리드 셀 크기 (엑셀 모드) — 열 너비
const CELL_SIZES: Record<string, number> = {
  blockfall:   30,
  minesweeper: 30,
  baseball:    96,
  apple:       30, // 원본: SIZE=30, PAD=SIZE (고정)
  solitaire:   96, // 원본: --xcw: 96px
};

// 게임별 행 높이 (열 너비와 다른 경우만 명시)
const ROW_HEIGHTS: Record<string, number> = {
  baseball:  29,
  solitaire: 29, // 원본: XCH = 29
};

// 게임별 배경색 — 원본 body { background-color } 와 동일
const BG_COLORS: Record<string, string> = {
  minesweeper: '#f0f0f0',
  baseball:    '#e8ecf4',
  blockfall:   '#f0f0f0',
  solitaire:   '#0b5e20',
  apple:       '#f0f0f0',
};

// 게임별 강조색 — 원본 NORMAL_GAME_CONFIG.accentColor 와 동일
const ACCENT_COLORS: Record<string, string> = {
  minesweeper: '#3498db',
  baseball:    '#1e3a6e',
  blockfall:   '#8e44ad',
  solitaire:   '#27ae60',
  apple:       '#f18064',
};

export default function GamePage({ excel }: { excel: boolean }) {
  const { game } = useParams<{ game: string }>();
  const name = game ? GAME_NAMES[game] : undefined;

  if (!name || !game) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p>존재하지 않는 게임입니다.</p>
        <a href="/">홈으로</a>
      </div>
    );
  }

  const board =
    game === 'baseball'    ? <BaseballBoard    excel={excel} /> :
    game === 'minesweeper' ? <MinesweeperBoard excel={excel} /> :
    game === 'apple'       ? <AppleCanvas      excel={excel} /> :
    game === 'solitaire'   ? <CardBoard        excel={excel} /> :
    game === 'blockfall'   ? <BlockfallBoard   excel={excel} /> :
    null;

  if (excel) {
    return (
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
    );
  }

  // 일반 모드: 원본 HTML처럼 전체화면 + 게임별 배경색 + 공통 헤더
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>로딩 중...</div>}>
      <div style={{
        position: 'fixed',
        inset: 0,
        overflow: 'auto',
        background: BG_COLORS[game] ?? '#f0f0f0',
        fontFamily: 'sans-serif',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <NormalHeader
          currentGame={game}
          gameName={name}
          accentColor={ACCENT_COLORS[game] ?? '#2c3e50'}
        />
        {board}
      </div>
    </Suspense>
  );
}
