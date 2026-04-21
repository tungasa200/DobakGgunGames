import React, { useEffect, useCallback, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExcelShell } from '../../components/excel/ExcelShellContext';
import { useRspGame } from './useRspGame';
import type { RspChoice, RspResult, HistoryEntry } from './useRspGame';
import styles from './RspBoard.module.css';

// ── 상수 ──────────────────────────────────────────────────

const CHOICE_META: Record<RspChoice, { icon: string; label: string; key: string }> = {
  SCISSORS: { icon: '✂',  label: '가위', key: '1' },
  ROCK:     { icon: '🪨', label: '바위', key: '2' },
  PAPER:    { icon: '📄', label: '보',   key: '3' },
};
const CHOICE_ORDER: RspChoice[] = ['SCISSORS', 'ROCK', 'PAPER'];

const RESULT_META: Record<RspResult, { main: string; banner: string }> = {
  WIN:  { main: '이겼습니다!', banner: styles.resultBannerWin  },
  LOSS: { main: '졌습니다...',  banner: styles.resultBannerLoss },
  DRAW: { main: '무승부',       banner: styles.resultBannerDraw },
};

function resultSubMessage(result: RspResult, user: RspChoice | null, computer: RspChoice | null): string {
  if (!user || !computer) return '';
  const u = CHOICE_META[user].label;
  const c = CHOICE_META[computer].label;
  if (result === 'WIN')  return `${u} > ${c}`;
  if (result === 'LOSS') return `${c} > ${u}`;
  return `${u} vs ${c}`;
}

function winRateDisplay(rate: number | null): string {
  if (rate === null) return '-';
  return `${(rate * 100).toFixed(1)}%`;
}

// ── Props ──────────────────────────────────────────────────

interface RspBoardProps {
  excel?: boolean;
}

// ── 일반 모드 ──────────────────────────────────────────────

function NormalRspBoard() {
  const navigate = useNavigate();
  const { state, actions } = useRspGame();
  const {
    phase, userChoice, computerChoice, roundResult,
    sessionWins, sessionLosses, sessionDraws, streak,
    totalPlays, winRate, statsLoading, errorMessage,
  } = state;
  const { submitChoice, resetSession, dismissError, nextRound } = actions;

  const isDisabled = phase === 'submitting' || phase === 'revealing';

  // 키보드 단축키
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (isDisabled) return;
      if (phase === 'result' && e.key === 'Escape') { nextRound(); return; }
      if (phase !== 'idle') return;
      if (e.key === '1') submitChoice('SCISSORS');
      else if (e.key === '2') submitChoice('ROCK');
      else if (e.key === '3') submitChoice('PAPER');
    },
    [phase, isDisabled, submitChoice, nextRound],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // 컴퓨터 카드 클래스
  const computerCardClass = (() => {
    if (phase === 'revealing') return `${styles.vsCard} ${styles.vsCardShake}`;
    if (phase === 'result' || computerChoice) {
      if (roundResult === 'WIN')  return `${styles.vsCard} ${styles.vsCardLoss}`;
      if (roundResult === 'LOSS') return `${styles.vsCard} ${styles.vsCardWin}`;
      return `${styles.vsCard} ${styles.vsCardDraw}`;
    }
    return styles.vsCard;
  })();

  // 유저 카드 클래스
  const userCardClass = (() => {
    if (!userChoice) return styles.vsCard;
    if (phase === 'submitting' || phase === 'revealing') return `${styles.vsCard} ${styles.vsCardSelected}`;
    if (phase === 'result') {
      if (roundResult === 'WIN')  return `${styles.vsCard} ${styles.vsCardWin}`;
      if (roundResult === 'LOSS') return `${styles.vsCard} ${styles.vsCardLoss}`;
      return `${styles.vsCard} ${styles.vsCardDraw}`;
    }
    return styles.vsCard;
  })();

  return (
    <div className={styles.wrap}>
      {/* 헤더 */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backLink} onClick={() => navigate('/admin')}>
            ← 어드민 홈
          </button>
        </div>
        <h1 className={styles.headerTitle}>
          <span aria-hidden="true">✂</span>
          가위바위보
        </h1>
        <div className={styles.headerRight}>
          <button
            className={styles.resetBtn}
            onClick={() => {
              if (window.confirm('이번 세션 전적을 초기화합니다. 서버 기록은 유지됩니다.')) {
                resetSession();
              }
            }}
          >
            세션 초기화
          </button>
          <button className={styles.quitBtn} onClick={() => navigate('/admin')}>
            그만하기
          </button>
        </div>
      </header>

      {/* 메인 */}
      <main className={styles.main}>
        {/* 에러 배너 */}
        {phase === 'error' && errorMessage && (
          <div
            className={styles.errorBanner}
            role="alert"
            aria-live="assertive"
          >
            <span aria-hidden="true">⚠</span>
            <span className={styles.errorBannerMsg}>{errorMessage}</span>
            <button className={styles.retryBtn} onClick={dismissError}>
              다시 시도
            </button>
          </div>
        )}

        {/* VS 보드 */}
        <div className={styles.vsBoard}>
          {/* 유저 슬롯 */}
          <div className={styles.vsSlot}>
            <div className={styles.vsSlotLabel}>나 (어드민)</div>
            <div className={userCardClass}>
              {userChoice ? (
                <>
                  <span className={styles.vsIcon} aria-hidden="true">
                    {CHOICE_META[userChoice].icon}
                  </span>
                  <span className={styles.vsChoiceLabel}>{CHOICE_META[userChoice].label}</span>
                </>
              ) : (
                <span className={styles.vsPlaceholder} aria-hidden="true">?</span>
              )}
            </div>
          </div>

          <div className={styles.vsSeparator} aria-hidden="true">VS</div>

          {/* 컴퓨터 슬롯 */}
          <div className={styles.vsSlot}>
            <div className={styles.vsSlotLabel}>컴퓨터</div>
            <div className={computerCardClass}>
              {phase === 'revealing' && (
                <span className={styles.vsPlaceholderDots} aria-hidden="true">···</span>
              )}
              {(phase === 'result') && computerChoice && (
                <>
                  <span className={`${styles.vsIcon} ${styles.vsIconFadeIn}`} aria-hidden="true">
                    {CHOICE_META[computerChoice].icon}
                  </span>
                  <span className={styles.vsChoiceLabel}>{CHOICE_META[computerChoice].label}</span>
                </>
              )}
              {(phase === 'idle' || phase === 'submitting' || phase === 'error') && (
                <span className={styles.vsPlaceholder} aria-hidden="true">?</span>
              )}
            </div>
          </div>
        </div>

        {/* 힌트 텍스트 */}
        {phase === 'idle' && (
          <p className={styles.vsHint}>아래 버튼으로 선택하세요</p>
        )}
        {phase === 'submitting' && (
          <p className={styles.submittingHint}>확인 중...</p>
        )}

        {/* 판정 결과 배너 */}
        {phase === 'result' && roundResult && (
          <div
            className={`${styles.resultBanner} ${RESULT_META[roundResult].banner}`}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <div className={styles.resultMain}>{RESULT_META[roundResult].main}</div>
            <div className={styles.resultSub}>
              {resultSubMessage(roundResult, userChoice, computerChoice)}
            </div>
          </div>
        )}

        {/* 선택 버튼 */}
        <div className={styles.choiceButtons}>
          {CHOICE_ORDER.map((choice) => {
            const meta = CHOICE_META[choice];
            const isSelected = userChoice === choice;
            const faded = isDisabled && !isSelected;

            let btnClass = styles.choiceBtn;
            if (isSelected) btnClass += ` ${styles.choiceBtnSelected}`;
            if (faded) btnClass += ` ${styles.choiceBtnFaded}`;

            return (
              <button
                key={choice}
                className={btnClass}
                onClick={() => phase === 'idle' && submitChoice(choice)}
                disabled={isDisabled}
                aria-label={`${meta.label} 선택 (단축키: ${meta.key})`}
                aria-pressed={isSelected}
                aria-disabled={isDisabled}
              >
                <span className={styles.choiceBtnIcon} aria-hidden="true">
                  {meta.icon}
                </span>
                <span className={styles.choiceBtnLabel}>{meta.label}</span>
                <span className={styles.choiceBtnShortcut} aria-hidden="true">
                  [{meta.key}]
                </span>
              </button>
            );
          })}
        </div>

        {/* 다음 판 버튼 */}
        {phase === 'result' && (
          <button
            className={styles.nextRoundBtn}
            onClick={nextRound}
          >
            다음 판
          </button>
        )}
      </main>

      {/* 통계 바 */}
      <footer className={styles.statsBar}>
        <section aria-label="전적 통계" className={styles.statsSection}>
          <span className={styles.statsLabel}>세션</span>
          <dl style={{ display: 'contents' as React.CSSProperties['display'] }}>
            <dt className="sr-only">세션 승</dt>
            <dd className={styles.statsValue} style={{ color: '#16A34A' }}>승 {sessionWins}</dd>
            <dt className="sr-only">세션 패</dt>
            <dd className={styles.statsValue} style={{ color: '#DC2626' }}>패 {sessionLosses}</dd>
            <dt className="sr-only">세션 무</dt>
            <dd className={styles.statsValue}>무 {sessionDraws}</dd>
          </dl>
        </section>

        {streak !== 0 && (
          <>
            <div className={styles.statsDivider} />
            <div className={styles.statsSection}>
              <span className={styles.statsLabel}>스트릭</span>
              <span className={streak > 0 ? styles.streakWin : styles.streakLoss}>
                {streak > 0 ? `연승 ${streak}판` : `연패 ${Math.abs(streak)}판`}
              </span>
            </div>
          </>
        )}

        <div className={styles.statsDivider} />

        <div className={styles.statsSection}>
          <span className={styles.statsLabel}>누적</span>
          {statsLoading ? (
            <span className={styles.statsLoading}>로딩 중...</span>
          ) : (
            <>
              <span className={styles.statsValue}>총 {totalPlays}판</span>
              <span className={styles.statsValue}>승률 {winRateDisplay(winRate)}</span>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}

// ── Excel 모드 시트 콘텐츠 ───────────────────────────────

interface ExcelGameSheetProps {
  state: ReturnType<typeof useRspGame>['state'];
  actions: ReturnType<typeof useRspGame>['actions'];
}

function ExcelGameSheet({ state, actions }: ExcelGameSheetProps) {
  const {
    phase, userChoice, computerChoice, roundResult,
    sessionWins, sessionLosses, sessionDraws, streak,
    totalPlays, winRate, statsLoading,
  } = state;
  const { nextRound } = actions;

  const resultRowClass = (() => {
    if (phase === 'result') {
      if (roundResult === 'WIN')  return `${styles.excelResultRow} ${styles.excelResultWin}`;
      if (roundResult === 'LOSS') return `${styles.excelResultRow} ${styles.excelResultLoss}`;
      return `${styles.excelResultRow} ${styles.excelResultDraw}`;
    }
    return `${styles.excelResultRow} ${styles.excelResultIdle}`;
  })();

  const resultText = (() => {
    if (phase === 'submitting') return '확인 중...';
    if (phase === 'revealing') return '결과 공개 중...';
    if (phase === 'result' && roundResult) {
      return RESULT_META[roundResult].main + ' — ' + resultSubMessage(roundResult, userChoice, computerChoice);
    }
    if (phase === 'error') return '#ERROR! 저장 실패';
    return '리본의 버튼으로 선택하거나 키보드 1/2/3';
  })();

  const computerAreaClass = phase === 'revealing'
    ? `${styles.excelComputerArea} ${styles.excelComputerShake}`
    : styles.excelComputerArea;

  const winRateStr = statsLoading ? '...' : winRateDisplay(winRate);
  const streakStr = streak > 0 ? `연승 ${streak}판`
    : streak < 0 ? `연패 ${Math.abs(streak)}판`
    : '-';

  return (
    <div className={styles.excelWrap}>
      <div className={styles.excelGameBoard}>
        {/* 유저 영역 */}
        <div className={styles.excelUserArea}>
          <div className={styles.vsSlotLabel} style={{ fontSize: 11, color: '#555' }}>나 (어드민)</div>
          {userChoice ? (
            <>
              <span className={styles.excelIcon} aria-hidden="true">{CHOICE_META[userChoice].icon}</span>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{CHOICE_META[userChoice].label}</span>
            </>
          ) : (
            <span style={{ fontSize: 24, color: '#bbb' }}>?</span>
          )}
        </div>

        {/* VS 구분 */}
        <div className={styles.excelVsArea} aria-hidden="true">VS</div>

        {/* 컴퓨터 영역 */}
        <div className={computerAreaClass}>
          <div className={styles.vsSlotLabel} style={{ fontSize: 11, color: '#555' }}>컴퓨터</div>
          {phase === 'revealing' && (
            <span style={{ fontSize: 20, color: '#aaa' }}>···</span>
          )}
          {(phase === 'result') && computerChoice && (
            <span className={`${styles.excelIcon} ${styles.excelComputerReveal}`} aria-hidden="true">
              {CHOICE_META[computerChoice].icon}
            </span>
          )}
          {(phase === 'idle' || phase === 'submitting' || phase === 'error') && (
            <span style={{ fontSize: 24, color: '#bbb' }}>?</span>
          )}
          {phase === 'result' && computerChoice && (
            <span style={{ fontSize: 12, fontWeight: 600 }}>{CHOICE_META[computerChoice].label}</span>
          )}
        </div>

        {/* 결과 행 */}
        <div
          className={resultRowClass}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {resultText}
          {phase === 'result' && (
            <button
              style={{
                marginLeft: 12,
                background: '#217346',
                color: 'white',
                border: 'none',
                padding: '2px 10px',
                cursor: 'pointer',
                fontSize: 12,
                borderRadius: 2,
              }}
              onClick={nextRound}
            >
              다음 판
            </button>
          )}
        </div>

        {/* 통계 헤더 */}
        <div className={styles.excelStatsHeader}>
          {['세션 승', '세션 패', '세션 무', '스트릭', '총 판', '누적 승률', ''].map((h, i) => (
            <div key={i} className={styles.excelStatsHeaderCell}>{h}</div>
          ))}
        </div>

        {/* 통계 데이터 */}
        <div className={styles.excelStatsData}>
          {[
            String(sessionWins),
            String(sessionLosses),
            String(sessionDraws),
            streakStr,
            String(totalPlays),
            winRateStr,
            '',
          ].map((v, i) => (
            <div key={i} className={styles.excelStatsDataCell}>{v}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ExcelHistorySheet({ history }: { history: HistoryEntry[] }) {
  if (history.length === 0) {
    return (
      <div className={styles.excelHistoryWrap}>
        <div className={styles.excelHistoryEmpty}>
          아직 플레이 기록이 없습니다. 게임 탭에서 플레이해보세요.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.excelHistoryWrap}>
      <table className={styles.excelHistoryTable} aria-label="세션 플레이 히스토리">
        <thead>
          <tr>
            {['#', '내 선택', '컴퓨터', '결과', '스트릭', '시각'].map(h => (
              <th key={h} className={styles.excelHistoryTh}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...history].reverse().map((entry, idx) => {
            let rowClass = styles.excelHistoryRowDraw;
            if (entry.result === 'WIN')  rowClass = styles.excelHistoryRowWin;
            if (entry.result === 'LOSS') rowClass = styles.excelHistoryRowLoss;
            if (idx % 2 === 1) rowClass += ` ${styles.excelHistoryRowAlt}`;

            const streakStr = entry.streakSnapshot > 0
              ? `연승 ${entry.streakSnapshot}판`
              : entry.streakSnapshot < 0
              ? `연패 ${Math.abs(entry.streakSnapshot)}판`
              : '-';

            const timeStr = (() => {
              try {
                return new Date(entry.playedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
              } catch {
                return entry.playedAt;
              }
            })();

            return (
              <tr key={entry.round} className={rowClass}>
                <td className={styles.excelHistoryTd}>{entry.round}</td>
                <td className={styles.excelHistoryTd}>{CHOICE_META[entry.userChoice].label}</td>
                <td className={styles.excelHistoryTd}>{CHOICE_META[entry.computerChoice].label}</td>
                <td className={styles.excelHistoryTd}>
                  {entry.result === 'WIN' ? '승리' : entry.result === 'LOSS' ? '패배' : '무승부'}
                </td>
                <td className={styles.excelHistoryTd}>{streakStr}</td>
                <td className={styles.excelHistoryTd}>{timeStr}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ExcelRulesSheet() {
  return (
    <div className={styles.excelRulesWrap}>
      <div className={styles.excelRulesTitle}>가위바위보 판정 규칙</div>
      <table className={styles.excelRulesTable} aria-label="가위바위보 판정 규칙">
        <thead>
          <tr>
            <th className={styles.excelRulesTh}>나 \ 컴퓨터</th>
            <th className={styles.excelRulesTh}>바위</th>
            <th className={styles.excelRulesTh}>가위</th>
            <th className={styles.excelRulesTh}>보</th>
          </tr>
        </thead>
        <tbody>
          {[
            { label: '바위', cols: ['무승부', '승리', '패배'] },
            { label: '가위', cols: ['패배', '무승부', '승리'] },
            { label: '보',   cols: ['승리', '패배', '무승부'] },
          ].map(row => (
            <tr key={row.label}>
              <td className={styles.excelRulesTd} style={{ fontWeight: 600, background: '#f5f5f5' }}>
                {row.label}
              </td>
              {row.cols.map((c, i) => (
                <td key={i} className={styles.excelRulesTd}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className={styles.excelRulesNote}>※ 무승부는 연승·연패 스트릭에 영향 없음</p>
      <p className={styles.excelRulesNote}>※ 매 판 결과는 서버에 저장됩니다</p>
    </div>
  );
}

// ── Excel 모드 래퍼 ──────────────────────────────────────

function ExcelRspBoard() {
  const { state, actions } = useRspGame();
  const {
    phase, userChoice, computerChoice, roundResult,
    sessionWins, sessionLosses, sessionDraws, streak,
    totalPlays, winRate, statsLoading, history,
  } = state;
  const { submitChoice, resetSession, nextRound } = actions;

  const {
    setFormula,
    setStatusItems,
    activeSheet,
    setRibbonGameGroup,
    registerNewGame,
  } = useExcelShell();

  const isDisabled = phase === 'submitting' || phase === 'revealing';

  // 수식바 업데이트
  useEffect(() => {
    const choiceLabel = (c: RspChoice | null) => (c ? CHOICE_META[c].label : '');

    switch (phase) {
      case 'idle':
        setFormula('B2', '');
        break;
      case 'submitting':
        setFormula('B2', '=SUBMITTING()');
        break;
      case 'revealing':
        setFormula('C2', '=RESULT_PENDING');
        break;
      case 'result':
        if (roundResult && userChoice && computerChoice) {
          setFormula(
            'D2',
            `=${roundResult}("${choiceLabel(userChoice)}","${choiceLabel(computerChoice)}")`,
          );
        }
        break;
      case 'error':
        setFormula('B2', '#ERROR!');
        break;
    }
  }, [phase, roundResult, userChoice, computerChoice, setFormula]);

  // 상태바 업데이트
  useEffect(() => {
    const streakLabel = streak > 0 ? `연승 ${streak}판`
      : streak < 0 ? `연패 ${Math.abs(streak)}판`
      : '스트릭 없음';
    const sessionLabel = `승${sessionWins}/패${sessionLosses}/무${sessionDraws}`;
    const winRateLabel = statsLoading ? '...' : winRateDisplay(winRate);

    setStatusItems([
      { label: '스트릭', value: streakLabel },
      { label: '세션', value: sessionLabel },
      { label: '누적', value: `${totalPlays}판 ${winRateLabel}` },
    ]);
  }, [streak, sessionWins, sessionLosses, sessionDraws, totalPlays, winRate, statsLoading, setStatusItems]);

  // 리본 게임 그룹
  useEffect(() => {
    const ribbonNode: ReactNode = (
      <div className={styles.xrgGame}>
        <div className={styles.xrgBtns}>
          {CHOICE_ORDER.map((choice) => (
            <div
              key={choice}
              className={`${styles.xrb} ${isDisabled ? styles.xrbDisabled : ''}`}
              onClick={() => !isDisabled && submitChoice(choice)}
              role="button"
              tabIndex={isDisabled ? -1 : 0}
              aria-label={`${CHOICE_META[choice].label} 선택`}
              aria-disabled={isDisabled}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !isDisabled) {
                  submitChoice(choice);
                }
              }}
            >
              <span className={styles.xrbIcon} aria-hidden="true">{CHOICE_META[choice].icon}</span>
              <span>{CHOICE_META[choice].label}</span>
            </div>
          ))}
          {phase === 'result' && (
            <div
              className={styles.xrb}
              onClick={nextRound}
              role="button"
              tabIndex={0}
              aria-label="다음 판"
            >
              <span className={styles.xrbIcon} aria-hidden="true">▶</span>
              <span>다음 판</span>
            </div>
          )}
          <div
            className={styles.xrb}
            onClick={resetSession}
            role="button"
            tabIndex={0}
            aria-label="세션 초기화"
          >
            <span className={styles.xrbIcon} aria-hidden="true">🔄</span>
            <span>초기화</span>
          </div>
        </div>
        <div className={styles.xrgLabel}>게임</div>
      </div>
    );
    setRibbonGameGroup(ribbonNode);
  }, [isDisabled, phase, submitChoice, nextRound, resetSession, setRibbonGameGroup]);

  // 새 게임 콜백 등록
  useEffect(() => {
    registerNewGame(resetSession);
  }, [registerNewGame, resetSession]);

  // 키보드 단축키
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isDisabled) return;
      if (phase === 'result' && e.key === 'Escape') { nextRound(); return; }
      if (phase !== 'idle') return;
      if (e.key === '1') submitChoice('SCISSORS');
      else if (e.key === '2') submitChoice('ROCK');
      else if (e.key === '3') submitChoice('PAPER');
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, isDisabled, submitChoice, nextRound]);

  // 시트별 렌더링 ('ranking' 탭을 히스토리로 재사용)
  if (activeSheet === 'ranking') {
    return <ExcelHistorySheet history={history} />;
  }
  if (activeSheet === 'rules') {
    return <ExcelRulesSheet />;
  }

  // 'game' 탭
  return (
    <ExcelGameSheet state={state} actions={actions} />
  );
}

// ── 외부 노출 컴포넌트 ──────────────────────────────────

export default function RspBoard({ excel = false }: RspBoardProps) {
  if (excel) {
    return <ExcelRspBoard />;
  }
  return <NormalRspBoard />;
}

