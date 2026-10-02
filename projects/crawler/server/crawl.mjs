// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import http from 'node:http';
import https from 'node:https';
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib';

const MAX_BYTES = 1_500_000;
const MAX_REDIRECTS = 3;
const TIMEOUT = 12_000;
let inFlight = 0;

export class CrawlError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

// This intentionally uses public IPv4 only. DNS is resolved and pinned before
// connecting, including every redirect, so a second lookup cannot rebind to LAN.
export function isPublicIPv4(address) {
  if (isIP(address) !== 4) return false;
  const [a, b, c] = address.split('.').map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)) || (b === 88 && c === 99))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113));
}

export function normalizeUrl(input) {
  if (typeof input !== 'string' || !input.trim() || input.length > 2048) {
    throw new CrawlError('웹사이트 주소를 입력해 주세요.');
  }
  let url;
  try { url = new URL(/^[a-z][a-z\d+.-]*:/i.test(input.trim()) ? input.trim() : `https://${input.trim()}`); }
  catch { throw new CrawlError('올바른 웹사이트 주소를 입력해 주세요.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) {
    throw new CrawlError('기본 포트의 공개 HTTP 또는 HTTPS 주소만 사용할 수 있습니다.');
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!host.includes('.') || /(^|\.)(localhost|local|internal|test|invalid)$/.test(host) ||
    host.includes(':') || (isIP(host) && !isPublicIPv4(host))) {
    throw new CrawlError('공개 웹사이트 주소를 입력해 주세요. 내부 네트워크에는 연결할 수 없습니다.');
  }
  url.hash = '';
  return url;
}

export async function resolvePublicAddress(hostname, resolver = lookup) {
  const records = await resolver(hostname, { all: true, family: 4 });
  if (!records.length || records.some(record => !isPublicIPv4(record.address))) {
    throw new CrawlError('이 주소는 공개 웹사이트로 연결되지 않습니다.');
  }
  return records[0].address;
}

function requestPage(url, address, signal) {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    const request = transport.get(url, {
      signal, family: 4, autoSelectFamily: false, agent: false,
      lookup: (_host, options, done) => options.all ? done(null, [{ address, family: 4 }]) : done(null, address, 4),
      headers: {
        'User-Agent': 'WonderworksCrawler/1.0 (+https://www.aib.vote)',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Encoding': 'gzip, deflate, br',
      },
    }, response => {
      const status = response.statusCode ?? 502;
      if ([301, 302, 303, 307, 308].includes(status)) {
        response.destroy();
        if (!response.headers.location) reject(new CrawlError('이동할 페이지 주소가 없습니다.', 502));
        else {
          try { resolve({ redirect: new URL(response.headers.location, url).href }); }
          catch { reject(new CrawlError('페이지의 이동 주소가 올바르지 않습니다.', 502)); }
        }
        return;
      }
      if (status < 200 || status >= 300) {
        response.destroy();
        reject(new CrawlError(status === 401 || status === 403 || status === 429
          ? '이 사이트가 크롤러 접근을 제한하고 있습니다. 다른 주소나 샘플을 사용해 주세요.'
          : `페이지를 가져오지 못했습니다 (HTTP ${status}).`, 502));
        return;
      }
      const contentType = response.headers['content-type'] ?? '';
      if (!/^(text\/html|application\/xhtml\+xml)(;|$)/i.test(contentType)) {
        response.destroy(); reject(new CrawlError('HTML 웹페이지만 읽을 수 있습니다.', 422)); return;
      }
      if (Number(response.headers['content-length']) > MAX_BYTES) {
        response.destroy(); reject(new CrawlError('페이지가 너무 큽니다. 더 짧은 글의 주소를 입력해 주세요.', 413)); return;
      }
      const encoding = response.headers['content-encoding'];
      const decoder = encoding === 'gzip' ? createGunzip() : encoding === 'br' ? createBrotliDecompress() : encoding === 'deflate' ? createInflate() : null;
      if (encoding && encoding !== 'identity' && !decoder) {
        response.destroy(); reject(new CrawlError('지원하지 않는 페이지 압축 형식입니다.', 422)); return;
      }
      const stream = decoder ? response.pipe(decoder) : response;
      let size = 0;
      const chunks = [];
      response.on('error', reject);
      response.on('aborted', () => { stream.destroy(); reject(new CrawlError('페이지 연결이 중단되었습니다.', 502)); });
      stream.on('error', reject);
      stream.on('data', chunk => {
        size += chunk.length;
        if (size > MAX_BYTES) {
          stream.destroy(); response.destroy(); request.destroy();
          reject(new CrawlError('페이지가 너무 큽니다. 더 짧은 글의 주소를 입력해 주세요.', 413));
        } else chunks.push(chunk);
      });
      stream.on('end', () => {
        try {
          const bytes = Buffer.concat(chunks);
          const declared = contentType.match(/charset\s*=\s*["']?([^;\s"']+)/i)?.[1]
            ?? bytes.subarray(0, 4096).toString('ascii').match(/charset\s*=\s*["']?([\w-]+)/i)?.[1] ?? 'utf-8';
          resolve({ html: new TextDecoder(declared).decode(bytes), url: url.href, bytes: size });
        } catch { reject(new CrawlError('페이지의 문자 인코딩을 읽을 수 없습니다.', 422)); }
      });
    });
    request.on('error', reject);
  });
}

export async function crawl(input, options = {}) {
  const signal = AbortSignal.any([AbortSignal.timeout(TIMEOUT), ...(options.signal ? [options.signal] : [])]);
  const resolveAddress = options.resolveAddress ?? resolvePublicAddress;
  const fetchPage = options.fetchPage ?? requestPage;
  let url = normalizeUrl(input);
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
    signal.throwIfAborted();
    // A hanging OS DNS lookup must not extend the overall request budget.
    const address = await new Promise((resolve, reject) => {
      const abort = () => reject(signal.reason);
      signal.addEventListener('abort', abort, { once: true });
      Promise.resolve(resolveAddress(url.hostname)).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    });
    signal.throwIfAborted();
    const result = await fetchPage(url, address, signal);
    if (!result.redirect) return result;
    url = normalizeUrl(new URL(result.redirect, url).href);
  }
  throw new CrawlError('페이지 이동이 너무 많습니다. 최종 페이지 주소를 입력해 주세요.', 422);
}

export async function handleCrawl(request) {
  const json = (data, status = 200) => Response.json(data, { status, headers: {
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'", 'Referrer-Policy': 'no-referrer',
  } });
  if (request.method !== 'GET') return json({ error: 'GET 요청만 사용할 수 있습니다.' }, 405);
  if (request.headers.get('sec-fetch-site') === 'cross-site') return json({ error: '이 앱에서 주소를 입력해 주세요.' }, 403);
  if (inFlight >= 4) return json({ error: '크롤러가 모두 탐색 중입니다. 잠시 후 다시 시도해 주세요.' }, 429);
  inFlight++;
  try { return json(await crawl(new URL(request.url).searchParams.get('url'), { signal: request.signal })); }
  catch (error) {
    return json({ error: error instanceof CrawlError ? error.message : error.name === 'AbortError' || error.name === 'TimeoutError'
      ? '페이지 응답 시간이 초과되었습니다. 다른 주소로 시도해 주세요.'
      : '사이트에 연결할 수 없습니다. 주소를 확인하거나 샘플을 사용해 주세요.' }, error instanceof CrawlError ? error.status : 502);
  } finally { inFlight--; }
}
