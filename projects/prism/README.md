# Prism Studio

A holographic card atelier for Wonderworks. Upload a card image or enter a direct image URL, then explore nine original foil finishes. © 2026 [AIB Inc.](https://www.aib.vote), GNU GPL v3.

## Develop

From the repository root, use the installed shared toolchain (or run root `npm run setup` on a fresh clone), then link it and start:

```sh
ln -s ../fish/node_modules projects/prism/node_modules # only if absent
npm run dev --prefix projects/prism
npm run test --prefix projects/prism
npm run build --prefix projects/prism
```

Local studio: http://127.0.0.1:4186/. No separate runtime dependency installation is needed in this checkout. The gallery build includes this study at `/experiments/prism/index.html` and packages its source archive.

- Cosmos, Spectrum, Starlight, Crystalline, Contour, Gilded, Swirl, Bursts and Glitter materials.
- Full-card, illustration-window and reverse foil coverage; window edges can be adjusted for different card layouts.
- Intensity, gloss, pattern scale, micro sparkle, metal tint, frame width and edge sparkle controls; maximum tilt from 0–32°.
- Hover/drag tilt, keyboard arrows, original comparison, optional automatic motion and PNG snapshots.
- Browser-only image processing. Remote servers must allow CORS; otherwise download the image and use the file picker. Uploads are limited to 20 MB. There is no upload server or automatic card recognition.

Original sample: AI-generated Lunara fantasy card. Reference video/third-party card illustrations are not bundled. Foil families were studied via [Simon Goellner’s demos](https://poke-holo.simey.me/); shaders and interface are original implementations. Three.js retains its MIT license; Google Fonts Instrument Serif and DM Sans retain their OFL terms.


Inspired by [@davidhaz](https://x.com/davidhaz). The [React Bits Holo Card](https://reactbits.dev/components/holo-card) demo informed the circular spectrum, radial dashes, fine glitter and material controls. Implementation is original GLSL, with no copied React Bits source or card artwork. All input modes share the maximum tilt clamp; reset restores tint, frame and tilt along with the finish.
