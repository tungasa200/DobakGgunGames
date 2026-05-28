import type { GameResultPayload } from './types';
import styles from './MinesweeperBattleBoard.module.css';

const END_REASON_KO: Record<string, string> = {
  CLEAR:           '클리어 완료',
  MINE:            '지뢰 클릭',
  DISCONNECT:      '연결 끊김',
  LEAVE:           '기권',
  TIMEOUT:         '시간 초과',
  OPPONENT_FORFEIT:'상대 기권',
};

function toKo(reason: string): string {
  return END_REASON_KO[reason] ?? reason;
}

interface MinesweeperBattleResultProps {
  result: GameResultPayload;
  myPlayerId: string | null;
  onPlayAgain: () => void;
  onHome: () => void;
}

export default function MinesweeperBattleResult({
  result,
  myPlayerId,
  onPlayAgain,
  onHome,
}: MinesweeperBattleResultProps) {
  const myResult = result.results.find(r => r.playerId === myPlayerId);
  const opResult = result.results.find(r => r.playerId !== myPlayerId);
  const isWin = myPlayerId === result.winnerId;

  return (
    <div className={styles.resultScreen}>
      <div className={`${styles.resultTitle} ${isWin ? styles.resultWin : styles.resultLose}`}>
        {isWin ? '승리!' : '패배...'}
      </div>

      <div className={styles.resultRecords}>
        {myResult && (
          <div className={styles.resultRecord}>
            <span>
              <span className={styles.resultRecordLabel}>내 기록</span>
              {' '}
              {myResult.elapsedSeconds.toFixed(2)}초
            </span>
            <span>{toKo(myResult.endReason)}</span>
          </div>
        )}
        {opResult && (
          <div className={styles.resultRecord}>
            <span>
              <span className={styles.resultRecordLabel}>상대 기록</span>
              {' '}
              {opResult.elapsedMs > 0 ? `${opResult.elapsedSeconds.toFixed(2)}초` : '-'}
            </span>
            <span>{toKo(opResult.endReason)}</span>
          </div>
        )}
      </div>

      <div className={styles.resultBtns}>
        <button className={styles.btnPrimary} onClick={onPlayAgain} type="button">
          다시 매칭
        </button>
        <button className={styles.btnSecondary} onClick={onHome} type="button">
          홈으로
        </button>
      </div>
    </div>
  );
}
