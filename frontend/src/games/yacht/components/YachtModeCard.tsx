import { useState } from 'react';
import styles from './yacht.module.css';
import type { DiceType, YachtRankingEntry } from '../types/yacht.types';

interface YachtModeCardProps {
  diceType: DiceType;
  onSelect: (diceType: DiceType) => Promise<void>;
  rankings: YachtRankingEntry[];
  activeRooms: number | null;
  isMobile?: boolean;
}

const MODE_INFO: Record<DiceType, {
  title: string;
  description: string;
  bonusThreshold: number;
  scoreCount: number;
  roundMultiplier: number;
  icon: string;
  ariaLabel: string;
}> = {
  D6: {
    title: '정육면체 (D6)',
    description: '12 족보 · 보너스 기준 63점 · 라운드 × 12',
    bonusThreshold: 63,
    scoreCount: 12,
    roundMultiplier: 12,
    icon: '⚀',
    ariaLabel: 'D6 정육면체 모드 선택, 12 족보, 보너스 63점',
  },
  D8: {
    title: '정팔면체 (D8)',
    description: '14 족보 · 보너스 기준 84점 · 라운드 × 14',
    bonusThreshold: 84,
    scoreCount: 14,
    roundMultiplier: 14,
    icon: '🎲',
    ariaLabel: 'D8 정팔면체 모드 선택, 14 족보, 보너스 84점',
  },
};

const MAX_RANK_DESKTOP = 5;
const MAX_RANK_MOBILE = 3;

export default function YachtModeCard({
  diceType,
  onSelect,
  rankings,
  activeRooms,
  isMobile = false,
}: YachtModeCardProps) {
  const [loading, setLoading] = useState(false);
  const info = MODE_INFO[diceType];
  const isD8 = diceType === 'D8';

  const maxRank = isMobile ? MAX_RANK_MOBILE : MAX_RANK_DESKTOP;
  const displayRankings = rankings.slice(0, maxRank);

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onSelect(diceType);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      void handleClick();
    }
  };

  return (
    <div
      className={`${styles.modeCard} ${isD8 ? styles.modeCardD8 : styles.modeCardD6}`}
      role="button"
      tabIndex={0}
      aria-label={info.ariaLabel}
      onClick={() => void handleClick()}
      onKeyDown={handleKeyDown}
    >
      {/* 아이콘 */}
      <div className={styles.modeCardIcon} aria-hidden="true">
        {info.icon}
      </div>

      {/* 모드명 */}
      <p className={`${styles.modeCardTitle} ${isD8 ? styles.modeCardTitleD8 : styles.modeCardTitleD6}`}>
        {info.title}
      </p>

      {/* 설명 */}
      <p className={styles.modeCardMeta}>
        {info.description}
      </p>

      {/* 활성 방 통계 */}
      <p className={styles.modeCardStats}>
        현재 대기 중:{' '}
        {activeRooms !== null ? `${activeRooms}개 방` : '—'}
      </p>

      {/* 랭킹 미리보기 */}
      <div
        className={styles.modeCardRanking}
        aria-label={`${diceType} TOP 랭킹 미리보기`}
        role="list"
      >
        {displayRankings.length > 0 ? (
          displayRankings.map((entry) => (
            <div key={entry.userId} className={styles.modeCardRankRow} role="listitem">
              <span
                className={`${styles.modeCardRankNum} ${entry.rank === 1 ? styles.modeCardRankFirst : ''}`}
              >
                {entry.rank}
              </span>
              <span className={styles.modeCardRankNickname}>{entry.nickname}</span>
              <span className={styles.modeCardRankScore}>{entry.totalScore.toLocaleString()}점</span>
            </div>
          ))
        ) : (
          <p className={styles.modeCardRankEmpty}>랭킹 없음</p>
        )}
      </div>

      {/* CTA 버튼 */}
      <button
        type="button"
        className={`${styles.modeCardCta} ${isD8 ? styles.modeCardCtaD8 : ''}`}
        onClick={(e) => { e.stopPropagation(); void handleClick(); }}
        disabled={loading}
        aria-busy={loading}
        aria-label={`${diceType}로 매칭 시작`}
      >
        {loading ? '매칭 중...' : `${diceType}로 매칭 시작`}
      </button>
    </div>
  );
}
