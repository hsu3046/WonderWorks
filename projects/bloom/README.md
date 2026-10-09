# Bloom Studio

An original 3D floral QR studio for Wonderworks, inspired by [@ann_nnng](https://x.com/ann_nnng). © 2026 [AIB Inc.](https://www.aib.vote), GNU GPL v3.

## Run

```sh
npm ci --prefix projects/bloom
npm run dev --prefix projects/bloom
# http://127.0.0.1:4185/
npm run build --prefix projects/bloom
npm run test --prefix projects/bloom
```

Four procedural vase bouquets: layered roses, airy daisies, cupped tulips and sculpted dahlias. Five palettes, optional breeze, smooth orbit and animated flower-to-QR transformation. Enter a website, press Enter or Apply, then transform, verify or download. Actions also validate and apply a newly typed link. Garden links preserve the URL, template, palette and breeze in the fragment; localhost links only work on the same computer.

The URL is encoded locally using QR error correction H, limited to180 UTF-8 bytes. Every exported PNG is decoded locally with jsQR before saving. Downloads use full dark cells, subtle petal emboss and a four-module white quiet zone. The scene switches to unlit dark ink at the end of the morph so lighting cannot break threshold detection. Check QR validates both the rendered scene (when settled in QR mode) and export. Device cameras and print reproduction should still be checked before mass printing.

All flowers, leaves, vase ornaments, garden geometry are original procedural artwork. Flower selection thumbnails are AI-generated botanical photographs. The supplied reference video is not redistributed. Three.js, node-qrcode and jsQR retain their MIT licenses. Instrument Serif / DM Sans load from Google Fonts under their original OFL terms; serif/sans-serif fallbacks work offline.

Study 12 in the Wonderworks gallery. The root setup installs its dedicated QR dependencies, and the root build packages the experiment, preview and source archive.
