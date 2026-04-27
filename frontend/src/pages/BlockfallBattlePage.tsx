import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  joinBattle,
  getStoredGuestToken,
  clearGuestToken,
} from '../api/blockfallBattleApi';
import { useBattleWebSocket } from '../api/blockfallBattleApi';
import BlockfallBattleBoard from '../games/blockfall/battle/BlockfallBattleBoard';
import type {
  PlayerInfo,
  OpponentBoardData,
} from '../games/blockfall/battle/BlockfallBattleBoard';
import type {
  BattleJoinResponse,
  BattleResultEntry,
  TopRankingEntry,
} from '../games/blockfall/types/battle.types';
import '../styles/blockfall-battle.css';

// ── 공통 타입 재수출 ──────────────────────────────────────
export type { PlayerInfo, OpponentBoardData };

type PagePhase =
  | 'loading'   // joinBattle 요청 중
  | 'waiting'   // WAITING 방 대기
  | 'countdown' // 카운트다운
  | 'queued'    // PLAYING 방의 큐 대기
  | 'playing'   // 게임 중
  | 'finished'  // 결과 화면
  | 'error';    // 에러

interface PlayerLeftToastState {
  id: number;
  nickname: string;
}

// 결과 자동 전환 카운트다운 (10초)
const RESULT_AUTO_SECONDS = 10;

export default function BlockfallBattlePage() {
  const { user, accessToken } = useAuth();
  const navigate = useNavigate();

  // ── 상태 ───────────────────────────────────────────────
  const [phase, setPhase] = useState<PagePhase>('loading');
  const [joinInfo, setJoinInfo] = useState<BattleJoinResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 게임 중 상태
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [opponents, setOpponents] = useState<Map<string, OpponentBoardData>>(new Map());
  const [eliminatedPlayers, setEliminatedPlayers] = useState<Map<string, { rank: number }>>(new Map());
  const [garbagePending, setGarbagePending] = useState(0);
  const [countdown, setCountdown] = useState(0);

  // 플레이어 이탈 토스트
  const [playerLeftToast, setPlayerLeftToast] = useState<PlayerLeftToastState | null>(null);
  const toastIdRef = useRef(0);

  // 결과 화면 상태
  const [results, setResults] = useState<BattleResultEntry[]>([]);
  const [topRankings, setTopRankings] = useState<TopRankingEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [resultCountdown, setResultCountdown] = useState(RESULT_AUTO_SECONDS);

  // 큐 카운트다운
  const [queueCountdown, setQueueCountdown] = useState<number | null>(null);

  const startedRef = useRef(false);
  const myGameOverRef = useRef(false);
  const myFinalScoreRef = useRef(0);

  // WS 활성 여부
  const wsEnabled = joinInfo !== null && (phase === 'waiting' || phase === 'countdown' || phase === 'queued' || phase === 'playing');

  const authParam = joinInfo?.isGuest
    ? (joinInfo.guestToken ?? '')
    : (accessToken ?? '');

  const ws = useBattleWebSocket(
    joinInfo?.roomId ?? '',
    joinInfo?.playerId ?? '',
    authParam,
    joinInfo?.isGuest ?? false,
    wsEnabled,
  );

  // ── 매칭 시작 ─────────────────────────────────────────
  const startJoin = useCallback(async () => {
    setPhase('loading');
    setErrorMessage(null);

    try {
      const existingToken = getStoredGuestToken();
      const res = await joinBattle(accessToken, existingToken);
      setJoinInfo(res);

      if (res.status === 'WAITING') {
        setPhase('waiting');
      } else {
        // PLAYING — 큐 진입
        setPhase('queued');
      }
    } catch (err) {
      const e = err as Error & { code?: string; roomId?: string };
      if (e.code === 'ALREADY_IN_ROOM') {
        setErrorMessage('이미 다른 방에 참가 중입니다.');
      } else {
        setErrorMessage(e.message ?? '배틀 참가에 실패했습니다.');
      }
      setPhase('error');
    }
  }, [accessToken]);

  // 마운트 시 1회만 실행
  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      void startJoin();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── WebSocket 이벤트 처리 ─────────────────────────────

  // ROOM_STATE
  useEffect(() => {
    const rs = ws.roomState;
    if (!rs) return;

    setPlayers(rs.players.map(p => ({
      id: p.id,
      nickname: p.nickname,
      isGuest: p.isGuest,
    })));

    if (rs.status === 'WAITING' && phase === 'queued') {
      // 큐 대기자 → WAITING 화면으로 자동 전환
      setPhase('waiting');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws.roomState]);

  // GAME_STARTED
  useEffect(() => {
    if (!ws.gameStarted) return;
    myGameOverRef.current = false;
    myFinalScoreRef.current = 0;
    setOpponents(new Map());
    setEliminatedPlayers(new Map());
    setGarbagePending(0);
    setPlayers(ws.gameStarted.players.map(p => ({
      id: p.id,
      nickname: p.nickname,
      isGuest: p.isGuest,
    })));
    setPhase('playing');
  }, [ws.gameStarted]);

  // BOARD_UPDATE — 상대 보드 갱신
  useEffect(() => {
    const updates = ws.boardUpdates;
    if (updates.size === 0) return;
    setOpponents(new Map(
      Array.from(updates.entries()).map(([id, data]) => [
        id,
        {
          board: data.board,
          score: data.score,
          lines: data.lines,
          level: data.level,
        },
      ])
    ));
  }, [ws.boardUpdates]);

  // GARBAGE_ATTACK
  useEffect(() => {
    setGarbagePending(ws.garbagePending);
  }, [ws.garbagePending]);

  // PLAYER_FINISHED
  useEffect(() => {
    const finished = ws.playerFinished;
    if (finished.size === 0) return;
    setEliminatedPlayers(new Map(
      Array.from(finished.entries()).map(([id, data]) => [id, { rank: data.rank }])
    ));
  }, [ws.playerFinished]);

  // GAME_RESULT
  useEffect(() => {
    const result = ws.gameResult;
    if (!result) return;

    setResults(result.results);
    setTopRankings(result.topRankings);
    setResultCountdown(RESULT_AUTO_SECONDS);

    // 내 순위
    const myResult = result.results.find(r => r.playerId === joinInfo?.playerId);
    if (myResult) setMyRank(myResult.rank);

    // 게스트 토큰 폐기
    clearGuestToken();

    setPhase('finished');
  }, [ws.gameResult, joinInfo?.playerId]);

  // MATCH_COUNTDOWN
  useEffect(() => {
    if (ws.countdown > 0) {
      setCountdown(ws.countdown);
      setPhase(prev => (prev === 'playing' ? 'playing' : 'countdown'));
    } else if (ws.countdown === 0 && phase === 'countdown') {
      // 카운트다운 취소 → 대기로 복귀
      setPhase('waiting');
      setCountdown(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws.countdown]);

  // WS 연결 에러
  useEffect(() => {
    if (ws.wsStatus === 'error') {
      setErrorMessage('서버와의 연결이 실패했습니다. 다시 시도해 주세요.');
      setPhase('error');
    }
  }, [ws.wsStatus]);

  // 결과 화면 10초 카운트다운
  useEffect(() => {
    if (phase !== 'finished') return;
    if (resultCountdown <= 0) return;
    const timer = setInterval(() => {
      setResultCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, resultCountdown]);

  // 큐 대기 시 GAME_RESULT 후 카운트다운 처리
  useEffect(() => {
    if (phase !== 'queued' || !ws.gameResult) return;
    setQueueCountdown(RESULT_AUTO_SECONDS);
  }, [phase, ws.gameResult]);

  useEffect(() => {
    if (queueCountdown === null || queueCountdown <= 0) return;
    const timer = setInterval(() => {
      setQueueCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [queueCountdown]);

  // ── 게임 이벤트 핸들러 ────────────────────────────────

  const handleGameOver = useCallback((score: number) => {
    myGameOverRef.current = true;
    myFinalScoreRef.current = score;
    // 게임 오버 후 GAME_RESULT 대기
  }, []);

  const handleBlockOut = useCallback(() => {
    ws.sendPlayerFinished();
  }, [ws]);

  const handleBoardChange = useCallback((
    board: number[][],
    score: number,
    lines: number,
    level: number,
    combo: number,
  ) => {
    ws.sendBoardState(board, score, lines, level, combo);
  }, [ws]);

  const handleComboAttack = useCallback((combo: number) => {
    ws.sendComboAttack(combo, null);
  }, [ws]);

  const handleGarbageConsumed = useCallback(() => {
    setGarbagePending(0);
  }, []);

  const handleLeave = useCallback(() => {
    ws.sendLeave();
    clearGuestToken();
    navigate('/');
  }, [ws, navigate]);

  const handleRetry = useCallback(() => {
    startedRef.current = false;
    setJoinInfo(null);
    setPhase('loading');
    setResults([]);
    setTopRankings([]);
    setMyRank(null);
    setResultCountdown(RESULT_AUTO_SECONDS);
    setQueueCountdown(null);
    setPlayers([]);
    setOpponents(new Map());
    setEliminatedPlayers(new Map());
    void startJoin();
  }, [startJoin]);

  // ── 페이지 타이틀 ─────────────────────────────────────
  useEffect(() => {
    document.title = '블록폴 배틀 | DobakGgun';
    return () => { document.title = '도박꾼게임즈'; };
  }, []);

  // 플레이어 이탈 토스트 표시 헬퍼 (향후 WS 훅에서 PLAYER_LEFT payload 수신 시 사용)
  const showPlayerLeftToast = useCallback((nickname: string) => {
    const id = ++toastIdRef.current;
    setPlayerLeftToast({ id, nickname });
    setTimeout(() => {
      setPlayerLeftToast(prev => (prev?.id === id ? null : prev));
    }, 2200);
  }, []);

  void showPlayerLeftToast;

  // ── 공통 컴포넌트 ─────────────────────────────────────

  const renderHeader = (showBack = true) => (
    <header className="battle-header">
      {showBack && (
        <button className="battle-header-back" onClick={handleLeave} type="button">
          ← 홈으로
        </button>
      )}
      <span className="battle-header-title">블록폴 배틀</span>
    </header>
  );

  const renderLabBanner = () => (
    <div
      className="battle-lab-banner"
      role="region"
      aria-label="테스트 단계 경고"
    >
      <div className="battle-lab-banner-icon" aria-hidden="true">!</div>
      <div className="battle-lab-banner-text">
        테스트 단계 기능입니다. 운영 게임이 아니므로 기록이 저장되지 않을 수 있습니다.
        {joinInfo?.isGuest === true && (
          <span className="battle-lab-banner-guest">
            게스트 전적은 저장되지 않습니다.
          </span>
        )}
      </div>
    </div>
  );

  const renderReconnectBanner = () => ws.wsStatus === 'reconnecting' ? (
    <div className="battle-reconnect-banner">
      연결이 불안정합니다. 재연결 시도 중...
    </div>
  ) : null;

  const renderPlayerLeftToast = () => playerLeftToast ? (
    <div
      className="battle-player-left-toast"
      role="alert"
      aria-live="assertive"
    >
      <span>[나감]</span>
      <span>{playerLeftToast.nickname}님이 나갔습니다</span>
    </div>
  ) : null;

  // 에러 코드 한글 설명
  const getErrorDescription = (msg: string | null): string => {
    if (!msg) return '알 수 없는 오류가 발생했습니다.';
    if (msg.includes('ROOM_NOT_FOUND')) return '방을 찾을 수 없습니다.';
    if (msg.includes('NOT_IN_ROOM')) return '참가 중인 방이 없습니다.';
    if (msg.includes('UNAUTHORIZED')) return '인증 정보가 만료되었습니다. 다시 시도해 주세요.';
    if (msg.includes('MATCH_UNAVAILABLE')) return '잠시 후 다시 시도해 주세요.';
    return msg;
  };

  // ── 렌더 ──────────────────────────────────────────────

  // 로딩
  if (phase === 'loading') {
    return (
      <div className="battle-page">
        {renderHeader(false)}
        {renderLabBanner()}
        <div className="battle-content">
          <div className="battle-loading">
            <div className="battle-spinner" />
            <p>매칭 중...</p>
          </div>
        </div>
      </div>
    );
  }

  // 에러
  if (phase === 'error') {
    return (
      <div className="battle-page">
        {renderHeader()}
        {renderLabBanner()}
        <div className="battle-content">
          <div className="battle-error-screen">
            <span className="battle-error-icon">⚠</span>
            <p className="battle-error-title">연결 오류가 발생했습니다</p>
            <p className="battle-error-msg">{getErrorDescription(errorMessage)}</p>
            <div className="battle-error-btns">
              <button className="battle-btn-primary" onClick={handleRetry} type="button">
                다시 시도
              </button>
              <button className="battle-btn-secondary" onClick={() => navigate('/')} type="button">
                홈으로
              </button>
            </div>
          </div>
        </div>
        {renderPlayerLeftToast()}
      </div>
    );
  }

  // 큐 대기
  if (phase === 'queued') {
    const qp = ws.queuePosition;
    return (
      <div className="battle-page">
        {renderHeader()}
        {renderLabBanner()}
        {renderReconnectBanner()}
        <div className="battle-content">
          <div className="waiting-screen">
            <div className="waiting-icon stopped" aria-hidden="true">⏳</div>

            <p className="waiting-title">현재 게임 진행 중입니다</p>
            <p className="waiting-sub">다음 라운드에 자동으로 참가됩니다</p>

            {qp && (
              <div
                className="waiting-queue-info"
                aria-live="polite"
                aria-atomic="true"
                aria-label={`대기열 위치: ${qp.position}번째 / 총 ${qp.totalInQueue}명`}
              >
                대기열 위치{' '}
                <span className="waiting-queue-position" key={qp.position}>
                  {qp.position}
                </span>
                번째 / 총 {qp.totalInQueue}명 대기
              </div>
            )}

            {queueCountdown !== null && queueCountdown > 0 && (
              <>
                <p className="queue-countdown-text">다음 라운드까지 약 {queueCountdown}초</p>
                <div
                  className="queue-countdown-bar-wrap"
                  role="progressbar"
                  aria-valuenow={queueCountdown}
                  aria-valuemin={0}
                  aria-valuemax={RESULT_AUTO_SECONDS}
                  aria-label="다음 라운드까지 남은 시간"
                >
                  <div
                    className="queue-countdown-bar-fill"
                    style={{ width: `${(queueCountdown / RESULT_AUTO_SECONDS) * 100}%` }}
                  />
                </div>
              </>
            )}

            <button className="waiting-leave-btn" onClick={handleLeave} type="button">
              나가기
            </button>
          </div>
        </div>
        {renderPlayerLeftToast()}
      </div>
    );
  }

  // 대기 + 카운트다운
  if (phase === 'waiting' || phase === 'countdown') {
    const isCountingDown = phase === 'countdown' && countdown > 0;
    const playerCount = players.length;
    const queueCount = ws.roomState?.queueCount ?? 0;

    return (
      <div className="battle-page">
        {renderHeader()}
        {renderLabBanner()}
        {renderReconnectBanner()}
        <div className="battle-content">
          <div className="waiting-screen">
            {/* 아이콘 */}
            <div
              className={`waiting-icon${isCountingDown ? ' stopped' : ''}`}
              aria-hidden="true"
            >
              🟦
            </div>

            {/* 타이틀 */}
            {isCountingDown ? (
              <p className="waiting-title-countdown">{countdown}초 후 게임이 시작됩니다!</p>
            ) : (
              <>
                <p
                  className="waiting-title"
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  플레이어 대기 중
                </p>
                <div className="waiting-dots-row" aria-hidden="true">
                  <span className="waiting-dot" />
                  <span className="waiting-dot" />
                  <span className="waiting-dot" />
                </div>
              </>
            )}

            {/* 카운트다운 숫자 */}
            {isCountingDown && (
              <div
                className="waiting-countdown-number"
                key={countdown}
                role="timer"
                aria-live="assertive"
                aria-label={`게임 시작까지 ${countdown}초`}
              >
                {countdown}
              </div>
            )}

            {/* 서브 텍스트 */}
            {!isCountingDown && (
              <p className="waiting-sub">
                다른 플레이어가 입장하면 자동으로 게임이 시작됩니다
              </p>
            )}

            {/* 참가자 목록 */}
            <ul className="waiting-player-list" role="list">
              {players.map(p => (
                <li key={p.id} className="waiting-player-item" role="listitem">
                  <span className="waiting-player-dot" aria-hidden="true" />
                  <span className="waiting-player-name">{p.nickname}</span>
                  {p.id === joinInfo?.playerId && (
                    <span className="waiting-player-me">(나)</span>
                  )}
                  {p.isGuest && (
                    <span className="waiting-player-guest">(게스트)</span>
                  )}
                  <span className="waiting-player-status">대기중</span>
                </li>
              ))}
            </ul>

            {/* 인원 표시 */}
            <p
              className="waiting-player-count"
              aria-live="polite"
              aria-atomic="true"
            >
              현재 인원: <strong>{playerCount}</strong> / 4
              {queueCount > 0 && (
                <span className="waiting-queue-count">(대기열에 {queueCount}명 대기 중)</span>
              )}
            </p>

            <button className="waiting-leave-btn" onClick={handleLeave} type="button">
              나가기
            </button>
          </div>
        </div>
        {renderPlayerLeftToast()}
      </div>
    );
  }

  // 게임 중
  if (phase === 'playing') {
    return (
      <div className="battle-page">
        {renderHeader()}
        {renderLabBanner()}
        {renderReconnectBanner()}
        <div className="battle-content">
          <BlockfallBattleBoard
            players={players}
            myPlayerId={joinInfo?.playerId ?? ''}
            opponents={opponents}
            eliminatedPlayers={eliminatedPlayers}
            garbagePending={garbagePending}
            onGameOver={handleGameOver}
            onBlockOut={handleBlockOut}
            onBoardChange={handleBoardChange}
            onComboAttack={handleComboAttack}
            onGarbageConsumed={handleGarbageConsumed}
            isPlaying={true}
          />
        </div>
        {renderPlayerLeftToast()}
      </div>
    );
  }

  // 결과 화면
  if (phase === 'finished') {
    return (
      <div className="battle-page">
        {renderHeader()}
        {renderLabBanner()}
        <div className="battle-content">
          <div className="result-screen">
            <h2 className="result-title">
              {myRank === 1 ? '승리! 🎉' : '배틀 종료'}
            </h2>

            {/* 2열 패널 (데스크톱) / 1열 (모바일) */}
            <div className="result-panels">
              {/* 이번 배틀 순위 패널 */}
              <div className="result-panel">
                <p className="result-panel-title">이번 배틀 순위</p>
                <ul className="result-list" role="list" aria-label="이번 배틀 순위">
                  {results.map((r) => {
                    const isMine = r.playerId === joinInfo?.playerId;
                    return (
                      <li
                        key={r.playerId}
                        className={`result-item${isMine ? ' result-item-mine' : ''}`}
                        role="listitem"
                      >
                        {r.rank <= 3 ? (
                          <span className="result-rank">
                            {['🥇', '🥈', '🥉'][r.rank - 1]}
                          </span>
                        ) : (
                          <span className="result-rank-text">{r.rank}위</span>
                        )}
                        <span className="result-nickname">{r.nickname}</span>
                        {isMine && <span className="result-me-badge">(나)</span>}
                        {r.isGuest && <span className="result-guest-badge">(게스트)</span>}
                        <span className="result-score">{r.score.toLocaleString()}점</span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* 역대 승수 TOP 10 패널 — 결과 화면에서만 표시 (PRD §9.3, 컴포넌트 명세 §8.5) */}
              <div className="ranking-panel">
                <p className="ranking-panel-title">역대 승수 TOP 10</p>
                {topRankings.length === 0 ? (
                  <p className="ranking-panel-empty">아직 기록이 없습니다</p>
                ) : (
                  <ul className="ranking-panel-list" role="list" aria-label="역대 승수 TOP 10">
                    {topRankings.map((r) => {
                      const isMyEntry = !joinInfo?.isGuest && user?.nickname === r.nickname;
                      return (
                        <li
                          key={r.rank}
                          className={`ranking-panel-item${isMyEntry ? ' ranking-item-mine' : ''}`}
                          role="listitem"
                        >
                          <span className={`ranking-panel-rank${r.rank <= 3 ? ` rank-${r.rank}` : ''}`}>
                            {r.rank}위
                          </span>
                          <span className="ranking-panel-nickname">{r.nickname}</span>
                          <span className="ranking-panel-wins">승 {r.winCount}회</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            {/* 자동 전환 카운트다운 바 */}
            <div className="result-countdown-area">
              <p className="result-countdown-text">
                {resultCountdown > 0
                  ? `${resultCountdown}초 후 다음 라운드가 자동으로 시작됩니다`
                  : '다음 라운드 대기 중...'}
              </p>
              <div
                className="result-countdown-bar-wrap"
                role="progressbar"
                aria-valuenow={resultCountdown}
                aria-valuemin={0}
                aria-valuemax={RESULT_AUTO_SECONDS}
                aria-label="다음 라운드까지 남은 시간"
              >
                <div
                  className="result-countdown-bar-fill"
                  style={{ width: `${(resultCountdown / RESULT_AUTO_SECONDS) * 100}%` }}
                />
              </div>
            </div>

            {/* 버튼 */}
            <div className="result-btns">
              <button
                className="battle-btn-primary"
                onClick={handleRetry}
                type="button"
              >
                다시 배틀
              </button>
              <button
                className="battle-btn-secondary"
                onClick={() => navigate('/')}
                type="button"
              >
                홈으로
              </button>
            </div>

            {/* 비로그인 안내 */}
            {!user && (
              <p style={{ fontSize: '13px', color: '#9CA3AF', margin: '4px 0 0', textAlign: 'center' }}>
                로그인하면 승수가 기록됩니다.{' '}
                <button
                  style={{ background: 'none', border: 'none', color: 'var(--battle-accent)', cursor: 'pointer', fontSize: 'inherit', textDecoration: 'underline', padding: 0 }}
                  onClick={() => navigate('/login')}
                  type="button"
                >
                  로그인
                </button>
              </p>
            )}
          </div>
        </div>
        {renderPlayerLeftToast()}
      </div>
    );
  }

  // fallback
  return (
    <div className="battle-page">
      {renderHeader()}
      {renderLabBanner()}
      <div className="battle-content">
        <div className="battle-loading">
          <div className="battle-spinner" />
          <p>준비 중...</p>
        </div>
      </div>
    </div>
  );
}
