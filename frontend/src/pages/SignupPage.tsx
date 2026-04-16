import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth';
import { validateEmail, validatePassword, getPasswordStrength } from '../utils/validate';
import s from './auth.module.css';
import ss from './SignupPage.module.css';

export default function SignupPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailChecked, setEmailChecked] = useState<'idle' | 'checking' | 'ok' | 'taken'>('idle');

  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');

  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const strength = getPasswordStrength(password);

  function handleEmailChange(v: string) {
    setEmail(v);
    setEmailChecked('idle');
    setEmailError(v ? validateEmail(v) : '');
  }

  function handleEmailBlur() {
    setEmailError(validateEmail(email));
  }

  function handlePasswordChange(v: string) {
    setPassword(v);
    setPasswordError(v ? validatePassword(v) : '');
  }

  function handlePasswordBlur() {
    setPasswordError(validatePassword(password));
  }

  async function handleCheckEmail() {
    const err = validateEmail(email);
    if (err) { setEmailError(err); return; }
    setEmailError('');
    setEmailChecked('checking');
    try {
      const { taken } = await authApi.checkEmail(email);
      setEmailChecked(taken ? 'taken' : 'ok');
    } catch {
      setEmailChecked('idle');
      setEmailError('중복 확인 중 오류가 발생했습니다');
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError('');

    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    if (eErr) { setEmailError(eErr); return; }
    if (pErr) { setPasswordError(pErr); return; }
    if (emailChecked !== 'ok') {
      setSubmitError('이메일 중복 확인을 완료해 주세요');
      return;
    }
    if (password !== passwordConfirm) {
      setSubmitError('비밀번호가 일치하지 않습니다');
      return;
    }
    if (!agreePrivacy || !agreeTerms) {
      setSubmitError('필수 약관에 모두 동의해 주세요');
      return;
    }

    setLoading(true);
    try {
      await authApi.signup(email, nickname, password);
      setSuccess('가입이 완료되었습니다! 이메일을 확인해 인증을 완료해 주세요.');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : '회원가입에 실패했습니다');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className={s.page}>
        <div className={s.card}>
          <div className={s.logo}>✉️</div>
          <h1 className={s.title}>인증 메일 발송</h1>
          <p className={s.subtitle}>{email} 으로 인증 링크를 보냈습니다</p>
          <div className={s.success}>{success}</div>
          <div className={s.links}>
            <Link className={s.link} to="/login">로그인 페이지로 이동</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={s.page}>
      <div className={s.card}>
        <div className={s.logo}>🎮</div>
        <h1 className={s.title}>회원가입</h1>
        <p className={s.subtitle}>무료로 가입하고 기록을 남겨보세요</p>

        {submitError && <div className={s.error}>{submitError}</div>}

        <form className={s.form} onSubmit={handleSubmit}>

          {/* 이메일 + 중복확인 */}
          <div className={s.field}>
            <label className={s.label}>이메일 <span className={ss.required}>*</span></label>
            <div className={ss.inlineRow}>
              <input
                className={`${s.input} ${ss.inputFlex} ${emailError ? ss.inputError : ''}`}
                type="email"
                placeholder="example@email.com"
                value={email}
                onChange={e => handleEmailChange(e.target.value)}
                onBlur={handleEmailBlur}
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
            </div>
            {emailError && <span className={ss.fieldError}>{emailError}</span>}
            {!emailError && emailChecked === 'taken' && (
              <span className={ss.fieldError}>이미 사용 중인 이메일입니다</span>
            )}
            {!emailError && emailChecked === 'ok' && (
              <span className={ss.fieldOk}>사용 가능한 이메일입니다</span>
            )}
          </div>

          {/* 닉네임 */}
          <div className={s.field}>
            <label className={s.label}>닉네임</label>
            <input
              className={s.input}
              type="text"
              placeholder="2~12자, 한글/영문/숫자/_"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              minLength={2}
              maxLength={12}
              required
            />
            <span className={s.hint}>랭킹에 표시될 이름입니다</span>
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
              onBlur={handlePasswordBlur}
              required
            />
            {/* 강도 표시바 */}
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
      </div>
    </div>
  );
}
