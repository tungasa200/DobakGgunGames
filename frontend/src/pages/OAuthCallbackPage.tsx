import { useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { userApi } from '../api/user';
import s from './auth.module.css';

// 백엔드 OAuth2SuccessHandler가 리다이렉트하는 경로:
// /oauth/callback?accessToken=...&refreshToken=...
export default function OAuthCallbackPage() {
  const [params] = useSearchParams();
  const { setAuth } = useAuth();
  const navigate = useNavigate();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');

    if (!accessToken || !refreshToken) {
      navigate('/login?error=oauth', { replace: true });
      return;
    }

    userApi.getProfile(accessToken)
      .then(profile => {
        setAuth(
          { id: profile.id, nickname: profile.nickname, profileImage: profile.profileImage },
          accessToken,
          refreshToken,
        );
        navigate('/', { replace: true });
      })
      .catch(() => navigate('/login?error=oauth', { replace: true }));
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={s.page}>
      <div className={s.card} style={{ textAlign: 'center' }}>
        <div className={s.logo}>⏳</div>
        <h1 className={s.title}>로그인 처리 중</h1>
        <p className={s.subtitle}>잠시만 기다려 주세요...</p>
      </div>
    </div>
  );
}
