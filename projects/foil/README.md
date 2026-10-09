# Foil Studio

A picture, a little shimmer, a letter inside. Independent Wonderworks study inspired by [Ann Nguyen (@ann_nnng)](https://x.com/ann_nnng)'s supplied Foil Studio recording.

```sh
npm run dev --prefix projects/foil
# http://127.0.0.1:4184/
npm run test --prefix projects/foil
npm run build --prefix projects/foil
```

This checkout reuses the already installed `projects/fish/node_modules` through a local symlink. No packages were installed. Package versions are declared independently in `package.json`.

Upload, drop or paste a JPG/PNG/WebP/GIF (15 MB maximum). Drag the card to turn it, tap to unfold, or use the explicit open button. Keyboard: Enter/Space opens, arrows rotate, R resets. Choose an image shape, foil mask, one of six metals and six paper stocks. Type up to 600 characters inside. PNG export captures the current view.

Links contain the card data in the URL fragment, including a JPEG preview up to 380 px. No upload service or database is used. Anyone with the link can read its contents. Messaging applications may reject long links. Localhost links only work on the computer running the preview; sharing with others requires hosting this standalone build. Editing does not overwrite an already created link. Images and drafts are otherwise held in memory and are lost on reload.

Source, artwork and documentation: GNU GPL v3, © 2026 [AIB Inc.](https://www.aib.vote). Original implementation and procedurally drawn botanical samples; no original source, fonts or artwork were copied from the recording. Three.js retains its MIT license.

See [implementation and validation](../../docs/foil/ARCHITECTURE.md). Registered as study 11 in the Wonderworks gallery; the root build packages its experience and source ZIP.

## Wedding collection

Choose Garden vows, Something blue or Written in the stars from the three artwork thumbnails. Each loads an original AI-generated wedding cover and matching foil/paper preset while keeping the letter and sender. Cover wording is baked into the image; the letter inside remains editable. Template links use stable IDs without embedding image data. [Asset provenance and prompts](../../docs/foil/WEDDING-ASSETS.md).
