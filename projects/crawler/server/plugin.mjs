// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import { handleCrawl } from './crawl.mjs';

export function crawlerApi() {
  const install = server => { server.middlewares.use(async (req, res, next) => {
    if (req.url?.split('?')[0] !== '/api/crawl') return next();
    const controller = new AbortController();
    const disconnect = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', disconnect);
    try {
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) if (typeof value === 'string') headers.set(key, value);
      const response = await handleCrawl(new Request(`http://localhost${req.url}`, { method: req.method, headers, signal: controller.signal }));
      res.statusCode = response.status;
      response.headers.forEach((value, key) => res.setHeader(key, value));
      res.end(await response.text());
    } catch {
      if (!res.destroyed) { res.statusCode = 500; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: '페이지를 불러오지 못했습니다.' })); }
    } finally { res.off('close', disconnect); }
  }); };
  return { name: 'wonderworks-crawler-api', configureServer: install, configurePreviewServer: install };
}
