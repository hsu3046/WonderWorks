// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';

test('late native readiness preserves inactivity and ignores actions until resumed',async()=>{
  const messages=[],actions=[];let suspended=0,woken=0;
  globalThis.location={search:'?native=1'};
  globalThis.document={documentElement:{dataset:{}}};
  globalThis.window={__daniActive:false,webkit:{messageHandlers:{jelly:{postMessage:m=>messages.push(m)}}}};
  const bridge=await import('./native.js?native-test');
  bridge.connectNative({suspend:()=>suspended++,wake:()=>woken++,command:a=>actions.push(a)});
  assert.equal(suspended,1);assert.equal(woken,0);assert.equal(bridge.nativeActive(),false);
  window.daniJelly.command('reset');assert.deepEqual(actions,[]);
  window.daniJelly.setActive(true);window.daniJelly.command('knife');
  assert.equal(woken,1);assert.deepEqual(actions,['knife']);
  window.daniJelly.setActive(false);assert.equal(suspended,2);
  assert.deepEqual(messages,[{type:'ready'}]);
  assert.equal(document.documentElement.dataset.native,'true');
});

test('ordinary browser demos do not install the native shell or bridge',async()=>{
  globalThis.location={search:''};
  globalThis.document={documentElement:{dataset:{}}};globalThis.window={};
  const bridge=await import('./native.js?browser-test');
  bridge.connectNative({suspend:()=>assert.fail('suspended web demo'),wake(){},command(){}});
  assert.equal(bridge.nativeMode,false);assert.equal(bridge.nativeActive(),true);
  assert.equal(window.daniJelly,undefined);assert.deepEqual(document.documentElement.dataset,{});
});
