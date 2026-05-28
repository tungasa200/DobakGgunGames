/**
 * D12 정십이면체 주사위 지오메트리 생성
 * dodecahedron.html 샘플(buildDie + smoothSeams)을 Three.js ESM 모듈로 포팅.
 *
 * 표준 d12: 마주보는 면 합 = 13
 * FACE_ROT_D12[n] = 면 n의 법선을 +Z 방향으로 보내는 Euler XYZ 회전 (rx, ry)
 *   ry = atan2(-nx, nz),  rx = atan2(ny, sqrt(nx² + nz²))
 */
import * as THREE from 'three';

const PHI = (1 + Math.sqrt(5)) / 2;
const IP  = 1 / PHI;
const CR  = Math.sqrt(3); // 원좌표 circumradius (RAW_V 정규화 기준)

type Vec3 = [number, number, number];

const RAW_V: Vec3[] = [
  [-1,-1,-1],[-1,-1,1],[-1,1,-1],[-1,1,1],
  [1,-1,-1],[1,-1,1],[1,1,-1],[1,1,1],
  [0,-IP,-PHI],[0,-IP,PHI],[0,IP,-PHI],[0,IP,PHI],
  [-IP,-PHI,0],[-IP,PHI,0],[IP,-PHI,0],[IP,PHI,0],
  [-PHI,0,-IP],[PHI,0,-IP],[-PHI,0,IP],[PHI,0,IP],
];

const VERTS: Vec3[] = RAW_V.map(v => [v[0]/CR, v[1]/CR, v[2]/CR]);

const FACES: number[][] = [
  [0,8,4,14,12],[16,2,10,8,0],[0,12,1,18,16],[12,14,5,9,1],
  [1,9,11,3,18],[13,15,6,10,2],[16,18,3,13,2],[3,11,7,15,13],
  [4,8,10,6,17],[17,19,5,14,4],[19,7,11,9,5],[6,15,7,19,17],
];

const FACE_NUM = [1,2,3,4,5,9,6,12,8,7,11,10];

// Atlas: 4×3 그리드 (숫자 1~12)
const D12_CELL_POS: Vec3[] = new Array(13).fill(null).map((_,n) => {
  if (!n) return [0,0,0];
  const col = (n - 1) % 4;
  const row = Math.floor((n - 1) / 4);
  return [col, row, 0];
});

// ====================================================================
// 벡터 유틸
// ====================================================================
const vsub = (a: Vec3, b: Vec3): Vec3 => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const vadd = (a: Vec3, b: Vec3): Vec3 => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
const vscl = (a: Vec3, s: number): Vec3 => [a[0]*s, a[1]*s, a[2]*s];
const vdot = (a: Vec3, b: Vec3): number => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const vcrs = (a: Vec3, b: Vec3): Vec3 => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const vlen = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
const vnrm = (a: Vec3): Vec3 => { const l = vlen(a) || 1; return [a[0]/l, a[1]/l, a[2]/l]; };

// ====================================================================
// 면 법선 → Euler 회전 (rx, ry): 법선이 +Z를 향하도록
// ====================================================================
function faceNormal(fi: number): Vec3 {
  const verts = FACES[fi].map(i => VERTS[i]);
  let x = 0, y = 0, z = 0;
  for (const v of verts) { x += v[0]; y += v[1]; z += v[2]; }
  return vnrm([x/5, y/5, z/5]);
}

export const FACE_ROT_D12: Record<number, { x: number; y: number }> = (() => {
  const out: Record<number, { x: number; y: number }> = {};
  for (let fi = 0; fi < 12; fi++) {
    const [nx, ny, nz] = faceNormal(fi);
    out[FACE_NUM[fi]] = {
      y: Math.atan2(-nx, nz),
      x: Math.atan2(ny, Math.sqrt(nx*nx + nz*nz)),
    };
  }
  return out;
})();

// ====================================================================
// Atlas 텍스처 (4×3, 숫자 1~12)
// ====================================================================
export function createAtlasTexture12(renderer: THREE.WebGLRenderer): THREE.CanvasTexture {
  const AW = 2048, AH = 1536;
  const CW = AW / 4, CH = AH / 3;
  const cv = document.createElement('canvas');
  cv.width = AW; cv.height = AH;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#faf9f5';
  ctx.fillRect(0, 0, AW, AH);
  ctx.fillStyle = '#0c0c0c';
  ctx.font = `bold ${Math.round(CH * 0.42)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let n = 1; n <= 12; n++) {
    const [cx, cy] = D12_CELL_POS[n];
    const xc = cx * CW + CW / 2;
    const yc = cy * CH + CH / 2;
    ctx.fillText(String(n), xc, yc);
    if (n === 6 || n === 9) {
      const uw = CW * 0.16, uh = CH * 0.018;
      ctx.fillRect(xc - uw/2, yc + CH*0.19, uw, uh);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

// ====================================================================
// buildDie: 평평한 인셋 오각형 + 모서리 베벨 띠 + 꼭짓점 캡
// (dodecahedron.html buildDie 포팅 — bulge/segs는 flat quad으로 통일)
// ====================================================================
function buildDie(scaleR: number, gap: number): THREE.BufferGeometry {
  const V = VERTS.map(v => vscl(v, scaleR));

  const fNorm: Vec3[] = [], fCent: Vec3[] = [];
  for (let fi = 0; fi < 12; fi++) {
    const P = FACES[fi].map(i => V[i]) as Vec3[];
    let c: Vec3 = [0,0,0];
    P.forEach(p => { c = vadd(c, p); });
    c = vscl(c, 1/5);
    fNorm.push(vnrm(c)); fCent.push(c);
  }

  // 면별 인셋 꼭짓점 (inset pentagon corners)
  const insV: Vec3[][] = [];
  for (let fi = 0; fi < 12; fi++) {
    const f = FACES[fi], n = fNorm[fi];
    const P = f.map(i => V[i]) as Vec3[];
    const fc = fCent[fi];
    const E: { p: Vec3; dir: Vec3 }[] = [];
    for (let k = 0; k < 5; k++) {
      const a = P[k], b = P[(k+1)%5];
      const dir = vnrm(vsub(b, a));
      let inw = vcrs(n, dir);
      if (vdot(inw, vsub(fc, a)) < 0) inw = vscl(inw, -1);
      E.push({ p: vadd(a, vscl(inw, gap)), dir });
    }
    function intersect(e1: { p: Vec3; dir: Vec3 }, e2: { p: Vec3; dir: Vec3 }): Vec3 {
      const d1 = e1.dir, d2 = e2.dir, p1 = e1.p, p2 = e2.p;
      const r = vsub(p2, p1);
      const c = vcrs(d1, d2);
      const cl2 = vdot(c, c);
      const rc = vcrs(r, d2);
      const s = vdot(rc, c) / cl2;
      return vadd(p1, vscl(d1, s));
    }
    const nv: Vec3[] = [];
    for (let k = 0; k < 5; k++) nv.push(intersect(E[(k+4)%5], E[k]));
    insV.push(nv);
  }

  const positions: number[] = [];
  const uvs: number[] = [];
  const WUV: [number, number] = [0.5/4, 1 - 0.012/3];

  const idxInFace = FACES.map(f => {
    const m: Record<number, number> = {};
    f.forEach((vi, k) => { m[vi] = k; });
    return m;
  });

  function tri(p: Vec3, q: Vec3, r: Vec3) {
    positions.push(p[0],p[1],p[2], q[0],q[1],q[2], r[0],r[1],r[2]);
  }

  // --- 오각형 면 삼각형 (UV 있음) ---
  for (let fi = 0; fi < 12; fi++) {
    const n = fNorm[fi], fc = fCent[fi];
    const up: Vec3 = Math.abs(n[1]) > 0.95 ? [0,0,1] : [0,1,0];
    const v_ax = vnrm(vsub(up, vscl(n, vdot(up, n))));
    const u_ax = vcrs(v_ax, n);
    const P = insV[fi];
    const pr = vlen(vsub(P[0], fc));
    const uvHalf = pr * 1.18;
    const [celX, celY] = D12_CELL_POS[FACE_NUM[fi]];
    const uvF = (p: Vec3): [number, number] => {
      const rv = vsub(p, fc);
      let cu = 0.5 + vdot(rv, u_ax) / (2 * uvHalf);
      let cv = 0.5 - vdot(rv, v_ax) / (2 * uvHalf);
      cu = Math.max(0, Math.min(1, cu));
      cv = Math.max(0, Math.min(1, cv));
      return [(celX + cu) / 4, 1 - (celY + cv) / 3];
    };
    const uvCen = uvF(fc);
    for (let k = 0; k < 5; k++) {
      const k2 = (k+1)%5;
      tri(fc, P[k], P[k2]);
      const uq = uvF(P[k]), ur = uvF(P[k2]);
      uvs.push(uvCen[0],uvCen[1], uq[0],uq[1], ur[0],ur[1]);
    }
  }

  // --- 모서리 베벨 (flat quad = 2 삼각형) ---
  const edgeMap = new Map<string, { fi: number; a: number; b: number }[]>();
  FACES.forEach((f, fi) => {
    for (let k = 0; k < 5; k++) {
      const a = f[k], b = f[(k+1)%5];
      const key = [a,b].sort((x,y)=>x-y).join('-');
      if (!edgeMap.has(key)) edgeMap.set(key, []);
      edgeMap.get(key)!.push({ fi, a, b });
    }
  });
  for (const arr of edgeMap.values()) {
    if (arr.length !== 2) continue;
    const [E1, E2] = arr;
    const a1 = insV[E1.fi][idxInFace[E1.fi][E1.a]];
    const b1 = insV[E1.fi][idxInFace[E1.fi][E1.b]];
    const a2 = insV[E2.fi][idxInFace[E2.fi][E1.a]];
    const b2 = insV[E2.fi][idxInFace[E2.fi][E1.b]];
    tri(a1, b2, b1); uvs.push(WUV[0],WUV[1], WUV[0],WUV[1], WUV[0],WUV[1]);
    tri(a1, a2, b2); uvs.push(WUV[0],WUV[1], WUV[0],WUV[1], WUV[0],WUV[1]);
  }

  // --- 꼭짓점 캡 (3개 면의 인셋 코너를 삼각형으로) ---
  const vFaces: number[][] = Array.from({ length: 20 }, () => []);
  FACES.forEach((f, fi) => f.forEach(vi => vFaces[vi].push(fi)));
  for (let vi = 0; vi < 20; vi++) {
    const fl = vFaces[vi];
    if (fl.length !== 3) continue;
    let corners = fl.map(fi => insV[fi][idxInFace[fi][vi]]);
    const vn = vnrm(V[vi]);
    const bu = vnrm(vsub(corners[0], vscl(vn, vdot(corners[0], vn))));
    const bv = vcrs(vn, bu);
    corners = corners
      .map(c => ({ c, ang: Math.atan2(vdot(c, bv), vdot(c, bu)) }))
      .sort((a, b) => a.ang - b.ang)
      .map(o => o.c);
    tri(corners[0], corners[1], corners[2]);
    uvs.push(WUV[0],WUV[1], WUV[0],WUV[1], WUV[0],WUV[1]);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.computeVertexNormals();
  return geom;
}

function smoothSeams(geom: THREE.BufferGeometry, tol: number): void {
  const pos = geom.attributes.position as THREE.BufferAttribute;
  const nor = geom.attributes.normal as THREE.BufferAttribute;
  const count = pos.count;
  const f = 1 / tol;
  const flat = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    flat[i*3] = nor.getX(i); flat[i*3+1] = nor.getY(i); flat[i*3+2] = nor.getZ(i);
  }
  const groups = new Map<string, number[]>();
  for (let i = 0; i < count; i++) {
    const k = `${Math.round(pos.getX(i)*f)}_${Math.round(pos.getY(i)*f)}_${Math.round(pos.getZ(i)*f)}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(i);
  }
  for (const idxs of groups.values()) {
    if (idxs.length < 2) continue;
    let nx = 0, ny = 0, nz = 0;
    for (const i of idxs) { nx += flat[i*3]; ny += flat[i*3+1]; nz += flat[i*3+2]; }
    const l = Math.hypot(nx, ny, nz);
    if (l > 1e-9) { nx /= l; ny /= l; nz /= l; }
    for (const i of idxs) nor.setXYZ(i, nx, ny, nz);
  }
  nor.needsUpdate = true;
}

export function createDodecahedronGeometry(): THREE.BufferGeometry {
  const geom = buildDie(1.15, 0.03);
  smoothSeams(geom, 1e-3);
  return geom;
}
