import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { fetchGameStatus } from '../../api/games';
import styles from './NormalHeader.module.css';

const GAMES = [
  { key: '',            label: '홈',       icon: '🏠', isHome: true },
  { key: 'minesweeper', label: '지뢰찾기', icon: '💣' },
  { key: 'baseball',    label: '숫자야구', icon: '⚾' },
  { key: 'solitaire',   label: '솔리테어', icon: '🃏' },
  { key: 'blockfall',   label: '블록폴',   icon: '🟦' },
  { key: 'apple',       label: '사과게임', icon: '🍎' },
  { key: 'sudoku',      label: '스도쿠',   icon: '🔢' },
];

const SCROLL_TOP_THRESHOLD = 80;   // px — 이 이내면 항상 표시
const MOUSE_TRIGGER_Y      = 60;   // px — 마우스가 이 이내면 표시

interface Props {
  currentGame?: string;
  gameName?: string;
  accentColor?: string;
}

export default function NormalHeader({ currentGame = '', gameName = '', accentColor = '#2c3e50' }: Props) {
  const [open, setOpen]               = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [visible, setVisible]         = useState(true);
  const [headerHeight, setHeaderHeight] = useState(45);

  const dropRef        = useRef<HTMLDivElement>(null);
  const btnRef         = useRef<HTMLButtonElement>(null);
  const profileDropRef = useRef<HTMLDivElement>(null);
  const profileBtnRef  = useRef<HTMLButtonElement>(null);
  const headerRef      = useRef<HTMLDivElement>(null);
  const lastScrollY    = useRef(0);
  const mouseForced    = useRef(false);

  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [gameStatus, setGameStatus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchGameStatus().then(setGameStatus);
  }, []);

  /* ── 드롭다운 외부 클릭 닫기 ── */
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (open && !dropRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
      if (profileOpen && !profileDropRef.current?.contains(e.target as Node) && !profileBtnRef.current?.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, profileOpen]);

  /* ── 헤더 실제 높이 측정 (마운트 후) ── */
  useEffect(() => {
    if (headerRef.current) {
      setHeaderHeight(headerRef.current.offsetHeight);
    }
  }, []);

  /* ── 스크롤 / 마우스 인터렉션 ── */
  useEffect(() => {
    if (!headerRef.current) return;

    // 헤더 부모를 올라가며 실제 스크롤 컨테이너 탐색
    function findScrollContainer(el: HTMLElement): Element | Window {
      let node: HTMLElement | null = el.parentElement;
      while (node && node !== document.documentElement) {
        const { overflow, overflowY } = getComputedStyle(node);
        if (/auto|scroll/.test(overflow) || /auto|scroll/.test(overflowY)) return node;
        node = node.parentElement;
      }
      return window;
    }

    function getScrollTop(container: Element | Window): number {
      return container instanceof Window ? container.scrollY : container.scrollTop;
    }

    const container = findScrollContainer(headerRef.current);
    lastScrollY.current = getScrollTop(container);

    function onScroll() {
      if (mouseForced.current) return;
      const currentY = getScrollTop(container);
      const diff     = currentY - lastScrollY.current;

      if (currentY < SCROLL_TOP_THRESHOLD) {
        setVisible(true);
      } else if (diff > 4) {
        setVisible(false);                      // 아래로 스크롤
      } else if (diff < -4) {
        setVisible(true);                       // 위로 스크롤
      }
      lastScrollY.current = currentY;
    }

    function onMouseMove(e: MouseEvent) {
      if (e.clientY < MOUSE_TRIGGER_Y) {
        mouseForced.current = true;
        setVisible(true);
      } else {
        mouseForced.current = false;
      }
    }

    container.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    return () => {
      container.removeEventListener('scroll', onScroll);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  return (
    <>
      <div
        ref={headerRef}
        className={styles.header}
        style={{
          background: accentColor,
          transform: visible ? 'translateY(0)' : 'translateY(-100%)',
        }}
      >
        <Link className={styles.logo} to="/">
          <img src="/common/logo.png" alt="" className={styles.logoImg} />
          DobakGgun
        </Link>

        <button ref={btnRef} className={styles.menuBtn} onClick={() => setOpen(o => !o)}>
          게임 목록 ▾
        </button>

        {open && (
          <div ref={dropRef} className={styles.dropdown}>
            <div className={styles.dropTitle} style={{ background: accentColor }}>게임 선택</div>
            {GAMES.map(g => {
              const isCurrent = g.isHome ? currentGame === '' : g.key === currentGame;
              const normalHref = g.isHome ? '/' : `/${g.key}`;
              const excelHref  = g.isHome ? '/excel' : `/${g.key}/excel`;
              const isDisabled = !g.isHome && user?.role !== 'ADMIN' && gameStatus[g.key] === false;
              return (
                <div key={g.key || 'home'} className={`${styles.dropItem} ${isDisabled ? styles.dropItemDisabled : ''}`}>
                  <span className={styles.dropIcon}>{g.icon}</span>
                  <span className={`${styles.dropName} ${isDisabled ? styles.dropNameDisabled : ''}`}>
                    {g.label}
                    {isDisabled && <span style={{ marginLeft: 4, fontSize: 10, color: '#b71c1c', fontWeight: 400 }}>점검 중</span>}
                  </span>
                  <div className={styles.dropBtns}>
                    {isDisabled ? (
                      <>
                        <span className={`${styles.dropBtn} ${styles.dropBtnDisabled}`}>🔧 점검 중</span>
                        <span className={`${styles.dropBtn} ${styles.dropBtnDisabled}`}>🔧 점검 중</span>
                      </>
                    ) : (
                      <>
                        <Link
                          className={`${styles.dropBtn} ${isCurrent ? styles.dropCurrent : ''}`}
                          style={isCurrent ? { background: accentColor, borderColor: accentColor } : undefined}
                          to={normalHref}
                          onClick={() => setOpen(false)}
                        >{g.isHome ? '기본 메인' : '일반 모드'}</Link>
                        <Link
                          className={`${styles.dropBtn} ${isCurrent ? styles.dropExcelSame : ''}`}
                          to={excelHref}
                          onClick={() => setOpen(false)}
                        >{g.isHome ? '엑셀 메인' : '엑셀 모드'}</Link>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className={styles.center}>{gameName ? `도박꾼 ${gameName}` : ''}</div>

        {gameName && currentGame !== 'blockfall-insane' && (
          <Link
            className={styles.excelBtn}
            style={{ color: accentColor }}
            to={currentGame ? `/${currentGame}/excel` : '/excel'}
          >📊 엑셀 모드</Link>
        )}

        {/* 게시판 링크 — FRIEND/ADMIN만 노출 */}
        {user && (user.role === 'FRIEND' || user.role === 'ADMIN') && (
          <Link className={styles.boardLink} to="/board">게시판</Link>
        )}

        {user ? (
          <div className={styles.authArea}>
            <button
              ref={profileBtnRef}
              className={styles.profileBtn}
              onClick={() => setProfileOpen(o => !o)}
            >
              {user.profileImage
                ? <img className={styles.avatar} src={user.profileImage} alt="" />
                : <span className={styles.avatarLetter}>{user.nickname?.[0] ?? '?'}</span>
              }
              <span className={styles.nickname}>{user.nickname}</span>
              <span className={styles.profileCaret}>{profileOpen ? '▴' : '▾'}</span>
            </button>

            {profileOpen && (
              <div ref={profileDropRef} className={styles.profileDrop}>
                <Link
                  className={styles.profileDropItem}
                  to="/profile"
                  onClick={() => setProfileOpen(false)}
                >
                  <span>👤</span> 내 정보
                </Link>
                <button
                  className={`${styles.profileDropItem} ${styles.profileDropLogout}`}
                  onClick={async () => { setProfileOpen(false); await logout(); navigate('/'); }}
                >
                  <span>🚪</span> 로그아웃
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link className={styles.loginBtn} to="/login">로그인</Link>
        )}
      </div>

      {/* fixed 헤더 높이만큼 밀어주는 spacer */}
      <div style={{ height: headerHeight, flexShrink: 0 }} aria-hidden="true" />
    </>
  );
}
