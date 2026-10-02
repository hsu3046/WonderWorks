// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { renderSnapshot } from '../server/snapshot.mjs';
import { fixtureUrl, fixtureEntryUrl, fixtureResource } from './snapshot-fixture.mjs';
const modulePath = process.env.PLAYWRIGHT_MODULE ?? 'playwright';
const { chromium } = await import(modulePath);
const font = process.env.SNAPSHOT_TEST_FONT ? await readFile(process.env.SNAPSHOT_TEST_FONT) : null;
const output = new URL('../../../docs/validation/crawler/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [], passed = [];
const snapshots = new Map();

async function capture(width, height) {
  const key = `${width}:${height}`;
  if (!snapshots.has(key)) snapshots.set(key, await renderSnapshot(fixtureEntryUrl, {
    width, height, playwrightModule: modulePath,
    resolveAddress: async host => { assert.ok(host.endsWith('.example.com')); return '93.184.215.14'; },
    transport: async url => fixtureResource(url.href, font),
  }));
  return snapshots.get(key);
}

const geometry = () => Object.fromEntries(['mast', 'headline', 'meal', 'art', 'lower'].map(id => {
  const el = document.getElementById(id), r = el.getBoundingClientRect(), s = getComputedStyle(el);
  return [id, { x: r.x, y: r.y, width: r.width, height: r.height, color: s.color, font: s.fontFamily }];
}));

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(process.env.CRAWLER_URL ?? 'http://127.0.0.1:4183/');
  const dimensions = await page.locator('#viewport').evaluate(el => ({ width: Math.round(el.getBoundingClientRect().width), height: el.clientHeight }));
  const snapshot = await capture(dimensions.width, dimensions.height);
  assert.equal(snapshot.view, 'original');
  assert.equal(snapshot.url, fixtureUrl);
  assert.match(snapshot.html, /data:image\/svg\+xml;base64/);
  if (font) assert.match(snapshot.html, /data:font\/ttf;base64/);
  assert.doesNotMatch(snapshot.html, /<script|<iframe|onerror=/i);

  // Render the source fixture independently and compare its original geometry.
  const source = await browser.newPage({ viewport: dimensions });
  await source.route('**/*', async route => {
    try {
      let r = fixtureResource(route.request().url(), font);
      // The reference serves final asset bytes directly; the capture above
      // must retrieve the same bytes through the fixture's HTTP redirects.
      if (r.redirect) r = fixtureResource(r.redirect, font);
      await route.fulfill({ body: r.body, contentType: r.type, headers: r.cors ? { 'access-control-allow-origin': r.cors } : {} });
    }
    catch { await route.abort(); }
  });
  await source.goto(fixtureUrl);
  await source.evaluate(() => document.fonts.ready);
  const before = await source.evaluate(geometry);
  await source.screenshot({ path: new URL('snapshot-source.png', output).pathname });
  await page.route('**/api/crawl?**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(snapshot) }));
  await page.locator('#url').fill(fixtureUrl); await page.locator('#crawl-button').click();
  await page.waitForFunction(() => window.__crawler.view === 'original' && document.querySelector('#scene-loader').hidden);
  let frame = page.frames()[1];
  const after = await frame.evaluate(geometry);
  for (const id of Object.keys(before)) {
    for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(before[id][key] - after[id][key]) < 0.6, `${id}.${key}: ${before[id][key]} vs ${after[id][key]}`);
    assert.equal(after[id].color, before[id].color);
    assert.equal(after[id].font, before[id].font);
  }
  assert.equal(await frame.locator('#art').evaluate(el => el.complete && el.naturalWidth > 0), true);
  assert.match(await frame.locator('#hydrated').innerText(), /Rendered by JavaScript/);
  if (font) assert.equal(await frame.evaluate(() => document.fonts.check('18px CaptureTest')), true);
  assert.equal(await page.locator('.original-page').getAttribute('sandbox'), 'allow-same-origin');
  await page.screenshot({ path: new URL('snapshot-desktop.png', output).pathname, fullPage: true });
  passed.push('Redirected document/image/font preserve the final URL and original geometry within 0.6px');

  // Click a word split across six original character spans. No new spans are inserted.
  const headline = await frame.locator('#headline').boundingBox();
  const countBefore = await frame.locator('*').count();
  await frame.locator('#headline span').first().click();
  await page.locator('#pause').click();
  await page.waitForFunction(() => window.__crawler.eaten >= 1, null, { timeout: 12_000 });
  await page.locator('#pause').click();
  const eaten = await frame.evaluate(() => [...CSS.highlights.get('crawler-eaten')].map(range => range.toString()));
  assert.ok(eaten.includes('Living'), `Expected whole word; got ${JSON.stringify(eaten)}`);
  assert.equal(await frame.locator('*').count(), countBefore);
  assert.deepEqual(await frame.locator('#headline').boundingBox(), headline);
  await page.screenshot({ path: new URL('snapshot-eaten.png', output).pathname, fullPage: true });
  passed.push('A six-span word is consumed as one word without adding wrappers or changing layout');

  await frame.evaluate(() => window.scrollTo(0, 500));
  await page.waitForFunction(() => document.querySelector('.original-page').contentWindow.scrollY > 0);
  await page.screenshot({ path: new URL('snapshot-scroll.png', output).pathname, fullPage: true });
  await page.locator('#reset').click();
  await page.waitForFunction(() => document.querySelector('#scene-loader').hidden && window.__crawler.eaten === 0);
  frame = page.frames()[1];
  assert.equal(await frame.evaluate(() => CSS.highlights.get('crawler-eaten').size), 0);
  assert.equal(await frame.evaluate(() => scrollY), 0);
  await page.locator('#view-toggle').click();
  await page.waitForFunction(() => window.__crawler.view === 'reader');
  assert.match(await page.locator('#article').innerText(), /Living/);
  await page.locator('#view-toggle').click();
  await page.waitForFunction(() => window.__crawler.view === 'original');
  passed.push('Original-page scrolling, restore, and reader/original switching work');

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  mobile.on('pageerror', e => errors.push(e.message));
  await mobile.goto(process.env.CRAWLER_URL ?? 'http://127.0.0.1:4183/');
  await mobile.route('**/api/crawl?**', async route => {
    const params = new URL(route.request().url()).searchParams;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(await capture(Number(params.get('width')), Number(params.get('height')))) });
  });
  await mobile.locator('#url').fill(fixtureUrl); await mobile.locator('#crawl-button').tap();
  await mobile.waitForFunction(() => window.__crawler.view === 'original');
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  const mobileFrame = mobile.frames()[1];
  const columns = await mobileFrame.locator('#hero').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  assert.equal(columns, 1);
  await mobile.screenshot({ path: new URL('snapshot-mobile.png', output).pathname, fullPage: true });
  passed.push('390px capture uses the original responsive single-column layout without outer overflow');

  // Treat even a forged original-view response as untrusted input.
  let remoteRequests = 0;
  await page.route('**/untrusted.invalid/**', route => { remoteRequests++; return route.abort(); });
  await page.unroute('**/api/crawl?**');
  await page.route('**/api/crawl?**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...snapshot, html: '<html><head><meta http-equiv="refresh" content="0;url=https://untrusted.invalid/jump"><style>@import "https://untrusted.invalid/css";p{background:url(https://untrusted.invalid/pixel)}</style></head><body><h1>Isolated original view</h1><p onclick="parent.__injected=true">This text remains readable while unsafe scripts and requests stay blocked.</p><script>parent.__injected=true</script><img src="https://untrusted.invalid/image" onerror="parent.__injected=true"><iframe src="https://untrusted.invalid/frame"></iframe></body></html>' }) }));
  await page.locator('#url').fill(fixtureUrl); await page.locator('#crawl-button').click();
  await page.waitForFunction(() => document.querySelector('#scene-loader').hidden && window.__crawler.view === 'original');
  assert.equal(await page.evaluate(() => window.__injected), undefined);
  assert.equal(await page.frames()[1].locator('script,iframe,meta[http-equiv="refresh"],[onclick],[onerror]').count(), 0);
  assert.equal(remoteRequests, 0);
  passed.push('Forged snapshot scripts, handlers, frames, refresh navigation and external CSS/image requests are blocked');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed, pageErrors: errors, webfontTested: !!font }, null, 2));
} finally { await browser.close(); }
