import type { BoardComment } from '../../api/boardApi';
import s from './CommentItem.module.css';

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

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return '방금 전';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}일 전`;
  return iso.slice(0, 10);
}

function absoluteTime(iso: string): string {
  return new Date(iso).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

interface Props {
  comment: BoardComment;
  canDelete: boolean;
  onDelete: (commentId: number) => void;
  first?: boolean;
}

export default function CommentItem({ comment, canDelete, onDelete, first = false }: Props) {
  return (
    <div className={s.wrap} style={first ? { borderTop: 'none' } : undefined}>
      <div className={s.header}>
        <Avatar src={comment.author.profileImage} nickname={comment.author.nickname} />
        <div className={s.headerText}>
          <span className={s.nickname}>{comment.author.nickname}</span>
          <span
            className={s.time}
            title={absoluteTime(comment.createdAt)}
          >
            {relativeTime(comment.createdAt)}
          </span>
        </div>
        {canDelete && (
          <button
            type="button"
            className={s.deleteBtn}
            onClick={() => onDelete(comment.id)}
            title="댓글 삭제"
          >삭제</button>
        )}
      </div>
      <p className={s.body}>{comment.content}</p>
    </div>
  );
}
