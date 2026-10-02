// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
export interface PageBlock { kind: 'h1' | 'h2' | 'h3' | 'p' | 'quote' | 'li'; text: string; }
export interface PageLink { title: string; url: string; }
export interface PageContent {
  title: string;
  url: string;
  blocks: PageBlock[];
  links: PageLink[];
  source: 'demo' | 'live';
  truncated: boolean;
  snapshot?: { html: string; width: number; height: number; partial: boolean };
}
export interface Word {
  id: number;
  sentence: number;
  text: string;
  element: HTMLElement;
  range?: Range;
  visual?: { target: (color: string | null) => void; consume: () => void };
  x: number;
  y: number;
  width: number;
  height: number;
  font: string;
  eaten: boolean;
  reserved: boolean;
}
export interface Point { x: number; y: number; }
export interface Meal { words: Word[]; text: string; color: string; }
