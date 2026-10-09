// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { defaultState } from '../src/state.ts';

// Execute the actual handlers with small host doubles; no GPU or browser needed.
function compiled(name) {
  return stripTypeScriptTypes(readFileSync(new URL(`../src/${name}.ts`, import.meta.url), 'utf8'), { mode: 'transform' });
}
const renderer = compiled('renderer');
const down = new Function(`return (${renderer.slice(renderer.indexOf('down = ') + 7, renderer.indexOf('    move = ')).trim().replace(/;$/, '')});`);

test('a missed touch released outside does not poison the next card gesture', () => {
  const captured = new Set();
  const host = { gestures: new Set(), pointer: null, hit: e => e.hit,
    host: { setPointerCapture: id => captured.add(id) },
    target: { copy() {} }, root: { quaternion: {} } };
  const handler = down.call(host);
  handler({ pointerId: 1, button: 0, hit: false });
  assert.equal(host.gestures.size, 0);
  handler({ pointerId: 2, button: 0, hit: true, clientX: 4, clientY: 5 });
  assert.equal(host.pointer.id, 2);
  assert.deepEqual([...captured], [2]);
  handler({ pointerId: 3, button: 0, hit: true });
  assert.equal(host.pointer, null);
  assert.deepEqual([...captured], [2, 3]);
});

const main = compiled('main');
const initSource = main.slice(main.indexOf('async function init()'), main.indexOf('void init();'));
function pendingRestore() {
  let resolve;
  const image = new Promise(done => { resolve = done; });
  const restored = { ...defaultState(), template: 'wedding-celestial', letter: 'Original' };
  const env = { location: { hash: '#card=test' }, generation: 0, state: defaultState(), source: 'initial',
    decodeCard: () => restored, sync() {}, document: { body: { classList: { add() {} } } }, message() {},
    weddingTemplates: [{ id: 'wedding-celestial', file: 'cover.png' }], templateArtwork: () => image,
    thumbnail() {}, loadImage: async () => ({}), templateUrl: x => x, stage: {}, renderer: null,
    element: () => ({}), saveButton: {}, errorMessage: e => { throw e; },
    CardRenderer: class { update(state, source) { env.rendered = { letter: state.letter, source }; } } };
  const run = new Function('env', `with (env) { return (${initSource})(); }`)(env);
  return { env, resolve, run };
}
test('editing the letter during shared artwork decoding survives restoration', async () => {
  const { env, resolve, run } = pendingRestore();
  assert.equal(env.state.letter, 'Original');
  env.state.letter = 'New words';
  resolve('shared cover'); await run;
  assert.deepEqual(env.rendered, { letter: 'New words', source: 'shared cover' });
});
test('a newer picture selection wins over pending shared artwork decoding', async () => {
  const { env, resolve, run } = pendingRestore();
  env.generation++; env.source = 'new upload'; env.state = { ...env.state, template: undefined, image: 'new image' };
  resolve('old shared cover'); await run;
  assert.equal(env.rendered.source, 'new upload');
  assert.equal(env.state.image, 'new image');
});
