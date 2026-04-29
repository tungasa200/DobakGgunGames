import { useEffect, useState } from 'react';
import NormalHeader from '../../../components/normal/NormalHeader';
import styles from './RpsScreens.module.css';
import RpsCard from './RpsCard';
import type { RpsResult, RoundResultPayload } from '../types/rps.types';

interface ResultScreenProps {
  roundResult: RoundResultPayload;
  myUserId: number | null;
  countdown: number | null;
  maxCountdown: number;
  onLeave: () => void;
}

const RESULT_LABEL: Record<RpsResult, string> = {
  WIN: 'WIN',
  LOSS: 'LOSS',
  DRAW: 'DRAW',
};

const RESULT_SUMMARY_MAP: Record<string, string> = {};

function buildSummary(results: RoundResultPayload['results']): string {
  const choices = [...new Set(results.map((r) => r.choice))];
  if (choices.length === 1) return '전원 같은 패 → 무승부!';
  if (choices.length === 3) return '바위 · 보 · 가위 → 무승부! (상성 루프)';

  // 두 종류
  const [a, b] = choices;
  const beats: Record<string, string> = {
    ROCK: 'SCISSORS',
    SCISSORS: 'PAPER',
    PAPER: 'ROCK',
  };
  const LABEL: Record<string, string> = {
    ROCK: '바위',
    SCISSORS: '가위',
    PAPER: '보',
  };
  if (beats[a] === b) return `${LABEL[a]} vs ${LABEL[b]} → ${LABEL[a]} 승리!`;
  return `${LABEL[b]} vs ${LABEL[a]} → ${LABEL[b]} 승리!`;
}

// 결과에 따른 배너 클래스
function bannerClass(result: RpsResult): string {
  switch (result) {
    case 'WIN':  return `${styles.resultBanner} ${styles.resultBannerWin}`;
    case 'LOSS': return `${styles.resultBanner} ${styles.resultBannerLoss}`;
    case 'DRAW': return `${styles.resultBanner} ${styles.resultBannerDraw}`;
  }
}

function badgeClass(result: RpsResult): string {
  switch (result) {
    case 'WIN':  return `${styles.resultBadge} ${styles.resultBadgeWin}`;
    case 'LOSS': return `${styles.resultBadge} ${styles.resultBadgeLoss}`;
    case 'DRAW': return `${styles.resultBadge} ${styles.resultBadgeDraw}`;
  }
}

// 결과 카드 stagger 딜레이 (100ms씩)
const STAGGER_BASE_MS = 100;

// 결과 화면 최소 표시 3초 후 카운트다운 노출
const MIN_DISPLAY_MS = 3000;

export default function ResultScreen({
  roundResult,
  myUserId,
  countdown,
  maxCountdown,
  onLeave,
}: ResultScreenProps) {
  const myResult = roundResult.results.find((r) => r.userId === myUserId);
  const summary = buildSummary(roundResult.results);
  const [showCountdown, setShowCountdown] = useState(false);

  // 3초 후 카운트다운 노출
  useEffect(() => {
    const id = setTimeout(() => setShowCountdown(true), MIN_DISPLAY_MS);
    return () => clearTimeout(id);
  }, []);

  const fillPct =
    countdown !== null && maxCountdown > 0
      ? (countdown / maxCountdown) * 100
      : 0;

  // 미사용 경고 방지
  void RESULT_SUMMARY_MAP;

  return (
    <div className={styles.page}>
      <NormalHeader currentGame="online-rps" gameName="가위바위보" accentColor="#3b82f6" />

      <div className={styles.content}>
        {/* 본인 결과 배너 */}
        {myResult && (
          <div
            className={bannerClass(myResult.result)}
            role="status"
            aria-live="assertive"
            aria-atomic="true"
            aria-label={`라운드 결과: ${RESULT_LABEL[myResult.result]}`}
          >
            {RESULT_LABEL[myResult.result]}
          </div>
        )}

        {/* 결과 요약 */}
        <p className={styles.resultSummary}>{summary}</p>

        {/* 참가자 결과 카드 */}
        <div className={styles.resultCards}>
          {roundResult.results.map((r, i) => (
            <div
              key={r.userId}
              className={styles.resultCardWrapper}
              style={{ animationDelay: `${i * STAGGER_BASE_MS}ms` }}
            >
              {/* 닉네임 */}
              <div className={styles.resultCardName}>
                {r.nickname}
                {r.userId === myUserId && (
                  <span className={styles.meBadge}>(나)</span>
                )}
              </div>

              {/* 카드 */}
              <RpsCard
                choice={r.choice}
                state={r.autoPicked ? 'auto' : 'revealed'}
                result={r.result}
                autoLabel={r.autoPicked}
              />

              {/* 결과 뱃지 */}
              <span className={badgeClass(r.result)}>
                {RESULT_LABEL[r.result]}
              </span>
            </div>
          ))}
        </div>

        {/* 재도전 카운트다운 (3초 후 노출) */}
        {showCountdown && countdown !== null && countdown > 0 && (
          <div className={styles.rematchSection}>
            <p className={styles.rematchText}>
              {countdown}초 후 다음 라운드가 자동으로 시작됩니다
            </p>
            <div className={styles.rematchBar}>
              <div
                className={styles.rematchBarFill}
                style={{ width: `${fillPct}%` }}
              />
            </div>
          </div>
        )}

        {/* 나가기 버튼 */}
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
