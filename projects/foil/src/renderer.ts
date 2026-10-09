// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { canvas, context } from './artwork';
import { foilMask, foils, papers } from './state';
import type { CardState } from './state';

export class CardRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, .1, 100);
  private root = new THREE.Group();
  private book = new THREE.Group();
  private cover = new THREE.Group();
  private stock: THREE.MeshStandardMaterial;
  private ink: THREE.MeshStandardMaterial;
  private letter: THREE.MeshStandardMaterial;
  private back: THREE.MeshStandardMaterial;
  private foil: THREE.MeshPhysicalMaterial;
  private portrait: THREE.MeshPhysicalMaterial;
  private photoMount = new THREE.MeshStandardMaterial({ color: '#fffaf0', roughness: .92 });
  private portraitAspect: number;
  private foldMaterial = new THREE.MeshBasicMaterial({ color: 0x6d634f, transparent: true, opacity: .09 });
  private paperNoise: THREE.CanvasTexture;
  private environment: THREE.WebGLRenderTarget;
  private observer: ResizeObserver;
  private width = 2.7;
  private height = 3.6;
  private opened = false;
  private opening = 0;
  private frame = 0;
  private lastTime = 0;
  private disposed = false;
  private target = new THREE.Quaternion();
  private raycaster = new THREE.Raycaster();
  private pointer: { id: number; x: number; y: number; startX: number; startY: number; moved: boolean; time: number } | null = null;
  private gestures = new Set<number>();
  private abort = new AbortController();
  private shadow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)');

  constructor(private host: HTMLElement, private onToggle: (opened: boolean) => void, onError: (message: string) => void, weddingPhoto: HTMLImageElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setClearColor(0xffffff, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.host.append(this.renderer.domElement);
    const pmrem = new THREE.PMREMGenerator(this.renderer), room = new RoomEnvironment();
    this.environment = pmrem.fromScene(room, .025); this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = .3;
    room.dispose(); pmrem.dispose();
    this.scene.environmentRotation.set(.15, .45, .2);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xd5cbb4, .75));
    const key = new THREE.DirectionalLight(0xfff5df, 1.5); key.position.set(-3, 5, 6); this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xe4ebff, .3); fill.position.set(4, -1, 3); this.scene.add(fill);
    const noise = canvas(256, 256), nc = context(noise), pixels = nc.createImageData(256, 256);
    let seed = 173;
    for (let i = 0; i < pixels.data.length; i += 4) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const n = 150 + (seed >>> 24) * .4;
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = n; pixels.data[i + 3] = 255;
    }
    nc.putImageData(pixels, 0, 0);
    this.paperNoise = new THREE.CanvasTexture(noise); this.paperNoise.wrapS = this.paperNoise.wrapT = THREE.RepeatWrapping; this.paperNoise.repeat.set(4, 5);
    this.stock = new THREE.MeshStandardMaterial({ color: '#f7f5e9', roughness: .94, envMapIntensity: .35, bumpMap: this.paperNoise, bumpScale: .012 });
    this.ink = new THREE.MeshStandardMaterial({ roughness: .88, envMapIntensity: .3, bumpMap: this.paperNoise, bumpScale: .006 });
    this.letter = new THREE.MeshStandardMaterial({ roughness: .92, envMapIntensity: .25, bumpMap: this.paperNoise, bumpScale: .005 });
    this.back = new THREE.MeshStandardMaterial({ roughness: .94, bumpMap: this.paperNoise, bumpScale: .006 });
    const portraitTexture = new THREE.Texture(weddingPhoto);
    portraitTexture.colorSpace = THREE.SRGBColorSpace; portraitTexture.needsUpdate = true;
    portraitTexture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this.portraitAspect = weddingPhoto.naturalWidth / weddingPhoto.naturalHeight;
    // A smooth dielectric coating catches the studio lights like glossy photo paper.
    // Keep the photograph non-metallic and its underlying ink softly lit.
    this.portrait = new THREE.MeshPhysicalMaterial({
      map: portraitTexture, metalness: 0, roughness: .55,
      clearcoat: .65, clearcoatRoughness: .13,
      envMap: this.environment.texture, envMapIntensity: .3,
      bumpMap: this.paperNoise, bumpScale: .0004,
    });
    this.foil = new THREE.MeshPhysicalMaterial({ color: foils[0].colour, metalness: 1, roughness: .24, envMap: this.environment.texture,
      envMapIntensity: 1.8, clearcoat: .35, clearcoatRoughness: .2, bumpMap: this.paperNoise, bumpScale: .007,
      transparent: true, alphaTest: .035, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const shade = canvas(256, 256), sc = context(shade), gradient = sc.createRadialGradient(128, 128, 12, 128, 128, 128);
    gradient.addColorStop(0, '#3e392650'); gradient.addColorStop(.55, '#3e392620'); gradient.addColorStop(1, '#3e392600');
    sc.fillStyle = gradient; sc.fillRect(0, 0, 256, 256);
    const shadeTexture = new THREE.CanvasTexture(shade);
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadeTexture, transparent: true, depthWrite: false, opacity: .43 }));
    this.shadow.position.set(.06, -.2, -.35); this.scene.add(this.shadow);
    this.root.add(this.book); this.scene.add(this.root); this.reset();
    this.observer = new ResizeObserver(() => { this.cancel(); this.resize(); }); this.observer.observe(host);
    const options = { signal: this.abort.signal };
    host.addEventListener('pointerdown', this.down, options); host.addEventListener('pointermove', this.move, options);
    host.addEventListener('pointerup', this.up, options); host.addEventListener('pointercancel', this.cancel, options);
    host.addEventListener('lostpointercapture', this.cancel, options);
    host.addEventListener('keydown', this.key, options);
    window.addEventListener('blur', this.cancel, options);
    document.addEventListener('visibilitychange', this.visibility, options);
    this.renderer.domElement.addEventListener('webglcontextlost', event => {
      event.preventDefault(); this.cancel(); cancelAnimationFrame(this.frame); this.frame = 0; this.disposed = true;
      onError('The card preview lost its graphics connection. Reload to continue.');
    }, options);
    this.resize();
  }

  updateGloss(value: number): void {
    const strength = Math.max(0, Math.min(100, value)) / 100;
    this.portrait.clearcoat = strength;
    // Preserve the original finish at 65%; zero softens the base reflection too.
    this.portrait.roughness = .94 - .6 * strength;
    this.invalidate();
  }

  update(state: CardState, source: HTMLCanvasElement): void {
    this.updateGloss(state.gloss);
    const aspect = state.shape === 1 ? .75 : state.shape === 2 ? 1 : state.shape === 3 ? 1.35 : Math.max(.55, Math.min(1.6, source.width / source.height));
    this.height = aspect > 1 ? 2.9 : 3.6; this.width = this.height * aspect;
    const w = Math.round(850 * aspect), h = 850, art = canvas(w, h), c = context(art);
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
    const scale = Math.max(w / source.width, h / source.height);
    c.drawImage(source, (w - source.width * scale) / 2, (h - source.height * scale) / 2, source.width * scale, source.height * scale);
    const pixels = c.getImageData(0, 0, w, h), mask = canvas(w, h), mc = context(mask), maskPixels = mc.createImageData(w, h);
    maskPixels.data.set(foilMask(pixels.data, w, h, state)); mc.putImageData(maskPixels, 0, 0);
    const paper = new THREE.Color(papers[state.paper]!.colour);
    const rgb = papers[state.paper]!.colour.match(/\w\w/g)!.map(v => parseInt(v, 16));
    for (let i = 0; i < pixels.data.length; i += 4) {
      const white = Math.max(0, (Math.min(pixels.data[i]!, pixels.data[i + 1]!, pixels.data[i + 2]!) / 255 - .7) / .3);
      for (let channel = 0; channel < 3; channel++) pixels.data[i + channel] = pixels.data[i + channel]! * (1 - white) + rgb[channel]! * white;
    }
    c.putImageData(pixels, 0, 0);
    this.replaceMap(this.ink, 'map', art, true); this.replaceMap(this.foil, 'alphaMap', mask, false);
    this.stock.color.copy(paper); this.foil.color.set(foils[state.foil]!.colour);
    this.foil.iridescence = state.foil === 5 ? 1 : 0; this.foil.iridescenceIOR = 1.45; this.foil.iridescenceThicknessRange = [180, 420]; this.foil.needsUpdate = true;
    this.updateLetter(state);
    this.updateBack(state);
    // Only geometry is replaced here; shared material/texture ownership stays with the renderer.
    this.book.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose(); }); this.book.clear(); this.cover.clear();
    const backing = new THREE.Mesh(new THREE.BoxGeometry(this.width, this.height, .018), this.stock); backing.position.set(this.width / 2, 0, -.027); this.book.add(backing);
    const backPrint = new THREE.Mesh(new THREE.PlaneGeometry(this.width, this.height), this.back);
    backPrint.rotation.y = Math.PI; backPrint.position.set(this.width / 2, 0, -.037); this.book.add(backPrint);
    // Both hinge edges sweep within .027 + .009 = .036 of the spine axis.
    // A matching paper joint bridges them throughout opening and arbitrary view rotation.
    const spine = new THREE.Mesh(new THREE.CylinderGeometry(.038, .038, this.height, 24), this.stock);
    this.book.add(spine);
    const inside = new THREE.Mesh(new THREE.PlaneGeometry(this.width * .91, this.height * .92), this.letter); inside.position.set(this.width / 2, 0, -.015); this.book.add(inside);
    const fold = new THREE.Mesh(new THREE.PlaneGeometry(.025, this.height), this.foldMaterial);
    fold.position.set(.015, 0, -.014); this.book.add(fold);
    const board = new THREE.Mesh(new THREE.BoxGeometry(this.width, this.height, .018), this.stock); board.position.set(this.width / 2, 0, 0); this.cover.add(board);
    // Mount on the cover's inward face: the hinge carries the photo as the card opens.
    // Contain the full portrait at every card ratio instead of cropping either person's face.
    const photoHeight = Math.min(this.height * .77, this.width * .78 / this.portraitAspect);
    const photoWidth = photoHeight * this.portraitAspect;
    const mount = new THREE.Mesh(new THREE.PlaneGeometry(photoWidth + .12, photoHeight + .14), this.photoMount);
    mount.rotation.y = Math.PI; mount.position.set(this.width / 2, 0, -.010); this.cover.add(mount);
    const portrait = new THREE.Mesh(new THREE.PlaneGeometry(photoWidth, photoHeight), this.portrait);
    portrait.rotation.y = Math.PI; portrait.position.set(this.width / 2, 0, -.012); this.cover.add(portrait);
    const front = new THREE.Mesh(new THREE.PlaneGeometry(this.width, this.height), this.ink); front.position.set(this.width / 2, 0, .010); this.cover.add(front);
    const foil = new THREE.Mesh(new THREE.PlaneGeometry(this.width, this.height), this.foil); foil.position.set(this.width / 2, 0, .011); this.cover.add(foil);
    this.cover.position.z = .027; this.book.add(this.cover); this.resize(); this.invalidate();
  }

  private updateBack(state: CardState): void {
    const surface = canvas(Math.round(1000 * this.width / this.height), 1000), c = context(surface);
    c.fillStyle = papers[state.paper]!.colour; c.fillRect(0, 0, surface.width, surface.height);
    const tint = state.paper === 5 ? '#c5b895' : '#8b896e';
    c.save(); c.translate(surface.width / 2, 420); c.strokeStyle = tint; c.fillStyle = tint;
    c.lineWidth = 1.6;
    for (const side of [-1, 1]) {
      c.save(); c.scale(side, 1);
      c.beginPath(); c.moveTo(0, 52); c.bezierCurveTo(40, 18, 51, -22, 42, -69); c.stroke();
      for (let i = 0; i < 5; i++) {
        const y = 27 - i * 19, x = 21 + i * 5;
        c.save(); c.translate(x, y); c.rotate(i % 2 ? -.55 : .7);
        c.beginPath(); c.ellipse(0, -11, 4.5, 14, 0, 0, Math.PI * 2); c.globalAlpha = .65; c.fill(); c.restore();
      }
      c.restore();
    }
    c.beginPath(); c.arc(0, -13, 12, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(10, -13, 12, 0, Math.PI * 2); c.stroke();
    c.restore(); c.textAlign = 'center'; c.fillStyle = tint;
    c.font = 'italic 29px Georgia, serif'; c.fillText('With love, always.', surface.width / 2, 534);
    c.globalAlpha = .65; c.font = '13px Georgia, serif';
    c.fillText('A  L I T T L E  W O N D E R', surface.width / 2, 574);
    c.font = '11px Georgia, serif'; c.fillText('AIB Inc. · www.aib.vote', surface.width / 2, 922);
    this.replaceMap(this.back, 'map', surface, true);
  }

  updateLetter(state: CardState): void {
    const surface = canvas(Math.round(1000 * this.width / this.height), 1000), c = context(surface);
    c.fillStyle = papers[state.paper]!.colour; c.fillRect(0, 0, surface.width, surface.height);
    c.fillStyle = state.paper === 5 ? '#e8e2cd' : '#5a604c';
    const fontSize = state.letter.length > 350 ? 27 : state.letter.length > 180 ? 32 : 39;
    c.font = `italic ${fontSize}px Georgia, serif`; c.textAlign = 'center';
    const maxWidth = surface.width * .8, lines: string[] = [];
    // Grapheme iteration also wraps CJK and a single long word without drawing beyond the paper.
    for (const paragraph of state.letter.split('\n')) {
      let line = '';
      for (const { segment } of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(paragraph)) {
        if (c.measureText(line + segment).width > maxWidth && line) { lines.push(line); line = ''; }
        line += segment;
      }
      lines.push(line);
    }
    const lineHeight = Math.min(fontSize * 1.6, 730 / Math.max(lines.length, 1));
    c.font = `italic ${Math.min(fontSize, lineHeight / 1.45)}px Georgia, serif`;
    const start = Math.max(115, (1000 - lines.length * lineHeight) / 2);
    lines.forEach((line, index) => c.fillText(line, surface.width / 2, start + index * lineHeight));
    if (state.sender) { c.font = 'italic 26px Georgia'; c.fillText(`With love, ${state.sender}`, surface.width / 2, 922, maxWidth); }
    this.replaceMap(this.letter, 'map', surface, true); this.invalidate();
  }

  private replaceMap(material: THREE.MeshStandardMaterial, key: 'map' | 'alphaMap', surface: HTMLCanvasElement, colour: boolean): void {
    material[key]?.dispose(); const texture = new THREE.CanvasTexture(surface);
    texture.colorSpace = colour ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy(); material[key] = texture; material.needsUpdate = true;
  }
  setOpen(opened: boolean): void { this.opened = opened; this.onToggle(opened); this.invalidate(); }
  reset(): void { this.target.setFromEuler(new THREE.Euler(.035, -.12, -.022)); this.invalidate(); }
  private resize(): void {
    const { width, height } = this.host.getBoundingClientRect(); if (!width || !height || this.disposed) return;
    this.renderer.setSize(width, height); this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix(); this.invalidate();
  }
  private invalidate = (): void => { if (!this.frame && !document.hidden && !this.disposed) this.frame = requestAnimationFrame(this.draw); };
  private draw = (time: number): void => {
    this.frame = 0; if (document.hidden || this.disposed) return;
    const dt = Math.min(.05, (time - (this.lastTime || time - 16)) / 1000); this.lastTime = time;
    const factor = this.reduced.matches ? 1 : 1 - Math.exp(-dt * 10);
    this.opening += ((this.opened ? 1 : 0) - this.opening) * factor;
    this.root.quaternion.slerp(this.target, factor);
    this.cover.rotation.y = -this.opening * Math.PI * .955;
    this.book.position.x = -this.width / 2 * (1 - this.opening);
    const visibleWidth = this.width * (1 + this.opening * .95);
    const distance = Math.max(this.height * 1.23, visibleWidth / this.camera.aspect * 1.23) / (2 * Math.tan(THREE.MathUtils.degToRad(16)));
    this.camera.position.set(0, 0, distance); this.camera.lookAt(0, 0, 0);
    // Keep the shadow outside the full swept volume of both rotating panels.
    // A nearby z=-.35 plane intersects tilted paper and creates a hard depth-test seam.
    const shadowDepth = Math.hypot(this.width * 1.5, this.height / 2, .06) + .1;
    const shadowProjection = (distance + shadowDepth) / (distance + .35);
    this.shadow.position.set(.06 * shadowProjection, -.2 * shadowProjection, -shadowDepth);
    this.shadow.scale.set(visibleWidth * 1.65 * shadowProjection, this.height * 1.5 * shadowProjection, 1);
    this.renderer.render(this.scene, this.camera);
    if (Math.abs(this.opening - Number(this.opened)) > .0001 || this.root.quaternion.angleTo(this.target) > .0001) this.invalidate();
  };
  private hit(event: PointerEvent): boolean {
    const rect = this.host.getBoundingClientRect();
    this.raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2), this.camera);
    return this.raycaster.intersectObject(this.book, true).length > 0;
  }
  private down = (event: PointerEvent): void => {
    this.gestures.add(event.pointerId);
    if (this.gestures.size > 1) { this.pointer = null; return; }
    if (event.button !== 0 || !this.hit(event)) return;
    this.target.copy(this.root.quaternion);
    this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false, time: performance.now() };
    this.host.setPointerCapture(event.pointerId);
  };
  private move = (event: PointerEvent): void => {
    const p = this.pointer; if (!p || p.id !== event.pointerId) return;
    const totalX = event.clientX - p.startX, totalY = event.clientY - p.startY;
    if (!p.moved) {
      if (Math.hypot(totalX, totalY) < 6) return;
      if (event.pointerType === 'touch' && Math.abs(totalY) > Math.abs(totalX)) { this.pointer = null; return; }
      p.moved = true;
    }
    const dx = event.clientX - p.x, dy = event.clientY - p.y, distance = Math.hypot(dx, dy);
    if (distance) {
      const axis = new THREE.Vector3(dy, dx, 0).normalize();
      this.target.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, distance * .006)).normalize(); this.invalidate();
    }
    p.x = event.clientX; p.y = event.clientY;
  };
  private up = (event: PointerEvent): void => {
    const p = this.pointer; this.gestures.delete(event.pointerId);
    if (p?.id === event.pointerId) {
      if (!p.moved && performance.now() - p.time < 500 && Math.hypot(event.clientX - p.startX, event.clientY - p.startY) < 6) this.setOpen(!this.opened);
      this.pointer = null;
    }
    if (this.host.hasPointerCapture(event.pointerId)) this.host.releasePointerCapture(event.pointerId);
  };
  private cancel = (): void => { const id = this.pointer?.id; this.pointer = null; this.gestures.clear(); if (id !== undefined && this.host.hasPointerCapture(id)) this.host.releasePointerCapture(id); };
  private key = (event: KeyboardEvent): void => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); this.setOpen(!this.opened); }
    else if (event.key.toLowerCase() === 'r') this.reset();
    else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault(); const horizontal = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
      const sign = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
      this.target.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(horizontal ? 0 : 1, horizontal ? 1 : 0, 0), .15 * sign)).normalize(); this.invalidate();
    }
  };
  private visibility = (): void => { this.cancel(); if (document.hidden) { cancelAnimationFrame(this.frame); this.frame = 0; } else { this.lastTime = 0; this.invalidate(); } };
  async snapshot(): Promise<Blob> {
    this.renderer.render(this.scene, this.camera);
    const result = canvas(this.renderer.domElement.width, this.renderer.domElement.height), c = context(result);
    c.fillStyle = '#f8f7f4'; c.fillRect(0, 0, result.width, result.height); c.drawImage(this.renderer.domElement, 0, 0);
    return new Promise((resolve, reject) => result.toBlob(blob => blob ? resolve(blob) : reject(new Error('The picture could not be saved.')), 'image/png'));
  }
  dispose(): void {
    this.disposed = true; this.abort.abort(); this.observer.disconnect(); cancelAnimationFrame(this.frame); this.cancel();
    this.scene.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose(); });
    for (const material of [this.stock, this.ink, this.letter, this.back, this.foil, this.portrait, this.photoMount]) { material.map?.dispose(); material.alphaMap?.dispose(); material.dispose(); }
    this.shadow.material.map?.dispose(); this.shadow.material.dispose(); this.foldMaterial.dispose(); this.paperNoise.dispose(); this.environment.dispose(); this.renderer.dispose(); this.renderer.domElement.remove();
  }
}
