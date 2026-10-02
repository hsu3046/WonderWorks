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
