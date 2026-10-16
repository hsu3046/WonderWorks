// ---------------------------------------------------------------------------
// Procedural foliage textures (drawn on canvases at load time — no assets).
//   - maple leaf atlas   (data: R shade/veins, G base->tip gradient, B blotch, A coverage)
//   - pine needle atlas  (data: R shade, G along-needle gradient, B per-needle tint, A coverage)
//   - cherry blossom atlas (sRGB colour + alpha)
//   - shrub atlas        (sRGB colour + alpha: azalea leaves, azalea in flower, boxwood, fern)
// Each atlas gets colour dilation under transparent texels and a coverage-
// preserving alpha mip chain so alpha-tested canopies keep their density at
// distance (no thinning / disappearing trees).
// ---------------------------------------------------------------------------
import * as THREE from 'three';

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}

const TAU = Math.PI * 2;

// ----------------------------------------------------------------- utilities
function hash2(x, y, s) {
  let n = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, s, oct = 4) {
  let r = 0, a = 0.5, n = 0;
  for (let i = 0; i < oct; i++) { r += a * vnoise(x, y, s + i * 31); n += a; a *= 0.5; x *= 2.03; y *= 2.03; }
  return r / n;
}

// Fill RGB of (nearly) transparent texels from their opaque neighbours so that
// bilinear filtering / mips never pull in black fringes.
function dilate(data, w, h, passes = 10) {
  let sr = 0, sg = 0, sb = 0, sn = 0;
  for (let i = 0; i < w * h; i++) {
    if (data[i * 4 + 3] > 127) { sr += data[i * 4]; sg += data[i * 4 + 1]; sb += data[i * 4 + 2]; sn++; }
  }
  const avg = sn ? [sr / sn, sg / sn, sb / sn] : [128, 128, 128];
  const valid = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (data[i * 4 + 3] > 24) valid[i] = 1;
    else { data[i * 4] = avg[0]; data[i * 4 + 1] = avg[1]; data[i * 4 + 2] = avg[2]; }
  }
  const nv = new Uint8Array(w * h);
  for (let p = 0; p < passes; p++) {
    nv.set(valid);
    let changed = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (valid[i]) continue;
        let r = 0, g = 0, b = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy; if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx; if (xx < 0 || xx >= w) continue;
            const j = yy * w + xx;
            if (valid[j]) { r += data[j * 4]; g += data[j * 4 + 1]; b += data[j * 4 + 2]; n++; }
          }
        }
        if (n) { data[i * 4] = r / n; data[i * 4 + 1] = g / n; data[i * 4 + 2] = b / n; nv[i] = 1; changed++; }
      }
    }
    valid.set(nv);
    if (!changed) break;
  }
}

function coverageOf(data, n, scale, ref = 127.5) {
  let c = 0;
  for (let i = 0; i < n; i++) if (data[i * 4 + 3] * scale > ref) c++;
  return c / n;
}

// Build a full mip chain; alpha of each level is rescaled so the fraction of
// texels passing the 0.5 alpha test stays equal to level 0 (Castaño 2010).
function buildMips(data, w, h, linearRGB = false) {
  const mips = [{ data, width: w, height: h }];
  const cov0 = coverageOf(data, w * h, 1);
  let prev = data, pw = w, ph = h;
  const toLin = (v) => Math.pow(v / 255, 2.2), toS = (v) => Math.round(255 * Math.pow(Math.max(0, v), 1 / 2.2));
  while (pw > 1 || ph > 1) {
    const nw = Math.max(1, pw >> 1), nh = Math.max(1, ph >> 1);
    const out = new Uint8Array(nw * nh * 4);
    for (let y = 0; y < nh; y++) {
      for (let x = 0; x < nw; x++) {
        let r = 0, g = 0, b = 0, a = 0, wsum = 0, rr = 0, gg = 0, bb = 0;
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const sx = Math.min(pw - 1, x * 2 + dx), sy = Math.min(ph - 1, y * 2 + dy);
            const j = (sy * pw + sx) * 4;
            const al = prev[j + 3] / 255;
            const cr = linearRGB ? prev[j] : toLin(prev[j]), cg = linearRGB ? prev[j + 1] : toLin(prev[j + 1]), cb = linearRGB ? prev[j + 2] : toLin(prev[j + 2]);
            r += cr * al; g += cg * al; b += cb * al; wsum += al; a += prev[j + 3];
            rr += cr; gg += cg; bb += cb;
          }
        }
        const i = (y * nw + x) * 4;
        if (wsum > 1e-3) { r /= wsum; g /= wsum; b /= wsum; } else { r = rr / 4; g = gg / 4; b = bb / 4; }
        out[i] = linearRGB ? Math.round(r) : toS(r);
        out[i + 1] = linearRGB ? Math.round(g) : toS(g);
        out[i + 2] = linearRGB ? Math.round(b) : toS(b);
        out[i + 3] = Math.round(a / 4);
      }
    }
    // coverage preserving alpha scale
    const n = nw * nh;
    if (cov0 > 0 && n >= 4) {
      let lo = 0.5, hi = 6.0;
      for (let it = 0; it < 14; it++) {
        const mid = (lo + hi) * 0.5;
        if (coverageOf(out, n, mid) < cov0) lo = mid; else hi = mid;
      }
      const s = (lo + hi) * 0.5;
      for (let i = 0; i < n; i++) out[i * 4 + 3] = Math.min(255, Math.round(out[i * 4 + 3] * s));
    }
    mips.push({ data: out, width: nw, height: nh });
    prev = out; pw = nw; ph = nh;
  }
  return mips;
}

function finalizeTexture(data, w, h, { srgb = false, anisotropy = 8 } = {}) {
  dilate(data, w, h, 12);
  const mips = buildMips(data, w, h, !srgb);
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.mipmaps = mips;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = anisotropy;
  tex.flipY = false;
  tex.needsUpdate = true;
  return tex;
}

// copy a canvas' pixels (with rows top->bottom => v = 0 at the top of the image)
function readCanvas(cv) {
  const g = cv.getContext('2d');
  return g.getImageData(0, 0, cv.width, cv.height).data;
}

// ===========================================================================
// MAPLE (Acer palmatum) leaf atlas — 2x2 cells
// ===========================================================================
// Leaf frame inside a cell (cell size S): petiole end at (0.5, 1.0)*S (bottom
// centre), blade attachment point O at (0.5, 0.57)*S, lobe radius R=0.40*S.
export const MAPLE_LEAF = { ox: 0.5, oy: 0.56, R: 0.43 };

function mapleLobes(variant) {
  // [angleDeg, lengthFactor] ; angle measured from "up" (towards the top of the cell)
  if (variant === 2) { // 5 lobed, broad (young / shaded leaf)
    return { lobes: [[-104, 0.6], [-52, 0.9], [0, 1.0], [52, 0.9], [104, 0.6]], W: 0.21, sin: 0.36, teeth: 15 };
  }
  if (variant === 1) { // 7 lobed, deeply cut, narrow acuminate lobes
    return { lobes: [[-124, 0.48], [-83, 0.8], [-41, 0.96], [0, 1.0], [41, 0.96], [83, 0.8], [124, 0.48]], W: 0.13, sin: 0.25, teeth: 19 };
  }
  if (variant === 3) { // 7 lobed, slightly asymmetric
    return { lobes: [[-116, 0.55], [-76, 0.84], [-37, 0.97], [2, 1.0], [40, 0.93], [80, 0.8], [119, 0.58]], W: 0.16, sin: 0.32, teeth: 17 };
  }
  return { lobes: [[-118, 0.56], [-79, 0.84], [-39, 0.96], [0, 1.0], [39, 0.96], [79, 0.84], [118, 0.56]], W: 0.165, sin: 0.32, teeth: 17 };
}

const smooth01 = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// lobe half-width profile (fraction of W*R) at t (0 = base, 1 = tip): lanceolate with an acuminate tip
const lobeW = (t) => Math.pow(Math.sin(Math.PI * Math.pow(t, 1.12)), 0.85) * (1 - 0.32 * smooth01(0.6, 1, t));

function lobePolygon(ox, oy, ang, len, W, rnd, teeth, N = 240) {
  // returns array of [x,y] in pixel coords; lobe axis from O outwards
  const a = (ang * Math.PI) / 180;
  const ax = Math.sin(a), ay = -Math.cos(a); // canvas y is down
  const px = -ay, py = ax; // perpendicular
  const left = [], right = [];
  const asym = 0.93 + rnd() * 0.14;
  const ph = [rnd(), rnd(), rnd(), rnd()];
  // doubly serrate margin: forward-pointing primary teeth (slow rise, sharp drop) + finer secondary teeth
  const tooth = (t, k, p) => { const f = t * k + p; const s = f - Math.floor(f); return Math.pow(s, 2.4); };
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const w = W * lobeW(t);
    const sm = smooth01(0.2, 0.42, t) * (1 - 0.5 * t);
    const sL = sm * (0.21 * tooth(t, teeth, ph[0]) + 0.07 * tooth(t, teeth * 2.7, ph[1]));
    const sR = sm * (0.21 * tooth(t, teeth * 1.04, ph[2]) + 0.07 * tooth(t, teeth * 2.8, ph[3]));
    const wl = w * (1 + sL) * asym, wr = w * (1 + sR) / asym;
    const s = t * len;
    left.push([ox + ax * s + px * wl, oy + ay * s + py * wl]);
    right.push([ox + ax * s - px * wr, oy + ay * s - py * wr]);
  }
  return left.concat(right.reverse());
}

// cellular (F2 - F1) for the tertiary vein network
function cellEdge(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let d1 = 9, d2 = 9;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const cx = xi + i, cy = yi + j;
      const fx = cx + 0.15 + 0.7 * hash2(cx, cy, s), fy = cy + 0.15 + 0.7 * hash2(cx, cy, s + 17);
      const dx = fx - x, dy = fy - y, d = dx * dx + dy * dy;
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
    }
  }
  return Math.sqrt(d2) - Math.sqrt(d1);
}

// Acer palmatum leaf atlas, 2x2 cells (4 leaf forms). Data channels:
//   R shade (blade tone, palmate primaries, pinnate secondaries, reticulate tertiaries, freckles)
//   G base -> tip gradient (0 on the petiole), B blotch noise, A coverage (incl. a few insect holes)
export function makeMapleAtlas(rng, size = 2048) {
  const S = size / 2;
  const shape = makeCanvas(size, size), veins = makeCanvas(size, size);
  const gs = shape.getContext('2d'), gv = veins.getContext('2d');
  gs.clearRect(0, 0, size, size);
  gv.fillStyle = '#000'; gv.fillRect(0, 0, size, size);
  gv.globalCompositeOperation = 'lighter';
  const centres = [];
  const freckles = [];
  for (let v = 0; v < 4; v++) {
    const cx0 = (v % 2) * S, cy0 = Math.floor(v / 2) * S;
    const rnd = rng.next;
    const ox = cx0 + MAPLE_LEAF.ox * S, oy = cy0 + MAPLE_LEAF.oy * S, R = MAPLE_LEAF.R * S;
    centres.push([ox, oy, R]);
    const { lobes, W, sin, teeth } = mapleLobes(v);
    gs.save();
    gs.beginPath(); gs.rect(cx0, cy0, S, S); gs.clip();
    gs.fillStyle = '#fff';
    const tips = [];
    for (const [ang, lf] of lobes) {
      const len = R * lf * (0.96 + rnd() * 0.08);
      const a2 = ang + (rnd() - 0.5) * 3;
      const Wl = R * W * (0.93 + rnd() * 0.14);
      const poly = lobePolygon(ox, oy, a2, len, Wl, rnd, teeth + Math.floor(rnd() * 3));
      gs.beginPath();
      gs.moveTo(poly[0][0], poly[0][1]);
      for (const p of poly) gs.lineTo(p[0], p[1]);
      gs.closePath(); gs.fill();
      const a = (a2 * Math.PI) / 180;
      tips.push([a, len, Wl]);
    }
    // central blade
    gs.beginPath(); gs.arc(ox, oy, R * sin, 0, TAU); gs.fill();
    // petiole
    gs.strokeStyle = '#fff'; gs.lineCap = 'round';
    gs.lineWidth = S * 0.014;
    gs.beginPath(); gs.moveTo(ox, oy); gs.quadraticCurveTo(ox + S * 0.012, oy + S * 0.2, ox + S * 0.004, cy0 + S * 0.985); gs.stroke();
    // a few insect holes (alpha cut-outs inside the blade, away from the base)
    gs.globalCompositeOperation = 'destination-out';
    const nh = v === 2 ? 1 : 1 + Math.floor(rnd() * 3);
    for (let k = 0; k < nh; k++) {
      const [a, len, Wl] = tips[1 + Math.floor(rnd() * (tips.length - 2))];
      const t = 0.45 + rnd() * 0.35, side = rnd() < 0.5 ? -1 : 1;
      const off = Wl * lobeW(t) * (0.35 + 0.3 * rnd()) * side;
      const hx = ox + Math.sin(a) * len * t + Math.cos(a) * off, hy = oy - Math.cos(a) * len * t + Math.sin(a) * off;
      const hr = S * (0.004 + rnd() * 0.006);
      gs.beginPath(); gs.ellipse(hx, hy, hr, hr * (0.6 + rnd() * 0.5), rnd() * TAU, 0, TAU); gs.fill();
    }
    gs.globalCompositeOperation = 'source-over';
    gs.restore();
    // a few dark freckles (fungal spots) on two of the forms
    if (v === 0 || v === 3) {
      for (let k = 0; k < 3; k++) {
        const [a, len] = tips[Math.floor(rnd() * tips.length)];
        const t = 0.3 + rnd() * 0.45;
        freckles.push([ox + Math.sin(a) * len * t + (rnd() - 0.5) * R * 0.05, oy - Math.cos(a) * len * t + (rnd() - 0.5) * R * 0.05, S * (0.004 + rnd() * 0.005)]);
      }
    }

    // veins (R = brightness boost, additive)
    gv.save();
    gv.beginPath(); gv.rect(cx0, cy0, S, S); gv.clip();
    gv.lineCap = 'round';
    for (const [a, len, Wl] of tips) {
      const ax = Math.sin(a), ay = -Math.cos(a), px = -ay, py = ax;
      // primary (palmate) vein: tapered, fading toward the acuminate tip
      const segs = 10;
      for (let k = 0; k < segs; k++) {
        const t0 = k / segs, t1 = (k + 1) / segs;
        gv.strokeStyle = `rgb(${Math.round(150 - k * 9)},0,0)`;
        gv.lineWidth = S * (0.0085 - k * 0.00065);
        gv.beginPath();
        gv.moveTo(ox + ax * len * t0, oy + ay * len * t0);
        gv.lineTo(ox + ax * len * t1, oy + ay * len * t1);
        gv.stroke();
      }
      // secondary veins: pinnate, curving toward the lobe tip, ending in the teeth
      const ns = 11;
      for (let k = 0; k < ns; k++) {
        const t = 0.14 + (k / ns) * 0.76 + (rnd() - 0.5) * 0.03;
        for (const sg of [-1, 1]) {
          const tt = t + (sg > 0 ? 0.025 : 0);
          const bx = ox + ax * len * tt, by = oy + ay * len * tt;
          const te = Math.min(0.98, tt + 0.09 + 0.04 * rnd());
          const we = Wl * lobeW(te) * 0.92;
          const ex = ox + ax * len * te + px * we * sg, ey = oy + ay * len * te + py * we * sg;
          const mx = (bx + ex) * 0.5 + px * we * 0.25 * sg - ax * len * 0.02, my = (by + ey) * 0.5 + py * we * 0.25 * sg - ay * len * 0.02;
          gv.strokeStyle = `rgb(${Math.round(70 - 30 * t)},0,0)`;
          gv.lineWidth = S * (0.0032 - 0.0016 * t);
          gv.beginPath(); gv.moveTo(bx, by); gv.quadraticCurveTo(mx, my, ex, ey); gv.stroke();
        }
      }
    }
    gv.restore();
  }
  const A = readCanvas(shape), Vn = readCanvas(veins);
  const data = new Uint8Array(size * size * 4);
  const cellS = 22 / (MAPLE_LEAF.R * S); // tertiary areoles per pixel
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const al = A[i + 3];
      data[i + 3] = al;
      if (al === 0) continue;
      const cell = (y >= S ? 2 : 0) + (x >= S ? 1 : 0);
      const [ox, oy, R] = centres[cell];
      const dx = x - ox, dy = y - oy;
      const d = Math.sqrt(dx * dx + dy * dy) / R;
      const vein = Math.min(1, Vn[i] / 150);
      const n = fbm(x * 0.006, y * 0.006, 7 + cell, 4);
      const fine = vnoise(x * 0.075, y * 0.075, 3);
      const ret = 1 - smooth01(0.0, 0.09, cellEdge(x * cellS, y * cellS, 11 + cell));
      // shade: blade ~0.64, primaries up to 1, secondaries ~0.85, tertiary mesh +0.05, darker margin
      let shade = 0.64 + 0.08 * (n - 0.5) + 0.035 * (fine - 0.5) + vein * 0.34 + ret * 0.055 * (1 - vein) - Math.max(0, d - 0.78) * 0.22;
      for (const f of freckles) {
        const fd = Math.hypot(x - f[0], y - f[1]) / f[2];
        if (fd < 2.2) shade = shade * (0.35 + 0.65 * smooth01(0.6, 1.0, fd)) + (fd > 1 ? 0.06 * (1 - smooth01(1.0, 2.2, fd)) : 0);
      }
      const isPet = y > oy + R * 0.12 && Math.abs(dx) < S * 0.02;
      if (isPet) shade = 0.5;
      data[i] = Math.max(0, Math.min(255, Math.round(shade * 255)));
      data[i + 1] = isPet ? 0 : Math.max(0, Math.min(255, Math.round(Math.min(1, d) * 255)));
      data[i + 2] = Math.round(n * 255);
    }
  }
  return finalizeTexture(data, size, size, { srgb: false });
}

// ---------------------------------------------------------------------------
// Macro hero leaf atlas (shot 9 opening, 0.5-1 m from the lens): 2x2 cells, every form 7-lobed
// on the lobe axes the pleated hero card folds along (0, +-39, +-79, +-118 deg), deeply cut,
// slender acuminate lobes with a coarse doubly-serrate margin, and a full vein hierarchy.
//   R  0.5 blade, -> 1 on primary / secondary veins, -> 0 toward the margin (edge band)
//   G  radial base -> tip gradient (0 at the blade attachment)
//   B  0.5 blade, -> 1 on the tertiary / quaternary veinlet net, -> 0 in spots / drying patches
//   A  coverage (insect holes included)
// ---------------------------------------------------------------------------
const lobeWH = (t) => Math.pow(Math.sin(Math.PI * Math.pow(t, 0.92)), 0.72) * (1 - 0.5 * smooth01(0.5, 1, t)) * (0.55 + 0.45 * smooth01(0.0, 0.3, t));
function lobePolygonH(ox, oy, ang, len, W, rnd, teeth, N = 420) {
  const a = (ang * Math.PI) / 180;
  const ax = Math.sin(a), ay = -Math.cos(a), px = -ay, py = ax;
  const left = [], right = [];
  const asym = 0.95 + rnd() * 0.1;
  const ph = [rnd(), rnd(), rnd(), rnd()];
  // primary teeth: slow rise, sharp forward-pointing drop; every other tooth smaller (doubly serrate)
  const tooth = (t, k, p) => { const f = t * k + p; const s = f - Math.floor(f); const big = (Math.floor(f) & 1) ? 0.62 : 1.0; return Math.pow(s, 2.6) * big; };
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const w = W * lobeWH(t);
    const sm = smooth01(0.16, 0.36, t) * (1 - 0.35 * t);
    const sL = sm * (0.3 * tooth(t, teeth, ph[0]) + 0.08 * tooth(t, teeth * 2.9, ph[1]));
    const sR = sm * (0.3 * tooth(t, teeth * 1.05, ph[2]) + 0.08 * tooth(t, teeth * 3.0, ph[3]));
    const wl = w * (1 + sL) * asym, wr = w * (1 + sR) / asym;
    const s = t * len;
    left.push([ox + ax * s + px * wl, oy + ay * s + py * wl]);
    right.push([ox + ax * s - px * wr, oy + ay * s - py * wr]);
  }
  return left.concat(right.reverse());
}

export function makeMapleHeroAtlas(rng, size = 2048) {
  const S = size / 2;
  const shape = makeCanvas(size, size), veins = makeCanvas(size, size);
  const gs = shape.getContext('2d'), gv = veins.getContext('2d');
  gs.clearRect(0, 0, size, size);
  gv.fillStyle = '#000'; gv.fillRect(0, 0, size, size);
  gv.globalCompositeOperation = 'lighter';
  const centres = [], spots = [], dry = [];
  const FORMS = [
    { W: 0.165, sin: 0.27, teeth: 13, lf: [1.0, 0.96, 0.82, 0.56] },
    { W: 0.14, sin: 0.22, teeth: 15, lf: [1.0, 0.97, 0.86, 0.6] },
    { W: 0.18, sin: 0.3, teeth: 12, lf: [1.0, 0.93, 0.78, 0.5] },
    { W: 0.155, sin: 0.25, teeth: 14, lf: [1.0, 0.95, 0.84, 0.58] },
  ];
  for (let v = 0; v < 4; v++) {
    const cx0 = (v % 2) * S, cy0 = Math.floor(v / 2) * S;
    const rnd = rng.next;
    const ox = cx0 + MAPLE_LEAF.ox * S, oy = cy0 + MAPLE_LEAF.oy * S, R = MAPLE_LEAF.R * S;
    centres.push([ox, oy, R]);
    const F = FORMS[v];
    gs.save();
    gs.beginPath(); gs.rect(cx0, cy0, S, S); gs.clip();
    gs.fillStyle = '#fff';
    const tips = [];
    for (const [ang0, li] of [[0, 0], [39, 1], [-39, 1], [79, 2], [-79, 2], [118, 3], [-118, 3]]) {
      const len = R * F.lf[li] * (0.95 + rnd() * 0.08);
      const a2 = ang0 + (rnd() - 0.5) * 6;
      const Wl = R * F.W * (0.9 + rnd() * 0.18) * (li === 3 ? 1.1 : 1);
      const poly = lobePolygonH(ox, oy, a2, len, Wl, rnd, F.teeth + Math.floor(rnd() * 3) - (li === 3 ? 4 : 0));
      gs.beginPath();
      gs.moveTo(poly[0][0], poly[0][1]);
      for (const p of poly) gs.lineTo(p[0], p[1]);
      gs.closePath(); gs.fill();
      tips.push([(a2 * Math.PI) / 180, len, Wl]);
    }
    gs.beginPath(); gs.arc(ox, oy, R * F.sin, 0, TAU); gs.fill();
    // the base of the blade is truncate / slightly cordate between the two basal lobes
    gs.globalCompositeOperation = 'destination-out';
    gs.beginPath(); gs.ellipse(ox, oy + R * F.sin * 1.05, R * F.sin * 0.38, R * F.sin * 0.3, 0, 0, TAU); gs.fill();
    // insect holes / tears
    const nh = v === 0 || v === 2 ? 1 : 0;
    for (let k = 0; k < nh; k++) {
      const [a, len, Wl] = tips[1 + Math.floor(rnd() * 4)];
      const t = 0.4 + rnd() * 0.35, side = rnd() < 0.5 ? -1 : 1;
      const off = Wl * lobeWH(t) * (0.3 + 0.35 * rnd()) * side;
      const hx = ox + Math.sin(a) * len * t + Math.cos(a) * off, hy = oy - Math.cos(a) * len * t + Math.sin(a) * off;
      const hr = S * (0.003 + rnd() * 0.005);
      gs.beginPath(); gs.ellipse(hx, hy, hr, hr * (0.55 + rnd() * 0.5), rnd() * TAU, 0, TAU); gs.fill();
    }
    gs.globalCompositeOperation = 'source-over';
    gs.restore();
    // tar spots (dark, ringed) on two forms; a drying lobe tip on another
    if (v === 3) {
      for (let k = 0; k < 2; k++) {
        const [a, len] = tips[Math.floor(rnd() * tips.length)];
        const t = 0.35 + rnd() * 0.4;
        spots.push([ox + Math.sin(a) * len * t + (rnd() - 0.5) * R * 0.06, oy - Math.cos(a) * len * t + (rnd() - 0.5) * R * 0.06, S * (0.003 + rnd() * 0.004)]);
      }
    }
    if (v === 2 || v === 3) {
      const [a, len] = tips[1 + Math.floor(rnd() * 4)];
      dry.push([ox + Math.sin(a) * len * 0.92, oy - Math.cos(a) * len * 0.92, len * (0.22 + rnd() * 0.1)]);
    }
    // vein hierarchy (additive into R)
    gv.save();
    gv.beginPath(); gv.rect(cx0, cy0, S, S); gv.clip();
    gv.lineCap = 'round';
    for (const [a, len, Wl] of tips) {
      const ax = Math.sin(a), ay = -Math.cos(a), px = -ay, py = ax;
      const bend = (rnd() - 0.5) * 0.04;
      const mid = (t) => [ox + ax * len * t + px * len * bend * Math.sin(Math.PI * t), oy + ay * len * t + py * len * bend * Math.sin(Math.PI * t)];
      // primary (palmate) vein: from the blade attachment to the lobe tip, tapering
      const segs = 16;
      for (let k = 0; k < segs; k++) {
        const t0 = k / segs, t1 = (k + 1) / segs;
        const [x0, y0] = mid(t0), [x1, y1] = mid(t1);
        gv.strokeStyle = `rgb(${Math.round(255 - k * 8)},0,0)`;
        gv.lineWidth = S * Math.max(0.0016, 0.0095 * Math.pow(1 - t0, 1.3));
        gv.beginPath(); gv.moveTo(x0, y0); gv.lineTo(x1, y1); gv.stroke();
      }
      // secondary veins: alternate, pinnate, arching toward the tip and ending in a primary tooth
      const ns = 12 + Math.floor(rnd() * 3);
      for (let k = 0; k < ns; k++) {
        const t = 0.12 + (k / ns) * 0.78 + (rnd() - 0.5) * 0.025;
        for (const sg of [-1, 1]) {
          const tt = t + (sg > 0 ? 0.5 / ns : 0);
          if (tt > 0.92) continue;
          const [bx, by] = mid(tt);
          const te = Math.min(0.985, tt + 0.07 + 0.035 * rnd());
          const we = Wl * lobeWH(te) * 0.97;
          const ex = ox + ax * len * te + px * we * sg, ey = oy + ay * len * te + py * we * sg;
          const mx = (bx + ex) * 0.5 + px * we * 0.22 * sg - ax * len * 0.022, my = (by + ey) * 0.5 + py * we * 0.22 * sg - ay * len * 0.022;
          gv.strokeStyle = `rgb(${Math.round(150 - 60 * tt)},0,0)`;
          gv.lineWidth = S * (0.0034 - 0.0018 * tt);
          gv.beginPath(); gv.moveTo(bx, by); gv.quadraticCurveTo(mx, my, ex, ey); gv.stroke();
        }
      }
    }
    // short radial veins in the central blade between the primaries
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * TAU + rnd();
      gv.strokeStyle = 'rgb(70,0,0)'; gv.lineWidth = S * 0.0022;
      gv.beginPath(); gv.moveTo(ox, oy); gv.lineTo(ox + Math.sin(a) * R * F.sin * 0.8, oy - Math.cos(a) * R * F.sin * 0.8); gv.stroke();
    }
    gv.restore();
  }
  const A = readCanvas(shape), Vn = readCanvas(veins);
  // distance to the blade edge (chamfer 3-4 two-pass), in pixels
  const N = size * size, INF = 1e6;
  const dist = new Float32Array(N);
  for (let i = 0; i < N; i++) dist[i] = A[i * 4 + 3] > 127 ? INF : 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x; if (!dist[i]) continue;
    let d = dist[i];
    if (x > 0) d = Math.min(d, dist[i - 1] + 3);
    if (y > 0) { d = Math.min(d, dist[i - size] + 3); if (x > 0) d = Math.min(d, dist[i - size - 1] + 4); if (x < size - 1) d = Math.min(d, dist[i - size + 1] + 4); }
    dist[i] = d;
  }
  for (let y = size - 1; y >= 0; y--) for (let x = size - 1; x >= 0; x--) {
    const i = y * size + x; if (!dist[i]) continue;
    let d = dist[i];
    if (x < size - 1) d = Math.min(d, dist[i + 1] + 3);
    if (y < size - 1) { d = Math.min(d, dist[i + size] + 3); if (x < size - 1) d = Math.min(d, dist[i + size + 1] + 4); if (x > 0) d = Math.min(d, dist[i + size - 1] + 4); }
    dist[i] = d;
  }
  const data = new Uint8Array(N * 4);
  const c3 = 46 / (MAPLE_LEAF.R * S), c4 = c3 * 2.6; // tertiary / quaternary areoles per pixel
  const edgeW = S * 0.016;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4, p = y * size + x;
      const al = A[i + 3];
      data[i + 3] = al;
      if (al === 0) continue;
      const cell = (y >= S ? 2 : 0) + (x >= S ? 1 : 0);
      const [ox, oy, R] = centres[cell];
      const d = Math.hypot(x - ox, y - oy) / R;
      const vein = Math.min(1, Vn[i] / 150);
      const edge = 1 - smooth01(0, edgeW, dist[p] / 3);
      // veinlet net: tertiary cells, quaternary finer and fainter; wobbly via a domain warp
      const wx = x + 3 * Math.sin(y * 0.043 + cell * 1.7) + 2 * Math.sin((x + y) * 0.071), wy = y + 3 * Math.sin(x * 0.037 + cell) + 2 * Math.sin((x - y) * 0.067);
      const n3 = 1 - smooth01(0.0, 0.1, cellEdge(wx * c3, wy * c3, 21 + cell));
      const n4 = 1 - smooth01(0.0, 0.12, cellEdge(wx * c4, wy * c4, 31 + cell));
      const net = Math.min(1, n3 * 0.85 + n4 * 0.4) * (1 - 0.6 * smooth01(0.5, 0.95, vein)) * (0.55 + 0.45 * smooth01(0.1, 0.4, d));
      let spot = 0;
      for (const f of spots) {
        const fd = Math.hypot(x - f[0], y - f[1]) / f[2];
        if (fd < 2.4) spot = Math.max(spot, fd < 1 ? 1 : 0.35 * (1 - smooth01(1, 2.4, fd)));
      }
      for (const f of dry) {
        const fd = Math.hypot(x - f[0], y - f[1]) / f[2];
        if (fd < 1.4) spot = Math.max(spot, 0.65 * (1 - smooth01(0.55 + 0.35 * fbm(x * 0.03, y * 0.03, 61, 3), 1.25, fd)));
      }
      const r = 0.5 + 0.5 * vein - 0.48 * edge * (1 - 0.7 * vein);
      const b = 0.5 + 0.48 * net - 0.5 * spot;
      data[i] = Math.max(0, Math.min(255, Math.round(r * 255)));
      data[i + 1] = Math.max(0, Math.min(255, Math.round(Math.min(1, d) * 255)));
      data[i + 2] = Math.max(0, Math.min(255, Math.round(b * 255)));
    }
  }
  return finalizeTexture(data, size, size, { srgb: false });
}

// Acer palmatum samara pair (data texture in the maple channel layout, one image):
// two red-tinged wings spread ~140 deg from the nutlets, hanging from a pedicel at the top.
export function makeSamaraTexture(rng, size = 512) {
  const cv = makeCanvas(size, size), vc = makeCanvas(size, size);
  const g = cv.getContext('2d'), gv = vc.getContext('2d');
  g.clearRect(0, 0, size, size);
  gv.fillStyle = '#000'; gv.fillRect(0, 0, size, size);
  gv.globalCompositeOperation = 'lighter';
  const rnd = rng.next;
  const cx = size * 0.5, cy = size * 0.3; // nutlet junction
  g.fillStyle = '#fff';
  // pedicel up to the top edge
  g.strokeStyle = '#fff'; g.lineCap = 'round'; g.lineWidth = size * 0.012;
  g.beginPath(); g.moveTo(cx, cy); g.quadraticCurveTo(cx + size * 0.02, cy - size * 0.15, cx + size * 0.005, 0); g.stroke();
  for (const sg of [-1, 1]) {
    const ang = Math.PI + sg * (68 + rnd() * 10) * Math.PI / 180; // pointing down-outwards
    const L = size * (0.44 + rnd() * 0.04), Wd = size * 0.105;
    const ax = Math.sin(ang), ay = -Math.cos(ang);
    const px = -ay * sg, py = ax * sg; // toward the trailing (lower) edge
    // nutlet (bulb)
    const nx = cx + ax * size * 0.05, ny = cy + ay * size * 0.05;
    g.beginPath(); g.ellipse(nx, ny, size * 0.045, size * 0.035, ang, 0, TAU); g.fill();
    // wing: straight leading edge, rounded trailing edge, broad blunt tip
    g.beginPath();
    g.moveTo(nx, ny);
    g.bezierCurveTo(nx + ax * L * 0.4 - px * Wd * 0.2, ny + ay * L * 0.4 - py * Wd * 0.2, nx + ax * L * 0.85 - px * Wd * 0.15, ny + ay * L * 0.85 - py * Wd * 0.15, nx + ax * L, ny + ay * L);
    g.bezierCurveTo(nx + ax * L * 1.04 + px * Wd * 0.6, ny + ay * L * 1.04 + py * Wd * 0.6, nx + ax * L * 0.7 + px * Wd * 1.2, ny + ay * L * 0.7 + py * Wd * 1.2, nx + ax * L * 0.4 + px * Wd * 0.9, ny + ay * L * 0.4 + py * Wd * 0.9);
    g.bezierCurveTo(nx + ax * L * 0.2 + px * Wd * 0.7, ny + ay * L * 0.2 + py * Wd * 0.7, nx + px * Wd * 0.4, ny + py * Wd * 0.4, nx, ny);
    g.fill();
    // thick leading-edge vein + fine veins fanning to the trailing edge
    gv.strokeStyle = 'rgb(120,0,0)'; gv.lineWidth = size * 0.012; gv.lineCap = 'round';
    gv.beginPath(); gv.moveTo(nx, ny); gv.lineTo(nx + ax * L * 0.98 - px * Wd * 0.1, ny + ay * L * 0.98 - py * Wd * 0.1); gv.stroke();
    gv.strokeStyle = 'rgb(55,0,0)'; gv.lineWidth = size * 0.0045;
    for (let k = 1; k <= 9; k++) {
      const t = k / 10;
      const bx = nx + ax * L * t * 0.95, by = ny + ay * L * t * 0.95;
      const e = (0.9 + 0.3 * Math.sin(t * Math.PI)) * Wd;
      const ex = bx + (ax * 0.35 + px) * e, ey = by + (ay * 0.35 + py) * e;
      gv.beginPath(); gv.moveTo(bx, by); gv.quadraticCurveTo((bx + ex) / 2 + ax * Wd * 0.2, (by + ey) / 2 + ay * Wd * 0.2, ex, ey); gv.stroke();
    }
  }
  const A = readCanvas(cv), Vn = readCanvas(vc);
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      data[i + 3] = A[i + 3];
      if (!A[i + 3]) continue;
      const d = Math.hypot(x - cx, y - cy) / (size * 0.5);
      const n = fbm(x * 0.02, y * 0.02, 41, 3);
      const vein = Math.min(1, Vn[i] / 120);
      const nut = d < 0.14 ? 1 - d / 0.14 : 0;
      const shade = 0.6 + 0.08 * (n - 0.5) + 0.3 * vein - 0.18 * nut + Math.max(0, d - 0.75) * 0.25;
      data[i] = Math.max(0, Math.min(255, Math.round(shade * 255)));
      data[i + 1] = y < cy - size * 0.04 ? 0 : Math.max(0, Math.min(255, Math.round(Math.min(1, d) * 255)));
      data[i + 2] = Math.round(n * 255);
    }
  }
  return finalizeTexture(data, size, size, { srgb: false });
}

// ===========================================================================
// PINE needle atlas — 2x2 cells: [fan A, radial A ; fan B, radial B]
// fan  : needles bursting upwards from the bottom-centre (vertical cards)
// radial: needles bursting from the centre in all directions (horizontal card)
// ===========================================================================
export function makePineAtlas(rng, size = 1024) {
  const S = size / 2;
  const cv = makeCanvas(size, size);
  const g = cv.getContext('2d');
  g.clearRect(0, 0, size, size);
  g.lineCap = 'round';
  const rnd = rng.next;
  const needle = (x0, y0, x1, y1, cxp, cyp, shade, tint, w) => {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, `rgb(${shade},0,${tint})`);
    gr.addColorStop(1, `rgb(${shade},255,${tint})`);
    g.strokeStyle = gr;
    g.lineWidth = w;
    g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(cxp, cyp, x1, y1); g.stroke();
    // thinner extension for the sharp tip
    g.lineWidth = w * 0.55;
    const tx = x1 + (x1 - cxp) * 0.12, ty = y1 + (y1 - cyp) * 0.12;
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(tx, ty); g.stroke();
  };
  for (let row = 0; row < 2; row++) {
    // ---- fan cell
    const fx = 0, fy = row * S;
    g.save(); g.beginPath(); g.rect(fx, fy, S, S); g.clip();
    const bx = fx + S * 0.5, by = fy + S * 0.985;
    const N = 95 + row * 15;
    const items = [];
    for (let i = 0; i < N; i++) {
      const u = rnd() * 2 - 1;
      const th = Math.sign(u) * Math.pow(Math.abs(u), 0.9) * (80 * Math.PI / 180);
      const along = Math.pow(rnd(), 0.8) * S * 0.34; // emerge along the candle
      const sx = bx + (rnd() - 0.5) * S * 0.03, sy = by - along;
      const L = S * (0.5 + rnd() * 0.42) * (1 - 0.3 * Math.pow(Math.abs(th) / 1.4, 2)) * (1 - along / (S * 1.1));
      const ex = sx + Math.sin(th) * L, ey = sy - Math.cos(th) * L;
      // stiff needles: almost straight, the wide ones droop a touch
      const cx = sx + Math.sin(th) * L * 0.5 + (rnd() - 0.5) * L * 0.05;
      const cy = sy - Math.cos(th) * L * 0.5 - Math.abs(Math.sin(th)) * L * 0.05;
      items.push([sx, sy, ex, ey + Math.abs(Math.sin(th)) * L * 0.05, cx, cy, 110 + Math.floor(rnd() * 145), Math.floor(rnd() * 255), S * (0.0048 + rnd() * 0.0022), along]);
    }
    // draw far (low) first for a little depth ordering
    items.sort((a, b) => b[9] - a[9]);
    for (const it of items) needle(...it.slice(0, 9));
    // a short brown candle/shoot at the base
    g.strokeStyle = 'rgb(60,0,40)'; g.lineWidth = S * 0.022;
    g.beginPath(); g.moveTo(bx, by); g.lineTo(bx, by - S * 0.12); g.stroke();
    g.restore();

    // ---- radial cell
    const rx = S, ry = row * S;
    g.save(); g.beginPath(); g.rect(rx, ry, S, S); g.clip();
    const cx = rx + S * 0.5, cy = ry + S * 0.5;
    const M = 120 + row * 20;
    for (let i = 0; i < M; i++) {
      const a = rnd() * TAU;
      const r0 = rnd() * S * 0.04;
      const L = S * (0.2 + rnd() * 0.27);
      const sx = cx + Math.cos(a) * r0, sy = cy + Math.sin(a) * r0;
      const ex = sx + Math.cos(a) * L, ey = sy + Math.sin(a) * L;
      const bend = (rnd() - 0.5) * 0.12;
      const mx = sx + Math.cos(a + bend) * L * 0.5, my = sy + Math.sin(a + bend) * L * 0.5;
      needle(sx, sy, ex, ey, mx, my, 110 + Math.floor(rnd() * 145), Math.floor(rnd() * 255), S * (0.0048 + rnd() * 0.0022));
    }
    g.restore();
  }
  const src = readCanvas(cv);
  const data = new Uint8Array(src.length);
  data.set(src);
  return finalizeTexture(data, size, size, { srgb: false });
}

// ===========================================================================
// CHERRY blossom cluster atlas (sRGB) — 2x2 cells of dense flower clusters
// ===========================================================================
function drawSakura(g, x, y, rp, rot, squash, rnd, tone) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.scale(1, squash);
  // petals
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU + (rnd() - 0.5) * 0.15;
    g.save();
    g.rotate(a);
    const L = rp * (0.92 + rnd() * 0.12), W = rp * 0.5;
    const grd = g.createRadialGradient(0, 0, 0, 0, 0, L);
    const base = tone;
    grd.addColorStop(0.0, `rgb(${base[0] - 25},${base[1] - 85},${base[2] - 55})`);
    grd.addColorStop(0.32, `rgb(${base[0] - 6},${base[1] - 40},${base[2] - 28})`);
    grd.addColorStop(0.75, `rgb(${base[0]},${base[1]},${base[2]})`);
    grd.addColorStop(1.0, `rgb(${Math.min(255, base[0] + 4)},${Math.min(255, base[1] + 10)},${Math.min(255, base[2] + 8)})`);
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(W * 0.9, L * 0.25, W * 1.05, L * 0.8, W * 0.32, L * 0.98);
    g.lineTo(0, L * 0.86); // notch
    g.lineTo(-W * 0.32, L * 0.98);
    g.bezierCurveTo(-W * 1.05, L * 0.8, -W * 0.9, L * 0.25, 0, 0);
    g.fill();
    // faint petal vein line
    g.strokeStyle = `rgba(${base[0] - 30},${base[1] - 60},${base[2] - 40},0.35)`;
    g.lineWidth = rp * 0.03;
    g.beginPath(); g.moveTo(0, L * 0.1); g.lineTo(0, L * 0.7); g.stroke();
    g.restore();
  }
  // stamens
  const ns = 16;
  for (let k = 0; k < ns; k++) {
    const a = rnd() * TAU, l = rp * (0.28 + rnd() * 0.18);
    g.strokeStyle = 'rgb(236,160,170)'; g.lineWidth = rp * 0.035;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * l, Math.sin(a) * l); g.stroke();
    g.fillStyle = rnd() < 0.5 ? 'rgb(190,70,95)' : 'rgb(222,180,90)';
    g.beginPath(); g.arc(Math.cos(a) * l, Math.sin(a) * l, rp * 0.05, 0, TAU); g.fill();
  }
  g.fillStyle = 'rgb(200,60,90)';
  g.beginPath(); g.arc(0, 0, rp * 0.12, 0, TAU); g.fill();
  g.restore();
}

export function makeBlossomAtlas(rng, size = 1024) {
  const S = size / 2;
  const cv = makeCanvas(size, size);
  const g = cv.getContext('2d');
  g.clearRect(0, 0, size, size);
  const rnd = rng.next;
  for (let v = 0; v < 4; v++) {
    const x0 = (v % 2) * S, y0 = Math.floor(v / 2) * S;
    const cx = x0 + S / 2, cy = y0 + S / 2;
    g.save(); g.beginPath(); g.rect(x0, y0, S, S); g.clip();
    g.lineCap = 'round';
    // twig through the cluster
    g.strokeStyle = 'rgb(58,34,30)'; g.lineWidth = S * 0.022;
    const ta = rnd() * TAU;
    g.beginPath(); g.moveTo(cx - Math.cos(ta) * S * 0.5, cy - Math.sin(ta) * S * 0.5);
    g.quadraticCurveTo(cx + (rnd() - 0.5) * S * 0.2, cy + (rnd() - 0.5) * S * 0.2, cx + Math.cos(ta) * S * 0.45, cy + Math.sin(ta) * S * 0.45); g.stroke();
    const flowers = [];
    const nF = 26 + Math.floor(rnd() * 8);
    for (let i = 0; i < nF; i++) {
      // clustered umbels: pick an umbel centre then jitter
      const ua = rnd() * TAU, ur = Math.sqrt(rnd()) * S * 0.33;
      flowers.push({ x: cx + Math.cos(ua) * ur, y: cy + Math.sin(ua) * ur * 0.92, rp: S * (0.058 + rnd() * 0.02), rot: rnd() * TAU, sq: 0.55 + rnd() * 0.45, depth: rnd() });
    }
    // young leaves (bronze-green) behind
    for (let i = 0; i < 7; i++) {
      const a = rnd() * TAU, r = S * (0.18 + rnd() * 0.2);
      g.save(); g.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.rotate(a + Math.PI / 2 + (rnd() - 0.5));
      g.fillStyle = rnd() < 0.5 ? 'rgb(112,118,52)' : 'rgb(128,92,52)';
      g.beginPath(); g.ellipse(0, 0, S * 0.03, S * 0.075, 0, 0, TAU); g.fill();
      g.restore();
    }
    // pedicels
    g.strokeStyle = 'rgb(120,70,60)'; g.lineWidth = S * 0.006;
    for (const f of flowers) {
      g.beginPath(); g.moveTo(cx + (f.x - cx) * 0.25, cy + (f.y - cy) * 0.25); g.lineTo(f.x, f.y); g.stroke();
    }
    flowers.sort((a, b) => a.depth - b.depth);
    for (const f of flowers) {
      const pale = rnd();
      const tone = pale < 0.6 ? [252, 232, 238] : pale < 0.9 ? [250, 214, 226] : [255, 244, 246];
      drawSakura(g, f.x, f.y, f.rp, f.rot, f.sq, rnd, tone);
    }
    // buds
    for (let i = 0; i < 6; i++) {
      const a = rnd() * TAU, r = S * (0.25 + rnd() * 0.12);
      g.fillStyle = 'rgb(214,92,128)';
      g.beginPath(); g.ellipse(cx + Math.cos(a) * r, cy + Math.sin(a) * r, S * 0.014, S * 0.022, a, 0, TAU); g.fill();
    }
    g.restore();
  }
  const src = readCanvas(cv);
  const data = new Uint8Array(src.length); data.set(src);
  return finalizeTexture(data, size, size, { srgb: true });
}

// ===========================================================================
// SHRUB atlas (sRGB) — 2x2: [azalea leaves, azalea + pink flowers ; boxwood, azalea + red flowers]
// ===========================================================================
function smallLeaf(g, x, y, ang, L, W, col, rnd) {
  g.save(); g.translate(x, y); g.rotate(ang);
  const grd = g.createLinearGradient(-W, 0, W, 0);
  const [r, gg, b] = col;
  grd.addColorStop(0, `rgb(${r * 0.75 | 0},${gg * 0.75 | 0},${b * 0.75 | 0})`);
  grd.addColorStop(0.5, `rgb(${r},${gg},${b})`);
  grd.addColorStop(1, `rgb(${r * 0.85 | 0},${gg * 0.85 | 0},${b * 0.85 | 0})`);
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(0, 0);
  g.bezierCurveTo(W, L * 0.25, W * 0.9, L * 0.75, 0, L);
  g.bezierCurveTo(-W * 0.9, L * 0.75, -W, L * 0.25, 0, 0);
  g.fill();
  g.strokeStyle = `rgba(${Math.min(255, r * 1.4) | 0},${Math.min(255, gg * 1.35) | 0},${Math.min(255, b * 1.2) | 0},0.7)`;
  g.lineWidth = Math.max(1, W * 0.12);
  g.beginPath(); g.moveTo(0, L * 0.05); g.lineTo(0, L * 0.85); g.stroke();
  g.restore();
}

function azaleaFlower(g, x, y, r, col, rnd) {
  g.save(); g.translate(x, y); g.rotate(rnd() * TAU);
  for (let k = 0; k < 5; k++) {
    g.save(); g.rotate((k / 5) * TAU);
    const grd = g.createRadialGradient(0, 0, 0, 0, 0, r);
    grd.addColorStop(0, `rgb(${col[0] * 0.7 | 0},${col[1] * 0.6 | 0},${col[2] * 0.7 | 0})`);
    grd.addColorStop(0.5, `rgb(${col[0]},${col[1]},${col[2]})`);
    grd.addColorStop(1, `rgb(${Math.min(255, col[0] + 15)},${Math.min(255, col[1] + 20)},${Math.min(255, col[2] + 20)})`);
    g.fillStyle = grd;
    g.beginPath(); g.moveTo(0, 0);
    g.bezierCurveTo(r * 0.55, r * 0.3, r * 0.6, r * 0.95, 0, r);
    g.bezierCurveTo(-r * 0.6, r * 0.95, -r * 0.55, r * 0.3, 0, 0);
    g.fill();
    g.restore();
  }
  // spots + stamens
  g.fillStyle = `rgb(${col[0] * 0.55 | 0},${col[1] * 0.3 | 0},${col[2] * 0.45 | 0})`;
  for (let k = 0; k < 6; k++) { g.beginPath(); g.arc((rnd() - 0.5) * r * 0.5, -r * 0.2 - rnd() * r * 0.3, r * 0.04, 0, TAU); g.fill(); }
  g.strokeStyle = `rgb(${col[0]},${col[1] * 0.8 | 0},${col[2] * 0.8 | 0})`; g.lineWidth = r * 0.04;
  for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (rnd() - 0.5) * 1.2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9); g.stroke(); }
  g.restore();
}

export function makeShrubAtlas(rng, size = 1024) {
  const S = size / 2;
  const cv = makeCanvas(size, size);
  const g = cv.getContext('2d');
  g.clearRect(0, 0, size, size);
  const rnd = rng.next;
  const greens = [[54, 86, 31], [64, 100, 36], [47, 77, 29], [76, 108, 40], [86, 102, 38]];
  for (let v = 0; v < 4; v++) {
    const x0 = (v % 2) * S, y0 = Math.floor(v / 2) * S;
    const cx = x0 + S / 2, cy = y0 + S / 2;
    g.save(); g.beginPath(); g.rect(x0, y0, S, S); g.clip();
    if (v === 2) {
      // boxwood: tiny rounded leaves, dense, yellow-green
      for (let i = 0; i < 420; i++) {
        const a = rnd() * TAU, r = Math.sqrt(rnd()) * S * 0.46;
        const col = [[78, 98, 34], [92, 110, 38], [66, 88, 30], [104, 116, 44]][Math.floor(rnd() * 4)];
        smallLeaf(g, cx + Math.cos(a) * r, cy + Math.sin(a) * r, rnd() * TAU, S * (0.05 + rnd() * 0.02), S * (0.022 + rnd() * 0.008), col, rnd);
      }
    } else {
      // azalea: rosettes of small elliptic leaves
      const nRos = 16;
      for (let k = 0; k < nRos; k++) {
        const a = rnd() * TAU, r = Math.sqrt(rnd()) * S * 0.36;
        const rx = cx + Math.cos(a) * r, ry = cy + Math.sin(a) * r;
        const nL = 7 + Math.floor(rnd() * 4);
        const a0 = rnd() * TAU;
        for (let j = 0; j < nL; j++) {
          const la = a0 + (j / nL) * TAU + (rnd() - 0.5) * 0.4;
          const col = greens[Math.floor(rnd() * greens.length)];
          const c2 = rnd() < 0.08 ? [120, 82, 34] : col;
          smallLeaf(g, rx, ry, la, S * (0.1 + rnd() * 0.05), S * (0.032 + rnd() * 0.01), c2, rnd);
        }
      }
      if (v === 1 || v === 3) {
        const col = v === 1 ? [236, 92, 150] : [226, 52, 74];
        const nf = 13;
        for (let k = 0; k < nf; k++) {
          const a = rnd() * TAU, r = Math.sqrt(rnd()) * S * 0.34;
          azaleaFlower(g, cx + Math.cos(a) * r, cy + Math.sin(a) * r, S * (0.07 + rnd() * 0.025), col.map((c) => Math.min(255, c + Math.floor((rnd() - 0.5) * 20))), rnd);
        }
      }
    }
    g.restore();
  }
  const src = readCanvas(cv);
  const data = new Uint8Array(src.length); data.set(src);
  return finalizeTexture(data, size, size, { srgb: true });
}

// ===========================================================================
// FERN frond texture (sRGB) — single frond pointing up, base at the bottom
// ===========================================================================
export function makeFernTexture(rng, w = 256, h = 1024) {
  const cv = makeCanvas(w, h);
  const g = cv.getContext('2d');
  g.clearRect(0, 0, w, h);
  const rnd = rng.next;
  const cx = w / 2;
  g.lineCap = 'round';
  // rachis
  g.strokeStyle = 'rgb(70,86,34)'; g.lineWidth = w * 0.025;
  g.beginPath(); g.moveTo(cx, h); g.lineTo(cx, h * 0.03); g.stroke();
  const pairs = 26;
  for (let i = 0; i < pairs; i++) {
    const t = 0.12 + (i / pairs) * 0.86; // along from base (0) to tip (1)
    const y = h * (1 - t);
    const L = w * 0.47 * Math.sin(Math.PI * Math.min(1, (t - 0.05) * 1.05)) * (1 - t * 0.35);
    for (const s of [-1, 1]) {
      // pinna: row of small lobes
      const ang = s * (1.25 - t * 0.3);
      const ex = cx + Math.sin(ang) * L, ey = y - Math.cos(ang) * L * 0.35 - L * 0.12;
      const col = [[62, 98, 30], [74, 110, 36], [56, 90, 28]][Math.floor(rnd() * 3)];
      g.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
      const nl = 9;
      for (let k = 0; k < nl; k++) {
        const u = k / nl;
        const px = cx + (ex - cx) * u, py = y + (ey - y) * u;
        const lw = w * 0.022 * (1 - u * 0.6) + 1;
        g.beginPath(); g.ellipse(px, py - lw * 0.6, lw, lw * 1.9, ang * 0.3, 0, TAU); g.fill();
      }
      g.strokeStyle = 'rgb(80,96,40)'; g.lineWidth = w * 0.008;
      g.beginPath(); g.moveTo(cx, y); g.lineTo(ex, ey); g.stroke();
    }
  }
  const src = readCanvas(cv);
  const data = new Uint8Array(src.length); data.set(src);
  return finalizeTexture(data, w, h, { srgb: true });
}
