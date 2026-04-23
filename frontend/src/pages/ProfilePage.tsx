import { useState, useEffect, useRef, useCallback } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { userApi } from '../api/user';
import { authApi } from '../api/auth';
import { getMyContacts } from '../api/contact';
import type { UserProfile } from '../api/user';
import type { MyContact } from '../api/contact';
import NormalHeader from '../components/normal/NormalHeader';
import Footer from '../components/normal/Footer';
import s from './auth.module.css';
import ps from './ProfilePage.module.css';

const STATUS_LABEL: Record<string, string> = { UNREAD: '미확인', READ: '확인됨', REPLIED: '답변완료' };
const ROLE_LABEL: Record<string, string> = { USER: '일반', FRIEND: '도박꾼', ADMIN: '관리자' };
const ROLE_BADGE_CLASS: Record<string, string> = { USER: ps.roleBadgeUser, FRIEND: ps.roleBadgeFriend, ADMIN: ps.roleBadgeAdmin };
const STATUS_COLOR: Record<string, string> = {
  UNREAD: '#9ca3af', READ: '#3b82f6', REPLIED: '#10b981',
};

export default function ProfilePage() {
  const { accessToken, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'info' | 'contacts'>('info');

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

  const [contacts, setContacts] = useState<MyContact[]>([]);
  const [contactsPage, setContactsPage] = useState(0);
  const [contactsHasNext, setContactsHasNext] = useState(false);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    if (!accessToken) { navigate('/login', { replace: true }); return; }
    userApi.getProfile(accessToken)
      .then(p => { setProfile(p); setNickname(p.nickname); })
      .catch(() => navigate('/login', { replace: true }));
  }, [accessToken, navigate]);

  const loadContacts = useCallback(async (page: number) => {
    if (!accessToken) return;
    setContactsLoading(true);
    try {
      const res = await getMyContacts(accessToken, page);
      setContacts(prev => page === 0 ? res.content : [...prev, ...res.content]);
      setContactsHasNext(res.hasNext);
      setContactsPage(page);
    } catch { /* ignore */ }
    finally { setContactsLoading(false); }
  }, [accessToken]);

  useEffect(() => {
    loadContacts(0);
  }, [loadContacts]);

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

  const outerStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, overflow: 'auto',
    background: '#f8fafc', fontFamily: 'sans-serif',
    display: 'flex', flexDirection: 'column',
  };

  if (!profile) {
    return (
      <div style={outerStyle}>
        <NormalHeader accentColor="#2c3e50" />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
          <div className={ps.loading}>불러오는 중...</div>
        </div>
        <Footer />
      </div>
    );
  }

  /* 문의 내역 패널 */
  const contactsPanel = (
    <>
      {contactsLoading && contacts.length === 0
        ? <div style={{ color: '#94a3b8', textAlign: 'center', padding: 32, fontSize: 14 }}>불러오는 중...</div>
        : contacts.length === 0
        ? <div style={{ color: '#94a3b8', textAlign: 'center', padding: 40, fontSize: 14 }}>문의 내역이 없습니다</div>
        : contacts.map(c => (
          <div key={c.id} className={ps.contactItem}>
            <div
              className={ps.contactHeader}
              onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
            >
              <div className={ps.contactTitle}>
                <span className={ps.contactCategory}>[{c.category}]</span>
                <span className={ps.contactSubject}>{c.subject}</span>
              </div>
              <div className={ps.contactMeta}>
                <span style={{ fontSize: 12, color: STATUS_COLOR[c.status], fontWeight: 600 }}>{STATUS_LABEL[c.status]}</span>
                <span className={ps.contactDate}>{c.createdAt?.slice(0, 10)}</span>
                <span className={ps.contactChevron}>{expandedId === c.id ? '▲' : '▼'}</span>
              </div>
            </div>
            {expandedId === c.id && (
              <div className={ps.contactBody}>
                <div className={ps.contactText}>{c.body}</div>
                {c.reply && (
                  <div className={ps.contactReply}>
                    <div className={ps.contactReplyLabel}>운영자 답변</div>
                    <div className={ps.contactReplyText}>{c.reply}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))
      }
      {contactsHasNext && (
        <button className={ps.moreBtn} onClick={() => loadContacts(contactsPage + 1)} disabled={contactsLoading}>
          {contactsLoading ? '불러오는 중...' : '더 보기'}
        </button>
      )}
    </>
  );

  return (
    <div style={outerStyle}>
      <NormalHeader accentColor="#2c3e50" />

      <div className={ps.pageBody}>
        {/* 모바일 탭 */}
        <div className={ps.mobileTabs}>
          {(['info', 'contacts'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`${ps.mobileTab} ${activeTab === tab ? ps.mobileTabActive : ''}`}
            >
              {tab === 'info' ? '내 정보' : '문의 내역'}
            </button>
          ))}
        </div>

        {/* 데스크톱: 두 컬럼 / 모바일: 탭 기반 */}
        <div className={ps.contentGrid}>
          {/* 왼쪽: 내 정보 */}
          <div className={`${ps.infoPanel} ${activeTab !== 'info' ? ps.mobileHide : ''}`}>
            <div className={ps.card}>
              <div className={ps.panelTitle}>내 정보</div>

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
                  <div className={ps.badgeRow}>
                    <span className={ps.badge}>{profile.provider === 'LOCAL' || !profile.provider ? '이메일 계정' : `${profile.provider} 연동`}</span>
                    <span className={`${ps.roleBadge} ${ROLE_BADGE_CLASS[profile.role] ?? ps.roleBadgeUser}`}>{ROLE_LABEL[profile.role] ?? profile.role}</span>
                  </div>
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

          {/* 오른쪽: 문의 내역 */}
          <div className={`${ps.contactsPanel} ${activeTab !== 'contacts' ? ps.mobileHide : ''}`}>
            <div className={ps.card}>
              <div className={ps.panelTitle}>문의 내역</div>
              {contactsPanel}
              <div className={ps.contactsFooter}>
                <button className={ps.logoutBtn} onClick={handleLogout}>로그아웃</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
