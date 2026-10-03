# Gallery navigation and copy

2026-10-03 — AIB Inc.

- Artwork, top-index and Open experience links navigate directly in the current tab. Native modifier clicks and browser back remain available; there is no project or credits dialog and no gallery live iframe.
- Each main card includes its description, inspiration credit, technology tags, concise specifications, Open experience, Download source and license. Gallery downloads and detailed attribution are in the inline Credits and licenses section.
- Fruit Jelly selection updates the poster and all three experience links, including the top index. Each project shares one source download across its variants.
- Card previews retain one shared muted video decoder, intentional hover, first-frame reset on leave and offscreen/hidden cleanup. Text updates target the preview label so the Phosphor play icon remains intact.
- External creator/publisher/license links and links opening a separate document use Phosphor link-simple. Internal experience navigation uses arrow-right; section navigation uses arrow-down; source downloads use download-simple. Five regular SVGs are pinned with the original MIT notice and provenance in gallery/src/icons.
- Descriptions use two short sentences, clear verbs and consistent punctuation. Primary actions are Open experience and Download source. Specifications use consistent subject labels and separators. Stillwater copy now reflects the existing five-fish scene; no artwork simulation or geometry changed.
- Static HTML includes all actions and information before JavaScript. The shared renderer runs in Vite and in the browser; noEmit TypeScript permits explicit .ts imports so the same renderer is also readable by Node during build validation.

## Validation

Check gallery TypeScript, the full repository check/build and scripts/check-site.mjs. The static check verifies no dialog/intercept markers, specifications/actions/source downloads for every card and link-simple on every external link. Browser checks cover direct navigation, Fruit Jelly variation links, hover playback/reset, keyboard navigation, inline credits and responsive layout. Screenshots and diagnostic evidence remain ignored under docs/validation/gallery/direct-navigation.
