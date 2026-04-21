import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getCachedWeekly, type RankingEntry } from '../api/rankings';
import { fetchGameStatus } from '../api/games';
import { useAuth } from '../context/AuthContext';
import NormalHeader from '../components/normal/NormalHeader';
import Footer from '../components/normal/Footer';
import styles from './HomePage.module.css';

const MEDALS = ['🥇', '🥈', '🥉'];

interface GameConfig {
  key: string;
  name: string;
  icon: string;
  levels: { value: string; label: string }[];
  defaultLevel: string;
  fmt: (r: RankingEntry) => string;
  comingSoon?: boolean;
}

const GAMES: GameConfig[] = [
  {
    key: 'minesweeper',
    name: '지뢰찾기',
    icon: '💣',
    levels: [
      { value: 'beginner', label: '초급' },
      { value: 'intermediate', label: '중급' },
      { value: 'expert', label: '고급' },
    ],
    defaultLevel: 'beginner',
    fmt: (r) => `${r.time!.toFixed(2)}초`,
  },
  {
    key: 'baseball',
    name: '숫자야구',
    icon: '⚾',
    levels: [
      { value: 'easy', label: '쉬움' },
      { value: 'normal', label: '보통' },
      { value: 'hard', label: '어려움' },
    ],
    defaultLevel: 'easy',
    fmt: (r) => `${r.attempts}번`,
  },
  {
    key: 'blockfall',
    name: '블록폴',
    icon: '🟦',
    levels: [
      { value: 'easy', label: '쉬움' },
      { value: 'normal', label: '보통' },
      { value: 'hard', label: '어려움' },
    ],
    defaultLevel: 'normal',
    fmt: (r) => `${(r.score ?? 0).toLocaleString()}점`,
  },
  {
    key: 'apple',
    name: '사과게임',
    icon: '🍎',
    levels: [{ value: 'normal', label: '랭킹' }],
    defaultLevel: 'normal',
    fmt: (r) => `${(r.score ?? 0).toLocaleString()}점`,
  },
  {
    key: 'solitaire',
    name: '솔리테어',
    icon: '🃏',
    levels: [
      { value: 'draw1', label: '드로우1' },
      { value: 'draw3', label: '드로우3' },
    ],
    defaultLevel: 'draw1',
    fmt: (r) => {
      const t = Math.round(r.time!);
      const m = Math.floor(t / 60);
      const s = t % 60;
      return m > 0 ? `${m}분 ${String(s).padStart(2, '0')}초` : `${t}초`;
    },
  },
  {
    key: 'sudoku',
    name: '스도쿠',
    icon: '🔢',
    levels: [
      { value: 'easy',   label: '초급' },
      { value: 'normal', label: '중급' },
      { value: 'hard',   label: '고급' },
    ],
    defaultLevel: 'easy',
    fmt: (r) => `${r.time!.toFixed(2)}초`,
  },
];

type RankCache = Record<string, Record<string, RankingEntry[] | 'error'>>;

function GameCard({ game, rankings, activeLevel, onLevelChange, disabled }: {
  game: GameConfig;
  rankings: Record<string, RankingEntry[] | 'error'>;
  activeLevel: string;
  onLevelChange: (level: string) => void;
  disabled?: boolean;
}) {
  const data = rankings[activeLevel];

  return (
    <div className={`${styles.card} ${game.comingSoon ? styles.cardComingSoon : ''} ${disabled ? styles.cardDisabled : ''}`}>
      {game.comingSoon && <div className={styles.comingSoonOverlay}><span>준비중</span></div>}
      {disabled && <div className={styles.disabledOverlay}><span>🔧 점검 중</span></div>}
      <div className={styles.cardHeader}>
        <span className={styles.icon}>{game.icon}</span>
        <div className={styles.title}>
          <div className={styles.nameKo}>{game.name}</div>
        </div>
        <div className={styles.btns}>
          <Link className={`${styles.btn} ${styles.btnNormal}`} to={`/${game.key}`}>기본</Link>
          <Link className={`${styles.btn} ${styles.btnExcel}`} to={`/${game.key}/excel`}>📊 엑셀</Link>
        </div>
      </div>

      <div className={styles.cardRanking}>
        {game.levels.length > 1 && (
          <div className={styles.tabs}>
            {game.levels.map((lv) => (
              <button
                key={lv.value}
                className={`${styles.tab} ${activeLevel === lv.value ? styles.tabActive : ''}`}
                onClick={() => onLevelChange(lv.value)}
              >
                {lv.label}
              </button>
            ))}
          </div>
        )}

        <div className={styles.rankBody}>
          {!data ? (
            <p className={styles.placeholder}>불러오는 중...</p>
          ) : data === 'error' ? (
            <p className={styles.placeholder}>불러오기 실패</p>
          ) : data.length === 0 ? (
            <p className={styles.placeholder}>기록 없음</p>
          ) : (
            data.slice(0, 3).map((entry, i) => (
              <div key={entry.id} className={styles.rankRow}>
                <span className={styles.medal}>{MEDALS[i]}</span>
                <span className={styles.rankName}>{entry.name}</span>
                <span className={styles.rankScore}>{game.fmt(entry)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const [cache, setCache] = useState<RankCache>({});
  const [activeLevels, setActiveLevels] = useState<Record<string, string>>(
    Object.fromEntries(GAMES.map((g) => [g.key, g.defaultLevel]))
  );
  const [gameStatus, setGameStatus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    document.title = '도박꾼게임즈';
  }, []);

  useEffect(() => {
    fetchGameStatus().then(setGameStatus);
  }, []);

  const fetchLevel = (gameKey: string, level: string) => {
    getCachedWeekly(gameKey, level)
      .then((data) =>
        setCache((prev) => ({
          ...prev,
          [gameKey]: { ...(prev[gameKey] ?? {}), [level]: data },
        }))
      )
      .catch(() =>
        setCache((prev) => ({
          ...prev,
          [gameKey]: { ...(prev[gameKey] ?? {}), [level]: 'error' },
        }))
      );
  };

  useEffect(() => {
    GAMES.forEach((game) => fetchLevel(game.key, game.defaultLevel));
  }, []);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      overflow: 'auto',
      background: '#f0f0f0',
      fontFamily: 'sans-serif',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <NormalHeader currentGame="" gameName="게임 목록" accentColor="#2c3e50" />
      <div className={styles.page}>
        <h1 className={styles.heading}>🎮 DobakGgun</h1>
        <div className={styles.grid}>
          {GAMES.map((game) => {
            const isDisabled = user?.role !== 'ADMIN' && gameStatus[game.key] === false;
            return (
              <GameCard
                key={game.key}
                game={game}
                rankings={cache[game.key] ?? {}}
                activeLevel={activeLevels[game.key]}
                onLevelChange={(lv) => {
                  setActiveLevels((prev) => ({ ...prev, [game.key]: lv }));
                  if (!cache[game.key]?.[lv]) fetchLevel(game.key, lv);
                }}
                disabled={isDisabled}
              />
            );
          })}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.icon}>🧪</span>
              <div className={styles.title}>
                <div className={styles.nameKo}>Test Lab</div>
              </div>
            </div>
            <div className={styles.cardRanking}>
              {user?.role === 'ADMIN' && (
                <Link className={styles.btn} to="/blockfall-insane">
                  🔥 블록폴: 인세인 (테스트)
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
