// Temporal-flicker metric for a rendered film: mean |2 f(t) - f(t-1) - f(t+1)| (luma, 0-255)
// at 480x270. Smooth camera motion largely cancels in the 2nd temporal difference; per-frame
// shimmer / sampling noise does not. Also reports the 1st difference for reference.
// usage: node tools/flickercheck.mjs out/film.mp4 [start=0] [dur=70]
import { spawn } from 'node:child_process';

const [file, start = '0', dur = '70'] = process.argv.slice(2);
if (!file) { console.error('usage: node tools/flickercheck.mjs film.mp4 [start=0] [dur=70]'); process.exit(1); }
const W = 480, H = 270, N = W * H;
const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-ss', start, '-t', dur, '-i', file, '-vf', `scale=${W}:${H},format=gray`, '-f', 'rawvideo', '-']);
ff.on('error', (e) => { if (e.code === 'ENOENT') console.error('[flickercheck] ffmpeg not found; install ffmpeg and put it on PATH'); else console.error('[flickercheck]', e.message); process.exit(1); });
let buf = Buffer.alloc(0);
const frames = [];
const perShot = new Map();
let idx = 0;
ff.stdout.on('data', (d) => {
  buf = Buffer.concat([buf, d]);
  while (buf.length >= N) {
    frames.push(buf.subarray(0, N)); buf = buf.subarray(N);
    if (frames.length === 3) {
      const [a, b, c] = frames;
      let s2 = 0, s1 = 0;
      for (let i = 0; i < N; i++) { s2 += Math.abs(2 * b[i] - a[i] - c[i]); s1 += Math.abs(c[i] - b[i]); }
      const t = +start + (idx + 1) / 60;
      const shot = Math.floor(t / 7);
      const e = perShot.get(shot) || { s2: 0, s1: 0, n: 0 };
      e.s2 += s2 / N; e.s1 += s1 / N; e.n++; perShot.set(shot, e);
      frames.shift(); idx++;
    }
  }
});
ff.on('close', () => {
  let T2 = 0, T1 = 0, n = 0;
  for (const [k, e] of [...perShot].sort((x, y) => x[0] - y[0])) {
    console.log(`shot ${k}: 2nd-diff ${(e.s2 / e.n).toFixed(3)}  1st-diff ${(e.s1 / e.n).toFixed(3)}`);
    T2 += e.s2; T1 += e.s1; n += e.n;
  }
  console.log(`ALL: 2nd-diff ${(T2 / n).toFixed(3)}  1st-diff ${(T1 / n).toFixed(3)}  (${n} frames)`);
});
