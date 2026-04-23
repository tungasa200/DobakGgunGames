import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
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

const EMPTY_TOURNAMENT: TournamentFormData = {
  tournamentDate: '',
  gameKey: '',
  difficultyKey: '',
  winner: '',
  runnerUp: '',
  ranking: '',
  participantCount: '',
  participants: '',
  prize: '',
  sponsor: '',
};

interface TournamentErrors {
  tournamentDate?: string;
  gameKey?: string;
  difficultyKey?: string;
  winner?: string;
}

export default function BoardWritePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, accessToken } = useAuth();
  const { toasts, addToast, removeToast } = useToast();

  const typeParam = (searchParams.get('type') ?? 'FREE') as PostType;
  const [postType] = useState<PostType>(typeParam);

  const [title, setTitle] = useState('');
  const [titleError, setTitleError] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [tournamentData, setTournamentData] = useState<TournamentFormData>(EMPTY_TOURNAMENT);
  const [tournamentErrors, setTournamentErrors] = useState<TournamentErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const token = accessToken ?? '';

  // 업로드 함수 (목 환경)
  async function uploadFn(file: File) {
    return api.uploadImage(token, file);
  }

  function validate(): boolean {
    let ok = true;
    if (!title.trim()) {
      setTitleError('제목을 입력해 주세요');
      ok = false;
    } else {
      setTitleError('');
    }

    if (postType === 'TOURNAMENT') {
      const errs: TournamentErrors = {};
      if (!tournamentData.tournamentDate) errs.tournamentDate = '대회 날짜를 선택해 주세요';
      if (!tournamentData.gameKey) errs.gameKey = '게임을 선택해 주세요';
      if (!tournamentData.difficultyKey) errs.difficultyKey = '난이도를 선택해 주세요';
      if (!tournamentData.winner.trim()) errs.winner = '우승자를 입력해 주세요';
      setTournamentErrors(errs);
      if (Object.keys(errs).length > 0) ok = false;
    } else {
      // NOTICE/FREE: 에디터 본문 필수
      // editor.isEmpty 상당 — <p></p>만 있으면 빈 것으로 간주
      const stripped = contentHtml.replace(/<[^>]+>/g, '').trim();
      if (!stripped) {
        addToast('본문을 입력해 주세요', 'error');
        ok = false;
      }
    }
    return ok;
  }

  // 세션 만료 시 draft 저장 후 리다이렉트
  function handleUnauthorized() {
    const draft = {
      postType, title, contentHtml, tournamentData,
    };
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
            ? parseInt(tournamentData.participantCount, 10)
            : null,
          participants: tournamentData.participants.trim() || null,
          prize: tournamentData.prize.trim() || null,
          sponsor: tournamentData.sponsor.trim() || null,
        };
      }
      const result = await api.createPost(token, {
        postType,
        title: title.trim(),
        contentHtml: contentHtml || null,
        tournamentData: tournamentPayload,
      });
      navigate(`/board/${result.id}`, { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '작성에 실패했습니다';
      if (msg === 'UNAUTHORIZED' || msg.includes('401')) {
        handleUnauthorized();
      } else {
        addToast(msg, 'error');
      }
    } finally {
      setSubmitting(false);
    }
  }

  const isContentEmpty = (() => {
    if (postType !== 'TOURNAMENT') {
      return !contentHtml.replace(/<[^>]+>/g, '').trim();
    }
    return false;
  })();

  const canSubmit =
    !submitting &&
    title.trim().length > 0 &&
    (postType === 'TOURNAMENT' || !isContentEmpty);

  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      <NormalHeader />
      <div className={s.page}>
        <div className={s.inner}>
          <div className={s.topRow}>
            <button type="button" className={s.backBtn} onClick={() => navigate('/board')}>
              ← 목록으로
            </button>
            <PostTypeBadge postType={postType} />
          </div>

          <form onSubmit={handleSubmit} className={s.form}>
            {/* 제목 */}
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

            {/* TOURNAMENT 전용 필드 */}
            {postType === 'TOURNAMENT' && (
              <TournamentFields
                data={tournamentData}
                errors={tournamentErrors}
                onChange={setTournamentData}
              />
            )}

            {/* 에디터 */}
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
              <button type="button" className={s.cancelBtn} onClick={() => navigate('/board')}>
                취소
              </button>
              <button
                type="submit"
                className={s.submitBtn}
                disabled={!canSubmit}
                style={!canSubmit ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
              >
                {submitting ? '저장 중…' : '작성 완료'}
              </button>
            </div>
          </form>
        </div>
      </div>
      <Footer />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
