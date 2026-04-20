import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { adminPatchNoteApi } from '../../api/admin';
import type { AdminPatchNote } from '../../api/admin';
import s from './admin.module.css';

export default function AdminPatchNotesPage() {
  const { accessToken } = useAuth();
  const [notes, setNotes] = useState<AdminPatchNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    if (!accessToken) return;
    setLoading(true);
    try {
      setNotes(await adminPatchNoteApi.list(accessToken));
    } catch { setError('목록을 불러오지 못했습니다'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [accessToken]);

  async function handleDelete(id: number) {
    if (!accessToken || !confirm('패치노트를 삭제하시겠습니까?')) return;
    try {
      await adminPatchNoteApi.delete(accessToken, id);
      load();
    } catch { setError('삭제 실패'); }
  }

  return (
    <div className={s.page}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid #141414' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#e8e8e8', letterSpacing: '-0.2px' }}>패치노트 관리</div>
        <Link to="/admin/patch-notes/new">
          <button className={`${s.btn} ${s.btnPrimary}`}>+ 새 패치노트</button>
        </Link>
      </div>

      {error && <div className={s.error}>{error}</div>}

      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr><th>ID</th><th>버전</th><th>제목</th><th>작성일</th><th>액션</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className={s.empty}>불러오는 중...</td></tr>
            ) : notes.length === 0 ? (
              <tr><td colSpan={5} className={s.empty}>패치노트가 없습니다</td></tr>
            ) : notes.map(n => (
              <tr key={n.id}>
                <td>{n.id}</td>
                <td><span className={`${s.badge} ${s.badgeBlue}`}>v{n.version}</span></td>
                <td>{n.title}</td>
                <td style={{ fontSize: 12, color: '#888' }}>{n.createdAt?.slice(0, 10)}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Link to={`/admin/patch-notes/${n.id}/edit`}>
                      <button className={`${s.btn} ${s.btnGhost}`} style={{ fontSize: 12, padding: '4px 10px' }}>수정</button>
                    </Link>
                    <button className={`${s.btn} ${s.btnDanger}`} style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => handleDelete(n.id)}>삭제</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
