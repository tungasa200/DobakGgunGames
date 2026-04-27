/**
 * 배틀 UI 테스트 페이지 — 통신 없이 로컬에서 확인용
 * 라우트: /dev/battle-ui
 *
 * 확인 가능한 상태:
 *  1. 연습 모드 (대기 중 게임 실행)
 *  2. 2인 플레이 (상대 1명)
 *  3. 3인 플레이 (상대 2명)
 *  4. 4인 플레이 (상대 3명)
 *  5. 5인 플레이 (상대 4명, 풀방)
 *  6. 카운트다운 오버레이
 *  7. 결과 화면
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import BlockfallBattleBoard from '../games/blockfall/battle/BlockfallBattleBoard';
import type {
  PlayerInfo,
  OpponentBoardData,
} from '../games/blockfall/battle/BlockfallBattleBoard';
import '../games/blockfall/battle/blockfall-battle.css';

// ── 목업 상수 ─────────────────────────────────────────────
const BOARD_W = 11;
const BOARD_H = 23;

const MOCK_ME: PlayerInfo = { id: 'me', nickname: '나 (테스트)', isGuest: false };
const MOCK_OPP_1: PlayerInfo = { id: 'opp1', nickname: '플레이어2', isGuest: false };
const MOCK_OPP_2: PlayerInfo = { id: 'opp2', nickname: '손님-AB12', isGuest: true };
const MOCK_OPP_3: PlayerInfo = { id: 'opp3', nickname: '플레이어4', isGuest: false };
const MOCK_OPP_4: PlayerInfo = { id: 'opp4', nickname: '플레이어5', isGuest: false };

type TestScene =
  | 'practice'    // 연습 모드: 내 게임만, 상대 슬롯 "대기 중"
  | 'play-2p'     // 2인: 상대 1명 + 빈 슬롯 3개
  | 'play-3p'     // 3인: 상대 2명 + 빈 슬롯 2개
  | 'play-4p'     // 4인: 상대 3명 + 빈 슬롯 1개
  | 'play-5p'     // 5인: 상대 4명 (풀방)
  | 'countdown'   // 카운트다운 오버레이 (3초)
  | 'result';     // 결과 화면

const SCENE_LABELS: Record<TestScene, string> = {
  practice: '1. 연습 모드 (대기 중)',
  'play-2p': '2. 2인 플레이',
  'play-3p': '3. 3인 플레이',
  'play-4p': '4. 4인 플레이',
  'play-5p': '5. 5인 플레이 (풀방)',
  countdown: '6. 카운트다운 오버레이',
  result: '7. 결과 화면',
};

// 가짜 상대 보드 생성 (랜덤 블록들)
function makeMockBoard(density = 0.3): number[][] {
  return Array.from({ length: BOARD_H }, (_, y) =>
    Array.from({ length: BOARD_W }, () => {
      if (y < 4) return 0; // 상단은 비움
      return Math.random() < density ? Math.ceil(Math.random() * 7) : 0;
    })
  );
}

function makeMockOpponentData(score: number): OpponentBoardData {
  return { board: makeMockBoard(0.25), score, lines: Math.floor(score / 120), level: Math.floor(score / 1000) + 1 };
}

// 결과 화면 목업
interface MockResult {
  rank: number;
  nickname: string;
  score: number;
  isGuest: boolean;
  isMine: boolean;
}

const MOCK_RESULTS: MockResult[] = [
  { rank: 1, nickname: '플레이어2', score: 12400, isGuest: false, isMine: false },
  { rank: 2, nickname: '나 (테스트)', score: 9800, isGuest: false, isMine: true },
  { rank: 3, nickname: '손님-AB12', score: 5200, isGuest: true, isMine: false },
  { rank: 4, nickname: '플레이어4', score: 1100, isGuest: false, isMine: false },
  { rank: 5, nickname: '플레이어5', score: 400, isGuest: false, isMine: false },
];

const MOCK_TOP_RANKINGS = [
  { rank: 1, nickname: '레전드', winCount: 42 },
  { rank: 2, nickname: '플레이어2', winCount: 28 },
  { rank: 3, nickname: '나 (테스트)', winCount: 11 },
  { rank: 4, nickname: '손님-AB12', winCount: 7 },
  { rank: 5, nickname: '뉴비', winCount: 3 },
];

// ── 메인 컴포넌트 ──────────────────────────────────────────
export default function BattleUITestPage() {
  const [scene, setScene] = useState<TestScene>('practice');
  const [countdown, setCountdown] = useState(0);
  const [boardKey, setBoardKey] = useState(0); // 씬 전환 시 게임 리셋
  const [mockOpponents, setMockOpponents] = useState<Map<string, OpponentBoardData>>(new Map());
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // 씬별 설정
  const sceneConfig: Record<TestScene, { players: PlayerInfo[]; isPlaying: boolean; isPractice: boolean }> = {
    practice: { players: [], isPlaying: false, isPractice: true },
    'play-2p': { players: [MOCK_ME, MOCK_OPP_1], isPlaying: true, isPractice: false },
    'play-3p': { players: [MOCK_ME, MOCK_OPP_1, MOCK_OPP_2], isPlaying: true, isPractice: false },
    'play-4p': { players: [MOCK_ME, MOCK_OPP_1, MOCK_OPP_2, MOCK_OPP_3], isPlaying: true, isPractice: false },
    'play-5p': { players: [MOCK_ME, MOCK_OPP_1, MOCK_OPP_2, MOCK_OPP_3, MOCK_OPP_4], isPlaying: true, isPractice: false },
    countdown: { players: [MOCK_ME, MOCK_OPP_1, MOCK_OPP_2], isPlaying: false, isPractice: true },
    result: { players: [], isPlaying: false, isPractice: false },
  };

  const cfg = sceneConfig[scene];

  // 씬 전환 핸들러
  const switchScene = useCallback((s: TestScene) => {
    if (countdownTimer.current) clearInterval(countdownTimer.current);
    setCountdown(0);

    if (s === 'countdown') {
      // 카운트다운 시뮬레이션 (3초)
      setCountdown(3);
      countdownTimer.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownTimer.current!);
            countdownTimer.current = null;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    // 씬이 바뀌면 게임 보드 리셋
    if (s !== scene) setBoardKey(k => k + 1);
    setScene(s);

    // 상대 보드 목업 갱신
    const opp = new Map<string, OpponentBoardData>();
    if (s === 'play-2p') {
      opp.set('opp1', makeMockOpponentData(8400));
    } else if (s === 'play-3p') {
      opp.set('opp1', makeMockOpponentData(8400));
      opp.set('opp2', makeMockOpponentData(3200));
    } else if (s === 'play-4p') {
      opp.set('opp1', makeMockOpponentData(12100));
      opp.set('opp2', makeMockOpponentData(6600));
      opp.set('opp3', makeMockOpponentData(900));
    } else if (s === 'play-5p') {
      opp.set('opp1', makeMockOpponentData(15800));
      opp.set('opp2', makeMockOpponentData(9400));
      opp.set('opp3', makeMockOpponentData(4200));
      opp.set('opp4', makeMockOpponentData(700));
    }
    setMockOpponents(opp);
  }, [scene]);

  useEffect(() => {
    return () => { if (countdownTimer.current) clearInterval(countdownTimer.current); };
  }, []);

  // 상대 보드를 주기적으로 업데이트 (애니메이션 효과)
  useEffect(() => {
    if (!cfg.isPlaying) return;
    const interval = setInterval(() => {
      setMockOpponents(prev => {
        const next = new Map(prev);
        next.forEach((data, id) => {
          // 점수만 살짝 올림 (보드는 그대로 — 실제 렌더링 확인용)
          next.set(id, { ...data, score: data.score + Math.floor(Math.random() * 50) });
        });
        return next;
      });
    }, 800);
    return () => clearInterval(interval);
  }, [cfg.isPlaying, scene]);

  // 페이지 타이틀
  useEffect(() => {
    document.title = '[DEV] 배틀 UI 테스트 | DobakGgun';
    return () => { document.title = '도박꾼게임즈'; };
  }, []);

  // ── 결과 화면 ───────────────────────────────────────────
  if (scene === 'result') {
    return (
      <div className="battle-page">
        {/* 개발자 컨트롤 패널 */}
        <DevControlPanel scene={scene} onSwitch={switchScene} />
        <header className="battle-header">
          <span className="battle-header-title">블록폴 배틀 — [DEV] 결과 화면 미리보기</span>
        </header>
        <div className="battle-lab-banner" role="region">
          <div className="battle-lab-banner-icon">!</div>
          <div className="battle-lab-banner-text">
            테스트 단계 기능입니다. 운영 게임이 아니므로 기록이 저장되지 않을 수 있습니다.
          </div>
        </div>
        <div className="battle-content">
          <div className="result-screen">
            <h2 className="result-title">배틀 종료</h2>
            <div className="result-panels">
              <div className="result-panel">
                <p className="result-panel-title">이번 배틀 순위</p>
                <ul className="result-list" role="list">
                  {MOCK_RESULTS.map(r => (
                    <li
                      key={r.rank}
                      className={`result-item${r.isMine ? ' result-item-mine' : ''}`}
                      role="listitem"
                    >
                      {r.rank <= 3 ? (
                        <span className="result-rank">{['🥇', '🥈', '🥉'][r.rank - 1]}</span>
                      ) : (
                        <span className="result-rank-text">{r.rank}위</span>
                      )}
                      <span className="result-nickname">{r.nickname}</span>
                      {r.isMine && <span className="result-me-badge">(나)</span>}
                      {r.isGuest && <span className="result-guest-badge">(게스트)</span>}
                      <span className="result-score">{r.score.toLocaleString()}점</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="ranking-panel">
                <p className="ranking-panel-title">역대 승수 TOP 10</p>
                <ul className="ranking-panel-list" role="list">
                  {MOCK_TOP_RANKINGS.map(r => (
                    <li key={r.rank} className="ranking-panel-item" role="listitem">
                      <span className={`ranking-panel-rank${r.rank <= 3 ? ` rank-${r.rank}` : ''}`}>
                        {r.rank}위
                      </span>
                      <span className="ranking-panel-nickname">{r.nickname}</span>
                      <span className="ranking-panel-wins">승 {r.winCount}회</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="result-btns">
              <button className="battle-btn-primary" onClick={() => switchScene('practice')} type="button">
                다시 배틀
              </button>
              <button className="battle-btn-secondary" type="button" onClick={() => {}}>
                홈으로 (비활성)
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── 게임 레이아웃 화면 (practice / play-Np / countdown) ──
  return (
    <div className="battle-page">
      {/* 개발자 컨트롤 패널 */}
      <DevControlPanel scene={scene} onSwitch={switchScene} />

      {/* 헤더 */}
      <header className="battle-header">
        <span className="battle-header-title">
          블록폴 배틀 — [DEV] {SCENE_LABELS[scene]}
        </span>
      </header>

      {/* 테스트 배너 */}
      <div className="battle-lab-banner" role="region">
        <div className="battle-lab-banner-icon">!</div>
        <div className="battle-lab-banner-text">
          테스트 단계 기능입니다. 이 화면은 개발자 전용 UI 테스트 페이지입니다.
        </div>
      </div>

      {/* 상태 바 (waiting/countdown 상태 시뮬레이션) */}
      {(scene === 'practice' || scene === 'countdown') && (
        <div className="battle-status-bar">
          {scene === 'countdown' ? (
            <span className="battle-status-text">게임 시작 준비 중! 플레이어 3명</span>
          ) : (
            <span className="battle-status-text">
              플레이어 대기 중 <strong>1/5</strong>
            </span>
          )}
          <button className="battle-status-leave-btn" type="button" onClick={() => {}}>
            나가기 (비활성)
          </button>
        </div>
      )}

      {/* 메인 게임 영역 */}
      <div className="battle-content" style={{ position: 'relative' }}>
        {/* 카운트다운 오버레이 */}
        {scene === 'countdown' && countdown > 0 && (
          <div className="battle-countdown-overlay">
            <div className="battle-countdown-big" key={countdown}>{countdown}</div>
            <div className="battle-countdown-label">초 후 게임 시작!</div>
          </div>
        )}

        <BlockfallBattleBoard
          key={`${scene}-${boardKey}`}
          players={cfg.players}
          myPlayerId="me"
          opponents={mockOpponents}
          eliminatedPlayers={new Map()}
          garbagePending={0}
          onGameOver={() => {}}
          onBlockOut={() => {}}
          onBoardChange={() => {}}
          onComboAttack={() => {}}
          onGarbageConsumed={() => {}}
          isPlaying={cfg.isPlaying}
          isPractice={cfg.isPractice}
        />
      </div>
    </div>
  );
}

// ── 개발자 컨트롤 패널 ──────────────────────────────────────
interface DevControlPanelProps {
  scene: TestScene;
  onSwitch: (s: TestScene) => void;
}

function DevControlPanel({ scene, onSwitch }: DevControlPanelProps) {
  const scenes: TestScene[] = ['practice', 'play-2p', 'play-3p', 'play-4p', 'play-5p', 'countdown', 'result'];
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      zIndex: 9999,
      background: 'rgba(0,0,0,0.85)',
      border: '1px solid #6366F1',
      borderRadius: '0 0 0 8px',
      padding: '8px 10px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      minWidth: 180,
    }}>
      <div style={{ fontSize: 10, color: '#6366F1', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 2 }}>
        DEV · 씬 선택
      </div>
      {scenes.map(s => (
        <button
          key={s}
          type="button"
          onClick={() => onSwitch(s)}
          style={{
            background: scene === s ? '#6366F1' : '#1c2128',
            color: scene === s ? '#fff' : '#8b949e',
            border: '1px solid ' + (scene === s ? '#6366F1' : '#30363d'),
            borderRadius: 4,
            padding: '4px 8px',
            cursor: 'pointer',
            fontSize: 11,
            textAlign: 'left',
            fontWeight: scene === s ? 700 : 400,
            transition: 'all 0.1s',
          }}
        >
          {SCENE_LABELS[s]}
        </button>
      ))}
      <div style={{ fontSize: 9, color: '#484f58', marginTop: 4 }}>
        화살표키로 게임 조작 가능
      </div>
    </div>
  );
}
