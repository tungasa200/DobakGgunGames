// 각 게임 페이지 — 게임 구현 시 여기에 연결
// 현재는 준비 중 화면을 표시
import { useParams, Link } from 'react-router-dom';

const GAME_NAMES: Record<string, string> = {
  minesweeper: '지뢰찾기',
  baseball: '숫자야구',
  tetris: '테트리스',
  solitaire: '솔리테어',
  apple: '사과게임',
};

export default function GamePage({ excel }: { excel: boolean }) {
  const { game } = useParams<{ game: string }>();
  const name = game ? GAME_NAMES[game] : undefined;

  if (!name) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p>존재하지 않는 게임입니다.</p>
        <Link to="/">홈으로</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: 40, textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h2>{name} {excel ? '(엑셀 모드)' : ''}</h2>
      <p style={{ color: '#888' }}>게임 구현 예정입니다.</p>
      <Link to="/">← 홈으로</Link>
    </div>
  );
}
