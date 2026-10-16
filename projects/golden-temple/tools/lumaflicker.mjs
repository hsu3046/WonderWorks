// Light/shadow flicker metric: mean luma of a 4x4 grid of screen regions per frame;
// flicker = |L(t) - (L(t-1)+L(t+1))/2| (high-pass of each region's brightness over time).
// Smooth exposure/lighting changes and camera drift cancel; frame-to-frame brightness
// jitter (shadow/light flicker) remains. Frames next to cuts (every 7 s) are skipped.
// usage: node tools/lumaflicker.mjs film.mp4
import { spawn } from 'node:child_process';
const file = process.argv[2];
if (!file) { console.error('usage: node tools/lumaflicker.mjs film.mp4'); process.exit(1); }
const W = 320, H = 180, N = W * H, G = 4;
const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-vf', `scale=${W}:${H},format=gray`, '-f', 'rawvideo', '-']);
ff.on('error', (e) => { if (e.code === 'ENOENT') console.error('[lumaflicker] ffmpeg not found; install ffmpeg and put it on PATH'); else console.error('[lumaflicker]', e.message); process.exit(1); });
let buf = Buffer.alloc(0); const L = [];
ff.stdout.on('data', (d) => {
  buf = Buffer.concat([buf, d]);
  while (buf.length >= N) {
    const f = buf.subarray(0, N); buf = buf.subarray(N);
    const r = new Float64Array(G * G);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) r[((y * G / H) | 0) * G + ((x * G / W) | 0)] += f[y * W + x];
    for (let i = 0; i < r.length; i++) r[i] /= N / (G * G);
    L.push(r);
  }
});
ff.on('close', () => {
  const per = new Map(); let all = 0, n = 0, worst = 0, wt = 0;
  for (let t = 1; t < L.length - 1; t++) {
    const sec = t / 60; if (sec % 7 < 0.05 || sec % 7 > 6.95) continue;
    let e = 0; for (let i = 0; i < G * G; i++) e += Math.abs(L[t][i] - (L[t - 1][i] + L[t + 1][i]) / 2);
    e /= G * G; all += e; n++; if (e > worst) { worst = e; wt = sec; }
    const s = Math.floor(sec / 7); const p = per.get(s) || [0, 0]; p[0] += e; p[1]++; per.set(s, p);
  }
  console.log(file, 'shots:', [...per].map(([s, [a, c]]) => `${s}:${(a / c).toFixed(3)}`).join(' '));
  console.log(`  ALL mean ${(all / n).toFixed(4)} /255   worst ${worst.toFixed(3)} @ ${wt.toFixed(2)}s`);
});
