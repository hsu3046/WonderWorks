// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultState, validateState, encodeCard, decodeCard, foilMask } from '../src/state.ts';

test('shared card preserves Unicode, literal replacement tokens, settings and image', () => {
  const state = { ...defaultState(), letter: '반짝이는 하루 🌸\n$& <script>hello</script>', sender: 'AIB', foil: 5, image: 'data:image/jpeg;base64,YWJj' };
  assert.deepEqual(decodeCard(encodeCard(state)), state);
});
test('untrusted link content rejects script images, oversized content and invalid indexes', () => {
  for (const value of [{ image: 'data:image/svg+xml,<script/>' }, { letter: 'x'.repeat(601) }, { foil: -1 }, { shape: 9 }, { amount: Infinity }, { sample: .5 }, { target: 'red' }, { border: 'true' }, { version: 2 }]) {
    assert.throws(() => validateState({ ...defaultState(), ...value }));
  }
});
test('malformed and oversized links fail safely', () => {
  for (const value of ['', '%%%%', 'a'.repeat(140_001), btoa('{"version":1}')]) assert.throws(() => decodeCard(value));
});
test('zero foil amount leaves the printed image unmasked in every mode', () => {
  const pixels = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]);
  for (const mode of [0, 1, 2]) {
    const mask = foilMask(pixels, 2, 1, { ...defaultState(), mode, amount: 0 });
    assert.equal(mask[0], 0); assert.equal(mask[4], 0);
  }
});
test('shadow selection masks dark pixels while preserving white paper', () => {
  const mask = foilMask(new Uint8ClampedArray([10, 10, 10, 255, 255, 255, 255, 255]), 2, 1, { ...defaultState(), mode: 1 });
  assert.equal(mask[0], 255); assert.equal(mask[4], 0);
});
test('colour selection follows target and mask remains finite at one-pixel boundaries', () => {
  const mask = foilMask(new Uint8ClampedArray([255, 0, 0, 255]), 1, 1, { ...defaultState(), mode: 2, target: '#ff0000' });
  assert.equal(mask[0], 255); assert.equal(mask[3], 255);
  const off = foilMask(new Uint8ClampedArray([0, 255, 0, 255]), 1, 1, { ...defaultState(), mode: 2, target: '#ff0000' });
  assert.equal(off[0], 0);
});

test('wedding template links round-trip without image payloads and old links remain compatible', () => {
  for (const template of ['wedding-garden', 'wedding-toile', 'wedding-celestial']) {
    const state = { ...defaultState(), template, letter: '우리의 결혼을 축하하며 🌸' };
    assert.deepEqual(decodeCard(encodeCard(state)), state);
    assert.ok(encodeCard(state).length < 700);
  }
  assert.deepEqual(decodeCard(encodeCard(defaultState())), defaultState());
  assert.throws(() => validateState({ ...defaultState(), template: '../../private' }));
  assert.throws(() => validateState({ ...defaultState(), template: 'wedding-garden', image: 'data:image/jpeg;base64,YWJj' }));
});


test('photo gloss persists, accepts endpoints and defaults older links to the original finish', () => {
  const { gloss, ...legacy } = defaultState();
  assert.equal(decodeCard(btoa(JSON.stringify(legacy)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')).gloss, 65);
  for (const value of [0, 65, 100]) assert.equal(decodeCard(encodeCard({ ...defaultState(), gloss: value })).gloss, value);
  for (const value of [-1, 101, .5, null, '65']) assert.throws(() => validateState({ ...defaultState(), gloss: value }));
});
