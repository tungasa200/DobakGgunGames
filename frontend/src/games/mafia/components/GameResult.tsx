import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import type { Player } from '../types';

interface GameResultProps {
  winner: 'mafia' | 'citizen';
  players: Player[];
  onRestart: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  mafia:   'MAFIA',
  police:  'POLICE',
  doctor:  'DOCTOR',
  citizen: 'CITIZEN',
};

export default function GameResult({ winner, players, onRestart }: GameResultProps) {
  const winnerTextRef = useRef<HTMLDivElement>(null);
  const subRef = useRef<HTMLDivElement>(null);
  const rolesRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<HTMLDivElement[]>([]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline();

      // Spawn particles
      const count = 40;
      for (let i = 0; i < count; i++) {
        const el = document.createElement('div');
        el.className = 'result-particle';
        el.style.background = winner === 'citizen'
          ? `hsl(${190 + Math.random() * 60}deg, 80%, 60%)`
          : `hsl(${350 + Math.random() * 30}deg, 80%, 60%)`;
        el.style.left = `${Math.random() * 100}%`;
        el.style.top = `${Math.random() * 100}%`;
        containerRef.current?.appendChild(el);
        particlesRef.current.push(el);

        gsap.fromTo(el,
          { x: 0, y: 0, opacity: 1, scale: 1 },
          {
            x: (Math.random() - 0.5) * 600,
            y: (Math.random() - 0.5) * 600,
            opacity: 0,
            scale: Math.random() * 2,
            duration: 1.5 + Math.random() * 1.5,
            delay: Math.random() * 0.5,
            ease: 'power2.out',
          }
        );
      }

      tl.to(winnerTextRef.current, {
        opacity: 1,
        scale: 1,
        duration: 0.8,
        ease: 'back.out(1.4)',
      });

      tl.to(subRef.current, {
        opacity: 1,
        duration: 0.5,
        ease: 'power2.out',
      }, '-=0.3');

      tl.to(rolesRef.current, {
        opacity: 1,
        duration: 0.5,
        ease: 'power2.out',
      }, '-=0.2');

      tl.to(btnRef.current, {
        opacity: 1,
        y: 0,
        duration: 0.5,
        ease: 'back.out(1.5)',
      }, '-=0.1');
    });

    return () => {
      ctx.revert();
      particlesRef.current.forEach(el => el.remove());
      particlesRef.current = [];
    };
  }, [winner]);

  return (
    <div className="game-result" ref={containerRef}>
      <div
        className="game-result-bg"
        style={{
          background: winner === 'citizen'
            ? 'radial-gradient(ellipse at center, rgba(79,195,247,0.15) 0%, rgba(5,5,8,0.95) 70%)'
            : 'radial-gradient(ellipse at center, rgba(233,69,96,0.15) 0%, rgba(5,5,8,0.95) 70%)',
        }}
      />

      <div className="game-result-content">
        <div
          ref={winnerTextRef}
          className={`game-result-winner-text ${winner}`}
        >
          {winner === 'citizen' ? 'CITIZENS WIN' : 'MAFIA WINS'}
        </div>

        <div ref={subRef} className="game-result-sub">
          {winner === 'citizen' ? '시민들이 마피아를 모두 색출했습니다' : '마피아가 마을을 장악했습니다'}
        </div>

        <div ref={rolesRef} className="game-result-roles">
          {players.map(player => (
            <div
              key={player.id}
              className={`game-result-role-card ${player.role}`}
            >
              {!player.alive && <span className="result-card-dead">✕</span>}
              <span className="result-card-name">{player.name}{player.isMe ? ' (나)' : ''}</span>
              <span className="result-card-role">{ROLE_LABELS[player.role]}</span>
            </div>
          ))}
        </div>

        <button
          ref={btnRef}
          className="btn-mafia-primary"
          style={{ opacity: 0, transform: 'translateY(20px)' }}
          onClick={onRestart}
        >
          다시 하기
        </button>
      </div>
    </div>
  );
}
