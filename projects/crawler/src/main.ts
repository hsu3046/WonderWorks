// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import { parsePage, renderPage } from './reader';
import { sample } from './sample';
import { SpiderWorld } from './spider';
import type { Meal, PageContent, Word } from './types';

function required<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing interface element: ${selector}`);
  return element;
}

const viewport = required('#viewport');
const article = required('#article');
const canvas = required<HTMLCanvasElement>('#spiders');
const urlInput = required<HTMLInputElement>('#url');
const errorMessage = required('#error');
const loadStatus = required('#load-status');
const crawlButton = required<HTMLButtonElement>('#crawl-button');
const pauseButton = required<HTMLButtonElement>('#pause');
const resetButton = required<HTMLButtonElement>('#reset');
const eatenCount = required('#eaten-count');
const remaining = required('#remaining-count');
const progress = required('#progress');
const bites = required('#bites');
let page: PageContent = sample;
let words: Word[] = [];
let controller: AbortController | null = null;
let resumeAfterLoad = false;
let world: SpiderWorld;
const lifetime = new AbortController();
const previewMode = new URLSearchParams(location.search).has('preview');
if (previewMode) document.body.classList.add('preview');

function updateCounts(total: number): void {
  eatenCount.textContent = String(total).padStart(3, '0');
  remaining.textContent = String(Math.max(0, words.length - total));
  progress.style.width = `${words.length ? total / words.length * 100 : 0}%`;
}

function onMeal(meal: Meal, total: number): void {
  updateCounts(total);
  bites.querySelector('.empty-bites')?.remove();
  const chip = document.createElement('span');
  chip.className = 'bite';
  chip.textContent = meal.text.length > 44 ? `${meal.text.slice(0, 41)}…` : meal.text;
  chip.title = meal.text;
  chip.style.setProperty('--bite-color', meal.color);
  bites.prepend(chip);
  while (bites.childElementCount > 7) bites.lastElementChild?.remove();
}

function updatePause(): void {
  pauseButton.setAttribute('aria-pressed', String(!world.running));
  required('#pause-label').textContent = world.running ? '일시정지' : '계속 탐색';
  required('#pause-symbol').textContent = world.running ? 'Ⅱ' : '▷';
  document.body.classList.toggle('paused', !world.running);
}

function showPage(next: PageContent): void {
  page = next;
  viewport.scrollTop = 0;
  words = renderPage(next, article);
  world.setWords(words);
  updateCounts(0);
  bites.replaceChildren();
  const empty = document.createElement('span'); empty.className = 'empty-bites'; empty.textContent = '첫 번째 한 입을 기다리는 중…'; bites.append(empty);
  required('#source-address').textContent = next.source === 'demo' ? next.url : new URL(next.url).host + new URL(next.url).pathname;
  required('#source-kind').textContent = next.source === 'demo' ? 'SAMPLE' : 'LIVE PAGE';
  required('#document-label').textContent = next.source === 'demo' ? 'FIELD NOTES / NO. 001' : new URL(next.url).hostname.toUpperCase();
  required('#document-detail').textContent = next.source === 'demo' ? 'A PAGE FOR THE CURIOUS' : 'READER VIEW / 본문 재구성';
  const original = required<HTMLAnchorElement>('#original-link');
  original.hidden = next.source !== 'live';
  if (next.source === 'live') original.href = next.url; else original.removeAttribute('href');
  required('#page-limit').hidden = !next.truncated;
  const links = required('#links'); links.replaceChildren();
  for (const link of next.links.slice(0, 6)) {
    const button = document.createElement('button'); button.type = 'button';
    button.textContent = `${link.title} ↗`; button.title = link.url;
    button.addEventListener('click', () => { urlInput.value = link.url; void loadPage(link.url); });
    links.append(button);
  }
  required('#no-links').hidden = next.links.length > 0;
  updatePause();
}

function busy(value: boolean): void {
  crawlButton.disabled = value;
  pauseButton.disabled = value;
  resetButton.disabled = value;
  crawlButton.replaceChildren(document.createTextNode(value ? '읽는 중…' : '탐색 시작 ↗'));
  required('#scene-loader').hidden = !value;
  required('#scene').setAttribute('aria-busy', String(value));
}

async function loadPage(input: string): Promise<void> {
  if (!input.trim()) { errorMessage.textContent = '거미가 탐색할 웹사이트 주소를 입력해 주세요.'; errorMessage.hidden = false; urlInput.focus(); return; }
  if (!controller) resumeAfterLoad = world.running;
  controller?.abort();
  const request = new AbortController();
  controller = request;
  world.setRunning(false);
  errorMessage.hidden = true;
  loadStatus.textContent = '페이지의 본문과 링크를 읽고 있습니다…';
  loadStatus.hidden = false;
  busy(true);
  try {
    const response = await fetch(`/api/crawl?url=${encodeURIComponent(input.trim())}`, {
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(16_000)]),
      headers: { Accept: 'application/json' },
    });
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('본문을 가져오는 서버에 연결되지 않았습니다. 샘플 페이지를 사용하거나 개발 서버를 실행해 주세요.');
    const data: unknown = await response.json();
    if (!data || typeof data !== 'object') throw new Error('페이지 응답을 읽을 수 없습니다.');
    if ('error' in data && typeof data.error === 'string') throw new Error(data.error);
    if (!response.ok || !('html' in data) || typeof data.html !== 'string' || !('url' in data) || typeof data.url !== 'string') throw new Error('페이지를 가져오지 못했습니다. 다른 주소를 입력해 주세요.');
    const next = parsePage(data.html, data.url);
    if (controller !== request) return;
    showPage(next);
    loadStatus.textContent = `${words.length.toLocaleString()}개의 단어를 찾았습니다. 새로운 탐색을 시작합니다.`;
  } catch (error) {
    if (controller !== request || request.signal.aborted) return;
    errorMessage.textContent = error instanceof Error && error.name === 'TimeoutError'
      ? '페이지가 오래 응답하지 않습니다. 다른 주소나 샘플을 사용해 주세요.'
      : error instanceof Error ? error.message : '페이지를 불러오지 못했습니다.';
    errorMessage.hidden = false;
    loadStatus.hidden = true;
  } finally {
    if (controller === request && !lifetime.signal.aborted) {
      controller = null;
      busy(false);
      world.setRunning(resumeAfterLoad);
      updatePause();
    }
  }
}

try {
  world = new SpiderWorld(canvas, viewport, onMeal, state => {
    const labels = { hunting: 'ON THE HUNT', paused: 'TAKING A BREATH', complete: 'A VERY GOOD MEAL', waiting: 'EXPLORING · SCROLL FOR MORE' };
    required('#scene-state').textContent = labels[state];
    required('#scene').dataset.state = state;
    if (world) updatePause();
  });
  showPage(sample);
  if (previewMode) world.setCount(2);
  const signal = lifetime.signal;
  required<HTMLFormElement>('#url-form').addEventListener('submit', event => { event.preventDefault(); void loadPage(urlInput.value); }, { signal });
  required('#demo-button').addEventListener('click', () => {
    const resume = controller ? resumeAfterLoad : world.running;
    controller?.abort(); controller = null;
    busy(false); errorMessage.hidden = true; loadStatus.hidden = true;
    urlInput.value = '';
    showPage(sample); world.setRunning(resume); updatePause();
  }, { signal });
  document.querySelectorAll<HTMLButtonElement>('[data-url]').forEach(button => button.addEventListener('click', () => {
    urlInput.value = button.dataset.url!; void loadPage(urlInput.value);
  }, { signal }));
  pauseButton.addEventListener('click', () => { world.setRunning(!world.running); updatePause(); }, { signal });
  resetButton.addEventListener('click', () => { showPage(page); }, { signal });
  document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(button => button.addEventListener('click', () => {
    world.setMode(button.dataset.mode === 'sentence' ? 'sentence' : 'word');
    document.querySelectorAll('[data-mode]').forEach(item => { item.classList.toggle('selected', item === button); item.setAttribute('aria-pressed', String(item === button)); });
  }, { signal }));
  document.querySelectorAll<HTMLButtonElement>('[data-count]').forEach(button => button.addEventListener('click', () => {
    world.setCount(Number(button.dataset.count));
    document.querySelectorAll('[data-count]').forEach(item => { item.classList.toggle('selected', item === button); item.setAttribute('aria-pressed', String(item === button)); });
    required('#colony-label').textContent = button.dataset.count === '1' ? 'LONE EXPLORER' : 'A LITTLE COMPANY';
  }, { signal }));
  required<HTMLInputElement>('#speed').addEventListener('input', event => {
    const value = Number((event.target as HTMLInputElement).value);
    world.setSpeed(value); required<HTMLOutputElement>('#speed-value').value = `${value.toFixed(1)}×`;
  }, { signal });
  required<HTMLInputElement>('#silk').addEventListener('change', event => world.setSilk((event.target as HTMLInputElement).checked), { signal });
  window.addEventListener('keydown', event => {
    if (event.code !== 'Space' || event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement || event.target instanceof HTMLAnchorElement || controller) return;
    event.preventDefault(); world.setRunning(!world.running); updatePause();
  }, { signal });
  window.addEventListener('pagehide', () => {
    // Retire the request before its finally callback can restore playback.
    controller?.abort(); controller = null;
    busy(false); loadStatus.hidden = true;
    world.setRunning(false); updatePause();
  }, { signal });
  window.addEventListener('pageshow', event => { if (event.persisted) updatePause(); }, { signal });
  if (import.meta.hot) import.meta.hot.dispose(() => { lifetime.abort(); controller?.abort(); world.dispose(); });
  // Read-only diagnostics are local-development only, never in the public build.
  if (import.meta.env.DEV) Object.defineProperty(window, '__crawler', { configurable: true, get: () => ({ words: words.length, eaten: world.consumed, frames: world.frameCount, running: world.running, source: page.source }) });
} catch (error) {
  errorMessage.textContent = error instanceof Error ? error.message : '실험을 시작할 수 없습니다.';
  errorMessage.hidden = false;
  crawlButton.disabled = true; pauseButton.disabled = true; resetButton.disabled = true;
}
