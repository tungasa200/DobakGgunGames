import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import styles from './yacht.module.css';
import type { DiceType } from '../types/yacht.types';
import {
  createOctahedronGeometry,
  createAtlasTexture,
} from './dice/createOctahedronGeometry';

interface YachtDiceRow3DProps {
  dice: number[];
  keptIndices: number[];
  isMyTurn: boolean;
  isRolling: boolean;
  onToggleKeep: (i: number) => void;
  diceType?: DiceType;
}

const NUM_DICE = 5;

// die-size 계산 상수 (CSS와 동기화 필수)
const DIE_GAP = 10;
const DIE_BORDER = 2; // dark-box 좌우 border 합
const MAX_DIE_SIZE = 80;
const MIN_DIE_SIZE = 32;

// ====================================================================
// D6 큐브 — 면→카메라(+Z) 회전 매핑
// 면→축 매핑: +Z=1, -Z=6, -Y=2, +Y=5, -X=3, +X=4
// ====================================================================
const FACE_ROT_D6: Record<number, { x: number; y: number; z: number }> = {
  1: { x: 0,             y: 0,            z: 0 },
  2: { x: -Math.PI / 2,  y: 0,            z: 0 },
  3: { x: 0,             y:  Math.PI / 2, z: 0 },
  4: { x: 0,             y: -Math.PI / 2, z: 0 },
  5: { x:  Math.PI / 2,  y: 0,            z: 0 },
  6: { x: 0,             y:  Math.PI,     z: 0 },
};

// ====================================================================
// D8 옥타헤드론 — 면→카메라(+Z) 회전 매핑
//
// getFaceNumber 옥탄트 → 면 번호:
//   face1: (+,+,+)  face2: (+,+,-)  face3: (+,-,+)  face4: (+,-,-)
//   face5: (-,+,+)  face6: (-,+,-)  face7: (-,-,+)  face8: (-,-,-)
//
// 면 N의 법선 = (sx,sy,sz)/√3.
// Three.js Euler 'XYZ' 적용 시 행렬은 M = R_x(rx) * R_y(ry) * R_z(rz).
// rz=0 일 때 M·(sx,sy,sz) = (0,0,√3) (즉 face 법선이 +Z) 인 (rx, ry) 도출:
//   rx = sy · PITCH
//   ry = -sx · (π/4 if sz=+1 else 3π/4)
//   PITCH = arctan(1/√2) = arcsin(1/√3) ≈ 0.6155 rad (35.26°)
//
// 또한 v-axis(글자 윗쪽 = (-sx·sy, 2, -sy·sz)/√6)도 위 매핑에서 +Y로
// 보내져 글자가 정자세로 보임. (계산 검증 완료)
// ====================================================================
const PITCH = Math.asin(1 / Math.sqrt(3)); // ≈ 0.6155 rad
const FACE_ROT_D8: Record<number, { x: number; y: number; z: number }> = {
  1: { x:  PITCH,  y: -Math.PI / 4,     z: 0 }, // (+,+,+)
  2: { x:  PITCH,  y: -Math.PI * 3 / 4, z: 0 }, // (+,+,-)
  3: { x: -PITCH,  y: -Math.PI / 4,     z: 0 }, // (+,-,+)
  4: { x: -PITCH,  y: -Math.PI * 3 / 4, z: 0 }, // (+,-,-)
  5: { x:  PITCH,  y:  Math.PI / 4,     z: 0 }, // (-,+,+)
  6: { x:  PITCH,  y:  Math.PI * 3 / 4, z: 0 }, // (-,+,-)
  7: { x: -PITCH,  y:  Math.PI / 4,     z: 0 }, // (-,-,+)
  8: { x: -PITCH,  y:  Math.PI * 3 / 4, z: 0 }, // (-,-,-)
};

// 주사위 메시 스펙
const SIZE = 1.2;
const CORNER_R = 0.18;
const PIP_R = 0.078;
const PIP_DEPTH = 0.038;
const SEGMENTS = 96;

// D8 스펙 (octahedron.html 샘플 기준)
const OCT_R = 1.0;
const OCT_CORNER_R = 0.12;
const OCT_DETAIL = 5;
const OCT_NUMERAL_EXTENT = 1.15;
// D8 scale: D6 큐브 (SIZE=1.2) 와 동일한 시각 크기
const OCT_SCALE = 0.88;

const BASE_TILT_X = 0;
const BASE_TILT_Y = 0;
const BASE_TILT_Z = 0;

const ROLL_DURATION_MS = 800;
const TWO_PI = Math.PI * 2;

// 굴림 중 회전된 cube의 화면 bounding box가 셀에 잘리지 않도록 화면상 크기를 줄이는 비율
const FIT_MARGIN = 1.5;

function smoothstep(a: number, b: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

// ====================================================================
// D6 큐브 지오메트리 생성 (기존 코드 그대로 유지)
// ====================================================================
export function createCubeGeometry(
  size: number,
  cornerRadius: number,
  pipRadius: number,
  pipDepth: number,
  segments: number,
): THREE.BufferGeometry {
  const geom = new THREE.BoxGeometry(size, size, size, segments, segments, segments);
  const half = size / 2;
  const inner = half - cornerRadius;
  const A = half * 0.55;
  const B = half * 0.6;
  const eps = 1e-4;

  const pipLayouts: Record<number, [number, number][]> = {
    1: [[0, 0]],
    2: [[-A,  A], [ A, -A]],
    3: [[-A,  A], [ 0,  0], [ A, -A]],
    4: [[-A,  A], [ A,  A], [-A, -A], [ A, -A]],
    5: [[-A,  A], [ A,  A], [ 0,  0], [-A, -A], [ A, -A]],
    6: [[-A,  B], [ A,  B], [-A,  0], [ A,  0], [-A, -B], [ A, -B]],
  };

  const positions = geom.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(positions.count * 3);
  const baseColor: [number, number, number] = [1.0, 1.0, 1.0];
  const pipColor:  [number, number, number] = [0.05, 0.05, 0.05];

  type FaceInfo = { num: number; u: number; v: number; push: [number, number, number] };

  for (let i = 0; i < positions.count; i++) {
    let x = positions.getX(i);
    let y = positions.getY(i);
    let z = positions.getZ(i);

    const ix = Math.max(-inner, Math.min(inner, x));
    const iy = Math.max(-inner, Math.min(inner, y));
    const iz = Math.max(-inner, Math.min(inner, z));
    const dx = x - ix, dy = y - iy, dz = z - iz;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len > 0) {
      x = ix + (dx / len) * cornerRadius;
      y = iy + (dy / len) * cornerRadius;
      z = iz + (dz / len) * cornerRadius;
    }

    let face: FaceInfo | null = null;
    if (Math.abs(x - half) < eps && Math.abs(y) < inner + eps && Math.abs(z) < inner + eps) {
      face = { num: 4, u: -z, v: y, push: [-1, 0, 0] };
    } else if (Math.abs(x + half) < eps && Math.abs(y) < inner + eps && Math.abs(z) < inner + eps) {
      face = { num: 3, u: z, v: y, push: [1, 0, 0] };
    } else if (Math.abs(y - half) < eps && Math.abs(x) < inner + eps && Math.abs(z) < inner + eps) {
      face = { num: 5, u: x, v: -z, push: [0, -1, 0] };
    } else if (Math.abs(y + half) < eps && Math.abs(x) < inner + eps && Math.abs(z) < inner + eps) {
      face = { num: 2, u: x, v: z, push: [0, 1, 0] };
    } else if (Math.abs(z - half) < eps && Math.abs(x) < inner + eps && Math.abs(y) < inner + eps) {
      face = { num: 1, u: x, v: y, push: [0, 0, -1] };
    } else if (Math.abs(z + half) < eps && Math.abs(x) < inner + eps && Math.abs(y) < inner + eps) {
      face = { num: 6, u: -x, v: y, push: [0, 0, 1] };
    }

    let depthAmount = 0;
    let colorBlend = 0;

    if (face) {
      for (const [pu, pv] of pipLayouts[face.num]) {
        const ddu = face.u - pu;
        const ddv = face.v - pv;
        const d = Math.sqrt(ddu * ddu + ddv * ddv);

        if (d < pipRadius) {
          const t = d / pipRadius;
          const depth = pipDepth * Math.sqrt(Math.max(0, 1 - t * t));
          if (depth > depthAmount) depthAmount = depth;
        }

        const blend = 1.0 - smoothstep(pipRadius * 0.78, pipRadius * 1.0, d);
        if (blend > colorBlend) colorBlend = blend;
      }

      if (depthAmount > 0) {
        x += face.push[0] * depthAmount;
        y += face.push[1] * depthAmount;
        z += face.push[2] * depthAmount;
      }
    }

    positions.setXYZ(i, x, y, z);

    colors[i * 3]     = baseColor[0] * (1 - colorBlend) + pipColor[0] * colorBlend;
    colors[i * 3 + 1] = baseColor[1] * (1 - colorBlend) + pipColor[1] * colorBlend;
    colors[i * 3 + 2] = baseColor[2] * (1 - colorBlend) + pipColor[2] * colorBlend;
  }

  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  positions.needsUpdate = true;

  return mergeCoincidentVertices(geom, 5e-5);
}

function mergeCoincidentVertices(
  geom: THREE.BufferGeometry,
  tolerance = 1e-4,
): THREE.BufferGeometry {
  const positions = geom.attributes.position as THREE.BufferAttribute;
  const colors = geom.attributes.color as THREE.BufferAttribute | undefined;
  const oldIndex = geom.index;
  if (!oldIndex) return geom;
  const f = 1 / tolerance;

  const map = new Map<string, number>();
  const remap = new Int32Array(positions.count);
  const newPos: number[] = [];
  const newCol: number[] | null = colors ? [] : null;

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    const key = `${Math.round(x * f)}_${Math.round(y * f)}_${Math.round(z * f)}`;
    const cached = map.get(key);
    if (cached !== undefined) {
      remap[i] = cached;
    } else {
      const idx = newPos.length / 3;
      map.set(key, idx);
      remap[i] = idx;
      newPos.push(x, y, z);
      if (newCol && colors) newCol.push(colors.getX(i), colors.getY(i), colors.getZ(i));
    }
  }

  const newIdx = new Uint32Array(oldIndex.count);
  for (let i = 0; i < oldIndex.count; i++) {
    newIdx[i] = remap[oldIndex.getX(i)];
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(newPos, 3));
  if (newCol) merged.setAttribute('color', new THREE.Float32BufferAttribute(newCol, 3));
  merged.setIndex(new THREE.BufferAttribute(newIdx, 1));
  merged.computeVertexNormals();

  geom.dispose();
  return merged;
}

function safeDie(v: number, diceType: DiceType = 'D6'): number {
  const max = diceType === 'D8' ? 8 : 6;
  return v >= 1 && v <= max ? v : 1;
}

function getFaceRot(v: number, diceType: DiceType): { x: number; y: number; z: number } {
  if (diceType === 'D8') {
    return FACE_ROT_D8[v] ?? FACE_ROT_D8[1];
  }
  return { ...(FACE_ROT_D6[v] ?? FACE_ROT_D6[1]), z: 0 };
}

interface RotState {
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  startTime: number;
  currentX: number;
  currentY: number;
  animating: boolean;
}

export default function YachtDiceRow3D({
  dice,
  keptIndices,
  isMyTurn,
  isRolling,
  onToggleKeep,
  diceType = 'D6',
}: YachtDiceRow3DProps) {
  const darkBoxRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [dieSize, setDieSize] = useState<number>(MAX_DIE_SIZE);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const meshesRef = useRef<THREE.Mesh[]>([]);
  const wrappersRef = useRef<THREE.Group[]>([]);
  const matNormalRef = useRef<THREE.MeshPhysicalMaterial | null>(null);
  const matKeptRef = useRef<THREE.MeshPhysicalMaterial | null>(null);

  const rotStatesRef = useRef<RotState[]>([]);
  const lastDiceRef = useRef<number[]>([]);
  const animationIdRef = useRef<number>(0);
  const rendererReadyRef = useRef<boolean>(false);
  // 현재 마운트된 diceType (effect 클로저에서 최신값 참조)
  const diceTypeRef = useRef<DiceType>(diceType);

  // diceType 변경 시 ref 동기화
  useEffect(() => {
    diceTypeRef.current = diceType;
  }, [diceType]);

  // === Three.js 1회 초기화 ===
  useEffect(() => {
    const canvas = canvasRef.current;
    const inner = innerRef.current;
    if (!canvas || !inner) return;

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
    keyLight.position.set(4, 7, 5);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.7);
    fillLight.position.set(-5, 3, -2);
    scene.add(fillLight);
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.7);
    rimLight.position.set(-3, 5, -6);
    scene.add(rimLight);

    const currentDiceType = diceTypeRef.current;

    // diceType에 따라 지오메트리 / 머티리얼 분기
    let geom: THREE.BufferGeometry;
    let matNormal: THREE.MeshPhysicalMaterial;
    let matKept: THREE.MeshPhysicalMaterial;

    if (currentDiceType === 'D8') {
      geom = createOctahedronGeometry(OCT_R, OCT_CORNER_R, OCT_DETAIL, OCT_NUMERAL_EXTENT);
      const atlasTexture = createAtlasTexture(renderer);
      matNormal = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        map: atlasTexture,
        roughness: 0.42,
        metalness: 0.0,
        clearcoat: 0.45,
        clearcoatRoughness: 0.32,
        reflectivity: 0.45,
      });
      matKept = new THREE.MeshPhysicalMaterial({
        color: 0xfde68a,
        map: atlasTexture,
        roughness: 0.42,
        metalness: 0.0,
        clearcoat: 0.45,
        clearcoatRoughness: 0.32,
        reflectivity: 0.45,
      });
    } else {
      geom = createCubeGeometry(SIZE, CORNER_R, PIP_R, PIP_DEPTH, SEGMENTS);
      matNormal = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        vertexColors: true,
        roughness: 0.42,
        metalness: 0,
        clearcoat: 0.45,
        clearcoatRoughness: 0.32,
        reflectivity: 0.45,
      });
      matKept = new THREE.MeshPhysicalMaterial({
        color: 0xfde68a,
        vertexColors: true,
        roughness: 0.42,
        metalness: 0,
        clearcoat: 0.45,
        clearcoatRoughness: 0.32,
        reflectivity: 0.45,
      });
    }

    const initFace = getFaceRot(1, currentDiceType);
    const initX = initFace.x;
    const initY = initFace.y;

    const meshes: THREE.Mesh[] = [];
    const wrappers: THREE.Group[] = [];
    for (let i = 0; i < NUM_DICE; i++) {
      const wrapper = new THREE.Group();
      wrapper.rotation.set(BASE_TILT_X, BASE_TILT_Y, BASE_TILT_Z);
      scene.add(wrapper);

      const mesh = new THREE.Mesh(geom, matNormal);
      mesh.rotation.set(initX, initY, 0);
      if (currentDiceType === 'D8') {
        mesh.scale.set(OCT_SCALE, OCT_SCALE, OCT_SCALE);
      }
      wrapper.add(mesh);

      meshes.push(mesh);
      wrappers.push(wrapper);
    }

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    meshesRef.current = meshes;
    wrappersRef.current = wrappers;
    matNormalRef.current = matNormal;
    matKeptRef.current = matKept;

    rotStatesRef.current = Array.from({ length: NUM_DICE }, () => ({
      startX: initX,
      startY: initY,
      targetX: initX,
      targetY: initY,
      startTime: 0,
      currentX: initX,
      currentY: initY,
      animating: false,
    }));

    const updateLayout = () => {
      const rect = inner.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      if (w <= 0 || h <= 0) return;

      renderer.setSize(w, h, false);

      const hits = inner.querySelectorAll<HTMLButtonElement>('button');
      if (hits.length !== NUM_DICE) {
        renderer.render(scene, camera);
        return;
      }

      const firstHitRect = hits[0].getBoundingClientRect();
      const dieSize = Math.min(firstHitRect.width, firstHitRect.height);
      if (dieSize <= 0) return;

      const pxPerUnit = dieSize / (SIZE * FIT_MARGIN);

      const wUnits = w / pxPerUnit;
      const hUnits = h / pxPerUnit;
      camera.left = -wUnits / 2;
      camera.right = wUnits / 2;
      camera.top = hUnits / 2;
      camera.bottom = -hUnits / 2;
      camera.updateProjectionMatrix();

      for (let i = 0; i < NUM_DICE; i++) {
        const r = hits[i].getBoundingClientRect();
        const centerPx = (r.left + r.right) / 2 - rect.left;
        const xUnit = (centerPx - w / 2) / pxPerUnit;
        wrappers[i].position.set(xUnit, 0, 0);
      }

      renderer.render(scene, camera);
    };
    updateLayout();
    rendererReadyRef.current = true;

    const ro = new ResizeObserver(updateLayout);
    ro.observe(inner);

    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);
      const now = performance.now();
      const states = rotStatesRef.current;
      let dirty = false;
      for (let i = 0; i < meshes.length; i++) {
        const s = states[i];
        if (!s.animating) continue;
        const t = Math.min(1, (now - s.startTime) / ROLL_DURATION_MS);
        const e = easeOutCubic(t);
        const x = s.startX + (s.targetX - s.startX) * e;
        const y = s.startY + (s.targetY - s.startY) * e;
        s.currentX = x;
        s.currentY = y;
        meshes[i].rotation.x = x;
        meshes[i].rotation.y = y;
        if (t >= 1) s.animating = false;
        dirty = true;
      }
      if (dirty) renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationIdRef.current);
      ro.disconnect();
      wrappers.forEach((w) => {
        w.clear();
        scene.remove(w);
      });
      geom.dispose();
      matNormal.dispose();
      matKept.dispose();
      renderer.dispose();
      rendererReadyRef.current = false;
      meshesRef.current = [];
      wrappersRef.current = [];
      rotStatesRef.current = [];
    };
    // diceType 변경 시 Three.js 씬 전체 재초기화
  }, [diceType]);

  // === dice / keptIndices / isRolling 변경 반영 ===
  useEffect(() => {
    const meshes = meshesRef.current;
    const states = rotStatesRef.current;
    if (meshes.length === 0) return;

    const currentDiceType = diceTypeRef.current;

    for (let i = 0; i < NUM_DICE; i++) {
      const v = safeDie(dice[i], currentDiceType);
      const isKept = keptIndices.includes(i);
      const lastVal = lastDiceRef.current[i];
      const valueChanged = lastVal !== v;
      const shouldAnimate = (valueChanged || isRolling) && !isKept;

      // KEPT 색상 swap
      const targetMat = isKept ? matKeptRef.current : matNormalRef.current;
      if (targetMat && meshes[i].material !== targetMat) {
        meshes[i].material = targetMat;
      }

      if (shouldAnimate) {
        const faceRot = getFaceRot(v, currentDiceType);
        const finalX = faceRot.x;
        const finalY = faceRot.y;

        const spinsX = isRolling ? 3 + Math.floor(Math.random() * 3) : 1;
        const spinsY = isRolling ? 3 + Math.floor(Math.random() * 3) : 1;

        const s = states[i];
        const startX = s.currentX;
        const startY = s.currentY;

        const targetX = Math.ceil(startX / TWO_PI) * TWO_PI + spinsX * TWO_PI + finalX;
        const targetY = Math.ceil(startY / TWO_PI) * TWO_PI + spinsY * TWO_PI + finalY;

        s.startX = startX;
        s.startY = startY;
        s.targetX = targetX;
        s.targetY = targetY;
        s.startTime = performance.now();
        s.animating = true;
      } else if (valueChanged && isKept) {
        const faceRot = getFaceRot(v, currentDiceType);
        meshes[i].rotation.x = faceRot.x;
        meshes[i].rotation.y = faceRot.y;
        const s = states[i];
        s.currentX = faceRot.x;
        s.currentY = faceRot.y;
        s.animating = false;
      }

      lastDiceRef.current[i] = v;
    }

    if (rendererReadyRef.current && rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  }, [dice, keptIndices, isRolling]);

  // === dark-box 실측 → die-size 결정 ===
  useEffect(() => {
    const dark = darkBoxRef.current;
    if (!dark) return;

    const compute = () => {
      const cs = window.getComputedStyle(dark);
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const rect = dark.getBoundingClientRect();
      const inner = Math.max(0, rect.width - padX - DIE_BORDER);
      const avail = Math.max(0, inner - DIE_GAP * (NUM_DICE - 1));
      const size = Math.min(MAX_DIE_SIZE, Math.max(MIN_DIE_SIZE, Math.floor(avail / NUM_DICE)));
      setDieSize(size);
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(dark);
    return () => ro.disconnect();
  }, []);

  const canInteract = isMyTurn;
  const innerWidth = dieSize * NUM_DICE + DIE_GAP * (NUM_DICE - 1);

  return (
    <div className={styles.diceRow3D} ref={darkBoxRef}>
      <div
        ref={innerRef}
        className={styles.diceRow3DInner}
        role="list"
        aria-label="주사위"
        style={{ width: `${innerWidth}px`, height: `${dieSize}px` }}
      >
        <canvas ref={canvasRef} className={styles.diceRow3DCanvas} />
        {dice.map((val, i) => {
          const v = safeDie(val, diceType);
          const isKept = keptIndices.includes(i);
          return (
            <button
              key={i}
              type="button"
              role="listitem"
              className={[
                styles.diceRow3DHit,
                isKept ? styles.diceRow3DHitKept : '',
                !canInteract ? styles.diceRow3DHitNotMyTurn : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{ width: `${dieSize}px`, height: `${dieSize}px` }}
              onClick={canInteract ? () => onToggleKeep(i) : undefined}
              disabled={!canInteract}
              aria-label={
                canInteract
                  ? `주사위 ${v} ${isKept ? '(고정됨, 클릭하여 해제)' : '(클릭하여 고정)'}`
                  : `주사위 ${v}`
              }
              aria-pressed={isKept}
            >
              {isKept && <span className={styles.diceKeptLabel}>KEEP</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
