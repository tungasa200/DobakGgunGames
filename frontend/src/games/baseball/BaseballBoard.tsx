import { useCallback, useEffect, useRef, useState } from 'react';
import { useBaseballGame, DIGIT_COUNT, MAX_ATTEMPTS, type Level } from './useBaseballGame';
import { rankingsApi } from '../../api/rankings';
import { createToken } from '../../utils/hmac';
import { useExcelShell } from '../../components/excel/ExcelShellContext';
import styles from './BaseballBoard.module.css';

// 열 라벨 헬퍼 (A, B, C, ..., AA, ...)
function colLabel(i: number): string {
  let label = '';
  let n = i + 1;
  while (n > 0) {
    n--;
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26);
  }
  return label;
}

// 주간 날짜 범위 문자열
function weekRange(): string {
  const now = new Date();
  const day = now.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const mon = new Date(now); mon.setDate(now.getDate() + diffToMon);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  return `주간 랭킹 (${fmt(mon)} ~ ${fmt(sun)})`;
}

const LEVELS: { value: Level; label: string; shortLabel: string; icon: string }[] = [
  { value: 'easy',   label: '쉬움 (3자리)', shortLabel: '쉬움', icon: '📈' },
  { value: 'normal', label: '보통 (4자리)', shortLabel: '보통', icon: '📊' },
  { value: 'hard',   label: '어려움 (5자리)', shortLabel: '어려움', icon: '📉' },
];

interface Props { excel?: boolean }

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
    weekly: [], alltime: null,
  });
  const [rankLoading, setRankLoading] = useState(false);
  const [showRules, setShowRules] = useState(false);

  useEffect(() => { if (state.won) setModalOpen(true); }, [state.won]);

  // ===== Excel Shell 연동 =====
  const { setFormula, setStatusItems, activeSheet, setRibbonGameGroup, sheetSize } = useExcelShell();
  useEffect(() => {
    if (!excel) return;
    setFormula('A1', `=BASEBALL_TRY(attempt,${state.attempts})`);
    setStatusItems([{ label: '시도', value: `${state.attempts} / ${MAX_ATTEMPTS[level]}` }]);
  }, [excel, state.attempts, level, setFormula, setStatusItems]);

  // 엑셀 리본 게임 그룹
  const handleLevelChange = useCallback((lv: Level) => {
    setLevel(lv);
    reset(lv);
    setInput('');
    setHint('');
  }, [reset]);

  useEffect(() => {
    if (!excel) {
      setRibbonGameGroup(null);
      return;
    }
    setRibbonGameGroup(
      <div className={styles.xrgGame}>
        <div className={styles.xrgBtns}>
          {LEVELS.map((lv) => (
            <div
              key={lv.value}
              className={`${styles.xrb} ${level === lv.value ? styles.xrbActive : ''}`}
              onClick={() => handleLevelChange(lv.value)}
            >
              <span className={styles.xrbIcon}>{lv.icon}</span>
              <span>{lv.shortLabel}</span>
            </div>
          ))}
          <div className={styles.xrb} onClick={() => { reset(level); setInput(''); setHint(''); }}>
            <span className={styles.xrbIcon}>🔄</span>
            <span>새 시트</span>
          </div>
        </div>
        <div className={styles.xrgLabel}>데이터 분석</div>
      </div>
    );
  }, [excel, level, handleLevelChange, reset, setRibbonGameGroup]);

  // 엑셀 모드: 랭킹 시트 진입 시 자동 로드
  useEffect(() => {
    if (!excel || activeSheet !== 'ranking') return;
    loadRanking(rankLevel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excel, activeSheet]);

  useEffect(() => {
    if (!modalOpen) inputRef.current?.focus();
  }, [modalOpen]);

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
      await rankingsApi.submit('baseball', { level, name, attempts: state.attempts, time: state.elapsed, token, timestamp });
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

  const showGameArea    = !excel || activeSheet === 'game';
  const showRankingArea = !excel || activeSheet === 'ranking';
  const showRulesArea   = !excel ? showRules : activeSheet === 'rules';

  type HistoryRow = { attempt: number; guess: string; strikes: number; balls: number };

  // ===== 엑셀 랭킹 시트 헬퍼 =====
  const CELL_W = 96;
  const CELL_H = 29;
  const RANK_COLS = [
    { label: '순위', span: 1 },
    { label: '이름', span: 2 },
    { label: '시도', span: 1 },
    { label: '시간', span: 1 },
    { label: '날짜', span: 1 },
  ];
  const RANK_TOTAL = RANK_COLS.reduce((s, c) => s + c.span, 0); // 6
  const RULES_TOTAL = 5;

  return (
    <div className={`${styles.wrap} ${excel ? styles.excelMode : ''}`}>

      {/* 난이도 — 일반 모드에서만 */}
      {!excel && (
        <div className={styles.diffRow}>
          {LEVELS.map((lv) => (
            <button
              key={lv.value}
              className={`${styles.diffBtn} ${level === lv.value ? styles.diffActive : ''}`}
              onClick={() => handleLevelChange(lv.value)}
            >{lv.label}</button>
          ))}
        </div>
      )}

      {/* 상태 — 일반 모드에서만 */}
      {!excel && (
        <div className={styles.statusBar}>
          <span className={styles.attempts}>{state.attempts}번째 시도</span>
          <span className={styles.timer}>⏱ {state.elapsed.toFixed(1)}초</span>
        </div>
      )}

      {/* 게임 영역 — 게임 시트 */}
      {showGameArea && (
        <div className={excel ? styles.excelGameRow : undefined}>
          <div>
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
            {/* 힌트 — 엑셀 모드에서는 항상 렌더 (높이 유지) */}
            {(hint || excel) ? (
              <p className={styles.hint}>{hint}</p>
            ) : (
              hint && <p className={styles.hint}>{hint}</p>
            )}

            {/* 히스토리 테이블 */}
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr><th>#</th><th>입력</th><th>스트라이크</th><th>볼</th></tr>
                </thead>
                <tbody>
                  {state.history.length === 0 && !excel ? (
                    <tr><td colSpan={4} className={styles.placeholder}>입력 기록이 여기에 표시됩니다.</td></tr>
                  ) : (
                    Array.from({ length: maxAttempts }, (_, i) => {
                      const row = (state.history as HistoryRow[]).find((r) => r.attempt === maxAttempts - i);
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
                  )}
                </tbody>
              </table>
            </div>

            {/* 리셋 버튼 — 일반 모드 */}
            {!excel && (
              <button className={styles.resetBtn} onClick={() => { reset(level); setInput(''); setHint(''); }}>
                RESET
              </button>
            )}
          </div>

          {/* 메모 영역 — 엑셀 모드 */}
          {excel && (
            <>
              <div className={styles.memoGap} />
              <div className={styles.memoWrap}>
                <div className={styles.memoHeader}>메모</div>
                <textarea
                  className={styles.memoArea}
                  placeholder="메모를 입력하세요."
                  style={{ height: (3 + maxAttempts) * CELL_H }}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* ── 일반 모드: 랭킹 ── */}
      {!excel && showRankingArea && !showRulesArea && (
        <div className={styles.rankSection}>
          <h3 className={styles.rankTitle}>주간 RANK</h3>
          {!!rankings.alltime && (
            <div className={styles.alltimeBanner}>
              <span className={styles.atLabel}>👑 역대 1위</span>
              <span className={styles.atContent}>
                {(rankings.alltime as { name: string; attempts: number; time: number; createdAt: string }).name}
                {' · '}
                {(rankings.alltime as { name: string; attempts: number; time: number; createdAt: string }).attempts}번
                {' · '}
                {new Date((rankings.alltime as { name: string; attempts: number; time: number; createdAt: string }).createdAt).toLocaleDateString('ko-KR')}
              </span>
            </div>
          )}
          <div className={styles.rankTabs}>
            {LEVELS.map((lv) => (
              <button
                key={lv.value}
                className={`${styles.rankTab} ${rankLevel === lv.value ? styles.rankTabActive : ''}`}
                onClick={() => { setRankLevel(lv.value); loadRanking(lv.value); setShowRules(false); }}
              >{lv.shortLabel}</button>
            ))}
            <button
              className={`${styles.rankTab} ${showRules ? styles.rankTabActive : ''}`}
              onClick={() => setShowRules(true)}
            >룰</button>
          </div>
          {rankLoading ? (
            <p className={styles.placeholder}>불러오는 중...</p>
          ) : (
            <table className={styles.rankTable}>
              <thead><tr><th>순위</th><th>이름</th><th>시도</th><th>시간</th><th>날짜</th></tr></thead>
              <tbody>
                {(rankings.weekly as Array<{ id: number; name: string; attempts: number; time: number; createdAt: string }>).length === 0 ? (
                  <tr><td colSpan={5} className={styles.placeholder}>기록 없음</td></tr>
                ) : (
                  (rankings.weekly as Array<{ id: number; name: string; attempts: number; time: number; createdAt: string }>).map((r, i) => (
                    <tr key={r.id}>
                      <td>{i + 1}</td><td>{r.name}</td>
                      <td>{r.attempts}번</td><td>{r.time.toFixed(2)}초</td>
                      <td>{new Date(r.createdAt).toLocaleDateString('ko-KR')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── 일반 모드: 룰 패널 ── */}
      {!excel && showRulesArea && (
        <div className={styles.rulesPanel}>
          <h4>기본 규칙</h4>
          <ul>
            <li>컴퓨터가 서로 다른 숫자로 이루어진 N자리 수를 무작위로 정함</li>
            <li>스트라이크(S): 숫자와 위치가 모두 정확</li>
            <li>볼(B): 숫자는 맞지만 위치가 다름</li>
            <li>아웃: 일치하는 숫자가 하나도 없음</li>
          </ul>
          <h4>난이도</h4>
          <ul>
            <li>쉬움: 3자리 / 보통: 4자리 / 어려움: 5자리</li>
          </ul>
        </div>
      )}

      {/* ── 엑셀 모드: 랭킹 시트 ── */}
      {excel && showRankingArea && (() => {
        const extraCols = Math.max(5, Math.ceil(sheetSize.width / CELL_W));
        const totalHeaderCols = RANK_TOTAL + extraCols;
        const dataRows = (rankings.weekly as unknown[]).length > 0 ? (rankings.weekly as unknown[]).length : 1;
        const contentRows = 3 + dataRows + 1; // title + filter + header + data + alltime
        const extraRows = Math.max(20, Math.ceil(sheetSize.height / CELL_H));
        const totalRows = contentRows + extraRows;

        type RankRow = { id: number; name: string; attempts: number; time: number; createdAt: string };

        const RankCell = (
          text: string,
          colStart: number,
          span: number,
          cls: string[],
          extraStyle?: React.CSSProperties,
          key?: string | number,
          children?: React.ReactNode,
        ) => (
          <div
            key={key ?? `${colStart}-${text}`}
            className={[styles.xrankCell, ...cls.map(c => styles[c as keyof typeof styles])].filter(Boolean).join(' ')}
            style={{ gridColumn: `${colStart} / span ${span}`, ...extraStyle }}
            title={text}
          >
            {children ?? text}
          </div>
        );

        return (
          <div className={styles.xSheetWrapper}>
            <div className={styles.xColHeaderRow}>
              <div className={styles.xcorner} />
              {Array.from({ length: totalHeaderCols }, (_, i) => (
                <div key={i} className={styles.xch} style={{ width: CELL_W, minWidth: CELL_W }}>{colLabel(i)}</div>
              ))}
            </div>
            <div className={styles.xBodyArea}>
              <div className={styles.xRowNums}>
                {Array.from({ length: totalRows }, (_, i) => (
                  <div key={i} className={styles.xrn} style={{ height: CELL_H }}>{i + 1}</div>
                ))}
              </div>
              <div
                className={styles.xRankGrid}
                style={{ gridTemplateColumns: `repeat(${RANK_TOTAL}, ${CELL_W}px)`, gridAutoRows: `${CELL_H}px` }}
              >
                {/* 1행: 주간 랭킹 타이틀 — 원본: background:#eafaf1; color:#1e8449 */}
                {RankCell(weekRange(), 1, RANK_TOTAL, [], { background: '#eafaf1', color: '#1e8449', fontWeight: 'bold' }, 'title')}

                {/* 2행: 난이도 필터 버튼 */}
                <div
                  key="filter"
                  className={`${styles.xrankCell} ${styles.xrcFilter}`}
                  style={{ gridColumn: `1 / span ${RANK_TOTAL}` }}
                >
                  {LEVELS.map((lv) => (
                    <button
                      key={lv.value}
                      className={`${styles.xrankFilterBtn} ${rankLevel === lv.value ? styles.xrankFilterBtnActive : ''}`}
                      onClick={() => { setRankLevel(lv.value); loadRanking(lv.value); }}
                    >
                      {lv.shortLabel}
                    </button>
                  ))}
                </div>

                {/* 3행: 컬럼 헤더 */}
                {(() => {
                  let cs = 1;
                  return RANK_COLS.map((col) => {
                    const start = cs;
                    cs += col.span;
                    return RankCell(col.label, start, col.span, ['xrcHeader'], undefined, `h-${col.label}`);
                  });
                })()}

                {/* 데이터 행 */}
                {rankLoading ? (
                  RankCell('불러오는 중...', 1, RANK_TOTAL, [], { color: '#888' }, 'loading')
                ) : (rankings.weekly as RankRow[]).length === 0 ? (
                  RankCell('기록 없음', 1, RANK_TOTAL, [], { color: '#aaa' }, 'empty')
                ) : (
                  (rankings.weekly as RankRow[]).map((row, i) => {
                    const alt = i % 2 === 1 ? styles.xrcAlt : '';
                    const top = i === 0 ? styles.xrcTop : '';
                    const date = new Date(row.createdAt).toLocaleDateString('ko-KR');
                    const values = [String(i + 1), row.name, `${row.attempts ?? 0}번`, `${(row.time ?? 0).toFixed(2)}초`, date];
                    let cs = 1;
                    return RANK_COLS.map((col) => {
                      const start = cs;
                      cs += col.span;
                      const vi = RANK_COLS.indexOf(col);
                      return (
                        <div
                          key={`${row.id}-${col.label}`}
                          className={[styles.xrankCell, alt, top].filter(Boolean).join(' ')}
                          style={{ gridColumn: `${start} / span ${col.span}` }}
                          title={values[vi]}
                        >
                          {values[vi]}
                        </div>
                      );
                    });
                  })
                )}

                {/* 역대 1위 — 원본: background:#eafaf1; color:#1e8449 */}
                {(() => {
                  // getAlltimeBest는 기록 없을 때 {} 반환 → 'id' in 체크로 유효성 확인
                  const raw = rankings.alltime;
                  const at = (raw && typeof raw === 'object' && 'id' in (raw as object))
                    ? raw as { name: string; attempts: number; time: number; createdAt: string }
                    : null;
                  return at
                    ? RankCell(
                        `👑 역대 1위  ${at.name} · ${at.attempts}번 · ${(at.time ?? 0).toFixed(2)}초 · ${new Date(at.createdAt).toLocaleDateString('ko-KR')}`,
                        1, RANK_TOTAL, [],
                        { background: '#eafaf1', color: '#1e8449', fontWeight: 'bold', paddingLeft: 8 },
                        'alltime'
                      )
                    : RankCell('👑 역대 1위  기록 없음', 1, RANK_TOTAL, [], { color: '#aaa', paddingLeft: 8 }, 'alltime-empty');
                })()}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── 엑셀 모드: 룰 시트 ── */}
      {excel && showRulesArea && (() => {
        const extraCols = Math.max(5, Math.ceil(sheetSize.width / CELL_W));
        const totalHeaderCols = RULES_TOTAL + extraCols;
        // 타이틀(1)+빈(1)+기본규칙섹션(1)+6행+빈(1)+난이도섹션(1)+헤더(1)+3행+빈(1)+점수등록섹션(1)+3행 = 21
        const contentRows = 21;
        const extraRows = Math.max(20, Math.ceil(sheetSize.height / CELL_H));
        const totalRows = contentRows + extraRows;

        type CellDef = { text: string; colStart: number; span: number; cls: string[]; style?: React.CSSProperties };
        const rows: CellDef[][] = [];

        function addRow(...cells: CellDef[]) { rows.push(cells); }
        function fullCell(text: string, cls: string[], style?: React.CSSProperties): CellDef {
          return { text, colStart: 1, span: RULES_TOTAL, cls, style };
        }
        function sectionRow(title: string): CellDef[] {
          return [fullCell(title, [], { background: '#e8f5e9', color: '#1a5c38', fontWeight: 'bold', borderTop: '1px solid #a5d6a7' })];
        }
        function emptyRow(): CellDef[] { return [fullCell('', [])]; }

        // 1행: 타이틀
        addRow(fullCell('도박꾼 숫자야구  —  게임 규칙', ['xrcHeader'], { justifyContent: 'center', fontSize: 14, letterSpacing: 1 }));
        addRow(...emptyRow());

        // 기본 규칙
        addRow(...sectionRow('■  기본 규칙'));
        [
          ['①', '컴퓨터가 서로 다른 숫자로 이루어진 N자리 수를 무작위로 정함'],
          ['②', '숫자를 추측하여 입력하면 힌트를 받음'],
          ['③', '스트라이크(S): 숫자와 위치가 모두 정확'],
          ['④', '볼(B): 숫자는 맞지만 위치가 다름'],
          ['⑤', '아웃: 일치하는 숫자가 하나도 없음'],
          ['⑥', 'N스트라이크를 달성하면 승리!  ⚾'],
        ].forEach(([num, text], i) => {
          const alt = i % 2 === 1 ? ['xrcAlt'] : [] as string[];
          addRow(
            { text: num, colStart: 1, span: 1, cls: alt, style: { justifyContent: 'center', color: '#888' } },
            { text, colStart: 2, span: RULES_TOTAL - 1, cls: alt },
          );
        });
        addRow(...emptyRow());

        // 난이도
        addRow(...sectionRow('■  난이도'));
        addRow(
          { text: '난이도', colStart: 1, span: 1, cls: ['xrcHeader'] },
          { text: '자리 수', colStart: 2, span: 1, cls: ['xrcHeader'], style: { justifyContent: 'center' } },
          { text: '설명', colStart: 3, span: 3, cls: ['xrcHeader'] },
        );
        [
          ['쉬움', '3자리', '0~9 중 서로 다른 3개'],
          ['보통', '4자리', '0~9 중 서로 다른 4개'],
          ['어려움', '5자리', '0~9 중 서로 다른 5개'],
        ].forEach(([d, s, m], i) => {
          const alt = i % 2 === 1 ? ['xrcAlt'] : [] as string[];
          addRow(
            { text: d, colStart: 1, span: 1, cls: alt },
            { text: s, colStart: 2, span: 1, cls: alt, style: { justifyContent: 'center' } },
            { text: m, colStart: 3, span: 3, cls: alt },
          );
        });
        addRow(...emptyRow());

        // 점수 등록
        addRow(...sectionRow('■  점수 등록'));
        [
          ['①', '클리어 시 시도 횟수와 소요 시간이 기록됨'],
          ['②', '시도 횟수가 적을수록 높은 순위'],
          ['③', '시도 횟수가 같으면 짧은 시간이 높은 순위'],
        ].forEach(([num, text], i) => {
          const alt = i % 2 === 1 ? ['xrcAlt'] : [] as string[];
          addRow(
            { text: num, colStart: 1, span: 1, cls: alt, style: { justifyContent: 'center', color: '#888' } },
            { text, colStart: 2, span: RULES_TOTAL - 1, cls: alt },
          );
        });

        return (
          <div className={styles.xSheetWrapper}>
            <div className={styles.xColHeaderRow}>
              <div className={styles.xcorner} />
              {Array.from({ length: totalHeaderCols }, (_, i) => (
                <div key={i} className={styles.xch} style={{ width: CELL_W, minWidth: CELL_W }}>{colLabel(i)}</div>
              ))}
            </div>
            <div className={styles.xBodyArea}>
              <div className={styles.xRowNums}>
                {Array.from({ length: totalRows }, (_, i) => (
                  <div key={i} className={styles.xrn} style={{ height: CELL_H }}>{i + 1}</div>
                ))}
              </div>
              <div
                className={styles.xRankGrid}
                style={{ gridTemplateColumns: `repeat(${RULES_TOTAL}, ${CELL_W}px)`, gridAutoRows: `${CELL_H}px` }}
              >
                {rows.map((rowCells, ri) =>
                  rowCells.map((cell, ci) => (
                    <div
                      key={`${ri}-${ci}`}
                      className={[styles.xrankCell, ...cell.cls.map(c => styles[c as keyof typeof styles])].filter(Boolean).join(' ')}
                      style={{ gridColumn: `${cell.colStart} / span ${cell.span}`, ...cell.style }}
                    >
                      {cell.text}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* 클리어 모달 */}
      {modalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>🎉 정답!</h3>
            <p>{state.attempts}번 시도 / {state.elapsed.toFixed(2)}초</p>
            <input
              className={styles.nameInput}
              type="text"
              placeholder="이름을 입력하세요"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitRanking(); }}
              autoFocus
            />
            {submitState === 'error' && <p className={styles.hint}>등록 실패. 다시 시도해 주세요.</p>}
            <div className={styles.modalBtns}>
              <button className={styles.submitBtn} disabled={submitState === 'loading'} onClick={handleSubmitRanking}>
                {submitState === 'loading' ? '등록 중...' : '등록'}
              </button>
              <button className={styles.skipBtn} onClick={() => setModalOpen(false)}>건너뛰기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
