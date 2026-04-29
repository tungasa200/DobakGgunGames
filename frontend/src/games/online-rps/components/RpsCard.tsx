import styles from './RpsCard.module.css';
import type { RpsChoice, RpsResult } from '../types/rps.types';

export type RpsCardState =
  | 'idle'
  | 'selected'
  | 'unselected'
  | 'revealed'
  | 'auto'
  | 'disabled';

interface RpsCardProps {
  choice: RpsChoice;
  state: RpsCardState;
  onClick?: () => void;
  ownerLabel?: string;
  autoLabel?: boolean;
  result?: RpsResult;
  showHint?: boolean;
  shake?: boolean;
  revealDelay?: number;
}

const CHOICE_LABEL: Record<RpsChoice, string> = {
  ROCK: '바위',
  PAPER: '보',
  SCISSORS: '가위',
};

const CHOICE_HINT: Record<RpsChoice, string> = {
  ROCK: '[R]',
  PAPER: '[P]',
  SCISSORS: '[S]',
};

const CHOICE_IMAGE: Record<RpsChoice, string> = {
  ROCK: '/games/rcp/rock.png',
  PAPER: '/games/rcp/paper.png',
  SCISSORS: '/games/rcp/scissors.png',
};

const CHOICE_ALT: Record<RpsChoice, string> = {
  ROCK: '바위',
  PAPER: '보',
  SCISSORS: '가위',
};

export default function RpsCard({
  choice,
  state,
  onClick,
  ownerLabel,
  autoLabel,
  result,
  showHint = false,
  shake = false,
}: RpsCardProps) {
  const isClickable = state === 'idle' && onClick;

  // CSS 클래스 조합
  const classNames = [
    styles.card,
    styles[state],
    state === 'revealed' && result ? styles[`revealed${result.charAt(0) + result.slice(1).toLowerCase()}`] : '',
    shake ? styles.shake : '',
  ]
    .filter(Boolean)
    .join(' ');

  // ARIA 속성
  const ariaLabel =
    state === 'idle' || state === 'selected'
      ? `${CHOICE_LABEL[choice]} 선택`
      : CHOICE_LABEL[choice];

  const role = state === 'revealed' || state === 'auto' ? 'img' : 'button';

  return (
    <div
      className={classNames}
      onClick={isClickable ? onClick : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      role={role}
      aria-label={ariaLabel}
      aria-pressed={state === 'selected' ? true : state === 'idle' ? false : undefined}
      aria-disabled={state === 'disabled' || state === 'unselected' ? true : undefined}
      tabIndex={isClickable ? 0 : -1}
    >
      {/* 자동선택 뱃지 */}
      {(state === 'auto' || autoLabel) && (
        <span className={styles.autoBadge}>자동선택</span>
      )}

      {/* 참가자 이름 (결과 화면) */}
      {ownerLabel && (
        <span className={styles.ownerLabel}>{ownerLabel}</span>
      )}

      {/* 카드 이미지 (전체 채우기) */}
      <img
        src={CHOICE_IMAGE[choice]}
        alt={CHOICE_ALT[choice]}
        className={styles.image}
        draggable={false}
      />

      {/* 단축키 힌트 (게임 화면 idle에서만) */}
      {showHint && state === 'idle' && (
        <span className={styles.hint}>{CHOICE_HINT[choice]}</span>
      )}
    </div>
  );
}
