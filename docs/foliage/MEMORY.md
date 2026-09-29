# Memory

2026-09-29: Lower half of the provided comparison video selected by user. Scope expanded to four seasons, snow/rain/wind/thunder/lightning and day/weather changes. Use AIB Inc. credits and GPL v3. Preserve finalized Chroma and Harbor.

### Mature tree and organic meadow — 2026-09-29

- Taller 4.25-unit trunk, stronger roots, ten staggered scaffold limbs and a central leader. Camera target raised to preserve the larger silhouette.
- 26,000 leaves distributed over outer branches and inner sprays, including lower crown layers. Species, falling leaves and seasonal controls preserved.
- 160,000 curved grass blades in five-blade tufts, variable widths/heights, coherent gusts, bent normals, and meadow color noise. Near and distant grass zones overlap. Full winter snow hides submerged grass.
- Four forest silhouettes share one atlas and one instanced draw; varied proportions, buried roots, layered forest placement. Nonperiodic ground noise replaces stripes.
- Seven state tests and strict production build pass. Summer desktop, 390×844 mobile, winter and 17-second weather/season preview visually checked. No new shader/console errors after correction of the GLSL reserved identifier. Desktop sample: 120 frames over 2.003 seconds; this is one local sample, not a device-wide benchmark.
- Gallery execution copy, MP4/poster and downloadable sources updated. Proof: docs/validation/foliage/mature-tree/.

### Spreading, hanging crown — 2026-09-29

- Spread upper branch geometry and leaf anchors together (up to 32% along X / 27% along Z), preserving the upright trunk. Radial branch sag and 1.35-unit outer leaf fringes create a lower, hanging silhouette.
- Slightly broader leaf sprays and larger leaves maintain canopy coverage at the existing 26,000 instances. Mobile field of view widened to 60° to fit the broader crown.
- Strict build and desktop/mobile summer rendering checked; gallery preview and source archives refreshed. Proof: docs/validation/foliage/spreading-crown/.

### Independent gentle leaf fall — 2026-09-29

- Replaced positive-X landing bias with independent azimuth/radius per leaf and a smaller shared wind drift. Each leaf receives an independent release time and 5.5–11.5 second flight duration.
- Per-leaf rocking, signed spin, lateral flutter and low vertical oscillation settle smoothly into a stationary ground pose. Visible material normals and depth/shadow material reuse the same deformation.
- Autumn progression slows to 1/1200 year per second, versus 1/150 elsewhere, with smooth seasonal shoulders. Flight timing uses that same scale: avoids thousands of simultaneous falls. Default speed-1 autumn capture contained 863 airborne leaves; the previous dense revision had about 7,000.
- Holding an autumn date continues staggered releases; summer remains attached. Switching auto/manual resets the manual release clock. Counters use the same seeded schedule as the GPU.
- Ten tests pass, including quadrant coverage, release ordering, eventual settling and airborne population bounds. Strict build and a 17-second GPU preview pass without console errors. Gallery clip/poster and source archives refreshed. The 8-second manual-autumn.webm records the earlier dense intermediate; preview.webm is the final gentle revision.

### Larger snowflakes — 2026-09-29

Snow point diameter increased by 5/3 (48 → 80 perspective factor; 1.5–6 → 2.5–10 pixel bounds before DPR). Particle count, soft edge and falling motion preserved.

### Continuous root flare — 2026-09-29

Removed nine reversed, open-ended root tubes that resembled a flat footplate. Rebuilt the trunk as one 48×48 curved surface with six irregular buttress lobes that broaden toward the soil and terminate 0.32 units below ground. Preserved the crown RNG sequence and all leaf animations. Strict build and summer rendering verified. Proof: docs/validation/foliage/root-flare/.

### Lightweight matching distant forest — 2026-09-29

- Replaced the unrelated hand-painted forest sprites with four views of the actual foreground tree, baked once into a 2048×1024 atlas. Wood and leaves occupy separate rows; the GPU leaf home positions determine framing to avoid clipping the wider crown.
- 1,100 trees populate a 38–96-unit woodland ring, with varied height, width, orientation and brightness. All use one camera-facing InstancedMesh (2,200 triangles per frame); no individual leaf simulations or background shadow maps. Eight offscreen draws happen only at scene creation using the existing renderer/context.
- Seasonal leaf thinning, autumn color, winter branches, snow tint, light/weather response and gentle crown sway use shared uniforms. Atlas is based on the initial hero species; later foreground species selection does not rebake the woodland.
- Restores renderer target, viewport, scissor, clear state, shadows and hero uniforms after baking; atlas resources dispose independently of shared hero geometry/materials.
- Strict build + existing 10 tests passed. Summer, winter, camera orbit and mobile checked; no new console errors. Local 2.001-second desktop sample: 120 frames (~60fps), not a cross-device guarantee. Evidence: docs/validation/foliage/distant-forest/.

### Softer, larger snowflakes — 2026-09-29

Increased snow sprite diameter a further 40% (perspective factor 112; 3.5–14px before DPR). Replaced the solid-center radial ramp with Gaussian falloff and a feathered boundary, with center alpha 0.88. Particle count, trajectories and scene sharpness preserved; no fullscreen blur pass.

### Ground impact rain spray — 2026-09-29

- Each of 6,500 rain streaks shares its phase, speed and wind-adjusted landing point with five GPU splash droplets (32,500 pooled points, one additional draw). Rain now terminates at the terrain height rather than world Y=0.
- At impact, droplets launch in independent directions on gravity-driven arcs, then soften and fade. Per-impact-cycle variation prevents identical repeated crowns. Terrain-height clipping avoids continuing beneath the soil.
- Storm increases launch height and visible intensity; spray follows rain opacity, pauses with scene time, and disables with dry weather. Existing sky flash/daylight modulates droplet color. No CPU per-frame particle updates or additional RAF.
- Strict build; rain→storm 8-second render recording and dry-weather transition checked with no new console errors. Storm sample: 120 frames/2.0013 seconds locally. Proof: docs/validation/foliage/rain-impact/.

### Independent three-axis leaf wind — 2026-09-29

Replaced shared X/Z-only leaf translation and single-axis flapping with seeded per-leaf 3D displacement and tilt/roll/yaw. Two smooth, nonmatching frequencies per axis avoid synchronized repeating motion; a low-frequency spatial gust keeps neighboring leaves coherent. Wind scales displacement and rotation to zero at calm. Detached leaves blend into the existing fall rotation/trajectory and landed leaves remain still; normals and shadows use the same functions.

Strict build and 8-second GPU recording at wind 0.65 checked without console errors; local sample 119 frames/2.0023 seconds. Evidence: docs/validation/foliage/leaf-wind/.

### Through the Seasons 최종 확정 (2026-09-29)

- 사용자 명시 승인: “좋아 확정”. 현재 Through the Seasons 구현을 확정본으로 보존한다.
- 확정 범위: 넓고 아래로 늘어지는 큰 나무 수관, 자연스러운 밑동, 개별 낙엽 비행, 굵고 부드러운 눈송이, 경량 원경 숲, 빗방울 지면 비산, 잎별 상하좌우·앞뒤 흔들림 및 회전.
- 이후 명시적 변경 요청 전까지 이 작품의 비주얼·모션을 임의로 변경하지 않는다.
