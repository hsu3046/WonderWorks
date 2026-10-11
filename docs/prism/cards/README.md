# Prism Archive — 30 cards

Thirty original fantasy collectible-card illustrations generated individually with the built-in image generation tool (new generation, opaque background). Each has a distinct creature, environment and colour palette within a shared engraved botanical/celestial frame. No external franchise artwork is included. © 2026 AIB Inc.

- `prompts.json`: exact per-card prompts, titles, species and ability names.
- `generated.json`: generation source path, web asset path, local original path, byte count and SHA-256.
- `projects/prism/public/art/cards/`: 1000px-wide JPEG delivery copies, loaded only when selected.
- `local-assets/prism-originals/`: 30 untouched original PNGs, copied byte-for-byte from image generation output, plus a manifest and prompt copy. This local folder is excluded from Git and release packages. The original generator output is also preserved.

The collection navigation preserves material controls and rotation. A request cursor allows repeated navigation while a decode is pending; the displayed name and number commit only with the successful image. A superseded request cannot replace a later selection, and an error retains the prior displayed card. User uploads have no collection index; next/previous returns to the first/last card.

Validation: 30 unique JPEG assets and collection boundary tests; 8 Prism tests, strict TypeScript and production build pass. Desktop and 390px mobile navigation, rapid next clicks, keyboard activation, both wrap directions and preservation of Swirl verified in the browser. Existing Three.js chunk-size warning remains.
