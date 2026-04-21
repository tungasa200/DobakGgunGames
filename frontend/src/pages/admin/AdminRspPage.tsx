import AdminRoute from '../../components/admin/AdminRoute';
import RspBoard from '../../games/rsp/RspBoard';

/**
 * 어드민 전용 가위바위보 — 일반 모드
 * 라우트: /admin/rsp
 * 접근: ADMIN role 전용 (AdminRoute 보호)
 * 진입 경로: URL 직접 입력/북마크 전용 (홈/사이드바/대시보드 노출 금지)
 */
export default function AdminRspPage() {
  return (
    <AdminRoute>
      <RspBoard excel={false} />
    </AdminRoute>
  );
}
