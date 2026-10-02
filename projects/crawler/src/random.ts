// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
export interface ReadingPage { readonly title: string; readonly url: string; readonly language: string; }

function address(value: string): string {
  try { const url = new URL(value); url.hash = ''; return url.href; }
  catch { return value.trim(); }
}

export function createRandomPicker(pages: readonly ReadingPage[]): (excluded: readonly string[]) => ReadingPage {
  let remaining = [...pages];
  return excluded => {
    const skip = new Set(excluded.map(address));
    let choices = remaining.filter(page => !skip.has(address(page.url)));
    // Draw without replacement. Refill only after the available pages run out.
    if (!choices.length) { remaining = [...pages]; choices = remaining.filter(page => !skip.has(address(page.url))); }
    const selected = choices[Math.floor(Math.random() * choices.length)];
    if (!selected) throw new Error('랜덤으로 탐색할 페이지가 없습니다. 주소를 직접 입력해 주세요.');
    remaining.splice(remaining.indexOf(selected), 1);
    return selected;
  };
}
