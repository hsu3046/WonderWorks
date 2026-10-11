// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
export const STAMP_IDS = ['fern', 'iris', 'sun', 'moon', 'bird', 'orange'] as const;
export type StampId = typeof STAMP_IDS[number];
export type Paper = 'ivory' | 'rose' | 'sage';
export interface Letter { id: string; to: string; from: string; message: string; stamp: StampId; paper: Paper; x: number; y: number; angle: number; date: string; }
export const STORAGE_KEY = 'wonderworks.dearly.letters.v1';
export function position(x: number, y: number): {x: number; y: number} {
  return {x: Math.max(.10, Math.min(.90, x)), y: Math.max(.16, Math.min(.80, y))};
}
export function validateDraft(to: string, message: string, attached: boolean): string | null {
  if (!to.trim()) return 'Who is this little letter for?';
  if (!message.trim()) return 'A few words make all the difference. Write a little note.';
  if (!attached) return 'One last thing: place a stamp on the envelope.';
  return null;
}
// Stored content is untrusted; read only known, bounded data fields.
export function readLetters(raw: string | null): Letter[] {
  if (!raw) return [];
  const data: unknown = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error('Invalid letterbox');
  return data.slice(0, 40).flatMap((v: unknown): Letter[] => {
    if (typeof v !== 'object' || v === null) return [];
    const o = v as Record<string, unknown>;
    if (typeof o.id !== 'string' || typeof o.to !== 'string' || typeof o.from !== 'string' || typeof o.message !== 'string' || typeof o.date !== 'string' || !Number.isFinite(Date.parse(o.date))) return [];
    if (!STAMP_IDS.includes(o.stamp as StampId) || !['ivory', 'rose', 'sage'].includes(o.paper as string)) return [];
    if (![o.x, o.y, o.angle].every(n => typeof n === 'number' && Number.isFinite(n))) return [];
    return [{id:o.id.slice(0,80),to:o.to.slice(0,60),from:o.from.slice(0,60),message:o.message.slice(0,1200),stamp:o.stamp as StampId,paper:o.paper as Paper,...position(o.x as number,o.y as number),angle:Math.max(-15,Math.min(15,o.angle as number)),date:o.date}];
  });
}
