// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import { isWeddingTemplateId } from './templates.ts';
import type { WeddingTemplateId } from './templates.ts';
export const shapes = ['Original', 'Portrait', 'Square', 'Landscape'] as const;
export const modes = ['Details', 'Shadows', 'A colour'] as const;
export const foils = [
  { name: 'Gold', colour: '#d8af5b', gradient: 'linear-gradient(135deg,#6f501e,#e9d398 32%,#fff8dc 42%,#ae8435 61%,#eed69a)' },
  { name: 'Silver', colour: '#d6dbe0', gradient: 'linear-gradient(135deg,#707982,#f8fbff 38%,#92999e 61%,#e5e7e9)' },
  { name: 'Rose gold', colour: '#e4ab9b', gradient: 'linear-gradient(135deg,#8c554f,#f9ddd0 38%,#b77c70 61%,#ebc4b4)' },
  { name: 'Copper', colour: '#c58958', gradient: 'linear-gradient(135deg,#703e28,#efbd91 38%,#98562e 61%,#ecc494)' },
  { name: 'Berry', colour: '#cc7c9b', gradient: 'linear-gradient(135deg,#704053,#f4c7dc 38%,#a65173 61%,#efb5d3)' },
  { name: 'Holographic', colour: '#e8ede0', gradient: 'linear-gradient(135deg,#e8a1d6,#a9d6f4 27%,#c7e8b2 45%,#f8daa1 67%,#cfb0ed)' },
] as const;
export const papers = [
  { name: 'Ivory', colour: '#f7f5e9' }, { name: 'Cream', colour: '#eae0c6' },
  { name: 'Blush', colour: '#e7c7c4' }, { name: 'Sage', colour: '#bfcbb4' },
  { name: 'Mist', colour: '#bed0db' }, { name: 'Midnight', colour: '#303440' },
] as const;
export interface CardState {
  version: 1; shape: number; mode: number; foil: number; paper: number;
  amount: number; gloss: number; border: boolean; target: string; letter: string; sender: string;
  sample: number; image: string | null;
  template?: WeddingTemplateId;
}
export function defaultState(): CardState {
  return { version: 1, shape: 0, mode: 0, foil: 0, paper: 0, amount: 38, gloss: 65, border: false,
    target: '#bb6f70', letter: 'A little reminder,\n\nthe world is lovelier\nwith you in it.', sender: '', sample: 0, image: null };
}
export function validateState(value: unknown): CardState {
  if (!value || typeof value !== 'object') throw new Error('This card link is incomplete.');
  const v = value as Record<string, unknown>;
  if (v.version !== 1) throw new Error('This card link uses an unsupported format.');
  if (v.template !== undefined && (!isWeddingTemplateId(v.template) || v.image !== null)) throw new Error('This card template is invalid.');
  const integer = (name: string, max: number): number => {
    const n = v[name];
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > max) throw new Error('This card link has invalid settings.');
    return n;
  };
  if (typeof v.letter !== 'string' || v.letter.length > 600 || typeof v.sender !== 'string' || v.sender.length > 60 ||
      typeof v.border !== 'boolean' || typeof v.target !== 'string' || !/^#[\da-f]{6}$/i.test(v.target) ||
      !(v.image === null || (typeof v.image === 'string' && v.image.length < 100_000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(v.image)))) {
    throw new Error('This card link contains invalid content.');
  }
  return { version: 1, shape: integer('shape', 3), mode: integer('mode', 2), foil: integer('foil', 5), paper: integer('paper', 5),
    amount: integer('amount', 100), gloss: v.gloss === undefined ? 65 : integer('gloss', 100), sample: integer('sample', 2), border: v.border, target: v.target,
    letter: v.letter, sender: v.sender, image: v.image,
    ...(isWeddingTemplateId(v.template) ? { template: v.template } : {}) };
}
export function encodeCard(state: CardState): string {
  const bytes = new TextEncoder().encode(JSON.stringify(validateState(state)));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
export function decodeCard(encoded: string): CardState {
  if (encoded.length > 140_000 || !/^[\w-]+$/.test(encoded)) throw new Error('This card link is too long or damaged.');
  try {
    const binary = atob(encoded.replaceAll('-', '+').replaceAll('_', '/'));
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return validateState(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown);
  } catch { throw new Error('This card link is damaged or incomplete. Please ask for a fresh one.'); }
}

// Relative luminance and a four-neighbour gradient preserve fine lines without foiling the whole photograph.
export function foilMask(data: Uint8ClampedArray, width: number, height: number, state: CardState): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height * 4);
  const luma = new Float32Array(width * height);
  for (let i = 0; i < luma.length; i++) luma[i] = (data[i * 4]! * .2126 + data[i * 4 + 1]! * .7152 + data[i * 4 + 2]! * .0722) / 255;
  const target = [1, 3, 5].map(offset => parseInt(state.target.slice(offset, offset + 2), 16) / 255);
  const amount = state.amount / 100;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x;
    const lum = luma[i]!;
    const edge = Math.abs(luma[y * width + Math.min(x + 1, width - 1)]! - luma[y * width + Math.max(x - 1, 0)]!) +
      Math.abs(luma[Math.min(y + 1, height - 1) * width + x]! - luma[Math.max(y - 1, 0) * width + x]!);
    let value = 0;
    if (state.mode === 0) value = Math.max(edge * (2 + amount * 12) - .18, (.43 + amount * .27 - lum) * 2.4);
    else if (state.mode === 1) value = (.08 + amount * .85 - lum) * 9;
    else {
      const distance = Math.hypot(data[i * 4]! / 255 - target[0]!, data[i * 4 + 1]! / 255 - target[1]!, data[i * 4 + 2]! / 255 - target[2]!);
      value = (.04 + amount * .8 - distance) * 12;
    }
    if (amount === 0) value = 0;
    const nx = x / width, ny = y / height;
    if (state.border && nx > .025 && nx < .975 && ny > .025 && ny < .975 && (nx < .029 || nx > .971 || ny < .028 || ny > .972)) value = 1;
    const alpha = Math.round(Math.max(0, Math.min(1, value)) * 255);
    out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = alpha;
    out[i * 4 + 3] = 255;
  }
  return out;
}
