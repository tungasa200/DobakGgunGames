import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NormalHeader from '../components/normal/NormalHeader';
import Footer from '../components/normal/Footer';
import s from './auth.module.css';

const BACKEND = import.meta.env.VITE_API_URL ?? '';

function isInAppBrowser(): boolean {
  const ua = navigator.userAgent;
  if (/KAKAOTALK/i.test(ua)) return true;
  if (/Instagram/i.test(ua)) return true;
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return true;
  if (/Line\//i.test(ua)) return true;
  if (/NAVER/i.test(ua)) return true;
  if (/Android/i.test(ua) && /wv\)/i.test(ua)) return true;
  if (/iPhone|iPad/i.test(ua) && !/Safari/i.test(ua)) return true;
  return false;
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showInAppWarning, setShowInAppWarning] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다');
    } finally {
      setLoading(false);
    }
  }

  const oauthUrl = `${BACKEND}/oauth2/authorization/google`;
  const isAndroid = /Android/i.test(navigator.userAgent);

  function handleGoogleLogin(e: React.MouseEvent<HTMLAnchorElement>) {
    if (isInAppBrowser()) {
      e.preventDefault();
      setShowInAppWarning(true);
    }
  }

  function openInChrome() {
    const intentUrl = `intent://${oauthUrl.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
    window.location.href = intentUrl;
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(oauthUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('아래 링크를 복사하세요:', oauthUrl);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'auto', background: '#f0f0f0', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column' }}>
      <NormalHeader accentColor="#2c3e50" />
      <div className={s.page}>
        <div className={s.card}>
          <div className={s.logo}>🎮</div>
          <h1 className={s.title}>로그인</h1>
          <p className={s.subtitle}>도박꾼게임즈에 오신 걸 환영합니다</p>

          {error && <div className={s.error}>{error}</div>}

          <form className={s.form} onSubmit={handleSubmit}>
            <div className={s.field}>
              <label className={s.label}>이메일</label>
              <input
                className={s.input}
                type="email"
                placeholder="example@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className={s.field}>
              <label className={s.label}>비밀번호</label>
              <input
                className={s.input}
                type="password"
                placeholder="비밀번호를 입력하세요"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            <button className={s.btn} type="submit" disabled={loading}>
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <div className={s.divider}>또는</div>

          <a
            className={s.googleBtn}
            href={oauthUrl}
            onClick={handleGoogleLogin}
          >
            <svg className={s.googleIcon} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google로 계속하기
          </a>

          <div className={s.links}>
            <span>계정이 없으신가요? <Link className={s.link} to="/signup">회원가입</Link></span>
            <Link className={s.link} to="/password-reset">비밀번호 찾기</Link>
          </div>
        </div>
      </div>
      <Footer />

      {showInAppWarning && (
        <div className={s.inAppOverlay} onClick={() => setShowInAppWarning(false)}>
          <div className={s.inAppModal} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
            <h3 className={s.inAppTitle}>구글 로그인 불가</h3>
            <p className={s.inAppDesc}>
              카카오톡·인스타그램 등 인앱 브라우저에서는<br />
              구글 로그인이 지원되지 않습니다.<br />
              {isAndroid ? 'Chrome' : 'Safari'}에서 접속해 주세요.
            </p>
            <div className={s.inAppBtns}>
              {isAndroid && (
                <button className={s.btn} onClick={openInChrome}>
                  Chrome으로 열기
                </button>
              )}
              <button className={s.btnSecondary} onClick={copyLink}>
                {copied ? '복사됨!' : '링크 복사'}
              </button>
              <button className={s.btnSecondary} onClick={() => setShowInAppWarning(false)}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
