import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { gsap } from 'gsap';
import styles from './yacht.module.css';

interface YachtDice3DProps {
  value: number;          // 서버가 보낸 주사위 값 (1~6, 0 = 미굴림)
  isKept: boolean;
  isMyTurn: boolean;
  isRolling: boolean;     // 굴림 애니메이션 재생 중
  onToggleKeep: () => void;
}

// 각 주사위 눈 위치 (128x128 캔버스 기준)
const DOT_POSITIONS: [number, number][][] = [
  [[64, 64]],                                                              // 1
  [[32, 32], [96, 96]],                                                    // 2
  [[32, 32], [64, 64], [96, 96]],                                          // 3
  [[32, 32], [96, 32], [32, 96], [96, 96]],                                // 4
  [[32, 32], [96, 32], [64, 64], [32, 96], [96, 96]],                      // 5
  [[32, 32], [96, 32], [32, 64], [96, 64], [32, 96], [96, 96]],            // 6
];

// 캔버스 텍스처로 주사위 면 그리기
function createDiceFaceTexture(value: number, isKept: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  // 배경
  ctx.fillStyle = isKept ? '#fef08a' : '#ffffff';
  ctx.beginPath();
  ctx.roundRect(4, 4, 120, 120, 14);
  ctx.fill();

  // 테두리
  ctx.strokeStyle = isKept ? '#ca8a04' : '#d1d5db';
  ctx.lineWidth = 4;
  ctx.stroke();

  if (value >= 1 && value <= 6) {
    ctx.fillStyle = isKept ? '#1a1a1a' : '#1a1a1a';
    const dots = DOT_POSITIONS[value - 1];
    for (const [x, y] of dots) {
      ctx.beginPath();
      ctx.arc(x, y, 11, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return new THREE.CanvasTexture(canvas);
}

// 미굴림 주사위 텍스처 (물음표)
function createBlankTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#374151';
  ctx.beginPath();
  ctx.roundRect(4, 4, 120, 120, 14);
  ctx.fill();

  ctx.strokeStyle = '#4b5563';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = '#6b7280';
  ctx.font = 'bold 52px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', 64, 64);

  return new THREE.CanvasTexture(canvas);
}

// 값에 따른 최종 회전각 (BoxGeometry 기본 면 배치 기준)
// Three.js BoxGeometry 면 순서: +X, -X, +Y, -Y, +Z, -Z
// 각 값이 위(+Y)를 향하도록 rotation 설정
const FACE_ROTATIONS: Record<number, [number, number, number]> = {
  1: [0, 0, 0],
  2: [-Math.PI / 2, 0, 0],
  3: [0, Math.PI / 2, 0],
  4: [0, -Math.PI / 2, 0],
  5: [Math.PI / 2, 0, 0],
  6: [Math.PI, 0, 0],
};

export default function YachtDice3D({
  value,
  isKept,
  isMyTurn,
  isRolling,
  onToggleKeep,
}: YachtDice3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    mesh: THREE.Mesh;
    animFrame: number;
    tl: gsap.core.Timeline | null;
  } | null>(null);

  const prevValueRef = useRef<number>(value);
  const prevKeptRef = useRef<boolean>(isKept);

  // 텍스처 배열 생성 (6면)
  const buildTextures = useCallback((val: number, kept: boolean) => {
    if (val < 1 || val > 6) {
      const blank = createBlankTexture();
      return [blank, blank, blank, blank, blank, blank];
    }
    // 모든 면에 동일한 숫자 표시하지 않고, 해당 값 면에 맞는 텍스처 생성
    // BoxGeometry: +X=face0, -X=face1, +Y=face2, -Y=face3, +Z=face4, -Z=face5
    // 각 인덱스에 맞는 값 매핑 (FACE_ROTATIONS 기준 +Y면이 위)
    const faceValues = [4, 3, val, 7 - val, 2, 5] as const;
    // 실제로는 각 면에 1~6 서로 다른 값을 배치해야 하나,
    // 단순화: 모든 면에 동일한 숫자를 표시하되 회전으로 위를 결정
    // (더 정확한 구현: 반대면 합=7 규칙)
    void faceValues;
    // BoxGeometry 6면: right(+X), left(-X), top(+Y), bottom(-Y), front(+Z), back(-Z)
    // 표준 주사위: top-bottom=7, front-back=7, left-right=7
    // top=val → bottom=7-val, right=? ... 회전으로 val면이 top이 되므로 임의 배치
    const textures = [
      createDiceFaceTexture(4, kept),   // +X (right)
      createDiceFaceTexture(3, kept),   // -X (left)
      createDiceFaceTexture(val, kept), // +Y (top) — 이 면이 최종적으로 위를 향함
      createDiceFaceTexture(7 - val, kept), // -Y (bottom)
      createDiceFaceTexture(2, kept),   // +Z (front)
      createDiceFaceTexture(5, kept),   // -Z (back)
    ];
    return textures;
  }, []);

  // 메쉬 텍스처 업데이트
  const updateTextures = useCallback((val: number, kept: boolean) => {
    if (!sceneRef.current) return;
    const { mesh } = sceneRef.current;
    const textures = buildTextures(val, kept);
    const materials = textures.map(
      (tex) => new THREE.MeshStandardMaterial({ map: tex })
    );
    const oldMats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of oldMats) {
      if (m instanceof THREE.MeshStandardMaterial && m.map) m.map.dispose();
      m.dispose();
    }
    mesh.material = materials;
  }, [buildTextures]);

  // Three.js 씬 초기화
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const w = el.clientWidth || 80;
    const h = el.clientHeight || 80;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.shadowMap.enabled = false;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
    camera.position.set(0, 0, 3);

    // 조명
    const ambient = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(5, 8, 5);
    scene.add(dirLight);

    // 주사위 메쉬
    const geometry = new THREE.BoxGeometry(1.4, 1.4, 1.4);
    const textures = buildTextures(value, isKept);
    const materials = textures.map(
      (tex) => new THREE.MeshStandardMaterial({ map: tex })
    );
    const mesh = new THREE.Mesh(geometry, materials);

    // 초기 회전 설정
    if (value >= 1 && value <= 6) {
      const [rx, ry, rz] = FACE_ROTATIONS[value];
      mesh.rotation.set(rx, ry, rz);
    }
    scene.add(mesh);

    let animFrame = 0;
    function animate() {
      animFrame = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    }
    animate();

    sceneRef.current = { renderer, scene, camera, mesh, animFrame, tl: null };
    prevValueRef.current = value;
    prevKeptRef.current = isKept;

    return () => {
      cancelAnimationFrame(animFrame);
      if (sceneRef.current?.tl) sceneRef.current.tl.kill();
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        if (m instanceof THREE.MeshStandardMaterial && m.map) m.map.dispose();
        m.dispose();
      }
      geometry.dispose();
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 값/kept 변경 시 텍스처 + 애니메이션 업데이트
  useEffect(() => {
    const sc = sceneRef.current;
    if (!sc) return;

    const valueChanged = prevValueRef.current !== value;
    const keptChanged = prevKeptRef.current !== isKept;

    prevValueRef.current = value;
    prevKeptRef.current = isKept;

    // kept만 바뀐 경우 텍스처만 갱신
    if (keptChanged && !valueChanged) {
      updateTextures(value, isKept);
      return;
    }

    if (!valueChanged) return;

    // 값이 바뀐 경우 (ROLL_RESULT) — 굴림 애니메이션
    if (sc.tl) sc.tl.kill();

    const mesh = sc.mesh;
    const targetRot = value >= 1 && value <= 6 ? FACE_ROTATIONS[value] : [0, 0, 0];

    // 굴리는 중에 isKept 아닌 주사위만 애니메이션
    if (isRolling && !isKept) {
      // 빠른 회전 후 최종 각도로 안착
      const tlDuration = 0.7;
      const tl = gsap.timeline({
        onComplete: () => {
          // 애니메이션 완료 후 텍스처 반영
          updateTextures(value, isKept);
          mesh.rotation.set(targetRot[0], targetRot[1], targetRot[2]);
        },
      });

      // 랜덤한 방향으로 여러 바퀴 회전 (결과값은 서버가 결정 — Math.random은 애니메이션 방향에만 사용)
      const spinX = mesh.rotation.x + (Math.random() > 0.5 ? 1 : -1) * Math.PI * 4;
      const spinY = mesh.rotation.y + (Math.random() > 0.5 ? 1 : -1) * Math.PI * 4;

      tl.to(mesh.rotation, {
        x: spinX + targetRot[0],
        y: spinY + targetRot[1],
        z: targetRot[2],
        duration: tlDuration,
        ease: 'power4.out',
      });

      tl.to(mesh.position, { y: 0.3, duration: tlDuration * 0.3, ease: 'power2.out' }, 0);
      tl.to(mesh.position, { y: 0, duration: tlDuration * 0.7, ease: 'bounce.out' }, tlDuration * 0.3);

      if (sceneRef.current) sceneRef.current.tl = tl;
    } else {
      // 애니메이션 없이 바로 값 반영
      updateTextures(value, isKept);
      mesh.rotation.set(targetRot[0], targetRot[1], targetRot[2]);
    }
  }, [value, isKept, isRolling, updateTextures]);

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
      aria-label={canInteract ? `주사위 ${value} ${isKept ? '(고정됨, 클릭하여 해제)' : '(클릭하여 고정)'}` : `주사위 ${value}`}
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
      <div ref={mountRef} className={styles.diceCanvas} />
      {isKept && <span className={styles.diceKeptLabel}>KEEP</span>}
    </div>
  );
}
