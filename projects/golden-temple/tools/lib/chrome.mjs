// Shared helpers for the tools that drive headless Chrome (snap.mjs, render.mjs):
// locating a Chromium-based browser and the GPU flags used to launch it.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const isFile = (p) => { try { return !!p && fs.statSync(p).isFile(); } catch { return false; } };

function candidates() {
  const list = [];
  if (process.platform === 'win32') {
    const roots = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA,
      'C:\\Program Files', 'C:\\Program Files (x86)'].filter(Boolean);
    for (const r of roots) {
      list.push(
        path.join(r, 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(r, 'Google', 'Chrome Beta', 'Application', 'chrome.exe'),
        path.join(r, 'Google', 'Chrome Dev', 'Application', 'chrome.exe'),
        path.join(r, 'Google', 'Chrome SxS', 'Application', 'chrome.exe'),
        path.join(r, 'Chromium', 'Application', 'chrome.exe'),
        path.join(r, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      );
    }
  } else if (process.platform === 'darwin') {
    for (const r of ['/Applications', path.join(os.homedir(), 'Applications')]) {
      list.push(
        path.join(r, 'Google Chrome.app/Contents/MacOS/Google Chrome'),
        path.join(r, 'Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta'),
        path.join(r, 'Google Chrome Dev.app/Contents/MacOS/Google Chrome Dev'),
        path.join(r, 'Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary'),
        path.join(r, 'Chromium.app/Contents/MacOS/Chromium'),
        path.join(r, 'Microsoft Edge.app/Contents/MacOS/Microsoft Edge'),
      );
    }
  } else {
    const names = ['google-chrome', 'google-chrome-stable', 'google-chrome-beta', 'google-chrome-unstable',
      'chromium', 'chromium-browser', 'microsoft-edge', 'microsoft-edge-stable'];
    const dirs = [...(process.env.PATH || '').split(path.delimiter).filter(Boolean), '/usr/bin', '/usr/local/bin', '/snap/bin'];
    for (const d of dirs) for (const n of names) list.push(path.join(d, n));
    list.push('/opt/google/chrome/chrome', '/opt/microsoft/msedge/msedge');
  }
  return [...new Set(list)];
}

// CHROME env var first, then the usual Chrome / Edge / Chromium install locations.
export function findChrome() {
  const env = process.env.CHROME;
  if (env) {
    if (isFile(env)) return env;
    throw new Error(`CHROME is set to "${env}", but no file exists there.`);
  }
  const hit = candidates().find(isFile);
  if (hit) return hit;
  throw new Error(
    'No Chrome, Edge or Chromium executable found.\n' +
    '  Install Google Chrome, or point the CHROME environment variable at a Chromium-based browser, e.g.\n' +
    '    CHROME="/path/to/chrome" npm run snap -- ...        (macOS / Linux)\n' +
    '    $env:CHROME="C:\\path\\to\\chrome.exe"; npm run snap -- ...   (Windows PowerShell)',
  );
}

// GPU flags. On Windows the D3D11 ANGLE backend is forced (the one the film was rendered with);
// elsewhere Chrome picks its default ANGLE backend. ANGLE=<backend> overrides on any platform.
export function gpuArgs() {
  const angle = process.env.ANGLE || (process.platform === 'win32' ? 'd3d11' : '');
  return [...(angle ? [`--use-angle=${angle}`] : []), '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl',
    '--disable-gpu-watchdog', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'];
}

// Fail fast with a clear message when the Vite dev server is not running.
export async function assertDevServer(port) {
  try {
    const r = await fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(5000) });
    if (r.ok) return;
    throw new Error(`HTTP ${r.status}`);
  } catch (e) {
    throw new Error(`The Vite dev server is not reachable at http://localhost:${port}/ (${e.message}).\n` +
      '  Start it in another terminal first:  npm run dev');
  }
}
