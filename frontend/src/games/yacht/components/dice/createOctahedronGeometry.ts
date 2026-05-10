/**
 * D8 정팔면체 주사위 지오메트리 생성
 * octahedron.html 샘플 코드(createOctahedronDie + smoothNormalsAtSeams)를
 * Three.js ESM 모듈로 포팅한 버전.
 *
 * 표준 d8: 마주보는 면 합 = 9
 * 옥탄트 → 면 번호 매핑 (getFaceNumber):
 *   (+,+,+)→1  (−,−,−)→8
 *   (+,+,−)→2  (−,−,+)→7
 *   (+,−,+)→3  (−,+,−)→6
 *   (+,−,−)→4  (−,+,+)→5
 */
import * as THREE from 'three';

/** 옥탄트 부호 → 면 번호 (getFaceNumber 의 TS 포팅) */
export function getFaceNumber(sx: number, sy: number, sz: number): number {
  if (sx > 0 && sy > 0 && sz > 0) return 1;
  if (sx < 0 && sy < 0 && sz < 0) return 8;
  if (sx > 0 && sy > 0 && sz < 0) return 2;
  if (sx < 0 && sy < 0 && sz > 0) return 7;
  if (sx > 0 && sy < 0 && sz > 0) return 3;
  if (sx < 0 && sy > 0 && sz < 0) return 6;
  if (sx > 0 && sy < 0 && sz < 0) return 4;
  if (sx < 0 && sy > 0 && sz > 0) return 5;
  return 1;
}

/** 아틀라스(4×2 그리드)에서 면 번호 → [cellX, cellY] */
const CELL_POS: [number, number][] = [
  [0, 0], // dummy index 0
  [0, 0], // 1
  [1, 0], // 2
  [2, 0], // 3
  [3, 0], // 4
  [0, 1], // 5
  [1, 1], // 6
  [2, 1], // 7
  [3, 1], // 8
];

/**
 * 라운디드 옥타헤드론 정점 위치 계산
 * (R: 외접원 반지름, cR: 모서리 반지름)
 */
function roundedOctahedronPosition(
  px: number, py: number, pz: number,
  R: number, cR: number,
): { x: number; y: number; z: number } {
  const SQRT3 = Math.sqrt(3);
  const K = R - cR * SQRT3;

  const sx = px >= 0 ? 1 : -1;
  const sy = py >= 0 ? 1 : -1;
  const sz = pz >= 0 ? 1 : -1;

  const distFactor = (sx * px + sy * py + sz * pz - K) / 3;
  const projx = px - distFactor * sx;
  const projy = py - distFactor * sy;
  const projz = pz - distFactor * sz;

  const a = sx * projx / K;
  const b = sy * projy / K;
  const c = sz * projz / K;

  const eps = 1e-7;
  if (a >= -eps && b >= -eps && c >= -eps) {
    return {
      x: projx + cR * sx / SQRT3,
      y: projy + cR * sy / SQRT3,
      z: projz + cR * sz / SQRT3,
    };
  }

  const v0x = sx * K, v0y = 0, v0z = 0;
  const v1x = 0, v1y = sy * K, v1z = 0;
  const v2x = 0, v2y = 0, v2z = sz * K;

  function projSeg(
    qx: number, qy: number, qz: number,
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
  ): [number, number, number] {
    const ex = bx - ax, ey = by - ay, ez = bz - az;
    const e2 = ex * ex + ey * ey + ez * ez;
    let t = ((qx - ax) * ex + (qy - ay) * ey + (qz - az) * ez) / e2;
    t = Math.max(0, Math.min(1, t));
    return [ax + t * ex, ay + t * ey, az + t * ez];
  }

  let cx: number, cy: number, cz: number;
  if (a < 0 && b < 0)      { cx = v2x; cy = v2y; cz = v2z; }
  else if (a < 0 && c < 0) { cx = v1x; cy = v1y; cz = v1z; }
  else if (b < 0 && c < 0) { cx = v0x; cy = v0y; cz = v0z; }
  else if (a < 0)           { [cx, cy, cz] = projSeg(px, py, pz, v1x, v1y, v1z, v2x, v2y, v2z); }
  else if (b < 0)           { [cx, cy, cz] = projSeg(px, py, pz, v0x, v0y, v0z, v2x, v2y, v2z); }
  else                      { [cx, cy, cz] = projSeg(px, py, pz, v0x, v0y, v0z, v1x, v1y, v1z); }

  const nx = px - cx, ny = py - cy, nz = pz - cz;
  const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz);

  if (nLen < 1e-9) {
    return { x: cx, y: cy, z: cz };
  }

  return {
    x: cx + cR * nx / nLen,
    y: cy + cR * ny / nLen,
    z: cz + cR * nz / nLen,
  };
}

/**
 * 아틀라스 텍스처 (4×2 그리드, 숫자 1~8) 생성
 * canvas API로 작성 후 THREE.CanvasTexture로 변환
 */
export function createAtlasTexture(renderer: THREE.WebGLRenderer): THREE.CanvasTexture {
  const ATLAS_W = 2048, ATLAS_H = 1024;
  const CELL_W = ATLAS_W / 4, CELL_H = ATLAS_H / 2;

  const atlasCanvas = document.createElement('canvas');
  atlasCanvas.width = ATLAS_W;
  atlasCanvas.height = ATLAS_H;
  const ctx = atlasCanvas.getContext('2d')!;

  ctx.fillStyle = '#faf9f5';
  ctx.fillRect(0, 0, ATLAS_W, ATLAS_H);

  ctx.fillStyle = '#0c0c0c';
  ctx.font = `bold ${Math.round(CELL_H * 0.6)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let n = 1; n <= 8; n++) {
    const [cellX, cellY] = CELL_POS[n];
    const xCenter = cellX * CELL_W + CELL_W / 2;
    const yCenter = cellY * CELL_H + CELL_H / 2;
    ctx.fillText(String(n), xCenter, yCenter);
    // 6 밑줄 (6과 9 혼동 방지)
    if (n === 6) {
      const ulw = CELL_W * 0.20;
      const ulh = CELL_H * 0.022;
      ctx.fillRect(xCenter - ulw / 2, yCenter + CELL_H * 0.22, ulw, ulh);
    }
  }

  const tex = new THREE.CanvasTexture(atlasCanvas);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

/**
 * 인접 면 경계의 법선 벡터를 평균내어 부드럽게 처리
 * (UV는 면별로 다르므로 정점 자체는 병합하지 않음)
 */
export function smoothNormalsAtSeams(geom: THREE.BufferGeometry, tolerance = 5e-4): void {
  geom.computeVertexNormals();
  const positions = geom.attributes.position as THREE.BufferAttribute;
  const normals = geom.attributes.normal as THREE.BufferAttribute;
  const count = positions.count;
  const f = 1 / tolerance;

  const groups = new Map<string, number[]>();
  for (let i = 0; i < count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    const key = `${Math.round(x * f)}_${Math.round(y * f)}_${Math.round(z * f)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(i);
  }

  for (const indices of groups.values()) {
    if (indices.length < 2) continue;
    let nx = 0, ny = 0, nz = 0;
    for (const i of indices) {
      nx += normals.getX(i);
      ny += normals.getY(i);
      nz += normals.getZ(i);
    }
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len > 1e-9) { nx /= len; ny /= len; nz /= len; }
    for (const i of indices) {
      normals.setXYZ(i, nx, ny, nz);
    }
  }
  normals.needsUpdate = true;
}

/**
 * D8 주사위 지오메트리 생성
 * @param R 외접원 반지름 (기본 1.0)
 * @param cornerRadius 모서리 반지름
 * @param detail OctahedronGeometry detail (높을수록 부드러움)
 * @param numeralExtent 숫자가 차지하는 면 크기 비율 (샘플: 1.15)
 */
export function createOctahedronGeometry(
  R = 1.0,
  cornerRadius = 0.12,
  detail = 5,
  numeralExtent = 1.15,
): THREE.BufferGeometry {
  const geom = new THREE.OctahedronGeometry(R, detail);
  const positions = geom.attributes.position as THREE.BufferAttribute;
  const uvs = new Float32Array(positions.count * 2);
  const SQRT2 = Math.sqrt(2), SQRT6 = Math.sqrt(6);

  // 1단계: 라운디드 정점 위치 계산
  const newPos = new Float32Array(positions.count * 3);
  for (let i = 0; i < positions.count; i++) {
    const r = roundedOctahedronPosition(
      positions.getX(i), positions.getY(i), positions.getZ(i),
      R, cornerRadius,
    );
    newPos[i * 3] = r.x;
    newPos[i * 3 + 1] = r.y;
    newPos[i * 3 + 2] = r.z;
  }

  // 2단계: 삼각형별 UV 계산 (비인덱스이므로 3개씩 묶임)
  const numTri = positions.count / 3;
  for (let t = 0; t < numTri; t++) {
    const i0 = t * 3, i1 = t * 3 + 1, i2 = t * 3 + 2;
    // centroid로 옥탄트 판별
    const cx = (positions.getX(i0) + positions.getX(i1) + positions.getX(i2)) / 3;
    const cy = (positions.getY(i0) + positions.getY(i1) + positions.getY(i2)) / 3;
    const cz_val = (positions.getZ(i0) + positions.getZ(i1) + positions.getZ(i2)) / 3;
    const sx = cx >= 0 ? 1 : -1;
    const sy = cy >= 0 ? 1 : -1;
    const sz = cz_val >= 0 ? 1 : -1;

    const num = getFaceNumber(sx, sy, sz);
    const [cellX, cellY] = CELL_POS[num];

    // 면 중심
    const fcx = sx * R / 3, fcy = sy * R / 3, fcz = sz * R / 3;

    // u-axis: 면 평면 안 카메라 right 방향
    const ux = sz / SQRT2, uy = 0, uz = -sx / SQRT2;
    // v-axis: 월드 +y 방향을 면 평면에 투영 (글자 위쪽이 월드 위쪽)
    const vx = -sx * sy / SQRT6, vy = 2 / SQRT6, vz = -sy * sz / SQRT6;

    for (const i of [i0, i1, i2]) {
      const rx = newPos[i * 3] - fcx;
      const ry = newPos[i * 3 + 1] - fcy;
      const rz = newPos[i * 3 + 2] - fcz;
      const u_coord = rx * ux + ry * uy + rz * uz;
      const v_coord = rx * vx + ry * vy + rz * vz;

      let cu = 0.5 + u_coord / numeralExtent;
      let cv = 0.5 - v_coord / numeralExtent;
      cu = Math.max(0, Math.min(1, cu));
      cv = Math.max(0, Math.min(1, cv));

      uvs[i * 2] = (cellX + cu) / 4;
      uvs[i * 2 + 1] = 1 - (cellY + cv) / 2;
    }
  }

  // 새 위치 적용
  for (let i = 0; i < positions.count; i++) {
    positions.setXYZ(i, newPos[i * 3], newPos[i * 3 + 1], newPos[i * 3 + 2]);
  }

  geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  positions.needsUpdate = true;

  smoothNormalsAtSeams(geom);

  return geom;
}
