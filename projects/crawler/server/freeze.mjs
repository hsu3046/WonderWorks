// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
// Runs inside the capture browser. Only a new inert document leaves this boundary.
export function freezeDocument({ assets, fonts, maxNodes = 3000 }) {
  const resources = new Map(assets);
  const output = document.implementation.createHTMLDocument(document.title);
  const properties = (`display position top right bottom left z-index float clear box-sizing width height min-width max-width min-height max-height
    margin-top margin-right margin-bottom margin-left padding-top padding-right padding-bottom padding-left
    border-top border-right border-bottom border-left border-radius border-collapse border-spacing box-shadow outline
    background-color background-image background-position background-size background-repeat background-origin background-clip
    color font-family font-size font-weight font-style font-stretch font-variant line-height letter-spacing word-spacing
    text-align text-transform text-indent text-decoration text-shadow white-space word-break overflow-wrap vertical-align
    flex-direction flex-wrap flex-grow flex-shrink flex-basis align-items align-self align-content justify-content order gap
    grid-template-columns grid-template-rows grid-auto-columns grid-auto-rows grid-auto-flow grid-column grid-row
    opacity visibility overflow-x overflow-y transform transform-origin object-fit object-position aspect-ratio
    list-style-type list-style-position fill fill-rule stroke stroke-width stroke-linecap stroke-linejoin clip-path`).split(/\s+/);
  const skip = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'BASE', 'IFRAME', 'OBJECT', 'EMBED', 'NOSCRIPT', 'TEMPLATE', 'FOREIGNOBJECT']);
  const attributes = new Set(['id', 'lang', 'dir', 'title', 'alt', 'role', 'aria-label', 'colspan', 'rowspan', 'viewbox', 'd', 'points', 'x', 'y', 'x1', 'x2', 'y1', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height', 'preserveaspectratio', 'fill-rule', 'clip-rule', 'offset', 'stop-color', 'stop-opacity']);
  let nodes = 0, partial = false;
  const imageData = url => {
    if (/^data:image\/(png|jpeg|gif|webp|avif|svg\+xml)[;,]/i.test(url) && url.length < 2_000_000) return url;
    return resources.get(url) ?? '';
  };
  const safeURLs = value => value.replace(/url\(\s*(["']?)(.*?)\1\s*\)/gi, (_match, _quote, url) => {
    if (url.startsWith('#')) return `url("${url.replaceAll('"', '')}")`;
    let data = '';
    try { data = imageData(new URL(url, document.baseURI).href); } catch { return 'none'; }
    return data ? `url("${data}")` : 'none';
  });
  function applyStyle(source, target, pseudo) {
    const style = getComputedStyle(source, pseudo);
    for (const property of properties) {
      const value = style.getPropertyValue(property);
      if (value) target.style.setProperty(property, safeURLs(value));
    }
    target.style.setProperty('animation', 'none', 'important');
    target.style.setProperty('transition', 'none', 'important');
    target.style.setProperty('caret-color', 'transparent');
  }
  function pseudo(source, target, selector) {
    const content = getComputedStyle(source, selector).content;
    if (!content || content === 'none' || content === 'normal' || !/^".*"$/.test(content)) return;
    const span = output.createElement('span');
    try { span.textContent = JSON.parse(content); } catch { return; }
    applyStyle(source, span, selector);
    target.append(span);
  }
  function copy(node) {
    if (++nodes > maxNodes) { partial = true; return null; }
    if (node.nodeType === Node.TEXT_NODE) return output.createTextNode(node.textContent ?? '');
    if (!(node instanceof Element) || skip.has(node.tagName.toUpperCase())) return null;
    const style = getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return null;
    if (node.getBoundingClientRect().top + scrollY > 12_000) { partial = true; return null; }
    const tag = node.tagName.toLowerCase();
    if (['audio', 'video', 'canvas'].includes(tag)) { partial = true; return null; }
    const svg = node.namespaceURI === 'http://www.w3.org/2000/svg';
    const target = svg ? output.createElementNS(node.namespaceURI, tag) : output.createElement(tag.includes('-') || tag === 'form' ? 'div' : tag);
    for (const attr of node.attributes) if (attributes.has(attr.name.toLowerCase())) target.setAttribute(attr.name, attr.value);
    if (tag === 'use') {
      const href = node.getAttribute('href') ?? node.getAttribute('xlink:href');
      if (href?.startsWith('#')) target.setAttribute('href', href);
    }
    applyStyle(node, target);
    if (tag === 'img') {
      const data = imageData(node.currentSrc || node.src);
      if (data) target.setAttribute('src', data); else partial = true;
    }
    if (['input', 'button', 'select', 'textarea'].includes(tag)) {
      target.setAttribute('disabled', '');
      if ('value' in node) target.setAttribute('value', node.value);
    }
    if (!svg) pseudo(node, target, '::before');
    for (const child of node.childNodes) { const cloned = copy(child); if (cloned) target.append(cloned); }
    if (!svg) pseudo(node, target, '::after');
    return target;
  }
  const body = copy(document.body);
  if (!body) throw new Error('No renderable content');
  output.body.replaceWith(body);
  applyStyle(document.documentElement, output.documentElement);
  output.documentElement.style.setProperty('overflow-y', 'auto');
  output.documentElement.style.setProperty('overflow-x', 'hidden');
  output.documentElement.style.setProperty('scroll-behavior', 'auto');
  output.documentElement.lang = document.documentElement.lang || 'en';
  const fontStyle = output.createElement('style'); fontStyle.textContent = fonts; output.head.append(fontStyle);
  const links = [];
  const seen = new Set();
  for (const anchor of document.querySelectorAll('a[href]')) {
    const title = anchor.textContent?.replace(/\s+/g, ' ').trim();
    if (title && title.length > 2 && /^https?:\/\//.test(anchor.href) && !seen.has(anchor.href)) {
      seen.add(anchor.href); links.push({ title: title.slice(0, 70), url: anchor.href });
      if (links.length === 12) break;
    }
  }
  return { html: '<!doctype html>' + output.documentElement.outerHTML, title: document.title, links, partial };
}
