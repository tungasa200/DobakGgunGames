import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { adminIpBanApi } from '../../api/admin';
import type { IpBan } from '../../api/admin';
import s from './admin.module.css';

const IP_REGEX = /^((\d{1,3}\.){3}\d{1,3}|([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4})$/;

export default function AdminIpBansPage() {
  const { accessToken } = useAuth();
  const [bans, setBans] = useState<IpBan[]>([]);
  const [loading, setLoading] = useState(false);
  const [ip, setIp] = useState('');
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    if (!accessToken) return;
    setLoading(true);
    try { setBans(await adminIpBanApi.list(accessToken)); }
    catch { setError('목록을 불러오지 못했습니다'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [accessToken]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    if (!IP_REGEX.test(ip.trim())) {
      setFormError('올바른 IPv4 또는 IPv6 주소를 입력해 주세요');
      return;
    }
    setFormError('');
    setAddLoading(true);
    try {
      await adminIpBanApi.ban(accessToken, ip.trim(), reason.trim() || undefined);
      setIp(''); setReason('');
      load();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : '차단 실패');
    } finally { setAddLoading(false); }
  }

  async function handleUnban(id: number) {
    if (!accessToken || !confirm('차단을 해제하시겠습니까?')) return;
    try {
      await adminIpBanApi.unban(accessToken, id);
      load();
    } catch { setError('해제 실패'); }
  }

  return (
    <div className={s.page}>
      <div className={s.heading}>IP 차단 관리</div>

      {/* IP 등록 폼 */}
      <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 4, padding: '18px 20px', marginBottom: 16, maxWidth: 560 }}>
        <div className={s.sectionTitle}>IP 차단 등록</div>
        <form onSubmit={handleAdd}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 2, minWidth: 180 }}>
              <label className={s.label}>IP 주소</label>
              <input
                className={s.input}
                value={ip}
                onChange={e => { setIp(e.target.value); setFormError(''); }}
                placeholder="예: 192.168.0.1"
              />
            </div>
            <div style={{ flex: 3, minWidth: 180 }}>
              <label className={s.label}>사유 (선택)</label>
              <input className={s.input} value={reason} onChange={e => setReason(e.target.value)} placeholder="차단 사유" />
            </div>
            <button type="submit" className={`${s.btn} ${s.btnDanger}`} disabled={addLoading || !ip.trim()}>
              {addLoading ? '처리 중...' : '차단'}
            </button>
          </div>
          {formError && <div className={s.error}>{formError}</div>}
        </form>
      </div>

      {error && <div className={s.error}>{error}</div>}

      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr><th>IP 주소</th><th>사유</th><th>차단일</th><th>해제</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className={s.empty}>불러오는 중...</td></tr>
            ) : bans.length === 0 ? (
              <tr><td colSpan={4} className={s.empty}>차단된 IP가 없습니다</td></tr>
            ) : bans.map(b => (
              <tr key={b.id}>
                <td style={{ fontFamily: 'monospace' }}>{b.ip}</td>
                <td style={{ color: '#555', fontSize: 13 }}>{b.reason || '-'}</td>
                <td style={{ fontSize: 12, color: '#444' }}>{b.bannedAt?.slice(0, 10)}</td>
                <td>
                  <button className={`${s.btn} ${s.btnGhost}`} style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => handleUnban(b.id)}>해제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
