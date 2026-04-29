import { useState, useCallback } from 'react';
import NormalHeader from '../components/normal/NormalHeader';
import styles from './LadderPage.module.css';

const MIN_P = 2;
const MAX_P = 8;
const ROWS = 10;
const COL_W = 90;
const ROW_H = 52;
const PAD_X = 50;
const PATH_DURATION = 1.6;

const COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#e67e22',
  '#9b59b6', '#1abc9c', '#e91e63', '#00bcd4',
];

function makeBridges(n: number): boolean[][] {
  return Array.from({ length: ROWS }, () => {
    const row = new Array<boolean>(n - 1).fill(false);
    for (let c = 0; c < n - 1; c++) {
      if (c > 0 && row[c - 1]) continue;
      row[c] = Math.random() < 0.4;
    }
    return row;
  });
}

interface Traced {
  d: string;
  end: number;
}

function tracePath(startCol: number, bridges: boolean[][]): Traced {
  let col = startCol;
  const cx = (c: number) => PAD_X + c * COL_W;
  const moves: string[] = [`M ${cx(col)},0`];

  for (let r = 0; r < ROWS; r++) {
    const midY = r * ROW_H + ROW_H / 2;
    const botY = (r + 1) * ROW_H;
    moves.push(`L ${cx(col)},${midY}`);
    if (col < bridges[r].length && bridges[r][col]) {
      col++;
      moves.push(`L ${cx(col)},${midY}`);
    } else if (col > 0 && bridges[r][col - 1]) {
      col--;
      moves.push(`L ${cx(col)},${midY}`);
    }
    moves.push(`L ${cx(col)},${botY}`);
  }
  return { d: moves.join(' '), end: col };
}

export default function LadderPage() {
  const [players, setPlayers] = useState(['참가자 1', '참가자 2', '참가자 3', '참가자 4']);
  const [results, setResults] = useState(['1등', '2등', '3등', '4등']);
  const [phase, setPhase] = useState<'edit' | 'run'>('edit');
  const [bridges, setBridges] = useState<boolean[][]>([]);
  const [traced, setTraced] = useState<Traced[]>([]);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

  const n = players.length;
  const svgW = PAD_X * 2 + (n - 1) * COL_W;
  const svgH = ROWS * ROW_H;
  const allRevealed = revealed.size === n;

  const setPlayer = (i: number, v: string) =>
    setPlayers(prev => prev.map((x, j) => (j === i ? v : x)));
  const setResult = (i: number, v: string) =>
    setResults(prev => prev.map((x, j) => (j === i ? v : x)));

  const addPlayer = () => {
    if (n >= MAX_P) return;
    const k = n + 1;
    setPlayers(p => [...p, `참가자 ${k}`]);
    setResults(r => [...r, `결과 ${k}`]);
  };

  const removePlayer = () => {
    if (n <= MIN_P) return;
    setPlayers(p => p.slice(0, -1));
    setResults(r => r.slice(0, -1));
  };

  const startLadder = useCallback(() => {
    const br = makeBridges(n);
    const tr = Array.from({ length: n }, (_, i) => tracePath(i, br));
    setBridges(br);
    setTraced(tr);
    setRevealed(new Set());
    setPhase('run');
  }, [n]);

  const revealPlayer = (i: number) => {
    if (revealed.has(i)) return;
    setRevealed(prev => new Set(prev).add(i));
  };

  const revealAll = () => {
    setRevealed(new Set(Array.from({ length: n }, (_, i) => i)));
  };

  const reset = () => {
    setPhase('edit');
    setBridges([]);
    setTraced([]);
    setRevealed(new Set());
  };

  return (
    <div className={styles.page}>
      <NormalHeader currentGame="ladder" gameName="사다리 타기" accentColor="#3b82f6" />
      <div className={styles.content}>
        {phase === 'edit' ? (
          <div className={styles.editBox}>
            <div className={styles.cols}>
              <div className={styles.col}>
                <p className={styles.colHead}>참가자</p>
                {players.map((p, i) => (
                  <input
                    key={i}
                    className={styles.inp}
                    style={{ borderLeftColor: COLORS[i] }}
                    value={p}
                    onChange={e => setPlayer(i, e.target.value)}
                    placeholder={`참가자 ${i + 1}`}
                  />
                ))}
              </div>
              <div className={styles.col}>
                <p className={styles.colHead}>결과</p>
                {results.map((r, i) => (
                  <input
                    key={i}
                    className={styles.inp}
                    style={{ borderLeftColor: COLORS[i] }}
                    value={r}
                    onChange={e => setResult(i, e.target.value)}
                    placeholder={`결과 ${i + 1}`}
                  />
                ))}
              </div>
            </div>
            <div className={styles.countRow}>
              <button className={styles.countBtn} onClick={removePlayer} disabled={n <= MIN_P}>−</button>
              <span className={styles.countNum}>{n}명</span>
              <button className={styles.countBtn} onClick={addPlayer} disabled={n >= MAX_P}>+</button>
            </div>
            <button className={styles.startBtn} onClick={startLadder}>🎲 사다리 생성!</button>
          </div>
        ) : (
          <div className={styles.runBox}>
            <p className={styles.hint}>
              {allRevealed ? '모두 완료!' : '이름을 클릭하면 사다리를 탑니다'}
            </p>

            <div className={styles.ladderScroll}>
              <div style={{ width: svgW }}>
                {/* 참가자 이름 버튼 */}
                <div className={styles.topRow}>
                  {players.map((p, i) => (
                    <button
                      key={i}
                      className={`${styles.topBtn} ${revealed.has(i) ? styles.topBtnDone : ''}`}
                      style={{ left: PAD_X + i * COL_W, color: COLORS[i] }}
                      onClick={() => revealPlayer(i)}
                      disabled={revealed.has(i)}
                    >
                      {revealed.has(i) ? '✓ ' : ''}{p}
                    </button>
                  ))}
                </div>

                {/* 사다리 SVG */}
                <svg width={svgW} height={svgH}>
                  {Array.from({ length: n }, (_, i) => (
                    <line
                      key={i}
                      x1={PAD_X + i * COL_W} y1={0}
                      x2={PAD_X + i * COL_W} y2={svgH}
                      stroke="#d0d0d0" strokeWidth="3" strokeLinecap="round"
                    />
                  ))}
                  {bridges.map((row, r) =>
                    row.map((has, c) =>
                      has ? (
                        <line
                          key={`${r}-${c}`}
                          x1={PAD_X + c * COL_W} y1={r * ROW_H + ROW_H / 2}
                          x2={PAD_X + (c + 1) * COL_W} y2={r * ROW_H + ROW_H / 2}
                          stroke="#c0c0c0" strokeWidth="2.5" strokeLinecap="round"
                        />
                      ) : null
                    )
                  )}
                  {/* 공개된 경로만 렌더 — 마운트 시 애니메이션 자동 시작 */}
                  {traced.map(({ d }, i) =>
                    revealed.has(i) ? (
                      <path
                        key={`path-${i}`}
                        d={d}
                        fill="none"
                        stroke={COLORS[i]}
                        strokeWidth="5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        pathLength="100"
                        className={styles.path}
                      />
                    ) : null
                  )}
                </svg>

                {/* 결과 라벨 — 경로 애니메이션 끝난 뒤 등장 */}
                <div className={styles.botRow}>
                  {results.map((r, ri) => {
                    const pi = traced.findIndex(t => t.end === ri);
                    if (pi < 0 || !revealed.has(pi)) return null;
                    return (
                      <div
                        key={`label-${pi}`}
                        className={styles.botLabel}
                        style={{
                          left: PAD_X + ri * COL_W,
                          borderColor: COLORS[pi],
                          color: COLORS[pi],
                          animationDelay: `${PATH_DURATION + 0.05}s`,
                        }}
                      >
                        {r}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 액션 버튼 */}
            <div className={styles.btnRow}>
              <button
                className={styles.revealAllBtn}
                onClick={revealAll}
                disabled={allRevealed}
              >
                전체 사다리 타기
              </button>
              <button className={styles.rerollBtn} onClick={startLadder}>다시 뽑기</button>
              <button className={styles.resetBtn} onClick={reset}>처음으로</button>
            </div>

            {/* 결과 요약 — 한 명이라도 공개되면 표시 */}
            {revealed.size > 0 && (
              <div
                className={styles.summary}
                style={{ animationDelay: `${PATH_DURATION + 0.05}s` }}
              >
                {players.map((p, i) =>
                  revealed.has(i) ? (
                    <div
                      key={`sum-${i}`}
                      className={styles.summaryRow}
                      style={{ animationDelay: `${PATH_DURATION + 0.05}s` }}
                    >
                      <span className={styles.summaryName} style={{ color: COLORS[i] }}>{p}</span>
                      <span className={styles.summaryArrow}>→</span>
                      <span className={styles.summaryResult}>{results[traced[i]?.end ?? i]}</span>
                    </div>
                  ) : null
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
