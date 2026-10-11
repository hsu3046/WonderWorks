# Dearly — a little post office

A tactile correspondence study for Wonderworks. Choose an original illustrated stamp, stick it on an envelope, write a note, and watch it get folded, postmarked and tucked into a dimensional letterbox.

© 2026 [AIB Inc.](https://www.aib.vote). GNU GPL v3. No new runtime dependencies.

## Run

Uses the repository's installed shared Vite/TypeScript toolchain. On a fresh checkout run root `npm run setup`, which links Dearly automatically.

```sh
npm run dev --prefix projects/dearly # http://127.0.0.1:4187/
npm run test --prefix projects/dearly
npm run build --prefix projects/dearly
```

- Six original vector stamps; drag from the book on desktop, or choose and tap on touch. Enter/Space places chosen postage at the standard position.
- Three paper colours, recipient/sender and a 1,200-character letter.
- Seal → rubber stamp → ink impression → letterbox animation. Optional synthesised paper/stamp sounds, muted by default.
- Native scrolling and CSS perspective envelope stack; click to read. Five explicitly labelled sample letters are always available.
- Sent letters stay in localStorage on this browser and origin, up to 40. Reloads preserve sent letters. No email is sent and there is no cloud sync. Clearing browser data removes locally kept letters. Drafts are not persisted.
- Text-copy download, accessible dialog, keyboard controls and reduced-motion support.

Study 014 in the root gallery, deployed at `/experiments/dearly/index.html` by the root build. Inspired by [@raffiki_art](https://x.com/raffiki_art). Google Fonts Cormorant Garamond/DM Sans retain their OFL terms.
