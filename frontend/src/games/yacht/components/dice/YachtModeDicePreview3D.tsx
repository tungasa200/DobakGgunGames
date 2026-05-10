import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { DiceType } from '../../types/yacht.types';
import { createCubeGeometry } from '../YachtDiceRow3D';
import { createOctahedronGeometry, createAtlasTexture } from './createOctahedronGeometry';

interface YachtModeDicePreview3DProps {
  diceType: DiceType;
  size?: number;
}

const SIZE = 1.2;
const CORNER_R = 0.18;
const PIP_R = 0.078;
const PIP_DEPTH = 0.038;
const SEGMENTS = 96;

const OCT_R = 1.0;
const OCT_CORNER_R = 0.12;
const OCT_DETAIL = 5;
const OCT_NUMERAL_EXTENT = 1.15;
const OCT_SCALE = 0.88;

const PITCH = Math.asin(1 / Math.sqrt(3));

const FIT_MARGIN = 1.5;

export default function YachtModeDicePreview3D({
  diceType,
  size = 80,
}: YachtModeDicePreview3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.setSize(size, size, false);

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

    let geom: THREE.BufferGeometry;
    let material: THREE.MeshPhysicalMaterial;

    if (diceType === 'D8') {
      geom = createOctahedronGeometry(OCT_R, OCT_CORNER_R, OCT_DETAIL, OCT_NUMERAL_EXTENT);
      const atlasTexture = createAtlasTexture(renderer);
      material = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        map: atlasTexture,
        roughness: 0.42,
        metalness: 0.0,
        clearcoat: 0.45,
        clearcoatRoughness: 0.32,
        reflectivity: 0.45,
      });
    } else {
      geom = createCubeGeometry(SIZE, CORNER_R, PIP_R, PIP_DEPTH, SEGMENTS);
      material = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        vertexColors: true,
        roughness: 0.42,
        metalness: 0,
        clearcoat: 0.45,
        clearcoatRoughness: 0.32,
        reflectivity: 0.45,
      });
    }

    const mesh = new THREE.Mesh(geom, material);

    if (diceType === 'D8') {
      // D8: 면 1 자세 그대로 (PITCH × -π/4 isometric pose)
      mesh.rotation.set(PITCH, -Math.PI / 4, 0);
      mesh.scale.set(OCT_SCALE, OCT_SCALE, OCT_SCALE);
    } else {
      // D6: 살짝 기울여 3면이 보이는 isometric pose
      mesh.rotation.set(-Math.PI / 7, Math.PI / 6, 0);
    }

    scene.add(mesh);

    // 카메라 프러스텀: dieSize=size 가정, FIT_MARGIN 적용
    const pxPerUnit = size / (SIZE * FIT_MARGIN);
    const wUnits = size / pxPerUnit;
    const hUnits = size / pxPerUnit;
    camera.left = -wUnits / 2;
    camera.right = wUnits / 2;
    camera.top = hUnits / 2;
    camera.bottom = -hUnits / 2;
    camera.updateProjectionMatrix();

    renderer.render(scene, camera);

    return () => {
      scene.remove(mesh);
      geom.dispose();
      material.dispose();
      if (material.map) material.map.dispose();
      renderer.dispose();
    };
  }, [diceType, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ width: `${size}px`, height: `${size}px`, display: 'block' }}
      aria-hidden="true"
    />
  );
}
