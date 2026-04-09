import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useBaseballGame, DIGIT_COUNT, MAX_ATTEMPTS, type Level } from './useBaseballGame';
import { rankingsApi } from '../../api/rankings';
import { createToken } from '../../utils/hmac';
import { useExcelShell } from '../../components/excel/ExcelShellContext';
import styles from './BaseballBoard.module.css';

const LEVELS: { value: Level; label: string }[] = [
  { value: 'easy', label: '쉬움 (3자리)' },
  { value: 'normal', label: '보통 (4자리)' },
  { value: 'hard', label: '어려움 (5자리)' },
];

interface Props {
  excel?: boolean;
}

export default function BaseballBoard({ excel = false }: Props) {
  const [level, setLevel] = useState<Level>('easy');
  const { state, reset, guess } = useBaseballGame(level);
  const [input, setInput] = useState('');
  const [hint, setHint] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // 클리어 모달
  const [modalOpen, setModalOpen] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [submitState, setSubmitState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  // 랭킹 패널
  const [rankLevel, setRankLevel] = useState<Level>('easy');
  const [rankings, setRankings] = useState<{ weekly: unknown[]; alltime: unknown | null }>({
    weekly: [],
    alltime: null,
  });
  const [rankLoading, setRankLoading] = useState(false);

  useEffect(() => {
    if (state.won) setModalOpen(true);
  }, [state.won]);

  // ===== Excel Shell 연동 =====
  const { setFormula, setStatusItems } = useExcelShell();
  useEffect(() => {
    if (!excel) return;
    setFormula('A1', `=BASEBALL_TRY(attempt,${state.attempts})`);
    setStatusItems([{ label: '시도', value: `${state.attempts} / ${MAX_ATTEMPTS[level]}` }]);
  }, [excel, state.attempts, level, setFormula, setStatusItems]);

  useEffect(() => {
    if (!modalOpen) inputRef.current?.focus();
  }, [modalOpen]);

  function handleLevelChange(lv: Level) {
    setLevel(lv);
    reset(lv);
    setInput('');
    setHint('');
  }

  function handleGuess() {
    if (state.won) return;
    const err = guess(input.trim());
    if (err) { setHint(err); return; }
    setHint('');
    setInput('');
    inputRef.current?.focus();
  }

  async function handleSubmitRanking() {
    const name = playerName.trim();
    if (!name) return;
    setSubmitState('loading');
    try {
      const { token, timestamp } = await createToken('baseball', level, state.attempts);
      await rankingsApi.submit('baseball', {
        level,
        name,
        attempts: state.attempts,
        time: state.elapsed,
        token,
        timestamp,
      });
      setSubmitState('done');
    } catch {
      setSubmitState('error');
    }
    setModalOpen(false);
    loadRanking(level);
  }

  async function loadRanking(lv: Level) {
    setRankLoading(true);
    try {
      const [weekly, alltime] = await Promise.all([
        rankingsApi.getWeekly('baseball', lv),
        rankingsApi.getAlltimeBest('baseball', lv),
      ]);
      setRankings({ weekly: weekly as unknown[], alltime });
    } catch {
      setRankings({ weekly: [], alltime: null });
    } finally {
      setRankLoading(false);
    }
  }

  const digitCount = DIGIT_COUNT[state.level];
  const maxAttempts = MAX_ATTEMPTS[state.level];

  const statusText = (() => {
    if (state.won) return `${state.attempts}번 만에 정답! (${state.elapsed.toFixed(2)}초)`;
    if (state.history.length === 0) return 'GAME START';
    const last = state.history[0];
    if (last.strikes === 0 && last.balls === 0) return '아웃!';
    const s = last.strikes > 0 ? `${last.strikes} 스트라이크` : '';
    const b = last.balls > 0 ? `${last.balls} 볼` : '';
    return [s, b].filter(Boolean).join(' ');
  })();

  return (
    <div className={`${styles.wrap} ${excel ? styles.excelMode : ''}`}>
      <div className={styles.header}>
        <Link to="/" className={styles.backLink}>← 홈</Link>
        <h2 className={styles.title}>⚾ 숫자야구{excel ? ' (엑셀 모드)' : ''}</h2>
      </div>

      {/* 난이도 선택 */}
      <div className={styles.diffRow}>
        {LEVELS.map((lv) => (
          <button
            key={lv.value}
            className={`${styles.diffBtn} ${level === lv.value ? styles.diffActive : ''}`}
            onClick={() => handleLevelChange(lv.value)}
          >
            {lv.label}
          </button>
        ))}
        <button className={styles.resetBtn} onClick={() => { reset(level); setInput(''); setHint(''); }}>
          리셋
        </button>
      </div>

      {/* 상태 바 */}
      <div className={styles.statusBar}>
        <span className={styles.status}>{statusText}</span>
        <span className={styles.timer}>⏱ {state.elapsed.toFixed(1)}초</span>
        <span className={styles.attempts}>{state.attempts}번째 시도</span>
      </div>

      {/* 입력 */}
      <div className={styles.inputRow}>
        <input
          ref={inputRef}
          className={styles.input}
          type="text"
          inputMode="numeric"
          maxLength={digitCount}
          placeholder={'_'.repeat(digitCount)}
          value={input}
          disabled={state.won}
          onChange={(e) => setInput(e.target.value.replace(/[^0-9]/g, '').slice(0, digitCount))}
          onKeyDown={(e) => { if (e.key === 'Enter') handleGuess(); }}
        />
        <button className={styles.guessBtn} disabled={state.won} onClick={handleGuess}>
          확인
        </button>
      </div>
      {hint && <p className={styles.hint}>{hint}</p>}

      {/* 기록 테이블 */}
      <table className={styles.table}>
        <thead>
          <tr><th>#</th><th>입력</th><th>스트라이크</th><th>볼</th></tr>
        </thead>
        <tbody>
          {state.history.length === 0 ? (
            <tr><td colSpan={4} className={styles.placeholder}>시도 기록이 여기에 표시됩니다.</td></tr>
          ) : (
            /* 엑셀 모드: 빈 행 미리 채워서 maxAttempts 줄 유지 */
            excel
              ? Array.from({ length: maxAttempts }, (_, i) => {
                  const row = state.history.find((r) => r.attempt === maxAttempts - i);
                  return row ? (
                    <tr key={row.attempt}>
                      <td>{row.attempt}</td>
                      <td style={{ letterSpacing: 4, fontWeight: 'bold' }}>{row.guess}</td>
                      <td className={styles.strike}>{row.strikes}S</td>
                      <td className={row.balls > 0 ? styles.ball : undefined}>
                        {row.strikes === digitCount ? '-' : row.balls > 0 ? `${row.balls}B` : '아웃'}
                      </td>
                    </tr>
                  ) : (
                    <tr key={i}><td>{maxAttempts - i}</td><td></td><td></td><td></td></tr>
                  );
                })
              : state.history.map((row) => (
                  <tr key={row.attempt}>
                    <td>{row.attempt}</td>
                    <td style={{ letterSpacing: 4, fontWeight: 'bold' }}>{row.guess}</td>
                    <td className={styles.strike}>{row.strikes}S</td>
                    <td className={row.balls > 0 ? styles.ball : undefined}>
                      {row.strikes === digitCount ? '-' : row.balls > 0 ? `${row.balls}B` : '아웃'}
                    </td>
                  </tr>
                ))
          )}
        </tbody>
      </table>

      {/* 랭킹 패널 */}
      <div className={styles.rankSection}>
        <div className={styles.rankTabs}>
          {LEVELS.map((lv) => (
            <button
              key={lv.value}
              className={`${styles.rankTab} ${rankLevel === lv.value ? styles.rankTabActive : ''}`}
              onClick={() => { setRankLevel(lv.value); loadRanking(lv.value); }}
            >
              {lv.label.split(' ')[0]}
            </button>
          ))}
        </div>
        {rankLoading ? (
          <p className={styles.placeholder}>불러오는 중...</p>
        ) : (
          <table className={styles.table}>
            <thead><tr><th>순위</th><th>이름</th><th>시도</th><th>시간</th><th>날짜</th></tr></thead>
            <tbody>
              {(rankings.weekly as Array<{ id: number; name: string; attempts: number; time: number; createdAt: string }>).length === 0 ? (
                <tr><td colSpan={5} className={styles.placeholder}>기록 없음</td></tr>
              ) : (
                (rankings.weekly as Array<{ id: number; name: string; attempts: number; time: number; createdAt: string }>).map((r, i) => (
                  <tr key={r.id}>
                    <td>{i + 1}</td>
                    <td>{r.name}</td>
                    <td>{r.attempts}번</td>
                    <td>{r.time.toFixed(2)}초</td>
                    <td>{new Date(r.createdAt).toLocaleDateString('ko-KR')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* 클리어 모달 */}
      {modalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>🎉 정답!</h3>
            <p>{state.attempts}번 시도 / {state.elapsed.toFixed(2)}초</p>
            <input
              className={styles.nameInput}
              type="text"
              placeholder="이름 입력"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitRanking(); }}
              autoFocus
            />
            {submitState === 'error' && <p className={styles.hint}>등록 실패. 다시 시도해 주세요.</p>}
            <div className={styles.modalBtns}>
              <button className={styles.guessBtn} disabled={submitState === 'loading'} onClick={handleSubmitRanking}>
                {submitState === 'loading' ? '등록 중...' : '랭킹 등록'}
              </button>
              <button className={styles.resetBtn} onClick={() => setModalOpen(false)}>건너뛰기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
