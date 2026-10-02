# Webcrawler validation — 2026-10-02

Environment: macOS, Node.js 25.8.2, existing project-local Vite 8.3.1 and TypeScript 7.0.2; Playwright 1.58.2 with its existing headless Chromium. No package installation was performed.

## Passed

- Root `npm run check`: all study type checks, five existing pond tests, eight new crawler tests.
- Root `npm run build`: all eight studies, gallery, standalone source ZIPs, assets and ten canonical pages.
- Crawler API tests: URL normalization, private/obfuscated address rejection, mixed DNS rejection, redirect validation and address pinning, public redirects, redirect cap, cancellation during DNS, and structured API errors.
- Browser suite: automatic feeding; exact clicked-word targeting; stable text geometry; word/sentence modes; three spiders and speed changes; pause stopping callbacks; inert untrusted HTML (no scripts or image/frame requests); real example.com content; invalid URL preserving the current habitat; stale-request cancellation; completion stopping callbacks; 390px layout/scroll/tap; initial and live reduced-motion preference; offscreen suspension and resumption; pagehide cancelling a pending request without restoring playback (synthetic lifecycle event). Twelve grouped scenarios, zero page errors in the final run.
- Live reader requests: `https://example.com/` and `https://info.cern.ch/hypertext/WWW/TheProject.html` each returned HTML successfully through the local reader.
- Production smoke test: gallery's Webcrawler detail opens the correct experience; compiled page consumes words; the production gallery preview serves the same reader endpoint; development diagnostics are absent; zero page errors.
- Gallery recording: native 1536×1024, H.264, 30 fps, 12 seconds, faststart. Poster was extracted from the MP4's first frame. Footage comes from this implementation, not the reference video.

Screenshots and raw recordings are in ignored `docs/validation/crawler/`. The reusable browser suite is `projects/crawler/tests/browser.mjs`; invocation is in the project README.

One run alongside recording timed out waiting for a tiny page to finish. Isolated inspection completed all 18 words and stopped its callbacks; the complete suite subsequently passed with diagnostic capture enabled. That transient timeout's cause was not established. No performance or thermal claims are inferred from these tests.

## Not verified

Physical iOS/Android devices, native Safari touch behavior, long-duration energy/thermal behavior, every external site's markup, and deployment on Vercel. Login-required/JavaScript-only/blocked/oversized/IPv6-only pages are outside the supported reader boundary. Existing large Three.js bundle warnings remain; the crawler's production JavaScript is approximately 22.4 kB (9.2 kB gzip).

## Eight-leg correction — 2026-10-02

The user identified crossed rear legs. Reproduced analytically: the original shared IK bend direction puts both rear knees 6.70 local units on the wrong side of the centerline even at rest. Replaced it with pair-specific rest anatomy and IK poles, mirrored convex reach sectors, a separate front body/abdomen and alternating four-foot support groups.

- Three new geometry tests passed: exactly four mirrored pairs; fixed stance and alternating two-per-side swing groups; no segment crossings or opposite-side joints across 8,100 moving poses, including full rotations, abrupt reversal, scale changes and 30/60/120 fps.
- Crawler type check, all eleven unit tests (eight API + three anatomy), and production build passed. Updated bundle: approximately 24.2 kB JavaScript (10.0 kB gzip).
- All twelve grouped browser scenarios passed again after the correction, including eating, pause, sentence mode, mobile layout, reduced motion and lifecycle cancellation; zero page errors.
- Headless Chromium screenshots confirmed eight separate legs both at rest and while eating. Browser page errors: zero. Local evidence: `docs/validation/crawler/legs-before.png`, `legs-after-rest.png`, and `legs-after-walk.png`.
- Gallery MP4 and its first-frame poster were re-recorded with the corrected anatomy. Root `npm run check` and `npm run build` passed, including the gallery and standalone source archives.

## Faster mouth movement — 2026-10-02

Each meal now has three open–close cycles in approximately 0.56 seconds at normal speed. Crawler TypeScript/production build passed. A headless Chromium probe measured the actual rendered mouth width across 68 frames during one meal and counted three peaks; one word was consumed and no page errors occurred. The probe used the active Vite module URL, including its HMR timestamp, to observe the running renderer.

## Chew before consuming — 2026-10-02

Separated arrival/chewing from consumption: words stay visible while the mouth moves three times, then consumption fragments and the counter/log update begin. Crawler TypeScript/production build and all eleven unit tests passed.

The focused `tests/feeding.browser.mjs` suite passed four scenarios with zero page errors: three actual rendered mouth cycles before disappearance; pausing longer than the bite duration without hiding the word; cancelling an unfinished meal by clicking a different word; and restoring the page during chewing. The mouth-wave observation ignores repeated static frames while paused, which are not additional bites.

The existing twelve grouped browser scenarios also passed, including sentence/three-spider feeding, completion, mobile controls and lifecycle cancellation, with zero page errors.

## Original-design capture — 2026-10-03

The local crawler now uses an existing Playwright 1.58.2/Chromium installation through the ignored `CRAWLER_PLAYWRIGHT_MODULE` server setting. No packages or browsers were installed. Pages are rendered in an isolated browser, frozen as inert DOM with computed styles and embedded assets, and displayed in a script-disabled iframe. DOM Ranges and CSS Highlights preserve the text layout during consumption. Reader view remains available and is the automatic fallback when rendering is unavailable or fails.

- Root `npm run check` and `npm run build` passed: all studies, five pond tests, fourteen crawler tests (eight reader API, three anatomy, three capture resource tests), gallery, standalone source archives and ten canonical pages. The existing large gallery bundle warning remains.
- Capture resource tests verify pinned addresses, private resource/redirect rejection, resource and aggregate byte limits, request caps, four concurrent fetches, and cancellation during DNS lookup.
- Five focused snapshot browser groups passed with zero page errors. An original AIB fixture was rendered independently and through the actual capture pipeline; five landmark bounds differed by less than 0.6px, while colors, font families, embedded images, a supplied local test font and JavaScript-rendered text were retained. The capture follows a cross-host document redirect and image/font redirects, preserving the final URL and embedded assets. This precision result applies to that controlled fixture, not arbitrary websites.
- A word composed of six separate character spans was consumed as one word without inserting wrappers or changing its heading's bounds. Scrolling, reset, original/reader switching, and a 390px responsive single-column capture passed. A forged response could not run scripts/handlers, navigate, mount frames or request external CSS/images.
- The existing twelve browser groups and four feeding groups passed after integration, preserving three mouth movements before disappearance, pause/resume, retargeting, reset, sentence feeding and lifecycle behavior.
- Live local captures of `https://example.com/` and `https://www.w3.org/standards/` opened in original view. The W3C capture found 442 words, loaded all four captured images and consumed two words with no page errors. Fonts used by visible text loaded; unused font faces remained unloaded.

Evidence in ignored `docs/validation/crawler/`: `snapshot-source.png`, `snapshot-desktop.png`, `snapshot-eaten.png`, `snapshot-scroll.png`, `snapshot-mobile.png`, `original-first.png`, and `original-w3c.png`. The reusable fixture and suite are `tests/snapshot-fixture.mjs` and `tests/snapshot.browser.mjs` in the crawler project. The optional test font is read from the system and is not copied into the repository.

Deployment of the optional browser runtime, physical mobile devices and universal website fidelity are unverified. The capture is static: source-site interactions, video/canvas, nested frames, login-dependent content, some complex CSS/Shadow DOM and blocked or oversized resources are not reproduced. Changing the habitat size scales an existing capture; loading the URL again captures that viewport's responsive layout. Font-dependent floating fragments may use a parent-page fallback font. The previous reader-only JavaScript limitation does not apply to pages successfully rendered by this optional mode.

## Curated random exploration — 2026-10-03

Screened 187 candidate reading pages through the real original-view renderer and inspected their sanitized copies at 1060×534. Selected 100 distinct URLs from 36 sources, including 19 Korean and 81 English pages. Every selected capture completed without the partial flag, horizontal text clipping or a large fixed overlay, with at least 297 visible-document words. The catalog and precise scope are recorded in `RANDOM_PAGES.md`; this is a loading/text-layout check, not a pixel-diff guarantee for every element or viewport.

- Catalog and picker checks passed: exactly 100 unique public HTTP(S) URLs, nonempty titles/languages, no repetition across a full 100-choice round, and no immediate repetition when a new round begins.
- Focused browser checks passed with zero page errors: startup makes no candidate API requests; clicking or keyboard-activating the random button fills the input and sends exactly one curated URL; loading disables both exploration buttons; a failed request preserves the habitat and re-enables them; later choices differ.
- Both controls fit side by side at 320, 390, 600 and 768px, with the URL input remaining 16px. Full-page overflow checks passed at 390px and above. The existing intro title/copy extends 5px beyond the page at 320px; the new controls fit, and that unrelated intro was left unchanged.
- An actual random-button request loaded the selected Korean article `https://parksb.github.io/article/44.html` in original view with 2,301 huntable words and no page errors.
- Root `npm run check` and `npm run build` passed, including the fourteen crawler unit tests, gallery and standalone source archives. Existing gallery bundle-size warnings remain.

Ignored local evidence: `docs/validation/crawler/random-selected.json`, `random-validation-final.json`, `random-desktop.png`, `random-mobile.png`, and `random-button.browser.mjs`. The mobile screenshot uses a mocked response to isolate the controls; the desktop screenshot shows the live Korean article. No dependencies were installed or deployment performed.

## Main integration — 2026-10-03

Combined the completed crawler branch with `origin/main` at `b423558`, preserving the pond/foliage changes and monarch asset attribution. The only merge conflicts were adjacent gallery catalog entries and credit paragraphs; both studies and their notices were retained.

- Root `npm run check` passed all study type checks and 23 unit tests (nine pond, fourteen crawler).
- Root `npm run build` passed all eight studies, source archives, asset checks and ten canonical pages. The existing gallery bundle-size warning remains.
- A Chromium smoke check of the combined production build passed: eight gallery cards, preserved pond attribution, the Webcrawler detail/link, sample feeding, and one curated random request followed by resumed feeding. The random response was mocked to isolate the compiled UI. Development diagnostics were absent and no page errors occurred.

This verifies the local integration. GitHub push and deployment were not performed; the optional original-view browser runtime still needs server configuration in a deployment.
