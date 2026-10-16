// Headless GPU capture of one or more views from a single page load.
//
// usage:
//   node tools/snap.mjs "<base query>" [--view "<query>" <out.png>]...  [--timeout 600]
//   node tools/snap.mjs "shot=3&t=3.5&w=1280&h=720" out/s3.png          (single view shorthand)
//
// The base query is loaded once (world built once); each --view re-renders the
// camera given by its query (shot=&t= | cam=&look=&focal=, post overrides) and
// saves a PNG. Page console errors are printed (prefix [page:error]).
// A lock file serialises GPU use between concurrent callers.
// Needs the dev server (npm run dev). Browser: $CHROME, else a detected Chrome / Edge / Chromium.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome, gpuArgs, assertDevServer } from './lib/chrome.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCK = path.join(ROOT, 'out', '.gpu.lock');
const PORT = process.env.VITE_PORT || 5173;

const args = process.argv.slice(2);
let base = null; const views = []; let timeout = 600;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--view') { views.push({ q: args[i + 1], out: args[i + 2] }); i += 2; }
  else if (a === '--timeout') { timeout = +args[++i]; }
  else if (base === null) base = a;
  else if (!views.length) views.push({ q: '', out: a });
}
if (base === null) { console.error('usage: node tools/snap.mjs "<query>" out.png | --view "<q>" out.png ...'); process.exit(1); }
const bq = new URLSearchParams(base);
const W = +bq.get('w') || 1280, H = +bq.get('h') || 720;
if (!bq.has('mode')) bq.set('mode', 'still');
if (!bq.has('shot') && !bq.has('cam')) bq.set('shot', '0');
if (views.some((v) => v.q)) bq.set('skipfirst', '1');

let lockHeld = false;
async function acquireLock() {
  fs.mkdirSync(path.dirname(LOCK), { recursive: true });
  const start = Date.now();
  for (;;) {
    try { const fd = fs.openSync(LOCK, 'wx'); fs.writeSync(fd, String(process.pid)); fs.closeSync(fd); lockHeld = true; return; } catch {}
    try { const st = fs.statSync(LOCK); if (Date.now() - st.mtimeMs > 15 * 60 * 1000) fs.unlinkSync(LOCK); } catch {}
    if (Date.now() - start > 60 * 60 * 1000) throw new Error('lock wait timeout');
    await new Promise((r) => setTimeout(r, 700));
  }
}
function releaseLock() { if (!lockHeld) return; lockHeld = false; try { fs.unlinkSync(LOCK); } catch {} }
process.on('exit', releaseLock);
process.on('SIGINT', () => { releaseLock(); process.exit(1); });

let CHROME;
try { CHROME = findChrome(); await assertDevServer(PORT); }
catch (e) { console.error('[snap] ' + e.message); process.exit(1); }

await acquireLock();
let browser;
try {
  const launchOpts = (profile) => ({
    executablePath: CHROME,
    headless: true,
    args: [...gpuArgs(), `--window-size=${W},${H}`, '--force-device-scale-factor=1'],
    defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
    protocolTimeout: timeout * 1000,
    userDataDir: profile,
  });
  // the profile (shader cache) can still be held by a just-closed Chrome: retry, then fall back to a fresh profile
  for (let attempt = 0; attempt < 12 && !browser; attempt++) {
    const profile = attempt < 8 ? path.join(ROOT, 'out', '.chrome-profile') : path.join(ROOT, 'out', `.chrome-profile-${process.pid}`);
    try { browser = await puppeteer.launch(launchOpts(profile)); }
    catch (e) { if (attempt === 11) throw e; await new Promise((r) => setTimeout(r, 1500)); }
  }
  const page = await browser.newPage();
  const seen = new Set();
  page.on('console', (m) => {
    const t = m.type(); const txt = m.text();
    if (/Download the React DevTools|\[vite\]|favicon/.test(txt)) return;
    if (/Program Info Log/.test(txt) && !/error/i.test(txt.replace(/warning X\d+/g, ''))) return;
    if (/status of 404/.test(txt)) return;
    const key = t + txt.slice(0, 200);
    if (seen.has(key)) return; seen.add(key);
    if (t === 'error' || t === 'warn' || t === 'warning' || /\[(world|info|gpu|fatal)\]/.test(txt)) console.log(`[page:${t}] ${txt.slice(0, 2000)}`);
  });
  page.on('pageerror', (e) => console.log(`[page:error] ${e.message}`));
  const url = `http://localhost:${PORT}/?${bq.toString()}`;
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'load', timeout: timeout * 1000 });
  await page.waitForFunction('window.__READY === true', { timeout: timeout * 1000, polling: 300 });
  const err = await page.evaluate(() => window.__ERROR || null);
  if (err) console.log('[snap] page error:', err);
  const info = await page.evaluate(() => window.__info || null);
  console.log(`[snap] loaded+first render in ${((Date.now() - t0) / 1000).toFixed(1)}s`, JSON.stringify(info));
  let first = true;
  for (const v of views) {
    let dataUrl;
    const t1 = Date.now();
    if (first && !v.q) {
      dataUrl = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/png'));
    } else {
      dataUrl = await page.evaluate(async (q) => window.__renderView(q), v.q || '');
    }
    first = false;
    if (!dataUrl || !dataUrl.startsWith('data:image')) { console.log('[snap] no image for', v.q, String(dataUrl).slice(0, 300)); continue; }
    const out = path.resolve(ROOT, v.out);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, Buffer.from(dataUrl.split(',')[1], 'base64'));
    console.log(`[snap] wrote ${v.out} (${((Date.now() - t1) / 1000).toFixed(1)}s)`);
  }
} catch (e) {
  console.log('[snap] FAILED:', e.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  releaseLock();
}
