// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
// PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node tests/feeding.browser.mjs
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch({ headless: true });
const pageErrors = [];
const passed = [];

function assertMeal(frames) {
  assert.ok(frames.length > 6);
  const before = frames.slice(0, -1), after = frames.at(-1);
  assert.ok(before.every(frame => frame.visible && !frame.eaten && frame.total === 0), 'word and counter must stay unchanged while chewing');
  assert.equal(after.pulse, 0);
  assert.equal(after.visible, false);
  assert.equal(after.eaten, true);
  assert.equal(after.total, 1);
  // A paused static redraw repeats the same phase. It is not a new crest
  // when playback resumes halfway up the mouth-opening movement.
  const moving = frames.filter((frame, i) => i === 0 || frame.pulse !== frames[i - 1].pulse);
  const peaks = moving.filter((frame, i) => i > 0 && i < moving.length - 1 && frame.width > moving[i - 1].width && frame.width >= moving[i + 1].width).length;
  assert.equal(peaks, 3, 'render three mouth open–close cycles before removal');
}

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' });
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(process.env.CRAWLER_URL ?? 'http://127.0.0.1:4183/');
  await page.waitForFunction(() => window.__crawler?.words > 0);
  await page.evaluate(async () => {
    // Observe the running module, including Vite's HMR identity, without
    // replacing its update logic or calculating a second copy of the bite wave.
    const loaded = performance.getEntriesByType('resource').find(entry => new URL(entry.name).pathname === '/src/spider.ts');
    const { SpiderWorld } = await import(loaded.name);
    const originalDraw = SpiderWorld.prototype.drawSpider;
    SpiderWorld.prototype.drawSpider = function (spider) {
      const paths = [], originalStroke = this.stroke;
      this.stroke = function (points, ...args) {
        if (points.length === 3) paths.push(points);
        return originalStroke.call(this, points, ...args);
      };
      try { originalDraw.call(this, spider); } finally { this.stroke = originalStroke; }
      const probe = window.__feedingProbe;
      if (!probe || probe.complete || spider.id !== 0) return;
      if (!probe.target && spider.chewing) probe.target = spider.target;
      if (!probe.target) return;
      const [left, right] = paths.slice(-2);
      probe.frames.push({
        pulse: spider.pulse,
        width: Math.hypot(left[1].x - right[1].x, left[1].y - right[1].y),
        visible: getComputedStyle(probe.target.element).visibility !== 'hidden',
        eaten: probe.target.eaten,
        total: Number(document.querySelector('#eaten-count').textContent),
      });
      if (probe.target.eaten) probe.complete = true;
      if (probe.pauseAt && spider.chewing && spider.pulse <= probe.pauseAt && !probe.paused) {
        probe.paused = true;
        this.setRunning(false);
      }
    };
  });
  const arm = pauseAt => page.evaluate(value => {
    window.__feedingProbe = { frames: [], target: null, complete: false, paused: false, pauseAt: value };
  }, pauseAt);
  const finish = async () => {
    await page.waitForFunction(() => window.__feedingProbe.complete, null, { timeout: 12_000 });
    await page.locator('#pause').click();
    assertMeal(await page.evaluate(() => window.__feedingProbe.frames));
  };
  const pauseDuringMeal = async () => {
    await page.locator('#reset').click();
    await arm(0.6);
    await page.locator('#pause').click();
    await page.waitForFunction(() => window.__feedingProbe.paused, null, { timeout: 12_000 });
  };

  await arm(0);
  await page.locator('#pause').click();
  await finish();
  passed.push('Word remains visible through three rendered bites, then disappears and increments the counter');

  await pauseDuringMeal();
  const paused = await page.evaluate(() => window.__feedingProbe.frames.at(-1));
  await new Promise(resolve => setTimeout(resolve, 650));
  assert.deepEqual(await page.evaluate(() => window.__feedingProbe.frames.at(-1)), paused);
  assert.equal(await page.locator('.word.eaten').count(), 0);
  await page.locator('#pause').click();
  await finish();
  passed.push('Pause freezes chewing and preserves the word; resume completes the remaining bites');

  await pauseDuringMeal();
  const cancelledId = await page.evaluate(() => window.__feedingProbe.target.id);
  const replacement = page.locator('.word').filter({ hasText: /^gather$/ }).first();
  assert.notEqual(await replacement.getAttribute('data-word'), String(cancelledId));
  await replacement.click();
  await arm(0);
  await page.locator('#pause').click();
  await finish();
  assert.equal(await page.locator(`.word[data-word="${cancelledId}"]`).evaluate(element => element.classList.contains('eaten')), false);
  assert.equal(await replacement.evaluate(element => element.classList.contains('eaten')), true);
  passed.push('Offering another word cancels the old bite sequence without consuming the old target');

  await pauseDuringMeal();
  await page.locator('#reset').click();
  await new Promise(resolve => setTimeout(resolve, 650));
  assert.equal(await page.locator('.word.eaten').count(), 0);
  assert.equal(Number(await page.locator('#eaten-count').textContent()), 0);
  await arm(0);
  await page.locator('#pause').click();
  await finish();
  passed.push('Reset discards unfinished chewing; the restored page starts a full new three-bite meal');

  assert.deepEqual(pageErrors, []);
  console.log(JSON.stringify({ passed, pageErrors }, null, 2));
} finally { await browser.close(); }
