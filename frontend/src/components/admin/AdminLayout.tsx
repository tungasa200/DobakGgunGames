import { Outlet } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import s from './AdminLayout.module.css';

export default function AdminLayout() {
  return (
    <div className={s.layout}>
      <AdminSidebar />
      <main className={s.main}>
        <Outlet />
      </main>
    </div>
  );
}
