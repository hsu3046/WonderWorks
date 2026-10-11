// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {imageAddress,region} from '../src/settings.ts';
import {remoteImage,MAX_BYTES,decode} from '../src/image.ts';
test('image addresses reject local schemes and embedded credentials',()=>{
  for(const address of ['javascript:alert(1)','data:image/png,a','file:///tmp/image.png','https://name:secret@example.com/a.png','not a url'])assert.throws(()=>imageAddress(address));
  assert.equal(imageAddress(' https://example.com/a.png?q=hi#fragment '),'https://example.com/a.png?q=hi#fragment');
});
test('crossing artwork handles keeps a nonempty region inside the image',()=>{
  for(const values of [[.9,.1,.95,.1],[-1,2,-1,2],[.2,.8,.1,.9]]){
    const [l,t,r,b]=region(...values);assert.ok(l>=0&&t>=0&&r<=1&&b<=1&&r>l&&b>t);
  }
});
test('local uploads fail before decoding empty, oversized and non-image data',async()=>{
  await assert.rejects(decode(new Blob([])),/empty/);
  await assert.rejects(decode(new Blob([new Uint8Array(MAX_BYTES+1)])),/20 MB/);
  await assert.rejects(decode(new Blob(['<svg/>'],{type:'image/svg+xml'})),/Choose/);
});
test('remote images omit credentials and preserve image bytes',async(t)=>{
  const data=new Uint8Array([1,2,3,4]);let options;
  t.mock.method(globalThis,'fetch',async(_url,o)=>{options=o;return new Response(data,{headers:{'content-type':'image/png'}});});
  const signal=new AbortController().signal;const blob=await remoteImage('https://example.com/card.png',signal);
  assert.deepEqual(new Uint8Array(await blob.arrayBuffer()),data);assert.equal(blob.type,'image/png');assert.equal(options.credentials,'omit');assert.equal(options.mode,'cors');assert.equal(options.referrerPolicy,'no-referrer');assert.equal(options.signal,signal);
});
test('oversized streaming responses are cancelled even without content-length',async(t)=>{
  let cancelled=false;
  t.mock.method(globalThis,'fetch',async()=>new Response(new ReadableStream({pull(c){c.enqueue(new Uint8Array(11*1024*1024));},cancel(){cancelled=true;}}),{headers:{'content-type':'image/png'}}));
  await assert.rejects(remoteImage('https://example.com/large',new AbortController().signal),/20 MB/);assert.equal(cancelled,true);
});
test('HTTP failure and aborted requests never resolve as an image',async(t)=>{
  t.mock.method(globalThis,'fetch',async()=>new Response('missing',{status:404}));
  await assert.rejects(remoteImage('https://example.com/nope',new AbortController().signal),/404/);
  t.mock.method(globalThis,'fetch',async()=>{throw new DOMException('Aborted','AbortError');});
  await assert.rejects(remoteImage('https://example.com/slow',new AbortController().signal),{name:'AbortError'});
});
