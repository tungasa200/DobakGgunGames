import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { adminPatchNoteApi } from '../../api/admin';
import s from './admin.module.css';

const GAME_OPTIONS = [
  { value: 'ALL',         label: '전체 공지' },
  { value: 'COMMON',      label: '공통' },
  { value: 'MINESWEEPER', label: '💣 지뢰찾기' },
  { value: 'BASEBALL',    label: '⚾ 숫자야구' },
  { value: 'BLOCKFALL',   label: '🟦 블록폴' },
  { value: 'SOLITAIRE',   label: '🃏 솔리테어' },
  { value: 'APPLE',       label: '🍎 사과게임' },
];

export default function AdminPatchNoteFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const { accessToken } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [version, setVersion] = useState('');
  const [game, setGame] = useState('ALL');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEdit || !accessToken || !id) return;
    adminPatchNoteApi.get(accessToken, Number(id))
      .then(found => {
        setTitle(found.title);
        setVersion(found.version);
        setGame(found.game ?? 'ALL');
        setContent(found.content);
      })
      .catch(() => setError('패치노트를 불러오지 못했습니다'));
  }, [isEdit, accessToken, id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    if (!title.trim() || !version.trim() || !content.trim()) {
      setError('모든 항목을 입력해 주세요'); return;
    }
    setLoading(true);
    setError('');
    try {
      if (isEdit && id) {
        await adminPatchNoteApi.update(accessToken, Number(id), { title, version, game, content });
      } else {
        await adminPatchNoteApi.create(accessToken, { title, version, game, content });
      }
      navigate('/admin/patch-notes');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally { setLoading(false); }
  }

  return (
    <div className={s.page}>
      <div className={s.heading}>{isEdit ? '패치노트 수정' : '패치노트 작성'}</div>

      <div style={{ background: '#fff', border: '1px solid #e8e8e8', padding: 24, maxWidth: 700 }}>
        <form onSubmit={handleSubmit}>
          {/* 제목 + 버전 */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label className={s.label}>제목</label>
              <input className={s.input} value={title} onChange={e => setTitle(e.target.value)} placeholder="패치노트 제목" required />
            </div>
            <div style={{ width: 120 }}>
              <label className={s.label}>버전</label>
              <input className={s.input} value={version} onChange={e => setVersion(e.target.value)} placeholder="1.2.3" required />
            </div>
          </div>

          {/* 게임 카테고리 */}
          <div style={{ marginBottom: 18 }}>
            <label className={s.label}>게임 카테고리</label>
            <select
              className={s.input}
              value={game}
              onChange={e => setGame(e.target.value)}
              style={{ cursor: 'pointer' }}
            >
              {GAME_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* 내용 */}
          <div style={{ marginBottom: 20 }}>
            <label className={s.label}>내용</label>
            <textarea
              className={s.textarea}
              style={{ minHeight: 320 }}
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder={`패치 내용을 입력하세요.\n\n예시:\n[버그수정]\n- 게임오버 시 깃발 표시 오류 수정\n- 모바일 터치 오류 개선\n\n[업데이트]\n- 사과 색상 개선`}
              required
            />
          </div>

          {error && <div className={s.error}>{error}</div>}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={() => navigate('/admin/patch-notes')}>취소</button>
            <button type="submit" className={`${s.btn} ${s.btnPrimary}`} disabled={loading}>
              {loading ? '저장 중...' : isEdit ? '수정 완료' : '작성 완료'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
