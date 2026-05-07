import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getCachedWeekly, type RankingEntry } from '../api/rankings';
import { fetchGameStatus } from '../api/games';
import { useAuth } from '../context/AuthContext';
import NormalHeader from '../components/normal/NormalHeader';
import Footer from '../components/normal/Footer';
import styles from './HomePage.module.css';

const MEDALS = ['🥇', '🥈', '🥉'];

interface LevelConfig {
  value: string;
  label: string;
  game?: string;
  apiLevel?: string;
}

interface GameConfig {
  key: string;
  name: string;
  icon: string;
  levels: LevelConfig[];
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
      { value: 'insane', label: '인세인', game: 'blockfall-insane', apiLevel: 'hard' },
    ],
    defaultLevel: 'normal',
    fmt: (r) => `${(r.score ?? 0).toLocaleString()}점`,
  },
  {
    key: 'apple',
    name: '사과게임',
    icon: '🍎',
    levels: [
      { value: 'normal', label: '기본' },
      { value: 'large',  label: '큰 판' },
    ],
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
    fmt: (r) => {
      const t = Math.round(r.time!);
      const m = Math.floor(t / 60);
      const s = t % 60;
      return m > 0 ? `${m}분 ${String(s).padStart(2, '0')}초` : `${t}초`;
    },
  },
];

interface MultiGameConfig {
  icon: string;
  name: string;
  to: string;
  description: string;
}

const MULTI_GAMES: MultiGameConfig[] = [
  {
    icon: '✌️',
    name: '온라인 가위바위보',
    to: '/online-rps',
    description: '2~4인 실시간 대전',
  },
  {
    icon: '🟦',
    name: '블록폴 배틀',
    to: '/blockfall-battle',
    description: '2인 실시간 블록 배틀',
  },
  {
    icon: '🎲',
    name: '야추 (Yacht)',
    to: '/yacht',
    description: '실시간 대전 주사위 게임',
  },
];

type RankCache = Record<string, Record<string, RankingEntry[] | 'error'>>;

function MultiGameCard({ game }: { game: MultiGameConfig }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.icon}>{game.icon}</span>
        <div className={styles.title}>
          <div className={styles.nameKo}>{game.name}</div>
        </div>
        <div className={styles.btns}>
          <Link className={`${styles.btn} ${styles.btnNormal}`} to={game.to}>플레이</Link>
        </div>
      </div>
      <div className={styles.cardRanking}>
        <p className={styles.placeholder} style={{ padding: '20px 0' }}>{game.description}</p>
      </div>
    </div>
  );
}

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
  const [activeTab, setActiveTab] = useState<'전체' | '솔로' | '멀티' | '기타'>('전체');

  useEffect(() => {
    document.title = '도박꾼게임즈';
  }, []);

  useEffect(() => {
    fetchGameStatus().then(setGameStatus);
  }, []);

  const fetchLevel = (game: GameConfig, levelValue: string) => {
    const lv = game.levels.find((l) => l.value === levelValue);
    const apiGame = lv?.game ?? game.key;
    const apiLevel = lv?.apiLevel ?? levelValue;
    getCachedWeekly(apiGame, apiLevel)
      .then((data) =>
        setCache((prev) => ({
          ...prev,
          [game.key]: { ...(prev[game.key] ?? {}), [levelValue]: data },
        }))
      )
      .catch(() =>
        setCache((prev) => ({
          ...prev,
          [game.key]: { ...(prev[game.key] ?? {}), [levelValue]: 'error' },
        }))
      );
  };

  useEffect(() => {
    GAMES.forEach((game) => fetchLevel(game, game.defaultLevel));
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
      <NormalHeader currentGame="" gameName="게임즈" accentColor="#2c3e50" />
      <div className={styles.page}>
        <h1 className={styles.heading}>
          <img src="/common/logo.png" alt="" className={styles.headingLogo} />
          DobakGgun
        </h1>
        <div className={styles.filterTabs}>
          {(['전체', '솔로', '멀티', '기타'] as const).map((tab) => (
            <button
              key={tab}
              className={`${styles.filterTab} ${activeTab === tab ? styles.filterTabActive : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* 솔로플레이 섹션 */}
        {(activeTab === '전체' || activeTab === '솔로') && (
        <div className={styles.sectionBlock}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>솔로플레이</span>
            <div className={styles.sectionLine} />
          </div>
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
                    if (!cache[game.key]?.[lv]) fetchLevel(game, lv);
                  }}
                  disabled={isDisabled}
                />
              );
            })}
          </div>
        </div>
        )}

        {/* 멀티플레이 섹션 */}
        {(activeTab === '전체' || activeTab === '멀티') && (
        <div className={styles.sectionBlock}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>멀티플레이</span>
            <div className={styles.sectionLine} />
          </div>
          <div className={styles.grid}>
            {MULTI_GAMES.map((game) => (
              <MultiGameCard key={game.to} game={game} />
            ))}
          </div>
        </div>
        )}

        {/* 기타 섹션 */}
        {(activeTab === '전체' || activeTab === '기타') && (
        <div className={styles.sectionBlock}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>기타</span>
            <div className={styles.sectionLine} />
          </div>
          <div className={styles.grid}>
            {/* 미니게임 도구 카드 */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.icon}>🎮</span>
                <div className={styles.title}>
                  <div className={styles.nameKo}>미니게임</div>
                </div>
              </div>
              <div className={styles.cardRanking}>
                <a
                  href="https://mini.dobakggun.kr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${styles.btn} ${styles.btnNormal}`}
                  style={{ width: '100%', textAlign: 'center', minHeight: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px' }}
                >
                  <span>🎡</span><span style={{ fontWeight: 'bold' }}>룰렛</span>
                </a>
                <hr className={styles.labDivider} />
                <a
                  href="https://mini.dobakggun.kr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${styles.btn} ${styles.btnNormal}`}
                  style={{ width: '100%', textAlign: 'center', minHeight: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px' }}
                >
                  <span>🎲</span><span style={{ fontWeight: 'bold' }}>주사위</span>
                </a>
                <hr className={styles.labDivider} />
                <a
                  href="https://mini.dobakggun.kr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${styles.btn} ${styles.btnNormal}`}
                  style={{ width: '100%', textAlign: 'center', minHeight: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px' }}
                >
                  <span>🪜</span><span style={{ fontWeight: 'bold' }}>사다리 타기</span>
                </a>
              </div>
            </div>

            {/* Test Lab 카드 */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.icon}>🧪</span>
                <div className={styles.title}>
                  <div className={styles.nameKo}>Test Lab</div>
                </div>
              </div>
              <div className={styles.cardRanking}>
                {user && (
                  <>
                    <Link
                      to="/dbgchat"
                      className={`${styles.btn} ${styles.btnNormal}`}
                      style={{ width: '100%', textAlign: 'center', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      💬 실시간 채팅 랩
                    </Link>
                    <hr className={styles.labDivider} />
                  </>
                )}
                <Link
                  to="/brickbreaker"
                  className={`${styles.btn} ${styles.btnNormal}`}
                  style={{ width: '100%', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '0 10px' }}
                >
                  <span style={{ fontSize: '1.15em', flexShrink: 0 }}>🧱</span>
                  <span style={{ flex: 1, fontSize: '0.87em', fontWeight: 'bold', color: 'inherit' }}>벽돌깨기</span>
                  <span style={{ display: 'inline-block', background: '#F59E0B', color: '#FFFFFF', fontSize: '0.65em', fontWeight: 700, padding: '1px 6px', borderRadius: '10px', letterSpacing: '0.05em' }}>
                    BETA
                  </span>
                </Link>
              </div>
            </div>
          </div>
        </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
