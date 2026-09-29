# Through the Seasons

A procedural tree and weather study for Wonderworks. © 2026 [AIB Inc.](https://www.aib.vote). GNU GPL v3; see LICENSE.

## Run

Node.js 24 or newer. `npm install`, then `npm run dev` (http://127.0.0.1:4178). `npm run build` produces a standalone relative-path Vite build. `npm test` runs deterministic seasonal-state tests. The development workspace shares existing dependencies with the fish project; an extracted source download installs its own declared dependencies normally.

## Controls

Drag to orbit; wheel/pinch to zoom. Choose tree foliage, season, weather, wind and time of day. Season drift runs a 150-second year; Day drift moves the sun through a five-minute day. Space pauses, H hides the UI. Sound is opt-in and synthesized locally. Save frame downloads a PNG.

URL presets: `?year=.79&hour=17&weather=rain&wind=.6&tree=maple&auto=0`. Trees: maple, ginkgo, cherry, aspen, japanese. Weather: clear, cloudy, rain, storm, snow. `speed=1` through `speed=4` accelerates season drift. Preview mode accepts same-origin parent play/pause messages.

All geometry, leaf silhouettes, bark detail, forest texture and weather are generated locally. The five foliage varieties share one branching scaffold; this is an artistic simulation, not a species-accurate botanical model. Leaves follow deterministic seasonal flight paths, not rigid-body physics. Google Fonts supplies Italiana and DM Sans with local serif/sans-serif fallback.

Autumn drifts more slowly so leaves can detach individually, flutter in different directions, and settle. Holding an autumn date continues natural leaf shedding; summer foliage stays attached.
