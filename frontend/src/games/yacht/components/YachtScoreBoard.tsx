import styles from './yacht.module.css';
import type { Participant, PlayerScore, ScoreKey, DiceType } from '../types/yacht.types';
import {
  SCORE_KEYS_BY_MODE,
  UPPER_SCORE_KEYS_BY_MODE,
  LOWER_SCORE_KEYS,
  UPPER_BONUS_THRESHOLD_BY_MODE,
  SCORE_LABELS,
} from '../types/yacht.types';
import { calcScore } from '../types/scoreCalc';

interface YachtScoreBoardProps {
  players: Participant[];
  playerScores: PlayerScore[];
  currentTurnUserId: number;
  myUserId: number | null;
  currentDice: number[] | null;
  isMyTurn: boolean;
  rollsUsed: number;       // maxRolls - rollsLeft (D6=3 / D8=4). 0이면 아직 미굴림.
  onSelectScore: (scoreKey: ScoreKey) => void;
  diceType?: DiceType;
}

const UPPER_BONUS_VALUE = 35;

function getUpperTotal(
  scores: Partial<Record<ScoreKey, number>>,
  upperKeys: ScoreKey[],
): number {
  return upperKeys.reduce((sum, k) => sum + (scores[k] ?? 0), 0);
}

function isUpperComplete(
  scores: Partial<Record<ScoreKey, number>>,
  upperKeys: ScoreKey[],
): boolean {
  return upperKeys.every((k) => scores[k] !== undefined);
}

function getScoreForPlayer(
  ps: PlayerScore,
  key: ScoreKey,
  isMyTurn: boolean,
  rollsUsed: number,
  currentDice: number[] | null,
  diceType: DiceType,
): { value: number | null; isPreview: boolean } {
  const recorded = ps.scores[key];
  if (recorded !== undefined) return { value: recorded, isPreview: false };

  if (isMyTurn && rollsUsed >= 1 && currentDice && currentDice.every((d) => d > 0)) {
    return { value: calcScore(key, currentDice, diceType), isPreview: true };
  }
  return { value: null, isPreview: false };
}

export default function YachtScoreBoard({
  players,
  playerScores,
  currentTurnUserId,
  myUserId,
  currentDice,
  isMyTurn,
  rollsUsed,
  onSelectScore,
  diceType = 'D6',
}: YachtScoreBoardProps) {
  const upperKeys = UPPER_SCORE_KEYS_BY_MODE[diceType];
  const bonusThreshold = UPPER_BONUS_THRESHOLD_BY_MODE[diceType];
  const scoreKeys = SCORE_KEYS_BY_MODE[diceType];
  const isD8 = diceType === 'D8';

  // 관전자(isSpectator=true)는 점수판 컬럼에서 제외
  const scoringPlayers = players.filter((p) => !p.isSpectator);

  const orderedScores: PlayerScore[] = scoringPlayers.map((p) => {
    const found = playerScores.find((ps) => ps.userId === p.userId);
    return found ?? {
      userId: p.userId,
      scores: {},
      upperTotal: 0,
      bonusEarned: false,
      grandTotal: 0,
    };
  });

  const canSelect = isMyTurn && rollsUsed >= 1;

  function renderScoreCell(ps: PlayerScore, key: ScoreKey, colIdx: number) {
    const isMe = ps.userId === myUserId;
    const isActive = ps.userId === currentTurnUserId;
    const recorded = ps.scores[key];
    const isRecorded = recorded !== undefined;

    let cellClass = '';
    if (isMe) cellClass += ` ${styles.myScoreCol}`;
    else if (isActive) cellClass += ` ${styles.activePlayerCol}`;

    if (isRecorded) {
      return (
        <td key={colIdx} className={cellClass}>
          <span className={styles.scoreValueFilled}>{recorded}</span>
        </td>
      );
    }

    if (canSelect && isMe) {
      const preview = currentDice && currentDice.every((d) => d > 0)
        ? calcScore(key, currentDice, diceType)
        : null;
      return (
        <td
          key={colIdx}
          className={`${cellClass} ${styles.scoreRowSelectable}`}
          onClick={() => onSelectScore(key)}
          role="button"
          tabIndex={0}
          aria-label={`${SCORE_LABELS[key]} 선택 (${preview !== null ? preview + '점' : ''})`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelectScore(key);
            }
          }}
        >
          {preview !== null ? (
            <span className={styles.scoreValuePreview}>{preview}</span>
          ) : (
            <span className={styles.scoreValueEmpty}>-</span>
          )}
        </td>
      );
    }

    return (
      <td key={colIdx} className={cellClass}>
        <span className={styles.scoreValueEmpty}>-</span>
      </td>
    );
  }

  function renderSeparatorRow(label: string) {
    return (
      <tr key={`sep-${label}`} className={styles.scoreSeparatorRow}>
        <td className={styles.scoreLabelCell}>{label}</td>
        {orderedScores.map((ps, i) => {
          const upper = getUpperTotal(ps.scores, upperKeys);
          const complete = isUpperComplete(ps.scores, upperKeys);
          const isMe = ps.userId === myUserId;
          const isActive = ps.userId === currentTurnUserId;
          let cellClass = '';
          if (isMe) cellClass = styles.myScoreCol;
          else if (isActive) cellClass = styles.activePlayerCol;

          if (label === '상단 합계') {
            return (
              <td key={i} className={cellClass}>
                <div>{upper}</div>
                {!complete && (
                  <div className={styles.bonusProgress}>
                    /{bonusThreshold}
                  </div>
                )}
              </td>
            );
          }
          if (label === '상단 보너스') {
            const bonusText = complete
              ? (upper >= bonusThreshold ? `+${UPPER_BONUS_VALUE}` : '0')
              : '?';
            return (
              <td key={i} className={cellClass}>
                {bonusText}
              </td>
            );
          }
          return <td key={i} className={cellClass} />;
        })}
      </tr>
    );
  }

  return (
    <div className={`${styles.scoreBoardContainer} ${isD8 ? styles.scoreBoardD8 : ''}`}>
      <p className={styles.scoreBoardTitle}>점수판</p>
      <div style={{ overflowX: 'auto' }}>
        <table className={styles.scoreBoard}>
          <thead>
            <tr>
              <th style={{ width: '110px', textAlign: 'left', paddingLeft: '8px' }}>족보</th>
              {scoringPlayers.map((p) => (
                <th
                  key={p.userId}
                  className={[
                    p.userId === myUserId ? styles.myScoreCol : '',
                    p.userId === currentTurnUserId ? styles.activePlayerCol : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={{
                    maxWidth: '70px',
                    color: p.isReconnecting ? 'var(--yacht-danger)' : undefined,
                  }}
                >
                  {p.nickname.length > 6 ? p.nickname.slice(0, 5) + '…' : p.nickname}
                  {p.userId === currentTurnUserId && ' *'}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* 상단 (D6: 6개, D8: 8개) */}
            {upperKeys.map((key) => (
              <tr key={key}>
                <td className={styles.scoreLabelCell}>{SCORE_LABELS[key]}</td>
                {orderedScores.map((ps, i) => {
                  const { value, isPreview } = getScoreForPlayer(
                    ps, key,
                    isMyTurn && ps.userId === myUserId,
                    rollsUsed,
                    currentDice,
                    diceType,
                  );
                  const isMe = ps.userId === myUserId;
                  const isActive = ps.userId === currentTurnUserId;
                  const recorded = ps.scores[key] !== undefined;
                  let cellClass = '';
                  if (isMe) cellClass = styles.myScoreCol;
                  else if (isActive) cellClass = styles.activePlayerCol;

                  if (recorded) {
                    return (
                      <td key={i} className={cellClass}>
                        <span className={styles.scoreValueFilled}>{value}</span>
                      </td>
                    );
                  }

                  if (canSelect && isMe) {
                    return (
                      <td
                        key={i}
                        className={`${cellClass} ${styles.scoreRowSelectable}`}
                        onClick={() => onSelectScore(key)}
                        role="button"
                        tabIndex={0}
                        aria-label={`${SCORE_LABELS[key]} 선택${isPreview && value !== null ? ` (${value}점)` : ''}`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onSelectScore(key);
                          }
                        }}
                      >
                        {isPreview && value !== null ? (
                          <span className={styles.scoreValuePreview}>{value}</span>
                        ) : (
                          <span className={styles.scoreValueEmpty}>-</span>
                        )}
                      </td>
                    );
                  }

                  return (
                    <td key={i} className={cellClass}>
                      <span className={styles.scoreValueEmpty}>-</span>
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* 상단 합계 + 보너스 구분행 */}
            {renderSeparatorRow('상단 합계')}
            {renderSeparatorRow('상단 보너스')}

            {/* 하단 6개 (공통) */}
            {LOWER_SCORE_KEYS.map((key) => (
              <tr key={key}>
                <td className={styles.scoreLabelCell}>{SCORE_LABELS[key]}</td>
                {orderedScores.map((ps, i) => renderScoreCell(ps, key, i))}
              </tr>
            ))}

            {/* 총합 */}
            <tr className={styles.scoreTotalRow}>
              <td className={styles.scoreLabelCell}>총합</td>
              {orderedScores.map((ps, i) => {
                const isMe = ps.userId === myUserId;
                const isActive = ps.userId === currentTurnUserId;
                let cellClass = '';
                if (isMe) cellClass = styles.myScoreCol;
                else if (isActive) cellClass = styles.activePlayerCol;
                return (
                  <td key={i} className={cellClass}>
                    <strong>{ps.grandTotal}</strong>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* 전체 족보 중 아직 미사용 항목 수 표시 (내 플레이어) */}
      {myUserId !== null && (() => {
        const myScore = orderedScores.find((ps) => ps.userId === myUserId);
        if (!myScore) return null;
        const remaining = scoreKeys.filter((k) => myScore.scores[k] === undefined).length;
        return (
          <p style={{ fontSize: '0.72rem', color: 'var(--yacht-text-sub)', marginTop: '6px', textAlign: 'center' }}>
            남은 족보: {remaining}칸
          </p>
        );
      })()}
    </div>
  );
}
