// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
// Optional visual/integration suite. Reuse an existing Playwright installation:
// PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node tests/browser.mjs
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const base = process.env.CRAWLER_URL ?? 'http://127.0.0.1:4183';
const output = fileURLToPath(new URL('../../../docs/validation/crawler/', import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
const passed = [];
const sampleTime = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__crawler?.eaten >= 2, null, { timeout: 12_000 });
  await page.locator('#pause').click();
  const paused = await page.evaluate(() => window.__crawler);
  await sampleTime(600); // Measure that a pause stops callbacks, not just visuals.
  assert.deepEqual(await page.evaluate(() => window.__crawler), paused);
  passed.push('Autonomous feeding; pause stops simulation callbacks');
  await page.screenshot({ path: `${output}/desktop.png`, fullPage: true });

  await page.locator('#reset').click();
  assert.equal(await page.locator('.word.eaten').count(), 0);
  assert.equal((await page.evaluate(() => window.__crawler)).eaten, 0);
  const target = page.locator('.word').filter({ hasText: /^gather$/ }).first();
  const targetBox = await target.boundingBox();
  await target.click();
  await page.locator('#pause').click();
  await page.waitForFunction(() => Array.from(document.querySelectorAll('.word.eaten')).some(word => word.textContent === 'gather'), null, { timeout: 12_000 });
  await page.locator('#pause').click();
  const afterBox = await target.boundingBox();
  assert.deepEqual(afterBox, targetBox);
  passed.push('Click offers the exact word; eating preserves document geometry');

  await page.locator('[data-mode="sentence"]').click();
  await page.locator('#reset').click();
  await page.locator('[data-count="3"]').click();
  await page.locator('#speed').fill('2.4');
  await page.locator('#pause').click();
  await page.waitForFunction(() => window.__crawler?.eaten >= 10, null, { timeout: 12_000 });
  await page.locator('#pause').click();
  assert.equal(await page.locator('[data-count="3"]').getAttribute('aria-pressed'), 'true');
  await page.screenshot({ path: `${output}/colony-sentence.png`, fullPage: true });
  passed.push('Sentence meals, three spiders, and speed changes');

  // Source security: hostile HTML stays in an inert parsing boundary.
  const foreignRequests = [];
  page.on('request', request => { if (request.url().includes('untrusted.invalid')) foreignRequests.push(request.url()); });
  await page.route('**/api/crawl?**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
    url: 'https://example.com/story',
    html: '<title>Safe title</title><base href="https://untrusted.invalid/"><script>window.__injected=true</script><main><h1 onclick="window.__injected=true">A safe story</h1><p>Words remain readable while remote scripts and pictures are never executed inside the living reader.</p><img src="https://untrusted.invalid/pixel" onerror="window.__injected=true"><iframe src="https://untrusted.invalid/frame"></iframe><a href="javascript:alert(1)">Bad link</a><a href="/next">Next page</a></main>',
  }) }));
  await page.locator('#url').fill('example.com/story'); await page.locator('#crawl-button').click();
  await page.waitForFunction(() => window.__crawler?.source === 'live');
  assert.equal(await page.evaluate(() => window.__injected), undefined);
  assert.equal(await page.locator('#article script,#article img,#article iframe').count(), 0);
  assert.deepEqual(foreignRequests, []);
  assert.equal(await page.locator('#links button').count(), 1);
  assert.equal(await page.locator('#links button').first().getAttribute('title'), 'https://example.com/next');
  passed.push('Untrusted HTML cannot run scripts, load subresources, or override link bases');

  await page.unroute('**/api/crawl?**');
  await page.locator('#url').fill('https://example.com'); await page.locator('#crawl-button').click();
  await page.waitForFunction(() => document.querySelector('#source-address')?.textContent === 'example.com/', null, { timeout: 18_000 });
  assert.equal(await page.locator('#error').isVisible(), false);
  if ((await page.evaluate(() => window.__crawler)).view === 'original') {
    assert.equal(await page.locator('.original-page').getAttribute('sandbox'), 'allow-same-origin');
    await page.locator('#view-toggle').click();
    await page.waitForFunction(() => window.__crawler.view === 'reader');
  }
  assert.ok((await page.locator('#article').innerText()).includes('Example Domain'));
  passed.push('Real HTTP fetch of example.com through the shared local API');

  const beforeError = await page.locator('#article').innerText();
  await page.locator('#url').fill('http://127.0.0.1'); await page.locator('#crawl-button').click();
  await page.locator('#error').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#article').innerText(), beforeError);
  assert.match(await page.locator('#error').innerText(), /공개 웹사이트/);
  passed.push('Blocked URL shows an actionable error and preserves the current page');

  // Force a slow request, then restore the sample. A late response cannot win.
  let releaseRequest;
  const gate = new Promise(resolve => { releaseRequest = resolve; });
  await page.route('**/api/crawl?**', async route => {
    await gate;
    try { await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ url: 'https://example.com/late', html: '<h1>Late page</h1><p>This older request must never replace the new sample page selected by the user.</p>' }) }); } catch { /* The browser already cancelled this request. */ }
  });
  await page.locator('#url').fill('example.com/late'); await page.locator('#crawl-button').click();
  await page.locator('#scene-loader').waitFor({ state: 'visible' });
  await page.locator('#demo-button').click(); releaseRequest();
  await sampleTime(200);
  assert.equal((await page.evaluate(() => window.__crawler)).source, 'demo');
  assert.equal(await page.locator('#scene-loader').isVisible(), false);
  await page.unroute('**/api/crawl?**');
  passed.push('Restoring a sample cancels stale page loads');

  // Complete a small page, including its heading, and leave no forever-running RAF.
  await page.route('**/api/crawl?**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ url: 'https://example.com/tiny', html: '<h1>Small habitat</h1><p>A small page has a beginning and an end. Every last word should become a meal.</p>' }) }));
  await page.locator('#url').fill('example.com/tiny'); await page.locator('#crawl-button').click();
  await page.waitForFunction(() => document.querySelector('#source-address')?.textContent === 'example.com/tiny');
  if (!(await page.evaluate(() => window.__crawler.running))) await page.locator('#pause').click();
  try {
    await page.waitForFunction(() => document.querySelector('#scene')?.dataset.state === 'complete', null, { timeout: 25_000 });
  } catch (error) {
    console.error('Completion diagnostic:', await page.evaluate(() => ({ state: window.__crawler, speed: document.querySelector('#speed').value, scroll: scrollY, viewport: document.querySelector('#viewport').getBoundingClientRect().toJSON(), remaining: [...document.querySelectorAll('.word:not(.eaten)')].map(word => ({ text: word.textContent, className: word.className, rect: word.getBoundingClientRect().toJSON() })) })));
    await page.screenshot({ path: `${output}/completion-failure.png`, fullPage: true });
    throw error;
  }
  const completed = await page.evaluate(() => window.__crawler);
  assert.equal(completed.words, completed.eaten);
  await sampleTime(400);
  assert.equal((await page.evaluate(() => window.__crawler)).frames, completed.frames);
  passed.push('Complete pages stop their animation loop');
  await page.unroute('**/api/crawl?**');

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  mobile.on('pageerror', error => errors.push(error.message));
  await mobile.goto(base);
  await mobile.waitForFunction(() => window.__crawler?.words > 0);
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await mobile.locator('#viewport').evaluate(element => { element.scrollTop = 400; });
  assert.ok(await mobile.locator('#viewport').evaluate(element => element.scrollTop) > 0);
  await mobile.waitForFunction(() => window.__crawler?.eaten > 0, null, { timeout: 12_000 });
  await mobile.locator('#pause').tap();
  assert.equal(await mobile.locator('#pause').getAttribute('aria-pressed'), 'true');
  await mobile.screenshot({ path: `${output}/mobile.png`, fullPage: true });
  passed.push('390px layout has no horizontal overflow; scroll and touch pause work');

  const reduced = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  await reduced.goto(base);
  await reduced.waitForFunction(() => window.__crawler?.words > 0);
  assert.equal((await reduced.evaluate(() => window.__crawler)).running, false);
  assert.equal(await reduced.locator('#pause-label').innerText(), '계속 탐색');
  await reduced.locator('#pause').click();
  await reduced.waitForFunction(() => window.__crawler?.eaten > 0);
  await reduced.emulateMedia({ reducedMotion: 'no-preference' });
  // Flush a rendered frame between preference changes: browsers may coalesce
  // back-to-back media overrides and never dispatch the intermediate change.
  await reduced.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await reduced.emulateMedia({ reducedMotion: 'reduce' });
  await reduced.waitForFunction(() => !window.__crawler.running);
  assert.equal(await reduced.locator('#pause-label').innerText(), '계속 탐색');
  passed.push('Reduced motion starts paused and follows live preference changes');
  await reduced.locator('#pause').click();
  await reduced.waitForFunction(() => window.__crawler?.running);
  await reduced.evaluate(() => {
    const spacer = document.createElement('div'); spacer.style.height = '1600px'; document.body.append(spacer);
    window.scrollTo(0, document.body.scrollHeight);
  });
  await sampleTime(150);
  const offscreenFrames = (await reduced.evaluate(() => window.__crawler)).frames;
  await sampleTime(400);
  assert.equal((await reduced.evaluate(() => window.__crawler)).frames, offscreenFrames);
  await reduced.evaluate(() => window.scrollTo(0, 0));
  await reduced.waitForFunction(frames => window.__crawler.frames > frames, offscreenFrames);
  passed.push('Offscreen habitat stops callbacks and resumes exactly one loop');
  let releaseHiddenRequest;
  const hiddenGate = new Promise(resolve => { releaseHiddenRequest = resolve; });
  await reduced.route('**/api/crawl?**', async route => {
    await hiddenGate;
    try { await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ url: 'https://example.com/late', html: '<p>A late page must never restart playback after this document has been hidden or closed.</p>' }) }); } catch { /* Cancelled by pagehide. */ }
  });
  await reduced.locator('#url').fill('example.com/late'); await reduced.locator('#crawl-button').click();
  await reduced.locator('#scene-loader').waitFor({ state: 'visible' });
  await reduced.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  releaseHiddenRequest();
  await sampleTime(150);
  assert.equal((await reduced.evaluate(() => window.__crawler)).running, false);
  assert.equal(await reduced.locator('#scene-loader').isVisible(), false);
  passed.push('Pagehide cancels a pending request without its finally callback restarting playback');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed, pageErrors: errors }, null, 2));
} finally { await browser.close(); }
