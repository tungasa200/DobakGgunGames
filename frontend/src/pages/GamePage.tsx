import { lazy, Suspense } from 'react';
import { useParams, Link } from 'react-router-dom';
import ExcelShell from '../components/excel/ExcelShell';

const BaseballBoard    = lazy(() => import('../games/baseball/BaseballBoard'));
const MinesweeperBoard = lazy(() => import('../games/minesweeper/MinesweeperBoard'));
const AppleCanvas      = lazy(() => import('../games/apple/AppleCanvas'));
const CardBoard        = lazy(() => import('../games/solitaire/CardBoard'));
const TetrisBoard      = lazy(() => import('../games/tetris/TetrisBoard'));

const GAME_NAMES: Record<string, string> = {
  minesweeper: '지뢰찾기',
  baseball:    '숫자야구',
  tetris:      '테트리스',
  solitaire:   '솔리테어',
  apple:       '사과게임',
};

const FILE_TITLES: Record<string, string> = {
  minesweeper: 'minesweeper_score.xlsx',
  baseball:    'baseball_score.xlsx',
  tetris:      'tetris_score.xlsx',
  solitaire:   'solitaire_score.xlsx',
  apple:       'apple_game.xlsx',
};

// 게임별 그리드 셀 크기 (원본과 동일하게 맞춤)
const CELL_SIZES: Record<string, number> = {
  tetris:      30,
  minesweeper: 30,
  apple:       52,
};

export default function GamePage({ excel }: { excel: boolean }) {
  const { game } = useParams<{ game: string }>();
  const name = game ? GAME_NAMES[game] : undefined;

  if (!name || !game) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p>존재하지 않는 게임입니다.</p>
        <Link to="/">홈으로</Link>
      </div>
    );
  }

  const board =
    game === 'baseball'    ? <BaseballBoard    excel={excel} /> :
    game === 'minesweeper' ? <MinesweeperBoard excel={excel} /> :
    game === 'apple'       ? <AppleCanvas      excel={excel} /> :
    game === 'solitaire'   ? <CardBoard        excel={excel} /> :
    game === 'tetris'      ? <TetrisBoard      excel={excel} /> :
    null;

  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>로딩 중...</div>}>
      {excel && board ? (
        <ExcelShell
          game={game}
          gameName={name}
          fileTitle={FILE_TITLES[game]}
          cellSize={CELL_SIZES[game]}
        >
          {board}
        </ExcelShell>
      ) : (
        board
      )}
    </Suspense>
  );
}
