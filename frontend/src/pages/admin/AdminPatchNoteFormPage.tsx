import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { adminPatchNoteApi } from '../../api/admin';
import s from './admin.module.css';

export default function AdminPatchNoteFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const { accessToken } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [version, setVersion] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEdit || !accessToken || !id) return;
    adminPatchNoteApi.list(accessToken).then(notes => {
      const found = notes.find(n => n.id === Number(id));
      if (found) { setTitle(found.title); setVersion(found.version); setContent(found.content); }
    }).catch(() => setError('패치노트를 불러오지 못했습니다'));
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
        await adminPatchNoteApi.update(accessToken, Number(id), { title, version, content });
      } else {
        await adminPatchNoteApi.create(accessToken, { title, version, content });
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
          <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
            <div style={{ flex: 1 }}>
              <label className={s.label}>제목</label>
              <input className={s.input} value={title} onChange={e => setTitle(e.target.value)} placeholder="패치노트 제목" required />
            </div>
            <div style={{ width: 120 }}>
              <label className={s.label}>버전</label>
              <input className={s.input} value={version} onChange={e => setVersion(e.target.value)} placeholder="1.2.3" required />
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label className={s.label}>내용 (마크다운 사용 가능)</label>
            <textarea
              className={s.textarea}
              style={{ minHeight: 320 }}
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="패치 내용을 입력하세요..."
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
