import styles from './yacht.module.css';
import type { DiceType } from '../types/yacht.types';

interface YachtModeBadgeProps {
  diceType: DiceType;
}

export default function YachtModeBadge({ diceType }: YachtModeBadgeProps) {
  const isD8 = diceType === 'D8';
  return (
    <span
      className={`${styles.modeBadge} ${isD8 ? styles.modeBadgeD8 : styles.modeBadgeD6}`}
      aria-label={isD8 ? '현재 모드: D8 정팔면체' : '현재 모드: D6 정육면체'}
      role="status"
      aria-live="off"
    >
      {diceType}
    </span>
  );
}
