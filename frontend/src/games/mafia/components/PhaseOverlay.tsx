import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import type { Phase } from '../types';

interface PhaseOverlayProps {
  phase: Phase;
  dayCount: number;
}

export default function PhaseOverlay({ phase, dayCount }: PhaseOverlayProps) {
  const textRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const prevPhaseRef = useRef<Phase>('lobby');

  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = phase;

    if (phase !== 'day' && phase !== 'night') return;
    if (prev === phase && phase === 'day') return; // don't re-animate same day
    if (!textRef.current) return;

    const isNight = phase === 'night';
    const ctx = gsap.context(() => {
      const tl = gsap.timeline();

      if (bgRef.current && isNight) {
        tl.to(bgRef.current, {
          opacity: 1,
          duration: 0.8,
          ease: 'power2.inOut',
        }, 0);
      } else if (bgRef.current) {
        tl.to(bgRef.current, {
          opacity: 0,
          duration: 0.8,
          ease: 'power2.inOut',
        }, 0);
      }

      tl.fromTo(textRef.current,
        { opacity: 0, scale: 0.4, y: 20 },
        { opacity: 1, scale: 1, y: 0, duration: 0.6, ease: 'back.out(1.5)' },
        isNight ? 0.3 : 0
      );

      tl.to(textRef.current, {
        opacity: 0,
        scale: 1.15,
        duration: 0.5,
        ease: 'power2.in',
        delay: 1.2,
      });
    });

    return () => ctx.revert();
  }, [phase, dayCount]);

  if (phase !== 'day' && phase !== 'night') return null;

  const isNight = phase === 'night';

  return (
    <div className="phase-overlay" style={{ pointerEvents: 'none' }}>
      <div
        ref={bgRef}
        className="phase-overlay-bg"
        style={{ opacity: 0 }}
      />
      <div
        ref={textRef}
        className={`phase-overlay-text ${isNight ? 'night' : 'day'}`}
      >
        {isNight ? '🌙 NIGHT' : `☀ DAY ${dayCount}`}
      </div>
    </div>
  );
}
