// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import type { PageBlock, PageContent, PageLink, Word } from './types';

const BLOCK_SELECTOR = 'h1,h2,h3,h4,p,li,blockquote,pre,td,dd';
const clean = (text: string) => text.replace(/\s+/g, ' ').trim();

export function parsePage(html: string, url: string): PageContent {
  // A template is inert: remote scripts, images, iframes and styles never mount.
  // Only newly-created elements and textContent leave this boundary.
  const template = document.createElement('template');
  template.innerHTML = html;
  const fragment = template.content;
  const title = clean(fragment.querySelector('title')?.textContent ?? fragment.querySelector('h1')?.textContent ?? new URL(url).hostname).slice(0, 200);
  fragment.querySelectorAll('script,style,noscript,template,svg,canvas,iframe,object,embed,form,nav,footer,aside,[hidden],[aria-hidden="true"]').forEach(node => node.remove());
  const root = fragment.querySelector('.mw-parser-output,article,main,[role="main"]') ?? fragment;
  const links: PageLink[] = [];
  const seen = new Set<string>();
  for (const anchor of root.querySelectorAll('a[href]')) {
    try {
      const link = new URL(anchor.getAttribute('href') ?? '', url);
      const label = clean(anchor.textContent ?? '');
      link.hash = '';
      if (!['http:', 'https:'].includes(link.protocol) || link.username || link.password || link.href === url || seen.has(link.href) || label.length < 3) continue;
      seen.add(link.href);
      links.push({ title: label.slice(0, 70), url: link.href });
      if (links.length === 12) break;
    } catch { /* A malformed source link is not a navigable destination. */ }
  }
  const blocks: PageBlock[] = [];
  let length = 0;
  let truncated = false;
  for (const element of root.querySelectorAll(BLOCK_SELECTOR)) {
    if (element.parentElement?.closest(BLOCK_SELECTOR)) continue;
    const text = clean(element.textContent ?? '');
    if (!text) continue;
    if (length + text.length > 20_000 || blocks.length >= 120) { truncated = true; break; }
    const tag = element.tagName.toLowerCase();
    const kind: PageBlock['kind'] = tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'li' ? tag : tag === 'blockquote' ? 'quote' : 'p';
    blocks.push({ kind, text });
    length += text.length;
  }
  if (blocks.length === 0) {
    const text = clean(root.textContent ?? '');
    if (text.length > 30) { blocks.push({ kind: 'p', text: text.slice(0, 20_000) }); truncated = text.length > 20_000; }
  }
  if (blocks.length === 0 || blocks.reduce((sum, block) => sum + block.text.length, 0) < 30) {
    throw new Error('읽을 수 있는 본문이 없습니다. 로그인이나 JavaScript가 필요한 페이지일 수 있습니다. 다른 글의 주소를 입력해 주세요.');
  }
  if (blocks[0]?.kind !== 'h1') blocks.unshift({ kind: 'h1', text: title });
  return { title, url, blocks, links, source: 'live', truncated };
}

export function renderPage(page: PageContent, article: HTMLElement): Word[] {
  article.replaceChildren();
  const fragment = document.createDocumentFragment();
  const words: Word[] = [];
  const sentenceSegmenter = new Intl.Segmenter(undefined, { granularity: 'sentence' });
  const wordSegmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
  let sentence = 0;
  for (const block of page.blocks) {
    const element = document.createElement(block.kind === 'quote' ? 'blockquote' : block.kind === 'li' ? 'p' : block.kind);
    if (block.kind === 'li') element.className = 'list-line';
    for (const segment of sentenceSegmenter.segment(block.text)) {
      for (const piece of wordSegmenter.segment(segment.segment)) {
        if (!piece.isWordLike) { element.append(document.createTextNode(piece.segment)); continue; }
        const span = document.createElement('span');
        const id = words.length;
        span.className = 'word';
        span.dataset.word = String(id);
        span.textContent = piece.segment;
        span.dataset.tone = String((id * 7 + sentence * 3) % 19);
        words.push({ id, sentence, text: piece.segment, element: span, x: 0, y: 0, width: 0, height: 0, font: '', eaten: false, reserved: false });
        element.append(span);
      }
      sentence++;
    }
    fragment.append(element);
  }
  article.append(fragment);
  return words;
}

export function measureWords(words: Word[], viewport: HTMLElement): void {
  const bounds = viewport.getBoundingClientRect();
  const scroll = viewport.scrollTop;
  const fonts = new Map<Element, string>();
  // One read batch on resize/content changes, never one layout read per frame.
  for (const word of words) {
    const rect = word.element.getBoundingClientRect();
    word.x = rect.left - bounds.left + rect.width / 2;
    word.y = rect.top - bounds.top + scroll + rect.height / 2;
    word.width = rect.width;
    word.height = rect.height;
    const parent = word.element.parentElement!;
    if (!fonts.has(parent)) {
      const style = getComputedStyle(parent);
      fonts.set(parent, `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`);
    }
    word.font = fonts.get(parent)!;
  }
}
