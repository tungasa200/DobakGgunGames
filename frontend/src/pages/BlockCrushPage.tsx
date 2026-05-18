import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { startSession, rankingsApi, type RankingEntry } from '../api/rankings';
import { containsProfanity } from '../utils/profanity';
import NormalHeader from '../components/normal/NormalHeader';
import Footer from '../components/normal/Footer';
import { useBlockCrushGame } from '../games/block-crush/useBlockCrushGame';
import { useDragDrop } from '../games/block-crush/useDragDrop';
import BlockCrushBoard from '../games/block-crush/BlockCrushBoard';
import BlockCrushTray from '../games/block-crush/BlockCrushTray';
import type { Piece } from '../games/block-crush/types';
import styles from '../games/block-crush/BlockCrush.module.css';

const GAME_KEY = 'block-crush';
const LEVEL    = 'classic';

// 보드 셀 크기 — useDragDrop에서 좌표 변환에 사용
// 실제 DOM 크기에 따라 동적으로 계산
const BOARD_SIZE = 8;

export default function BlockCrushPage() {
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const { state, init, reset, placePiece } = useBlockCrushGame();

  // ── 세션 ──────────────────────────────────────────────────────
  const sessionIdRef  = useRef<string>('');
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

  // ── 보드 DOM ref + 셀 크기 계산 ─────────────────────────────
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [cellSize, setCellSize] = useState(48);

  useEffect(() => {
    if (!boardRef.current) return;
    const updateCellSize = () => {
      if (!boardRef.current) return;
      const rect = boardRef.current.getBoundingClientRect();
      setCellSize(rect.width / BOARD_SIZE);
    };
    updateCellSize();
    const observer = new ResizeObserver(updateCellSize);
    observer.observe(boardRef.current);
    return () => observer.disconnect();
  }, []);

  // ── 드래그&드롭 ───────────────────────────────────────────────
  const handlePlace = useCallback(
    (slotIndex: 0 | 1 | 2, row: number, col: number) => {
      placePiece(slotIndex, row, col);
    },
    [placePiece],
  );

  const { dragState, onPointerDown, onPointerMove, onPointerUp, cancelDrag } =
    useDragDrop({
      boardRef,
      board: state.board,
      cellSize,
      onPlace: handlePlace,
    });

  // 전역 pointerup/pointermove 핸들러 (보드 밖에서 손가락을 뗄 때)
  useEffect(() => {
    const handleGlobalPointerUp = (e: PointerEvent) => {
      onPointerUp(e as unknown as React.PointerEvent);
    };
    const handleGlobalPointerMove = (e: PointerEvent) => {
      onPointerMove(e as unknown as React.PointerEvent);
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointermove', handleGlobalPointerMove);
    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointermove', handleGlobalPointerMove);
    };
  }, [onPointerUp, onPointerMove]);

  // ── 랭킹 ──────────────────────────────────────────────────────
  const [rankings,    setRankings]    = useState<RankingEntry[]>([]);
  const [rankLoading, setRankLoading] = useState(false);
  const [alltimeBest, setAlltimeBest] = useState<RankingEntry | null>(null);

  const loadRankings = useCallback(async () => {
    setRankLoading(true);
    try {
      const [weeklyData, bestData] = await Promise.all([
        rankingsApi.getWeekly(GAME_KEY, LEVEL),
        rankingsApi.getAlltimeBest(GAME_KEY, LEVEL),
      ]);
      setRankings(weeklyData);
      // 빈 객체 {} 처리
      const best = bestData as RankingEntry | Record<string, never>;
      setAlltimeBest('id' in best ? (best as RankingEntry) : null);
    } catch {
      setRankings([]);
      setAlltimeBest(null);
    } finally {
      setRankLoading(false);
    }
  }, []);

  useEffect(() => { loadRankings(); }, [loadRankings]);

  // ── 랭킹 등록 폼 ───────────────────────────────────────────────
  const [playerName,  setPlayerName]  = useState('');
  const [nameBanned,  setNameBanned]  = useState(false);
  const [submitState, setSubmitState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  const isGameOver = state.status === 'gameOver';

  useEffect(() => {
    if (!isGameOver) return;
    setPlayerName(user?.nickname ?? '');
    setSubmitState('idle');
    setNameBanned(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGameOver]);

  // ── 랭킹 제출 ─────────────────────────────────────────────────
  async function handleSubmit() {
    const name = playerName.trim();
    if (!name) return;
    if (containsProfanity(name)) { setNameBanned(true); return; }
    setNameBanned(false);
    setSubmitState('loading');
    try {
      await rankingsApi.submit(GAME_KEY, {
        level:        LEVEL,
        name,
        score:        state.score,
        linesCleared: state.linesCleared,
        sessionId:    sessionIdRef.current,
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
    cancelDrag();
    init();
  }

  function handleReset() {
    setPlayerName('');
    setSubmitState('idle');
    setNameBanned(false);
    cancelDrag();
    reset();
  }

  // ── 미리보기 계산 ──────────────────────────────────────────────
  const boardPreview =
    dragState &&
    dragState.previewRow !== null &&
    dragState.previewCol !== null
      ? {
          piece: dragState.piece,
          row:   dragState.previewRow,
          col:   dragState.previewCol,
          valid: dragState.isValid,
        }
      : null;

  // ── 닉네임 등록 폼 (오버레이 내) ──────────────────────────────
  function RankForm() {
    if (submitState === 'done') {
      return <p style={{ color: '#6ee7b7', fontWeight: 700 }}>등록 완료!</p>;
    }
    return (
      <form
        className={styles.rankForm}
        onSubmit={(e) => { e.preventDefault(); void handleSubmit(); }}
      >
        <input
          className={`${styles.rankFormInput}${nameBanned ? ' ' + styles.error : ''}`}
          type="text"
          placeholder="닉네임 입력 (랭킹 등록)"
          value={playerName}
          onChange={(e) => { setPlayerName(e.target.value); setNameBanned(false); }}
          maxLength={12}
          autoFocus
        />
        {nameBanned     && <p className={styles.rankFormError}>사용할 수 없는 닉네임입니다.</p>}
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
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 12px', color: '#6366f1', letterSpacing: '0.04em' }}>
          블록 크러시
          <span style={{
            display: 'inline-block', marginLeft: 8,
            background: '#F59E0B', color: '#fff',
            fontSize: '0.5em', fontWeight: 700,
            padding: '2px 7px', borderRadius: 10,
            verticalAlign: 'middle',
          }}>BETA</span>
        </h1>

        <div className={styles.hudContainer}>

          {/* ── 상단 HUD ── */}
          <div className={styles.hudTop}>
            <div className={styles.hudStat}>
              <span className={styles.hudLabel}>SCORE</span>
              <span className={styles.hudValueScore}>{state.score.toLocaleString()}</span>
            </div>
            <div className={styles.hudStat}>
              <span className={styles.hudLabel}>LINES</span>
              <span className={styles.hudValue}>{state.linesCleared.toLocaleString()}</span>
            </div>
            {state.combo > 0 && (
              <div className={styles.hudStat}>
                <span className={styles.hudLabel}>COMBO</span>
                <span className={styles.hudValueCombo} key={state.combo}>×{state.combo}</span>
              </div>
            )}
          </div>

          {/* ── 보드 + 오버레이 ── */}
          <div className={styles.boardWrap}>
            {sessionReady ? (
              <BlockCrushBoard
                board={state.board}
                preview={boardPreview}
                boardRef={boardRef}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={cancelDrag}
              />
            ) : (
              <div style={{ width: '100%', aspectRatio: '1/1', maxWidth: 480, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1e1e2e' }}>
                <span style={{ color: '#6b7280' }}>로딩 중...</span>
              </div>
            )}

            {/* GAME OVER 오버레이 */}
            {state.status === 'gameOver' && (
              <div className={styles.overlay}>
                <h2 className={styles.overlayTitle}>GAME OVER</h2>
                <p className={styles.overlayLines}>{state.linesCleared}줄 클리어</p>
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
                      onClick={() => { void handleSubmit(); }}
                    >
                      {submitState === 'loading' ? '등록 중...' : '랭킹 등록'}
                    </button>
                  )}
                  <button className={styles.btnPrimary} onClick={handleNewGame}>↺ 다시하기</button>
                  <button className={styles.btnGhost}   onClick={() => navigate('/')}>메인으로</button>
                </div>
              </div>
            )}

            {/* IDLE 오버레이 — 시작 전 안내 */}
            {state.status === 'idle' && (
              <div className={styles.overlay}>
                <div className={styles.startGuide}>
                  <p style={{ fontSize: '2rem', margin: 0 }}>🟩</p>
                  <p style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f0f0f0', margin: 0 }}>블록 크러시</p>
                  <p className={styles.startGuideText}>
                    트레이에서 블록을 드래그해<br />보드에 배치하세요.<br />
                    가로/세로 줄이 가득 차면 클리어!
                  </p>
                  <button
                    className={styles.btnPrimary}
                    style={{ marginTop: 8, width: 180 }}
                    onClick={handleNewGame}
                    disabled={!sessionReady}
                  >
                    {sessionReady ? '▶ 게임 시작' : '로딩 중...'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── 트레이 ── */}
          {state.status === 'playing' && (
            <BlockCrushTray
              tray={state.tray}
              draggingSlot={dragState?.slotIndex ?? null}
              onPointerDown={(e: React.PointerEvent, slotIndex: 0 | 1 | 2, piece: Piece) =>
                onPointerDown(e, slotIndex, piece)
              }
            />
          )}

          {/* ── 하단 HUD ── */}
          <div className={styles.hudBottom}>
            {state.status === 'playing' && (
              <button className={`${styles.hudBtn} ${styles.quitBtn}`} onClick={handleReset}>
                처음부터
              </button>
            )}
            <button className={`${styles.hudBtn} ${styles.quitBtn}`} onClick={() => navigate('/')}>
              그만두기
            </button>
          </div>
        </div>

        {/* ── 주간 랭킹 ── */}
        <div className={styles.rankSection}>
          <p className={styles.rankTitle}>주간 랭킹 — Classic</p>
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
                  <th className={styles.colScore}>점수</th>
                  <th className={styles.colDate}>날짜</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((r, i) => {
                  const rankCls = [styles.rank1, styles.rank2, styles.rank3][i] ?? '';
                  return (
                    <tr key={r.id}>
                      <td className={`${styles.colRank} ${rankCls}`}>{i + 1}</td>
                      <td className={styles.colNick}>{r.name}</td>
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

          {/* ── 전체 최고 기록 ── */}
          {alltimeBest && (
            <div className={styles.alltimeBanner}>
              <span className={styles.alltimeBannerLabel}>전체 최고</span>
              <span className={styles.alltimeBannerName}>{alltimeBest.name}</span>
              <span className={styles.alltimeBannerScore}>{(alltimeBest.score ?? 0).toLocaleString()}점</span>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
