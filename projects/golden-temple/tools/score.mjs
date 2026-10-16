// Edit the music to the 70 s cut and mux it onto the rendered film.
//
// Music: "Finding Movement" by Kevin MacLeod (incompetech.com)
// Licensed under Creative Commons: By Attribution 4.0 — https://creativecommons.org/licenses/by/4.0/
//
// Edit (track time -> film time):
//   A: track 4.46 s ...        -> film 0 s      (first koto note at film 0.2 s;
//                                                 string crescendo hit 32.46 s lands on the 28 s cut)
//   B: track 85.96 s ... end   -> film 39 s     (biggest hit 88.96 s lands on the 42 s cut to the Buddha)
//   A fades out 38-41 s, B fades in 39-40.5 s, master fade-out 67.5-70 s.
//
// usage: node tools/score.mjs [--video out/temple.mp4] [--out out/temple_final.mp4] [--music assets_audio/finding_movement.mp3]
// The track is not part of this repository: run `npm run fetch-music` first. Needs ffmpeg on PATH.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const o = { video: 'out/temple.mp4', out: 'out/temple_final.mp4', music: 'assets_audio/finding_movement.mp3', score: 'out/score.wav' };
const a = process.argv.slice(2);
for (let i = 0; i < a.length; i++) { const k = a[i].replace(/^--/, ''); if (k in o) o[k] = a[++i]; }

const rel = (p) => path.resolve(ROOT, p);
if (!fs.existsSync(rel(o.music))) {
  console.error(`[score] music file not found: ${o.music}\n` +
    '  The track is not redistributed with this repository. Fetch it with:\n' +
    '    npm run fetch-music\n' +
    '  (or download "Finding Movement" by Kevin MacLeod from incompetech.com and save it at that path)');
  process.exit(1);
}
for (const f of [o.score, o.out]) fs.mkdirSync(path.dirname(rel(f)), { recursive: true });

const A0 = 4.46, FILM = 70.0, B0 = 85.96, B_AT = 39.0;
const ff = (args) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { cwd: ROOT, stdio: 'inherit' });
  if (r.error) { console.error(`[score] could not run ffmpeg (${r.error.code || r.error.message}); install ffmpeg and put it on PATH`); process.exit(1); }
  if (r.status !== 0) process.exit(r.status || 1);
};

// 1) score
const filter = [
  `[0:a]atrim=start=${A0}:end=${A0 + 41},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.6,afade=t=out:st=38:d=3[a]`,
  `[1:a]atrim=start=${B0},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=1.5,adelay=${B_AT * 1000}|${B_AT * 1000}[b]`,
  `[a][b]amix=inputs=2:normalize=0:duration=longest,apad=whole_dur=${FILM},atrim=0:${FILM},afade=t=out:st=${FILM - 2.5}:d=2.5,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[m]`,
].join(';');
ff(['-i', o.music, '-i', o.music, '-filter_complex', filter, '-map', '[m]', '-ac', '2', '-c:a', 'pcm_s24le', o.score]);
console.log('[score] wrote', o.score);

// 2) mux (video stream copied untouched)
if (fs.existsSync(rel(o.video))) {
  ff(['-i', o.video, '-i', o.score, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k',
    '-metadata', 'comment=Music: Finding Movement by Kevin MacLeod (incompetech.com), CC BY 4.0',
    '-movflags', '+faststart', o.out]);
  console.log('[score] wrote', o.out);
} else console.log('[score] video not found, skipped mux:', o.video);
