// TODO: 엑셀 모드 홈 페이지 (excel-games/excel.html 마이그레이션 예정)
// 현재는 일반 홈으로 리다이렉트
import { Navigate } from 'react-router-dom';

export default function ExcelHomePage() {
  return <Navigate to="/" replace />;
}
