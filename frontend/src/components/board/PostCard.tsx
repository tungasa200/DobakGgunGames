import { useNavigate } from 'react-router-dom';
import type { BoardPostSummary } from '../../api/boardApi';
import PostTypeBadge from './PostTypeBadge';
import s from './PostCard.module.css';

function Avatar({ src, nickname, size = 32 }: { src: string | null; nickname: string; size?: number }) {
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
        justifyContent: 'center', fontSize: size * 0.45, fontWeight: 700,
      }}
    >
      {nickname?.[0] ?? '?'}
    </span>
  );
}

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

interface Props {
  post: BoardPostSummary;
}

export default function PostCard({ post }: Props) {
  const navigate = useNavigate();
  return (
    <div className={s.card} onClick={() => navigate(`/board/${post.id}`)} role="button" tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter') navigate(`/board/${post.id}`); }}>
      <div className={s.top}>
        <span className={s.titleRow}>
          <PostTypeBadge postType={post.postType} style={{ marginRight: 8 }} />
          <span className={s.title}>{post.title}</span>
        </span>
        {post.commentCount > 0 && (
          <span className={s.commentBadge}>💬 {post.commentCount}</span>
        )}
      </div>
      <div className={s.meta}>
        <Avatar src={post.author.profileImage} nickname={post.author.nickname} size={32} />
        <span className={s.nickname}>{post.author.nickname}</span>
        <span className={s.dot}>·</span>
        <span className={s.date}>{formatDate(post.createdAt)}</span>
      </div>
    </div>
  );
}
