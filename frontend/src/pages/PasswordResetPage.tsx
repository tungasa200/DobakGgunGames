import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authApi } from '../api/auth';
import { validateEmail, validatePassword, getPasswordStrength } from '../utils/validate';
import s from './auth.module.css';
import ss from './SignupPage.module.css';

export default function PasswordResetPage() {
  const [params] = useSearchParams();
  const token = params.get('token');

  // 토큰이 있으면 새 비밀번호 입력 화면, 없으면 이메일 입력 화면
  return token ? <ResetConfirm token={token} /> : <ResetRequest />;
}

function ResetRequest() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const err = validateEmail(email);
    if (err) { setEmailError(err); return; }
    setError(''); setEmailError('');
    setLoading(true);
    try {
      await authApi.requestPasswordReset(email);
      setSuccess('입력하신 이메일로 재설정 링크를 발송했습니다. 메일함을 확인해 주세요.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '요청에 실패했습니다');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={s.page}>
      <div className={s.card}>
        <div className={s.logo}>🔑</div>
        <h1 className={s.title}>비밀번호 찾기</h1>
        <p className={s.subtitle}>가입한 이메일로 재설정 링크를 보내드립니다</p>

        {error && <div className={s.error}>{error}</div>}
        {success && <div className={s.success}>{success}</div>}

        {!success && (
          <form className={s.form} onSubmit={handleSubmit}>
            <div className={s.field}>
              <label className={s.label}>이메일</label>
              <input
                className={`${s.input} ${emailError ? ss.inputError : ''}`}
                type="email"
                placeholder="가입한 이메일 주소"
                value={email}
                onChange={e => { setEmail(e.target.value); setEmailError(''); }}
                onBlur={() => setEmailError(validateEmail(email))}
                required
                autoFocus
              />
              {emailError && <span className={ss.fieldError}>{emailError}</span>}
            </div>
            <button className={s.btn} type="submit" disabled={loading}>
              {loading ? '발송 중...' : '재설정 링크 보내기'}
            </button>
          </form>
        )}

        <div className={s.links}>
          <Link className={s.link} to="/login">로그인으로 돌아가기</Link>
        </div>
      </div>
    </div>
  );
}

function ResetConfirm({ token }: { token: string }) {
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const strength = getPasswordStrength(password);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const pErr = validatePassword(password);
    if (pErr) { setPasswordError(pErr); return; }
    if (password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다');
      return;
    }
    setLoading(true);
    try {
      await authApi.confirmPasswordReset(token, password);
      setSuccess('비밀번호가 변경되었습니다. 새 비밀번호로 로그인해 주세요.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '변경에 실패했습니다');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={s.page}>
      <div className={s.card}>
        <div className={s.logo}>🔒</div>
        <h1 className={s.title}>새 비밀번호 설정</h1>
        <p className={s.subtitle}>새로 사용할 비밀번호를 입력해 주세요</p>

        {error && <div className={s.error}>{error}</div>}
        {success && <div className={s.success}>{success}</div>}

        {!success && (
          <form className={s.form} onSubmit={handleSubmit}>
            <div className={s.field}>
              <label className={s.label}>새 비밀번호</label>
              <input
                className={`${s.input} ${passwordError ? ss.inputError : ''}`}
                type="password"
                placeholder="영문 + 숫자 + 특수문자 8자 이상"
                value={password}
                onChange={e => { setPassword(e.target.value); setPasswordError(''); }}
                onBlur={() => setPasswordError(validatePassword(password))}
                required
                autoFocus
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
            <button className={s.btn} type="submit" disabled={loading}>
              {loading ? '변경 중...' : '비밀번호 변경'}
            </button>
          </form>
        )}

        <div className={s.links}>
          <Link className={s.link} to="/login">로그인으로 돌아가기</Link>
        </div>
      </div>
    </div>
  );
}
