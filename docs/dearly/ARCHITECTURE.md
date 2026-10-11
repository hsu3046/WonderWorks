# Dearly / Study 014

## Reference and scope

User video `9afLWQbm9mwIAubv.mp4`, 20.22 seconds, 1320×2868, inspected on 2026-10-11 at roughly two-second intervals. Observed: vertical scrolling through cream envelopes, central envelope facing forward, preceding/following envelopes tilted in perspective, paper shadows and small green/gold postage. A “flat in the middle” control appears in the source. Stamp picking and dispatch were requested in the user's description; they were not visible in the sampled recording. New original interface and illustrations, no video assets copied.

## Model and flow

Vanilla strict TypeScript and CSS, shared existing Vite toolchain. `model.ts` defines bounded local letter records and validates inputs. `stamps.ts` draws original perforated vector postage and date postmarks. No remote message service or network storage.

1. Choose one of six stamps. Desktop pointer drag uses capture, an inert ghost, release/cancel cleanup and envelope-local coordinates. Touch uses pick/tap so page scrolling stays native. Keyboard Enter/Space places the selection at the top right.
2. Compose recipient, optional sender, message; choose paper. User content only enters textContent or form values.
3. Validate; synchronously read latest storage and persist a bounded snapshot before showing successful dispatch. Corrupt/unavailable/full storage keeps the draft and reports an error. Controls lock for the animation to prevent duplicate sends.
4. Fold, stamp impact, dated ink impression, envelope departure. Mobile returns to the desk before this sequence. Reduced motion shortens the sequence.
5. Native scroll-snap letterbox: measured slot distance from the centre determines CSS perspective angle, scale and lighting. RAF is scheduled only after scroll/resize. Read dialog restores focus; plain-text download preserves line breaks.

The browser letterbox is limited to 40 letters and stores cleartext locally. It is not encrypted, synced, or an actual delivery system. Local drafts last until reload; sent letters persist. Five built-in sample letters are labelled and do not count toward storage capacity.

## Verification

Six model tests cover storage round trips, invalid JSON, invalid fields, bounded content and placement, and required send fields. Browser validation: dragged a stamp onto the envelope; keyboard placement; paper change; missing-stamp rejection; full dispatch and postmark; read saved contents; reload retention; desktop and 390px responsive layout without horizontal overflow. Original sound is synthesised only after user enablement. Real-device touch and audio perception remain manual checks.

Prism was separately added to the main gallery and committed as `d12ad0b` before this feature. Dearly is now study 14 in the root gallery and deployment pipeline.

### Letterbox refinement — 2026-10-11
Desktop/mobile layout pitch reduced to 84/62px. Slots remain compact while smoothstep folding reaches 76° one slot away from centre; neighbours shift just enough to leave the central envelope readable. Depth order follows distance, one slot is active, and scroll-snap/padding align the selected letter exactly to the viewport centre. Entering the letterbox starts around the collection middle; a just-dispatched letter is shown first. Address-side triangular seam graphics removed from both desk and archived envelopes. Desktop/mobile screenshots confirm one front-facing letter, close layering, no horizontal overflow, and successful reading of the centre letter.

### Slower browsing — 2026-10-11
The compact 84/62px layout had also become the native scroll distance per letter, making short wheel input skip quickly. Native flow now reserves 252/186px per letter while compensating with visual translation to retain the same 84/62px density. An exponential 125ms follow smooths position, fold and spacing together; it settles without idle RAF and stops when hidden. Read geometry before style writes. Perspective is local to the moving card, so large compensation offsets do not change its vanishing point. Wheel/touch remain native. Reduced motion renders directly. Desktop forward/reverse scroll, central reading state, mobile pitch/overflow and production build verified.

### Worn postmarks — 2026-10-11
User requested less perfect, faded stamp lines. A date-seeded SVG luminance mask combines pressure variation, fine paper-grain voids and larger breaks on the cancellation rings. Wave lines vary in thickness/opacity; lettering has tiny alignment differences. Warm faded-grey ink is shared by dispatch and saved envelopes. Unique mask IDs avoid collisions in the letterbox; seeded wear stays consistent for a letter across renders. Browser visual inspection and build passed.

### Gallery release preparation — 2026-10-11
Study 14 is registered in the main index, gallery, creator credits, root toolchain/check/build, experiment copy and source ZIP packaging. Inspiration: @raffiki_art. Gallery thumbnail is cropped from the implemented desk; MP4 is a four-second still preview. No supplied reference video is redistributed. Root checks (106 tests), build, and 14-study/16-canonical-page validation passed. The integrated path opens its letterbox and reports no browser console errors. Local development storage on port 4187 does not transfer to the gallery origin or production. Publication has not been performed.
