# Pre-deployment SEO check

2026-09-30 — Wonderworks / AIB Inc.

## Findings and changes

| Priority | Finding | Resolution |
| --- | --- | --- |
| High | Collection, creator names and artwork links existed only after client JavaScript ran | A shared renderer now emits real cards, descriptions and links into the initial HTML through Vite. Client JS enhances those links into dialogs. |
| High | No canonical URLs or sitemap | Build generates one canonical per gallery/experiment, plus a sitemap containing the homepage and eight experiment variants. Preview query parameters canonicalize to the corresponding clean experience URL. |
| Medium | Missing Open Graph / Twitter metadata | Homepage and experiments receive title, description, canonical, social image and large-card metadata. Homepage uses a 1200×630 image composed from actual experiment previews. |
| Medium | Old description mentioned only the initial three studies | Collection description now covers the growing gallery, with all current studies represented in visible HTML. |
| Medium | No structured publisher/collection information | Organization, WebSite and CollectionPage/ItemList JSON-LD reflect the actual publisher and catalog. No invented ratings, reviews or FAQ markup. |
| Medium | Source downloads and vendor code can appear as standalone search results | Vercel adds X-Robots-Tag: noindex to downloads/vendor paths. Missing pages use a real 404 document; no blanket SPA catch-all rewrite. |
| Medium | Visual cards could remain hidden if JavaScript failed | Static cards are visible without JS; standard links remain usable. |
| Low | Original-code and inspiration credits needed clearer public boundaries | README/SOURCE_NOTICE and existing creator/asset credits distinguish supplied code, original AIB implementation and third-party licenses. |

## Validation scope

- Local production HTML, catalog coverage, image/video/source links, canonical metadata, JSON-LD syntax, sitemap count and all TypeScript projects are checked before deployment.
- Main page artwork images are lazy-loaded with explicit dimensions. Only one video decoder is used, and hover never starts the underlying artwork simulations.
- WebGL/WebGPU visual contents themselves are not text. The HTML collection supplies the readable description and technical context.
- No production Search Console ownership, indexing data or field Core Web Vitals exist yet. No ranking/indexing guarantee or fabricated SEO score is claimed. Real-device INP/LCP/CLS and GPU cost remain post-launch measurements.
- The public canonical origin is verified against the final Vercel production domain before release.

## Primary references

- [Google: JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
- [Google: canonical URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Google: SEO for developers](https://developers.google.com/search/docs/fundamentals/get-started-developers)
- [Vercel: project configuration](https://vercel.com/docs/project-configuration/vercel-json)
