// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {localSchooling} from '../src/fish-school.ts';
test('schooling respects distance, depth and rear blind spot',()=>{
 for(const other of [[4,0,0,0],[1,1,0,0],[-1,0,0,0]]){
  assert.deepEqual(localSchooling(0,new Float64Array([0,0,0,0,...other]),{x:0,z:0}),{x:0,z:0});
 }
});
test('nearby fish align weakly and remain below the steering cap',()=>{
 const poses=new Float64Array([0,-1,0,0,1,-1,.3,Math.PI/2]);
 const result=localSchooling(0,poses,{x:0,z:0});assert.ok(result.x>0&&result.z>0);assert.ok(Math.hypot(result.x,result.z)<=.18+1e-10);
 assert.deepEqual(localSchooling(0,poses,{x:0,z:0}),result);
});
