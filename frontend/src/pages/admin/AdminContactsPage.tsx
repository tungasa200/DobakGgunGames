import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { adminContactApi } from '../../api/admin';
import type { AdminContact } from '../../api/admin';
import s from './admin.module.css';

const STATUS_TABS = [
  { key: '', label: '전체' },
  { key: 'UNREAD', label: '미읽음' },
  { key: 'READ', label: '읽음' },
  { key: 'REPLIED', label: '답변완료' },
];

const STATUS_BADGE: Record<string, string> = {
  UNREAD: s.badgeRed, READ: s.badgeBlue, REPLIED: s.badgeGreen,
};
const STATUS_LABEL: Record<string, string> = {
  UNREAD: '미읽음', READ: '읽음', REPLIED: '답변완료',
};

export default function AdminContactsPage() {
  const { accessToken } = useAuth();
  const [statusTab, setStatusTab] = useState('');
  const [contacts, setContacts] = useState<AdminContact[]>([]);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<AdminContact | null>(null);
  const [reply, setReply] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await adminContactApi.list(accessToken, { status: statusTab || undefined, page });
      setContacts(res.content);
      setHasNext(res.hasNext);
    } catch { setError('목록을 불러오지 못했습니다'); }
    finally { setLoading(false); }
  }, [accessToken, statusTab, page]);

  useEffect(() => { load(); }, [load]);

  async function openDetail(c: AdminContact) {
    if (!accessToken) return;
    const detail = await adminContactApi.get(accessToken, c.id);
    setSelected(detail);
    setReply(detail.reply ?? '');
  }

  async function sendReply() {
    if (!selected || !accessToken || !reply.trim()) return;
    setReplyLoading(true);
    try {
      await adminContactApi.reply(accessToken, selected.id, reply.trim());
      setSelected(null);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '답변 전송 실패');
    } finally { setReplyLoading(false); }
  }

  async function handleDelete(id: number) {
    if (!accessToken || !confirm('문의를 삭제하시겠습니까?')) return;
    try {
      await adminContactApi.delete(accessToken, id);
      load();
    } catch { setError('삭제 실패'); }
  }

  return (
    <div className={s.page}>
      <div className={s.heading}>문의 관리</div>

      <div className={s.tabs}>
        {STATUS_TABS.map(t => (
          <button
            key={t.key}
            className={`${s.tab} ${statusTab === t.key ? s.tabActive : ''}`}
            onClick={() => { setStatusTab(t.key); setPage(0); }}
          >{t.label}</button>
        ))}
      </div>

      {error && <div className={s.error}>{error}</div>}

      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr><th>ID</th><th>유저</th><th>유형</th><th>제목</th><th>상태</th><th>접수일</th><th>액션</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className={s.empty}>불러오는 중...</td></tr>
            ) : contacts.length === 0 ? (
              <tr><td colSpan={7} className={s.empty}>문의가 없습니다</td></tr>
            ) : contacts.map(c => (
              <tr key={c.id}>
                <td>{c.id}</td>
                <td>{c.userNickname}</td>
                <td><span className={`${s.badge} ${s.badgeGray}`}>{c.category}</span></td>
                <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.subject}</td>
                <td><span className={`${s.badge} ${STATUS_BADGE[c.status]}`}>{STATUS_LABEL[c.status]}</span></td>
                <td style={{ fontSize: 12, color: '#444' }}>{c.createdAt?.slice(0, 10)}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className={`${s.btn} ${s.btnPrimary}`} style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => openDetail(c)}>상세/답변</button>
                    <button className={`${s.btn} ${s.btnDanger}`} style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => handleDelete(c.id)}>삭제</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(page > 0 || hasNext) && (
        <div className={s.pagination}>
          <button className={s.pageBtn} onClick={() => setPage(p => p - 1)} disabled={page === 0}>이전</button>
          <span style={{ padding: '0 12px', fontSize: 12, color: '#444' }}>{page + 1} 페이지</span>
          <button className={s.pageBtn} onClick={() => setPage(p => p + 1)} disabled={!hasNext}>다음</button>
        </div>
      )}

      {selected && (
        <div className={s.overlay} onClick={() => setSelected(null)}>
          <div className={s.panel} onClick={e => e.stopPropagation()}>
            <div className={s.panelHeader}>
              <div>
                <span className={`${s.badge} ${s.badgeGray}`} style={{ marginRight: 8 }}>{selected.category}</span>
                <strong style={{ fontSize: 13, color: '#ccc', fontWeight: 600 }}>{selected.subject}</strong>
              </div>
              <button className={s.panelClose} onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className={s.panelBody}>
              <div className={s.section}>
                <div className={s.label}>유저: {selected.userNickname} · {selected.createdAt?.slice(0, 10)}</div>
                <div style={{ marginTop: 10, fontSize: 13, color: '#888', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{selected.body}</div>
              </div>

              {selected.reply && (
                <div style={{ padding: '12px 16px', background: '#050505', border: '1px solid #141414', borderLeft: '2px solid #3a3a3a', marginBottom: 20 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#2a2a2a', marginBottom: 8, letterSpacing: '1.5px', textTransform: 'uppercase' }}>기존 답변</div>
                  <div style={{ fontSize: 13, color: '#666', whiteSpace: 'pre-wrap' }}>{selected.reply}</div>
                </div>
              )}

              <div className={s.section}>
                <label className={s.label}>답변 작성</label>
                <textarea
                  className={s.textarea}
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  placeholder="답변을 입력하면 이메일로 발송됩니다"
                />
                <div style={{ marginTop: 10, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button className={`${s.btn} ${s.btnGhost}`} onClick={() => setSelected(null)}>닫기</button>
                  <button
                    className={`${s.btn} ${s.btnPrimary}`}
                    onClick={sendReply}
                    disabled={replyLoading || !reply.trim()}
                  >
                    {replyLoading ? '전송 중...' : '답변 전송'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
