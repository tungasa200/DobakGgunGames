import { useEffect, useRef, useState } from 'react';
import styles from './yacht.module.css';

interface YachtDice3DProps {
  value: number;          // 1~6 (0/그 외는 1로 fallback)
  isKept: boolean;
  isMyTurn: boolean;
  isRolling: boolean;
  onToggleKeep: () => void;
}

// 각 face가 카메라(+Z)를 향하도록 큐브를 회전시키는 각도
const FACE_ROT: Record<number, { x: number; y: number }> = {
  1: { x: 0,   y: 0   },
  2: { x: 90,  y: 0   },
  3: { x: 0,   y: 270 },
  4: { x: 0,   y: 90  },
  5: { x: 270, y: 0   },
  6: { x: 0,   y: 180 },
};

// 면별 핍 위치 [left%, top%]
const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[25, 75], [75, 25]],
  3: [[75, 25], [50, 50], [25, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 18], [75, 18], [25, 50], [75, 50], [25, 82], [75, 82]],
};

function DieFace({ value }: { value: number }) {
  return (
    <>
      {PIPS[value].map(([left, top], i) => (
        <span
          key={i}
          className={styles.dicePip}
          style={{ left: `${left}%`, top: `${top}%` }}
        />
      ))}
    </>
  );
}

export default function YachtDice3D({
  value,
  isKept,
  isMyTurn,
  isRolling,
  onToggleKeep,
}: YachtDice3DProps) {
  const safeVal = value >= 1 && value <= 6 ? value : 1;

  const [rot, setRot] = useState<{ x: number; y: number }>(() => ({
    ...FACE_ROT[safeVal],
  }));
  const lastValRef = useRef(safeVal);

  useEffect(() => {
    if (lastValRef.current === safeVal) return;
    lastValRef.current = safeVal;
    if (isKept) return; // 고정된 주사위는 회전하지 않음

    const face = FACE_ROT[safeVal];
    // 굴림 중이면 여러 바퀴, 그 외(예: 마운트 직후 동기화)는 한 바퀴만
    const extraX = isRolling ? (3 + Math.floor(Math.random() * 3)) * 360 : 360;
    const extraY = isRolling ? (3 + Math.floor(Math.random() * 3)) * 360 : 360;
    setRot((prev) => ({
      x: Math.ceil(prev.x / 360) * 360 + extraX + face.x,
      y: Math.ceil(prev.y / 360) * 360 + extraY + face.y,
    }));
  }, [safeVal, isKept, isRolling]);

  const canInteract = isMyTurn;

  return (
    <div
      className={[
        styles.diceWrapper,
        isKept ? styles.diceWrapperKept : '',
        !canInteract ? styles.diceWrapperNotMyTurn : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={canInteract ? onToggleKeep : undefined}
      role={canInteract ? 'button' : undefined}
      aria-label={
        canInteract
          ? `주사위 ${safeVal} ${isKept ? '(고정됨, 클릭하여 해제)' : '(클릭하여 고정)'}`
          : `주사위 ${safeVal}`
      }
      aria-pressed={canInteract ? isKept : undefined}
      tabIndex={canInteract ? 0 : undefined}
      onKeyDown={
        canInteract
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onToggleKeep();
              }
            }
          : undefined
      }
    >
      <div className={styles.diceScene}>
        <div
          className={styles.diceCube}
          style={{ transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg)` }}
        >
          <div className={`${styles.diceFace} ${styles.diceFace1}`}><DieFace value={1} /></div>
          <div className={`${styles.diceFace} ${styles.diceFace6}`}><DieFace value={6} /></div>
          <div className={`${styles.diceFace} ${styles.diceFace2}`}><DieFace value={2} /></div>
          <div className={`${styles.diceFace} ${styles.diceFace5}`}><DieFace value={5} /></div>
          <div className={`${styles.diceFace} ${styles.diceFace3}`}><DieFace value={3} /></div>
          <div className={`${styles.diceFace} ${styles.diceFace4}`}><DieFace value={4} /></div>
        </div>
      </div>
      {isKept && <span className={styles.diceKeptLabel}>KEEP</span>}
    </div>
  );
}
