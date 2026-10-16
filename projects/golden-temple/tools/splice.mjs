// Replace a frame range of a rendered film with a re-rendered segment (frame-accurate).
// Video only: run tools/score.mjs on the result afterwards to re-mux the score. Needs ffmpeg on PATH.
// usage: node tools/splice.mjs --base out/temple.mp4 --seg out/seg.mp4 --from 2520 --to 2940 --out out/temple_spliced.mp4
//   (seg = node tools/render.mjs --from 2520 --to 2940 --out out/seg.mp4)
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const o = { base: 'out/temple.mp4', seg: 'out/seg.mp4', from: 0, to: 0, out: 'out/temple_spliced.mp4', crf: 12 };
const a = process.argv.slice(2);
for (let i = 0; i < a.length; i++) { const k = a[i].replace(/^--/, ''); if (k in o) o[k] = typeof o[k] === 'number' ? +a[++i] : a[++i]; }
if (!(o.to > o.from)) { console.error('[splice] pass the replaced frame range: --from A --to B (B > A)'); process.exit(1); }
const fc = [
  `[0:v]trim=start_frame=0:end_frame=${o.from},setpts=PTS-STARTPTS[a]`,
  `[1:v]trim=start_frame=0:end_frame=${o.to - o.from},setpts=PTS-STARTPTS[b]`,
  `[0:v]trim=start_frame=${o.to},setpts=PTS-STARTPTS[c]`,
  `[a][b][c]concat=n=3:v=1:a=0,format=yuv420p[v]`,
].join(';');
const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', o.base, '-i', o.seg, '-filter_complex', fc, '-map', '[v]',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', String(o.crf), '-tune', 'film', '-profile:v', 'high',
  '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
  '-bsf:v', 'h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1',
  '-r', '60', '-movflags', '+faststart', o.out], { cwd: ROOT, stdio: 'inherit' });
if (r.error) { console.error(`[splice] could not run ffmpeg (${r.error.code || r.error.message}); install ffmpeg and put it on PATH`); process.exit(1); }
if (r.status !== 0) process.exit(r.status || 1);
console.log('[splice] wrote', o.out);
