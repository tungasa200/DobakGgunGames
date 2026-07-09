import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authApi } from '../api/auth';
import NormalHeader from '../components/normal/NormalHeader';
import Footer from '../components/normal/Footer';
import s from './auth.module.css';

export default function EmailVerifyPage() {
  const [params] = useSearchParams();
  const token = params.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    if (!token) {
      setStatus('error');
      setMessage('유효하지 않은 인증 링크입니다');
      return;
    }

    authApi.verifyEmail(token)
      .then(() => {
        setStatus('success');
        setMessage('이메일 인증이 완료되었습니다! 이제 로그인할 수 있습니다.');
      })
      .catch((err: unknown) => {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : '인증에 실패했습니다');
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'auto', background: 'var(--dbg-surface)', fontFamily: 'var(--dbg-font-body)', display: 'flex', flexDirection: 'column' }}>
      <NormalHeader accentColor="#101f38" />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', minHeight: 'max-content' }}>
        <div className={s.card} style={{ textAlign: 'center' }}>
          {status === 'loading' && (
            <>
              <div className={s.logo}>⏳</div>
              <h1 className={s.title}>인증 확인 중</h1>
              <p className={s.subtitle}>잠시만 기다려 주세요...</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className={s.logo}>✅</div>
              <h1 className={s.title}>인증 완료</h1>
              <p className={s.subtitle}>도박꾼게임즈에 오신 걸 환영합니다!</p>
              <div className={s.success}>{message}</div>
              <div className={s.links} style={{ marginTop: 24 }}>
                <Link className={s.btn} to="/login" style={{ textDecoration: 'none', textAlign: 'center' }}>
                  로그인하러 가기
                </Link>
              </div>
            </>
          )}

          {status === 'error' && (
            <>
              <div className={s.logo}>❌</div>
              <h1 className={s.title}>인증 실패</h1>
              <div className={s.error}>{message}</div>
              <p className={s.subtitle} style={{ marginTop: 12 }}>
                링크가 만료되었거나 이미 사용된 링크입니다.
              </p>
              <div className={s.links} style={{ marginTop: 24, flexDirection: 'column', gap: 12 }}>
                <Link className={s.link} to="/signup">다시 회원가입</Link>
                <Link className={s.link} to="/login">로그인</Link>
              </div>
            </>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
