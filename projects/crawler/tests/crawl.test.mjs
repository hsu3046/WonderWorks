// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import test from 'node:test';
import assert from 'node:assert/strict';
import { crawl, normalizeUrl, isPublicIPv4, resolvePublicAddress, handleCrawl } from '../server/crawl.mjs';

test('normalizes pasted domains and fragments without permitting credentials', () => {
  assert.equal(normalizeUrl(' example.com/a#part ').href, 'https://example.com/a');
  assert.equal(normalizeUrl('http://example.com:80/a').href, 'http://example.com/a');
  for (const value of ['', null, 'file:///etc/passwd', 'javascript:alert(1)', 'https://u:p@example.com', 'https://example.com:8443']) assert.throws(() => normalizeUrl(value));
});

test('blocks private, loopback, reserved and obfuscated network addresses', () => {
  for (const ip of ['0.0.0.0', '10.0.0.1', '127.0.0.1', '169.254.169.254', '172.16.0.1', '172.31.255.255', '192.168.1.1', '100.64.1.1', '198.18.0.1', '192.0.0.8', '192.0.2.1', '198.51.100.1', '203.0.113.1', '224.0.0.1', '255.255.255.255', '::1', '::ffff:127.0.0.1']) assert.equal(isPublicIPv4(ip), false, ip);
  for (const url of ['http://2130706433', 'http://0x7f000001', 'http://127.1', 'http://0177.0.0.1', 'http://localhost.', 'http://device.local', 'http://[::1]', 'http://[::ffff:127.0.0.1]']) assert.throws(() => normalizeUrl(url), url);
  assert.equal(isPublicIPv4('93.184.215.14'), true);
});

test('rejects a DNS answer containing any private IPv4 address', async () => {
  await assert.rejects(resolvePublicAddress('safe.example.com', async () => [{ address: '93.184.215.14' }, { address: '10.0.0.1' }]));
  assert.equal(await resolvePublicAddress('safe.example.com', async () => [{ address: '93.184.215.14' }]), '93.184.215.14');
});

test('pins each resolved address and validates a redirect before the next connection', async () => {
  const connections = [];
  await assert.rejects(crawl('https://example.com', {
    resolveAddress: async () => '93.184.215.14',
    fetchPage: async (url, address) => { connections.push([url.href, address]); return { redirect: 'http://169.254.169.254/latest/meta-data' }; },
  }));
  assert.deepEqual(connections, [['https://example.com/', '93.184.215.14']]);
});

test('resolves each public redirect separately and returns the final URL', async () => {
  const hosts = [];
  const result = await crawl('https://example.com', {
    resolveAddress: async hostname => { hosts.push(hostname); return '93.184.215.14'; },
    fetchPage: async url => url.hostname === 'example.com' ? { redirect: 'https://www.example.com/article' } : { html: '<h1>Hello</h1>', url: url.href, bytes: 14 },
  });
  assert.deepEqual(hosts, ['example.com', 'www.example.com']);
  assert.equal(result.url, 'https://www.example.com/article');
});

test('bounds redirect loops to four requests', async () => {
  let requests = 0;
  await assert.rejects(crawl('https://example.com', {
    resolveAddress: async () => '93.184.215.14',
    fetchPage: async () => { requests++; return { redirect: 'https://example.com/again' }; },
  }), /이동이 너무 많/);
  assert.equal(requests, 4);
});

test('cancellation also bounds a hanging DNS lookup', async () => {
  const controller = new AbortController();
  const promise = crawl('https://example.com', { signal: controller.signal, resolveAddress: () => new Promise(() => {}) });
  controller.abort();
  await assert.rejects(promise, { name: 'AbortError' });
});

test('API failures remain JSON, uncached, and have actionable errors', async () => {
  const response = await handleCrawl(new Request('http://localhost/api/crawl?url=http://127.0.0.1'));
  assert.equal(response.status, 400);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.match((await response.json()).error, /공개 웹사이트/);
  assert.equal((await handleCrawl(new Request('http://localhost/api/crawl', { method: 'POST' }))).status, 405);
  assert.equal((await handleCrawl(new Request('http://localhost/api/crawl', { headers: { 'sec-fetch-site': 'cross-site' } }))).status, 403);
});
