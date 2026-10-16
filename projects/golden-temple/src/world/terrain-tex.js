// ---------------------------------------------------------------------------
// Procedural foliage atlas drawn with canvas 2D (no external assets).
// Channels (premultiplied against black): R = leaf brightness, G = coverage
// (alpha), B = "outerness" (0 inner .. 1 outer / tip). A = 255.
// Cells (2x2 of 512px):  0 broadleaf A | 1 broadleaf B
//                        2 sugi spray A | 3 sugi spray B
// ---------------------------------------------------------------------------

let _atlas = null;

export function leafAtlas(ctx) {
  if (_atlas) return _atlas;
  const { THREE } = ctx;
  const S = 512, N = 2;
  const cv = document.createElement('canvas');
  cv.width = S * N; cv.height = S * N;
  const g = cv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, cv.width, cv.height);
  const R = ctx.rng('terrain-leaf-atlas');

  const col = (bright, outer) => `rgb(${Math.round(255 * Math.min(1, Math.max(0, bright)))},255,${Math.round(255 * Math.min(1, Math.max(0, outer)))})`;

  // ---- broadleaf cluster ----
  function broadleaf(ox, oy, seed) {
    const r = ctx.rng('bl' + seed);
    const cx = ox + S / 2, cy = oy + S / 2;
    const RB = S * 0.43;
    // rosette of sub-clumps -> lobed, leafy outline with dark gaps inside
    // irregular scatter of twig clumps of mixed size (no regular rosette -> no 'giant leaf' read)
    const clumps = [{ x: r.range(-0.05, 0.05) * S, y: r.range(-0.05, 0.05) * S, R: S * 0.12 }];
    const nc = 22;
    for (let i = 0; i < nc; i++) {
      const a = (i / nc) * Math.PI * 2 * 3.0 + r.range(-0.6, 0.6);
      const d = Math.sqrt(r.range(0.1, 1.0)) * 0.74 * RB;
      clumps.push({ x: Math.cos(a) * d, y: Math.sin(a) * d * r.range(0.8, 1.1), R: S * r.range(0.045, 0.105) });
    }
    const leaves = [];
    for (const c of clumps) {
      const n = Math.round(c.R * c.R / (S * S) * 9500);
      // each twig clump is its own little dome: sunlit on its upper side, dark underneath, so a
      // distant card reads as a mass of separate foliage clumps rather than one lobed leaf
      const cb = r.range(0.75, 1.15);
      for (let i = 0; i < n; i++) {
        const a = r.range(0, Math.PI * 2);
        const dd = Math.sqrt(r.next());
        const lx = Math.cos(a) * dd, ly = Math.sin(a) * dd;
        const x = c.x + lx * c.R, y = c.y + ly * c.R;
        const D = Math.hypot(x, y) / RB;
        if (D > 1) continue;
        const dome = Math.sqrt(Math.max(0, 1 - dd * dd));
        const lit = Math.min(1, Math.max(0, 0.5 - 0.55 * ly + 0.15 * lx)) * (0.55 + 0.45 * dome);
        leaves.push({ x: cx + x, y: cy + y, d: Math.min(1, 0.55 * D + 0.45 * dd), a: Math.atan2(y, x) * 0.5 + a * 0.5, lit: lit * cb, D });
      }
    }
    // twigs first (dark)
    g.lineCap = 'round';
    for (const c of clumps.slice(1)) {
      g.strokeStyle = col(0.10, 0.15);
      g.lineWidth = r.range(2, 3.5);
      g.beginPath(); g.moveTo(cx, cy + S * 0.04);
      g.quadraticCurveTo(cx + c.x * 0.5 + r.range(-10, 10), cy + c.y * 0.5 + 8, cx + c.x, cy + c.y);
      g.stroke();
    }
    leaves.sort((p, q) => p.d - q.d);
    for (const l of leaves) {
      const len = S * r.range(0.032, 0.05) * (1.1 - 0.2 * l.d);
      const wid = len * r.range(0.42, 0.55);
      const rot = l.a + r.range(-0.9, 0.9) + (r.chance(0.3) ? Math.PI : 0);
      const bright = 0.16 + 0.62 * l.lit + 0.18 * l.D + r.range(-0.12, 0.14);
      g.save();
      g.translate(l.x, l.y); g.rotate(rot);
      g.fillStyle = col(bright, l.d);
      g.beginPath();
      g.moveTo(-len * 0.5, 0);
      g.bezierCurveTo(-len * 0.2, -wid * 0.75, len * 0.25, -wid * 0.6, len * 0.5, 0);
      g.bezierCurveTo(len * 0.25, wid * 0.6, -len * 0.2, wid * 0.75, -len * 0.5, 0);
      g.fill();
      // midrib highlight
      g.strokeStyle = col(bright * 0.75, l.d);
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(-len * 0.45, 0); g.lineTo(len * 0.42, 0); g.stroke();
      g.restore();
    }
  }

  // ---- cryptomeria (sugi) spray: rope-like needle cords on a branching twig ----
  function sugi(ox, oy, seed) {
    const r = ctx.rng('sg' + seed);
    g.lineCap = 'round';
    const segs = [];
    function branch(x, y, ang, len, depth) {
      const steps = Math.max(4, Math.round(len / 7));
      let px = x, py = y, a = ang;
      for (let i = 0; i < steps; i++) {
        a += r.range(-0.08, 0.08);
        const nx = px + Math.cos(a) * len / steps, ny = py + Math.sin(a) * len / steps;
        segs.push({ x0: px, y0: py, x1: nx, y1: ny, a, depth, t: i / steps });
        px = nx; py = ny;
        if (depth < 3 && i > 1 && r.chance(depth === 0 ? 0.22 : 0.16)) {
          const side = r.sign();
          branch(px, py, a + side * r.range(0.45, 0.9), len * r.range(0.38, 0.55), depth + 1);
        }
      }
      if (depth < 3) {
        branch(px, py, a + r.range(0.25, 0.5), len * 0.45, depth + 1);
        branch(px, py, a - r.range(0.25, 0.5), len * 0.42, depth + 1);
      }
    }
    const bx = ox + S / 2, by = oy + S * 0.96;
    const nMain = 5;
    for (let k = 0; k < nMain; k++) {
      branch(bx + r.range(-8, 8), by, -Math.PI / 2 + (k - 2) * 0.3 + r.range(-0.08, 0.08), S * r.range(0.40, 0.50) * (k === 2 ? 1.05 : 0.92), 0);
    }
    // stems (dark)
    for (const s of segs) {
      g.strokeStyle = col(0.15, 0.1);
      g.lineWidth = Math.max(1, 4.2 - s.depth * 1.1);
      g.beginPath(); g.moveTo(s.x0, s.y0); g.lineTo(s.x1, s.y1); g.stroke();
    }
    // needle cords: dense short strokes along every segment, brighter toward tips
    for (const s of segs) {
      const L = Math.hypot(s.x1 - s.x0, s.y1 - s.y0);
      const n = Math.ceil(L / 1.6);
      const outer = Math.min(1, (s.depth + s.t) / 3.2);
      for (let i = 0; i < n; i++) {
        const t = i / n;
        const x = s.x0 + (s.x1 - s.x0) * t, y = s.y0 + (s.y1 - s.y0) * t;
        for (const side of [-1, 1]) {
          const na = s.a + side * r.range(0.5, 1.0) - 0.25;
          const nl = r.range(7, 12) * (1.15 - 0.15 * s.depth);
          const b = 0.30 + 0.5 * outer + r.range(-0.12, 0.18);
          g.strokeStyle = col(b, outer);
          g.lineWidth = r.range(1.6, 2.6);
          g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(na) * nl, y + Math.sin(na) * nl); g.stroke();
        }
      }
    }
  }

  broadleaf(0, 0, 1);
  broadleaf(S, 0, 2);
  sugi(0, S, 3);
  sugi(S, S, 4);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  // uv rect of cell k (flipY = true: v=0 is the canvas bottom)
  const cell = (k) => { const cx = k % N, cy = Math.floor(k / N); return [cx / N, 1 - (cy + 1) / N, (cx + 1) / N, 1 - cy / N]; };
  _atlas = { tex, cell, size: S * N };
  return _atlas;
}

// Fern frond (R = brightness, G = coverage, B = position along frond). 256 x 512, base at the bottom.
let _fern = null;
export function fernTexture(ctx) {
  if (_fern) return _fern;
  const { THREE } = ctx;
  const W = 256, H = 512;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  const r = ctx.rng('fern-tex');
  const col = (b, t) => `rgb(${Math.round(255 * Math.min(1, Math.max(0, b)))},255,${Math.round(255 * Math.min(1, Math.max(0, t)))})`;
  const cx = W / 2;
  const y0 = H - 6, y1 = 10;
  g.lineCap = 'round';
  // rachis
  g.strokeStyle = col(0.25, 0.5); g.lineWidth = 3.2;
  g.beginPath(); g.moveTo(cx, y0); g.lineTo(cx, y1); g.stroke();
  const n = 26;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const y = y0 + (y1 - y0) * t;
    const env = Math.sin(Math.min(1, t * 1.15) * Math.PI) * (t < 0.12 ? t / 0.12 : 1);
    const len = (W * 0.46) * env * (0.92 + r.range(-0.05, 0.05));
    for (const side of [-1, 1]) {
      const yy = y + side * 3;
      const ang = -0.35; // pinnae angle toward the tip
      // pinna: row of rounded pinnules
      const m = Math.max(3, Math.round(len / 7));
      for (let k = 0; k < m; k++) {
        const s = (k + 0.5) / m;
        const px = cx + side * s * len * Math.cos(ang);
        const py = yy + s * len * Math.sin(ang) * 1.0;
        const pr = (1 - s * 0.75) * 6.5 + 1.2;
        g.fillStyle = col(0.45 + 0.4 * (1 - s) * 0 + 0.35 * s + r.range(-0.08, 0.08), t);
        g.beginPath(); g.ellipse(px, py, pr * 1.1, pr * 0.75, ang * side, 0, Math.PI * 2); g.fill();
      }
      g.strokeStyle = col(0.3, t); g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(cx, yy); g.lineTo(cx + side * len * Math.cos(ang), yy + len * Math.sin(ang)); g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  _fern = { tex, size: 512 };
  return _fern;
}
