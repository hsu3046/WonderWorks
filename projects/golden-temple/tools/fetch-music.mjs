// Download the film's music, which this repository does not redistribute.
//
// Music: "Finding Movement" by Kevin MacLeod (incompetech.com)
// Licensed under Creative Commons: By Attribution 4.0 — https://creativecommons.org/licenses/by/4.0/
//
// usage: node tools/fetch-music.mjs [--force]
// Writes assets_audio/finding_movement.mp3 (skipped if it already exists), which tools/score.mjs uses.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL_MP3 = 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Finding%20Movement.mp3';
const DEST = path.join(ROOT, 'assets_audio', 'finding_movement.mp3');
const REL = path.relative(ROOT, DEST).split(path.sep).join('/');
// the file the edit points in tools/score.mjs were timed against (4,644,674 bytes)
const SHA256 = 'b8621ea5d156839f3e1b349b6bfd904fdd35c33bf36867cba0e2bdf0307f4019';

const CREDIT = [
  '"Finding Movement" Kevin MacLeod (incompetech.com)',
  'Licensed under Creative Commons: By Attribution 4.0 License',
  'https://creativecommons.org/licenses/by/4.0/',
].join('\n');

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const force = process.argv.includes('--force');

if (!force && fs.existsSync(DEST) && fs.statSync(DEST).size > 0) {
  console.log(`[fetch-music] ${REL} already present, skipping download (use --force to re-download)`);
} else {
  console.log(`[fetch-music] downloading ${URL_MP3}`);
  let buf;
  try {
    const res = await fetch(URL_MP3, { redirect: 'follow', signal: AbortSignal.timeout(120000) });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 100000) throw new Error(`response too small (${buf.length} bytes), not an mp3`);
  } catch (e) {
    console.error(`[fetch-music] download failed: ${e.message}`);
    console.error(`  Download the track by hand from https://incompetech.com (search "Finding Movement")\n  and save it as ${REL}`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(DEST), { recursive: true });
  const tmp = DEST + '.part';
  fs.writeFileSync(tmp, buf);
  fs.renameSync(tmp, DEST);
  console.log(`[fetch-music] wrote ${REL} (${(buf.length / 1048576).toFixed(1)} MB)`);
}

if (sha256(fs.readFileSync(DEST)) !== SHA256) {
  console.warn('[fetch-music] warning: this file differs from the one the score edit was timed against;\n' +
    '  the cut points in tools/score.mjs may not land on the musical hits.');
}
console.log('\nMusic credit (CC BY 4.0, attribution required when you share the film):\n' + CREDIT);
