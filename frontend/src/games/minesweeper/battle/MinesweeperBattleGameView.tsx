import { useState, useCallback, useRef } from 'react';
import type { BattleCell } from './types';
import OpponentProgress from './OpponentProgress';
import styles from './MinesweeperBattleBoard.module.css';

const ROWS = 9;
const COLS = 9;
const TOTAL_SAFE = 71;

// 숫자 색상 매핑
const NUM_CLASS: Record<number, string> = {
  1: styles.n1, 2: styles.n2, 3: styles.n3, 4: styles.n4,
  5: styles.n5, 6: styles.n6, 7: styles.n7, 8: styles.n8,
};

function getCellContent(cell: BattleCell): string {
  if (!cell.isRevealed) {
    if (cell.mark === 'flag') return 'F';
    if (cell.mark === 'question') return '?';
    return '';
  }
  if (cell.isMine) return '*';
  if (cell.adjCount > 0) return String(cell.adjCount);
  return '';
}

function getCellClass(cell: BattleCell): string {
  const base = styles.cell;
  if (!cell.isRevealed) {
    if (cell.mark === 'flag')     return `${base} ${styles.cellFlag}`;
    if (cell.mark === 'question') return `${base} ${styles.cellQuestion}`;
    return `${base} ${styles.cellUnrevealed}`;
  }
  if (cell.isMine) return `${base} ${styles.cellMine}`;
  if (cell.adjCount > 0) return `${base} ${styles.cellRevealed} ${NUM_CLASS[cell.adjCount] ?? ''}`;
  return `${base} ${styles.cellRevealed}`;
}

// 포기 확인 모달
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
  myProgressPercent: number;
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
  myProgressPercent,
  opponentProgressPercent,
  opponentRevealedCount,
  opponentReconnecting,
  onReveal,
  onToggleMark,
  onChord,
  onForfeit,
}: MinesweeperBattleGameViewProps) {
  const [showForfeitModal, setShowForfeitModal] = useState(false);

  // chord click: ref 기반으로 현재 눌린 버튼 추적 (Set은 ref로 처리)
  const pressedButtonsRef = useRef<Set<number>>(new Set());

  const handleMouseDown = useCallback((e: React.MouseEvent, r: number, c: number) => {
    e.preventDefault();
    pressedButtonsRef.current.add(e.button);

    // 가운데 버튼
    if (e.button === 1) {
      onChord(r, c);
    }
  }, [onChord]);

  const handleMouseUp = useCallback((e: React.MouseEvent, r: number, c: number) => {
    e.preventDefault();
    const hadBoth = pressedButtonsRef.current.has(0) && pressedButtonsRef.current.has(2);
    pressedButtonsRef.current.delete(e.button);

    // 좌우 동시 클릭 chord
    if (hadBoth) {
      onChord(r, c);
      return;
    }

    if (e.button === 0) {
      const cell = board[r]?.[c];
      if (cell?.isRevealed) {
        // 이미 revealed인 셀 좌클릭 → chord 시도
        onChord(r, c);
      } else {
        onReveal(r, c);
      }
    }
  }, [board, onReveal, onChord]);

  const handleContextMenu = useCallback((e: React.MouseEvent, r: number, c: number) => {
    e.preventDefault();
    const cell = board[r]?.[c];
    if (!cell?.isRevealed) {
      onToggleMark(r, c);
    }
  }, [board, onToggleMark]);

  const elapsedSec = (elapsedMs / 1000).toFixed(2);
  const remaining = TOTAL_SAFE - revealedCount;

  return (
    <>
      <div className={styles.gameLayout}>
        {/* 좌측: 보드 영역 (65%) */}
        <div className={styles.gameMain}>
          <div className={styles.gameHeader}>
            <span className={styles.timerDisplay}>{elapsedSec}초</span>
            <span className={styles.safeCellsDisplay}>남은 안전 셀: {remaining} / {TOTAL_SAFE}</span>
          </div>

          {/* 상대 연결 끊김 알림 */}
          {opponentReconnecting && (
            <div style={{ fontSize: 13, color: '#fca5a5', textAlign: 'center' }}>
              상대 연결 끊김 (15초 대기 중)
            </div>
          )}

          <div
            className={styles.boardGrid}
            role="grid"
            aria-label="지뢰찾기 배틀 보드"
            onContextMenu={(e) => e.preventDefault()}
          >
            {Array.from({ length: ROWS }, (_, r) =>
              Array.from({ length: COLS }, (_, c) => {
                const cell = board[r]?.[c];
                if (!cell) return null;
                const content = getCellContent(cell);
                return (
                  <div
                    key={`${r}-${c}`}
                    className={getCellClass(cell)}
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

        {/* 우측: 사이드패널 (35%) */}
        <div className={styles.sidePanel}>
          {/* 상대 정보 */}
          <OpponentProgress
            nickname={opponentNickname ?? '상대'}
            progressPercent={opponentProgressPercent}
            revealedCount={opponentRevealedCount}
          />

          {/* 본인 정보 */}
          <div className={`${styles.playerCard} ${styles.playerCardMe}`}>
            <div className={styles.playerNickname} title={myNickname ?? '나'}>
              {myNickname ?? '나'} (나)
            </div>
            <div className={styles.progressBarWrap}>
              <div
                className={`${styles.progressBarFill} ${styles.progressBarFillMe}`}
                style={{ width: `${Math.min(100, myProgressPercent)}%` }}
              />
            </div>
            <div className={styles.progressText}>
              내 진행률 {myProgressPercent}%
            </div>
          </div>

          {/* 포기 버튼 */}
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

      {/* 포기 확인 모달 */}
      {showForfeitModal && (
        <ForfeitModal
          onConfirm={() => { setShowForfeitModal(false); onForfeit(); }}
          onCancel={() => setShowForfeitModal(false)}
        />
      )}
    </>
  );
}

