import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import s from './AdminLayout.module.css';

export default function AdminLayout() {
  useEffect(() => {
    const prev = document.title;
    document.title = 'DBK ADMIN';
    return () => { document.title = prev; };
  }, []);

  return (
    <div className={s.layout}>
      <AdminSidebar />
      <main className={s.main}>
        <Outlet />
      </main>
    </div>
  );
}
