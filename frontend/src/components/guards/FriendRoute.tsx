import { type ReactNode } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import NormalHeader from '../normal/NormalHeader';
import Footer from '../normal/Footer';
import styles from './FriendRoute.module.css';

function AccessDeniedPage() {
  return (
    <div className={styles.accessDeniedPage}>
      <NormalHeader />
      <main className={styles.accessDeniedMain}>
        <span className={styles.lockIcon}>🔒</span>
        <h1 className={styles.accessDeniedTitle}>접근 권한이 없습니다</h1>
        <p className={styles.accessDeniedDesc}>이 기능은 특별 등급 이상만 이용할 수 있습니다.</p>
        <p className={styles.accessDeniedDesc}>공개 채팅 기능은 준비 중입니다.</p>
        <Link to="/" className={styles.homeBtn}>홈으로 돌아가기</Link>
      </main>
      <Footer />
    </div>
  );
}

export default function FriendRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!['FRIEND', 'ADMIN'].includes(user.role)) return <AccessDeniedPage />;
  return <>{children}</>;
}
