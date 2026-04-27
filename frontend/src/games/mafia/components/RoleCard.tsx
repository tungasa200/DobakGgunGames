import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import type { Role } from '../types';

interface RoleCardProps {
  role: Role;
  visible: boolean;
}

const ROLE_CONFIG: Record<Role, { icon: string; label: string; desc: string; className: string }> = {
  mafia:   { icon: '🔪', label: 'MAFIA',   desc: '밤마다 시민을 제거하세요',           className: 'mafia'   },
  police:  { icon: '🔵', label: 'POLICE',  desc: '밤마다 한 명씩 정체를 조사하세요',   className: 'police'  },
  doctor:  { icon: '💉', label: 'DOCTOR',  desc: '밤마다 한 명을 마피아로부터 보호하세요', className: 'doctor'  },
  citizen: { icon: '👤', label: 'CITIZEN', desc: '토론과 투표로 마피아를 색출하세요',   className: 'citizen' },
};

export default function RoleCard({ role, visible }: RoleCardProps) {
  const innerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible || !innerRef.current || !wrapperRef.current) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(wrapperRef.current,
        { opacity: 0, scale: 0.7, y: 40 },
        { opacity: 1, scale: 1, y: 0, duration: 0.6, ease: 'back.out(1.7)' }
      );

      gsap.to(innerRef.current, {
        rotateY: 180,
        delay: 1.2,
        duration: 0.9,
        ease: 'power2.inOut',
      });
    });

    return () => ctx.revert();
  }, [visible]);

  const cfg = ROLE_CONFIG[role];

  return (
    <div className="role-card-scene">
      <p className="role-card-title">당신의 역할</p>
      <div className="role-card-wrapper" ref={wrapperRef}>
        <div className="role-card-inner" ref={innerRef}>
          {/* Front */}
          <div className="role-card-face role-card-front">
            <span className="role-card-front-icon">?</span>
            <span className="role-card-front-text">ROLE</span>
          </div>
          {/* Back */}
          <div className={`role-card-face role-card-back ${cfg.className}`}>
            <span className="role-card-role-icon">{cfg.icon}</span>
            <span className="role-card-role-name">{cfg.label}</span>
            <span className="role-card-role-desc">{cfg.desc}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
