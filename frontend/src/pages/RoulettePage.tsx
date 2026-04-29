import { useState, useRef, useEffect, useCallback } from 'react';
import { gsap } from 'gsap';
import NormalHeader from '../components/normal/NormalHeader';
import styles from './RoulettePage.module.css';

const MAX_ITEMS = 20;
const R = 200;
const SIZE = R * 2 + 40;
const CX = SIZE / 2;
const CY = SIZE / 2;

const COLORS = [
  '#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6',
  '#1abc9c','#e67e22','#e91e63','#00bcd4','#8bc34a',
  '#ff5722','#607d8b','#795548','#9c27b0','#03a9f4',
  '#4caf50','#ffc107','#673ab7','#f06292','#26a69a',
];

function drawWheel(canvas: HTMLCanvasElement, items: string[], rot: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const n = items.length;
  if (n === 0) return;
  const step = (Math.PI * 2) / n;

  ctx.clearRect(0, 0, SIZE, SIZE);

  items.forEach((item, i) => {
    const start = rot + i * step;
    const end = start + step;
    ctx.beginPath();
    ctx.moveTo(CX, CY);
    ctx.arc(CX, CY, R, start, end);
    ctx.closePath();
    ctx.fillStyle = COLORS[i % COLORS.length];
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate(start + step / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'white';
    ctx.font = `bold ${n > 12 ? 11 : 13}px sans-serif`;
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 3;
    const label = item.length > 10 ? item.slice(0, 9) + '…' : item;
    ctx.fillText(label, R - 12, 5);
    ctx.restore();
  });

  // outer ring
  ctx.beginPath();
  ctx.arc(CX, CY, R, 0, Math.PI * 2);
  ctx.strokeStyle = '#2c3e50';
  ctx.lineWidth = 4;
  ctx.stroke();

  // center cap
  ctx.beginPath();
  ctx.arc(CX, CY, 18, 0, Math.PI * 2);
  ctx.fillStyle = '#2c3e50';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(CX, CY, 10, 0, Math.PI * 2);
  ctx.fillStyle = 'white';
  ctx.fill();

  // pointer (top)
  ctx.beginPath();
  ctx.moveTo(CX - 12, CY - R - 4);
  ctx.lineTo(CX + 12, CY - R - 4);
  ctx.lineTo(CX, CY - R + 22);
  ctx.closePath();
  ctx.fillStyle = '#2c3e50';
  ctx.fill();
}

export default function RoulettePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotRef = useRef(0);
  const tweenRef = useRef<gsap.core.Tween | null>(null);

  const [items, setItems] = useState(['항목 1', '항목 2', '항목 3', '항목 4', '항목 5', '항목 6']);
  const [newItem, setNewItem] = useState('');
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => { document.title = '룰렛'; }, []);

  const redraw = useCallback(() => {
    if (canvasRef.current) drawWheel(canvasRef.current, items, rotRef.current);
  }, [items]);

  useEffect(() => { redraw(); }, [redraw]);

  const addItem = () => {
    const trimmed = newItem.trim();
    if (!trimmed || items.length >= MAX_ITEMS) return;
    setItems(prev => [...prev, trimmed]);
    setNewItem('');
    setResult(null);
  };

  const removeItem = (i: number) => {
    if (items.length <= 2) return;
    setItems(prev => prev.filter((_, j) => j !== i));
    setResult(null);
  };

  const spin = () => {
    if (spinning || items.length < 2) return;
    tweenRef.current?.kill();
    setSpinning(true);
    setResult(null);

    const n = items.length;
    const step = (Math.PI * 2) / n;
    const winIdx = Math.floor(Math.random() * n);
    const targetMod = ((-Math.PI / 2 - winIdx * step - step / 2) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    const curMod = ((rotRef.current % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    let delta = targetMod - curMod;
    if (delta < 0) delta += Math.PI * 2;
    const finalRot = rotRef.current + delta + Math.PI * 2 * 10;

    tweenRef.current = gsap.to(rotRef, {
      current: finalRot,
      duration: 5.5,
      ease: 'power4.out',
      onUpdate: () => {
        if (canvasRef.current) drawWheel(canvasRef.current, items, rotRef.current);
      },
      onComplete: () => {
        setResult(items[winIdx]);
        setSpinning(false);
      },
    });
  };

  return (
    <div className={styles.page}>
      <NormalHeader currentGame="roulette" gameName="룰렛" accentColor="#3b82f6" />
      <div className={styles.content}>
        <div className={styles.main}>
          <div className={styles.wheelWrap}>
            <canvas ref={canvasRef} width={SIZE} height={SIZE} className={styles.canvas} />
            <button
              className={`${styles.spinBtn} ${spinning ? styles.spinning : ''}`}
              onClick={spin}
              disabled={spinning || items.length < 2}
            >
              {spinning ? '돌아가는 중…' : '돌리기!'}
            </button>
          </div>

          <div className={styles.sidebar}>
            <div className={styles.sideHead}>
              <span>항목 ({items.length}/{MAX_ITEMS})</span>
              <button className={styles.editToggle} onClick={() => setEditing(e => !e)}>
                {editing ? '완료' : '편집'}
              </button>
            </div>

            <div className={styles.itemList}>
              {items.map((item, i) => (
                <div key={i} className={styles.itemRow}
                  style={{ borderLeftColor: COLORS[i % COLORS.length] }}>
                  {editing ? (
                    <input
                      value={item}
                      onChange={e => setItems(prev => prev.map((x, j) => j === i ? e.target.value : x))}
                      className={styles.itemInput}
                    />
                  ) : (
                    <span className={styles.itemLabel}>{item}</span>
                  )}
                  {editing && items.length > 2 && (
                    <button className={styles.delBtn} onClick={() => removeItem(i)}>×</button>
                  )}
                </div>
              ))}
            </div>

            <div className={styles.addRow}>
              <input
                value={newItem}
                onChange={e => setNewItem(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addItem()}
                placeholder="새 항목 입력"
                className={styles.addInput}
                disabled={items.length >= MAX_ITEMS}
              />
              <button className={styles.addBtn} onClick={addItem}
                disabled={!newItem.trim() || items.length >= MAX_ITEMS}>
                추가
              </button>
            </div>
          </div>
        </div>

        {result && (
          <div className={styles.resultBanner}>
            <span className={styles.resultLabel}>🎉 당첨!</span>
            <span className={styles.resultValue}>{result}</span>
          </div>
        )}
      </div>
    </div>
  );
}
