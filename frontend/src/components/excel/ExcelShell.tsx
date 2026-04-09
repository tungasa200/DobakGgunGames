import { useRef, useState, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExcelShellProvider, useExcelShell } from './ExcelShellContext';
import styles from './ExcelShell.module.css';

// ===== 게임 목록 =====
const GAMES = [
  { key: 'minesweeper', label: '지뢰찾기', icon: '💣' },
  { key: 'baseball',    label: '숫자야구', icon: '⚾' },
  { key: 'tetris',      label: '테트리스', icon: '🟦' },
  { key: 'solitaire',   label: '솔리테어', icon: '🃏' },
  { key: 'apple',       label: '사과게임', icon: '🍎' },
];

// ===== Props =====
export interface ExcelShellProps {
  game: string;           // 현재 게임 key
  gameName: string;       // 표시용 한글 이름
  fileTitle?: string;     // 상단 파일명 (기본: game_score.xlsx)
  ribbonGameGroup?: ReactNode;  // 게임 전용 리본 그룹
  children: ReactNode;
}

// ===== 내부: 크롬 렌더러 (Context 소비) =====
function ExcelShellInner({ game, gameName, fileTitle, ribbonGameGroup, children }: ExcelShellProps) {
  const { formulaCell, formulaContent, statusItems } = useExcelShell();
  const navigate = useNavigate();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const homeTabRef  = useRef<HTMLSpanElement>(null);

  const title = fileTitle ?? `${game}_score.xlsx`;

  // 드롭다운 외부 클릭 닫기
  useEffect(() => {
    function handler(e: MouseEvent | TouchEvent) {
      if (
        dropdownOpen &&
        !dropdownRef.current?.contains(e.target as Node) &&
        !homeTabRef.current?.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [dropdownOpen]);

  // 공통 리본 그룹 (장식용 — 클릭 시 아무 동작 없음)
  const RIBBON_COMMON_GROUPS = [
    {
      label: '클립보드',
      buttons: [
        { icon: '📋', label: '붙여넣기' },
        { icon: '✂',  label: '잘라내기' },
        { icon: '📄',  label: '복사' },
      ],
    },
    {
      label: '글꼴',
      buttons: [
        { icon: 'B',  label: '' },
        { icon: 'I',  label: '' },
        { icon: 'U',  label: '' },
      ],
    },
    {
      label: '맞춤',
      buttons: [
        { icon: '≡', label: '왼쪽' },
        { icon: '≡', label: '가운데' },
        { icon: '≡', label: '오른쪽' },
      ],
    },
    {
      label: '표시 형식',
      buttons: [
        { icon: '📊', label: '형식' },
        { icon: '%',  label: '백분율' },
        { icon: ',',  label: '쉼표' },
      ],
    },
  ];

  return (
    <div className={styles.shell}>
      {/* ── 타이틀바 ── */}
      <div className={styles.titlebar}>
        <div className={styles.titleLeft}>
          <span className={styles.logo}>X</span>
          <span>DobakGgun - {gameName}</span>
        </div>
        <div className={styles.titleCenter}>{title} - Excel</div>
        <div className={styles.titleRight}>
          <div className={styles.winBtns}>
            <span title="최소화">─</span>
            <span title="최대화">□</span>
            <span className={styles.closeBtn} title="홈으로" onClick={() => navigate('/')}>✕</span>
          </div>
        </div>
      </div>

      {/* ── 리본 탭 ── */}
      <div className={styles.ribbonTabs}>
        <span
          ref={homeTabRef}
          className={`${styles.rtab} ${dropdownOpen ? styles.rtabDropdown : styles.rtabActive}`}
          onClick={() => setDropdownOpen(o => !o)}
        >홈</span>
        {['삽입','페이지 레이아웃','수식','데이터','검토','보기'].map(t => (
          <span key={t} className={styles.rtab}>{t}</span>
        ))}
      </div>

      {/* ── 홈 드롭다운 ── */}
      {dropdownOpen && (
        <div
          ref={dropdownRef}
          className={styles.dropdown}
          style={{
            top: homeTabRef.current
              ? homeTabRef.current.getBoundingClientRect().bottom + window.scrollY
              : 72,
          }}
        >
          <div className={styles.dropTitle}>게임 선택</div>
          {GAMES.map(g => (
            <div key={g.key} className={styles.dropGame}>
              <span className={styles.dropIcon}>{g.icon}</span>
              <span className={styles.dropName}>{g.label}</span>
              <div className={styles.dropBtns}>
                <button
                  className={`${styles.dropBtn} ${game === g.key ? styles.dropBtnSame : ''}`}
                  onClick={() => { navigate(`/${g.key}`); setDropdownOpen(false); }}
                >일반 모드</button>
                <button
                  className={`${styles.dropBtn} ${game === g.key ? styles.dropBtnCurrent : ''}`}
                  onClick={() => { navigate(`/${g.key}/excel`); setDropdownOpen(false); }}
                  disabled={game === g.key}
                >엑셀 모드</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 리본 ── */}
      <div className={styles.ribbon}>
        {/* 공통 그룹 */}
        {RIBBON_COMMON_GROUPS.map(grp => (
          <div key={grp.label} className={styles.rGroup}>
            <div className={styles.rGroupBtns}>
              {grp.buttons.map(btn => (
                <div key={btn.icon + btn.label} className={styles.rBtn}>
                  <span className={styles.rBtnIcon}>{btn.icon}</span>
                  {btn.label && <span>{btn.label}</span>}
                </div>
              ))}
            </div>
            <div className={styles.rGroupLabel}>{grp.label}</div>
          </div>
        ))}

        {/* 게임 전용 그룹 */}
        {ribbonGameGroup}
      </div>

      {/* ── 수식바 ── */}
      <div className={styles.formulaBar}>
        <div className={styles.fbCell}>{formulaCell}</div>
        <div className={styles.fbFx}><em>f</em>x</div>
        <div className={styles.fbInput}>{formulaContent}</div>
      </div>

      {/* ── 시트 영역 ── */}
      <div className={styles.sheetArea}>
        {children}
      </div>

      {/* ── 상태바 ── */}
      <div className={styles.statusBar}>
        <div className={styles.statusLeft}>
          {statusItems.map(item => (
            <span key={item.label} className={styles.statusItem}>
              {item.label}: <strong>{item.value}</strong>
            </span>
          ))}
        </div>
        <div className={styles.statusRight}>
          <span>평균: 0 &nbsp; 개수: 0 &nbsp; 합계: 0</span>
          <span>🔍 100%</span>
        </div>
      </div>
    </div>
  );
}

// ===== 외부에 노출되는 컴포넌트 (Provider 포함) =====
export default function ExcelShell(props: ExcelShellProps) {
  return (
    <ExcelShellProvider>
      <ExcelShellInner {...props} />
    </ExcelShellProvider>
  );
}
