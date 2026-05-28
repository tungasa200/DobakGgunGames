import { useState, useCallback, useRef } from 'react';
import type { BattleCell } from './types';
import OpponentProgress from './OpponentProgress';
import styles from './MinesweeperBattleBoard.module.css';

const ROWS = 9;
const COLS = 9;
const CELL_SIZE = 30;
const TOTAL_MINES = 10;
const TOTAL_SAFE = 71;

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
  const pressedButtonsRef = useRef<Set<number>>(new Set());

  const handleMouseDown = useCallback((e: React.MouseEvent, r: number, c: number) => {
    e.preventDefault();
    pressedButtonsRef.current.add(e.button);
    if (e.button === 1) onChord(r, c);
  }, [onChord]);

  const handleMouseUp = useCallback((e: React.MouseEvent, r: number, c: number) => {
    e.preventDefault();
    const hadBoth = pressedButtonsRef.current.has(0) && pressedButtonsRef.current.has(2);
    pressedButtonsRef.current.delete(e.button);

    if (hadBoth) {
      onChord(r, c);
      return;
    }
    if (e.button === 0) {
      const cell = board[r]?.[c];
      if (cell?.isRevealed) {
        onChord(r, c);
      } else {
        onReveal(r, c);
      }
    }
  }, [board, onReveal, onChord]);

  const handleContextMenu = useCallback((e: React.MouseEvent, r: number, c: number) => {
    e.preventDefault();
    const cell = board[r]?.[c];
    if (!cell?.isRevealed) onToggleMark(r, c);
  }, [board, onToggleMark]);

  const elapsedSec = (elapsedMs / 1000).toFixed(1);
  const flagCount = board.flat().filter(c => c.mark === 'flag').length;
  const mineRemaining = TOTAL_MINES - flagCount;
  const myProgressPct = Math.floor(revealedCount / TOTAL_SAFE * 100);

  return (
    <>
      <div className={styles.gameLayout}>
        {/* 좌측: 보드 영역 */}
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

          {/* 보드 래퍼: 솔로와 동일한 스타일 */}
          <div className={styles.boardWrapper}>
            <div
              className={styles.board}
              style={{
                gridTemplateColumns: `repeat(${COLS}, ${CELL_SIZE}px)`,
                gridTemplateRows:    `repeat(${ROWS}, ${CELL_SIZE}px)`,
              }}
              role="grid"
              aria-label="지뢰찾기 배틀 보드"
              onContextMenu={(e) => e.preventDefault()}
            >
              {Array.from({ length: ROWS }, (_, r) =>
                Array.from({ length: COLS }, (_, c) => {
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
                      onMouseDown={(e) => handleMouseDown(e, r, c)}
                      onMouseUp={(e) => handleMouseUp(e, r, c)}
                      onContextMenu={(e) => handleContextMenu(e, r, c)}
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

        {/* 우측: 사이드패널 */}
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
