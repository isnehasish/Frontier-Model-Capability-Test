// Geometry utilities: parametric surfaces, tapered tubes, arch profiles, merge buckets.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const TAU = Math.PI * 2;
export const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export function rng(seed) {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Height of a two-centred (pointed) arch at horizontal distance d from its axis.
// a = half span, rise = apex height. rise == a gives a semicircle.
export function pointedArch(d, a, rise) {
  const R = (rise * rise + a * a) / (2 * a);
  const q = Math.min(Math.abs(d), a) + R - a;
  return Math.sqrt(Math.max(0, R * R - q * q));
}

// Outline of an arched opening as Vector2[] (counter-clockwise from bottom-left... bottom-right).
export function archOutline(cx, w, y0, ys, rise, seg = 14) {
  const a = w / 2, pts = [];
  pts.push(new THREE.Vector2(cx - a, y0));
  for (let i = 0; i <= seg; i++) {
    const d = a * Math.cos((i / seg) * Math.PI / 2);
    pts.push(new THREE.Vector2(cx - d, ys + pointedArch(d, a, rise)));
  }
  for (let i = seg - 1; i >= 0; i--) {
    const d = a * Math.cos((i / seg) * Math.PI / 2);
    pts.push(new THREE.Vector2(cx + d, ys + pointedArch(d, a, rise)));
  }
  pts.push(new THREE.Vector2(cx + a, y0));
  return pts;
}

// Parametric surface with finite-difference normals. fn(u, v, targetVec3)
export function paramSurface(fn, nu, nv, opt = {}) {
  const { closedU = false, uv = null } = opt;
  const cols = nu + 1, rows = nv + 1;
  const pos = new Float32Array(cols * rows * 3);
  const nor = new Float32Array(cols * rows * 3);
  const uvs = new Float32Array(cols * rows * 2);
  const p = new THREE.Vector3();
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const u = i / nu, v = j / nv, k = j * cols + i;
    fn(u, v, p);
    pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z;
    if (uv) { const t = uv(p, u, v); uvs[k * 2] = t[0]; uvs[k * 2 + 1] = t[1]; }
    else { uvs[k * 2] = u; uvs[k * 2 + 1] = v; }
  }
  const du = new THREE.Vector3(), dv = new THREE.Vector3(), n = new THREE.Vector3();
  const P = (i, j, t) => { const k = (j * cols + i) * 3; return t.set(pos[k], pos[k + 1], pos[k + 2]); };
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const iL = i > 0 ? i - 1 : (closedU ? nu - 1 : 0);
    const iR = i < nu ? i + 1 : (closedU ? 1 : nu);
    const jD = j > 0 ? j - 1 : 0, jU = j < nv ? j + 1 : nv;
    du.subVectors(P(iR, j, a), P(iL, j, b));
    dv.subVectors(P(i, jU, a), P(i, jD, b));
    n.crossVectors(dv, du);
    if (n.lengthSq() < 1e-14) n.set(0, 1, 0); else n.normalize();
    const k = (j * cols + i) * 3;
    nor[k] = n.x; nor[k + 1] = n.y; nor[k + 2] = n.z;
  }
  const idx = [];
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const A = j * cols + i, B = A + 1, C = A + cols, D = C + 1;
    idx.push(A, C, B, B, C, D);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setIndex(idx);
  return g;
}

// Tube through points with optional radius function r(t), t in [0,1].
export function tube(pts, r, opt = {}) {
  const { radial = 8, closed = false } = opt;
  const segs = opt.segs || Math.max(8, pts.length * 3);
  const curve = new THREE.CatmullRomCurve3(pts, closed, 'centripetal');
  const g = new THREE.TubeGeometry(curve, segs, 1, radial, closed);
  const pos = g.attributes.position, P = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    curve.getPointAt(i / segs, P);
    const rr = typeof r === 'function' ? r(i / segs) : r;
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      pos.setXYZ(k, P.x + (pos.getX(k) - P.x) * rr, P.y + (pos.getY(k) - P.y) * rr, P.z + (pos.getZ(k) - P.z) * rr);
    }
  }
  return g;
}

export function lathe(pairs, seg = 32) {
  return new THREE.LatheGeometry(pairs.map(p => new THREE.Vector2(p[0], p[1])), seg);
}

export function spiralPts(cx, cy, r0, r1, a0, a1, n = 24) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = lerp(a0, a1, t), r = lerp(r0, r1, t);
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

export function xf(x, y, z, ry = 0, s = 1) {
  const m = new THREE.Matrix4();
  m.compose(V3(x, y, z), new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), ry),
    typeof s === 'number' ? V3(s, s, s) : s);
  return m;
}

// Collects geometry by material key and merges into one mesh per key.
export class Builder {
  constructor() { this.buckets = {}; this.tris = 0; }
  add(key, geo, matrix) {
    if (matrix) geo.applyMatrix4(matrix);
    for (const name of Object.keys(geo.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') geo.deleteAttribute(name);
    }
    const n = geo.attributes.position.count;
    if (!geo.attributes.normal) geo.computeVertexNormals();
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    if (!geo.index) {
      const idx = new Uint32Array(n);
      for (let i = 0; i < n; i++) idx[i] = i;
      geo.setIndex(new THREE.BufferAttribute(idx, 1));
    }
    geo.morphAttributes = {};
    (this.buckets[key] = this.buckets[key] || []).push(geo);
    this.tris += geo.index.count / 3;
  }
  build(materials, noShadow = []) {
    const meshes = {};
    for (const key of Object.keys(this.buckets)) {
      const merged = mergeGeometries(this.buckets[key], false);
      if (!merged) { console.error('merge failed for', key); continue; }
      this.buckets[key].forEach(g => g.dispose());
      const mat = materials[key];
      if (!mat) console.error('missing material', key);
      const mesh = new THREE.Mesh(merged, mat);
      mesh.name = key;
      const ns = noShadow.includes(key);
      mesh.castShadow = !ns; mesh.receiveShadow = !ns;
      meshes[key] = mesh;
    }
    this.buckets = {};
    return meshes;
  }
}
