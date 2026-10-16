# Local realtime optimizations

Original Golden Temple © Leon Lin, MIT. See LICENSE. Original attribution and source are preserved.

Local additions and modifications © 2026 AIB Inc. (https://www.aib.vote), GPL-3.0-only; see the workspace LICENSE. Original portions remain available under MIT.

The upstream copy is recorded in ../../docs/golden-temple/source-manifest.json. That manifest intentionally describes the pristine upstream, not the modified working tree. Local backup: out/original/src (ignored, not a distribution dependency).

Default dev/preview enables realtime optimizations. `?opt=0` selects the original preview rendering policy; offline still/film/final paths retain full detail. No new dependencies.

- `core/realtime.js`: refresh policy, adaptive rendering budget.
- `core/geometry-lod.js`: bounded vertex clustering, foliage spatial cells.
- `core/atlas-cache.js`: exact procedural atlas/mip cache and fingerprinted LOD index cache.
- `core/sdf-cache.js`, `tools/bake-sdf.mjs`: lossless preview mesh cache with original generation fallback. Generated files include provenance manifest.
- `core/metrics.js`: optional `?bench=1` diagnostic; no measurements uploaded.
- Existing main, sky, post, lighting and world modules: realtime integration, ownership/cleanup and hot-loop allocation improvements.

Controls: Pause/Play, Free camera, Balanced/High detail; 1–0 selects shots, Space pauses, drag orbits. High detail fixes rendering resolution at 100%; it does not disable LOD or sky caches. Balanced adjusts 65–100% with hysteresis. `?opt=0` is the full original comparison path.

Validation and limitations: ../../docs/golden-temple/OPTIMIZATION_RESULTS.md.


Golden Temple — Original code by [@LexnLin](https://x.com/LexnLin) (Leon Lin), as identified by the project owner. Upstream: https://github.com/Leonxlnx/golden-temple. Original MIT license retained. Local realtime adaptations © 2026 AIB Inc., GNU GPL v3. Gallery poster captured from the locally rendered scene.
