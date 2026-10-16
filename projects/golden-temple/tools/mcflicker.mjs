// Motion-compensated flicker metric: predict each odd frame from its even neighbours with
// optical flow (ffmpeg minterpolate) and measure the residual against the real frame.
// Smooth motion is predicted away; shimmer / per-frame noise / flicker remains.
// usage: node tools/mcflicker.mjs film.mp4 [start=0] [dur=7]
import { spawnSync } from 'node:child_process';
const [file, start = '0', dur = '7'] = process.argv.slice(2);
if (!file) { console.error('usage: node tools/mcflicker.mjs film.mp4 [start=0] [dur=7]'); process.exit(1); }
const W = 640, H = 360, N = W * H;
const grab = (vf) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-ss', start, '-t', dur, '-i', file, '-vf', vf, '-f', 'rawvideo', '-'], { maxBuffer: 1 << 30 });
  if (r.error) { const e = r.error; if (e.code === 'ENOENT') console.error('[mcflicker] ffmpeg not found; install ffmpeg and put it on PATH'); else console.error('[mcflicker]', e.message); process.exit(1); }
  return r.stdout;
};
const orig = grab(`scale=${W}:${H},format=gray`);
const pred = grab(`scale=${W}:${H},select='not(mod(n\\,2))',minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,format=gray`);
const nf = Math.min(orig.length, pred.length) / N | 0;
let s = 0, n = 0, hi = 0;
for (let f = 1; f < nf - 1; f += 2) {
  const o = orig.subarray(f * N, (f + 1) * N), p = pred.subarray(f * N, (f + 1) * N);
  // ignore a 12% border: content entering the frame cannot be predicted by flow
  let e = 0, big = 0, cnt = 0;
  const mx = Math.round(W * 0.12), my = Math.round(H * 0.12);
  for (let y = my; y < H - my; y++) for (let x = mx; x < W - mx; x++) {
    const i = y * W + x; const d = Math.abs(o[i] - p[i]); e += d; if (d > 12) big++; cnt++;
  }
  s += e / cnt; hi += big / cnt; n++;
}
console.log(`${file} @${start}s: residual ${(s / n).toFixed(3)} /255, pixels >12: ${(100 * hi / n).toFixed(2)}%  (${n} frames)`);
