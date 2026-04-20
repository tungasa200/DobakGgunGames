import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { adminUserApi } from '../../api/admin';
import type { AdminUser } from '../../api/admin';
import s from './admin.module.css';

type ConfirmAction =
  | { type: 'role'; user: AdminUser; value: string }
  | { type: 'status'; user: AdminUser; value: string }
  | { type: 'delete'; user: AdminUser };

const ROLE_LABELS: Record<string, string> = { USER: '일반', ADMIN: '관리자' };
const STATUS_LABELS: Record<string, string> = { PENDING: '대기', ACTIVE: '활성', BANNED: '차단' };
const STATUS_BADGE: Record<string, string> = {
  ACTIVE: s.badgeGreen, PENDING: s.badgeYellow, BANNED: s.badgeRed,
};
const ROLE_BADGE: Record<string, string> = {
  USER: s.badgeGray, ADMIN: s.badgeBlue,
};

export default function AdminUsersPage() {
  const { accessToken } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await adminUserApi.list(accessToken, {
        search: search || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
        page,
      });
      setUsers(res.content);
      setTotal(res.totalCount);
      setHasNext(res.hasNext);
    } catch {
      setError('목록을 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  }, [accessToken, search, roleFilter, statusFilter, page]);

  useEffect(() => { load(); }, [load]);

  function handleSearch() {
    setSearch(searchInput);
    setPage(0);
  }

  async function execConfirm() {
    if (!confirm || !accessToken) return;
    setActionLoading(true);
    try {
      if (confirm.type === 'role') {
        await adminUserApi.changeRole(accessToken, confirm.user.id, confirm.value);
      } else if (confirm.type === 'status') {
        await adminUserApi.changeStatus(accessToken, confirm.user.id, confirm.value);
      } else {
        await adminUserApi.deleteUser(accessToken, confirm.user.id);
      }
      setConfirm(null);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '작업 실패');
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className={s.page}>
      <div className={s.heading}>유저 관리 <span style={{ fontSize: 13, fontWeight: 400, color: '#aaa' }}>({total}명)</span></div>

      <div className={s.toolbar}>
        <input
          className={s.searchInput}
          placeholder="이메일 / 닉네임 검색"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
        />
        <button className={`${s.btn} ${s.btnPrimary}`} onClick={handleSearch}>검색</button>
        <select className={s.select} value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(0); }}>
          <option value="">전체 역할</option>
          <option value="USER">일반</option>
          <option value="ADMIN">관리자</option>
        </select>
        <select className={s.select} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }}>
          <option value="">전체 상태</option>
          <option value="ACTIVE">활성</option>
          <option value="PENDING">대기</option>
          <option value="BANNED">차단</option>
        </select>
      </div>

      {error && <div className={s.error}>{error}</div>}

      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>ID</th><th>닉네임</th><th>이메일</th><th>가입</th>
              <th>Provider</th><th>역할</th><th>상태</th><th>액션</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className={s.empty}>불러오는 중...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={8} className={s.empty}>유저가 없습니다</td></tr>
            ) : users.map(u => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>{u.nickname}</td>
                <td style={{ fontSize: 13 }}>{u.email}</td>
                <td style={{ fontSize: 12, color: '#444' }}>{u.createdAt?.slice(0, 10)}</td>
                <td>{u.provider ?? 'LOCAL'}</td>
                <td><span className={`${s.badge} ${ROLE_BADGE[u.role]}`}>{ROLE_LABELS[u.role]}</span></td>
                <td><span className={`${s.badge} ${STATUS_BADGE[u.status]}`}>{STATUS_LABELS[u.status]}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <select
                      className={s.select}
                      style={{ padding: '4px 6px', fontSize: 12 }}
                      value={u.role}
                      onChange={e => setConfirm({ type: 'role', user: u, value: e.target.value })}
                    >
                      <option value="USER">일반</option>
                      <option value="ADMIN">관리자</option>
                    </select>
                    <select
                      className={s.select}
                      style={{ padding: '4px 6px', fontSize: 12 }}
                      value={u.status}
                      onChange={e => setConfirm({ type: 'status', user: u, value: e.target.value })}
                    >
                      <option value="ACTIVE">활성</option>
                      <option value="PENDING">대기</option>
                      <option value="BANNED">차단</option>
                    </select>
                    <button
                      className={`${s.btn} ${s.btnDanger}`}
                      style={{ padding: '4px 8px', fontSize: 12 }}
                      onClick={() => setConfirm({ type: 'delete', user: u })}
                    >삭제</button>
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
          <span style={{ padding: '0 12px', fontSize: 12, color: '#aaa' }}>{page + 1} 페이지</span>
          <button className={s.pageBtn} onClick={() => setPage(p => p + 1)} disabled={!hasNext}>다음</button>
        </div>
      )}

      {confirm && (
        <div className={s.overlay} onClick={() => setConfirm(null)}>
          <div className={s.modal} onClick={e => e.stopPropagation()}>
            <div className={s.modalTitle}>
              {confirm.type === 'delete'
                ? `"${confirm.user.nickname}" 유저를 삭제하시겠습니까?`
                : confirm.type === 'role'
                ? `역할을 "${ROLE_LABELS[confirm.value]}"으로 변경하시겠습니까?`
                : `상태를 "${STATUS_LABELS[confirm.value]}"으로 변경하시겠습니까?`}
            </div>
            <div style={{ fontSize: 13, color: '#888' }}>
              대상: {confirm.user.nickname} ({confirm.user.email})
            </div>
            <div className={s.modalActions}>
              <button className={`${s.btn} ${s.btnGhost}`} onClick={() => setConfirm(null)}>취소</button>
              <button
                className={`${s.btn} ${confirm.type === 'delete' ? s.btnDanger : s.btnPrimary}`}
                onClick={execConfirm}
                disabled={actionLoading}
              >
                {actionLoading ? '처리 중...' : '확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
