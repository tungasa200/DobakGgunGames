import { useEffect, useState, useCallback } from 'react';
import NormalHeader from '../../../components/normal/NormalHeader';
import styles from './RpsScreens.module.css';
import RpsCard from './RpsCard';
import type { RpsCardState } from './RpsCard';
import type { RpsChoice, RpsParticipant } from '../types/rps.types';

interface GameScreenProps {
  participants: RpsParticipant[];
  myUserId: number | null;
  myChoice: RpsChoice | null;
  deadlineAt: Date;
  timeoutSeconds: number;
  chosenUserIds: Set<number>;
  onChoose: (choice: RpsChoice) => void;
  onLeave: () => void;
}

const CHOICES: RpsChoice[] = ['ROCK', 'PAPER', 'SCISSORS'];

export default function GameScreen({
  participants,
  myUserId,
  myChoice,
  deadlineAt,
  timeoutSeconds,
  chosenUserIds,
  onChoose,
  onLeave,
}: GameScreenProps) {
  const [timeLeft, setTimeLeft] = useState<number>(timeoutSeconds);
  const [shake, setShake] = useState(false);

  // 타이머 업데이트
  useEffect(() => {
    const update = () => {
      const remaining = Math.max(
        0,
        Math.ceil((deadlineAt.getTime() - Date.now()) / 1000),
      );
      setTimeLeft(remaining);

      // 0.5초 미만에서 shake
      const msLeft = deadlineAt.getTime() - Date.now();
      if (msLeft > 0 && msLeft <= 500 && myChoice === null) {
        setShake(true);
        setTimeout(() => setShake(false), 200);
      }
    };

    update();
    const id = setInterval(update, 200);
    return () => clearInterval(id);
  }, [deadlineAt, myChoice]);

  // 키보드 단축키 (선택 전에만)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (myChoice !== null) return;
      switch (e.key.toUpperCase()) {
        case 'R':
          onChoose('ROCK');
          break;
        case 'P':
          onChoose('PAPER');
          break;
        case 'S':
          onChoose('SCISSORS');
          break;
        default:
          break;
      }
    },
    [myChoice, onChoose],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const isWarn = timeLeft <= 5;
  const fillPct = timeoutSeconds > 0 ? (timeLeft / timeoutSeconds) * 100 : 0;

  function getCardState(choice: RpsChoice): RpsCardState {
    if (myChoice === null) return 'idle';
    if (choice === myChoice) return 'selected';
    return 'unselected';
  }

  return (
    <div className={styles.page}>
      <NormalHeader currentGame="online-rps" gameName="가위바위보" accentColor="#3b82f6" />

      {/* 타이머 바 + 남은 시간 */}
      <div className={styles.timerSection}>
        <div
          className={styles.timerBar}
          role="progressbar"
          aria-valuenow={timeLeft}
          aria-valuemin={0}
          aria-valuemax={timeoutSeconds}
          aria-label="선택 제한 시간"
        >
          <div
            className={`${styles.timerBarFill} ${isWarn ? styles.timerBarFillWarn : ''}`}
            style={{ width: `${fillPct}%` }}
          />
        </div>
        <span
          className={`${styles.timerCount} ${isWarn ? styles.timerCountWarn : ''}`}
          aria-live="polite"
        >
          {timeLeft}s
        </span>
      </div>

      <div className={styles.content}>
        {/* 카드 3장 */}
        <div className={styles.cardRow}>
          {CHOICES.map((choice) => (
            <RpsCard
              key={choice}
              choice={choice}
              state={getCardState(choice)}
              onClick={myChoice === null ? () => onChoose(choice) : undefined}
              showHint={myChoice === null}
              shake={shake && myChoice === null}
            />
          ))}
        </div>

        {/* 상태 메시지 */}
        <p
          className={
            myChoice !== null
              ? styles.statusMsgSelected
              : styles.statusMsg
          }
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {myChoice !== null
            ? '선택 완료! 다른 플레이어를 기다리는 중...'
            : '카드를 선택하세요'}
        </p>

        {/* 참가자 선택 현황 */}
        <div className={styles.choiceStatus}>
          {participants.map((p) => {
            const chosen = chosenUserIds.has(p.userId);
            return (
              <div
                key={p.userId}
                className={`${styles.choiceStatusItem} ${chosen ? styles.choiceStatusItemChosen : ''}`}
              >
                {chosen ? '✓' : '⏳'}
                <span>{p.nickname}</span>
                {p.userId === myUserId && (
                  <span className={styles.meBadge}>(나)</span>
                )}
              </div>
            );
          })}
        </div>

        {/* 나가기 */}
        <button
          className={styles.leaveBtn}
          onClick={onLeave}
          type="button"
        >
          나가기
        </button>
      </div>
    </div>
  );
}
