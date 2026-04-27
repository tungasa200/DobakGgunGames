import { useState } from 'react';
import type { Player, Role, Phase } from '../types';

interface NightPanelProps {
  players: Player[];
  myRole: Role;
  phase: Phase;
}

export default function NightPanel({ players, myRole, phase }: NightPanelProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [actionDone, setActionDone] = useState(false);
  const [policeResult, setPoliceResult] = useState<'mafia' | 'innocent' | null>(null);

  if (phase !== 'night') return null;

  const alivePlayers = players.filter(p => p.alive);
  const targetList = myRole === 'mafia'
    ? alivePlayers.filter(p => p.role !== 'mafia')
    : alivePlayers.filter(p => !p.isMe);

  const handleAction = () => {
    if (!selected || actionDone) return;
    setActionDone(true);

    if (myRole === 'police') {
      const target = players.find(p => p.id === selected);
      setPoliceResult(target?.role === 'mafia' ? 'mafia' : 'innocent');
    }
  };

  const actionLabel: Record<string, string> = {
    mafia:   '처치 실행',
    police:  '조사 실행',
    doctor:  '보호 실행',
    citizen: '',
  };

  const titleLabel: Record<string, string> = {
    mafia:   '🔪 처치 대상을 선택하세요',
    police:  '🔵 조사할 대상을 선택하세요',
    doctor:  '💉 보호할 대상을 선택하세요',
    citizen: '',
  };

  if (myRole === 'citizen') {
    return (
      <div className="night-panel glass-panel">
        <p className="night-panel-title citizen">눈을 감고 기다리는 중</p>
        <div className="night-waiting">
          마피아가 움직이고 있습니다
          <span className="night-waiting-dots">...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="night-panel glass-panel">
      <p className={`night-panel-title ${myRole}`}>{titleLabel[myRole]}</p>
      <div className="night-player-list">
        {targetList.map(player => (
          <div
            key={player.id}
            className={[
              'night-player-item',
              selected === player.id ? `selected ${myRole}` : '',
            ].join(' ')}
            onClick={() => { if (!actionDone) setSelected(player.id); }}
          >
            <div className={`night-player-dot ${selected === player.id ? `selected ${myRole}` : ''}`} />
            <span className="night-player-name">{player.name}</span>
          </div>
        ))}
      </div>
      {!actionDone && (
        <button
          className={`night-action-btn ${myRole}`}
          disabled={!selected}
          onClick={handleAction}
        >
          {actionLabel[myRole]}
        </button>
      )}
      {actionDone && myRole !== 'police' && (
        <div className="night-result-banner innocent">
          행동 완료. 날이 밝기를 기다리세요.
        </div>
      )}
      {policeResult === 'mafia' && (
        <div className="night-result-banner mafia-found">
          마피아입니다!
        </div>
      )}
      {policeResult === 'innocent' && (
        <div className="night-result-banner innocent">
          무고합니다.
        </div>
      )}
    </div>
  );
}
