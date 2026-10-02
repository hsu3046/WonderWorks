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
