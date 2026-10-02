// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import { pathToFileURL } from 'node:url';
import { isAbsolute } from 'node:path';
import { normalizeUrl, resolvePublicAddress, requestPage } from './crawl.mjs';
import { freezeDocument } from './freeze.mjs';

let active = 0;
const MAX_TOTAL = 16 * 1024 * 1024;
const MAX_RESOURCE = 3 * 1024 * 1024;
const MAX_REQUESTS = 120;
const allowedTypes = new Set(['document', 'stylesheet', 'script', 'image', 'font', 'fetch', 'xhr']);
export const snapshotLimits = { maxBytes: MAX_TOTAL, maxResourceBytes: MAX_RESOURCE, maxRequests: MAX_REQUESTS };

export function abortable(promise, signal) {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve(promise).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

// Chromium never sends its own network traffic. Each resource uses the same
// validated, DNS-pinned transport as the reader, with a per-capture budget.
export function createResourceLoader(signal, options = {}) {
  let count = 0, bytes = 0, reserved = 0;
  const slots = Array.from({ length: 4 }, () => Promise.resolve());
  const resolveAddress = options.resolveAddress ?? resolvePublicAddress;
  const transport = options.transport ?? requestPage;
  const load = async input => {
    signal.throwIfAborted();
    if (bytes >= MAX_TOTAL) throw new Error('Capture resource limit');
    const url = normalizeUrl(input);
    // Reserve memory before concurrent requests begin, not after they finish.
    const allowance = Math.min(MAX_RESOURCE, MAX_TOTAL - bytes - reserved);
    if (allowance <= 0) throw new Error('Capture byte limit');
    reserved += allowance;
    try {
      const address = await abortable(resolveAddress(url.hostname), signal);
      const result = await transport(url, address, signal, { resource: true, maxBytes: allowance });
      signal.throwIfAborted();
      if (result.redirect) return { ...result, redirect: normalizeUrl(result.redirect).href };
      if (result.body.byteLength > allowance) throw new Error('Capture byte limit');
      bytes += result.body.byteLength;
      return result;
    } finally { reserved -= allowance; }
  };
  return input => {
    if (++count > MAX_REQUESTS) return Promise.reject(new Error('Capture resource limit'));
    const index = count % slots.length;
    const job = slots[index].then(() => load(input));
    slots[index] = job.then(() => {}, () => {});
    return abortable(job, signal);
  };
}

function fontRules(styles, assets) {
  let output = '';
  for (const [url, css] of styles) for (const rule of css.match(/@font-face\s*\{[^{}]*\}/gi) ?? []) {
    const embedded = rule.replace(/url\(\s*(["']?)(.*?)\1\s*\)/gi, (_match, _quote, path) => {
      const data = assets.get(new URL(path, url).href);
      return data ? `url("${data}")` : 'url("data:font/woff2;base64,")';
    });
    if (embedded.includes('base64,') && output.length + embedded.length < 4_000_000) output += embedded + '\n';
  }
  return output;
}

export async function renderSnapshot(input, options = {}) {
  normalizeUrl(input);
  const modulePath = options.playwrightModule || process.env.CRAWLER_PLAYWRIGHT_MODULE || 'playwright';
  let chromium;
  try { ({ chromium } = await import(isAbsolute(modulePath) ? pathToFileURL(modulePath).href : modulePath)); }
  catch { throw Object.assign(new Error('Original-view renderer unavailable'), { code: 'RENDERER_UNAVAILABLE' }); }
  if (active >= 2) throw new Error('All renderers are busy');
  active++;
  const signal = AbortSignal.any([AbortSignal.timeout(22_000), ...(options.signal ? [options.signal] : [])]);
  const width = Math.max(360, Math.min(1600, Math.round(options.width || 1060)));
  const height = Math.max(400, Math.min(1200, Math.round(options.height || 534)));
  const resources = new Map(), styles = new Map();
  const load = createResourceLoader(signal, options);
  let browser, close, incomplete = false;
  try {
    signal.throwIfAborted();
    browser = await chromium.launch({ headless: true, chromiumSandbox: true, timeout: 10_000,
      // Deny unrouted requests (including literal IPs and localhost). Routed
      // responses are fulfilled locally; the proxy is never a fetch service.
      proxy: { server: 'http://127.0.0.1:9', bypass: '<-loopback>' },
      args: ['--disable-background-networking', '--disable-extensions', '--force-webrtc-ip-handling-policy=disable_non_proxied_udp'],
    });
    close = () => { void browser.close().catch(() => {}); };
    signal.addEventListener('abort', close, { once: true });
    signal.throwIfAborted();
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, serviceWorkers: 'block', acceptDownloads: false });
    await context.routeWebSocket('**/*', socket => socket.close());
    await context.addInitScript(() => { Object.defineProperty(window, 'RTCPeerConnection', { value: undefined }); });
    const page = await context.newPage();
    const session = await context.newCDPSession(page);
    const { frameTree } = await session.send('Page.getFrameTree');
    const requests = new Map();
    // Playwright routes auto-continue redirected requests. Intercept at the
    // Chromium Fetch boundary so every redirect is validated and fulfilled.
    session.on('Fetch.requestPaused', async event => {
      const { request, requestId } = event;
      const type = event.resourceType.toLowerCase();
      try {
        if (request.method !== 'GET' || !allowedTypes.has(type)) throw new Error('Unsupported request');
        if (type === 'document' && event.frameId !== frameTree.frame.id) throw new Error('Subframe blocked');
        const redirects = event.redirectedRequestId ? (requests.get(event.redirectedRequestId)?.redirects ?? 3) + 1 : 0;
        if (redirects > 3) throw new Error('Redirect limit');
        if (requests.size >= MAX_REQUESTS) throw new Error('Capture request limit');
        const entry = { url: request.url, previous: event.redirectedRequestId, redirects };
        requests.set(requestId, entry);
        const result = await load(request.url);
        const headers = result.cors ? [{ name: 'Access-Control-Allow-Origin', value: result.cors }] : [];
        if (result.redirect) {
          await session.send('Fetch.fulfillRequest', { requestId, responseCode: 302, responseHeaders: [...headers, { name: 'Location', value: result.redirect }] });
          return;
        }
        const mime = result.type.split(';')[0];
        if (type === 'stylesheet') styles.set(request.url, result.body.toString('utf8'));
        if ((type === 'font' || type === 'image') && /^(image\/|font\/|application\/(font|vnd\.ms-fontobject|octet-stream))/.test(mime)) {
          const data = `data:${mime};base64,${result.body.toString('base64')}`;
          // DOM currentSrc and CSS URLs retain the initial address after a
          // redirect. Resolve every validated alias to the captured bytes.
          for (let source = entry; source; source = requests.get(source.previous)) resources.set(source.url, data);
        }
        await session.send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [...headers, { name: 'Content-Type', value: result.type || 'application/octet-stream' }], body: result.body.toString('base64') });
      } catch {
        if (['image', 'font', 'stylesheet'].includes(type)) incomplete = true;
        await session.send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' }).catch(() => {});
      }
    });
    await session.send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
    const response = await page.goto(input, { waitUntil: 'domcontentloaded', timeout: 14_000 });
    if (!response || !response.ok() || !/text\/html|application\/xhtml\+xml/.test(response.headers()['content-type'] ?? '')) throw new Error('No HTML page');
    await page.waitForFunction(() => document.body?.innerText.trim().length >= 30, null, { timeout: 4000 });
    await page.evaluate(async () => {
      for (const image of document.images) image.loading = 'eager';
      await Promise.race([Promise.all([document.fonts.ready, ...Array.from(document.images).slice(0, 80).map(image => image.decode().catch(() => {}))]), new Promise(resolve => setTimeout(resolve, 2500))]);
      for (const animation of document.getAnimations()) animation.pause();
      window.scrollTo(0, 0);
    });
    // Include inline @font-face rules as well as captured external sheets.
    styles.set(page.url(), await page.locator('style').allTextContents().then(parts => parts.join('\n')));
    const snapshot = await page.evaluate(freezeDocument, { assets: [...resources], fonts: fontRules(styles, resources) });
    if (Buffer.byteLength(snapshot.html) > 18 * 1024 * 1024) throw new Error('Snapshot size limit');
    return { ...snapshot, partial: snapshot.partial || incomplete, url: normalizeUrl(page.url()).href, view: 'original', width, height };
  } finally {
    if (close) signal.removeEventListener('abort', close);
    if (browser) await browser.close().catch(() => {});
    active--;
  }
}
