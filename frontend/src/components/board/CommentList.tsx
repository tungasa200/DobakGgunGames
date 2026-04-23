import type { BoardComment } from '../../api/boardApi';
import type { AuthUser } from '../../api/auth';
import CommentItem from './CommentItem';
import CommentForm from './CommentForm';
import s from './CommentList.module.css';

interface Props {
  comments: BoardComment[];
  totalCount: number;
  hasNext: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  user: AuthUser | null;
  onDelete: (commentId: number) => void;
  onSubmit: (content: string) => Promise<void>;
}

export default function CommentList({
  comments, totalCount, hasNext, loadingMore, onLoadMore,
  user, onDelete, onSubmit,
}: Props) {
  function canDelete(comment: BoardComment): boolean {
    if (!user) return false;
    if (user.role === 'ADMIN') return true;
    return user.id === comment.author.id;
  }

  return (
    <div className={s.section}>
      <div className={s.heading}>댓글 {totalCount}개</div>

      <div className={s.list}>
        {comments.map((c, i) => (
          <CommentItem
            key={c.id}
            comment={c}
            canDelete={canDelete(c)}
            onDelete={onDelete}
            first={i === 0}
          />
        ))}
      </div>

      {hasNext && (
        <div className={s.moreWrap}>
          <button
            type="button"
            className={s.moreBtn}
            onClick={onLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? '불러오는 중…' : '더 보기'}
          </button>
        </div>
      )}

      <hr className={s.divider} />
      <CommentForm user={user} onSubmit={onSubmit} />
    </div>
  );
}
