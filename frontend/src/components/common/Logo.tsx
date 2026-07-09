import { Link } from 'react-router-dom';
import styles from './Logo.module.css';

interface Props {
  size?: 'sm' | 'md' | 'lg';
  to?: string | null;
  variant?: 'dark' | 'light';
  showWordmark?: boolean;
  className?: string;
}

/** 공용 UI 전용 브랜드 마크 — 게임패드 실루엣 + Gugi 워드마크. 게임 내부 화면에서는 사용하지 않음. */
export default function Logo({ size = 'md', to = '/', variant = 'dark', showWordmark = true, className = '' }: Props) {
  const content = (
    <span className={`${styles.mark} ${styles[size]} ${styles[variant]} ${className}`}>
      <svg className={styles.chip} viewBox="0 0 48 32" aria-hidden="true">
        {/* 그립 — 좌우로 둥글게 벌어지는 컨트롤러 손잡이 */}
        <ellipse cx="10.5" cy="19" rx="9.5" ry="10.5" className={styles.padBase} />
        <ellipse cx="37.5" cy="19" rx="9.5" ry="10.5" className={styles.padBase} />
        {/* 브릿지 — 두 그립을 잇는 상단 바 */}
        <rect x="9" y="4.5" width="30" height="15" rx="7.5" className={styles.padBase} />
        {/* 방향키 (D패드) */}
        <rect x="7.7" y="14" width="4.2" height="11" rx="1.2" className={styles.padCross} />
        <rect x="4.4" y="17.3" width="10.8" height="4.2" rx="1.2" className={styles.padCross} />
        {/* 버튼 */}
        <circle cx="39.5" cy="14.5" r="3.1" className={styles.padPip} />
        <circle cx="33.5" cy="21.5" r="2.1" className={styles.padPipMini} />
      </svg>
      {showWordmark && <span className={styles.wordmark}>DobakGgun</span>}
    </span>
  );

  if (!to) return content;
  return (
    <Link to={to} className={styles.link} aria-label="도박꾼게임즈 홈으로 이동">
      {content}
    </Link>
  );
}
