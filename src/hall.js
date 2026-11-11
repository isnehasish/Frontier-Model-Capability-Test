// Procedural architecture of the marble hall.
import * as THREE from 'three';
import { Builder, V3, TAU, lerp, sstep, rng, pointedArch, archOutline, paramSurface, tube, lathe, spiralPts, xf } from './geo.js';

export const HX = 22, NX = 9, SPRING = 15, RISE = 9, GY = 7.5, WALL_H = 26.5, WT = 1.5;
export const ZL = [40, 29, 18, 7, -11, -22, -33];
export const CROSS_Z = -2, APSE_Z = -33;
const PI = Math.PI;

// ------------------------------------------------------------------ columns
function column(B, x, z, o = {}) {
  const { H = SPRING, R = 1.0, capR = 2.2, k = 4, dir = 1, seed = 1, fine = true } = o;
  const R0 = rng(seed * 977 + 13);
  const ph = R0() * TAU, sc = R / 1.0;
  const M = xf(x, 0, z);
  const capH = H * 0.3;
  const tw = y => dir * (y * 0.36 / Math.sqrt(sc) + 0.35 * Math.sin(y * 0.4 + ph)) + ph;
  const prof = y => {
    const b = 1 + 0.36 * Math.exp(-y / (0.8 * R));
    const t = sstep(H - capH, H, y);
    return R * b * (1 + (capR / R - 1) * t * t * (0.55 + 0.45 * t));
  };
  const depth = y => 0.2 + 0.2 * sstep(H - capH, H, y);
  const surfR = (th, y) => {
    const d = depth(y), l = Math.pow(Math.abs(Math.cos(k * (th - tw(y)) / 2)), 0.6);
    const fl = 1 + 0.02 * Math.cos(3 * k * (th - tw(y) * 1.15)); // secondary fluting
    return prof(y) * (1 - d + d * l) * fl;
  };
  const onS = (th, y, off = 0) => { const r = surfR(th, y) + off; return V3(Math.cos(th) * r, y, Math.sin(th) * r); };

  B.add('marble', paramSurface((u, v, p) => {
    const th = u * TAU, y = v * H, r = surfR(th, y);
    p.set(Math.cos(th) * r, y, Math.sin(th) * r);
  }, fine ? 112 : 56, fine ? 150 : 60, { closedU: true }), M.clone());

  // thick counter-twisting vines
  const nV = 2;
  for (let i = 0; i < nV; i++) {
    const th0 = ph * 1.7 + i * TAU / nV, pts = [];
    const y1 = H - capH * 0.45;
    for (let y = 0.25; y <= y1; y += 0.3) pts.push(onS(th0 - dir * y * 0.5 / Math.sqrt(sc), y, -0.035 * sc));
    B.add('marble', tube(pts, t => sc * (0.04 + 0.085 * Math.pow(Math.sin(Math.min(1, t * 1.02) * PI), 0.35)), { radial: 8, segs: pts.length * 2 }), M.clone());
  }
  // gold threads in the grooves, with curls
  for (let m = 0; m < k; m++) {
    const gth = y => tw(y) + (PI + TAU * m) / k;
    const pts = [];
    for (let y = 0.9 * sc; y <= H - capH * 0.3; y += 0.22) pts.push(onS(gth(y) + 0.1 * Math.sin(y * 2.6 + m), y, 0.035));
    B.add('gold', tube(pts, 0.017 * Math.sqrt(sc), { radial: 5, segs: pts.length * 2 }), M.clone());
    if (!fine) continue;
    for (let y0 = 1.6 + R0() * 0.8; y0 < H - capH; y0 += 1.25 + R0() * 0.9) {
      const sd = R0() < 0.5 ? -1 : 1, rad = 0.13 + R0() * 0.13;
      const rr = prof(y0);
      const sp = spiralPts(0, 0, rad, 0.03, -PI / 2 * sd, sd * (PI * 2.4), 22);
      const cp = sp.map(([a, b]) => onS(gth(y0 + b + rad) + (a + sd * rad * 0.5) / rr, y0 + b + rad, 0.045));
      B.add('gold', tube(cp, t => 0.02 - 0.01 * t, { radial: 5, segs: 44 }), M.clone());
      // little leaf
      const lp = [onS(gth(y0) - sd * 0.05, y0, 0.04), onS(gth(y0) - sd * 0.22 / rr * 1.2, y0 + 0.25, 0.06), onS(gth(y0) - sd * 0.3 / rr, y0 + 0.55, 0.04)];
      B.add('gold', tube(lp, t => 0.006 + 0.035 * Math.sin(t * PI), { radial: 5, segs: 10 }), M.clone());
    }
  }
  // capital fronds
  const nF = fine ? 12 : 8;
  for (let j = 0; j < nF; j++) {
    const th = tw(H) + j * TAU / nF;
    const prof2 = [
      [prof(H - capH) * 0.93, H - capH], [prof(H - capH * 0.62) * 0.98, H - capH * 0.62],
      [capR * 0.9, H - capH * 0.27], [capR + 0.16 * sc, H - 0.52 * sc], [capR + 0.5 * sc, H - 0.42 * sc],
      [capR + 0.6 * sc, H - 0.82 * sc], [capR + 0.38 * sc, H - 1.02 * sc], [capR + 0.27 * sc, H - 0.82 * sc],
    ];
    const pts = prof2.map(([r, y]) => { const a = th + (tw(y) - tw(H)) * 0.8; return V3(Math.cos(a) * r, y, Math.sin(a) * r); });
    B.add('marble', tube(pts, t => sc * (0.24 - 0.17 * t), { radial: 7, segs: 30 }), M.clone());
    const th2 = th + PI / nF;
    const pg = prof2.slice(1, 6).map(([r, y]) => { const a = th2 + (tw(y) - tw(H)) * 0.8; return V3(Math.cos(a) * (r + 0.06), y - 0.15, Math.sin(a) * (r + 0.06)); });
    B.add('gold', tube(pg, t => sc * (0.012 + 0.028 * Math.sin(t * PI)), { radial: 5, segs: 18 }), M.clone());
  }
  // abacus + gold ring
  B.add('marble', lathe([[0, H - 0.5 * sc], [capR - 0.45 * sc, H - 0.5 * sc], [capR - 0.1 * sc, H - 0.4 * sc], [capR + 0.06 * sc, H - 0.28 * sc], [capR + 0.06 * sc, H - 0.1 * sc], [capR - 0.12 * sc, H - 0.01], [0, H - 0.01]], 40), M.clone());
  B.add('gold', new THREE.TorusGeometry(capR + 0.07 * sc, 0.05 * sc, 6, 48).rotateX(PI / 2), xf(x, H - 0.19 * sc, z));
  // base
  B.add('marble', lathe([[0, 0], [R * 1.72, 0], [R * 1.72, 0.2 * sc], [R * 1.64, 0.27 * sc], [R * 1.68, 0.33 * sc], [R * 1.7, 0.42 * sc], [R * 1.64, 0.5 * sc], [R * 1.52, 0.56 * sc], [R * 1.5, 0.62 * sc], [R * 1.44, 0.82 * sc], [R * 1.1, 0.88 * sc]], 48), M.clone());
  B.add('gold', new THREE.TorusGeometry(R * 1.66, 0.03 * sc, 5, 48).rotateX(PI / 2), xf(x, 0.57 * sc, z));
}

// ------------------------------------------------------------------ vaults
const vh = (x, z, xc, zc, ax, az) => SPRING + Math.max(pointedArch(x - xc, ax, RISE), pointedArch(z - zc, az, RISE));

function vaultBay(B, x0, x1, z0, z1) {
  const xc = (x0 + x1) / 2, zc = (z0 + z1) / 2, ax = Math.abs(x1 - x0) / 2, az = Math.abs(z1 - z0) / 2;
  const N = 36;
  B.add('vault', paramSurface((u, v, p) => {
    const x = xc + ax * Math.sin((u * 2 - 1) * PI / 2), z = zc + az * Math.sin((v * 2 - 1) * PI / 2);
    p.set(x, vh(x, z, xc, zc, ax, az), z);
  }, N, N, { uv: (p) => [p.x / 5.5, p.z / 5.5 + p.y / 9] }));
  for (const sg of [1, -1]) {
    const pts = [];
    for (let i = 0; i <= 30; i++) {
      const t = Math.sin((i / 30 * 2 - 1) * PI / 2);
      const x = xc + t * ax, z = zc + sg * t * az;
      pts.push(V3(x, vh(x, z, xc, zc, ax, az) - 0.06, z));
    }
    B.add('marble', tube(pts, t => 0.16 + 0.1 * Math.pow(Math.abs(t * 2 - 1), 3), { radial: 8, segs: 64 }));
    B.add('gold', tube(pts.map(p => V3(p.x, p.y - 0.17, p.z)), 0.035, { radial: 5, segs: 64 }));
  }
  boss(B, xc, SPRING + RISE - 0.1, zc, 0.5);
}

function boss(B, x, y, z, r) {
  B.add('gold', new THREE.SphereGeometry(r, 20, 12).scale(1, 0.45, 1), xf(x, y - r * 0.2, z));
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU;
    B.add('gold', new THREE.SphereGeometry(r * 0.42, 10, 8).scale(1, 0.3, 0.55).rotateY(-a), xf(x + Math.cos(a) * r * 1.05, y - r * 0.1, z + Math.sin(a) * r * 1.05));
  }
  B.add('gold', new THREE.ConeGeometry(r * 0.3, r * 1.2, 10).rotateX(PI), xf(x, y - r * 0.95, z));
}

function archRib(B, x0, z0, x1, z1, r, gold = true) {
  const a = Math.hypot(x1 - x0, z1 - z0) / 2, pts = [], g1 = [], g2 = [];
  const nx = (z1 - z0) / (2 * a), nz = -(x1 - x0) / (2 * a);
  for (let i = 0; i <= 32; i++) {
    const t = Math.sin((i / 32 * 2 - 1) * PI / 2);
    const x = lerp(x0, x1, (t + 1) / 2), z = lerp(z0, z1, (t + 1) / 2);
    const y = SPRING + pointedArch(t * a, a, RISE) - r * 0.25;
    pts.push(V3(x, y, z));
    g1.push(V3(x + nx * r * 0.92, y - r * 0.5, z + nz * r * 0.92));
    g2.push(V3(x - nx * r * 0.92, y - r * 0.5, z - nz * r * 0.92));
  }
  B.add('marble', tube(pts, r, { radial: 12, segs: 72 }));
  if (gold) {
    B.add('gold', tube(g1, 0.045, { radial: 5, segs: 72 }));
    B.add('gold', tube(g2, 0.045, { radial: 5, segs: 72 }));
  }
}

function crossingDome(B) {
  const zc = CROSS_Z, R2 = 2 * NX * NX, rr = 8.0;
  const ringY = SPRING + Math.sqrt(R2 - rr * rr);
  B.add('vault', paramSurface((u, v, p) => {
    const th = u * TAU, c = Math.cos(th), s = Math.sin(th);
    const sq = NX / Math.max(Math.abs(c), Math.abs(s));
    const rad = rr + (sq - rr) * Math.sin(v * PI / 2);
    const x = rad * c, z = rad * s;
    p.set(x, SPRING + Math.sqrt(Math.max(0, R2 - x * x - z * z)), zc + z);
  }, 128, 18, { closedU: true, uv: (p, u, v) => [u * 10, v * 1.6] }));
  const tor = (r, t, y, key) => B.add(key, new THREE.TorusGeometry(r, t, 10, 96).rotateX(PI / 2), xf(0, y, zc));
  tor(rr, 0.36, ringY, 'marble'); tor(rr - 0.3, 0.07, ringY - 0.12, 'gold'); tor(rr - 0.2, 0.06, ringY + 0.36, 'gold');
  const drumH = 3.6;
  B.add('vault', paramSurface((u, v, p) => { const th = u * TAU; p.set(Math.cos(th) * (rr - 0.02), ringY + v * drumH, zc + Math.sin(th) * (rr - 0.02)); }, 96, 4, { closedU: true, uv: (p, u, v) => [u * 14, v * 1.0] }));
  B.add('goldRelief', paramSurface((u, v, p) => { const th = u * TAU; p.set(Math.cos(th) * (rr - 0.1), ringY + 0.42 + v * 0.85, zc + Math.sin(th) * (rr - 0.1)); }, 96, 1, { closedU: true, uv: (p, u, v) => [u * 40, v * 0.7] }));
  tor(rr - 0.08, 0.1, ringY + 1.32, 'marble'); tor(rr - 0.05, 0.16, ringY + drumH, 'marble'); tor(rr - 0.18, 0.05, ringY + drumH - 0.2, 'gold');
  // drum windows
  const nW = 12;
  for (let i = 0; i < nW; i++) {
    const a = (i + 0.5) / nW * TAU, r = (rr - 0.02) * Math.cos(PI / nW) - 0.12;
    const m = xf(Math.cos(a) * r, 0, zc + Math.sin(a) * r, -a + PI / 2);
    const out = archOutline(0, 1.7, ringY + 1.6, ringY + 2.5, 0.85, 8);
    const dg = new THREE.ShapeGeometry(new THREE.Shape(out));
    { const p = dg.attributes.position, uv = dg.attributes.uv; for (let q = 0; q < p.count; q++) uv.setXY(q, (p.getX(q) + 0.85) / 1.7, (p.getY(q) - ringY - 1.6) / 1.75); }
    B.add('glassDome', dg, m.clone());
    const pts = archOutline(0, 1.8, ringY + 1.56, ringY + 2.5, 0.92, 8).map(p => V3(p.x, p.y, -0.02));
    B.add('gold', tube(pts, 0.05, { radial: 5, segs: 40 }), m.clone());
  }
  // dome shell
  const domeY = ringY + drumH, domeH = 6.5, oc = 2.2, phiMax = Math.acos(oc / rr);
  B.add('vault', paramSurface((u, v, p) => {
    const th = u * TAU, ph = v * phiMax, r = rr * Math.cos(ph);
    p.set(Math.cos(th) * r, domeY + domeH * Math.sin(ph), zc + Math.sin(th) * r);
  }, 96, 24, { closedU: true, uv: (p, u, v) => [u * 12, v * 2.5] }));
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * TAU, pts = [];
    for (let j = 0; j <= 14; j++) { const ph = j / 14 * phiMax, r = rr * Math.cos(ph) - 0.06; pts.push(V3(Math.cos(a) * r, domeY + domeH * Math.sin(ph) - 0.04, zc + Math.sin(a) * r)); }
    B.add('marble', tube(pts, 0.13, { radial: 6, segs: 30 }));
    B.add('gold', tube(pts.map(p => V3(p.x * 0.985, p.y - 0.1, zc + (p.z - zc) * 0.985)), 0.04, { radial: 5, segs: 30 }));
  }
  const topY = domeY + domeH * Math.sin(phiMax);
  B.add('glassSky', new THREE.CircleGeometry(oc + 0.1, 40).rotateX(PI / 2), xf(0, topY + 0.02, zc));
  tor(oc, 0.2, topY - 0.05, 'marble'); tor(oc - 0.2, 0.06, topY - 0.2, 'gold');
  return { ringY, topY };
}

// ------------------------------------------------------------------ walls & windows
// Local frame: x along wall, y up, +z outward (interior face at z = 0).
function wallMatrix(px, pz, ox, oz) { return xf(px, 0, pz, Math.atan2(ox, oz)); }

function addWindow(B, M, w, glassKey) {
  const { cx, w: ww, y0, ys, rise, n = 3 } = w;
  const top = ys + rise, bar = 0.13;
  const out = archOutline(cx, ww, y0, ys, rise);
  // glass
  const gg = new THREE.ShapeGeometry(new THREE.Shape(out));
  const pos = gg.attributes.position, uv = gg.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - (cx - ww / 2)) / ww, (pos.getY(i) - y0) / (top - y0));
  gg.translate(0, 0, WT * 0.55);
  B.add(glassKey, gg, M.clone());
  // tracery
  const sh = new THREE.Shape(out);
  const wl = (ww - (n + 1) * bar) / n, rl = wl * 1.0;
  const lsp = ys - rl * 0.35, lap = lsp + rl;
  for (let i = 0; i < n; i++) {
    const lx = cx - ww / 2 + bar + wl / 2 + i * (wl + bar);
    sh.holes.push(new THREE.Path(archOutline(lx, wl, y0 + bar, lsp, rl, 8)));
  }
  let r = Math.min(0.22 * ww, (top - lap - 3 * bar) / 2);
  const yc = lap + bar + r;
  const R = (rise * rise + ww * ww / 4) / ww, hwAt = Math.sqrt(Math.max(0, R * R - (yc - ys) * (yc - ys))) - (R - ww / 2);
  r = Math.min(r, hwAt - bar * 1.3);
  if (r > 0.25) {
    const pth = new THREE.Path(); pth.absarc(cx, yc, r, 0, TAU, false); sh.holes.push(pth);
    B.add('tracery', new THREE.TorusGeometry(r * 0.55, 0.05, 6, 28), M.clone().multiply(xf(cx, yc, WT * 0.45)));
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU;
      B.add('tracery', new THREE.CylinderGeometry(0.035, 0.035, r * 0.5, 5).translate(0, r * 0.78, 0).rotateZ(a), M.clone().multiply(xf(cx, yc, WT * 0.45)));
    }
  }
  const tg = new THREE.ExtrudeGeometry(sh, { depth: 0.2, bevelEnabled: false, curveSegments: 20 });
  tg.translate(0, 0, WT * 0.35);
  B.add('tracery', tg, M.clone());
  // mouldings on the interior face
  const mo = archOutline(cx, ww + 0.26, y0 - 0.05, ys, rise + 0.16).map(p => V3(p.x, p.y, -0.02));
  B.add('marble', tube(mo, 0.15, { radial: 8, segs: 70 }), M.clone());
  const go = archOutline(cx, ww + 0.72, y0 - 0.05, ys, rise + 0.42).map(p => V3(p.x, p.y, 0.0));
  B.add('gold', tube(go, 0.04, { radial: 5, segs: 70 }), M.clone());
  B.add('marble', new THREE.BoxGeometry(ww + 1.0, 0.2, 0.55), M.clone().multiply(xf(cx, y0 - 0.12, 0.05)));
}

function wall(B, M, width, wins, glassKeys, extraHoles = []) {
  const sh = new THREE.Shape();
  sh.moveTo(-width / 2, 0); sh.lineTo(width / 2, 0); sh.lineTo(width / 2, WALL_H); sh.lineTo(-width / 2, WALL_H); sh.closePath();
  for (const w of wins) sh.holes.push(new THREE.Path(archOutline(w.cx, w.w, w.y0, w.ys, w.rise)));
  for (const h of extraHoles) sh.holes.push(new THREE.Path(archOutline(h.cx, h.w, h.y0, h.ys, h.rise)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: WT, bevelEnabled: false });
  B.add('marble', g, M.clone());
  wins.forEach((w, i) => addWindow(B, M, w, glassKeys[w.low ? 1 : 0]));
}

const upWin = (cx) => ({ cx, w: 4.6, y0: 9.3, ys: 16.2, rise: 5.2, n: 3 });
const lowWin = (cx) => ({ cx, w: 4.6, y0: 1.35, ys: 3.5, rise: 2.5, n: 3, low: true });

// ------------------------------------------------------------------ gallery
export function galleryEdge(z) {
  for (let k = 0; k < ZL.length - 1; k++) {
    if (z <= ZL[k] + 1e-6 && z >= ZL[k + 1] - 1e-6) {
      const f = (z - ZL[k + 1]) / (ZL[k] - ZL[k + 1]);
      const deep = (ZL[k] - ZL[k + 1]) > 12 ? 4.4 : 3.1;
      return 10.15 + deep * Math.pow(Math.sin(PI * f), 2);
    }
  }
  return 10.15;
}

function gallery(B, s, lanterns) {
  const zA = ZL[0], zB = ZL[ZL.length - 1];
  const sh = new THREE.Shape();
  sh.moveTo(s * (HX + 0.2), zA); sh.lineTo(s * (HX + 0.2), zB);
  const edge = [];
  for (let z = zB; z <= zA + 1e-6; z += 0.25) { sh.lineTo(s * galleryEdge(z), z); edge.push(z); }
  sh.closePath();
  const slab = new THREE.ExtrudeGeometry(sh, { depth: 0.62, bevelEnabled: false });
  slab.rotateX(PI / 2); slab.translate(0, GY, 0);
  B.add('marble', slab);
  const line = (dx, y) => edge.map(z => V3(s * (galleryEdge(z) + dx), y, z));
  const segs = edge.length * 2;
  B.add('marble', tube(line(-0.02, GY - 0.3), 0.34, { radial: 10, segs }));
  B.add('marble', tube(line(-0.05, GY + 0.03), 0.13, { radial: 8, segs }));
  B.add('marble', tube(line(0.32, GY - 0.66), 0.22, { radial: 8, segs }));
  B.add('gold', tube(line(-0.37, GY - 0.3), 0.04, { radial: 5, segs }));
  B.add('gold', tube(line(-0.2, GY - 0.02), 0.03, { radial: 5, segs }));

  // balustrade
  const rc = new THREE.CatmullRomCurve3(line(0.22, GY), false, 'centripetal');
  const L = rc.getLength(), nP = Math.round(L / 2.3), tmp = V3();
  const at = (u, h) => { rc.getPointAt(Math.min(1, Math.max(0, u)), tmp); return V3(tmp.x, GY + h, tmp.z); };
  const railPts = (h) => { const a = []; for (let i = 0; i <= 260; i++) a.push(at(i / 260, h)); return a; };
  B.add('marble', tube(railPts(1.16), 0.085, { radial: 8, segs: 520 }));
  B.add('gold', tube(railPts(1.255), 0.022, { radial: 5, segs: 520 }));
  B.add('marble', tube(railPts(0.1), 0.06, { radial: 6, segs: 520 }));
  for (let i = 0; i <= nP; i++) {
    const u = i / nP, p = at(u, 0);
    B.add('marble', lathe([[0.13, 0], [0.13, 0.08], [0.07, 0.16], [0.085, 0.5], [0.06, 0.95], [0.11, 1.08], [0.11, 1.22], [0.05, 1.26], [0.001, 1.27]], 10), xf(p.x, p.y, p.z));
    B.add('gold', new THREE.SphereGeometry(0.07, 10, 8), xf(p.x, p.y + 1.33, p.z));
    if (i === nP) break;
    const Lp = L / nP, u1 = (i + 1) / nP;
    const map = pts => pts.map(([a, h]) => at(u + (a / Lp) * (u1 - u), h));
    const mot = [];
    for (const sd of [0, 1]) {
      const mx = a => sd ? Lp - a : a;
      const sp = spiralPts(0.62, 0.7, 0.3, 0.05, -PI / 2, PI * 2.1, 20).map(([a, h]) => [mx(a), h]);
      mot.push([[mx(0.1), 0.14], [mx(0.3), 0.2], ...sp]);
      mot.push(spiralPts(0.38, 0.86, 0.17, 0.04, PI * 1.4, -PI * 0.9, 12).map(([a, h]) => [mx(a), h]));
      mot.push([[mx(0.12), 1.1], [mx(0.5), 1.04], [mx(0.95), 0.72], [mx(Lp / 2), 0.2]]);
    }
    const c = Lp / 2;
    mot.push([[c, 0.14], [c - 0.16, 0.5], [c, 1.08], [c + 0.16, 0.5], [c, 0.14]]);
    for (const m of mot) B.add('marble', tube(map(m), 0.032, { radial: 5, segs: m.length * 2 }));
  }

  // branch corbels from columns and wall piers
  for (let k = 1; k < ZL.length - 1; k++) {
    const z = ZL[k];
    for (const dz of [-2.6, 0, 2.6]) {
      const pts = [V3(s * 21.2, 4.0, z), V3(s * 20.6, 5.4, z + dz * 0.25), V3(s * 19.2, 6.4, z + dz * 0.7), V3(s * 17.2, GY - 0.72, z + dz)];
      B.add('marble', tube(pts, t => 0.2 - 0.12 * t, { radial: 7, segs: 16 }));
    }
    for (const dz of [-2.4, 2.4]) {
      const ze = z + dz, e = galleryEdge(ze);
      const pts = [V3(s * 9.9, 4.3, z + dz * 0.05), V3(s * 10.7, 5.6, z + dz * 0.3), V3(s * (e + 0.5), 6.5, z + dz * 0.75), V3(s * (e + 0.9), GY - 0.7, ze)];
      B.add('marble', tube(pts, t => 0.22 - 0.13 * t, { radial: 7, segs: 16 }));
    }
    const pts = [V3(s * 9.95, 4.8, z), V3(s * 12.5, 6.3, z), V3(s * 15.5, GY - 0.72, z)];
    B.add('marble', tube(pts, t => 0.24 - 0.14 * t, { radial: 7, segs: 14 }));
    lanterns.push({ p: V3(s * 18.6, GY - 0.6, z + 1.4), chain: 0.9, light: true });
    lanterns.push({ p: V3(s * 12.3, GY - 0.7, z + 2.1), chain: 0.7, light: (k % 2 === 1) });
  }
  return rc;
}

// ------------------------------------------------------------------ lanterns
function lantern(B, L) {
  const { p, chain } = L;
  const m = xf(p.x, p.y - chain, p.z);
  B.add('gold', new THREE.CylinderGeometry(0.012, 0.012, chain, 5).translate(0, chain / 2, 0), m.clone());
  B.add('gold', lathe([[0.02, 0], [0.05, -0.04], [0.22, -0.2], [0.24, -0.24], [0.2, -0.26]], 6), m.clone());
  const prof = [[0.17, -0.26], [0.215, -0.5], [0.17, -0.78], [0.07, -0.92], [0.001, -0.95]];
  B.add('lanternGlass', lathe(prof, 6), m.clone());
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * TAU + PI / 6;
    const pts = [[0.2, -0.25], ...prof.slice(0, 4), [0.03, -1.0]].map(([r, y]) => V3(Math.cos(a) * (r + 0.012), y, Math.sin(a) * (r + 0.012)));
    B.add('gold', tube(pts, 0.014, { radial: 4, segs: 12 }), m.clone());
  }
  B.add('gold', new THREE.TorusGeometry(0.225, 0.014, 4, 6).rotateX(PI / 2).rotateY(PI / 6), m.clone().multiply(xf(0, -0.5, 0)));
  B.add('gold', new THREE.SphereGeometry(0.045, 8, 6), m.clone().multiply(xf(0, -1.03, 0)));
  L.c = V3(p.x, p.y - chain - 0.55, p.z);
}

// ------------------------------------------------------------------ apse & throne
function apse(B) {
  const cz = APSE_Z, Rp = 9.35, nF = 7;
  const vtx = [];
  for (let k = 0; k <= nF; k++) { const a = PI + k * PI / nF; vtx.push([Rp * Math.cos(a), cz + Rp * Math.sin(a)]); }
  const L = V3(-0.8, 0, -0.32).normalize();
  for (let k = 0; k < nF; k++) {
    const [x0, z0] = vtx[k], [x1, z1] = vtx[k + 1];
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    const o = V3(mx, 0, mz - cz).normalize();
    const M = wallMatrix(mx, mz, o.x, o.z);
    const width = Math.hypot(x1 - x0, z1 - z0) + 0.6;
    const sun = o.dot(L) > 0.15;
    wall(B, M, width, [{ cx: 0, w: 2.1, y0: 8.9, ys: 12.1, rise: 2.3, n: 2 }], [sun ? 'glassSunTall' : 'glassShadeTall', 'glassSunLow']);
    // blind arcade below
    const ar = archOutline(0, 2.7, 0, 4.4, 2.0, 10).map(p => V3(p.x, p.y, -0.03));
    B.add('marble', tube(ar, 0.13, { radial: 7, segs: 50 }), M.clone());
    B.add('gold', tube(archOutline(0, 2.3, 0, 4.4, 1.7, 10).map(p => V3(p.x, p.y, -0.01)), 0.035, { radial: 5, segs: 50 }), M.clone());
  }
  for (let k = 0; k <= nF; k++) {
    const [x, z] = vtx[k], f = 0.972;
    const px = x * f, pz = cz + (z - cz) * f;
    B.add('marble', new THREE.CylinderGeometry(0.24, 0.26, SPRING, 14).translate(0, SPRING / 2, 0), xf(px, 0, pz));
    for (const y of [8.35, SPRING - 0.5]) {
      B.add('gold', lathe([[0.25, 0], [0.28, 0.06], [0.3, 0.3], [0.42, 0.45], [0.42, 0.52], [0.25, 0.54]], 14), xf(px, y, pz));
    }
    B.add('marble', lathe([[0.4, 0], [0.4, 0.3], [0.3, 0.42], [0.26, 0.7]], 14), xf(px, 0, pz));
    // dome rib
    const a = PI + k * PI / nF, pts = [];
    for (let j = 0; j <= 14; j++) { const ph = j / 14 * PI / 2, r = 8.95 * Math.cos(ph); pts.push(V3(r * Math.cos(a), SPRING + 8.95 * Math.sin(ph), cz + r * Math.sin(a))); }
    B.add('marble', tube(pts, t => 0.2 - 0.07 * t, { radial: 7, segs: 32 }));
    B.add('gold', tube(pts.map(p => V3(p.x * 0.985, p.y - 0.16, cz + (p.z - cz) * 0.985)), 0.04, { radial: 5, segs: 32 }));
  }
  B.add('vault', paramSurface((u, v, p) => {
    const th = PI + u * PI, ph = v * PI / 2, r = NX * Math.cos(ph);
    p.set(r * Math.cos(th), SPRING + NX * Math.sin(ph), cz + r * Math.sin(th));
  }, 56, 22, { uv: (p, u, v) => [u * 7, v * 3] }));
  boss(B, 0, SPRING + NX - 0.15, cz - 0.3, 0.6);
  const arcT = (r, t, y, key) => B.add(key, new THREE.TorusGeometry(r, t, 8, 64, PI).rotateX(-PI / 2), xf(0, y, cz));
  arcT(9.02, 0.2, GY - 0.3, 'marble'); arcT(9.0, 0.16, GY + 0.75, 'marble'); arcT(9.0, 0.3, SPRING, 'marble');
  arcT(8.82, 0.05, GY - 0.1, 'gold'); arcT(8.84, 0.05, GY + 0.56, 'gold'); arcT(8.7, 0.06, SPRING - 0.2, 'gold');
  const band = new THREE.CylinderGeometry(8.98, 8.98, 0.72, 64, 1, true, PI / 2, PI);
  const uv = band.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 44, uv.getY(i) * 0.6);
  B.add('goldRelief', band, xf(0, GY + 0.23, cz));
}

function ribbon(P, r, zz, segs) {
  const g = tube(P, r, { radial: 10, segs });
  g.translate(0, 0, -zz).scale(1, 1, 0.5).translate(0, 0, zz);
  g.computeVertexNormals();
  return g;
}

function throne(B, lights) {
  const dz = -36.6, cz = -39.0;
  [[6.6, 0.28], [5.8, 0.56], [5.0, 0.84]].forEach(([r, top], i) => {
    B.add('marble', new THREE.CylinderGeometry(r, r, 0.28, 72).translate(0, top - 0.14, 0), xf(0, 0, dz));
    B.add('gold', new THREE.TorusGeometry(r, 0.03, 5, 96).rotateX(PI / 2), xf(0, top - 0.02, dz));
  });
  const top = 0.84, YS = 0.84;
  for (const s of [-1, 1]) {
    for (let i = 0; i < 9; i++) {
      const q = i / 8, zz = cz + 0.55 * Math.sin(i * 2.1);
      const P = [
        [1.3 + 3.4 * q, 0.5, 1.5 * q + 0.4], [1.0 + 2.7 * q, 2.2 + 0.5 * q, 0.7 * q], [1.9 + 3.3 * q, 4.5 + 1.6 * q, 0.2 * q],
        [1.5 + 2.4 * q, 6.8 + 2.6 * q, 0], [0.42 + 0.9 * q, 8.6 + 3.4 * q, 0], [0.55 + 1.5 * q, 10.0 + 3.8 * q, 0.1], [0.12 + 1.0 * q, 11.3 + 4.3 * q, 0.25],
      ].map(([x, y, z]) => V3(s * x, y * YS + 0.3, zz + z));
      B.add('marble', ribbon(P, t => 0.06 + 0.42 * Math.pow(1 - t, 0.8), zz, 60));
      if (i % 2 === 0) B.add('gold', tube(P.map(p => V3(p.x * 0.94, p.y, p.z + 0.3)), t => 0.012 + 0.05 * Math.sin(t * PI), { radial: 5, segs: 60 }));
    }
    for (let i = 0; i < 5; i++) {
      const q = i / 4, zz = cz + 0.5 + 0.3 * Math.cos(i * 1.7);
      const P = [
        [0.9, 0.5, 0.8], [2.2 + 1.6 * q, 2.6, 0.4], [3.4 + 2.0 * q, 5.4 + 1.2 * q, 0.1], [2.2 + 1.5 * q, 8.0 + 2.2 * q, 0],
        [2.9 + 1.6 * q, 9.3 + 2.3 * q, 0.1], [3.5 + 1.6 * q, 8.8 + 2.2 * q, 0.2], [3.25 + 1.6 * q, 8.3 + 2.2 * q, 0.2],
      ].map(([x, y, z]) => V3(s * x, y * YS + 0.3, zz + z));
      B.add('marble', ribbon(P, t => 0.05 + 0.34 * Math.pow(1 - t, 0.8), zz, 56));
    }
    // roots swirling over the dais
    [[3.1, top, -37.3, 1.5, 0.22], [5.5, 0.56, -35.7, 1.2, 0.2], [7.2, 0.0, -34.6, 1.25, 0.2], [4.3, 0.84, -39.2, 1.0, 0.18]].forEach(([x, y, z, r, tr], j) => {
      const sp = spiralPts(0, 0, r, 0.12, j * 1.3, j * 1.3 + s * PI * 3.3, 40).map(([a, b]) => V3(s * x + a, y + 0.08, z + b));
      B.add('marble', tube(sp, t => tr * (1 - 0.72 * t), { radial: 8, segs: 80 }));
    });
  }
  // carved backdrop panels behind the ribbons
  const ogee = (w, h, y0) => {
    const sh = new THREE.Shape(); sh.moveTo(-w * 0.55, y0);
    sh.bezierCurveTo(-w * 1.25, y0 + h * 0.22, -w * 1.05, y0 + h * 0.52, -w * 0.32, y0 + h * 0.72);
    sh.bezierCurveTo(-w * 0.08, y0 + h * 0.8, -w * 0.04, y0 + h * 0.9, 0, y0 + h);
    sh.bezierCurveTo(w * 0.04, y0 + h * 0.9, w * 0.08, y0 + h * 0.8, w * 0.32, y0 + h * 0.72);
    sh.bezierCurveTo(w * 1.05, y0 + h * 0.52, w * 1.25, y0 + h * 0.22, w * 0.55, y0);
    sh.closePath(); return sh;
  };
  const setUV = (g, k) => { const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) * k, p.getY(i) * k); return g; };
  B.add('vault', setUV(new THREE.ExtrudeGeometry(ogee(4.6, 12.2, 0.6), { depth: 0.5, bevelEnabled: false, curveSegments: 24 }), 0.28), xf(0, 0, cz - 0.95));
  B.add('goldRelief', setUV(new THREE.ExtrudeGeometry(ogee(2.5, 8.6, 1.0), { depth: 0.2, bevelEnabled: false, curveSegments: 24 }), 0.5), xf(0, 0, cz - 0.5));
  // glowing arch
  const M = xf(0, 0, cz + 0.25, PI);
  const out = archOutline(0, 2.7, 1.1, 4.4, 2.9, 14);
  const gg = new THREE.ShapeGeometry(new THREE.Shape(out));
  const pos = gg.attributes.position, uv = gg.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + 1.35) / 2.7, (pos.getY(i) - 1.1) / 6.2);
  B.add('glassThrone', gg, M.clone());
  B.add('gold', tube(archOutline(0, 2.8, 1.05, 4.4, 2.98, 14).map(p => V3(p.x, p.y, -0.03)), 0.07, { radial: 6, segs: 70 }), M.clone());
  B.add('marble', tube(archOutline(0, 3.2, 0.95, 4.4, 3.3, 14).map(p => V3(p.x, p.y, -0.02)), 0.17, { radial: 8, segs: 70 }), M.clone());
  // seat
  const sz = -36.4;
  B.add('marble', new THREE.BoxGeometry(1.7, 0.6, 1.3), xf(0, top + 0.3, sz));
  B.add('gold', new THREE.BoxGeometry(1.76, 0.05, 1.36), xf(0, top + 0.6, sz));
  const back = new THREE.ExtrudeGeometry(new THREE.Shape(archOutline(0, 1.6, 0, 2.6, 1.5, 10)), { depth: 0.22, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 });
  B.add('marble', back, xf(0, top + 0.6, sz - 0.7));
  B.add('gold', tube(archOutline(0, 1.3, 0.1, 2.5, 1.2, 10).map(p => V3(p.x, p.y, 0.28)), 0.03, { radial: 5, segs: 50 }), xf(0, top + 0.6, sz - 0.7));
  for (const s of [-1, 1]) {
    B.add('marble', new THREE.BoxGeometry(0.22, 0.6, 1.2), xf(s * 0.85, top + 0.9, sz));
    B.add('gold', new THREE.SphereGeometry(0.13, 12, 10), xf(s * 0.85, top + 1.28, sz + 0.52));
  }
  lights.push({ p: V3(0, 4.0, -36.2), color: 0xffcf9a, intensity: 38, distance: 30 });
  lights.push({ p: V3(0, 11, -34.5), color: 0xffe6c4, intensity: 120, distance: 30 });
}

function figure(B, x, z) {
  B.add('cloth', lathe([[0.001, 1.62], [0.14, 1.58], [0.2, 1.4], [0.17, 1.25], [0.26, 1.0], [0.3, 0.5], [0.42, 0.02], [0.0, 0.0]], 16), xf(x, 0, z));
  B.add('cloth', new THREE.SphereGeometry(0.15, 14, 10), xf(x, 1.63, z));
}

// ------------------------------------------------------------------ ivy
function buildIvy(curves, leafMat, B) {
  const R = rng(4242);
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0); leafShape.lineTo(0.3, 0.12); leafShape.lineTo(0.52, 0.4); leafShape.lineTo(0.3, 0.52); leafShape.lineTo(0.22, 0.78); leafShape.lineTo(0, 1);
  leafShape.lineTo(-0.22, 0.78); leafShape.lineTo(-0.3, 0.52); leafShape.lineTo(-0.52, 0.4); leafShape.lineTo(-0.3, 0.12); leafShape.closePath();
  const lg = new THREE.ShapeGeometry(leafShape);
  const mats = [], cols = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sv = V3(), pv = V3(), col = new THREE.Color();
  const tmp = V3();
  for (const { rc, s } of curves) {
    let u = 0.01;
    while (u < 0.99) {
      u += 0.008 + R() * 0.032;
      if (R() < 0.3) u += 0.03 + R() * 0.05; // gaps
      const nS = 7 + (R() * 12 | 0), big = R();
      for (let k = 0; k < nS; k++) {
        const uu = Math.min(0.995, u + (R() - 0.5) * 0.022);
        rc.getPointAt(uu, tmp);
        // start on the rail / fascia, nave side
        let x = tmp.x - s * (0.45 + R() * 0.35), y = GY + (R() < 0.45 ? 0.2 + R() * 1.0 : -0.1 + R() * 0.3), z = tmp.z;
        const len = (0.8 + R() * R() * 3.6) * (0.6 + big * 0.8) + (y - GY);
        const n = Math.floor(len / 0.055);
        const stem = [];
        let dx = 0, dzz = 0;
        for (let i = 0; i < n; i++) {
          const t = i / n;
          dx += (R() - 0.5) * 0.02; dzz += (R() - 0.5) * 0.02;
          const px = x + dx - s * 0.1 * Math.sin(t * 2.0), py = y - t * len, pz = z + dzz;
          if (i % 6 === 0) stem.push(V3(px, py, pz));
          const jit = 0.07 + 0.18 * (1 - t) * (y > GY ? 1 : 0.6);
          const cnt = t < 0.35 ? 3 : (t < 0.7 ? 2 : 1);
          for (let c = 0; c < cnt; c++) {
            pv.set(px + (R() - 0.5) * jit * 2, py + (R() - 0.5) * 0.08, pz + (R() - 0.5) * jit * 2);
            e.set(-0.3 - R() * 1.5, R() * TAU, (R() - 0.5) * 1.2, 'YXZ');
            q.setFromEuler(e);
            const sc = (0.11 + R() * 0.11) * (1 - t * 0.35);
            sv.set(sc, sc, sc);
            m.compose(pv, q, sv); mats.push(m.clone());
            const hh = 0.24 + R() * 0.1, ll = 0.07 + R() * 0.13 + (R() < 0.06 ? 0.12 : 0);
            col.setHSL(hh, 0.5 + R() * 0.25, ll); cols.push(col.clone());
          }
        }
        if (stem.length > 2) B.add('stem', tube(stem, 0.008, { radial: 3, segs: stem.length }));
      }
    }
  }
  const mesh = new THREE.InstancedMesh(lg, leafMat, mats.length);
  mats.forEach((mm, i) => { mesh.setMatrixAt(i, mm); mesh.setColorAt(i, cols[i]); });
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  mesh.name = 'ivy';
  return mesh;
}

// ------------------------------------------------------------------ assemble
export function buildHall(materials) {
  const B = new Builder();
  const lanterns = [], lights = [];
  const nB = ZL.length - 1;

  // floor
  const fi = materials._floorInfo;
  const fg = new THREE.PlaneGeometry(2 * HX + 6, 96, 1, 1).rotateX(-PI / 2).translate(0, 0, -2);
  { const p = fg.attributes.position, uv = fg.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / fi.tileX, (p.getZ(i) - CROSS_Z) / fi.tileZ); }
  const floor = new THREE.Mesh(fg, materials.floor); floor.receiveShadow = true; floor.name = 'floor';

  // columns
  let seed = 1;
  for (let k = 0; k < ZL.length; k++) for (const s of [-1, 1]) column(B, s * NX, ZL[k], { seed: seed++, dir: s });

  // vaults + ribs
  let dome;
  for (let k = 0; k < nB; k++) {
    const z1 = ZL[k], z0 = ZL[k + 1], crossing = (z1 - z0) > 12;
    vaultBay(B, -HX, -NX, z0, z1); vaultBay(B, NX, HX, z0, z1);
    if (crossing) dome = crossingDome(B); else vaultBay(B, -NX, NX, z0, z1);
    for (const s of [-1, 1]) {
      archRib(B, s * NX, z0, s * NX, z1, crossing ? 0.55 : 0.42);
      archRib(B, s * (HX - 0.12), z0, s * (HX - 0.12), z1, 0.24, false);
    }
  }
  for (let k = 0; k < ZL.length; k++) {
    const z = ZL[k], great = (k === 3 || k === 4 || k === 6);
    const zz = k === 0 ? z - 0.15 : z;
    archRib(B, -NX, zz, NX, zz, great ? 0.55 : 0.36);
    for (const s of [-1, 1]) archRib(B, s * NX, zz, s * HX, zz, 0.3);
  }

  // side walls
  for (let k = 0; k < nB; k++) {
    const z1 = ZL[k], z0 = ZL[k + 1], len = z1 - z0, zc = (z0 + z1) / 2;
    const cxs = len > 12 ? [-4.5, 4.5] : [0];
    const wins = [...cxs.map(upWin), ...cxs.map(lowWin)];
    wall(B, wallMatrix(-HX, zc, -1, 0), len + 0.02, wins, ['glassSunTall', 'glassSunLow']);
    wall(B, wallMatrix(HX, zc, 1, 0), len + 0.02, wins, ['glassShadeTall', 'glassShadeLow']);
  }
  // wall piers / shafts
  for (let k = 1; k < ZL.length - 1; k++) for (const s of [-1, 1]) {
    const x = s * (HX - 0.3), z = ZL[k];
    column(B, x, z, { H: GY - 0.55, R: 0.62, capR: 1.25, k: 3, seed: 50 + k * 2 + s, dir: -s, fine: false });
    B.add('marble', new THREE.CylinderGeometry(0.5, 0.52, SPRING - GY - 0.9, 24).translate(0, (SPRING + GY - 0.9) / 2, 0), xf(x, 0, z));
    B.add('marble', lathe([[0.72, 0], [0.72, 0.2], [0.6, 0.3], [0.56, 0.5], [0.52, 0.6]], 24), xf(x, GY, z));
    B.add('goldRelief', lathe([[0.52, 0], [0.56, 0.08], [0.6, 0.5], [0.84, 0.82], [0.88, 0.9]], 24), xf(x, SPRING - 1.0, z));
    B.add('marble', lathe([[0.9, 0], [0.92, 0.06], [0.92, 0.14], [0.8, 0.18], [0, 0.18]], 24), xf(x, SPRING - 0.1, z));
    B.add('gold', new THREE.TorusGeometry(0.535, 0.03, 5, 24).rotateX(PI / 2), xf(x, SPRING - 1.05, z));
  }
  // plinths
  for (const s of [-1, 1]) {
    B.add('marble', new THREE.BoxGeometry(0.5, 0.95, ZL[0] - APSE_Z), xf(s * (HX - 0.1), 0.475, (ZL[0] + APSE_Z) / 2));
    B.add('gold', new THREE.BoxGeometry(0.06, 0.05, ZL[0] - APSE_Z), xf(s * (HX - 0.36), 0.97, (ZL[0] + APSE_Z) / 2));
  }

  // friezes along the side walls
  for (const s of [-1, 1]) {
    const len = ZL[0] - APSE_Z, zc = (ZL[0] + APSE_Z) / 2;
    const strip = (key, y, h, d, k) => {
      const g = new THREE.BoxGeometry(d, h, len);
      const p = g.attributes.position, uv = g.attributes.uv;
      for (let i = 0; i < p.count; i++) uv.setXY(i, p.getZ(i) * k, p.getY(i) * k);
      B.add(key, g, xf(s * (HX - d / 2 + 0.02), y, zc));
    };
    strip('vault', 8.3, 0.8, 0.14, 0.42);
    strip('gold', 7.86, 0.05, 0.2, 1); strip('gold', 8.74, 0.05, 0.2, 1);
    strip('marble', 8.84, 0.12, 0.3, 1);
    strip('goldRelief', 6.5, 0.36, 0.1, 0.9);
    strip('marble', 6.74, 0.1, 0.22, 1); strip('marble', 6.27, 0.08, 0.18, 1);
  }

  // east end: apse + aisle end walls
  apse(B);
  for (const s of [-1, 1]) {
    wall(B, wallMatrix(s * 15.5, APSE_Z, 0, -1), 13.3, [upWin(0), lowWin(0)], s < 0 ? ['glassSunTall', 'glassSunLow'] : ['glassShadeTall', 'glassShadeLow']);
  }
  throne(B, lights);

  // west end
  const door = { cx: 0, w: 4.6, y0: 0, ys: 3.8, rise: 2.6 };
  wall(B, wallMatrix(0, ZL[0], 0, 1), 18.4, [{ cx: 0, w: 9, y0: 9.6, ys: 14.5, rise: 7, n: 5 }], ['glassShadeTall', 'glassShadeLow'], [door]);
  {
    const M = wallMatrix(0, ZL[0], 0, 1);
    B.add('bronze', new THREE.ExtrudeGeometry(new THREE.Shape(archOutline(0, 4.7, 0, 3.8, 2.65)), { depth: 0.2, bevelEnabled: false }).translate(0, 0, 0.6), M.clone());
    B.add('marble', tube(archOutline(0, 5.0, 0, 3.8, 2.85).map(p => V3(p.x, p.y, -0.02)), 0.2, { radial: 8, segs: 60 }), M.clone());
    B.add('gold', tube(archOutline(0, 5.6, 0, 3.8, 3.2).map(p => V3(p.x, p.y, 0)), 0.05, { radial: 5, segs: 60 }), M.clone());
    B.add('gold', new THREE.BoxGeometry(0.06, 6.3, 0.1), M.clone().multiply(xf(0, 3.15, 0.56)));
  }
  for (const s of [-1, 1]) wall(B, wallMatrix(s * 15.5, ZL[0], 0, 1), 13.3, [upWin(0), lowWin(0)], ['glassShadeTall', 'glassShadeLow']);

  // galleries, lanterns
  const curves = [];
  for (const s of [-1, 1]) curves.push({ rc: gallery(B, s, lanterns), s });
  lanterns.forEach(L => lantern(B, L));

  figure(B, -5.2, -16.5);

  const ivy = buildIvy(curves, materials.leaf, B);

  const noShadow = ['glassSunTall', 'glassSunLow', 'glassShadeTall', 'glassShadeLow', 'glassSky', 'glassDome', 'glassThrone', 'lanternGlass'];
  const meshes = B.build(materials, noShadow);
  const group = new THREE.Group();
  Object.values(meshes).forEach(m => group.add(m));
  group.add(floor, ivy);
  const glass = noShadow.map(k => meshes[k]).filter(Boolean);
  return { group, floor, ivy, glass, lanterns, lights, dome, tris: B.tris, meshes };
}
