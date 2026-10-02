# Webcrawler architecture

© 2026 AIB Inc. — GNU GPL v3. Added 2026-10-02.

`projects/crawler` is an independent Vite + strict TypeScript study, package `vote.aib.wonderworks-crawler`, development port **4183**. Its original 2D wireframe rendering follows the supplied clip's jointed legs and floating text fragments. No graphics or parser dependency was added. Original-design capture optionally reuses a server-side Playwright/Chromium installation; reader and sample work without it.

## Data flow

1. `src/main.ts` owns loading, controls, cancellation, reader replacement, activity log, counters and original/reader switching.
2. The app submits `GET /api/crawl?url=…&view=original&width=…&height=…`. Capture width determines the original responsive layout.
3. `server/snapshot.mjs` opens the public page in a separate sandboxed Chromium process and waits for visible text and bounded font/image readiness. `server/freeze.mjs` copies visible DOM, computed styles, simple pseudo-elements and SVG geometry into an inert document. Images/fonts are embedded from resources already fetched. Video/canvas/subframes and live site behavior are not replayed.
4. All capture resources use `server/crawl.mjs`'s public IPv4 / DNS-pinned transport, including redirected resources. Chromium has an unreachable proxy for unrouted traffic, blocked service workers/WebSockets/WebRTC, no forwarded cookies and GET-only requests. Limits: two capture processes, four concurrent resource fetches per capture, 120 requests, 3 MB per resource, 16 MB total downloaded bytes, 22 seconds, 3,000 DOM/text nodes, 12,000 vertical pixels and 18 MB serialized HTML. Memory is reserved before concurrent downloads. IPv6-only destinations are unsupported. Renderer absence, timeout or capture failure falls back to the 12-second / 1.5 MB HTML reader.
5. Reader view uses `src/reader.ts` and an inert template, rebuilding article text into fresh elements. Source scripts/styles/media never mount in the reader. Relative links use the final URL, without trusting a source base element.
6. Original view uses `src/snapshot.ts` and an iframe with `sandbox="allow-same-origin"`, with **no allow-scripts**. Executable/navigation attributes are removed. An initial CSP blocks scripts, connections, frames, objects, external images/fonts and forms. Only embedded image/font data and inline styles are allowed. Source styles cannot affect the surrounding application.
7. `Intl.Segmenter` maps reader words to spans (120 blocks / 20,000 characters) or original-page words to `Range` objects (4,000 words). Text is grouped across inline/character spans before segmentation. CSS Custom Highlights tint/hide ranges without changing source DOM or line wrapping. Browsers without this API use reader view.
8. `src/spider.ts` measures words after content, viewport, font or frame-scroll changes. One Canvas 2D loop draws either surface. Frame scrolling, pointer coordinates and capture scaling use the same coordinate system. Resizing scales the frozen capture; loading again captures the new responsive width.

The API has a four-request in-process concurrency guard; it is not a distributed rate limiter. It returns JSON with no-store and no permissive CORS. No fetch history, credentials or page content are persisted. One explicit user action triggers one bounded page capture (with its resources) or reader operation; discovered links do not crawl automatically.

Capture intercepts requests through Chromium's CDP Fetch domain because Playwright's high-level routing automatically continues redirect hops. Each hop stays in the validated transport, preserves source CORS headers, and records original-to-final image/font aliases so `currentSrc` and CSS URLs still resolve to embedded assets. The browser retains the final document URL and normal relative-resource behavior.

## Movement and ownership

`src/legs.ts` defines four mirrored leg pairs, all attached to the front body (cephalothorax), with a separate rear abdomen. Each pair has its own rest lengths, IK bend pole and non-overlapping angular sector. A shared bend sign was incorrect for the rear pair: at rest it put the knee 6.7 units across the body centerline. Selecting the pair-specific IK branch and constraining each complete chain to its own fan fixes that crossing, including when turning or resizing.

Eight feet use stance and swing phases. Two alternating groups, each with two legs per side, lift four feet while the other four support the body. Ordinary stance remains planted; sharp turns have bounded reach so a foot cannot drag across a neighboring fan. Foot lift is indicated by its tip, rather than an arbitrary screen-up offset. Body turns are rate-limited and forward travel slows while turning. The geometry tests exercise pair count, symmetry, no crossings, fixed stance, group alternation, reversal, resizing and 30/60/120 fps updates.

Each spider reserves one visible uneaten word. Clicks assign the selected word to the nearest spider. Sentence mode consumes the target sentence while respecting reservations owned by other spiders. Eaten spans become invisible without changing dimensions, and canvas copies lift, rotate, shrink and fly into the mouth. Counters describe removed words, not HTTP requests.

On reaching a target, the spider holds still and drives three quick mouth open–close cycles over a 0.56-second pulse at normal speed. The reserved word remains visible throughout chewing. Only after the third bite finishes does the meal hide its word spans, start the consumption fragments, and update the counter/log. The squared sine keeps each bite smooth and returns the mouth to its resting shape between bites; playback speed and pause share the simulation clock. Releasing or replacing a target cancels unfinished chewing, so no timer can remove an old word after retargeting, scrolling, resizing or restoring the page.

Only one requestAnimationFrame scheduler is active. User pause, hidden document, an offscreen habitat, or completed content cancels continuous scheduling. Resize/scroll during pause permits one static redraw. Resume resets the time baseline; a bounded delta avoids catching up hidden time. Silk trails and consumption fragments are capped/expired. Listeners, observers and the loop are disposed on Vite replacement. Browser back/forward restoration stays paused.

The initial reduced-motion preference pauses the simulation. A live change to reduced motion pauses it again; deliberate resume is available. The page uses semantic controls, visible focus, a keyboard pause shortcut and a separately scrollable reader.

## Integration

- `server/plugin.mjs`: adds the same API to both crawler and gallery Vite dev/preview servers. Its hooks return void, because returning Connect's app would be interpreted as a Vite post hook.
- `api/crawl.mjs`: Vercel Node Web Handler reexporting the shared implementation. No deployment has been performed as part of local implementation.
- `scripts/link-tools.mjs`, `build.mjs`, `check.mjs`, `package-sources.mjs`: shared toolchain, build, checks and standalone archive.
- Gallery catalog, real recorded MP4 and JPEG poster use the existing single-video hover controller. `?preview=1` shows a habitat-only composition for recording and explicit live preview.
- Unknown reference authorship is explicit; no creator URL is invented.

## Boundaries and references

Original view is a static copy of a public rendered page, with a semantic reader fallback. The source website remains untouched. Login-required/bot-blocked sites, POST-dependent content, canvas/video, nested frames and live interactions are unsupported or may be incomplete. Complex shadow DOM and generated CSS content are not guaranteed. Word fragments drawn on the parent canvas can use a fallback face when a captured custom font is scoped to the iframe. A static host without `/api/crawl` supports the sample only. Production capture needs an explicitly configured Playwright/Chromium runtime; Vercel deployment was not performed or verified.

The Vercel adapter follows its [Web Handler API](https://vercel.com/docs/functions/functions-api-reference). The HTTP transport uses Node's [HTTPS request options](https://nodejs.org/api/https.html) and [DNS lookup](https://nodejs.org/api/dns.html) with a pinned lookup callback to keep validation and connection targets identical.
