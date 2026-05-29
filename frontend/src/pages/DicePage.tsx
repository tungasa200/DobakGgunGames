import { useState, useCallback, useEffect, useRef } from 'react';
import * as THREE from 'three';
import NormalHeader from '../components/normal/NormalHeader';
import styles from './DicePage.module.css';
import { createCubeGeometry } from '../games/yacht/components/YachtDiceRow3D';
import {
  createOctahedronGeometry,
  createAtlasTexture,
} from '../games/yacht/components/dice/createOctahedronGeometry';
import {
  createDodecahedronGeometry,
  createAtlasTexture12,
  FACE_ROT_D12,
} from '../games/yacht/components/dice/createDodecahedronGeometry';

// ============================================================
// 타입 / 상수
// ============================================================
type DiceMode = 'd6' | 'd8' | 'd12';

const MAX_DICE = 10;
const ROLL_DURATION = 900;
const CANVAS_SIZE = 80;
const TWO_PI = Math.PI * 2;

const D6_SIZE = 1.2;
const D6_CORNER_R = 0.18;
const D6_PIP_R = 0.078;
const D6_PIP_DEPTH = 0.038;
const D6_SEGMENTS = 96;

const D8_R = 1.0;
const D8_CORNER_R = 0.12;
const D8_DETAIL = 5;
const D8_NUMERAL_EXTENT = 1.15;
const D8_SCALE = 0.88;

const D12_SCALE = 0.75;

const CAM_HALF = (D6_SIZE * 1.5) / 2;

// ============================================================
// 공유 WebGL 렌더러 (모듈 싱글톤)
// 모바일 WebGL 컨텍스트 한도 초과 방지
// ============================================================
const SHARED_DPR = typeof window !== 'undefined'
  ? Math.min(window.devicePixelRatio || 1, 2)
  : 1;

let _sharedRenderer: THREE.WebGLRenderer | null = null;

function getSharedRenderer(): THREE.WebGLRenderer {
  if (_sharedRenderer) return _sharedRenderer;
  const offscreen = document.createElement('canvas');
  offscreen.width = CANVAS_SIZE * SHARED_DPR;
  offscreen.height = CANVAS_SIZE * SHARED_DPR;
  _sharedRenderer = new THREE.WebGLRenderer({ canvas: offscreen, antialias: true, alpha: true });
  _sharedRenderer.setPixelRatio(1);
  _sharedRenderer.setSize(CANVAS_SIZE * SHARED_DPR, CANVAS_SIZE * SHARED_DPR, false);
  _sharedRenderer.outputColorSpace = THREE.SRGBColorSpace;
  _sharedRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  _sharedRenderer.toneMappingExposure = 1.0;
  _sharedRenderer.setClearColor(0x000000, 0);
  return _sharedRenderer;
}

// ============================================================
// 면별 카메라 방향 Euler 회전
// ============================================================
const PITCH_D8 = Math.asin(1 / Math.sqrt(3));

const FACE_ROT_D6: Record<number, { x: number; y: number }> = {
  1: { x: 0,            y: 0           },
  2: { x: -Math.PI / 2, y: 0           },
  3: { x: 0,            y:  Math.PI/2  },
  4: { x: 0,            y: -Math.PI/2  },
  5: { x:  Math.PI / 2, y: 0           },
  6: { x: 0,            y:  Math.PI    },
};

const FACE_ROT_D8: Record<number, { x: number; y: number }> = {
  1: { x:  PITCH_D8, y: -Math.PI / 4     },
  2: { x:  PITCH_D8, y: -Math.PI * 3 / 4 },
  3: { x: -PITCH_D8, y: -Math.PI / 4     },
  4: { x: -PITCH_D8, y: -Math.PI * 3 / 4 },
  5: { x:  PITCH_D8, y:  Math.PI / 4     },
  6: { x:  PITCH_D8, y:  Math.PI * 3 / 4 },
  7: { x: -PITCH_D8, y:  Math.PI / 4     },
  8: { x: -PITCH_D8, y:  Math.PI * 3 / 4 },
};

function getFaceRot(value: number, mode: DiceMode): { x: number; y: number } {
  if (mode === 'd8') return FACE_ROT_D8[value] ?? FACE_ROT_D8[1];
  if (mode === 'd12') return FACE_ROT_D12[value] ?? FACE_ROT_D12[1];
  return FACE_ROT_D6[value] ?? FACE_ROT_D6[1];
}

function maxFaces(mode: DiceMode): number {
  return mode === 'd6' ? 6 : mode === 'd8' ? 8 : 12;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// ============================================================
// Die3D — 공유 렌더러로 그린 뒤 2D 캔버스에 blit
// ============================================================
interface Die3DProps {
  rotX: number;
  rotY: number;
  diceMode: DiceMode;
  instant?: boolean;
}

function Die3D({ rotX, rotY, diceMode, instant }: Die3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const threeRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.OrthographicCamera;
    mesh: THREE.Mesh;
    geom: THREE.BufferGeometry;
    mat: THREE.MeshPhysicalMaterial;
  } | null>(null);

  const animRef = useRef<{ startX: number; startY: number; startTime: number; rafId: number } | null>(null);
  const currentRotRef = useRef({ x: rotX, y: rotY });
  const prevTargetRef = useRef({ x: rotX, y: rotY });

  // 공유 렌더러로 씬 렌더 → 2D 캔버스에 복사
  const blit = useCallback(() => {
    const three = threeRef.current;
    const canvas = canvasRef.current;
    if (!three || !canvas) return;
    const renderer = getSharedRenderer();
    renderer.render(three.scene, three.camera);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(renderer.domElement, 0, 0, canvas.width, canvas.height);
    }
  }, []);

  // 씬 초기화 (diceMode 변경 시 재생성)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (animRef.current) {
      cancelAnimationFrame(animRef.current.rafId);
      animRef.current = null;
    }
    if (threeRef.current) {
      const { geom, mat } = threeRef.current;
      geom.dispose();
      if (mat.map) mat.map.dispose();
      mat.dispose();
      threeRef.current = null;
    }

    const renderer = getSharedRenderer();
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-CAM_HALF, CAM_HALF, CAM_HALF, -CAM_HALF, 0.1, 100);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const kl = new THREE.DirectionalLight(0xffffff, 1.5);
    kl.position.set(4, 7, 5);
    scene.add(kl);
    const fl = new THREE.DirectionalLight(0xffffff, 0.7);
    fl.position.set(-5, 3, -2);
    scene.add(fl);
    const rl = new THREE.DirectionalLight(0xffffff, 0.7);
    rl.position.set(-3, 5, -6);
    scene.add(rl);

    let geom: THREE.BufferGeometry;
    let mat: THREE.MeshPhysicalMaterial;

    if (diceMode === 'd8') {
      geom = createOctahedronGeometry(D8_R, D8_CORNER_R, D8_DETAIL, D8_NUMERAL_EXTENT);
      const tex = createAtlasTexture(renderer);
      mat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff, map: tex,
        roughness: 0.42, metalness: 0, clearcoat: 0.45,
        clearcoatRoughness: 0.32, reflectivity: 0.45,
      });
    } else if (diceMode === 'd12') {
      geom = createDodecahedronGeometry();
      const tex = createAtlasTexture12(renderer);
      mat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff, map: tex,
        roughness: 0.42, metalness: 0, clearcoat: 0.45,
        clearcoatRoughness: 0.32, reflectivity: 0.45,
      });
    } else {
      geom = createCubeGeometry(D6_SIZE, D6_CORNER_R, D6_PIP_R, D6_PIP_DEPTH, D6_SEGMENTS);
      mat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff, vertexColors: true,
        roughness: 0.42, metalness: 0, clearcoat: 0.45,
        clearcoatRoughness: 0.32, reflectivity: 0.45,
      });
    }

    const mesh = new THREE.Mesh(geom, mat);
    if (diceMode === 'd8') mesh.scale.set(D8_SCALE, D8_SCALE, D8_SCALE);
    if (diceMode === 'd12') mesh.scale.set(D12_SCALE, D12_SCALE, D12_SCALE);
    scene.add(mesh);

    mesh.rotation.x = rotX;
    mesh.rotation.y = rotY;
    currentRotRef.current = { x: rotX, y: rotY };
    prevTargetRef.current = { x: rotX, y: rotY };

    threeRef.current = { scene, camera, mesh, geom, mat };
    blit();

    return () => {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current.rafId);
        animRef.current = null;
      }
      geom.dispose();
      if (mat.map) mat.map.dispose();
      mat.dispose();
      threeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diceMode]);

  // 회전 목표 변경 → 애니메이션 or 즉시 적용
  useEffect(() => {
    const three = threeRef.current;
    if (!three) return;

    const prev = prevTargetRef.current;
    if (prev.x === rotX && prev.y === rotY) return;
    prevTargetRef.current = { x: rotX, y: rotY };

    if (animRef.current) cancelAnimationFrame(animRef.current.rafId);

    if (instant) {
      // rotation 정규화 시 — 애니메이션 없이 즉시 적용
      three.mesh.rotation.x = rotX;
      three.mesh.rotation.y = rotY;
      currentRotRef.current = { x: rotX, y: rotY };
      blit();
      return;
    }

    const startX = currentRotRef.current.x;
    const startY = currentRotRef.current.y;
    const startTime = performance.now();
    const anim = { startX, startY, startTime, rafId: 0 };

    const loop = () => {
      const t = Math.min(1, (performance.now() - startTime) / ROLL_DURATION);
      const e = easeOutCubic(t);
      const cx = startX + (rotX - startX) * e;
      const cy = startY + (rotY - startY) * e;
      currentRotRef.current = { x: cx, y: cy };
      three.mesh.rotation.x = cx;
      three.mesh.rotation.y = cy;
      blit();
      if (t < 1) {
        anim.rafId = requestAnimationFrame(loop);
      } else {
        animRef.current = null;
      }
    };
    anim.rafId = requestAnimationFrame(loop);
    animRef.current = anim;

    return () => {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current.rafId);
        animRef.current = null;
      }
    };
  }, [rotX, rotY, instant, blit]);

  return (
    <div className={styles.scene}>
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE * SHARED_DPR}
        height={CANVAS_SIZE * SHARED_DPR}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
}

// ============================================================
// DieData
// ============================================================
interface DieData {
  id: number;
  value: number;
  rotX: number;
  rotY: number;
}

// ============================================================
// DicePage
// ============================================================
export default function DicePage() {
  useEffect(() => { document.title = '주사위'; }, []);

  const [diceMode, setDiceMode] = useState<DiceMode>('d6');
  const [nextId, setNextId] = useState(1);
  const [dice, setDice] = useState<DieData[]>(() => {
    const r = getFaceRot(1, 'd6');
    return [{ id: 0, value: 1, rotX: r.x, rotY: r.y }];
  });
  const [rolling, setRolling] = useState(false);
  const [hasRolled, setHasRolled] = useState(false);
  const [instant, setInstant] = useState(false);

  const handleModeChange = (mode: DiceMode) => {
    if (rolling) return;
    const r = getFaceRot(1, mode);
    setDiceMode(mode);
    setHasRolled(false);
    setDice(prev => prev.map(d => ({ ...d, value: 1, rotX: r.x, rotY: r.y })));
  };

  const addDie = () => {
    if (dice.length >= MAX_DICE || rolling) return;
    const r = getFaceRot(1, diceMode);
    setDice(prev => [...prev, { id: nextId, value: 1, rotX: r.x, rotY: r.y }]);
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
    const faces = maxFaces(diceMode);
    setDice(prev => prev.map(die => {
      const value = Math.floor(Math.random() * faces) + 1;
      const faceRot = getFaceRot(value, diceMode);
      const spinsX = 3 + Math.floor(Math.random() * 3);
      const spinsY = 3 + Math.floor(Math.random() * 3);
      const baseX = Math.ceil(die.rotX / TWO_PI) * TWO_PI;
      const baseY = Math.ceil(die.rotY / TWO_PI) * TWO_PI;
      return {
        ...die,
        value,
        rotX: baseX + spinsX * TWO_PI + faceRot.x,
        rotY: baseY + spinsY * TWO_PI + faceRot.y,
      };
    }));
    setTimeout(() => {
      setRolling(false);
      // 회전값 누적 방지: 면 각도로 즉시 리셋 (애니메이션 없음)
      setInstant(true);
      setDice(prev => prev.map(die => {
        const faceRot = getFaceRot(die.value, diceMode);
        return { ...die, rotX: faceRot.x, rotY: faceRot.y };
      }));
      requestAnimationFrame(() => requestAnimationFrame(() => setInstant(false)));
    }, ROLL_DURATION + 100);
  }, [rolling, diceMode]);

  const total = dice.reduce((s, d) => s + d.value, 0);
  const modeLabel: Record<DiceMode, string> = { d6: 'D6', d8: 'D8', d12: 'D12' };

  return (
    <div className={styles.page}>
      <NormalHeader currentGame="dice" gameName="주사위" accentColor="#3b82f6" />

      <div className={styles.content}>
        {/* 모드 선택 */}
        <div className={styles.modeSelector}>
          {(['d6', 'd8', 'd12'] as DiceMode[]).map(m => (
            <button
              key={m}
              className={`${styles.modeBtn} ${diceMode === m ? styles.modeBtnActive : ''}`}
              onClick={() => handleModeChange(m)}
              disabled={rolling}
            >
              {modeLabel[m]}
            </button>
          ))}
        </div>

        {/* 개수 조절 */}
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

        {/* 주사위 그리드 */}
        <div className={styles.diceGrid}>
          {dice.map(die => (
            <Die3D
              key={die.id}
              rotX={die.rotX}
              rotY={die.rotY}
              diceMode={diceMode}
              instant={instant}
            />
          ))}
        </div>

        {/* 굴리기 버튼 */}
        <button
          className={`${styles.rollBtn} ${rolling ? styles.rolling : ''}`}
          onClick={rollAll}
          disabled={rolling}
        >
          {rolling ? '굴리는 중…' : '🎲 굴리기!'}
        </button>

        {/* 결과 패널 */}
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
