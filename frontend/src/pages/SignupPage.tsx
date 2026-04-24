import { useState, useEffect, useRef } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth';
import { validateEmail, validatePassword, getPasswordStrength } from '../utils/validate';
import NormalHeader from '../components/normal/NormalHeader';
import Footer from '../components/normal/Footer';
import s from './auth.module.css';
import ss from './SignupPage.module.css';

export default function SignupPage() {
  const navigate = useNavigate();

  // 이메일
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailChecked, setEmailChecked] = useState<'idle' | 'checking' | 'ok' | 'taken'>('idle');

  // 이메일 OTP
  const [codeSending, setCodeSending] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [emailCode, setEmailCode] = useState('');
  const [emailVerified, setEmailVerified] = useState<'idle' | 'verifying' | 'ok' | 'fail'>('idle');

  // 닉네임
  const [nickname, setNickname] = useState('');
  const [nicknameChecked, setNicknameChecked] = useState<'idle' | 'checking' | 'ok' | 'taken'>('idle');
  const [nicknameError, setNicknameError] = useState('');

  // 비밀번호
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');

  // 약관
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  // 제출
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const strength = getPasswordStrength(password);

  useEffect(() => {
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  }, []);

  // ── 이메일 ──────────────────────────────────────────────
  function handleEmailChange(v: string) {
    setEmail(v);
    setEmailChecked('idle');
    setEmailError(v ? validateEmail(v) : '');
    resetOtp();
  }

  function resetOtp() {
    setCodeSent(false);
    setEmailCode('');
    setEmailVerified('idle');
    setCooldown(0);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
  }

  async function handleCheckEmail() {
    const err = validateEmail(email);
    if (err) { setEmailError(err); return; }
    setEmailError('');
    setEmailChecked('checking');
    try {
      const { taken } = await authApi.checkEmail(email);
      setEmailChecked(taken ? 'taken' : 'ok');
      if (taken) resetOtp();
    } catch {
      setEmailChecked('idle');
      setEmailError('중복 확인 중 오류가 발생했습니다');
    }
  }

  async function handleSendCode() {
    setCodeSending(true);
    setEmailVerified('idle');
    setEmailCode('');
    try {
      await authApi.sendEmailCode(email);
      setCodeSent(true);
      startCooldown(60);
    } catch (err: unknown) {
      setEmailError(err instanceof Error ? err.message : '인증 코드 발송에 실패했습니다');
    } finally {
      setCodeSending(false);
    }
  }

  function startCooldown(seconds: number) {
    setCooldown(seconds);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) { clearInterval(cooldownRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  }

  async function handleVerifyCode() {
    if (emailCode.length !== 6) return;
    setEmailVerified('verifying');
    try {
      await authApi.verifyEmailCode(email, emailCode);
      setEmailVerified('ok');
    } catch {
      setEmailVerified('fail');
    }
  }

  // ── 닉네임 ─────────────────────────────────────────────
  function handleNicknameChange(v: string) {
    setNickname(v);
    setNicknameChecked('idle');
    setNicknameError('');
  }

  function validateNicknameFormat(v: string): string {
    if (!v) return '닉네임을 입력해 주세요';
    if (v.length < 2) return '닉네임은 2자 이상이어야 합니다';
    if (!/^[가-힣a-zA-Z0-9_]+$/.test(v)) return '한글, 영문, 숫자, 밑줄만 사용 가능합니다';
    return '';
  }

  async function handleCheckNickname() {
    const err = validateNicknameFormat(nickname);
    if (err) { setNicknameError(err); return; }
    setNicknameError('');
    setNicknameChecked('checking');
    try {
      const { taken } = await authApi.checkNickname(nickname);
      setNicknameChecked(taken ? 'taken' : 'ok');
    } catch {
      setNicknameChecked('idle');
      setNicknameError('중복 확인 중 오류가 발생했습니다');
    }
  }

  // ── 비밀번호 ────────────────────────────────────────────
  function handlePasswordChange(v: string) {
    setPassword(v);
    setPasswordError(v ? validatePassword(v) : '');
  }

  // ── 제출 ───────────────────────────────────────────────
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError('');

    const eErr = validateEmail(email);
    if (eErr) { setEmailError(eErr); return; }
    if (emailChecked !== 'ok') {
      setSubmitError('이메일 중복 확인을 완료해 주세요'); return;
    }
    if (emailVerified !== 'ok') {
      setSubmitError('이메일 인증을 완료해 주세요'); return;
    }
    const nErr = validateNicknameFormat(nickname);
    if (nErr) { setNicknameError(nErr); return; }
    if (nicknameChecked !== 'ok') {
      setSubmitError('닉네임 중복 확인을 완료해 주세요'); return;
    }
    const pErr = validatePassword(password);
    if (pErr) { setPasswordError(pErr); return; }
    if (password !== passwordConfirm) {
      setSubmitError('비밀번호가 일치하지 않습니다'); return;
    }
    if (!agreePrivacy || !agreeTerms) {
      setSubmitError('필수 약관에 모두 동의해 주세요'); return;
    }

    setLoading(true);
    try {
      await authApi.signup(email, nickname, password, emailCode);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : '회원가입에 실패했습니다');
    } finally {
      setLoading(false);
    }
  }

  const layout = (content: React.ReactNode) => (
    <div style={{ position: 'fixed', inset: 0, overflow: 'auto', background: '#f0f0f0', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column' }}>
      <NormalHeader accentColor="#2c3e50" />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', minHeight: 'max-content' }}>
        <div className={s.card}>
          {content}
        </div>
      </div>
      <Footer />
    </div>
  );

  // ── 성공 화면 ───────────────────────────────────────────
  if (success) {
    return layout(
      <>
        <div className={s.logo}>🎉</div>
        <h1 className={s.title}>가입 완료!</h1>
        <p className={s.subtitle}>잠시 후 로그인 페이지로 이동합니다</p>
        <div className={s.links}>
          <Link className={s.link} to="/login">로그인 페이지로 이동</Link>
        </div>
      </>
    );
  }

  return layout(
    <>
        <div className={s.logo}><img src="/common/logo.png" alt="DobakGgun" /></div>
        <h1 className={s.title}>회원가입</h1>
        <p className={s.subtitle}>무료로 가입하고 기록을 남겨보세요</p>

        {submitError && <div className={s.error}>{submitError}</div>}

        <form className={s.form} onSubmit={handleSubmit}>

          {/* 이메일 */}
          <div className={s.field}>
            <label className={s.label}>이메일 <span className={ss.required}>*</span></label>
            <div className={ss.inlineRow}>
              <input
                className={`${s.input} ${ss.inputFlex} ${emailError ? ss.inputError : ''}`}
                type="email"
                placeholder="example@email.com"
                value={email}
                onChange={e => handleEmailChange(e.target.value)}
                onBlur={() => setEmailError(validateEmail(email))}
                required
                autoFocus
              />
              <button
                type="button"
                className={`${ss.checkBtn} ${emailChecked === 'ok' ? ss.checkBtnOk : ''}`}
                onClick={handleCheckEmail}
                disabled={emailChecked === 'checking' || emailChecked === 'ok'}
              >
                {emailChecked === 'checking' ? '확인 중' : emailChecked === 'ok' ? '사용 가능 ✓' : '중복 확인'}
              </button>
              <button
                type="button"
                className={`${ss.checkBtn} ${emailVerified === 'ok' ? ss.checkBtnOk : ''}`}
                onClick={handleSendCode}
                disabled={
                  emailChecked !== 'ok' ||
                  codeSending ||
                  emailVerified === 'ok' ||
                  cooldown > 0
                }
              >
                {codeSending
                  ? '발송 중'
                  : emailVerified === 'ok'
                    ? '인증 완료 ✓'
                    : cooldown > 0
                      ? `재발송 (${cooldown}s)`
                      : codeSent ? '재발송' : '인증메일 발송'}
              </button>
            </div>
            {emailError && <span className={ss.fieldError}>{emailError}</span>}
            {!emailError && emailChecked === 'taken' && (
              <span className={ss.fieldError}>이미 사용 중인 이메일입니다</span>
            )}
            {!emailError && emailChecked === 'ok' && !codeSent && emailVerified !== 'ok' && (
              <span className={ss.fieldOk}>사용 가능한 이메일입니다. 인증메일을 발송해 주세요</span>
            )}
            {codeSent && emailVerified !== 'ok' && (
              <span className={ss.fieldOk}>인증 코드가 발송되었습니다. 이메일을 확인해 주세요</span>
            )}
          </div>

          {/* 인증 코드 입력 — 발송 후 표시 */}
          {codeSent && emailVerified !== 'ok' && (
            <div className={s.field}>
              <label className={s.label}>인증 코드 <span className={ss.required}>*</span></label>
              <div className={ss.inlineRow}>
                <input
                  className={`${s.input} ${ss.inputFlex} ${emailVerified === 'fail' ? ss.inputError : ''}`}
                  type="text"
                  inputMode="numeric"
                  placeholder="6자리 숫자 입력"
                  value={emailCode}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setEmailCode(v);
                    setEmailVerified('idle');
                  }}
                  maxLength={6}
                />
                <button
                  type="button"
                  className={ss.checkBtn}
                  onClick={handleVerifyCode}
                  disabled={emailCode.length !== 6 || emailVerified === 'verifying'}
                >
                  {emailVerified === 'verifying' ? '확인 중' : '인증 확인'}
                </button>
              </div>
              {emailVerified === 'fail' && (
                <span className={ss.fieldError}>인증 코드가 올바르지 않거나 만료되었습니다</span>
              )}
            </div>
          )}

          {/* 이메일 인증 완료 표시 */}
          {emailVerified === 'ok' && (
            <div className={ss.verifiedBanner}>이메일 인증 완료 ✓</div>
          )}

          {/* 닉네임 */}
          <div className={s.field}>
            <label className={s.label}>닉네임 <span className={ss.required}>*</span></label>
            <div className={ss.inlineRow}>
              <input
                className={`${s.input} ${ss.inputFlex} ${nicknameError ? ss.inputError : ''}`}
                type="text"
                placeholder="2~12자, 한글/영문/숫자/_"
                value={nickname}
                onChange={e => handleNicknameChange(e.target.value)}
                maxLength={12}
                required
              />
              <button
                type="button"
                className={`${ss.checkBtn} ${nicknameChecked === 'ok' ? ss.checkBtnOk : ''}`}
                onClick={handleCheckNickname}
                disabled={nicknameChecked === 'checking' || nicknameChecked === 'ok'}
              >
                {nicknameChecked === 'checking' ? '확인 중' : nicknameChecked === 'ok' ? '사용 가능 ✓' : '중복 확인'}
              </button>
            </div>
            {nicknameError && <span className={ss.fieldError}>{nicknameError}</span>}
            {!nicknameError && nicknameChecked === 'taken' && (
              <span className={ss.fieldError}>이미 사용 중인 닉네임입니다</span>
            )}
            {!nicknameError && nicknameChecked === 'ok' && (
              <span className={ss.fieldOk}>사용 가능한 닉네임입니다</span>
            )}
            {nicknameChecked === 'idle' && !nicknameError && (
              <span className={s.hint}>랭킹에 표시될 이름입니다</span>
            )}
          </div>

          {/* 비밀번호 */}
          <div className={s.field}>
            <label className={s.label}>비밀번호</label>
            <input
              className={`${s.input} ${passwordError ? ss.inputError : ''}`}
              type="password"
              placeholder="영문 + 숫자 + 특수문자 8자 이상"
              value={password}
              onChange={e => handlePasswordChange(e.target.value)}
              onBlur={() => setPasswordError(validatePassword(password))}
              required
            />
            {password && (
              <div className={ss.strengthWrap}>
                <div className={ss.strengthBar}>
                  {[1,2,3,4].map(i => (
                    <div
                      key={i}
                      className={ss.strengthSegment}
                      style={{ background: i <= strength.score ? strength.color : '#e0e0e0' }}
                    />
                  ))}
                </div>
                {strength.label && (
                  <span className={ss.strengthLabel} style={{ color: strength.color }}>
                    {strength.label}
                  </span>
                )}
              </div>
            )}
            {passwordError
              ? <span className={ss.fieldError}>{passwordError}</span>
              : <span className={s.hint}>영문 + 숫자 + 특수문자 조합 8자 이상</span>
            }
          </div>

          {/* 비밀번호 확인 */}
          <div className={s.field}>
            <label className={s.label}>비밀번호 확인</label>
            <input
              className={`${s.input} ${passwordConfirm && password !== passwordConfirm ? ss.inputError : ''}`}
              type="password"
              placeholder="비밀번호를 다시 입력하세요"
              value={passwordConfirm}
              onChange={e => setPasswordConfirm(e.target.value)}
              required
            />
            {passwordConfirm && password !== passwordConfirm && (
              <span className={ss.fieldError}>비밀번호가 일치하지 않습니다</span>
            )}
            {passwordConfirm && password === passwordConfirm && (
              <span className={ss.fieldOk}>비밀번호가 일치합니다 ✓</span>
            )}
          </div>

          {/* 약관 동의 */}
          <div className={ss.agreeSection}>
            <label className={ss.agreeRow}>
              <input
                type="checkbox"
                className={ss.checkbox}
                checked={agreePrivacy && agreeTerms}
                onChange={e => { setAgreePrivacy(e.target.checked); setAgreeTerms(e.target.checked); }}
              />
              <span className={ss.agreeAll}>전체 동의</span>
            </label>
            <div className={ss.agreeDivider} />
            <label className={ss.agreeRow}>
              <input
                type="checkbox"
                className={ss.checkbox}
                checked={agreeTerms}
                onChange={e => setAgreeTerms(e.target.checked)}
              />
              <span className={ss.agreeText}>
                <span className={ss.required}>[필수]</span>{' '}
                <Link className={ss.agreeLink} to="/terms" target="_blank">이용약관</Link> 동의
              </span>
            </label>
            <label className={ss.agreeRow}>
              <input
                type="checkbox"
                className={ss.checkbox}
                checked={agreePrivacy}
                onChange={e => setAgreePrivacy(e.target.checked)}
              />
              <span className={ss.agreeText}>
                <span className={ss.required}>[필수]</span>{' '}
                <Link className={ss.agreeLink} to="/privacy" target="_blank">개인정보 처리방침</Link> 동의
              </span>
            </label>
          </div>

          <button className={s.btn} type="submit" disabled={loading || !agreePrivacy || !agreeTerms}>
            {loading ? '처리 중...' : '가입하기'}
          </button>
        </form>

        <div className={s.links}>
          <span>이미 계정이 있으신가요? <Link className={s.link} to="/login">로그인</Link></span>
        </div>
      </>
  );
}
