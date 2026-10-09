// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
export const weddingTemplates = [
  { id: 'wedding-garden', name: 'Garden vows', detail: 'Blush roses · Rose gold', file: 'wedding-garden.png', foil: 2, paper: 0, amount: 24 },
  { id: 'wedding-toile', name: 'Something blue', detail: 'French toile · Silver', file: 'wedding-toile.png', foil: 1, paper: 0, amount: 18 },
  { id: 'wedding-celestial', name: 'Written in the stars', detail: 'Celestial doves · Gold', file: 'wedding-celestial.png', foil: 0, paper: 0, amount: 32 },
] as const;
export type WeddingTemplateId = typeof weddingTemplates[number]['id'];
export function isWeddingTemplateId(value: unknown): value is WeddingTemplateId {
  return weddingTemplates.some(template => template.id === value);
}
