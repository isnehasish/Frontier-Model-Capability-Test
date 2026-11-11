// Procedural textures: 3D noise, stained glass, carved filigree, floor inlay.
import * as THREE from 'three';
import { rng, TAU } from './geo.js';

const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

function canvasTex(c, srgb = true, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 16;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

export function noise3D(size = 64) {
  const R = rng(1234), data = new Uint8Array(size * size * size);
  for (let i = 0; i < data.length; i++) data[i] = (R() * 256) | 0;
  const t = new THREE.Data3DTexture(data, size, size, size);
  t.format = THREE.RedFormat; t.type = THREE.UnsignedByteType;
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = t.wrapR = THREE.RepeatWrapping;
  t.unpackAlignment = 1; t.needsUpdate = true;
  return t;
}

// ---------------------------------------------------------------- stained glass
const LEAD = 'rgba(96,78,40,0.92)';
const GOLDLEAD = '#d9b65a';

function whip(g, R, x, y, ang, len, curl, wid, leaves) {
  // art-nouveau whiplash: a curve that tightens into a spiral
  const pts = [[x, y]];
  const n = 46;
  let a = ang, cx = x, cy = y;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    a += curl * (0.25 + 3.2 * t * t * t) / n * 6;
    const st = len / n * (1 - 0.55 * t);
    cx += Math.cos(a) * st; cy += Math.sin(a) * st;
    pts.push([cx, cy]);
  }
  const path = () => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts) g.lineTo(p[0], p[1]); };
  g.lineCap = 'round'; g.lineJoin = 'round';
  path(); g.strokeStyle = LEAD; g.lineWidth = wid + 7; g.stroke();
  path(); g.strokeStyle = GOLDLEAD; g.lineWidth = wid; g.stroke();
  if (leaves) {
    for (let i = 8; i < n; i += 5) {
      const p = pts[i], q = pts[i - 1];
      const dir = Math.atan2(p[1] - q[1], p[0] - q[0]);
      for (const sd of [-1, 1]) {
        if (R() < 0.25) continue;
        const la = dir + sd * (0.9 + R() * 0.5), L = leaves * (0.7 + R() * 0.7);
        leaf(g, R, p[0], p[1], la, L);
      }
    }
  }
  return pts[pts.length - 1];
}

function leaf(g, R, x, y, a, L) {
  const hues = [[98, 46, 60], [82, 52, 64], [120, 38, 58], [52, 82, 68], [44, 88, 72], [150, 36, 66]];
  const h = hues[(R() * hues.length) | 0];
  g.save(); g.translate(x, y); g.rotate(a);
  g.beginPath(); g.moveTo(0, 0);
  g.bezierCurveTo(L * 0.3, -L * 0.36, L * 0.8, -L * 0.22, L, 0);
  g.bezierCurveTo(L * 0.8, L * 0.22, L * 0.3, L * 0.36, 0, 0);
  g.fillStyle = `hsl(${h[0]},${h[1]}%,${h[2] + (R() * 10 - 5)}%)`; g.fill();
  g.strokeStyle = LEAD; g.lineWidth = 3; g.stroke();
  g.beginPath(); g.moveTo(0, 0); g.lineTo(L * 0.9, 0); g.lineWidth = 1.5; g.stroke();
  g.restore();
}

function star(g, x, y, r, n = 8) {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = i / (n * 2) * TAU - Math.PI / 2, rr = i % 2 ? r * 0.32 : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath(); g.fillStyle = '#fffbe0'; g.fill(); g.strokeStyle = GOLDLEAD; g.lineWidth = 3; g.stroke();
}

export function stainedGlass(w, h, seed, warm = 0) {
  const c = mk(w, h), g = c.getContext('2d');
  const R0 = rng(seed);
  const gr = g.createLinearGradient(0, 0, 0, h);
  if (warm) { gr.addColorStop(0, '#fff3cf'); gr.addColorStop(0.5, '#fffaf0'); gr.addColorStop(1, '#ffe2a8'); }
  else { gr.addColorStop(0, '#d9ecff'); gr.addColorStop(0.4, '#f6fbff'); gr.addColorStop(0.72, '#fffbea'); gr.addColorStop(1, '#e3f3d2'); }
  g.fillStyle = gr; g.fillRect(0, 0, w, h);

  // leaded quarries (diamond lattice) with subtle per-pane tint
  const s = w / 8, sy = s * 1.5;
  for (let j = -1; j < h / sy * 2 + 2; j++) for (let i = -1; i < w / s + 1; i++) {
    const cx = i * s + (j % 2 ? s / 2 : 0), cy = j * sy / 2;
    g.beginPath(); g.moveTo(cx, cy - sy / 2); g.lineTo(cx + s / 2, cy); g.lineTo(cx, cy + sy / 2); g.lineTo(cx - s / 2, cy); g.closePath();
    const r = R0();
    const hue = warm ? 38 + r * 20 : (r < 0.45 ? 195 + r * 30 : (r < 0.85 ? 48 : 105));
    g.fillStyle = `hsla(${hue},${55 + r * 30}%,${70 + R0() * 18}%,${0.4 + R0() * 0.45})`; g.fill();
    g.strokeStyle = 'rgba(105,88,48,0.75)'; g.lineWidth = 3; g.stroke();
  }

  // glowing mandorla behind the tree
  g.save(); g.translate(w / 2, h * 0.5); g.scale(1, h / w * 0.82);
  const rg = g.createRadialGradient(0, 0, 0, 0, 0, w * 0.46);
  rg.addColorStop(0, 'rgba(255,250,224,0.8)'); rg.addColorStop(0.7, 'rgba(255,242,196,0.35)'); rg.addColorStop(1, 'rgba(255,230,150,0)');
  g.fillStyle = rg; g.beginPath(); g.arc(0, 0, w * 0.46, 0, TAU); g.fill();
  g.restore();

  // mirrored tree of whiplash curves
  for (const side of [1, -1]) {
    const R = rng(seed + 7);
    g.save();
    if (side < 0) { g.translate(w, 0); g.scale(-1, 1); }
    const X = w / 2;
    // trunk half
    g.beginPath(); g.moveTo(X + 4, h); g.bezierCurveTo(X + 30, h * 0.8, X + 6, h * 0.6, X + 10, h * 0.3);
    g.strokeStyle = LEAD; g.lineWidth = 20; g.stroke(); g.strokeStyle = GOLDLEAD; g.lineWidth = 12; g.stroke();
    const nb = Math.max(4, Math.round(h / w * 3.2));
    for (let i = 0; i < nb; i++) {
      const t = (i + 0.4) / nb, y = h * (0.94 - t * 0.66);
      const len = w * (0.62 - 0.16 * t) * (0.9 + R() * 0.3);
      whip(g, R, X + 8, y, -Math.PI / 2 + 0.55 + R() * 0.5, len, 0.9 + R() * 0.5, 7, w * 0.085);
      if (i % 2 === 0) whip(g, R, X + 8, y + h * 0.04, -0.15 + R() * 0.3, len * 0.8, -(1.0 + R() * 0.5), 5, w * 0.07);
    }
    // crown arcs
    whip(g, R, X + 10, h * 0.3, -Math.PI / 2 + 0.2, w * 0.55, 1.5, 7, w * 0.08);
    whip(g, R, X + 10, h * 0.36, -Math.PI / 2 + 0.9, w * 0.5, -1.2, 5, w * 0.07);
    // long outer stem
    g.beginPath(); g.moveTo(X + w * 0.1, h); g.bezierCurveTo(X + w * 0.5, h * 0.75, X + w * 0.25, h * 0.4, X + w * 0.36, h * 0.12);
    g.strokeStyle = LEAD; g.lineWidth = 9; g.stroke(); g.strokeStyle = GOLDLEAD; g.lineWidth = 4.5; g.stroke();
    g.restore();
  }
  star(g, w / 2, h * 0.2, w * 0.1);
  star(g, w / 2, h * 0.2, w * 0.045, 4);
  const R2 = rng(seed + 99);
  for (let i = 0; i < 7; i++) star(g, w * (0.15 + R2() * 0.7), h * (0.08 + R2() * 0.8), w * (0.015 + R2() * 0.02), 4);

  // border
  g.strokeStyle = LEAD; g.lineWidth = 34; g.strokeRect(17, 17, w - 34, h - 34);
  g.strokeStyle = '#f0c860'; g.lineWidth = 22; g.strokeRect(17, 17, w - 34, h - 34);
  g.strokeStyle = LEAD; g.lineWidth = 3; g.strokeRect(34, 34, w - 68, h - 68);
  return canvasTex(c, true, false);
}

// ---------------------------------------------------------------- carved filigree
// Returns {bump, color}: tileable relief of scrolls.
export function filigree(size = 1024, seed = 5, goldish = false) {
  const hc = mk(size, size), g = hc.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, size, size);
  const cell = size / 4;
  const paths = [];
  const scroll = (cx, cy, r, a0, dir) => {
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40, a = a0 + dir * t * 4.4, rr = r * (1 - t * 0.86);
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    paths.push(pts);
  };
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    const cx = (i + 0.5) * cell, cy = (j + 0.5) * cell, m = (i + j) % 2 ? 1 : -1;
    scroll(cx - cell * 0.2 * m, cy - cell * 0.08, cell * 0.3, m > 0 ? 0 : Math.PI, m);
    scroll(cx + cell * 0.22 * m, cy + cell * 0.2, cell * 0.22, m > 0 ? Math.PI : 0, m);
    scroll(cx + cell * 0.05, cy - cell * 0.3, cell * 0.15, Math.PI / 2, -m);
    // leaf blades
    const pts = [];
    for (let k = 0; k <= 12; k++) { const t = k / 12; pts.push([cx - cell * 0.5 + t * cell, cy + cell * 0.5 + Math.sin(t * TAU) * cell * 0.09 * m]); }
    paths.push(pts);
    const p2 = [];
    for (let k = 0; k <= 12; k++) { const t = k / 12; p2.push([cx + cell * 0.5 + Math.sin(t * TAU) * cell * 0.07 * m, cy - cell * 0.5 + t * cell]); }
    paths.push(p2);
  }
  g.lineCap = 'round'; g.lineJoin = 'round';
  const layers = [[cell * 0.085, 60], [cell * 0.06, 120], [cell * 0.038, 190], [cell * 0.016, 255]];
  for (const [lw, v] of layers) {
    g.strokeStyle = `rgb(${v},${v},${v})`; g.lineWidth = lw;
    for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
      for (const pts of paths) {
        g.beginPath();
        pts.forEach((p, i) => i ? g.lineTo(p[0] + ox * size, p[1] + oy * size) : g.moveTo(p[0] + ox * size, p[1] + oy * size));
        g.stroke();
      }
    }
    // rosettes
    g.fillStyle = g.strokeStyle;
    for (let j = 0; j <= 4; j++) for (let i = 0; i <= 4; i++) {
      g.beginPath(); g.arc(i * cell, j * cell, lw * 1.25, 0, TAU); g.fill();
    }
  }
  const src = g.getImageData(0, 0, size, size).data;
  const cc = mk(size, size), g2 = cc.getContext('2d');
  const img = g2.createImageData(size, size), d = img.data;
  for (let i = 0; i < size * size; i++) {
    const hgt = src[i * 4] / 255;
    if (goldish) {
      const k = 0.55 + 0.45 * hgt;
      d[i * 4] = 255 * k; d[i * 4 + 1] = 198 * k; d[i * 4 + 2] = 92 * k;
    } else {
      const k = 0.80 + 0.20 * hgt;
      d[i * 4] = 255 * k; d[i * 4 + 1] = (250 - 14 * hgt) * k; d[i * 4 + 2] = (240 - 52 * hgt) * k;
    }
    d[i * 4 + 3] = 255;
  }
  g2.putImageData(img, 0, 0);
  return { bump: canvasTex(hc, false), color: canvasTex(cc, true) };
}

// ---------------------------------------------------------------- floor inlay
// One 24 m tile, mirrored-repeat. Tile origin = centre under the dome.
export function floorInlay(size = 4096) {
  const T = 24, TZ = 20, k = size / T, kz = size / TZ;
  const cc = mk(size, size), cm = mk(size, size);
  const gc = cc.getContext('2d'), gm = cm.getContext('2d');
  gc.fillStyle = '#ffffff'; gc.fillRect(0, 0, size, size);
  gm.fillStyle = 'rgb(0,26,0)'; gm.fillRect(0, 0, size, size); // G = roughness, B = metalness
  const STY = {
    gold: ['#e9b24c', 'rgb(0,74,255)'],
    dark: ['#2b2927', 'rgb(0,22,0)'],
    grey: ['#8f8b88', 'rgb(0,26,0)'],
    warm: ['#d8c9b0', 'rgb(0,26,0)'],
    white: ['#ffffff', 'rgb(0,26,0)'],
  };
  for (const g of [gc, gm]) { g.setTransform(k, 0, 0, kz, 0, 0); g.lineCap = 'round'; g.lineJoin = 'round'; }
  const stroke = (fn, lw, sty) => { [gc, gm].forEach((g, i) => { g.beginPath(); fn(g); g.strokeStyle = STY[sty][i]; g.lineWidth = lw; g.stroke(); }); };
  const fill = (fn, sty) => { [gc, gm].forEach((g, i) => { g.beginPath(); fn(g); g.fillStyle = STY[sty][i]; g.fill(); }); };
  const circ = (x, y, r) => g => g.arc(x, y, r, 0, TAU);
  const ring = (x, y, r, lw, sty) => stroke(circ(x, y, r), lw, sty);
  const dbl = (fn, sty2 = 'dark') => { stroke(fn, 0.34, sty2); stroke(fn, 0.11, 'gold'); };
  const spiral = (cx, cy, r0, r1, a0, turns) => g => {
    for (let i = 0; i <= 120; i++) {
      const t = i / 120, a = a0 + t * turns * TAU, r = r0 + (r1 - r0) * t;
      g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
  };

  // long borders (run the length of the hall)
  fill(g => g.rect(6.55, 0, 0.5, TZ), 'dark');
  stroke(g => { g.moveTo(7.3, 0); g.lineTo(7.3, TZ); }, 0.09, 'gold');
  stroke(g => { g.moveTo(6.3, 0); g.lineTo(6.3, TZ); }, 0.07, 'gold');
  fill(g => g.rect(11.2, 0, 0.28, TZ), 'grey');
  stroke(g => { g.moveTo(11.75, 0); g.lineTo(11.75, TZ); }, 0.07, 'gold');
  fill(g => g.rect(19.6, 0, 0.45, TZ), 'dark');
  stroke(g => { g.moveTo(19.3, 0); g.lineTo(19.3, TZ); }, 0.08, 'gold');

  // flowing whiplash bands across the nave
  dbl(g => { g.moveTo(0, 12.5); g.bezierCurveTo(3, 9.5, 5, 15.5, 6.3, 11.5); });
  dbl(g => { g.moveTo(0, 17.2); g.bezierCurveTo(2.5, 19.5, 4.5, 14.8, 6.3, 18.6); }, 'grey');
  stroke(spiral(3.4, 14.6, 0.25, 2.3, 0.6, 2.1), 0.09, 'gold');
  stroke(spiral(3.4, 14.6, 0.5, 2.6, 0.6 + Math.PI, 1.6), 0.16, 'dark');

  // column rings (columns sit at x = 9, tile z = 9 & 20)
  for (const cz of [9, 20]) {
    fill(circ(9, cz, 3.25), 'white');
    ring(9, cz, 3.2, 0.3, 'dark'); ring(9, cz, 2.82, 0.09, 'gold'); ring(9, cz, 3.6, 0.07, 'gold');
  }

  // aisle: scrolls
  for (const cz of [3.5, 14.5]) {
    stroke(spiral(15.6, cz, 0.2, 2.6, 1.0, 2.2), 0.09, 'gold');
    stroke(spiral(15.6, cz, 0.6, 3.0, 1.0 + Math.PI, 1.7), 0.15, 'grey');
  }
  dbl(g => { g.moveTo(11.9, 9); g.bezierCurveTo(14, 6.5, 17, 11.5, 19.2, 9); });
  dbl(g => { g.moveTo(11.9, 20); g.bezierCurveTo(14, 22.5, 17, 17.5, 19.2, 20); }, 'grey');

  // great medallion under the dome (tile corner 0,0)
  fill(circ(0, 0, 8.4), 'white');
  ring(0, 0, 8.4, 0.42, 'dark'); ring(0, 0, 7.95, 0.1, 'gold'); ring(0, 0, 8.85, 0.08, 'gold');
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * TAU, a2 = a + TAU / 16;
    stroke(g => {
      g.moveTo(Math.cos(a) * 2.7, Math.sin(a) * 2.7);
      g.quadraticCurveTo(Math.cos(a + 0.5) * 6.2, Math.sin(a + 0.5) * 6.2, Math.cos(a2 + 0.42) * 7.7, Math.sin(a2 + 0.42) * 7.7);
    }, 0.1, 'gold');
    stroke(g => {
      g.moveTo(Math.cos(a) * 2.7, Math.sin(a) * 2.7);
      g.quadraticCurveTo(Math.cos(a - 0.5) * 6.2, Math.sin(a - 0.5) * 6.2, Math.cos(a2 - 0.6) * 7.7, Math.sin(a2 - 0.6) * 7.7);
    }, 0.13, 'dark');
  }
  ring(0, 0, 5.3, 0.22, 'grey'); ring(0, 0, 5.0, 0.07, 'gold');
  fill(circ(0, 0, 2.6), 'dark'); ring(0, 0, 2.6, 0.16, 'gold'); ring(0, 0, 1.5, 0.07, 'gold');
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU;
    stroke(g => { g.moveTo(0, 0); g.lineTo(Math.cos(a) * 2.45, Math.sin(a) * 2.45); }, i % 2 ? 0.05 : 0.09, 'gold');
  }

  // secondary medallion on the nave axis (tile edge 0,20)
  fill(circ(0, 20, 4.3), 'white');
  ring(0, 20, 4.3, 0.3, 'dark'); ring(0, 20, 3.9, 0.09, 'gold');
  fill(circ(0, 20, 1.7), 'warm'); ring(0, 20, 1.7, 0.12, 'gold');
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * TAU;
    stroke(g => { g.moveTo(Math.cos(a) * 1.8, 20 + Math.sin(a) * 1.8); g.quadraticCurveTo(Math.cos(a + 0.5) * 3, 20 + Math.sin(a + 0.5) * 3, Math.cos(a + 0.26) * 3.8, 20 + Math.sin(a + 0.26) * 3.8); }, 0.08, 'gold');
  }

  const color = canvasTex(cc, true), orm = canvasTex(cm, false);
  color.wrapS = color.wrapT = orm.wrapS = orm.wrapT = THREE.MirroredRepeatWrapping;
  return { color, orm, tileX: T, tileZ: TZ };
}
