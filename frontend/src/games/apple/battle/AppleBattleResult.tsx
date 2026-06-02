import type { GameResultPayload, AbPlayerInfo } from './types';
import styles from './AppleBattleBoard.module.css';

interface Props {
  result: GameResultPayload;
  myPlayerId: string;
  players: AbPlayerInfo[];
  onRematch: () => void;
  onExit: () => void;
  myRematchRequested: boolean;
  opponentRematchRequested: boolean;
}

const REASON_LABEL: Record<GameResultPayload['reason'], string> = {
  TIME_UP: '2분 종료',
  BOARD_CLEARED: '보드 완전 클리어!',
  OPPONENT_LEFT: '상대 이탈로 승리',
};

export default function AppleBattleResult({
  result,
  myPlayerId,
  players,
  onRematch,
  onExit,
  myRematchRequested,
  opponentRematchRequested,
}: Props) {
  const me = players.find(p => p.playerId === myPlayerId);
  const opponent = players.find(p => p.playerId !== myPlayerId);

  const myScore = result.scores[myPlayerId] ?? 0;
  const opponentScore = opponent ? (result.scores[opponent.playerId] ?? 0) : 0;

  const isWin = result.winnerId === myPlayerId;
  const isDraw = result.draw;

  let titleText: string;
  let titleClass: string;
  if (isDraw) {
    titleText = '무승부';
    titleClass = styles.resultTitleDraw;
  } else if (isWin) {
    titleText = '승리!';
    titleClass = styles.resultTitleWin;
  } else {
    titleText = '패배';
    titleClass = styles.resultTitleLose;
  }

  // 재대결 버튼 텍스트
  let rematchBtnText = '재대결 요청';
  if (myRematchRequested && opponentRematchRequested) {
    rematchBtnText = '수락';
  } else if (myRematchRequested) {
    rematchBtnText = '상대방 수락 대기 중...';
  } else if (opponentRematchRequested) {
    rematchBtnText = '재대결 수락';
  }

  return (
    <div className={styles.resultModalBackdrop}>
      <div className={styles.resultModal}>
        <div className={`${styles.resultTitle} ${titleClass}`}>{titleText}</div>
        <div className={styles.resultReason}>{REASON_LABEL[result.reason]}</div>

        <div className={styles.resultScoreRow}>
          <div className={`${styles.resultScoreItem} ${styles.resultScoreItemMe}`}>
            <span className={styles.resultScoreName}>{me?.nickname ?? '나'} (나)</span>
            <span className={styles.resultScoreValue}>{myScore}점</span>
          </div>
          <div className={`${styles.resultScoreItem} ${styles.resultScoreItemOpp}`}>
            <span className={styles.resultScoreName}>{opponent?.nickname ?? '상대'}</span>
            <span className={styles.resultScoreValue}>{opponentScore}점</span>
          </div>
        </div>

        {opponentRematchRequested && !myRematchRequested && (
          <div className={styles.rematchNotice}>상대방이 재대결을 요청했습니다!</div>
        )}
        {myRematchRequested && !opponentRematchRequested && (
          <div className={styles.rematchNotice}>상대방의 응답을 기다리는 중...</div>
        )}

        <div className={styles.resultBtns}>
          <button
            className={styles.btnPrimary}
            onClick={onRematch}
            disabled={myRematchRequested && !opponentRematchRequested}
            type="button"
          >
            {rematchBtnText}
          </button>
          <button
            className={styles.btnSecondary}
            onClick={onExit}
            type="button"
          >
            나가기
          </button>
        </div>
      </div>
    </div>
  );
}
