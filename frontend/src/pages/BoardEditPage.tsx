import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { boardMock as api } from '../mocks/boardMock';
import type { PostType } from '../api/boardApi';
import type { TournamentFormData } from '../components/board/TournamentFields';
import NormalHeader from '../components/normal/NormalHeader';
import Footer from '../components/normal/Footer';
import PostTypeBadge from '../components/board/PostTypeBadge';
import TournamentFields from '../components/board/TournamentFields';
import EditorWrapper from '../components/board/EditorWrapper';
import ToastContainer from '../components/board/ToastContainer';
import { useToast } from '../hooks/useToast';
import s from './BoardWritePage.module.css';

interface TournamentErrors {
  tournamentDate?: string;
  gameKey?: string;
  difficultyKey?: string;
  winner?: string;
}

export default function BoardEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, accessToken } = useAuth();
  const { toasts, addToast, removeToast } = useToast();

  const [postType, setPostType] = useState<PostType>('FREE');
  const [title, setTitle] = useState('');
  const [titleError, setTitleError] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [tournamentData, setTournamentData] = useState<TournamentFormData>({
    tournamentDate: '', gameKey: '', difficultyKey: '', winner: '',
    runnerUp: '', ranking: '', participantCount: '', participants: '',
    prize: '', sponsor: '',
  });
  const [tournamentErrors, setTournamentErrors] = useState<TournamentErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const token = accessToken ?? '';
  const postId = parseInt(id ?? '0', 10);

  const loadPost = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getPost(token, postId);

      // 본인 검증
      if (user && data.author.id !== user.id) {
        addToast('본인 글만 수정할 수 있습니다', 'error');
        navigate('/board', { replace: true });
        return;
      }

      setPostType(data.postType);
      setTitle(data.title);
      setContentHtml(data.contentHtml ?? '');
      if (data.tournamentData) {
        setTournamentData({
          tournamentDate: data.tournamentData.tournamentDate ?? '',
          gameKey: data.tournamentData.gameKey ?? '',
          difficultyKey: data.tournamentData.difficultyKey ?? '',
          winner: data.tournamentData.winner ?? '',
          runnerUp: data.tournamentData.runnerUp ?? '',
          ranking: data.tournamentData.ranking ?? '',
          participantCount: data.tournamentData.participantCount != null
            ? String(data.tournamentData.participantCount) : '',
          participants: data.tournamentData.participants ?? '',
          prize: data.tournamentData.prize ?? '',
          sponsor: data.tournamentData.sponsor ?? '',
        });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'POST_NOT_FOUND') {
        addToast('게시글이 존재하지 않습니다', 'error');
        navigate('/board', { replace: true });
      } else {
        addToast('게시글을 불러오는 데 실패했습니다', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [token, postId, user, navigate, addToast]);

  useEffect(() => { void loadPost(); }, [loadPost]);

  async function uploadFn(file: File) {
    return api.uploadImage(token, file);
  }

  function validate(): boolean {
    let ok = true;
    if (!title.trim()) { setTitleError('제목을 입력해 주세요'); ok = false; }
    else setTitleError('');

    if (postType === 'TOURNAMENT') {
      const errs: TournamentErrors = {};
      if (!tournamentData.tournamentDate) errs.tournamentDate = '대회 날짜를 선택해 주세요';
      if (!tournamentData.gameKey) errs.gameKey = '게임을 선택해 주세요';
      if (!tournamentData.difficultyKey) errs.difficultyKey = '난이도를 선택해 주세요';
      if (!tournamentData.winner.trim()) errs.winner = '우승자를 입력해 주세요';
      setTournamentErrors(errs);
      if (Object.keys(errs).length > 0) ok = false;
    } else {
      const stripped = contentHtml.replace(/<[^>]+>/g, '').trim();
      if (!stripped) { addToast('본문을 입력해 주세요', 'error'); ok = false; }
    }
    return ok;
  }

  function handleUnauthorized() {
    const draft = { postType, title, contentHtml, tournamentData };
    localStorage.setItem(`board_draft_${postType}`, JSON.stringify(draft));
    addToast('세션이 만료되었습니다. 로그인 후 다시 시도해 주세요.', 'error');
    setTimeout(() => navigate('/login', { replace: true }), 1500);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      let tournamentPayload = null;
      if (postType === 'TOURNAMENT') {
        tournamentPayload = {
          tournamentDate: tournamentData.tournamentDate,
          gameKey: tournamentData.gameKey,
          difficultyKey: tournamentData.difficultyKey,
          winner: tournamentData.winner.trim(),
          runnerUp: tournamentData.runnerUp.trim() || null,
          ranking: tournamentData.ranking.trim() || null,
          participantCount: tournamentData.participantCount
            ? parseInt(tournamentData.participantCount, 10) : null,
          participants: tournamentData.participants.trim() || null,
          prize: tournamentData.prize.trim() || null,
          sponsor: tournamentData.sponsor.trim() || null,
        };
      }
      await api.updatePost(token, postId, {
        postType,
        title: title.trim(),
        contentHtml: contentHtml || null,
        tournamentData: tournamentPayload,
      });
      navigate(`/board/${postId}`, { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '수정에 실패했습니다';
      if (msg === 'UNAUTHORIZED' || msg.includes('401')) handleUnauthorized();
      else if (msg === 'POST_NOT_FOUND') {
        addToast('게시글이 존재하지 않습니다', 'error');
        navigate('/board', { replace: true });
      } else addToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const isContentEmpty = postType !== 'TOURNAMENT'
    && !contentHtml.replace(/<[^>]+>/g, '').trim();
  const canSubmit = !submitting && !loading && title.trim().length > 0 && !isContentEmpty;

  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      <NormalHeader />
      <div className={s.page}>
        <div className={s.inner}>
          <div className={s.topRow}>
            <button type="button" className={s.backBtn} onClick={() => navigate(-1)}>
              ← 목록으로
            </button>
            <PostTypeBadge postType={postType} />
          </div>

          {loading ? (
            <p style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', padding: '48px 0' }}>
              불러오는 중…
            </p>
          ) : (
            <form onSubmit={handleSubmit} className={s.form}>
              <div className={s.fieldGroup}>
                <label className={s.label}>제목 <span className={s.req}>*</span></label>
                <div className={s.titleWrap}>
                  <input
                    type="text"
                    className={`${s.input} ${titleError ? s.inputError : ''}`}
                    value={title}
                    onChange={e => { setTitle(e.target.value); if (titleError) setTitleError(''); }}
                    maxLength={100}
                    placeholder="제목을 입력해 주세요"
                  />
                  <span className={s.charCount}>{title.length}/100</span>
                </div>
                {titleError && <p className={s.errorMsg}>{titleError}</p>}
              </div>

              {postType === 'TOURNAMENT' && (
                <TournamentFields
                  data={tournamentData}
                  errors={tournamentErrors}
                  onChange={setTournamentData}
                />
              )}

              <div className={s.fieldGroup}>
                <label className={s.label}>
                  {postType === 'TOURNAMENT' ? '상세 후기 (선택)' : '본문'}
                  {postType !== 'TOURNAMENT' && <span className={s.req}> *</span>}
                </label>
                <EditorWrapper
                  value={contentHtml}
                  onChange={setContentHtml}
                  minHeight={postType === 'TOURNAMENT' ? 200 : 300}
                  placeholder="내용을 입력하세요…"
                  uploadFn={uploadFn}
                  toast={addToast}
                />
              </div>

              <div className={s.formFooter}>
                <button type="button" className={s.cancelBtn} onClick={() => navigate(-1)}>
                  취소
                </button>
                <button
                  type="submit"
                  className={s.submitBtn}
                  disabled={!canSubmit}
                  style={!canSubmit ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                >
                  {submitting ? '저장 중…' : '수정 완료'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
      <Footer />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
