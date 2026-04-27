import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  joinBattle,
  getStoredGuestToken,
  saveJoinInfo,
  getStoredJoinInfo,
  clearJoinInfo,
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
import '../games/blockfall/battle/blockfall-battle.css';

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

  const startedRef = useRef(false);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const myGameOverRef = useRef(false);
  const myFinalScoreRef = useRef(0);

  // WS 활성 여부
  const wsEnabled = joinInfo !== null && (
    phase === 'waiting' ||
    phase === 'countdown' ||
    phase === 'queued' ||
    phase === 'playing' ||
    phase === 'finished'
  );

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
      saveJoinInfo(res);
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
        // 리프레시 등으로 ALREADY_IN_ROOM → 저장된 joinInfo로 WS 재연결 시도
        const stored = getStoredJoinInfo();
        if (stored) {
          setJoinInfo(stored);
          setPhase('waiting'); // ROOM_STATE 수신 시 실제 phase로 보정됨
          return;
        }
        setErrorMessage('이미 다른 방에 참가 중입니다. 잠시 후 다시 시도해 주세요.');
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

    // setPhase 콜백으로 현재 phase를 참조 — stale closure 방지
    setPhase(prev => {
      if (rs.status === 'WAITING' && prev === 'queued') return 'waiting';
      // 재연결 시: 서버가 이미 PLAYING/FINISHED → 실제 상태로 보정
      if (rs.status === 'PLAYING' && (prev === 'waiting' || prev === 'countdown')) return 'playing';
      if (rs.status === 'FINISHED' && (prev === 'waiting' || prev === 'countdown')) return 'finished';
      return prev;
    });
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

    // 내 순위
    const myResult = result.results.find(r => r.playerId === joinInfo?.playerId);
    if (myResult) setMyRank(myResult.rank);

    // joinInfo는 유지 — Ready 시스템으로 다음 라운드 참여 가능
    // 명시적 이탈(handleLeave) 시에만 clearJoinInfo() 호출

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

  // 클라이언트 사이드 카운트다운 틱
  useEffect(() => {
    if (phase !== 'countdown') {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      return;
    }
    countdownIntervalRef.current = setInterval(() => {
      setCountdown(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [phase]);

  // WS 연결 에러
  useEffect(() => {
    if (ws.wsStatus === 'error') {
      setErrorMessage('서버와의 연결이 실패했습니다. 다시 시도해 주세요.');
      setPhase('error');
    }
  }, [ws.wsStatus]);

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
    clearJoinInfo(); // joinInfo + guestToken 모두 정리 → 재연결 방지
    setTimeout(() => navigate('/'), 100);
  }, [ws, navigate]);

  const handleReady = useCallback(() => {
    ws.sendPlayerReady();
  }, [ws]);

  const handleRetry = useCallback(() => {
    startedRef.current = false;
    setJoinInfo(null);
    setPhase('loading');
    setResults([]);
    setTopRankings([]);
    setMyRank(null);
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
    if (msg.includes('ALREADY_IN_ROOM') || msg.includes('이미 다른 방에'))
      return '이미 다른 방에 참가 중입니다. 잠시 후 다시 시도해 주세요.';
    if (msg.includes('UNAUTHORIZED_GUEST_TOKEN'))
      return '인증 정보가 올바르지 않습니다. 다시 시도해 주세요.';
    if (msg.includes('UNAUTHORIZED'))
      return '로그인 정보가 만료되었습니다. 다시 로그인 후 시도해 주세요.';
    if (msg.includes('MATCH_UNAVAILABLE'))
      return '일시적으로 매칭을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.';
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('fetch'))
      return '서버에 연결할 수 없습니다. 네트워크 상태를 확인해 주세요.';
    if (msg.includes('서버와의 연결이 실패')) return msg;
    // 그 외 영문 에러코드가 그대로 노출되는 경우 대체
    if (/^[A-Z_]+$/.test(msg.trim())) return '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
    return msg;
  };

  // ── 상태 바 (waiting/queued/countdown 단계에서 헤더 아래 표시) ──
  const renderStatusBar = () => {
    if (
      phase === 'loading' ||
      phase === 'playing' ||
      phase === 'error' ||
      phase === 'finished'
    ) return null;

    const playerCount = players.length;
    const queueCount = ws.roomState?.queueCount ?? 0;
    const qp = ws.queuePosition;

    return (
      <div className="battle-status-bar">
        {phase === 'queued' ? (
          <span className="battle-status-text">
            현재 게임 진행 중 — 대기열 {qp?.position ?? '?'}번째
          </span>
        ) : phase === 'countdown' ? (
          <span className="battle-status-text">
            게임 시작 준비 중! 플레이어 {playerCount}명
          </span>
        ) : (
          <span className="battle-status-text">
            플레이어 대기 중 <strong>{playerCount}/5</strong>
            {queueCount > 0 && ` · 대기열 ${queueCount}명`}
          </span>
        )}
        <button className="battle-status-leave-btn" onClick={handleLeave} type="button">나가기</button>
      </div>
    );
  };

  // ── 렌더 ──────────────────────────────────────────────

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

            {/* 준비 상태 표시 */}
            {ws.readyState && (
              <p style={{ textAlign: 'center', color: '#8b949e', fontSize: 13, margin: '8px 0 0' }}>
                준비 완료: {ws.readyState.readyCount} / {ws.readyState.totalCount}명
              </p>
            )}

            {/* 버튼 */}
            <div className="result-btns">
              <button
                className="battle-btn-primary"
                onClick={handleReady}
                type="button"
                disabled={ws.wsStatus !== 'connected'}
              >
                {ws.wsStatus !== 'connected' ? '재연결 중...' : '다음 라운드 준비'}
              </button>
              <button
                className="battle-btn-secondary"
                onClick={handleLeave}
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

  // 혼자 대기 중일 때 연습 게임 표시
  if (phase === 'waiting' && players.length <= 1) {
    return (
      <div className="battle-page">
        {renderHeader()}
        {renderLabBanner()}
        <div className="battle-content" style={{ flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <p style={{ color: '#8b949e', fontSize: 13, margin: 0 }}>
            상대를 기다리는 중 — 연습 게임 중
          </p>
          <BlockfallBattleBoard
            players={players.length > 0 ? players : [{
              id: joinInfo?.playerId ?? '',
              nickname: user?.nickname ?? '나',
              isGuest: joinInfo?.isGuest ?? true,
            }]}
            myPlayerId={joinInfo?.playerId ?? ''}
            opponents={new Map()}
            eliminatedPlayers={new Map()}
            garbagePending={0}
            onGameOver={() => {}}
            onBlockOut={() => {}}
            onBoardChange={() => {}}
            onComboAttack={() => {}}
            onGarbageConsumed={() => {}}
            isPlaying={true}
            isPractice={true}
          />
        </div>
        {renderPlayerLeftToast()}
      </div>
    );
  }

  // ── 통일된 게임 레이아웃 (loading/waiting/countdown/queued/playing) ──
  const isPractice = phase !== 'playing';

  return (
    <div className="battle-page">
      {renderHeader()}
      {renderLabBanner()}
      {renderReconnectBanner()}
      {renderStatusBar()}
      <div className="battle-content" style={{ position: 'relative' }}>
        {/* 카운트다운 오버레이 */}
        {phase === 'countdown' && countdown > 0 && (
          <div className="battle-countdown-overlay">
            <div className="battle-countdown-big" key={countdown}>{countdown}</div>
            <div className="battle-countdown-label">초 후 게임 시작!</div>
          </div>
        )}
        {/* 로딩 오버레이 (매칭 중 표시, 게임도 동시에 실행) */}
        {phase === 'loading' && (
          <div className="battle-loading-overlay">
            <div className="battle-spinner" />
            <p className="battle-loading-text">매칭 중...</p>
          </div>
        )}
        <BlockfallBattleBoard
          key={phase === 'playing' ? 'real' : 'practice'}
          isPractice={isPractice}
          isPlaying={phase === 'playing'}
          players={players}
          myPlayerId={joinInfo?.playerId ?? 'practice'}
          opponents={phase === 'playing' ? opponents : new Map()}
          eliminatedPlayers={phase === 'playing' ? eliminatedPlayers : new Map()}
          garbagePending={phase === 'playing' ? garbagePending : 0}
          onGameOver={handleGameOver}
          onBlockOut={handleBlockOut}
          onBoardChange={handleBoardChange}
          onComboAttack={handleComboAttack}
          onGarbageConsumed={handleGarbageConsumed}
        />
      </div>
      {renderPlayerLeftToast()}
    </div>
  );
}
