// Render all film shots (or a subset) at given times and tile them into a contact sheet.
// usage: node tools/sheet.mjs [--t 3.5] [--shots 0,1,2] [--w 960] [--h 540] [--spp 2] [--tag name] [--extra "vol=1"] [--modules a,b]
// Writes out/sheets/<tag>.jpg (stills in out/sheets/<tag>/). Needs the dev server (npm run dev) and ffmpeg on PATH.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const o = { t: '3.5', shots: '0,1,2,3,4,5,6,7,8,9', w: 960, h: 540, spp: 2, tag: 'sheet', extra: '', modules: '' };
const a = process.argv.slice(2);
for (let i = 0; i < a.length; i++) { const k = a[i].replace(/^--/, ''); if (k in o) o[k] = a[++i]; }
const shots = o.shots.split(',').map(Number);
const times = String(o.t).split(',');
const dir = path.join('out', 'sheets', o.tag);
fs.mkdirSync(path.join(ROOT, dir), { recursive: true });
const args = ['tools/snap.mjs', `w=${o.w}&h=${o.h}&spp=${o.spp}${o.modules ? '&modules=' + o.modules : ''}${o.extra ? '&' + o.extra : ''}`];
const files = [];
for (const s of shots) for (const t of times) {
  const f = path.join(dir, `s${s}_t${t}.png`);
  args.push('--view', `shot=${s}&t=${t}${o.extra ? '&' + o.extra : ''}`, f);
  files.push(f);
}
const r = spawnSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status);
const cols = Math.min(files.length, times.length > 1 ? times.length : 5);
const rows = Math.ceil(files.length / cols);
const inputs = files.flatMap((f) => ['-i', f]);
const layout = files.map((_, i) => `${(i % cols) ? Array.from({ length: i % cols }, () => 'w0').join('+') : '0'}_${Math.floor(i / cols) ? Array.from({ length: Math.floor(i / cols) }, () => 'h0').join('+') : '0'}`).join('|');
const out = path.join('out', 'sheets', `${o.tag}.jpg`);
// xstack needs at least two inputs; a single view is just scaled
const stack = files.length > 1 ? `${files.map((_, i) => `[${i}]`).join('')}xstack=inputs=${files.length}:layout=${layout}:fill=black,` : '[0]';
const ff = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...inputs, '-filter_complex',
  `${stack}scale=${Math.min(2400, cols * 480)}:-1`, '-q:v', '3', out], { cwd: ROOT, stdio: 'inherit' });
if (ff.error) { console.error(`[sheet] could not run ffmpeg (${ff.error.code || ff.error.message}); install ffmpeg and put it on PATH`); process.exit(1); }
if (ff.status === 0) console.log('[sheet] wrote', out);
else process.exit(ff.status || 1);
