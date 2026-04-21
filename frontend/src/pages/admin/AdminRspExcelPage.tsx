import AdminRoute from '../../components/admin/AdminRoute';
import ExcelShell from '../../components/excel/ExcelShell';
import RspBoard from '../../games/rsp/RspBoard';

/**
 * 어드민 전용 가위바위보 — Excel 모드
 * 라우트: /admin/rsp/excel
 * 접근: ADMIN role 전용 (AdminRoute 보호)
 * 진입 경로: URL 직접 입력/북마크 전용 (홈/사이드바/대시보드 노출 금지)
 *
 * 주의: ExcelShell 내부의 GAMES 배열에 rsp를 추가하지 않음 (홈 드롭다운 비노출 유지)
 * ExcelShell은 Provider 포함 컴포넌트이므로 별도 ExcelShellProvider 불필요
 */
export default function AdminRspExcelPage() {
  return (
    <AdminRoute>
      <ExcelShell
        game="rsp"
        gameName="가위바위보"
        fileTitle="admin_rsp.xlsx"
        cellSize={96}
      >
        <RspBoard excel={true} />
      </ExcelShell>
    </AdminRoute>
  );
}
