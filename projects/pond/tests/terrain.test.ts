// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {terrainHeight} from '../src/terrain.ts';

test('pond rim joins the lawn continuously around the full shoreline',()=>{
 for(let i=0;i<128;i++){
  const a=i*Math.PI/64,x=Math.cos(a)*10,z=Math.sin(a)*7.5;
  assert.ok(Math.abs(terrainHeight(x,z)-.25)<1e-6);
  assert.ok(Math.abs(terrainHeight(x*.9999,z*.9999)-terrainHeight(x*1.0001,z*1.0001))<.002);
 }
});
test('the reported low-angle camera has solid ground and underwater views retain bed clearance',()=>{
 assert.equal(terrainHeight(-14.114799,29.574339),.25);
 assert.ok(terrainHeight(0,0)<-1.5);
 assert.ok(terrainHeight(0,5.7)+.22<-.58,'Dive camera remains above the bed');
});
