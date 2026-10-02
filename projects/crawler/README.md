# Webcrawler

A small appetite. An endless web. A wireframe spider walks across a page and eats words or sentences. Original implementation © 2026 [AIB Inc.](https://www.aib.vote), GNU GPL v3.

## Run

From the Wonderworks root, after the shared toolchain is set up:

```sh
npm run dev --prefix projects/crawler
```

Open http://127.0.0.1:4183. No API keys or additional runtime dependencies are needed.

For the standalone source download, install this directory's declared local development dependencies (`npm install`), then run `npm run dev`. Node.js 24+ is required. `npm run build` creates a static frontend; `npm run preview` serves it with the same local reader API.

## Play

- Enter a public HTTP(S) page address and select **탐색 시작**. Both a bare domain and a full URL work.
- The initial **샘플 페이지** is original AIB prose, including English and Korean. It needs no network connection.
- Click a word to direct the nearest spider toward it. **단어 / 문장** selects individual words or a whole sentence.
- Adjust **PACE**, select one to three spiders, and toggle **SILK TRAIL**.
- **일시정지** or Space pauses; **페이지 복원** restores the current page and preserves settings.
- Scroll inside the reading habitat to offer more text. **FOLLOW A THREAD** loads a discovered page only when clicked.
- Reduced-motion preferences start the experiment paused. Resume explicitly to watch it.

## What is being fetched

The server requests one page (at most three redirects), with a 12-second deadline and a 1.5 MB response limit. The reader reconstructs headings, paragraphs, lists, and quotes. It does not reproduce the original website's layout or execute its scripts. Login-only, bot-blocked, JavaScript-only, non-HTML, oversized, and IPv6-only sites may be unavailable. Failures leave the current habitat intact.

The page's original URL is available through **↗** beside **LIVE PAGE**. The original site is not modified. Remote page content is not logged or stored. Existing page text remains subject to its original rights; the GPL applies to AIB's code and sample, not fetched pages.

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
```

The suite tests actual fetching from example.com, untrusted HTML isolation, request races, frame stopping, preserved text layout, word/sentence meals, mobile taps, and reduced motion. `CRAWLER_URL` can override the local URL. Screenshots go to the Git-ignored `docs/validation/crawler/` directory.

The focused feeding suite checks three rendered mouth movements before a word disappears, plus pause/resume, retargeting and reset during chewing. It uses the development server and sample page.

## Provenance

Visual reference: user-supplied `KAW8qq-EfhNOR8AM.mp4` (16.7 seconds). Creator identity was not supplied and has not been inferred. The reference recording is not included in releases. All geometry, code, sample prose, and gallery recordings are original AIB implementation. No source or assets were copied from the reference.

See `docs/crawler/ARCHITECTURE.md` in the repository, or `docs/ARCHITECTURE.md` in the standalone source archive.
