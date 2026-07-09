import { Link } from 'react-router-dom';
import Logo from '../common/Logo';
import styles from './Footer.module.css';

const LINKS = [
  { to: '/patch-notes', label: '패치노트' },
  { to: '/terms', label: '이용약관' },
  { to: '/privacy', label: '개인정보 처리방침' },
  { to: '/contact', label: '문의 / 피드백' },
];

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.top}>
          <Logo to="/" size="sm" variant="dark" />
          <nav className={styles.links} aria-label="정책 및 안내">
            {LINKS.map((l, i) => (
              <span key={l.to} className={styles.linkGroup}>
                <Link to={l.to} className={styles.link}>{l.label}</Link>
                {i < LINKS.length - 1 && <span className={styles.divider} aria-hidden="true">·</span>}
              </span>
            ))}
          </nav>
        </div>
        <div className={styles.rule} aria-hidden="true" />
        <div className={styles.bottom}>
          <p className={styles.copy}>© {new Date().getFullYear()} DobakGgun. All rights reserved.</p>
          <p className={styles.notice}>
            랭킹 등록 시 어뷰징 방지를 위해 IP 주소를 수집·저장합니다.
          </p>
        </div>
      </div>
    </footer>
  );
}
