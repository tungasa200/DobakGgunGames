import { useState } from 'react';
import type { AuthUser } from '../../api/auth';
import s from './CommentForm.module.css';

function Avatar({ src, nickname, size = 36 }: { src: string | null; nickname: string; size?: number }) {
  if (src) {
    return (
      <img
        src={src}
        alt={nickname}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }
  return (
    <span
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: 'linear-gradient(135deg, #aa3bff, #7b2bd4)',
        color: 'white', display: 'inline-flex', alignItems: 'center',
        justifyContent: 'center', fontSize: size * 0.44, fontWeight: 700,
      }}
    >
      {nickname?.[0] ?? '?'}
    </span>
  );
}

interface Props {
  user: AuthUser | null;
  onSubmit: (content: string) => Promise<void>;
}

const MAX_LEN = 1000;

export default function CommentForm({ user, onSubmit }: Props) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  const canComment = user && (user.role === 'FRIEND' || user.role === 'ADMIN');
  const len = content.length;
  const overLimit = len > MAX_LEN;
  const canSubmit = content.trim().length > 0 && !overLimit && !loading;

  let counterColor = '#94a3b8';
  if (len > 950) counterColor = '#f59e0b';
  if (len >= MAX_LEN) counterColor = '#ef4444';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    try {
      await onSubmit(content.trim());
      setContent('');
    } finally {
      setLoading(false);
    }
  }

  if (!canComment) {
    return (
      <p className={s.noAuth}>
        댓글 작성은 도박군(FRIEND) 등급 이상만 가능합니다
      </p>
    );
  }

  return (
    <form className={s.form} onSubmit={handleSubmit}>
      <Avatar src={user.profileImage} nickname={user.nickname} />
      <div className={s.inputWrap}>
        <textarea
          className={s.textarea}
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="댓글을 입력하세요…"
          rows={2}
          disabled={loading}
        />
        <div className={s.footer}>
          <span className={s.counter} style={{ color: counterColor }}>{len}/{MAX_LEN}</span>
          <button
            type="submit"
            className={s.submitBtn}
            disabled={!canSubmit}
            style={!canSubmit ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
          >
            {loading ? '등록 중…' : '등록'}
          </button>
        </div>
      </div>
    </form>
  );
}
