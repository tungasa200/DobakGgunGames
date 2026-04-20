import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import s from './AdminLayout.module.css';

const PAGE_TITLES: Record<string, string> = {
  '/admin': '대시보드',
  '/admin/users': '유저 관리',
  '/admin/contacts': '문의 관리',
  '/admin/rankings': '랭킹 관리',
  '/admin/patch-notes': '패치노트',
  '/admin/patch-notes/new': '패치노트 작성',
  '/admin/ip-bans': 'IP 차단',
};

export default function AdminLayout() {
  const { pathname } = useLocation();

  useEffect(() => {
    const prev = document.title;
    document.title = 'DBK ADMIN';
    return () => { document.title = prev; };
  }, []);

  const pageTitle = PAGE_TITLES[pathname] ?? (pathname.includes('edit') ? '패치노트 수정' : 'DBK');

  return (
    <div className={s.root}>
      <AdminSidebar />
      <div className={s.body}>
        <header className={s.header}>
          <span className={s.headerTitle}>DBK ADMIN</span>
          <span className={s.headerSep}>/</span>
          <span className={s.headerPage}>{pageTitle}</span>
        </header>
        <main className={s.main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
