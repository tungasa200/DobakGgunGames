import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAdminTest } from '../../context/AdminTestContext';
import s from './AdminClearButton.module.css';

// 게임 라우트 패턴: /:game  또는  /:game/excel
const GAME_PATH = /^\/[a-z][a-z0-9-]*(\/excel)?$/;

export default function AdminClearButton() {
  const { user } = useAuth();
  const { trigger } = useAdminTest();
  const { pathname } = useLocation();

  if (user?.role !== 'ADMIN') return null;
  if (!GAME_PATH.test(pathname)) return null;

  return (
    <button
      className={s.fab}
      onClick={trigger}
      title="[어드민] 즉시 클리어 → 랭킹 등록 테스트"
    >
      🏁
    </button>
  );
}
