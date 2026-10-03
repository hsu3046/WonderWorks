# Skyglider setup

From the repository root, run `npm run dev --prefix projects/skyglider`, then open http://127.0.0.1:4182/.

For a fresh clone without dependencies, `npm ci --prefix projects/skyglider` uses the checked-in lockfile. The current worktree already has a physical APFS clone of the existing fish toolchain; this session did not run an installation.

Validation: `npm run build --prefix projects/skyglider` and `npm test --prefix projects/skyglider`. Preview a standalone production build with `npm run preview --prefix projects/skyglider` after stopping its dev server, as both use 4182.

The WebGL2 renderer requires hardware acceleration. Character and environment assets are local. Only Google Fonts needs an external request; serif/sans-serif fallback fonts keep the experience functional offline.

Open http://127.0.0.1:4182/character.html for close character inspection. Six views include **Side**, **Face**, **Back**, **Top** and **Belly**; the four poses are **Resting**, **Running**, **Climbing** and **Gliding**. Choose **Side → Running → Animate** to inspect the bounding gait, **Gliding → Top** for the upper wing coat, or **Resting → Face** for the nose. Drag/scroll/pinch controls the camera. The default pose is static. The same page is included in the production build.

The authored body asset is checked in. Rebuild it only when changing the sculpt/rest skeleton: `node --experimental-strip-types projects/skyglider/scripts/build-squirrel.mjs` from the repository root. This uses the existing Three.js dependency; no Blender or additional package is needed. Coat and detail changes are runtime TypeScript and do not require asset regeneration.

From the main page, **Take flight / Space** now runs up the branch, climbs to the highest bough, gathers and leaps into the valley over 10.5 seconds. Inspect the crown pose just before takeoff using Pause; **Land nearby / L** and **Back to the old oak / R** retain their existing controls.
