# Webcrawler

A small appetite. An endless web. A wireframe spider walks across a page and eats words or sentences. Original implementation © 2026 [AIB Inc.](https://www.aib.vote), GNU GPL v3.

## Run

From the Wonderworks root, after the shared toolchain is set up:

```sh
npm run dev --prefix projects/crawler
```

Open http://127.0.0.1:4183. The sample and text reader need no API keys or additional runtime dependencies.

For original-design capture, supply an existing Playwright installation with Chromium available. Copy `.env.example` to `.env.local` in this project and set `CRAWLER_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs`, or set that server environment variable before starting Vite. The optional renderer runs on the server; its path is never sent to the browser. If unavailable, the same address opens in reader view. Installing Playwright/Chromium is a separate operator step; no package or browser is automatically downloaded.

For the standalone source download, install this directory's declared local development dependencies (`npm install`), then run `npm run dev`. Node.js 24+ is required. `npm run build` creates a static frontend; `npm run preview` serves it with the same local reader API.

## Play

- Enter a public HTTP(S) page address and select **탐색 시작**. Both a bare domain and a full URL work.
- Select **랜덤** beside it to load one of 100 curated reading pages immediately (19 Korean, 81 English). Pages do not repeat within a round; the current page is skipped. Nothing is prefetched. The source list and capture checks are in `docs/crawler/RANDOM_PAGES.md` in the repository, or `docs/RANDOM_PAGES.md` in the standalone download.
- Live pages first try **ORIGINAL VIEW**, preserving captured layout, images, fonts and colors. **본문 보기 / 원본 보기** switches between the captured page and the reader and restarts the meal. Source links are offered below the habitat; clicking text inside either view feeds the spider.
- The initial **샘플 페이지** is original AIB prose, including English and Korean. It needs no network connection.
- Click a word to direct the nearest spider toward it. **단어 / 문장** selects individual words or a whole sentence.
- Adjust **PACE**, select one to three spiders, and toggle **SILK TRAIL**.
- **일시정지** or Space pauses; **페이지 복원** restores the current page and preserves settings.
- Scroll inside the reading habitat to offer more text. **FOLLOW A THREAD** loads a discovered page only when clicked.
- Reduced-motion preferences start the experiment paused. Resume explicitly to watch it.

## What is being fetched

Original view opens the public page in a separate Chromium process, lets its JavaScript render, then copies visible DOM and computed styles with embedded images/fonts. The displayed copy cannot execute site scripts or make external requests. The layout is captured at the habitat width; later resizing scales that capture, while loading again captures the new width. Videos, canvas, embedded frames, login-dependent content and live navigation are not reproduced. Missing resources or long-page truncation are reported.

Capture is bounded to two browsers per process, 22 seconds, 120 requests, four concurrent resource fetches, 3 MB per resource and 16 MB total downloaded resources. Every request/redirect uses validated public IPv4 and pinned DNS; no cookies or POST requests are forwarded. If capture is unavailable or fails, the 12-second / 1.5 MB text reader reconstructs headings, paragraphs, lists and quotes. Non-HTML, private-network, oversized, blocked and IPv6-only pages can fail; a complete load failure preserves the current habitat.

The page's original URL is available through **↗** beside the view badge. The original site is not modified. Remote page content is not logged or stored. Existing page text remains subject to its original rights; the GPL applies to AIB's code and sample, not fetched pages.

## Checks

```sh
npm run check --prefix projects/crawler
npm run test --prefix projects/crawler
npm run build --prefix projects/crawler
```

`tests/browser.mjs` is an optional Playwright integration suite. It reuses an existing installation rather than adding a test dependency. Run the dev server, then:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node projects/crawler/tests/browser.mjs
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node projects/crawler/tests/feeding.browser.mjs
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node projects/crawler/tests/snapshot.browser.mjs
```

The suite tests actual fetching from example.com, untrusted HTML isolation, request races, frame stopping, preserved text layout, word/sentence meals, mobile taps, and reduced motion. `CRAWLER_URL` can override the local URL. Screenshots go to the Git-ignored `docs/validation/crawler/` directory.

The focused feeding suite checks three rendered mouth movements before a word disappears, plus pause/resume, retargeting and reset during chewing. It uses the development server and sample page.

The snapshot suite captures an original AIB fixture through the real renderer, compares source/copy geometry, tests image embedding and JavaScript-rendered text, consumes a word spanning several elements, and checks switching, scrolling, narrow layout and isolation. Set `SNAPSHOT_TEST_FONT` to a local `.ttf` to also test font embedding; that font is read only for the test and is not saved in the project.

## Provenance

Inspired by [༺ཧคlคฝคཊ༻ (@rybinfx)](https://x.com/rybinfx), identified by the project owner on 2026-10-03. Visual reference: user-supplied `KAW8qq-EfhNOR8AM.mp4` (16.7 seconds). The reference recording is not included in releases. All geometry, code, sample prose, and gallery recordings are original AIB implementation. No source or assets were copied from the reference.

See `docs/crawler/ARCHITECTURE.md` in the repository, or `docs/ARCHITECTURE.md` in the standalone source archive.
