// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import './style.css';
import { canvas, context, importImage, loadImage, sampleArtwork, shareImage } from './artwork';
import { CardRenderer } from './renderer';
import { decodeCard, defaultState, encodeCard, foils, modes, papers, shapes } from './state';
import type { CardState } from './state';
import { weddingTemplates } from './templates';

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id); if (!found) throw new Error(`Missing interface element: ${id}`); return found as T;
}
const status = element('status');
function message(text: string, error = false): void { status.textContent = text; status.classList.toggle('error', error); }
function errorMessage(error: unknown): void { message(error instanceof Error ? error.message : 'Something went wrong. Please try again.', true); }
let state = defaultState();
let source = sampleArtwork(0);
let renderer: CardRenderer | null = null;
let opened = false, generation = 0, updateTimer = 0;
let shared = false;
const letter = element<HTMLTextAreaElement>('letter'), sender = element<HTMLInputElement>('sender');
const amount = element<HTMLInputElement>('amount'), border = element<HTMLInputElement>('border');
const gloss = element<HTMLInputElement>('gloss');
const stage = element('stage'), file = element<HTMLInputElement>('file');
const shareButton = element<HTMLButtonElement>('share'), saveButton = element<HTMLButtonElement>('save');
const dialog = element<HTMLDialogElement>('share-dialog');
const descriptions = ['The fine lines and dark details catch the light.', 'The darker parts of your picture turn to foil.', 'One colour becomes something a little more precious.'];

function changed(): void {
  if (shared) message('Your card has changed. Make a fresh link to share.');
  window.clearTimeout(updateTimer);
  updateTimer = window.setTimeout(() => { try { renderer?.update(state, source); } catch (error) { errorMessage(error); } }, 65);
}
function choices<T extends 'shape' | 'mode'>(id: string, key: T, values: readonly string[]): void {
  const container = element(id);
  values.forEach((value, index) => {
    const button = document.createElement('button'); button.textContent = value; button.dataset.value = String(index);
    button.addEventListener('click', () => { state[key] = index; sync(); changed(); }); container.append(button);
  });
}
function swatches(id: string, key: 'foil' | 'paper', values: readonly { name: string; colour: string; gradient?: string }[]): void {
  const container = element(id);
  values.forEach((value, index) => {
    const button = document.createElement('button'); button.className = 'swatch'; button.dataset.value = String(index);
    button.style.setProperty('--swatch', value.gradient ?? value.colour); button.title = value.name; button.setAttribute('aria-label', value.name);
    button.addEventListener('click', () => { state[key] = index; sync(); changed(); }); container.append(button);
  });
}
function sync(): void {
  for (const button of element('wedding-templates').querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.template === state.template));
  for (const [id, key] of [['shape-options', 'shape'], ['mode-options', 'mode'], ['foil-options', 'foil'], ['paper-options', 'paper']] as const) {
    for (const button of element(id).querySelectorAll('button')) button.setAttribute('aria-pressed', String(Number(button.dataset.value) === state[key]));
  }
  element('foil-name').textContent = foils[state.foil]!.name; element('paper-name').textContent = papers[state.paper]!.name;
  element('mode-description').textContent = descriptions[state.mode]!;
  element('colour-picker').hidden = state.mode !== 2;
  amount.value = String(state.amount); element('amount-value').textContent = `${state.amount}%`; border.checked = state.border;
  gloss.value = String(state.gloss); element('gloss-value').textContent = `${state.gloss}%`;
  element<HTMLInputElement>('target-colour').value = state.target;
  // Avoid replacing focused text values; input events own the latest user text.
  if (letter.value !== state.letter) letter.value = state.letter;
  if (sender.value !== state.sender) sender.value = state.sender;
  element('letter-count').textContent = `${state.letter.length} / 600`;
}
function thumbnail(): void { element<HTMLImageElement>('thumbnail').src = source.toDataURL('image/jpeg', .8); }

async function acceptPicture(picture: File): Promise<void> {
  const request = ++generation; element('wedding-templates').setAttribute('aria-busy', 'false'); message('Preparing your picture…');
  try {
    const next = await importImage(picture); if (request !== generation) return;
    // Commit only the new image; edits made while decoding remain in the latest state.
    const linkImage = shareImage(next); source = next; state.image = linkImage; delete state.template; sync();
    thumbnail(); changed(); message('Your picture is ready. Turn it toward the light.');
  } catch (error) { if (request === generation) errorMessage(error); }
  finally { file.value = ''; }
}

choices('shape-options', 'shape', shapes); choices('mode-options', 'mode', modes);
swatches('foil-options', 'foil', foils); swatches('paper-options', 'paper', papers);
function templateUrl(fileName: string): string { return `${import.meta.env.BASE_URL}templates/${fileName}`; }
async function templateArtwork(fileName: string): Promise<HTMLCanvasElement> {
  const image = await loadImage(templateUrl(fileName));
  const surface = canvas(image.naturalWidth, image.naturalHeight); context(surface).drawImage(image, 0, 0); return surface;
}
for (const template of weddingTemplates) {
  const button = document.createElement('button'); button.className = 'template-card'; button.dataset.template = template.id;
  button.setAttribute('aria-label', `Use ${template.name} wedding template`);
  const preview = document.createElement('img'); preview.src = templateUrl(template.file); preview.alt = ''; preview.loading = 'lazy';
  const name = document.createElement('span'); name.textContent = template.name;
  button.title = template.detail; button.append(preview, name); element('wedding-templates').append(button);
  button.addEventListener('click', async () => {
    const request = ++generation;
    const before = { foil: state.foil, paper: state.paper, amount: state.amount, shape: state.shape, mode: state.mode, border: state.border };
    element('wedding-templates').setAttribute('aria-busy', 'true'); message(`Preparing ${template.name}…`);
    try {
      const next = await templateArtwork(template.file); if (request !== generation) return;
      source = next; state.image = null; state.template = template.id;
      // Preserve any settings/letter edits made while the image was loading.
      if (state.foil === before.foil) state.foil = template.foil;
      if (state.paper === before.paper) state.paper = template.paper;
      if (state.amount === before.amount) state.amount = template.amount;
      if (state.shape === before.shape) state.shape = 0;
      if (state.mode === before.mode) state.mode = 0;
      if (state.border === before.border) state.border = false;
      thumbnail(); sync(); changed(); renderer?.setOpen(false);
      message(`${template.name} is ready. Your letter stays inside.`);
    } catch (error) { if (request === generation) errorMessage(error); }
    finally { if (request === generation) element('wedding-templates').setAttribute('aria-busy', 'false'); }
  });
}
element('upload').addEventListener('click', () => file.click());
file.addEventListener('change', () => { if (file.files?.[0]) void acceptPicture(file.files[0]); });
element('sample').addEventListener('click', () => {
  generation++; element('wedding-templates').setAttribute('aria-busy', 'false'); state.sample = (state.sample + 1) % 3; state.image = null; delete state.template; source = sampleArtwork(state.sample); thumbnail(); sync(); changed(); message('A fresh little design, just for you.');
});
amount.addEventListener('input', () => { state.amount = Number(amount.value); element('amount-value').textContent = `${state.amount}%`; changed(); });
gloss.addEventListener('input', () => {
  state.gloss = Number(gloss.value); element('gloss-value').textContent = `${state.gloss}%`;
  // Update only the photo material so dragging stays responsive.
  renderer?.updateGloss(state.gloss);
  if (shared) message('Your card has changed. Make a fresh link to share.');
});
border.addEventListener('change', () => { state.border = border.checked; changed(); });
element<HTMLInputElement>('target-colour').addEventListener('input', event => { state.target = (event.currentTarget as HTMLInputElement).value; changed(); });
element('surprise').addEventListener('click', () => {
  state.foil = Math.floor(Math.random() * foils.length); state.paper = Math.floor(Math.random() * 5);
  state.mode = Math.floor(Math.random() * 2); state.amount = 25 + Math.floor(Math.random() * 40); sync(); changed();
});
function updateLetter(): void {
  state.letter = letter.value; state.sender = sender.value; element('letter-count').textContent = `${state.letter.length} / 600`;
  renderer?.updateLetter(state); if (shared) message('Your letter has changed. Make a fresh link to share.');
}
letter.addEventListener('input', updateLetter); sender.addEventListener('input', updateLetter);
letter.addEventListener('focus', () => renderer?.setOpen(true));
element('read-letter').addEventListener('click', () => { renderer?.reset(); renderer?.setOpen(true); });
element('toggle-card').addEventListener('click', () => renderer?.setOpen(!opened));
element('reset-view').addEventListener('click', () => renderer?.reset());

let dragDepth = 0;
window.addEventListener('dragenter', event => { if (event.dataTransfer?.types.includes('Files')) { event.preventDefault(); dragDepth++; document.body.classList.add('dropping'); } });
window.addEventListener('dragover', event => { if (event.dataTransfer?.types.includes('Files')) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; } });
window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; document.body.classList.remove('dropping'); } });
window.addEventListener('drop', event => {
  event.preventDefault(); dragDepth = 0; document.body.classList.remove('dropping');
  const picture = event.dataTransfer?.files[0]; if (picture) void acceptPicture(picture);
});
window.addEventListener('paste', event => {
  const picture = Array.from(event.clipboardData?.items ?? []).find(item => item.type.startsWith('image/'))?.getAsFile();
  if (picture) { event.preventDefault(); void acceptPicture(picture); }
});
shareButton.addEventListener('click', () => {
  try {
    const snapshot: CardState = { ...state };
    const url = new URL(location.href); url.hash = `card=${encodeCard(snapshot)}`;
    element<HTMLInputElement>('share-url').value = url.href;
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
    element('share-note').textContent = local
      ? 'This preview runs on your computer. The link works here; sending it to someone else requires a published site.'
      : 'This link includes your picture and letter. Some messaging apps may reject long links. Shared pictures use a smaller resolution.';
    element('copy-link').textContent = 'Copy link'; dialog.showModal(); shared = true; message('Your card is ready to share.');
  } catch (error) { errorMessage(error); }
});
element('close-dialog').addEventListener('click', () => dialog.close());
element('copy-link').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(element<HTMLInputElement>('share-url').value); element('copy-link').textContent = 'Copied. Send a little joy. ✓'; }
  catch { element<HTMLInputElement>('share-url').select(); element('share-note').textContent = 'Copy was blocked. Select the link above and copy it manually.'; }
});
saveButton.addEventListener('click', async () => {
  if (!renderer) return; saveButton.disabled = true;
  try {
    // Flush pending slider edits before capturing the visible card.
    window.clearTimeout(updateTimer); renderer.update(state, source);
    const blob = await renderer.snapshot(), url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = 'a-little-wonder.png'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 10_000);
    message('Your picture is ready to save.');
  } catch (error) { errorMessage(error); }
  finally { saveButton.disabled = false; }
});

async function init(): Promise<void> {
  if (location.hash.startsWith('#card=')) {
    const request = ++generation;
    try {
      const restored = decodeCard(location.hash.slice(6));
      // Apply settings synchronously, before image decoding lets the user edit them.
      state = restored; sync(); document.body.classList.add('recipient');
      message(restored.sender ? `A little card from ${restored.sender}. Tap to look inside.` : 'Someone made this for you. Tap to look inside.');
      let next: HTMLCanvasElement;
      if (restored.image) {
        const image = await loadImage(restored.image); next = canvas(image.naturalWidth, image.naturalHeight); context(next).drawImage(image, 0, 0);
      } else if (restored.template) {
        const template = weddingTemplates.find(item => item.id === restored.template)!;
        next = await templateArtwork(template.file);
      } else next = sampleArtwork(restored.sample);
      // A newer upload/template owns the image; letter/settings edits already live in state.
      if (request === generation) source = next;
    } catch (error) { if (request === generation) errorMessage(error); }
  }
  sync(); thumbnail();
  try {
    const weddingPhoto = await loadImage(templateUrl('korean-wedding-portrait.png'));
    renderer = new CardRenderer(stage, next => {
      opened = next; stage.setAttribute('aria-pressed', String(next));
      element('toggle-card').textContent = next ? 'Close your card ↙' : 'Open your card ↗';
      document.querySelector('.stage-footer p')!.textContent = `Drag to turn it around · Tap to ${next ? 'close' : 'open'}`;
    }, text => { message(text, true); saveButton.disabled = true; }, weddingPhoto);
    renderer.update(state, source); element('loading').hidden = true;
  } catch (error) {
    element('loading').textContent = 'The 3D preview needs WebGL. Try a browser with hardware acceleration.';
    saveButton.disabled = true; errorMessage(error);
  }
}
void init();
if (import.meta.hot) import.meta.hot.dispose(() => { window.clearTimeout(updateTimer); renderer?.dispose(); });
