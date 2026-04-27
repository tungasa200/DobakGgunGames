import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import type { ChatMessage, Phase, Player } from '../types';

interface ChatPanelProps {
  chatLog: ChatMessage[];
  players: Player[];
  phase: Phase;
  myRole: string;
  onSend: (text: string) => void;
}

export default function ChatPanel({ chatLog, players, phase, myRole, onSend }: ChatPanelProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isNightCitizenLocked = phase === 'night' && myRole !== 'mafia';
  const canChat = !isNightCitizenLocked && (phase === 'day' || (phase === 'night' && myRole === 'mafia'));

  useEffect(() => {
    if (!panelRef.current) return;
    const ctx = gsap.context(() => {
      gsap.to(panelRef.current, {
        x: open ? '0%' : '100%',
        duration: 0.4,
        ease: open ? 'power3.out' : 'power3.in',
      });
    });
    return () => ctx.revert();
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatLog]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || !canChat) return;
    onSend(text);
    setInput('');
  };

  const getPlayer = (id: string) => players.find(p => p.id === id);

  return (
    <>
      {/* Toggle Button */}
      <button
        className="chat-toggle-btn"
        onClick={() => setOpen(v => !v)}
        title="채팅 패널"
      >
        💬
      </button>

      {/* Panel */}
      <div className="chat-panel" ref={panelRef} style={{ transform: 'translateX(100%)' }}>
        <div className="chat-panel-header">
          <span className="chat-panel-title">
            {phase === 'night' && myRole === 'mafia' ? '🔴 MAFIA CHAT' : '채팅'}
          </span>
          <button className="chat-close-btn" onClick={() => setOpen(false)}>✕</button>
        </div>

        <div className="chat-messages">
          {chatLog.map((msg, idx) => {
            const player = getPlayer(msg.playerId);
            const isMe = player?.isMe ?? false;
            return (
              <div key={idx} className="chat-message">
                <div className="chat-message-header">
                  <span className={[
                    'chat-message-name',
                    isMe ? 'is-me' : '',
                    msg.isMafia ? 'is-mafia-chat' : '',
                  ].join(' ')}>
                    {player?.name ?? msg.playerId}
                    {isMe ? ' (나)' : ''}
                  </span>
                </div>
                <div className={[
                  'chat-message-bubble',
                  isMe ? 'is-me' : '',
                  msg.isMafia ? 'is-mafia-chat' : '',
                ].join(' ')}>
                  {msg.text}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {canChat ? (
          <div className="chat-input-area">
            <input
              className="chat-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
              placeholder="메시지를 입력하세요..."
              maxLength={100}
            />
            <button className="chat-send-btn" onClick={handleSend} disabled={!input.trim()}>
              ➤
            </button>
          </div>
        ) : (
          <div className="chat-night-disabled">
            🌙 밤에는 대화할 수 없습니다
          </div>
        )}
      </div>
    </>
  );
}
