import s from './GameDifficultyPicker.module.css';

// PRD 6.5 게임종류 매트릭스
export const GAME_DIFFICULTY_MAP: Record<string, { label: string; difficulties: { key: string; label: string }[] }> = {
  minesweeper: {
    label: '지뢰찾기',
    difficulties: [
      { key: 'beginner', label: '초급' },
      { key: 'intermediate', label: '중급' },
      { key: 'expert', label: '고급' },
    ],
  },
  baseball: {
    label: '숫자야구',
    difficulties: [
      { key: 'easy', label: '쉬움(3자리)' },
      { key: 'normal', label: '보통(4자리)' },
      { key: 'hard', label: '어려움(5자리)' },
    ],
  },
  blockfall: {
    label: '블록폴',
    difficulties: [
      { key: 'easy', label: '쉬움' },
      { key: 'normal', label: '보통' },
      { key: 'hard', label: '어려움' },
    ],
  },
  'blockfall-insane': {
    label: '블록폴: 인세인',
    difficulties: [
      { key: 'insane', label: '인세인' },
    ],
  },
  solitaire: {
    label: '솔리테어',
    difficulties: [
      { key: 'draw1', label: '드로우1' },
      { key: 'draw3', label: '드로우3' },
    ],
  },
  apple: {
    label: '사과게임',
    difficulties: [
      { key: 'normal', label: '기본' },
    ],
  },
  sudoku: {
    label: '스도쿠',
    difficulties: [
      { key: 'easy', label: '초급' },
      { key: 'normal', label: '중급' },
      { key: 'hard', label: '고급' },
    ],
  },
};

const GAME_ORDER = [
  'minesweeper', 'baseball', 'blockfall', 'blockfall-insane', 'solitaire', 'apple', 'sudoku',
];

interface Props {
  gameKey: string;
  difficultyKey: string;
  onGameChange: (gameKey: string) => void;
  onDifficultyChange: (difficultyKey: string) => void;
  gameError?: string;
  difficultyError?: string;
}

export default function GameDifficultyPicker({
  gameKey, difficultyKey, onGameChange, onDifficultyChange,
  gameError, difficultyError,
}: Props) {
  const gameInfo = gameKey ? GAME_DIFFICULTY_MAP[gameKey] : null;
  const difficulties = gameInfo?.difficulties ?? [];
  const isSingleDifficulty = difficulties.length === 1;

  function handleGameChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newGame = e.target.value;
    onGameChange(newGame);
    // 2뎁스 초기화 또는 단일이면 자동 선택
    const newDiffs = GAME_DIFFICULTY_MAP[newGame]?.difficulties ?? [];
    if (newDiffs.length === 1) {
      onDifficultyChange(newDiffs[0].key);
    } else {
      onDifficultyChange('');
    }
  }

  return (
    <div className={s.wrap}>
      <div className={s.group}>
        <label className={s.label}>게임 종류 <span className={s.req}>*</span></label>
        <select
          className={`${s.select} ${gameError ? s.error : ''}`}
          value={gameKey}
          onChange={handleGameChange}
        >
          <option value="" disabled>게임 선택</option>
          {GAME_ORDER.map(k => (
            <option key={k} value={k}>{GAME_DIFFICULTY_MAP[k].label}</option>
          ))}
        </select>
        {gameError && <p className={s.errorMsg}>{gameError}</p>}
      </div>

      <div className={s.group}>
        <label className={s.label}>난이도 <span className={s.req}>*</span></label>
        <select
          className={`${s.select} ${difficultyError ? s.error : ''} ${!gameKey || isSingleDifficulty ? s.disabled : ''}`}
          value={difficultyKey}
          onChange={e => onDifficultyChange(e.target.value)}
          disabled={!gameKey || isSingleDifficulty}
        >
          <option value="" disabled>
            {!gameKey ? '게임을 먼저 선택' : isSingleDifficulty ? difficulties[0]?.label : '난이도 선택'}
          </option>
          {difficulties.map(d => (
            <option key={d.key} value={d.key}>{d.label}</option>
          ))}
        </select>
        {difficultyError && <p className={s.errorMsg}>{difficultyError}</p>}
      </div>
    </div>
  );
}
