export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 영문 + 숫자 + 특수문자 각 1자 이상, 8자 이상
export const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

export function validateEmail(email: string): string {
  if (!email) return '이메일을 입력해 주세요';
  if (!EMAIL_REGEX.test(email)) return '올바른 이메일 형식이 아닙니다';
  return '';
}

export function validatePassword(password: string): string {
  if (!password) return '비밀번호를 입력해 주세요';
  if (password.length < 8) return '비밀번호는 8자 이상이어야 합니다';
  if (!/[A-Za-z]/.test(password)) return '영문자를 1자 이상 포함해야 합니다';
  if (!/\d/.test(password)) return '숫자를 1자 이상 포함해야 합니다';
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return '특수문자를 1자 이상 포함해야 합니다';
  return '';
}

export interface PasswordStrength {
  score: number;       // 0~4
  label: string;
  color: string;
}

export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, label: '', color: '' };
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Za-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score++;

  const map: PasswordStrength[] = [
    { score: 0, label: '',        color: '' },
    { score: 1, label: '매우 약함', color: '#e74c3c' },
    { score: 2, label: '약함',     color: '#e67e22' },
    { score: 3, label: '보통',     color: '#f1c40f' },
    { score: 4, label: '강함',     color: '#27ae60' },
  ];
  return map[score];
}
