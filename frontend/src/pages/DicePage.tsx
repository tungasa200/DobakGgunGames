import { useState, useCallback, useEffect } from 'react';
import NormalHeader from '../components/normal/NormalHeader';
import styles from './DicePage.module.css';

const MAX_DICE = 10;
const ROLL_DURATION = 900;

// Cube rotation to bring each face toward the camera (+Z direction)
const FACE_ROT: Record<number, { x: number; y: number }> = {
  1: { x: 0,   y: 0   },
  2: { x: 90,  y: 0   },
  3: { x: 0,   y: 270 },
  4: { x: 0,   y: 90  },
  5: { x: 270, y: 0   },
  6: { x: 0,   y: 180 },
};

// Pip positions [left%, top%] for each face value
const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[25, 75], [75, 25]],
  3: [[75, 25], [50, 50], [25, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 18], [75, 18], [25, 50], [75, 50], [25, 82], [75, 82]],
};

interface DieData {
  id: number;
  rotX: number;
  rotY: number;
  value: number;
}

function DieFace({ value }: { value: number }) {
  return (
    <>
      {PIPS[value].map(([left, top], i) => (
        <span key={i} className={styles.pip} style={{ left: `${left}%`, top: `${top}%` }} />
      ))}
    </>
  );
}

function Die({ die }: { die: DieData }) {
  return (
    <div className={styles.scene}>
      <div
        className={styles.die}
        style={{ transform: `rotateX(${die.rotX}deg) rotateY(${die.rotY}deg)` }}
      >
        <div className={`${styles.face} ${styles.f1}`}><DieFace value={1} /></div>
        <div className={`${styles.face} ${styles.f6}`}><DieFace value={6} /></div>
        <div className={`${styles.face} ${styles.f2}`}><DieFace value={2} /></div>
        <div className={`${styles.face} ${styles.f5}`}><DieFace value={5} /></div>
        <div className={`${styles.face} ${styles.f3}`}><DieFace value={3} /></div>
        <div className={`${styles.face} ${styles.f4}`}><DieFace value={4} /></div>
      </div>
    </div>
  );
}

export default function DicePage() {
  useEffect(() => { document.title = '주사위'; }, []);

  const [nextId, setNextId] = useState(1);
  const [dice, setDice] = useState<DieData[]>([
    { id: 0, rotX: 0, rotY: 0, value: 1 },
  ]);
  const [rolling, setRolling] = useState(false);
  const [hasRolled, setHasRolled] = useState(false);

  const addDie = () => {
    if (dice.length >= MAX_DICE || rolling) return;
    setDice(prev => [...prev, { id: nextId, rotX: 0, rotY: 0, value: 1 }]);
    setNextId(n => n + 1);
    setHasRolled(false);
  };

  const removeDie = () => {
    if (dice.length <= 1 || rolling) return;
    setDice(prev => prev.slice(0, -1));
    setHasRolled(false);
  };

  const rollAll = useCallback(() => {
    if (rolling) return;
    setRolling(true);
    setHasRolled(true);

    setDice(prev => prev.map(die => {
      const value = Math.floor(Math.random() * 6) + 1;
      const face = FACE_ROT[value];
      // Always go forward: round up to nearest 360 multiple, then add extra spins + face offset
      const spinsX = (3 + Math.floor(Math.random() * 3)) * 360;
      const spinsY = (3 + Math.floor(Math.random() * 3)) * 360;
      const baseX = Math.ceil(die.rotX / 360) * 360;
      const baseY = Math.ceil(die.rotY / 360) * 360;
      return {
        ...die,
        value,
        rotX: baseX + spinsX + face.x,
        rotY: baseY + spinsY + face.y,
      };
    }));

    setTimeout(() => setRolling(false), ROLL_DURATION + 100);
  }, [rolling]);

  const total = dice.reduce((s, d) => s + d.value, 0);

  return (
    <div className={styles.page}>
      <NormalHeader currentGame="dice" gameName="주사위" accentColor="#3b82f6" />

      <div className={styles.content}>
        <div className={styles.controls}>
          <button
            className={styles.ctrlBtn}
            onClick={removeDie}
            disabled={dice.length <= 1 || rolling}
          >
            − 제거
          </button>
          <span className={styles.count}>{dice.length} / {MAX_DICE}</span>
          <button
            className={styles.ctrlBtn}
            onClick={addDie}
            disabled={dice.length >= MAX_DICE || rolling}
          >
            + 추가
          </button>
        </div>

        <div className={styles.diceGrid}>
          {dice.map(die => <Die key={die.id} die={die} />)}
        </div>

        <button
          className={`${styles.rollBtn} ${rolling ? styles.rolling : ''}`}
          onClick={rollAll}
          disabled={rolling}
        >
          {rolling ? '굴리는 중…' : '🎲 굴리기!'}
        </button>

        {hasRolled && !rolling && (
          <div className={styles.results}>
            {dice.length > 1 && (
              <div className={styles.totalRow}>
                <span className={styles.totalLabel}>합계</span>
                <span className={styles.totalNum}>{total}</span>
              </div>
            )}
            <div className={styles.resultList}>
              {dice.map((die, i) => (
                <div key={die.id} className={styles.resultRow}>
                  <span className={styles.dieName}>주사위 {i + 1}</span>
                  <span className={styles.dieResult}>{die.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
