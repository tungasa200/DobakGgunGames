import './mafia.css';
import { useMafiaGame } from './useMafiaGame';
import MafiaScene from './MafiaScene';
import RoleCard from './components/RoleCard';
import PhaseOverlay from './components/PhaseOverlay';
import VotePanel from './components/VotePanel';
import NightPanel from './components/NightPanel';
import ChatPanel from './components/ChatPanel';
import GameResult from './components/GameResult';

const TIMER_MAX = 30;

function TimerCircle({ value, max = TIMER_MAX }: { value: number; max?: number; phase: string }) {
  const R = 22;
  const circ = 2 * Math.PI * R;
  const offset = circ - (value / max) * circ;
  const pct = value / max;
  const color = pct > 0.5 ? '#4fc3f7' : pct > 0.25 ? '#ffd700' : '#e94560';

  return (
    <div className="mafia-timer">
      <svg width="56" height="56" viewBox="0 0 56 56">
        <circle
          className="mafia-timer-circle-bg"
          cx="28" cy="28" r={R}
        />
        <circle
          className="mafia-timer-circle"
          cx="28" cy="28" r={R}
          stroke={color}
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="mafia-timer-text" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function PlayerHUD({ players }: { players: ReturnType<typeof useMafiaGame>['state']['players'] }) {
  return (
    <div className="player-seats-hud">
      {players.map(player => (
        <div
          key={player.id}
          className={[
            'player-hud-item',
            player.isMe ? 'is-me' : '',
            !player.alive ? 'dead' : '',
          ].join(' ')}
        >
          <div className={`player-hud-dot ${!player.alive ? 'dead-dot' : player.isMe ? 'me' : 'alive'}`} />
          <span className="player-hud-name">{player.name}</span>
          {player.isMe && <span className="player-hud-tag me-tag">나</span>}
          {!player.alive && <span className="player-hud-dead-x">✕</span>}
        </div>
      ))}
    </div>
  );
}

export default function MafiaGame() {
  const { state, startGame, castVote, confirmVote, sendChat, restartGame } = useMafiaGame();
  const { phase, players, dayCount, timer, chatLog, winner, eliminatedThisRound } = state;

  const mePlayer = players.find(p => p.isMe);
  const myRole = mePlayer?.role ?? 'citizen';
  const myVoteTarget = mePlayer?.voteTarget;

  const showHUD = phase !== 'lobby' && phase !== 'roleReveal' && phase !== 'result';

  return (
    <div className="mafia-root">
      {/* 3D Canvas */}
      <div className="mafia-canvas-wrapper">
        {phase !== 'lobby' && (
          <MafiaScene
            state={state}
            onSelectPlayer={(id) => {
              if (phase === 'vote') castVote(id);
            }}
          />
        )}
        {/* Lobby background */}
        {phase === 'lobby' && (
          <div style={{
            width: '100%', height: '100%',
            background: 'radial-gradient(ellipse at 30% 70%, rgba(15,52,96,0.5) 0%, rgba(5,5,8,1) 60%)',
          }} />
        )}
      </div>

      {/* UI Layer */}
      <div className="mafia-ui-layer">
        {/* Lobby */}
        {phase === 'lobby' && (
          <div className="mafia-lobby">
            <h1 className="mafia-title">MA<span>FIA</span></h1>
            <p className="mafia-subtitle">모던 스릴러 마피아</p>
            <div className="mafia-player-list-preview">
              {players.map(p => (
                <div key={p.id} className={`mafia-player-chip ${p.isMe ? 'is-me' : ''}`}>
                  {p.name}{p.isMe ? ' ★' : ''}
                </div>
              ))}
            </div>
            <button className="btn-mafia-primary" onClick={startGame}>
              게임 시작
            </button>
          </div>
        )}

        {/* Role Reveal */}
        {phase === 'roleReveal' && (
          <RoleCard role={myRole} visible={true} />
        )}

        {/* Phase Overlay (Day/Night transition) */}
        <PhaseOverlay phase={phase} dayCount={dayCount} />

        {/* HUD Top Bar */}
        {showHUD && (
          <div className="mafia-hud-top">
            <div className="hud-phase-badge">
              <span className={`hud-phase-label ${phase === 'vote' || phase === 'voteResult' ? 'vote' : phase === 'night' ? 'night' : 'day'}`}>
                {phase === 'day' ? `DAY ${dayCount}`
                  : phase === 'night' ? 'NIGHT'
                  : phase === 'vote' ? 'VOTE'
                  : phase === 'voteResult' ? 'RESULT'
                  : ''}
              </span>
              <span className="hud-day-count">
                생존 {players.filter(p => p.alive).length}명
              </span>
            </div>

            {(phase === 'day' || phase === 'night') && (
              <TimerCircle value={timer} phase={phase} />
            )}
          </div>
        )}

        {/* Eliminated Banner */}
        {(phase === 'day' || phase === 'night') && eliminatedThisRound && (
          <div className="eliminated-banner">
            {players.find(p => p.id === eliminatedThisRound)?.name} 님이 탈락했습니다 💀
          </div>
        )}

        {/* Player HUD (left side) */}
        {showHUD && <PlayerHUD players={players} />}

        {/* Vote Panel */}
        {(phase === 'vote' || phase === 'voteResult') && (
          <VotePanel
            players={players}
            phase={phase}
            myVoteTarget={myVoteTarget}
            eliminatedThisRound={eliminatedThisRound}
            onVote={castVote}
            onConfirmVote={confirmVote}
          />
        )}

        {/* Night Panel */}
        {phase === 'night' && (
          <NightPanel
            players={players}
            myRole={myRole}
            phase={phase}
          />
        )}

        {/* Chat Panel */}
        {showHUD && (
          <ChatPanel
            chatLog={chatLog}
            players={players}
            phase={phase}
            myRole={myRole}
            onSend={sendChat}
          />
        )}

        {/* Game Result */}
        {phase === 'result' && winner && (
          <GameResult
            winner={winner}
            players={players}
            onRestart={restartGame}
          />
        )}
      </div>
    </div>
  );
}
