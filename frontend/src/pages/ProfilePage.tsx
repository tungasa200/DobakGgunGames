import { useState, useEffect, useRef } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { userApi } from '../api/user';
import { authApi } from '../api/auth';
import type { UserProfile } from '../api/user';
import s from './auth.module.css';
import ps from './ProfilePage.module.css';

export default function ProfilePage() {
  const { accessToken, logout } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [nickname, setNickname] = useState('');
  const [nicknameChecked, setNicknameChecked] = useState<'idle' | 'checking' | 'ok' | 'taken'>('idle');
  const [nicknameCheckError, setNicknameCheckError] = useState('');
  const [nicknameMsg, setNicknameMsg] = useState('');
  const [nicknameError, setNicknameError] = useState('');
  const [nicknameLoading, setNicknameLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageMsg, setImageMsg] = useState('');
  const [imageError, setImageError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!accessToken) { navigate('/login', { replace: true }); return; }
    userApi.getProfile(accessToken)
      .then(p => { setProfile(p); setNickname(p.nickname); })
      .catch(() => navigate('/login', { replace: true }));
  }, [accessToken, navigate]);

  function handleNicknameChange(v: string) {
    setNickname(v);
    setNicknameChecked('idle');
    setNicknameCheckError('');
    setNicknameMsg('');
    setNicknameError('');
  }

  async function handleCheckNickname() {
    if (!nickname || nickname.length < 2) {
      setNicknameCheckError('닉네임을 2자 이상 입력해 주세요');
      return;
    }
    if (!/^[가-힣a-zA-Z0-9_]+$/.test(nickname)) {
      setNicknameCheckError('한글, 영문, 숫자, 밑줄만 사용 가능합니다');
      return;
    }
    setNicknameCheckError('');
    setNicknameChecked('checking');
    try {
      const { taken } = await authApi.checkNickname(nickname);
      setNicknameChecked(taken ? 'taken' : 'ok');
    } catch {
      setNicknameChecked('idle');
      setNicknameCheckError('중복 확인 중 오류가 발생했습니다');
    }
  }

  async function handleNickname(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || !profile) return;
    // 본인 닉네임 그대로면 중복확인 없이 통과
    if (nickname !== profile.nickname && nicknameChecked !== 'ok') {
      setNicknameError('닉네임 중복 확인을 완료해 주세요');
      return;
    }
    setNicknameError(''); setNicknameMsg('');
    setNicknameLoading(true);
    try {
      const updated = await userApi.updateNickname(accessToken, nickname);
      setProfile(updated);
      setNicknameChecked('idle');
      setNicknameMsg('닉네임이 변경되었습니다');
    } catch (err: unknown) {
      setNicknameError(err instanceof Error ? err.message : '변경 실패');
    } finally {
      setNicknameLoading(false);
    }
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !accessToken) return;
    setImageError(''); setImageMsg('');
    setImageLoading(true);
    try {
      const updated = await userApi.uploadProfileImage(accessToken, file);
      setProfile(updated);
      setImageMsg('프로필 사진이 변경되었습니다');
    } catch (err: unknown) {
      setImageError(err instanceof Error ? err.message : '업로드 실패');
    } finally {
      setImageLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleDeleteImage() {
    if (!accessToken || !profile?.profileImage) return;
    setImageError(''); setImageMsg('');
    setImageLoading(true);
    try {
      const updated = await userApi.deleteProfileImage(accessToken);
      setProfile(updated);
      setImageMsg('프로필 사진이 삭제되었습니다');
    } catch (err: unknown) {
      setImageError(err instanceof Error ? err.message : '삭제 실패');
    } finally {
      setImageLoading(false);
    }
  }

  async function handleLogout() {
    await logout();
    navigate('/', { replace: true });
  }

  if (!profile) {
    return (
      <div className={s.page}>
        <div className={ps.loading}>불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className={s.page}>
      <div className={ps.card}>
        <div className={ps.header}>
          <div className={ps.avatarWrap} onClick={() => fileRef.current?.click()}>
            {profile.profileImage
              ? <img className={ps.avatar} src={profile.profileImage} alt="프로필" />
              : <div className={ps.avatarDefault}>{profile.nickname[0]}</div>
            }
            <div className={ps.avatarOverlay}>📷</div>
            {imageLoading && <div className={ps.avatarSpinner} />}
          </div>
          <div className={ps.headerInfo}>
            <div className={ps.name}>{profile.nickname}</div>
            <div className={ps.email}>{profile.email}</div>
            <div className={ps.badge}>{profile.provider === 'LOCAL' || !profile.provider ? '이메일 계정' : `${profile.provider} 연동`}</div>
          </div>
        </div>

        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageChange} />

        {imageMsg && <div className={s.success}>{imageMsg}</div>}
        {imageError && <div className={s.error}>{imageError}</div>}

        {profile.profileImage && (
          <button className={ps.deleteImageBtn} onClick={handleDeleteImage} disabled={imageLoading}>
            프로필 사진 삭제
          </button>
        )}

        <hr className={ps.divider} />

        <form className={s.form} onSubmit={handleNickname}>
          <div className={s.field}>
            <label className={s.label}>닉네임 변경</label>
            <div className={ps.inlineRow}>
              <input
                className={`${s.input} ${ps.inputFlex}`}
                type="text"
                value={nickname}
                onChange={e => handleNicknameChange(e.target.value)}
                maxLength={12}
                required
              />
              <button
                type="button"
                className={`${ps.checkBtn} ${nicknameChecked === 'ok' ? ps.checkBtnOk : ''}`}
                onClick={handleCheckNickname}
                disabled={
                  nicknameChecked === 'checking' ||
                  nicknameChecked === 'ok' ||
                  nickname === profile.nickname
                }
              >
                {nicknameChecked === 'checking' ? '확인 중' : nicknameChecked === 'ok' ? '사용 가능 ✓' : '중복 확인'}
              </button>
            </div>
            {nicknameCheckError && <span className={ps.fieldError}>{nicknameCheckError}</span>}
            {!nicknameCheckError && nicknameChecked === 'taken' && (
              <span className={ps.fieldError}>이미 사용 중인 닉네임입니다</span>
            )}
            {!nicknameCheckError && nicknameChecked === 'ok' && (
              <span className={ps.fieldOk}>사용 가능한 닉네임입니다</span>
            )}
            {nickname === profile.nickname && (
              <span className={s.hint}>2~12자, 한글/영문/숫자/_</span>
            )}
          </div>
          {nicknameMsg && <div className={s.success}>{nicknameMsg}</div>}
          {nicknameError && <div className={s.error}>{nicknameError}</div>}
          <button
            className={s.btn}
            type="submit"
            disabled={
              nicknameLoading ||
              !nickname ||
              (nickname !== profile.nickname && nicknameChecked !== 'ok')
            }
          >
            {nicknameLoading ? '변경 중...' : '닉네임 변경'}
          </button>
        </form>

        <hr className={ps.divider} />

        <div className={ps.bottomLinks}>
          <Link className={s.link} to="/">홈으로</Link>
          <button className={ps.logoutBtn} onClick={handleLogout}>로그아웃</button>
        </div>
      </div>
    </div>
  );
}
