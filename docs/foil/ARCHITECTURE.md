# Foil Studio — implementation and validation

## Reference and scope

User supplied a 38.983-second MP4 on 2026-10-09, named `Ann_Nguyen_-_created_this_lil_site_with_claude_opus_5.5_that_turns_your_pic_into_a_9KSMFl.mp4`. Source post: https://x.com/i/status/2105844268640420296 (web access returned 403; implementation uses the supplied recording). Original designer credited as Ann Nguyen.

Observed at 0–25 seconds: large white work area, right settings column, upload thumbnail, shape buttons, details/shadows/colour foil selection, metal and paper swatches, a folding card with inset letter, text entry, and share-link generation. Rotation changes foil appearance. The reference's backend, source code, exact material algorithm, mobile behavior and sharing/storage contract are not available.

Recreated independently at `projects/foil`, local port 4184. Added three original botanical samples, keyboard controls, reduced-motion support, responsive vertical layout and PNG export. No gallery, production, API or infrastructure changes. Link sharing is deliberately a standalone URL-fragment implementation, not the reference's short-link backend.

## Modules

- `state.ts`: typed settings, bounded untrusted-link validation, UTF-8/base64url encoding, CPU luminance/gradient/colour-distance foil masks.
- `artwork.ts`: original Canvas botanical illustration; raster import/decode, input limits, downsizing, object-URL cleanup, smaller share JPEG.
- `renderer.ts`: Three.js perspective view, two thick paper panels and a spine pivot, PBR metallic overlay, paper and ink textures, inside text wrapping, PNG capture.
- `main.ts`: controls, live state, asynchronous image request generations, drop/paste/file input, link dialog and recipient initialization.
- `style.css`: cream work surface, right studio panel, vertical mobile layout, focus states and reduced motion.

## Rendering and lifecycle

Foil masks are computed at 850 pixels tall. Selected areas become an alpha-mapped MeshPhysicalMaterial with metalness 1, roughness .24, subtle paper bump and a PMREM environment. Holographic uses thin-film iridescence. White image areas blend into the chosen paper colour; other printed colours remain in the base texture. Shape choices center-crop; Original clamps extreme aspect ratios to .55–1.6 for usable card geometry.

Three.js r186 replaces `material.envMapIntensity` with `scene.environmentIntensity` when the material inherits `scene.environment`. Paper uses scene intensity .3; foil explicitly owns the same environment texture with intensity 1.8. This separation prevents a reflective foil setup washing out the printed photograph. No claim of identical physical foil simulation to the reference.

Opening interpolates to 171.9 degrees around the spine and reframes both panels. Quaternion rotation uses CSS-pixel deltas and supports full turns. Only hits on the card begin a gesture. Tap/drag threshold 6 px; taps under 500 ms toggle once. Mobile declares pan-y/pinch-zoom, yields vertical starts to scroll, and cancels on a second contact, pointer cancellation, blur, resize and visibility changes. Buttons and keyboard provide alternatives.

RAF runs only while pose/opening changes or a redraw is requested; it stops at rest and when the document is hidden. Textures and geometry are disposed on replacement; material, PMREM, observer, events and GPU renderer have disposal paths. Slider processing is debounced 65 ms. Image decoding commits only if the latest request still owns the result, preserving concurrent letter/setting edits.

## Sharing and limits

Versioned JSON is UTF-8/base64url encoded into `#card=`. Input length, enumerated indices, letter/name limits, colour and JPEG-only data URLs are validated. Letter/name are rendered as text, never HTML. Uploaded sources render up to 1200 px locally, while links embed a maximum-380 px JPEG. Default artwork is reconstructed from its sample index. No network requests carry user picture/letter data.

No server short links, social-preview metadata, persistence, revocation, encryption or automatic publication. A local preview explicitly explains that its links only work on the current computer. The recipient must access a hosted copy to use a public link. Long links may be incompatible with messaging apps. GIF uses a still frame; HEIC/SVG are not supported. Physical iOS gestures and long-duration GPU/thermal behavior remain unverified.

## Validation — 2026-10-09

- Strict TypeScript check and production Vite build passed. One expected bundle-size warning: Three.js-containing main bundle ~566 kB / 144 kB gzip.
- Six Node tests passed: Unicode/literal content round-trip; invalid indices/content; malformed/oversized links; zero-mask behavior; dark selection; target-colour and 1px boundary handling.
- In-app Chromium: desktop 1280×720 and responsive 390×844; no horizontal overflow at the latter (document width 375 with browser scrollbar). Opening/closing, live Korean letter, sender, metal/paper changes, shape selection and local share warning verified.
- Shared Korean-letter card restored correctly after a fresh document load. Uploaded existing Ocean Shoal PNG, switched to square/holographic, generated a 31,843-character link and restored its 380px image, letter and colours.
- PNG download completed to `~/Downloads/a-little-wonder.png`; decoded image contains the rendered photo card, not a blank canvas. Console warning/error log empty in the tested browser session.
- User checks: upload a personal photo, drag across the face to inspect moving highlights, tap to open, edit a letter, try metal/paper choices, then save a picture. On a real phone, check vertical page scrolling, horizontal card drag and native pinch zoom.

© 2026 AIB Inc. — GNU GPL v3.

### Tilted-card shadow seam correction — 2026-10-09

The soft backdrop shadow was a transparent plane at world z=-.35. A rotated card crosses that plane, allowing its alpha gradient to draw over only part of the printed surface and producing a straight depth-test boundary. Moved the plane behind a conservative full-panel sweep radius hypot(1.5w,h/2,.06)+.1. Scale and xy position multiply by (cameraDistance+newDepth)/(cameraDistance+.35), preserving its previous screen-space appearance. Card materials, foil, lights and gradient are unchanged. Strict build and7tests pass; same two-left-arrow tilt, opposite tilt and open card checked in browser, console clear. Before/after screenshots in ignored docs/validation/foil/shadow-*.png.

### Continuous hinge and subtle back print — 2026-10-09

The backing at z=-.027 and cover hinge at z=.027 had no joining paper geometry, exposing a .054 central separation from reverse/oblique views. Added a same-stock24-segment cylindrical spine of radius.038 along the full card height. Panel edge sweep radius is bounded by.027+.009=.036; the cylinder's minimum facet radius is.038*cos(pi/24)≈.03767, so the edge remains connected throughout opening. Existing panel/photo/foil positions are unchanged.

The outer backing now carries an sRGB printed texture with small olive branches, interlocking rings, “With love, always.” and small AIB credit. It uses the chosen paper colour and a light ink alternative on Midnight. Original Canvas artwork, no new generated asset/dependency. Material/texture disposed with renderer.

Validation: strict build passed,1001opening-angle edge-bound samples passed; browser reverse-open, oblique-open and closing views show a joined spine and back decoration, console clear. Screenshots docs/validation/foil/back-decoration.png and spine-oblique.png. Existing chunk-size warning remains.

### More controllable free rotation — 2026-10-09

User liked free rotation but found it difficult to control. Previous input gain was fixed.006rad/CSSpx (34.4deg/100px), with10/s exponential pose following that continued after release. New gain is fixed at pointerdown from projected unrotated card width: clamp((pi/3)/width,.0016,.0035), roughly9–20deg/100px. Edge-on rotation does not amplify sensitivity; resize still cancels. Direct drag copies target quaternion to the rendered object immediately, eliminating trailing pose lag; reset/key animations retain smoothing. Shift multiplies drag/arrow input by.3. Arrow steps reduced from.15 to.1rad. Full quaternion rotation and touch arbitration unchanged.

Strict build passed; browser100px drag remained closed, post-release screenshot bytes identical across consecutive captures, consoleclear. Shift behavior implemented at input mapping; no physical iOS validation. User can test slow horizontal/diagonal drags, release/regrab and Shift precision.

The rotation tuning above was reverted immediately after user feedback that the original felt much smoother. Current behavior again uses.006rad/px and the original10/s interpolation, with.15rad arrow steps. No Shift precision mode. Strict TypeScript check passed. Preserve this original smoothing in future adjustments.

### Photo gloss control — 2026-10-09

Paper settings now include Photo gloss (0–100%, default65%). It updates only the portrait material: clearcoat=g/100 and roughness=.94-.6*g/100, preserving the previous finish at65%. No texture/geometry rebuild during slider input. CardState stores gloss; legacy version1 links default to65 and supplied values must be integers0–100. Templates preserve this setting.

Validation: strict build and8tests pass, including legacy decoding, endpoints, invalid values and link round-trip. Browser keyboard slider0/100/65 checked on the opened card; no console errors/warnings. Existing Three bundle-size build warning remains. User check: open the card, drag Photo gloss under Paper, and rotate the photo toward the light.

### Gallery integration — 2026-10-09

Study11 is registered in the gallery catalog with Inspired by @ann_nnng linking to the supplied creator profile. Root setup/build/check include Foil; prepare-works copies its relative-base build to experiments/foil; source packaging produces foil-studio-source.zip. Gallery SEO, credits and source actions derive from the catalog. Preview poster and six-second MP4 are captures of the local card renderer (closed foil and opened portrait views), not redistributed reference footage.

### PR4 review corrections — 2026-10-09

Only ray-hit pointers enter the gesture set and each is captured before tracking, including secondary touches; missed background touches cannot leave an unreleased pointer ID. Shared-card settings are applied synchronously before image decoding. Decoded artwork is committed only if its generation still owns the image, preserving concurrent letter/settings edits and newer uploads/templates. Audited all source assignments and gesture-set mutations. Three handler-level regressions cover missed touches, edits during decoding and superseding picture selections. All11tests and the strict standalone build pass.
