import { Link } from 'react-router-dom';
import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.links}>
          <Link to="/terms" className={styles.link}>이용약관</Link>
          <span className={styles.divider}>|</span>
          <Link to="/privacy" className={styles.link}>개인정보 처리방침</Link>
          <span className={styles.divider}>|</span>
          <Link to="/contact" className={styles.link}>문의 / 피드백</Link>
        </div>
        <p className={styles.copy}>
          © {new Date().getFullYear()} DobakGgun. All rights reserved.
        </p>
        <p className={styles.notice}>
          본 서비스는 랭킹 등록 시 어뷰징 방지를 위해 IP 주소를 수집·저장합니다.
        </p>
      </div>
    </footer>
  );
}
