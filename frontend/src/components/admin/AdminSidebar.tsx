import { NavLink } from 'react-router-dom';
import s from './AdminSidebar.module.css';

const MENU = [
  { to: '/admin', label: '대시보드', end: true },
  { to: '/admin/users', label: '유저 관리' },
  { to: '/admin/contacts', label: '문의 관리' },
  { to: '/admin/rankings', label: '랭킹 관리' },
  { to: '/admin/patch-notes', label: '패치노트' },
  { to: '/admin/ip-bans', label: 'IP 차단' },
];

export default function AdminSidebar() {
  return (
    <nav className={s.sidebar}>
      <div className={s.logo}>어드민</div>
      {MENU.map(m => (
        <NavLink
          key={m.to}
          to={m.to}
          end={m.end}
          className={({ isActive }) => `${s.item} ${isActive ? s.active : ''}`}
        >
          {m.label}
        </NavLink>
      ))}
    </nav>
  );
}
