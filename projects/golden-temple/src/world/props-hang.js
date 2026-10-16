// ---------------------------------------------------------------------------
// props-hang.js — hanging bronze lantern (tsuri-dōrō) and wind bell (fūtaku).
// Local frame: hook point at the origin, everything hangs toward -Y, front +Z.
// Metal tag = [pattern, metalType(0 bronze,1 gold,2 bell bronze,3 black), swingLevel, pivotY]
// Panel tag = [kind (1 main, 2 frieze), 0, swingLevel, 0]
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { Acc, polyStack, petalBand, lathe, roofCap, taperTube, scrollPoints, superLathe, extrude, basis, mat4, TAU } from './props-geo.js';

const UP = new THREE.Vector3(0, 1, 0);
const BR = (sw = 1, piv = 0) => [0, 0, sw, piv];
const GD = (sw = 1, piv = 0) => [0, 1, sw, piv];
const BB = (sw = 1, piv = 0) => [0, 2, sw, piv];

// ring of n vertical panel quads (u along cross(up, N))
function panelRing(P, n, rot, a, y0, y1, kind, inset = 0) {
  const from = P.n;
  const fw = 2 * a * Math.tan(Math.PI / n) - inset;
  const h = y1 - y0;
  for (let i = 0; i < n; i++) {
    const th = rot + (i * TAU) / n;
    const N = new THREE.Vector3(Math.cos(th), 0, Math.sin(th));
    const Tn = new THREE.Vector3(Math.sin(th), 0, -Math.cos(th));
    const C = N.clone().multiplyScalar(a); C.y = (y0 + y1) / 2;
    const ids = [];
    for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
      const p = C.clone().addScaledVector(Tn, (u - 0.5) * fw).addScaledVector(UP, (v - 0.5) * h);
      ids.push(P.v(p.x, p.y, p.z, N.x, N.y, N.z, [u, v, fw, h], [kind, 0, 1, 0]));
    }
    P.quad(ids[0], ids[1], ids[2], ids[3]);
  }
  // tag.y / tag.w are filled in once the flame height is known (flameTags)
  return { from, to: P.n, yc: (y0 + y1) / 2, a };
}
// tag.y = panel centre height above the candle flame, tag.w = depth from the panel to the lantern axis
function flameTags(P, rings, yFlame) {
  for (const r of rings) { P.setTag(r.from, r.to, 1, r.yc - yFlame); P.setTag(r.from, r.to, 3, r.a); }
}

export function buildHangingLantern() {
  const M = new Acc(), P = new Acc();
  const n = 6, rot = Math.PI / 2;
  // hook eye + chain
  M.addGeo(new THREE.TorusGeometry(0.016, 0.0045, 6, 14), mat4([0, -0.016, 0]), BR());
  const link = new THREE.TorusGeometry(0.011, 0.0034, 6, 14);
  const nLinks = 9;
  for (let k = 0; k < nLinks; k++) {
    const y = -0.043 - k * 0.03;
    M.addGeo(link, mat4([0, y, 0], [0, (k % 2) * Math.PI / 2, 0], [1, 1.62, 1]), BR());
  }
  const yRing = -0.043 - nLinks * 0.03 - 0.012;
  // top ring (kan) + finial
  M.addGeo(new THREE.TorusGeometry(0.028, 0.0068, 8, 22), mat4([0, yRing, 0], [0, Math.PI / 2, 0]), GD());
  const yf = yRing - 0.026;
  lathe(M, [[0.0, yf + 0.002], [0.012, yf - 0.002], [0.02, yf - 0.012], [0.024, yf - 0.026], [0.02, yf - 0.04], [0.026, yf - 0.046], [0.03, yf - 0.054], [0.026, yf - 0.06], [0.04, yf - 0.066], [0.045, yf - 0.072], [0.0, yf - 0.072]].reverse(), 20, GD());
  // roof
  const yE = yf - 0.072 - 0.112;
  const roof = roofCap(M, { n, rot, A: 0.25, knobA: 0.036, yEave: yE, H: 0.112, thick: 0.016, lift: 0.036, soffitA: 0.17, segS: 10, segT: 10,
    rise: (t) => { const s = t * t * (3 - 2 * t); return Math.pow(1 - (0.7 * s + 0.3 * t), 1.25); }, ridge: { h: 0.004, w: 0.006 },
    tagTop: BR(), tagEdge: GD(), tagBottom: BR() });
  // gilt hip ribs + corner curls
  for (let k = 0; k < n; k++) {
    const pts = [];
    for (let i = 0; i <= 8; i++) { const p = roof.hipPoint(k, 0.06 + 0.84 * (i / 8)); p.y += 0.003; pts.push(p); }
    taperTube(M, pts, (t) => 0.0052 - 0.0012 * t, { radial: 6, segs: 12, tag: GD() });
    const c = roof.corner(k);
    const st = roof.hipPoint(k, 0.9); st.y -= 0.004;
    taperTube(M, scrollPoints(st, c.dir, 0.017, 1.05, 0.38, 16), (t) => 0.0068 - 0.0035 * t, { radial: 7, segs: 18, tag: GD() });
  }
  // yōraku: a short chain + tiny gilt bell dangling from each turned-up corner
  {
    const lk = new THREE.TorusGeometry(0.0052, 0.00135, 5, 10);
    const bellP = [[0.0, 0.0], [0.0022, -0.0004], [0.0034, -0.002], [0.0042, -0.0045], [0.0052, -0.009], [0.0068, -0.0145], [0.0078, -0.0172], [0.0074, -0.0182], [0.0062, -0.0176], [0.0045, -0.0165]];
    for (let k = 0; k < n; k++) {
      const c = roof.corner(k);
      const x = c.x * 0.955, z = c.z * 0.955;
      let y = c.y - 0.02;
      for (let j = 0; j < 3; j++) {
        M.addGeo(lk, mat4([x, y - j * 0.0085, z], [0, (j % 2) * Math.PI / 2 + k, 0], [1, 1.5, 1]), GD());
      }
      y -= 3 * 0.0085 + 0.002;
      lathe(M, bellP.slice().reverse().map(([r, yy]) => [r, y + yy]), 12, GD(), mat4([x, 0, z]));
      // clapper bead
      M.addGeo(new THREE.SphereGeometry(0.0022, 6, 4), mat4([x, y - 0.0185, z]), BR());
    }
  }
  // soffit step + frieze
  const yS = yE - 0.016;
  polyStack(M, { n, rot, rc: 0.003, sideSeg: 1, profile: [
    { a: 0.0, y: yS - 0.006, tag: BR() }, { a: 0.192, y: yS - 0.006 }, { a: 0.192, y: yS }, { a: 0.2, y: yS },
  ] });
  const yF1 = yS - 0.006, yF0 = yF1 - 0.036;
  const rings = [panelRing(P, n, rot, 0.174, yF0, yF1, 2)];
  polyStack(M, { n, rot, rc: 0.003, sideSeg: 1, profile: [
    { a: 0.0, y: yF0 - 0.006, tag: GD() }, { a: 0.182, y: yF0 - 0.006 }, { a: 0.182, y: yF0 }, { a: 0.0, y: yF0 },
  ] });
  // frieze corner posts
  const rcF = 0.174 / Math.cos(Math.PI / n);
  for (let k = 0; k < n; k++) {
    const ang = rot + (k * TAU) / n + Math.PI / n;
    M.addGeo(new THREE.BoxGeometry(0.012, yF1 - yF0, 0.012), mat4([Math.cos(ang) * rcF, (yF0 + yF1) / 2, Math.sin(ang) * rcF], [0, -ang, 0]), BR());
  }
  // body
  const yB1 = yF0 - 0.006, yTop = yB1 - 0.024, yBot = yTop - 0.322, yB0 = yBot - 0.024;
  polyStack(M, { n, rot, rc: 0.004, sideSeg: 1, profile: [
    { a: 0.0, y: yTop, tag: BR() }, { a: 0.178, y: yTop, tag: GD() }, { a: 0.186, y: yTop + 0.004 }, { a: 0.186, y: yTop + 0.008, tag: BR() }, { a: 0.182, y: yTop + 0.012 }, { a: 0.182, y: yB1 - 0.003 }, { a: 0.19, y: yB1, tag: GD() }, { a: 0.0, y: yB1 },
  ] });
  rings.push(panelRing(P, n, rot, 0.166, yBot, yTop, 1));
  polyStack(M, { n, rot, rc: 0.004, sideSeg: 1, profile: [
    { a: 0.0, y: yB0, tag: BR() }, { a: 0.19, y: yB0, tag: GD() }, { a: 0.19, y: yB0 + 0.004, tag: BR() }, { a: 0.182, y: yB0 + 0.008 }, { a: 0.182, y: yBot - 0.012 }, { a: 0.186, y: yBot - 0.008, tag: GD() }, { a: 0.186, y: yBot - 0.004 }, { a: 0.178, y: yBot }, { a: 0.0, y: yBot },
  ] });
  // corner posts with gilt caps
  const rcB = 0.166 / Math.cos(Math.PI / n) + 0.002;
  const rivet = new THREE.SphereGeometry(0.0026, 6, 3);
  const edgeStrip = new THREE.BoxGeometry(0.0034, yTop - yBot - 0.07, 0.0034);
  for (let k = 0; k < n; k++) {
    const ang = rot + (k * TAU) / n + Math.PI / n;
    const x = Math.cos(ang) * rcB, z = Math.sin(ang) * rcB;
    M.addGeo(new THREE.BoxGeometry(0.019, yTop - yBot, 0.019), mat4([x, (yTop + yBot) / 2, z], [0, -ang, 0]), BR());
    for (const yy of [yTop - 0.018, yBot + 0.018]) M.addGeo(new THREE.BoxGeometry(0.024, 0.026, 0.024), mat4([x, yy, z], [0, -ang, 0]), GD());
    M.addGeo(new THREE.SphereGeometry(0.0065, 8, 6), mat4([x * 1.07, (yTop + yBot) / 2, z * 1.07]), GD());
    // gilt edging strips on both outer arrises of the post
    const MP = mat4([x, (yTop + yBot) / 2, z], [0, -ang, 0]);
    for (const sd of [-1, 1]) M.addGeo(edgeStrip, MP.clone().multiply(mat4([0.0092, 0, sd * 0.0092])), GD());
    // domed rivets pinning the panels to the post (both flanks of the outer face)
    const tx = -Math.sin(ang), tz = Math.cos(ang);
    for (const yy of [yTop - 0.06, yTop - 0.115, yBot + 0.115, yBot + 0.06]) {
      for (const sd of [-1, 1]) M.addGeo(rivet, mat4([x * 1.045 + tx * sd * 0.0045, yy, z * 1.045 + tz * sd * 0.0045]), GD());
    }
  }
  // base plate, pierced skirt, bottom dome, pendant
  const yP1 = yB0, yP0 = yP1 - 0.014;
  polyStack(M, { n, rot, rc: 0.004, sideSeg: 1, profile: [
    { a: 0.0, y: yP0 - 0.032, tag: BR() }, { a: 0.2, y: yP0 - 0.032 }, { a: 0.2, y: yP0, tag: GD() }, { a: 0.214, y: yP0 + 0.003 }, { a: 0.214, y: yP1 - 0.003 }, { a: 0.205, y: yP1 }, { a: 0.0, y: yP1 },
  ] });
  rings.push(panelRing(P, n, rot, 0.201, yP0 - 0.03, yP0 - 0.002, 2));
  const yD = yP0 - 0.032;
  polyStack(M, { n, rot, rc: 0.012, sideSeg: 2, tag: BR(), profile: [
    { a: 0.0, y: yD - 0.072 }, { a: 0.03, y: yD - 0.072 }, { a: 0.08, y: yD - 0.064, s: true }, { a: 0.128, y: yD - 0.046, s: true }, { a: 0.158, y: yD - 0.026, tag: GD() },
    { a: 0.172, y: yD - 0.02 }, { a: 0.172, y: yD - 0.01, tag: BR() }, { a: 0.192, y: yD },
  ] });
  const yPd = yD - 0.072;
  lathe(M, [[0.0, yPd + 0.004], [0.02, yPd], [0.024, yPd - 0.008], [0.016, yPd - 0.016], [0.022, yPd - 0.024], [0.034, yPd - 0.042], [0.036, yPd - 0.056], [0.03, yPd - 0.072], [0.018, yPd - 0.088], [0.007, yPd - 0.1], [0.0, yPd - 0.106]].reverse(), 20, GD());
  flameTags(P, rings, (yTop + yBot) / 2);
  return { metal: M, panel: P, lightY: (yTop + yBot) / 2, bottom: yPd - 0.106 };
}

// ---------------------------------------------------------------------------
// Wind bell (fūtaku): rounded-square bronze bell, clapper, gilt wind sail.
// ---------------------------------------------------------------------------
function sailShape(W, Lh) {
  const s = new THREE.Shape();
  const pts = [];
  const N = 26;
  for (let i = 0; i <= N; i++) {
    const t = i / N; // 0 top -> 1 tip
    const w = W * Math.pow(Math.sin(Math.PI * Math.min(t * 0.95 + 0.05, 1)), 0.85) * (1 - 0.25 * t) + 0.006;
    const sc = 1 + 0.06 * Math.sin(t * Math.PI * 7) * (t > 0.2 && t < 0.9 ? 1 : 0);
    pts.push([w * sc * 0.5, -t * Lh]);
  }
  s.moveTo(0, 0.004);
  for (const [x, y] of pts) s.lineTo(x, y);
  s.lineTo(0, -Lh - 0.008);
  for (let i = pts.length - 1; i >= 0; i--) s.lineTo(-pts[i][0], pts[i][1]);
  s.lineTo(0, 0.004);
  // a small hole near the top
  const h = new THREE.Path();
  for (let i = 0; i <= 12; i++) { const a = (i / 12) * TAU; const x = Math.cos(a) * 0.006, y = -0.016 + Math.sin(a) * 0.006; if (i === 0) h.moveTo(x, y); else h.lineTo(x, y); }
  s.holes.push(h);
  return s;
}

export function buildBell({ seg = 22 } = {}) {
  const M = new Acc();
  M.addGeo(new THREE.TorusGeometry(0.016, 0.0042, 6, 12), mat4([0, -0.018, 0], [0, Math.PI / 2, 0]), GD(1));
  M.addGeo(new THREE.TorusGeometry(0.013, 0.0048, 6, 12, Math.PI), mat4([0, -0.058, 0], [0, 0, 0], [1, 1.65, 1]), GD(1));
  // body (outer -> lip -> inner as one continuous surface)
  const prof = [[0.001, -0.057], [0.026, -0.059], [0.044, -0.064], [0.055, -0.073], [0.06, -0.085], [0.064, -0.089], [0.064, -0.096], [0.06, -0.1],
    [0.061, -0.16], [0.066, -0.163], [0.066, -0.17], [0.061, -0.174], [0.064, -0.215], [0.07, -0.238], [0.078, -0.254], [0.083, -0.262], [0.081, -0.268],
    [0.072, -0.266], [0.066, -0.25], [0.057, -0.21], [0.052, -0.15], [0.043, -0.085], [0.002, -0.07]].map(([r, y]) => [r, y]);
  superLathe(M, prof.slice().reverse(), { seg, p: 3.2, aspect: 0.86, tag: BB(1), rows: null });
  // clapper (zetsu) + sail (fūshō) swing about the clapper pivot
  const piv = -0.072;
  M.addGeo(new THREE.CylinderGeometry(0.0035, 0.0035, 0.21, 6, 1), mat4([0, piv - 0.105, 0]), [0, 0, 2, piv]);
  lathe(M, [[0.0, -0.25], [0.012, -0.247], [0.018, -0.258], [0.012, -0.27], [0.0, -0.273]], 10, [0, 2, 2, piv]);
  M.addGeo(new THREE.TorusGeometry(0.0075, 0.0022, 5, 10), mat4([0, -0.288, 0]), [0, 1, 2, piv]);
  const sail = extrude(sailShape(0.125, 0.17), 0.0055, 0.0016, 3, 1);
  M.addGeo(sail, mat4([0, -0.29, -0.00275]), [0, 1, 2, piv]);
  return { metal: M };
}
