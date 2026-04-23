import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NormalHeader from './normal/NormalHeader';
import Footer from './normal/Footer';

export default function FriendRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'FRIEND' && user.role !== 'ADMIN') {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
        <NormalHeader />
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: '48px 16px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, color: '#94a3b8', lineHeight: 1 }}>🔒</div>
          <p style={{ fontSize: 16, color: '#475569', margin: 0, lineHeight: 1.6 }}>
            이 게시판은 도박군(FRIEND) 이상만<br />이용할 수 있습니다.
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <a
              href="/"
              style={{
                background: '#2c3e50', color: 'white', borderRadius: 8,
                padding: '10px 24px', textDecoration: 'none', fontSize: 14, fontWeight: 600,
              }}
            >홈으로</a>
            <a
              href="/profile"
              style={{
                background: 'white', border: '1px solid #e2e8f0', color: '#475569',
                borderRadius: 8, padding: '10px 24px', textDecoration: 'none', fontSize: 14,
              }}
            >내 프로필</a>
          </div>
        </div>
        <Footer />
      </div>
    );
  }
  return <>{children}</>;
}
