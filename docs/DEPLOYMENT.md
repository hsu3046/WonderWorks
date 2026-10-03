# Deployment

Wonderworks deploys as one static Vercel site at https://wonderworks.vercel.app. Source repository: https://github.com/hsu3046/WonderWorks.

## Reproducible build

Node.js 24 or newer is required. `npm run setup` installs the pinned dependencies locally under `projects/fish`, then links the other projects to that identical toolchain. No globally installed runtime libraries or external local projects are needed.

`npm run build` compiles fish/chroma/harbor/foliage/pond/lightning/crawler/skyglider, copies them plus Bubble Day and Fruit Jelly into the gallery, applies preview adapters, generates source downloads and builds the gallery with crawlable collection HTML and metadata. Source ZIPs use Node's built-in ZIP compression implementation; Python/Blender are not required to deploy.

Vercel settings are in the root `vercel.json`:

- Root directory: repository root.
- Install command: `npm run setup`.
- Build command: `npm run build`.
- Output: `projects/gallery/dist`.
- Node: 24.x.
- Canonical origin: `PUBLIC_SITE_URL`, falling back to Vercel's `VERCEL_PROJECT_PRODUCTION_URL`.

## Publication boundaries

Generated experiment copies and source ZIPs are not tracked. Original reference videos, captured validation footage, local agent notes and raw supplied asset files stay local. Runtime models, normalized authored Blender scenes, actual gallery preview clips and attribution notices are included.

The existing empty public repository is reused. Production deployment is separate from Git upload; after the repository is populated, Vercel's Git connection can keep subsequent explicitly requested pushes in sync.

## Validation

Run `npm run check` and `npm run build`. `scripts/check-site.mjs` verifies static catalog coverage, each declared image/video/source asset, metadata, structured data and sitemap URLs. Verify the deployed site in a browser; avoid repeated scripted requests that could trigger production firewall protection.

## Preserving published studies

A production deployment from a feature branch can include work that is absent from `main`. Before replacing production, integrate that already-published work into the release alongside the new feature. On 2026-10-03, rebuilding crawler-only `main` removed Fulgur because the published lightning/gallery changes were on `feat/pond-monarch-butterfly`. The restoration combines that committed branch with Webcrawler: nine studies, Fulgur 08 and Webcrawler 09, both previews, credits, source downloads and standalone routes.

The static release check now requires both `lightning` and `crawler` in the catalog and unique study numbers. This catches their omission before a deployment can replace the live collection.

Restoration validation: root type checks and 48 unit tests passed; the full build generated nine study downloads and validated 11 canonical pages. The local compiled gallery contains both creator credits; Fulgur's detail, source link and live scene opened successfully with no browser errors.


## Skyglider publication — 2026-10-03

Integrated `origin/main` at `0c09367` before adding Skyglider as study10. Fulgur08, Webcrawler09 and all existing creator credits are retained. The root toolchain/build list, copied experiment routes, source packaging and static catalog checks all include `skyglider`. Ten standalone archives and12canonical pages pass validation. The gallery has an actual14.42-second scene recording, poster and native same-origin ready/play/pause adapter for the live iframe. Private reference clips, screenshots, authoring asset library and validation captures remain ignored.

Validation before upload: root strict checks plus79unit tests pass (65scene tests and14crawler tests); full root production build and static SEO/asset checks pass. Runtime supplied-asset rights remain separate from GPL/CC0 in the scene and gallery notices. The reference creator was not supplied; the implementation credit identifies AIB Inc. without inventing an inspiration identity.
