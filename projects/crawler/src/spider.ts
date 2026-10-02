// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import { measureWords } from './reader';
import type { Meal, Point, Word } from './types';

interface Leg { foot: Point; from: Point; to: Point; progress: number; side: number; row: number; }
interface Crawler {
  id: number; x: number; y: number; angle: number; color: string;
  legs: Leg[]; target: Word | null; wait: number; pulse: number;
}
interface Fragment { word: Word; x: number; y: number; angle: number; age: number; delay: number; spider: Crawler; }
interface Silk { x: number; y: number; nextX: number; nextY: number; age: number; color: string; }
const COLORS = ['#c9f38a', '#f48bce', '#79dded'];
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const turn = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

export class SpiderWorld {
  private ctx: CanvasRenderingContext2D;
  private words: Word[] = [];
  private spiders: Crawler[] = [];
  private fragments: Fragment[] = [];
  private silk: Silk[] = [];
  private raf = 0;
  private last = 0;
  private width = 0;
  private height = 0;
  private scale = 1;
  private scroll = 0;
  private dirty = true;
  private wanted = true;
  private visible = true;
  private complete = false;
  private ticks = 0;
  private eaten = 0;
  private count = 1;
  private mode: 'word' | 'sentence' = 'word';
  private speed = 1;
  private showSilk = true;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)');
  private resize: ResizeObserver;
  private intersection: IntersectionObserver;
  private listeners = new AbortController();

  constructor(private canvas: HTMLCanvasElement, private viewport: HTMLElement,
    private onMeal: (meal: Meal, total: number) => void,
    private onState: (state: 'hunting' | 'paused' | 'complete' | 'waiting') => void) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('이 브라우저에서 Canvas를 사용할 수 없습니다.');
    this.ctx = ctx;
    this.wanted = !this.reduced.matches;
    const signal = this.listeners.signal;
    this.resize = new ResizeObserver(() => { this.dirty = true; this.invalidate(); });
    this.resize.observe(viewport);
    this.resize.observe(viewport.firstElementChild!);
    this.intersection = new IntersectionObserver(entries => {
      this.visible = entries[0]?.isIntersecting ?? true;
      this.syncLoop();
    });
    this.intersection.observe(canvas);
    viewport.addEventListener('scroll', () => { this.scroll = viewport.scrollTop; this.invalidate(); }, { passive: true, signal });
    viewport.addEventListener('click', event => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-word]') : null;
      if (target) this.offer(Number(target.dataset.word));
    }, { signal });
    document.addEventListener('visibilitychange', () => this.syncLoop(), { signal });
    window.addEventListener('resize', () => { this.dirty = true; this.invalidate(); }, { signal });
    this.reduced.addEventListener('change', () => { if (this.reduced.matches) this.setRunning(false); }, { signal });
    void document.fonts.ready.then(() => { if (!signal.aborted) { this.dirty = true; this.invalidate(); } });
  }

  get running(): boolean { return this.wanted; }
  get consumed(): number { return this.eaten; }
  get frameCount(): number { return this.ticks; }

  setWords(words: Word[]): void {
    this.words = words;
    this.fragments = [];
    this.silk = [];
    this.spiders = [];
    this.eaten = 0;
    this.complete = false;
    this.scroll = this.viewport.scrollTop;
    this.dirty = true;
    this.measure();
    this.spawn();
    this.reportState();
    this.syncLoop();
  }

  setRunning(value: boolean): void { this.wanted = value; this.reportState(); this.syncLoop(); }
  setSpeed(value: number): void { this.speed = clamp(value, 0.4, 2.4); }
  setMode(value: 'word' | 'sentence'): void { this.mode = value; }
  setSilk(value: boolean): void { this.showSilk = value; if (!value) this.silk = []; this.invalidate(); }
  setCount(value: number): void {
    this.count = clamp(Math.round(value), 1, 3);
    for (const spider of this.spiders) this.release(spider);
    // In-flight words remain eaten; finish their particles before retiring a body.
    this.fragments = [];
    this.spiders = [];
    this.spawn();
    this.invalidate();
  }

  private spawn(): void {
    for (let i = this.spiders.length; i < this.count; i++) {
      const spider: Crawler = {
        id: i, x: this.width * (0.48 + i * 0.14), y: this.scroll + Math.min(this.height * 0.46 + i * 55, this.height - 75),
        angle: -0.6 + i * 1.8, color: COLORS[i]!, legs: [], target: null, wait: i * 0.35 + 0.35, pulse: 0,
      };
      for (const side of [-1, 1]) for (let row = 0; row < 4; row++) {
        const rest = this.footPosition(spider, side, row);
        spider.legs.push({ foot: { ...rest }, from: { ...rest }, to: { ...rest }, progress: 1, side, row });
      }
      this.spiders.push(spider);
    }
  }

  private local(spider: Crawler, forward: number, side: number): Point {
    const c = Math.cos(spider.angle), s = Math.sin(spider.angle);
    return { x: spider.x + (c * forward - s * side) * this.scale, y: spider.y + (s * forward + c * side) * this.scale };
  }

  private footPosition(spider: Crawler, side: number, row: number): Point {
    return this.local(spider, [50, 22, -22, -48][row]!, side * [40, 64, 62, 39][row]!);
  }

  private measure(): void {
    this.dirty = false;
    this.width = this.viewport.clientWidth;
    this.height = this.viewport.clientHeight;
    this.scale = clamp(this.width / 750, 0.85, 1.6);
    this.scroll = this.viewport.scrollTop;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const width = Math.round(this.width * dpr), height = Math.round(this.height * dpr);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width; this.canvas.height = height;
      this.canvas.style.width = `${this.width}px`; this.canvas.style.height = `${this.height}px`;
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    measureWords(this.words, this.viewport);
    for (const spider of this.spiders) { this.release(spider); spider.x = clamp(spider.x, 65, this.width - 65); }
  }

  private release(spider: Crawler): void {
    if (spider.target && !spider.target.eaten) {
      spider.target.reserved = false;
      spider.target.element.classList.remove('targeted');
    }
    spider.target = null;
  }

  private aim(spider: Crawler, word: Word): void {
    this.release(spider);
    spider.target = word;
    word.reserved = true;
    word.element.classList.add('targeted');
    word.element.style.setProperty('--prey-color', spider.color);
  }

  offer(id: number): void {
    const word = this.words[id];
    if (!word || word.eaten || word.reserved || !this.spiders.length) return;
    const spider = this.spiders.reduce((best, current) => distance(current, word) < distance(best, word) ? current : best);
    this.aim(spider, word);
    spider.wait = 0;
    this.invalidate();
  }

  private choose(spider: Crawler): void {
    let best: Word | null = null, score = Infinity;
    for (const word of this.words) {
      if (word.eaten || word.reserved || word.y < this.scroll + 42 || word.y > this.scroll + this.height - 35 || word.x < 20 || word.x > this.width - 20) continue;
      const dist = distance(word, spider);
      const angle = Math.abs(turn(spider.angle, Math.atan2(word.y - spider.y, word.x - spider.x)));
      const candidate = dist + angle * 23 + (word.id * 17 % 41) - Math.min(word.text.length, 10) * 2;
      if (candidate < score) { score = candidate; best = word; }
    }
    if (best) this.aim(spider, best);
  }

  private eat(spider: Crawler): void {
    const target = spider.target;
    if (!target || target.eaten) { this.release(spider); return; }
    const meal = this.mode === 'sentence'
      ? this.words.filter(word => word.sentence === target.sentence && !word.eaten && (!word.reserved || word === target))
      : [target];
    // The DOM keeps its exact dimensions. A canvas copy travels to the mouth,
    // so eating never causes the remaining words or planted feet to jump.
    meal.forEach((word, index) => {
      word.eaten = true;
      word.reserved = false;
      word.element.classList.remove('targeted');
      word.element.classList.add('eaten');
      this.fragments.push({ word, x: word.x, y: word.y, angle: (word.id % 7 - 3) * 0.12, age: 0, delay: Math.min(index * 0.045, 0.8), spider });
    });
    this.eaten += meal.length;
    spider.target = null;
    spider.wait = this.mode === 'sentence' ? 1.7 : 0.72;
    spider.pulse = 1;
    this.onMeal({ words: meal, text: meal.map(word => word.text).join(' '), color: spider.color }, this.eaten);
  }

  private update(dt: number): void {
    const elapsed = dt * this.speed;
    for (const spider of this.spiders) {
      spider.pulse = Math.max(0, spider.pulse - elapsed * 1.8);
      spider.wait -= elapsed;
      if (spider.target && (spider.target.eaten || spider.target.y < this.scroll || spider.target.y > this.scroll + this.height)) this.release(spider);
      if (!spider.target && spider.wait <= 0) { this.choose(spider); if (!spider.target) spider.wait = 0.4; }
      let destination: Point | null = spider.target;
      // Scrolling carries the hunt into the newly visible habitat.
      if (spider.y < this.scroll + 55 || spider.y > this.scroll + this.height - 55) {
        destination = { x: clamp(spider.x, 65, this.width - 65), y: clamp(spider.y, this.scroll + 90, this.scroll + this.height - 90) };
        if (Math.abs(spider.y - destination.y) > this.height) {
          const shift = destination.y - spider.y;
          spider.y += shift;
          for (const leg of spider.legs) { leg.foot.y += shift; leg.from.y += shift; leg.to.y += shift; }
        }
      }
      if (destination) {
        const dist = distance(spider, destination);
        const direction = Math.atan2(destination.y - spider.y, destination.x - spider.x);
        spider.angle += turn(spider.angle, direction) * Math.min(1, elapsed * 5);
        if (dist > 21 * this.scale) {
          const step = Math.min(dist - 19 * this.scale, elapsed * 63);
          const previousX = spider.x, previousY = spider.y;
          spider.x += Math.cos(direction) * step;
          spider.y += Math.sin(direction) * step;
          if (this.showSilk && this.ticks % 5 === 0) {
            const tail = this.local(spider, -24, 0);
            this.silk.push({ x: tail.x - (spider.x - previousX) * 5, y: tail.y - (spider.y - previousY) * 5, nextX: tail.x, nextY: tail.y, age: 0, color: spider.color });
          }
        } else if (destination === spider.target && spider.wait <= 0) this.eat(spider);
      }
      let moving = spider.legs.filter(leg => leg.progress < 1).length;
      for (const leg of spider.legs) {
        const rest = this.footPosition(spider, leg.side, leg.row);
        if (leg.progress >= 1 && distance(leg.foot, rest) > 19 * this.scale && moving < 4) {
          leg.from = { ...leg.foot };
          const ahead = this.local(spider, 9, 0);
          leg.to = { x: rest.x + ahead.x - spider.x, y: rest.y + ahead.y - spider.y };
          leg.progress = 0;
          moving++;
        }
        if (leg.progress < 1) {
          leg.progress = Math.min(1, leg.progress + elapsed * (4.8 + leg.row * 0.24));
          const t = leg.progress, eased = t * t * (3 - 2 * t);
          leg.foot.x = leg.from.x + (leg.to.x - leg.from.x) * eased;
          leg.foot.y = leg.from.y + (leg.to.y - leg.from.y) * eased - Math.sin(t * Math.PI) * 7;
        }
      }
    }
    for (const fragment of this.fragments) fragment.age += elapsed;
    this.fragments = this.fragments.filter(fragment => fragment.age < 1.05 + fragment.delay);
    for (const thread of this.silk) thread.age += elapsed;
    this.silk = this.silk.filter(thread => thread.age < 16).slice(-600);
    if (this.eaten === this.words.length && this.words.length > 0 && this.fragments.length === 0) {
      this.complete = true;
      this.reportState();
    } else if (this.ticks % 30 === 0) this.reportState();
  }

  private stroke(points: Point[], color: string, width = 1): void {
    const ctx = this.ctx;
    ctx.beginPath();
    points.forEach((point, index) => index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y));
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  }

  private drawSpider(spider: Crawler): void {
    const ctx = this.ctx;
    // Two-segment inverse kinematics; the feet remain planted during stance.
    for (const leg of spider.legs) {
      const hip = this.local(spider, 12 - leg.row * 7, leg.side * 6);
      const dx = leg.foot.x - hip.x, dy = leg.foot.y - hip.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      const length = Math.max(46 * this.scale, d * 0.58);
      const offset = Math.sqrt(Math.max(0, length * length - d * d / 4));
      const knee = { x: (hip.x + leg.foot.x) / 2 - dy / d * offset * leg.side, y: (hip.y + leg.foot.y) / 2 + dx / d * offset * leg.side };
      this.stroke([hip, knee, leg.foot], '#060906', 4);
      this.stroke([hip, knee], spider.color, 1.25);
      this.stroke([knee, leg.foot], leg.row % 2 ? '#92bfde' : '#c78abc', 1.1);
      ctx.fillStyle = spider.color;
      ctx.beginPath(); ctx.arc(knee.x, knee.y, 2.1, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = leg.progress < 1 ? '#f9fce8' : '#90baa2';
      ctx.beginPath(); ctx.arc(leg.foot.x, leg.foot.y, 1.8, 0, Math.PI * 2); ctx.fill();
      if (leg.progress < 0.13) { ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc(leg.foot.x, leg.foot.y, 5, 0, Math.PI * 2); ctx.strokeStyle = spider.color; ctx.stroke(); ctx.globalAlpha = 1; }
    }
    const shell = [this.local(spider, 18, 0), this.local(spider, 8, -9), this.local(spider, -15, -11), this.local(spider, -27, 0), this.local(spider, -15, 11), this.local(spider, 8, 9), this.local(spider, 18, 0)];
    ctx.fillStyle = '#0a120fea'; ctx.beginPath(); shell.forEach((point, i) => i ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); ctx.fill();
    ctx.shadowColor = spider.color; ctx.shadowBlur = 5 + spider.pulse * 14;
    this.stroke(shell, spider.color, 1.4);
    this.stroke([shell[1]!, this.local(spider, -8, 0), shell[4]!], '#85bfc9', 1);
    this.stroke([shell[2]!, this.local(spider, -8, 0), shell[5]!], '#b78cb7', 1);
    this.stroke([shell[0]!, shell[3]!], '#c9f38a88', 0.8);
    for (const side of [-1, 1]) {
      const eye = this.local(spider, 12, side * 3.3);
      ctx.fillStyle = '#efffdc'; ctx.beginPath(); ctx.arc(eye.x, eye.y, 1.65, 0, Math.PI * 2); ctx.fill();
      const mouth = this.local(spider, 20 + spider.pulse * 5, side * (3 + spider.pulse * 4));
      this.stroke([this.local(spider, 16, side * 5), mouth, this.local(spider, 24, side * 1)], spider.color, 1);
    }
    ctx.shadowBlur = 0;
    ctx.font = '9px Menlo, monospace'; ctx.fillStyle = spider.color; ctx.globalAlpha = 0.75;
    ctx.fillText(`CRAWLER_${String(spider.id + 1).padStart(2, '0')}`, spider.x - 26, spider.y - 83 * this.scale);
    ctx.globalAlpha = 1;
  }

  private draw(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.save();
    ctx.translate(0, -this.scroll);
    for (const thread of this.silk) {
      ctx.globalAlpha = Math.max(0, 1 - thread.age / 16) * 0.23;
      this.stroke([{ x: thread.x, y: thread.y }, { x: thread.nextX, y: thread.nextY }], thread.color, 0.7);
    }
    ctx.globalAlpha = 1;
    for (const spider of this.spiders) {
      if (spider.target) {
        const target = spider.target;
        ctx.globalAlpha = 0.28;
        ctx.setLineDash([2, 6]); this.stroke([spider, target], spider.color, 0.8); ctx.setLineDash([]);
        ctx.globalAlpha = 0.65;
        const x = target.x - target.width / 2 - 4, y = target.y - target.height / 2 - 3, w = target.width + 8, h = target.height + 6;
        for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
          this.stroke([{ x: cx! + sx! * 5, y: cy! }, { x: cx!, y: cy! }, { x: cx!, y: cy! + sy! * 5 }], spider.color, 1);
        }
        ctx.globalAlpha = 1;
      }
    }
    for (const fragment of this.fragments) {
      const t = clamp((fragment.age - fragment.delay) / 1.05, 0, 1);
      const eased = t * t * t;
      const mouth = this.local(fragment.spider, 22, 0);
      const x = fragment.x + (mouth.x - fragment.x) * eased;
      const y = fragment.y + (mouth.y - fragment.y) * eased - Math.sin(t * Math.PI) * 28;
      ctx.save(); ctx.translate(x, y); ctx.rotate(fragment.angle * Math.sin(t * Math.PI) * 2);
      const scale = 1 + Math.sin(t * Math.PI) * 0.12 - eased * 0.9;
      ctx.scale(scale, scale); ctx.globalAlpha = 1 - t ** 4;
      ctx.fillStyle = fragment.spider.color;
      ctx.fillRect(-fragment.word.width / 2 - 2, -fragment.word.height / 2, fragment.word.width + 4, fragment.word.height);
      ctx.font = fragment.word.font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#10150e';
      ctx.fillText(fragment.word.text, 0, 0); ctx.restore();
    }
    for (const spider of this.spiders) this.drawSpider(spider);
    ctx.restore();
  }

  private reportState(): void {
    this.onState(this.complete ? 'complete' : !this.wanted ? 'paused' : this.spiders.some(spider => spider.target) || this.fragments.length ? 'hunting' : 'waiting');
  }

  private canAnimate(): boolean { return this.wanted && !this.complete && this.visible && !document.hidden; }

  private frame = (now: number): void => {
    this.raf = 0;
    if (this.dirty) this.measure();
    const dt = this.last ? Math.min((now - this.last) / 1000, 0.04) : 0;
    this.last = now;
    if (this.canAnimate()) { this.ticks++; this.update(dt); }
    this.draw();
    if (this.canAnimate()) this.raf = requestAnimationFrame(this.frame);
  };

  private invalidate(): void { if (!this.raf && this.visible && !document.hidden) this.raf = requestAnimationFrame(this.frame); }
  private syncLoop(): void { cancelAnimationFrame(this.raf); this.raf = 0; this.last = 0; this.invalidate(); }

  dispose(): void {
    cancelAnimationFrame(this.raf); this.raf = 0;
    this.listeners.abort(); this.resize.disconnect(); this.intersection.disconnect();
    this.fragments = []; this.silk = []; this.spiders = []; this.words = [];
  }
}
