import { useState, useCallback, useRef, useEffect } from 'react';
import type { BattleCell } from './types';
import OpponentProgress from './OpponentProgress';
import styles from './MinesweeperBattleBoard.module.css';

const CELL_SIZE = 30;

function useBoardScale(cols: number): number {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const update = () => {
      const available = window.innerWidth - 32;
      const natural = cols * CELL_SIZE;
      setScale(natural > available ? available / natural : 1);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [cols]);
  return scale;
}

const NUM_COLORS = ['', '#0000ff','#007b00','#ff0000','#00007b','#7b0000','#007b7b','#000000','#7b7b7b'];

function ForfeitModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className={styles.modalBackdrop} role="dialog" aria-modal aria-label="포기 확인">
      <div className={styles.modalBox}>
        <div className={styles.modalTitle}>정말 포기하시겠습니까?</div>
        <div className={styles.modalDesc}>포기하면 이번 게임은 패배 처리됩니다.</div>
        <div className={styles.modalBtns}>
          <button className={styles.btnDanger} onClick={onConfirm} type="button">포기</button>
          <button className={styles.btnSecondary} onClick={onCancel} type="button">계속하기</button>
        </div>
      </div>
    </div>
  );
}

interface MinesweeperBattleGameViewProps {
  board: BattleCell[][];
  rows: number;
  cols: number;
  totalSafe: number;
  elapsedMs: number;
  revealedCount: number;
  myNickname: string | null;
  opponentNickname: string | null;
  opponentProgressPercent: number;
  opponentRevealedCount: number;
  opponentReconnecting: boolean;
  onReveal: (r: number, c: number) => void;
  onToggleMark: (r: number, c: number) => void;
  onChord: (r: number, c: number) => void;
  onForfeit: () => void;
}

export default function MinesweeperBattleGameView({
  board,
  rows,
  cols,
  totalSafe,
  elapsedMs,
  revealedCount,
  myNickname,
  opponentNickname,
  opponentProgressPercent,
  opponentRevealedCount,
  opponentReconnecting,
  onReveal,
  onToggleMark,
  onChord,
  onForfeit,
}: MinesweeperBattleGameViewProps) {
  const [showForfeitModal, setShowForfeitModal] = useState(false);
  const scale = useBoardScale(cols);

  // ── 마우스 이벤트 — 일반 지뢰찾기와 동일한 bitmask 방식 ───────────────

  // Record<cellKey, buttons-bitmask>: 셀별로 눌린 버튼 누적
  const mouseButtonsRef = useRef<Record<string, number>>({});

  const handleMouseDown = useCallback((e: React.MouseEvent, r: number, c: number) => {
    const cellKey = `${r}-${c}`;
    mouseButtonsRef.current[cellKey] = (mouseButtonsRef.current[cellKey] ?? 0) | e.buttons;
    if ((mouseButtonsRef.current[cellKey] & 3) === 3) onChord(r, c);
  }, [onChord]);

  const handleMouseUp = useCallback((_e: React.MouseEvent, r: number, c: number) => {
    const cellKey = `${r}-${c}`;
    mouseButtonsRef.current[cellKey] = 0;
  }, []);

  const handleMouseLeave = useCallback((r: number, c: number) => {
    const cellKey = `${r}-${c}`;
    mouseButtonsRef.current[cellKey] = 0;
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, r: number, c: number) => {
    e.preventDefault();
    // 롱프레스가 이미 toggleMark를 실행했으면 중복 방지
    if (lpFiredRef.current) return;
    // 롱프레스 타이머 실행 중이면 타이머 취소 후 여기서 처리
    if (lpRef.current !== null) {
      clearTimeout(lpRef.current);
      lpRef.current = null;
      onToggleMark(r, c);
      return;
    }
    // 데스크탑 우클릭
    onToggleMark(r, c);
  }, [onToggleMark]);

  // ── 터치 이벤트 — 일반 지뢰찾기와 동일한 방식 ───────────────────────
  // 짧은 터치 reveal은 onClick에 위임, handleTouchEnd는 lpFired 처리만 담당

  const lpRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lpFiredRef = useRef(false);

  const handleTouchStart = useCallback((r: number, c: number, e: React.TouchEvent) => {
    lpFiredRef.current = false;
    const startX = e.touches[0].clientX;
    const startY = e.touches[0].clientY;
    lpRef.current = setTimeout(() => {
      lpFiredRef.current = true;
      navigator.vibrate?.(60);
      onToggleMark(r, c);
    }, 500);
    (e.currentTarget as HTMLElement).dataset.tx = String(startX);
    (e.currentTarget as HTMLElement).dataset.ty = String(startY);
  }, [onToggleMark]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const el = e.currentTarget as HTMLElement;
    const dx = e.touches[0].clientX - Number(el.dataset.tx);
    const dy = e.touches[0].clientY - Number(el.dataset.ty);
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      if (lpRef.current) clearTimeout(lpRef.current);
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (lpRef.current) clearTimeout(lpRef.current);
    // 롱프레스가 실행됐으면 합성 click 이벤트 차단
    if (lpFiredRef.current) e.preventDefault();
  }, []);

  // ── 렌더 ─────────────────────────────────────────────────

  const totalMines = rows * cols - totalSafe;
  const elapsedSec = (elapsedMs / 1000).toFixed(1);
  const flagCount = board.flat().filter(c => c.mark === 'flag').length;
  const mineRemaining = totalMines - flagCount;
  const myProgressPct = Math.floor(revealedCount / totalSafe * 100);

  return (
    <>
      <div className={styles.gameLayout}>
        {/* 상단: 보드 영역 */}
        <div className={styles.gameMain}>
          {/* 솔로 지뢰찾기와 동일한 인포바 */}
          <div className={styles.infoBar}>
            <span className={styles.mineCount}>💣 {mineRemaining}</span>
            <span className={styles.timer}>⏱ {elapsedSec}초</span>
          </div>

          {opponentReconnecting && (
            <div style={{ fontSize: 13, color: '#e74c3c', textAlign: 'center', fontWeight: 'bold' }}>
              상대 연결 끊김 (15초 대기 중)
            </div>
          )}

          {/* 보드 래퍼: 모바일에서 scale로 축소 */}
          <div
            className={styles.boardWrapper}
            style={scale < 1 ? {
              width: cols * CELL_SIZE * scale,
              height: rows * CELL_SIZE * scale,
              overflow: 'hidden',
            } : undefined}
          >
            <div
              className={styles.board}
              style={{
                gridTemplateColumns: `repeat(${cols}, ${CELL_SIZE}px)`,
                gridTemplateRows:    `repeat(${rows}, ${CELL_SIZE}px)`,
                ...(scale < 1 ? { transform: `scale(${scale})`, transformOrigin: 'top left' } : {}),
              }}
              role="grid"
              aria-label="지뢰찾기 배틀 보드"
              onContextMenu={(e) => e.preventDefault()}
            >
              {Array.from({ length: rows }, (_, r) =>
                Array.from({ length: cols }, (_, c) => {
                  const cell = board[r]?.[c];
                  if (!cell) return null;

                  let content = '';
                  let cls = styles.cell;
                  let numColor: string | undefined;

                  if (cell.isRevealed) {
                    cls += ' ' + styles.revealed;
                    if (cell.isMine) {
                      content = '💣';
                      cls += ' ' + styles.mine;
                    } else if (cell.adjCount > 0) {
                      content = String(cell.adjCount);
                      numColor = NUM_COLORS[cell.adjCount];
                    }
                  } else if (cell.mark === 'flag') {
                    content = '🚩';
                    cls += ' ' + styles.flag;
                  } else if (cell.mark === 'question') {
                    content = '?';
                    cls += ' ' + styles.question;
                  }

                  return (
                    <div
                      key={`${r}-${c}`}
                      className={cls}
                      style={{ color: numColor }}
                      onClick={() => onReveal(r, c)}
                      onContextMenu={(e) => handleContextMenu(e, r, c)}
                      onMouseDown={(e) => handleMouseDown(e, r, c)}
                      onMouseUp={(e) => handleMouseUp(e, r, c)}
                      onMouseLeave={() => handleMouseLeave(r, c)}
                      onTouchStart={(e) => handleTouchStart(r, c, e)}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                      role="gridcell"
                      aria-label={
                        !cell.isRevealed
                          ? cell.mark === 'flag' ? '깃발' : cell.mark === 'question' ? '물음표' : '미열람'
                          : cell.isMine ? '지뢰' : cell.adjCount > 0 ? `${cell.adjCount}` : '빈 셀'
                      }
                    >
                      {content}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* 하단: 사이드패널 (상대 카드 → 내 카드 순) */}
        <div className={styles.sidePanel}>
          <OpponentProgress
            nickname={opponentNickname ?? '상대'}
            progressPercent={opponentProgressPercent}
            revealedCount={opponentRevealedCount}
          />

          <div className={`${styles.playerCard} ${styles.playerCardMe}`}>
            <div className={styles.playerNickname} title={myNickname ?? '나'}>
              {myNickname ?? '나'} (나)
            </div>
            <div className={styles.progressBarWrap}>
              <div
                className={`${styles.progressBarFill} ${styles.progressBarFillMe}`}
                style={{ width: `${Math.min(100, myProgressPct)}%` }}
              />
            </div>
            <div className={styles.progressText}>
              진행률 {myProgressPct}%
            </div>
          </div>

          <div className={styles.forfeitBtn}>
            <button
              className={styles.btnDanger}
              onClick={() => setShowForfeitModal(true)}
              type="button"
            >
              포기
            </button>
          </div>
        </div>
      </div>

      {showForfeitModal && (
        <ForfeitModal
          onConfirm={() => { setShowForfeitModal(false); onForfeit(); }}
          onCancel={() => setShowForfeitModal(false)}
        />
      )}
    </>
  );
}
