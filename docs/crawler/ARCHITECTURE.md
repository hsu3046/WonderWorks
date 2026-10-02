# Webcrawler architecture

© 2026 AIB Inc. — GNU GPL v3. Added 2026-10-02.

`projects/crawler` is an independent Vite + strict TypeScript study, package `vote.aib.wonderworks-crawler`, development port **4183**. Its original 2D wireframe rendering follows the supplied clip's jointed legs and floating text fragments. No graphics or parser dependency was added.

## Data flow

1. `src/main.ts` owns loading, controls, cancellation, reader replacement, activity log, and counters.
2. The user submits a URL to same-origin `GET /api/crawl?url=…`.
3. `server/crawl.mjs` validates the scheme/host/port, resolves public IPv4, pins the connection to the validated address, and repeats validation for each redirect. It requests HTML with an honest crawler User-Agent, no cookies, a 12-second total deadline, at most three redirects, and a 1.5 MB limit on decompressed content. Gzip, deflate, Brotli and declared text charsets are supported. IPv6-only destinations are deliberately unsupported.
4. `src/reader.ts` parses HTML in an inert `<template>`, selects article/main content when available, and creates a fresh tree with textContent. Source scripts, event handlers, images, styles, forms, iframes and attributes are never adopted. Relative links resolve against the final response URL; source `<base>` tags have no authority. Unsafe link protocols and credential URLs are discarded.
5. `Intl.Segmenter` maps sentences and words to spans while preserving punctuation and whitespace. Content is bounded to 120 blocks and 20,000 characters, with a visible truncation note.
6. `src/spider.ts` measures word positions after content/viewport/font changes. One Canvas 2D loop draws the colony and fragments over the scrollable reader.

The API has a four-request in-process concurrency guard; it is not a distributed rate limiter. It returns JSON with no-store and no permissive CORS. No fetch history, credentials or page content are persisted. One explicit user action triggers one fetch operation; discovered links do not crawl automatically.

## Movement and ownership

`src/legs.ts` defines four mirrored leg pairs, all attached to the front body (cephalothorax), with a separate rear abdomen. Each pair has its own rest lengths, IK bend pole and non-overlapping angular sector. A shared bend sign was incorrect for the rear pair: at rest it put the knee 6.7 units across the body centerline. Selecting the pair-specific IK branch and constraining each complete chain to its own fan fixes that crossing, including when turning or resizing.

Eight feet use stance and swing phases. Two alternating groups, each with two legs per side, lift four feet while the other four support the body. Ordinary stance remains planted; sharp turns have bounded reach so a foot cannot drag across a neighboring fan. Foot lift is indicated by its tip, rather than an arbitrary screen-up offset. Body turns are rate-limited and forward travel slows while turning. The geometry tests exercise pair count, symmetry, no crossings, fixed stance, group alternation, reversal, resizing and 30/60/120 fps updates.

Each spider reserves one visible uneaten word. Clicks assign the selected word to the nearest spider. Sentence mode consumes the target sentence while respecting reservations owned by other spiders. Eaten spans become invisible without changing dimensions, and canvas copies lift, rotate, shrink and fly into the mouth. Counters describe removed words, not HTTP requests.

Only one requestAnimationFrame scheduler is active. User pause, hidden document, an offscreen habitat, or completed content cancels continuous scheduling. Resize/scroll during pause permits one static redraw. Resume resets the time baseline; a bounded delta avoids catching up hidden time. Silk trails and consumption fragments are capped/expired. Listeners, observers and the loop are disposed on Vite replacement. Browser back/forward restoration stays paused.

The initial reduced-motion preference pauses the simulation. A live change to reduced motion pauses it again; deliberate resume is available. The page uses semantic controls, visible focus, a keyboard pause shortcut and a separately scrollable reader.

## Integration

- `server/plugin.mjs`: adds the same API to both crawler and gallery Vite dev/preview servers. Its hooks return void, because returning Connect's app would be interpreted as a Vite post hook.
- `api/crawl.mjs`: Vercel Node Web Handler reexporting the shared implementation. No deployment has been performed as part of local implementation.
- `scripts/link-tools.mjs`, `build.mjs`, `check.mjs`, `package-sources.mjs`: shared toolchain, build, checks and standalone archive.
- Gallery catalog, real recorded MP4 and JPEG poster use the existing single-video hover controller. `?preview=1` shows a habitat-only composition for recording and explicit live preview.
- Unknown reference authorship is explicit; no creator URL is invented.

## Boundaries and references

This is a semantic reader, not a screenshot proxy, browser automation service, or full-site spider. JavaScript-only/login-required/bot-blocked sites can fail, and source images/design are not reproduced. The original website remains untouched. A static host without `/api/crawl` supports the sample only.

The Vercel adapter follows its [Web Handler API](https://vercel.com/docs/functions/functions-api-reference). The HTTP transport uses Node's [HTTPS request options](https://nodejs.org/api/https.html) and [DNS lookup](https://nodejs.org/api/dns.html) with a pinned lookup callback to keep validation and connection targets identical.
