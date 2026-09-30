// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {monarchBehavior} from '../src/monarch-behavior.ts';

test('legs extend before contact, remain planted at rest, and fold after takeoff',()=>{
 const flight=monarchBehavior(5,0),approach=monarchBehavior(13.8,0),rest=monarchBehavior(17,0),departure=monarchBehavior(23,0);
 assert.equal(flight.legFold,1);assert.equal(flight.perchWeight,0);
 assert.equal(approach.state,'landing');assert.equal(approach.legFold,0);assert.ok(approach.perchWeight<1);
 assert.equal(rest.state,'resting');assert.equal(rest.legFold,0);assert.equal(rest.perchWeight,1);assert.equal(rest.wingActivity,0);
 assert.equal(departure.state,'taking-off');assert.equal(departure.legFold,1);assert.ok(departure.perchWeight<.3);
});
test('all pose channels remain continuous and bounded across multiple land/rest/launch cycles',()=>{
 for(let insect=0;insect<2;insect++){
  let last=monarchBehavior(0,insect);const states=new Set<string>();
  for(let n=1;n<=90000;n++){
   const pose=monarchBehavior(n/1000,insect);states.add(pose.state);
   for(const key of ['legFold','perchWeight','wingActivity'] as const){
    assert.ok(pose[key]>=0&&pose[key]<=1);assert.ok(Math.abs(pose[key]-last[key])<.005);
   }
   last=pose;
  }
  assert.equal(states.size,4);assert.ok(last.cycle>=3);
 }
 assert.equal(monarchBehavior(24017,0).state,'resting');
 assert.equal(monarchBehavior(24,0).cycle,1);
});
