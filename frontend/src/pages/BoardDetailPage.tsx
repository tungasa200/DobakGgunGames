import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { boardApi as api } from '../api/boardApi';
import type { BoardPostDetail, BoardComment } from '../api/boardApi';
import { GAME_DIFFICULTY_MAP } from '../components/board/GameDifficultyPicker';
import NormalHeader from '../components/normal/NormalHeader';
import Footer from '../components/normal/Footer';
import PostTypeBadge from '../components/board/PostTypeBadge';
import CommentList from '../components/board/CommentList';
import ToastContainer from '../components/board/ToastContainer';
import { useToast } from '../hooks/useToast';
import s from './BoardDetailPage.module.css';

function Avatar({ src, nickname, size = 32 }: { src: string | null; nickname: string; size?: number }) {
  if (src) {
    return (
      <img src={src} alt={nickname}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    );
  }
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg, #aa3bff, #7b2bd4)',
      color: 'white', display: 'inline-flex', alignItems: 'center',
      justifyContent: 'center', fontSize: size * 0.44, fontWeight: 700,
    }}>
      {nickname?.[0] ?? '?'}
    </span>
  );
}

function formatDate(iso: string): string { return iso.slice(0, 10); }

function gameDifficultyLabel(gameKey: string, difficultyKey: string): string {
  const game = GAME_DIFFICULTY_MAP[gameKey];
  if (!game) return `${gameKey} / ${difficultyKey}`;
  const diff = game.difficulties.find(d => d.key === difficultyKey);
  return `${game.label} / ${diff?.label ?? difficultyKey}`;
}

export default function BoardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, accessToken } = useAuth();
  const navigate = useNavigate();
  const { toasts, addToast, removeToast } = useToast();

  const [post, setPost] = useState<BoardPostDetail | null>(null);
  const [comments, setComments] = useState<BoardComment[]>([]);
  const [commentHasNext, setCommentHasNext] = useState(false);
  const [commentCursor, setCommentCursor] = useState<string | null>(null);
  const [commentTotalCount, setCommentTotalCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const token = accessToken ?? '';
  const postId = parseInt(id ?? '0', 10);

  const loadPost = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getPost(token, postId);
      setPost(data);
      setComments(data.comments);
      setCommentHasNext(data.commentHasNext);
      setCommentCursor(data.commentNextCursor);
      setCommentTotalCount(data.commentTotalCount);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '오류';
      if (msg === 'POST_NOT_FOUND') {
        addToast('게시글이 존재하지 않습니다', 'error');
        navigate('/board', { replace: true });
      } else {
        addToast('게시글을 불러오는 데 실패했습니다', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [token, postId, navigate, addToast]);

  useEffect(() => { void loadPost(); }, [loadPost]);

  async function handleLoadMore() {
    if (!commentCursor) return;
    setLoadingMore(true);
    try {
      const res = await api.getMoreComments(token, postId, commentCursor);
      setComments(prev => [...prev, ...res.content]);
      setCommentHasNext(res.hasNext);
      setCommentCursor(res.nextCursor);
    } catch {
      addToast('댓글을 불러오는 데 실패했습니다', 'error');
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleCommentSubmit(content: string) {
    try {
      const newComment = await api.createComment(token, postId, content);
      setComments(prev => [...prev, newComment]);
      setCommentTotalCount(prev => prev + 1);
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : '댓글 등록에 실패했습니다', 'error');
      throw e;
    }
  }

  async function handleCommentDelete(commentId: number) {
    try {
      await api.deleteComment(token, postId, commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
      setCommentTotalCount(prev => Math.max(0, prev - 1));
    } catch {
      addToast('댓글 삭제에 실패했습니다', 'error');
    }
  }

  async function handleDeletePost() {
    if (!confirm('게시글을 삭제하시겠습니까? 복구할 수 없습니다.')) return;
    setDeleting(true);
    try {
      await api.deletePost(token, postId);
      navigate('/board', { replace: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '오류';
      if (msg === 'POST_NOT_FOUND') addToast('게시글이 존재하지 않습니다', 'error');
      else addToast('삭제에 실패했습니다', 'error');
      setDeleting(false);
    }
  }

  const isOwner = user && post && user.id === post.author.id;
  const isAdmin = user?.role === 'ADMIN';

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
        <NormalHeader />
        <div className={s.page}><div className={s.inner}><div className={s.loadingMsg}>불러오는 중…</div></div></div>
        <Footer />
      </div>
    );
  }

  if (!post) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      <NormalHeader />
      <div className={s.page}>
        <div className={s.inner}>
          <Link to="/board" className={s.backLink}>← 게시판 목록</Link>

          {/* 제목 영역 */}
          <div className={s.postHeader}>
            <PostTypeBadge postType={post.postType} style={{ marginBottom: 8 }} />
            <h1 className={s.postTitle}>{post.title}</h1>
            <div className={s.metaRow}>
              <Avatar src={post.author.profileImage} nickname={post.author.nickname} />
              <span className={s.nickname}>{post.author.nickname}</span>
              <span className={s.dot}>·</span>
              <span className={s.date}>{formatDate(post.createdAt)}</span>
              {post.updatedAt !== post.createdAt && (
                <span className={s.edited}>(수정됨)</span>
              )}
              <div style={{ flex: 1 }} />
              {(isOwner || isAdmin) && (
                <div className={s.actionBtns}>
                  {isOwner && (
                    <button
                      className={s.editBtn}
                      onClick={() => navigate(`/board/${postId}/edit`)}
                    >수정</button>
                  )}
                  <button
                    className={s.deleteBtn}
                    onClick={handleDeletePost}
                    disabled={deleting}
                  >{deleting ? '삭제 중…' : '삭제'}</button>
                </div>
              )}
            </div>
          </div>

          <hr className={s.divider} />

          {/* TOURNAMENT 정형 카드 */}
          {post.postType === 'TOURNAMENT' && post.tournamentData && (
            <div className={s.tournamentCard}>
              <div className={s.tournamentTitle}>대회 정보</div>
              <hr className={s.cardDivider} />
              {[
                { label: '대회 날짜', value: post.tournamentData.tournamentDate },
                { label: '게임', value: gameDifficultyLabel(post.tournamentData.gameKey, post.tournamentData.difficultyKey) },
                { label: '우승자', value: post.tournamentData.winner },
                { label: '준우승자', value: post.tournamentData.runnerUp },
                { label: '순위', value: post.tournamentData.ranking, preWrap: true },
                { label: '참가인원', value: post.tournamentData.participantCount != null ? `${post.tournamentData.participantCount}명` : null },
                { label: '참가자', value: post.tournamentData.participants },
                { label: '상품', value: post.tournamentData.prize },
                { label: '스폰서', value: post.tournamentData.sponsor },
              ].filter(row => row.value != null && row.value !== '').map(row => (
                <div key={row.label} className={s.tournamentRow}>
                  <span className={s.tournamentLabel}>{row.label}</span>
                  <span className={s.tournamentValue} style={row.preWrap ? { whiteSpace: 'pre-wrap' } : undefined}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* HTML 본문 */}
          {post.contentHtml && (
            <div
              className={`${s.boardContent}`}
              dangerouslySetInnerHTML={{ __html: post.contentHtml }}
            />
          )}

          {/* 댓글 */}
          <CommentList
            comments={comments}
            totalCount={commentTotalCount}
            hasNext={commentHasNext}
            loadingMore={loadingMore}
            onLoadMore={handleLoadMore}
            user={user}
            onDelete={handleCommentDelete}
            onSubmit={handleCommentSubmit}
          />
        </div>
      </div>
      <Footer />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
