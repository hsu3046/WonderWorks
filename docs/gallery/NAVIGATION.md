# Gallery navigation and copy

2026-10-03 — AIB Inc.

- Artwork, top-index and Open experience links open their selected experience directly in a new tab with noopener/noreferrer. The gallery stays available; there is no project or credits dialog and no gallery live iframe.
- Each main card includes its description, inspiration credit, technology tags, concise specifications, Open experience, Download source and license. Gallery downloads and detailed attribution are in the inline Credits and licenses section.
- Fruit Jelly selection updates the poster and all three experience links, including the top index. Each project shares one source download across its variants.
- Card previews retain one shared muted video decoder, intentional hover, first-frame reset on leave and offscreen/hidden cleanup. Text updates target the preview label so the Phosphor play icon remains intact.
- Card creator names and the footer copyright intentionally have no icon. Other external creator/publisher/license links and links opening a separate document use Phosphor link-simple. The full artwork remains clickable without an overlay arrow; the Open experience button uses arrow-right; section navigation uses arrow-down; source downloads use download-simple. Five regular SVGs are pinned with the original MIT notice and provenance in gallery/src/icons.
- Descriptions use two short sentences, clear verbs and consistent punctuation. Primary actions are Open experience and Download source. Specifications use consistent subject labels and separators. Stillwater copy now reflects the existing five-fish scene; no artwork simulation or geometry changed.
- Static HTML includes all actions and information before JavaScript. The shared renderer runs in Vite and in the browser; noEmit TypeScript permits explicit .ts imports so the same renderer is also readable by Node during build validation.

## Layout and naming feedback

- Main navigation gaps are 44px on desktop, 18px on mobile and 12px at the narrowest breakpoint. Explore the collection uses a 16px text/arrow gap with 12px horizontal insets. Credits and licenses uses an 8px gap/inset and 2px bottom padding for a shorter, closer underline.
- Collection introduction is directly below its title. Collection and credits italics use looser -.015em tracking. Project years sit 12px from their titles and wrap when needed.
- Hero pointer rotation spans ±75° horizontally and ±45° vertically (previously approximately ±14°/±8°). Normalized input is clamped, and existing smoothing, visibility and reduced-motion behavior remain intact.
- All ten titles were reviewed against the actual experience. Webcrawler becomes Web Crawler in public copy; established titles, identifiers, routes and archive filenames are retained. See [title review](TITLES.md).

## Second annotated refinement

- Desktop cards use a shared two-row grid: category/title/tagline occupy the text column in row one, while the artwork and full description both start in row two. This aligns the preview and description tops without measured offsets, including alternating cards and wrapped headings. Mobile retains image → heading → description order.
- Footer copyright remains an external link with no icon. Footer wordmark shares the header’s orange brand-period.

## Validation

Check gallery TypeScript, the full repository check/build and scripts/check-site.mjs. The static check verifies no dialog/intercept markers, specifications/actions/source downloads for every card and safe new-tab experience links and link-simple on other external links (compact card creator names and footer copyright are the explicit exceptions). Browser checks cover direct navigation, Fruit Jelly variation links, hover playback/reset, keyboard navigation, inline credits and responsive layout. Screenshots and diagnostic evidence remain ignored under docs/validation/gallery/direct-navigation.
