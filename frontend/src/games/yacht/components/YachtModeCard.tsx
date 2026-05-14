import { useState } from 'react';
import styles from './yacht.module.css';
import type { DiceType } from '../types/yacht.types';
import YachtModeDicePreview3D from './dice/YachtModeDicePreview3D';

interface YachtModeCardProps {
  diceType: DiceType;
  onSelect: (diceType: DiceType) => Promise<void>;
  activeRooms: number | null;
}

const MODE_INFO: Record<DiceType, {
  title: string;
  bonusThreshold: number;
  scoreCount: number;
  roundMultiplier: number;
  ariaLabel: string;
}> = {
  D6: {
    title: '정육면체 (D6)',
    bonusThreshold: 63,
    scoreCount: 12,
    roundMultiplier: 12,
    ariaLabel: 'D6 정육면체 모드 선택, 12 족보, 보너스 63점',
  },
  D8: {
    title: '정팔면체 (D8)',
    bonusThreshold: 84,
    scoreCount: 14,
    roundMultiplier: 14,
    ariaLabel: 'D8 정팔면체 모드 선택, 14 족보, 보너스 84점',
  },
};

export default function YachtModeCard({
  diceType,
  onSelect,
  activeRooms,
}: YachtModeCardProps) {
  const [loading, setLoading] = useState(false);
  const info = MODE_INFO[diceType];
  const isD8 = diceType === 'D8';

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
      className={`${styles.modeCard} ${isD8 ? styles.modeCardD8 : styles.modeCardD6} ${isD8 ? styles.modeCardDisabled : ''}`}
      role={isD8 ? undefined : 'button'}
      tabIndex={isD8 ? -1 : 0}
      aria-label={isD8 ? `${info.title} — 준비중` : info.ariaLabel}
      aria-disabled={isD8 ? true : undefined}
      onClick={isD8 ? undefined : () => void handleClick()}
      onKeyDown={isD8 ? undefined : handleKeyDown}
    >
      {isD8 && <span className={styles.modeCardComingSoon}>준비중</span>}

      {/* 3D 주사위 프리뷰 */}
      <div className={styles.modeCardDicePreview} aria-hidden="true">
        <YachtModeDicePreview3D diceType={diceType} size={80} />
      </div>

      {/* 모드명 */}
      <p className={`${styles.modeCardTitle} ${isD8 ? styles.modeCardTitleD8 : styles.modeCardTitleD6}`}>
        {info.title}
      </p>

      {/* 활성 방 통계 */}
      <p className={styles.modeCardStats}>
        {isD8
          ? '정팔면체 봇 모드 준비 중'
          : `현재 대기 중: ${activeRooms !== null ? `${activeRooms}개 방` : '—'}`}
      </p>

      {/* CTA 버튼 */}
      <button
        type="button"
        className={`${styles.modeCardCta} ${isD8 ? styles.modeCardCtaD8 : ''}`}
        onClick={(e) => { e.stopPropagation(); void handleClick(); }}
        disabled={loading || isD8}
        aria-busy={loading}
        aria-label={isD8 ? '준비중' : `${diceType}로 매칭 시작`}
      >
        {isD8 ? '준비중' : loading ? '매칭 중...' : `${diceType}로 매칭 시작`}
      </button>
    </div>
  );
}
