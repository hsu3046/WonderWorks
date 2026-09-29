# Fruit Jelly — Citrus & Watermelon

Two Dani experiments grouped as one Wonderworks project. Imported from Dani's `website/demo/citrus`, `website/demo/melon`, and `website/demo/jelly-shared`. The original Dani project was not changed.

## Run

```sh
python3 -m http.server 4176 --bind 127.0.0.1
```

Open `/citrus/index.html` or `/melon/index.html`. Three.js is vendored locally; no install or build is needed. Drag to stretch, release to recover, adjust firmness, and use the Watermelon cutting tool. `?native=1` provides a clean fruit-only view used by gallery previews.

## Implementation

Three.js / WebGL2 physical materials; tetrahedral XPBD constraints and volume preservation; multi-touch grab constraints. Watermelon cuts generate independent volumetric pieces with approximate planar collision.

Integration changes are limited to import-map, asset and test vendor paths and the home link. Physics and rendering remain from Dani. The Wonderworks import manifest records original source hashes.

## Tests

```sh
node --test citrus/physics.test.mjs melon/geometry.test.mjs melon/activity.test.mjs jelly-shared/grabs.test.mjs jelly-shared/surface.test.mjs jelly-shared/native.test.mjs
```

GNU GPL v3. Copyright © 2026 KnowAI (https://knowai.space). Three.js and fonts retain their bundled licenses.
