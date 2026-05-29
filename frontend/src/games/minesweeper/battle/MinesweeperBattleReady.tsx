import { useEffect, useState } from 'react';
import type { DesignatedCell } from './types';
import styles from './MinesweeperBattleBoard.module.css';

const ROWS = 9;
const COLS = 9;

interface MinesweeperBattleReadyProps {
  opponentNickname: string | null;
  myNickname: string | null;
  designatedCell: DesignatedCell;
  myFirstClickConfirmed: boolean;
  opponentFirstClickConfirmed: boolean;
  firstClickTimeoutMs: number;
  onFirstClick: () => void;
  onLeave: () => void;
}

export default function MinesweeperBattleReady({
  opponentNickname,
  myNickname,
  designatedCell,
  myFirstClickConfirmed,
  opponentFirstClickConfirmed,
  firstClickTimeoutMs,
  onFirstClick,
  onLeave,
}: MinesweeperBattleReadyProps) {
  const [remainSec, setRemainSec] = useState(Math.ceil(firstClickTimeoutMs / 1000));

  useEffect(() => {
    const interval = setInterval(() => {
      setRemainSec((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={styles.readyScreen}>
      <div className={styles.readyTitle}>
        <strong>{opponentNickname ?? '상대'}</strong>과의 대결!<br />
        가운데 셀(노란 칸)을 클릭해 시작하세요.
      </div>

      <div className={styles.readyCountdown}>
        {remainSec}초
      </div>

      {/* 9×9 보드 (모든 셀 unrevealed) */}
      <div className={styles.boardGrid} role="grid" aria-label="준비 보드">
        {Array.from({ length: ROWS }, (_, r) =>
          Array.from({ length: COLS }, (_, c) => {
            const isDesignated = r === designatedCell.r && c === designatedCell.c;
            const cellClass = [
              styles.cell,
              isDesignated ? styles.designatedCell : styles.cellUnrevealed,
            ].join(' ');
            return (
              <div
                key={`${r}-${c}`}
                className={cellClass}
                onPointerDown={(e) => {
                  if (!isDesignated || myFirstClickConfirmed) return;
                  // 마우스 우클릭/중간클릭 제외 (터치는 button=0이므로 통과)
                  if (e.button !== 0) return;
                  e.preventDefault();
                  onFirstClick();
                }}
                role="gridcell"
                aria-label={isDesignated ? '시작 셀 (클릭하세요)' : `셀 (${r},${c})`}
                tabIndex={isDesignated ? 0 : -1}
                onKeyDown={(e) => {
                  if (isDesignated && !myFirstClickConfirmed && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    onFirstClick();
                  }
                }}
              />
            );
          })
        )}
      </div>

      {/* 플레이어 카드 (상대 → 나 순서) */}
      <div className={styles.readyPlayerCards}>
        <div className={`${styles.playerCard} ${styles.playerCardOpponent}`}>
          <div className={styles.playerNickname} title={opponentNickname ?? '상대'}>
            {opponentNickname ?? '상대'}
          </div>
          <div className={`${styles.readyStatusBadge}${opponentFirstClickConfirmed ? ` ${styles.readyStatusBadgeDone}` : ''}`}>
            {opponentFirstClickConfirmed ? '클릭 완료' : '대기 중...'}
          </div>
        </div>

        <div className={`${styles.playerCard} ${styles.playerCardMe}`}>
          <div className={styles.playerNickname} title={myNickname ?? '나'}>
            {myNickname ?? '나'} (나)
          </div>
          <div className={`${styles.readyStatusBadge}${myFirstClickConfirmed ? ` ${styles.readyStatusBadgeDone}` : ''}`}>
            {myFirstClickConfirmed ? '클릭 완료' : '대기 중...'}
          </div>
        </div>
      </div>

      <button className={styles.btnSecondary} onClick={onLeave} type="button">
        나가기
      </button>
    </div>
  );
}
