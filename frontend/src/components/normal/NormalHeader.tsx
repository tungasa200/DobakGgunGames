import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import styles from './NormalHeader.module.css';

const GAMES = [
  { key: '',            label: '홈',       icon: '🏠', isHome: true },
  { key: 'minesweeper', label: '지뢰찾기', icon: '💣' },
  { key: 'baseball',    label: '숫자야구', icon: '⚾' },
  { key: 'solitaire',   label: '솔리테어', icon: '🃏' },
  { key: 'blockfall',   label: '블록폴',   icon: '🟦' },
  { key: 'apple',       label: '사과게임', icon: '🍎' },
];

interface Props {
  currentGame: string;
  gameName: string;
  accentColor: string;
}

export default function NormalHeader({ currentGame, gameName, accentColor }: Props) {
  const [open, setOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const btnRef  = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        open &&
        !dropRef.current?.contains(e.target as Node) &&
        !btnRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className={styles.header} style={{ background: accentColor }}>
      <span className={styles.logo}>🎮 DobakGgun</span>

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
            return (
              <div key={g.key || 'home'} className={styles.dropItem}>
                <span className={styles.dropIcon}>{g.icon}</span>
                <span className={styles.dropName}>{g.label}</span>
                <div className={styles.dropBtns}>
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
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className={styles.center}>도박꾼 {gameName}</div>

      <Link
        className={styles.excelBtn}
        style={{ color: accentColor }}
        to={currentGame ? `/${currentGame}/excel` : '/excel'}
      >📊 엑셀 모드</Link>
    </div>
  );
}
