// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import type { PageContent, Word } from './types';

const POLICY = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";

export function snapshotDocument(html: string): string {
  const document = new DOMParser().parseFromString(html, 'text/html');
  document.querySelectorAll('script,iframe,object,embed,base,link,meta,foreignObject,audio,video,template').forEach(node => node.remove());
  for (const element of document.querySelectorAll('*')) {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      if (name.startsWith('on') || ['srcdoc', 'srcset', 'action', 'formaction', 'target', 'download', 'ping', 'autofocus', 'is', 'contenteditable'].includes(name)) element.removeAttribute(attribute.name);
      if (['href', 'xlink:href'].includes(name) && !(element.localName === 'use' && attribute.value.startsWith('#'))) element.removeAttribute(attribute.name);
      if (name === 'src' && !(element.localName === 'img' && /^data:image\//i.test(attribute.value))) element.removeAttribute(attribute.name);
    }
    if (['input', 'button', 'select', 'textarea'].includes(element.localName)) element.setAttribute('disabled', '');
  }
  const policy = document.createElement('meta'); policy.httpEquiv = 'Content-Security-Policy'; policy.content = POLICY;
  document.head.prepend(policy);
  const style = document.createElement('style');
  style.textContent = '::highlight(crawler-eaten){color:transparent;text-shadow:none;text-decoration-color:transparent}::highlight(crawler-prey-0){color:#97bf32;background-color:#b7db6f30}::highlight(crawler-prey-1){color:#c653a0;background-color:#f48bce30}::highlight(crawler-prey-2){color:#3488ab;background-color:#79dded30}html{scroll-behavior:auto!important}*{cursor:crosshair!important}';
  document.head.append(style);
  return '<!doctype html>' + document.documentElement.outerHTML;
}

export async function mountSnapshot(page: PageContent, viewport: HTMLElement, signal: AbortSignal): Promise<{ frame: HTMLIFrameElement; words: Word[] }> {
  if (!page.snapshot) throw new Error('원본 화면이 없습니다.');
  const frame = document.createElement('iframe');
  frame.className = 'original-page'; frame.title = `${page.title} — 원본 디자인`;
  // allow-scripts is deliberately absent; the parent only reads static DOM.
  frame.setAttribute('sandbox', 'allow-same-origin');
  frame.referrerPolicy = 'no-referrer';
  frame.dataset.captureWidth = String(page.snapshot.width);
  frame.style.width = `${page.snapshot.width}px`;
  frame.style.height = `${viewport.clientHeight}px`;
  frame.style.visibility = 'hidden';
  const abort = () => frame.remove();
  signal.addEventListener('abort', abort, { once: true });
  try {
    signal.throwIfAborted();
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => finish(new Error('원본 화면을 표시하는 데 시간이 오래 걸립니다.')), 6000);
      const onAbort = () => finish(signal.reason);
      const finish = (error?: unknown) => {
        window.clearTimeout(timer); signal.removeEventListener('abort', onAbort);
        frame.onload = null;
        if (error) reject(error); else resolve();
      };
      signal.addEventListener('abort', onAbort, { once: true });
      frame.onload = () => finish();
      frame.srcdoc = snapshotDocument(page.snapshot!.html);
      viewport.append(frame);
    });
    signal.throwIfAborted();
    const doc = frame.contentDocument!;
    const scope = frame.contentWindow as Window & typeof globalThis;
    if (!scope.Highlight || !scope.CSS.highlights) throw new Error('이 브라우저는 원본 화면의 단어 효과를 지원하지 않습니다.');
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => finish(new Error('원본 글꼴을 표시하는 데 시간이 오래 걸립니다.')), 4000);
      const onAbort = () => finish(signal.reason);
      const finish = (error?: unknown) => {
        window.clearTimeout(timer); signal.removeEventListener('abort', onAbort);
        if (error) reject(error); else resolve();
      };
      signal.addEventListener('abort', onAbort, { once: true });
      void doc.fonts.ready.then(() => finish(), error => finish(error));
    });
    signal.throwIfAborted();
    const eaten = new scope.Highlight();
    const targets = [new scope.Highlight(), new scope.Highlight(), new scope.Highlight()];
    eaten.priority = 2;
    scope.CSS.highlights.set('crawler-eaten', eaten);
    targets.forEach((target, i) => scope.CSS.highlights.set(`crawler-prey-${i}`, target));
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    const wordSegmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
    const sentenceSegmenter = new Intl.Segmenter(undefined, { granularity: 'sentence' });
    const words: Word[] = [];
    const groups = new Map<Element, { text: string; nodes: { node: Node; start: number; end: number }[] }>();
    const visibility = new Map<Element, boolean>();
    const visible = (element: Element): boolean => {
      const cached = visibility.get(element);
      if (cached !== undefined) return cached;
      const style = scope.getComputedStyle(element);
      const value = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && (!element.parentElement || visible(element.parentElement));
      visibility.set(element, value); return value;
    };
    let node: Node | null, sentence = 0;
    // Aggregate inline text before segmentation: styled or animated character
    // spans must still form whole words, without inserting wrapper elements.
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!parent || parent.closest('style,script,svg,input,textarea,select,[aria-hidden="true"]') || !node.textContent || !visible(parent)) continue;
      let block = parent.closest('p,h1,h2,h3,h4,h5,h6,li,dt,dd,blockquote,pre,td,th,button,a');
      if (!block) {
        block = parent;
        while (block.parentElement && scope.getComputedStyle(block).display === 'inline') block = block.parentElement;
      }
      const group = groups.get(block) ?? { text: '', nodes: [] };
      group.nodes.push({ node, start: group.text.length, end: group.text.length + node.textContent.length });
      group.text += node.textContent;
      groups.set(block, group);
    }
    for (const group of groups.values()) {
      for (const part of sentenceSegmenter.segment(group.text)) {
        for (const piece of wordSegmenter.segment(part.segment)) {
          if (!piece.isWordLike || words.length >= 4000) continue;
          const start = part.index + piece.index, end = start + piece.segment.length;
          const first = group.nodes.find(entry => entry.start <= start && entry.end > start)!;
          const last = group.nodes.find(entry => entry.start < end && entry.end >= end)!;
          const range = doc.createRange();
          range.setStart(first.node, start - first.start); range.setEnd(last.node, end - last.start);
          const rect = range.getBoundingClientRect();
          if (!rect.width || !rect.height) continue;
          words.push({ id: words.length, sentence, text: piece.segment, element: first.node.parentElement!, range, x: 0, y: 0, width: 0, height: 0, font: '', eaten: false, reserved: false,
            visual: {
              target: color => { targets.forEach(target => target.delete(range)); if (color) targets[Math.max(0, ['#c9f38a', '#f48bce', '#79dded'].indexOf(color))]!.add(range); },
              consume: () => { targets.forEach(target => target.delete(range)); eaten.add(range); },
            },
          });
        }
        sentence++;
      }
    }
    if (!words.length) throw new Error('원본 화면에서 먹을 수 있는 단어를 찾지 못했습니다.');
    return { frame, words };
  } catch (error) { frame.remove(); throw error; }
  finally { signal.removeEventListener('abort', abort); }
}
