// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createResourceLoader, snapshotLimits } from '../server/snapshot.mjs';

test('snapshot resources pin DNS and refuse private subresources and redirects', async () => {
  const calls = [];
  const load = createResourceLoader(new AbortController().signal, {
    resolveAddress: async () => '93.184.215.14',
    transport: async (url, address) => { calls.push([url.href, address]); return url.pathname === '/redirect' ? { redirect: 'http://169.254.169.254/secret' } : { body: Buffer.from('image'), type: 'image/png' }; },
  });
  await load('https://example.com/image.png');
  await assert.rejects(load('https://example.com/redirect'), /공개 웹사이트/);
  await assert.rejects(load('http://127.0.0.1/private'), /공개 웹사이트/);
  assert.deepEqual(calls.map(call => call[1]), ['93.184.215.14', '93.184.215.14']);
});

test('snapshot limits aggregate bytes, individual resource size, and request count', async () => {
  const load = createResourceLoader(new AbortController().signal, {
    resolveAddress: async () => '93.184.215.14',
    transport: async (_url, _address, _signal, options) => ({ body: Buffer.alloc(options.maxBytes), type: 'image/png' }),
  });
  for (let i = 0; i < Math.ceil(snapshotLimits.maxBytes / snapshotLimits.maxResourceBytes); i++) await load(`https://example.com/${i}`);
  await assert.rejects(load('https://example.com/overflow'), /limit/);
  const tiny = createResourceLoader(new AbortController().signal, {
    resolveAddress: async () => '93.184.215.14', transport: async () => ({ body: Buffer.from('x'), type: 'text/css' }),
  });
  for (let i = 0; i < snapshotLimits.maxRequests; i++) await tiny(`https://example.com/${i}`);
  await assert.rejects(tiny('https://example.com/overflow'), /limit/);
});

test('snapshot resource queue caps concurrency and aborts a hanging DNS lookup', async () => {
  let running = 0, peak = 0;
  const load = createResourceLoader(new AbortController().signal, {
    resolveAddress: async () => '93.184.215.14',
    transport: async () => { running++; peak = Math.max(peak, running); await new Promise(resolve => setTimeout(resolve, 5)); running--; return { body: Buffer.from('x'), type: 'image/png' }; },
  });
  await Promise.all(Array.from({ length: 12 }, (_, i) => load(`https://example.com/${i}`)));
  assert.equal(peak, 4);
  const controller = new AbortController();
  const pending = createResourceLoader(controller.signal, { resolveAddress: () => new Promise(() => {}) })('https://example.com');
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});
