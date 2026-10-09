// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
export function canvas(width: number, height: number): HTMLCanvasElement {
  const surface = document.createElement('canvas'); surface.width = width; surface.height = height; return surface;
}
export function context(surface: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = surface.getContext('2d'); if (!ctx) throw new Error('Your browser could not prepare the card artwork.'); return ctx;
}
export function sampleArtwork(index: number): HTMLCanvasElement {
  const surface = canvas(900, 1200), c = context(surface);
  c.fillStyle = '#fffdf5'; c.fillRect(0, 0, 900, 1200);
  c.strokeStyle = '#d2c099'; c.lineWidth = 1.4;
  c.strokeRect(39, 39, 822, 1122); c.strokeRect(47, 47, 806, 1106);
  c.textAlign = 'center';
  c.fillStyle = '#8d6c38'; c.font = '17px Georgia';
  c.fillText(['FOR SOMEONE WONDERFUL', 'A SMALL NOTE TO SAY', 'SOME THINGS ARE MAGIC'][index]!, 450, 119);
  c.font = 'italic 106px Georgia';
  const words = [['A little', 'wonder.'], ['You make', 'life lovely.'], ['Stay', 'curious.']][index]!;
  c.fillText(words[0]!, 450, 271); c.fillText(words[1]!, 450, 385);
  c.font = 'italic 22px Georgia'; c.fillStyle = '#858a6d';
  c.fillText(['The world is brighter with you in it.', 'Today, tomorrow, and all the little days.', 'There is beauty in the smallest things.'][index]!, 450, 449);
  const random = (n: number): number => { const x = Math.sin(n * 91.7 + index * 17) * 43758.5453; return x - Math.floor(x); };
  const leaf = (x: number, y: number, angle: number, size: number, tint: string): void => {
    c.save(); c.translate(x, y); c.rotate(angle); c.beginPath(); c.moveTo(0, 0);
    c.bezierCurveTo(-size * .6, -size * .55, -size * .2, -size * 1.1, 0, -size * 1.6);
    c.bezierCurveTo(size * .7, -size, size * .55, -size * .3, 0, 0);
    c.fillStyle = tint; c.fill(); c.strokeStyle = '#596c46'; c.lineWidth = .8; c.stroke();
    c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -size * 1.4); c.stroke(); c.restore();
  };
  // Original botanical illustration; no artwork is extracted from the reference recording.
  for (let i = 0; i < 15; i++) {
    const x = 160 + random(i + 1) * 580, top = 550 + random(i + 30) * 350;
    const base = 420 + (random(i + 90) - .5) * 160;
    c.beginPath(); c.moveTo(base, 1100); c.bezierCurveTo(base - 50, 850, x + 35, top + 170, x, top);
    c.strokeStyle = '#727d50'; c.lineWidth = 2.3; c.stroke();
    for (let j = 1; j < 5; j++) {
      const t = j / 5, lx = base + (x - base) * t, ly = 1100 + (top - 1100) * t;
      leaf(lx, ly, (j % 2 ? -1 : 1) * (.65 + random(i + j) * .6), 24 + random(i * 7 + j) * 25, ['#8c9a6b','#a7b18a','#748660'][i % 3]!);
    }
    if (i % 3 === 0) {
      for (let j = 0; j < 7; j++) {
        c.save(); c.translate(x + Math.sin(j * 2.4) * 13, top + j * 12); c.rotate(j * .7);
        c.fillStyle = index === 2 ? '#c4b6d5' : '#d6ba79'; c.strokeStyle = '#9b8758'; c.lineWidth = 1;
        c.beginPath(); c.ellipse(0, 0, 7, 15, 0, 0, Math.PI * 2); c.fill(); c.stroke(); c.restore();
      }
    }
  }
  const flower = (x: number, y: number, radius: number, seed: number): void => {
    c.save(); c.translate(x, y);
    for (let layer = 0; layer < 4; layer++) {
      const r = radius * (1 - layer * .22), count = 7 - layer;
      for (let j = 0; j < count; j++) {
        const angle = j / count * Math.PI * 2 + layer * 1.2;
        c.save(); c.rotate(angle); const g = c.createRadialGradient(0, -r * .1, 0, 0, -r * .5, r);
        g.addColorStop(0, index === 1 ? '#e3b06f' : '#cf7e85'); g.addColorStop(.7, index === 1 ? '#f1d2a0' : '#efbbc0'); g.addColorStop(1, '#fae4d9');
        c.fillStyle = g; c.strokeStyle = '#a57461'; c.lineWidth = 1.4;
        c.beginPath(); c.moveTo(0, 8); c.bezierCurveTo(-r * .6, -r * .1, -r * .8, -r * .85, -r * .24, -r);
        c.bezierCurveTo(r * .2, -r * 1.15, r * .8, -r * .65, 0, 8); c.fill(); c.stroke();
        c.strokeStyle = '#ae797055'; c.lineWidth = .7;
        for (let k = 0; k < 5; k++) { c.beginPath(); c.moveTo(0, -5); c.quadraticCurveTo((k - 2) * r * .12, -r * .3, (k - 2) * r * .1, -r * .8); c.stroke(); }
        c.restore();
      }
    }
    for (let j = 0; j < 20; j++) { const a = j * 2.4, r = random(seed + j) * radius * .17; c.fillStyle = '#937138'; c.beginPath(); c.arc(Math.cos(a) * r, Math.sin(a) * r, 2.8, 0, Math.PI * 2); c.fill(); }
    c.restore();
  };
  flower(443, 775, 143, 11); flower(225, 896, 89, 23); flower(640, 927, 105, 31); flower(632, 602, 61, 43);
  c.font = '16px Georgia'; c.fillStyle = '#8c805e'; c.fillText('S E N T   W I T H   L O V E', 450, 1130);
  return surface;
}
export async function loadImage(source: string): Promise<HTMLImageElement> {
  const image = new Image(); image.src = source;
  try { await image.decode(); } catch { throw new Error('This picture could not be opened. Try a JPG, PNG or WebP.'); }
  if (!image.naturalWidth || image.naturalWidth * image.naturalHeight > 48_000_000) throw new Error('Please use a picture smaller than 48 megapixels.');
  return image;
}
export async function importImage(file: File): Promise<HTMLCanvasElement> {
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) throw new Error('Choose a JPG, PNG, WebP or GIF picture.');
  if (file.size > 15 * 1024 * 1024) throw new Error('Please use a picture smaller than 15 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url), scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
    const result = canvas(Math.max(1, Math.round(image.naturalWidth * scale)), Math.max(1, Math.round(image.naturalHeight * scale)));
    const c = context(result); c.fillStyle = '#fff'; c.fillRect(0, 0, result.width, result.height); c.drawImage(image, 0, 0, result.width, result.height); return result;
  } finally { URL.revokeObjectURL(url); }
}
export function shareImage(source: HTMLCanvasElement): string {
  const scale = Math.min(1, 380 / Math.max(source.width, source.height));
  const surface = canvas(Math.max(1, Math.round(source.width * scale)), Math.max(1, Math.round(source.height * scale)));
  context(surface).drawImage(source, 0, 0, surface.width, surface.height);
  for (const quality of [.75, .55, .35]) { const data = surface.toDataURL('image/jpeg', quality); if (data.length < 95_000) return data; }
  throw new Error('This picture is too detailed for a link. Save a picture instead.');
}
