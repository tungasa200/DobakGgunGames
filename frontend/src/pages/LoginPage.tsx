import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NormalHeader from '../components/normal/NormalHeader';
import Footer from '../components/normal/Footer';
import s from './auth.module.css';

const BACKEND = import.meta.env.VITE_API_URL ?? '';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
            href={`${BACKEND}/oauth2/authorization/google`}
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
    </div>
  );
}
