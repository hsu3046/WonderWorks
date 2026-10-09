import test from 'node:test';
import assert from 'node:assert/strict';
import {palettes,defaults,normalizeUrl,matrixFor,restore,fragment} from '../src/state.ts';
import {qrPixels,verifyPixels} from '../src/qr.ts';
test('floral export decodes to the actual URL across all palettes and Unicode content',()=>{
  for(const raw of ['https://www.aib.vote/','https://example.com/우리의-결혼?letter=꽃과 사랑','https://example.com/'+ 'a'.repeat(140)]){
    const url=normalizeUrl(raw);for(let palette=0;palette<palettes.length;palette++)assert.equal(verifyPixels(qrPixels(url,palette,12),url),true);
  }
});
test('settings round trip, URL validation and bounded QR size',()=>{
  const state={...defaults(),template:3,palette:4,wind:false};assert.deepEqual(restore(fragment(state)),state);
  assert.equal(normalizeUrl('example.com'),'https://example.com/');
  for(const value of ['', 'javascript:alert(1)','https://user:pass@example.com','https://example.com/'+ 'a'.repeat(190)])assert.throws(()=>normalizeUrl(value));
  assert.throws(()=>restore('template=9'));assert.throws(()=>restore('palette=5'));assert.ok(matrixFor(state.url).size>=21);
});
