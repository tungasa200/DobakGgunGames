import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { startSession, rankingsApi, type RankingEntry } from '../api/rankings';
import { containsProfanity } from '../utils/profanity';
import NormalHeader from '../components/normal/NormalHeader';
import Footer from '../components/normal/Footer';
import { useBrickBreakerGame } from '../games/brickbreaker/useBrickBreakerGame';
import BrickBreakerCanvas from '../games/brickbreaker/BrickBreakerCanvas';
import type { ActiveItem } from '../games/brickbreaker/types';
import styles from '../games/brickbreaker/BrickBreaker.module.css';

const GAME_KEY = 'brickbreaker';
const LEVEL    = 'normal';

const ITEM_DURATION: Record<string, number> = { W: 12000, P: 8000, S: 10000 };

function timerPct(item: ActiveItem): string {
  const total     = ITEM_DURATION[item.type] ?? 10000;
  const remaining = Math.max(0, item.expiresAt - Date.now());
  return `${Math.round((remaining / total) * 100)}%`;
}

export default function BrickBreakerPage() {
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const game       = useBrickBreakerGame();
  const { state, init, launchBall, pause, resume, nextStage } = game;

  // ── 세션 ──────────────────────────────────────────────────────
  const sessionIdRef = useRef<string>('');
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const id = await startSession(GAME_KEY, LEVEL);
        if (!cancelled) { sessionIdRef.current = id; setSessionReady(true); }
      } catch {
        if (!cancelled) setSessionReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── 랭킹 ──────────────────────────────────────────────────────
  const [rankings,    setRankings]    = useState<RankingEntry[]>([]);
  const [rankLoading, setRankLoading] = useState(false);

  const loadRankings = useCallback(async () => {
    setRankLoading(true);
    try {
      const data = await rankingsApi.getWeekly(GAME_KEY, LEVEL);
      setRankings(data);
    } catch {
      setRankings([]);
    } finally {
      setRankLoading(false);
    }
  }, []);

  useEffect(() => { loadRankings(); }, [loadRankings]);

  // ── 랭킹 등록 폼 ───────────────────────────────────────────────
  const [playerName,   setPlayerName]   = useState('');
  const [nameBanned,   setNameBanned]   = useState(false);
  const [submitState,  setSubmitState]  = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  const isFinalStatus = state.status === 'gameOver' || state.status === 'ended';

  // 최종 상태 진입 시 닉네임 자동 완성 + 폼 리셋
  useEffect(() => {
    if (!isFinalStatus) return;
    setPlayerName(user?.nickname ?? '');
    setSubmitState('idle');
    setNameBanned(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFinalStatus]);

  // 스테이지 클리어 → 2.5초 후 자동 다음 스테이지
  useEffect(() => {
    if (state.status !== 'stageClear') return;
    const t = setTimeout(() => nextStage(), 2500);
    return () => clearTimeout(t);
  }, [state.status, nextStage]);

  // ── 키보드 ────────────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if ((e.code === 'Space' || e.key === ' ') && state.status === 'idle') {
        e.preventDefault();
        launchBall();
      }
      if (e.key === 'p' || e.key === 'P') {
        if (state.status === 'playing') pause();
        else if (state.status === 'paused') resume();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [state.status, launchBall, pause, resume]);

  // ── 랭킹 제출 ─────────────────────────────────────────────────
  async function handleSubmit() {
    const name = playerName.trim();
    if (!name) return;
    if (containsProfanity(name)) { setNameBanned(true); return; }
    setNameBanned(false);
    setSubmitState('loading');
    try {
      await rankingsApi.submit(GAME_KEY, {
        level:     LEVEL,
        name,
        score:     state.score,
        gameLevel: state.stage,
        sessionId: sessionIdRef.current,
      });
      setSubmitState('done');
      loadRankings();
    } catch {
      setSubmitState('error');
    }
  }

  function handleNewGame() {
    setPlayerName('');
    setSubmitState('idle');
    setNameBanned(false);
    init();
  }

  // ── 아이템 칩 분류 ─────────────────────────────────────────────
  const timedItems = state.activeItems.filter(a => a.type !== 'M');
  const hasMultiball = state.activeItems.some(a => a.type === 'M');

  // ── 오버레이 공통 (gameOver / ended) ───────────────────────────
  function RankForm() {
    if (submitState === 'done') {
      return <p style={{ color: 'var(--bb-cyan)', fontWeight: 700 }}>등록 완료!</p>;
    }
    return (
      <form
        className={styles.rankForm}
        onSubmit={e => { e.preventDefault(); handleSubmit(); }}
      >
        <input
          className={`${styles.rankFormInput}${nameBanned ? ' ' + styles.error : ''}`}
          type="text"
          placeholder="닉네임 입력 (랭킹 등록)"
          value={playerName}
          onChange={e => { setPlayerName(e.target.value); setNameBanned(false); }}
          maxLength={12}
          autoFocus
        />
        {nameBanned   && <p className={styles.rankFormError}>사용할 수 없는 닉네임입니다.</p>}
        {submitState === 'error' && <p className={styles.rankFormError}>등록 실패. 다시 시도해 주세요.</p>}
        <p className={styles.rankFormNotice}>어뷰징 방지를 위해 IP가 수집됩니다.</p>
      </form>
    );
  }

  return (
    <div className={styles.gameWrapper}>
      <NormalHeader />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 16px 40px' }}>

        {/* 타이틀 */}
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 12px', color: '#A78BFA', letterSpacing: '0.04em' }}>
          벽돌깨기
          <span style={{
            display: 'inline-block', marginLeft: 8,
            background: '#F59E0B', color: '#fff',
            fontSize: '0.5em', fontWeight: 700,
            padding: '2px 7px', borderRadius: 10,
            verticalAlign: 'middle',
          }}>BETA</span>
        </h1>

        <div className={styles.hud}>

          {/* ── 상단 HUD ── */}
          <div className={styles.hudTop}>
            <div className={styles.stageInfo}>
              <span className={styles.hudLabel}>STAGE</span>
              <span className={styles.hudValue}>{state.stage} / 10</span>
            </div>
            <div className={styles.scoreInfo}>
              <span className={styles.hudLabel}>SCORE</span>
              <span className={styles.scoreValue}>{state.score.toLocaleString()}</span>
            </div>
            <div className={styles.livesInfo}>
              <span className={styles.hudLabel}>LIVES</span>
              <div className={styles.livesDisplay}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <span
                    key={i}
                    className={`${styles.lifeHeart}${i >= state.lives ? ' ' + styles.lost : ''}`}
                  >♥</span>
                ))}
              </div>
            </div>
            <div className={styles.itemChips}>
              {hasMultiball && (
                <div className={`${styles.itemChip} ${styles.itemChipActive}`} data-item="M">M</div>
              )}
              {timedItems.map(item => {
                const remaining = Math.max(0, item.expiresAt - Date.now());
                const fading    = remaining < 3000;
                return (
                  <div
                    key={item.type}
                    className={`${styles.itemChip} ${styles.itemChipActive}${fading ? ' ' + styles.itemChipFading : ''}`}
                    data-item={item.type}
                    style={{ '--timer-pct': timerPct(item) } as React.CSSProperties}
                  >
                    {item.type}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── 캔버스 + DOM 오버레이 ── */}
          <div className={styles.canvasWrap}>
            {sessionReady
              ? <BrickBreakerCanvas game={game} className={styles.canvas} />
              : <div className={styles.canvas} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#8b949e' }}>로딩 중...</span>
                </div>
            }

            {/* GAME OVER overlay */}
            {state.status === 'gameOver' && (
              <div className={styles.overlay}>
                <h2 className={`${styles.overlayTitle} ${styles.gameOver}`}>GAME OVER</h2>
                <p className={styles.overlaySub}>{state.stage}스테이지 도달</p>
                <div className={styles.overlayScore}>
                  <span className={styles.overlayScoreLabel}>최종 점수</span>
                  <span className={styles.overlayScoreValue}>{state.score.toLocaleString()}</span>
                </div>
                <RankForm />
                <div className={styles.overlayActions}>
                  {submitState !== 'done' && (
                    <button
                      className={styles.btnSecondary}
                      disabled={submitState === 'loading'}
                      onClick={handleSubmit}
                    >
                      {submitState === 'loading' ? '등록 중...' : '랭킹 등록'}
                    </button>
                  )}
                  <button className={styles.btnPrimary} onClick={handleNewGame}>↺ 다시하기</button>
                  <button className={styles.btnGhost}   onClick={() => navigate('/')}>메인으로</button>
                </div>
              </div>
            )}

            {/* ALL CLEAR overlay */}
            {state.status === 'ended' && (
              <div className={styles.overlay}>
                <h2 className={`${styles.overlayTitle} ${styles.allClear}`}>ALL CLEAR!</h2>
                <div className={styles.overlayScore}>
                  <span className={styles.overlayScoreLabel}>최종 점수</span>
                  <span className={styles.overlayScoreValue}>{state.score.toLocaleString()}</span>
                </div>
                <RankForm />
                <div className={styles.overlayActions}>
                  {submitState !== 'done' && (
                    <button
                      className={styles.btnSecondary}
                      disabled={submitState === 'loading'}
                      onClick={handleSubmit}
                    >
                      {submitState === 'loading' ? '등록 중...' : '랭킹 등록'}
                    </button>
                  )}
                  <button className={styles.btnPrimary} onClick={handleNewGame}>↺ 다시하기</button>
                  <button className={styles.btnGhost}   onClick={() => navigate('/')}>메인으로</button>
                </div>
              </div>
            )}
          </div>

          {/* ── 하단 HUD ── */}
          <div className={styles.hudBottom}>
            {state.status === 'idle' && (
              <button className={`${styles.hudBtn} ${styles.pauseBtn}`} onClick={launchBall}>
                ▶ 공 발사 (Space)
              </button>
            )}
            {state.status === 'playing' && (
              <button className={`${styles.hudBtn} ${styles.pauseBtn}`} onClick={pause}>
                ⏸ 일시정지 (P)
              </button>
            )}
            {state.status === 'paused' && (
              <button className={`${styles.hudBtn} ${styles.pauseBtn}`} onClick={resume}>
                ▶ 계속하기 (P)
              </button>
            )}
            {state.status === 'stageClear' && (
              <button className={`${styles.hudBtn} ${styles.pauseBtn}`} onClick={nextStage}>
                다음 스테이지 →
              </button>
            )}
            {isFinalStatus && (
              <button className={`${styles.hudBtn} ${styles.pauseBtn}`} onClick={handleNewGame}>
                ↺ 다시하기
              </button>
            )}
            <button className={`${styles.hudBtn} ${styles.quitBtn}`} onClick={() => navigate('/')}>
              그만두기
            </button>
          </div>
        </div>

        {/* ── 주간 랭킹 ── */}
        <div className={styles.rankSection}>
          <p className={styles.rankTitle}>주간 랭킹 — 스테이지 · 점수 순</p>
          {rankLoading ? (
            <p className={styles.rankEmpty}>불러오는 중...</p>
          ) : rankings.length === 0 ? (
            <p className={styles.rankEmpty}>아직 기록이 없습니다. 첫 번째가 되세요!</p>
          ) : (
            <table className={styles.rankTable}>
              <thead>
                <tr>
                  <th className={styles.colRank}>#</th>
                  <th className={styles.colNick}>이름</th>
                  <th className={styles.colResult}>결과</th>
                  <th className={styles.colScore}>점수</th>
                  <th className={styles.colDate}>날짜</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((r, i) => {
                  const isAllClear = r.gameLevel === 10;
                  const rankCls    = [styles.rank1, styles.rank2, styles.rank3][i] ?? '';
                  return (
                    <tr key={r.id}>
                      <td className={`${styles.colRank} ${rankCls}`}>{i + 1}</td>
                      <td className={styles.colNick}>{r.name}</td>
                      <td className={styles.colResult}>
                        {isAllClear
                          ? <><span>ALL CLEAR</span><span className={styles.allClearBadge}>★</span></>
                          : `${r.gameLevel ?? '-'}스테이지 클리어`}
                      </td>
                      <td className={styles.colScore}>{(r.score ?? 0).toLocaleString()}</td>
                      <td className={styles.colDate}>
                        {new Date(r.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
