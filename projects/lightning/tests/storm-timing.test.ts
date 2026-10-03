// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDischarge,random,pulse} from '../src/bolt.ts';
import {MAX_DISCHARGES,dischargeCount,initialAge,playbackRate,dischargeFinished} from '../src/storm-timing.ts';
test('bounded discharge mixture includes singles, pairs and occasional triples',()=>{
 const rand=random(92184),counts=[0,0,0];
 for(let i=0;i<1000;i++){
  const count=dischargeCount(rand());assert.ok(count>=1&&count<=MAX_DISCHARGES);counts[count-1]++;
 }
 assert.ok(counts[0]!>500&&counts[0]!<700);
 assert.ok(counts[1]!>250&&counts[1]!<420);
 assert.ok(counts[2]!>30&&counts[2]!<100);
});
test('independent leaders overlap visibly in both Natural and Fast without truncating long trains',()=>{
 const bolts=[1,5,12].map(seed=>createDischarge(seed,[seed*.1,4.5,0],[0,.77,0],.68));
 const ages=bolts.map((bolt,i)=>initialAge(bolt.leaderDuration,bolts[0]!.leaderDuration,i*.005,false));
 for(const fast of [false,true]){
  const rate=playbackRate(fast),elapsed=(bolts[0]!.leaderDuration+.015)/rate;
  bolts.forEach((bolt,i)=>assert.ok(pulse(ages[i]!+elapsed*rate,bolt)>.4));
  const end=Math.max(...bolts.map((bolt,i)=>bolt.strokes.at(-1)!.time+.45-ages[i]!));
  assert.ok(!bolts.every((bolt,i)=>dischargeFinished(bolt,ages[i]!+(end-.01)/rate*rate)));
  assert.ok(bolts.every((bolt,i)=>dischargeFinished(bolt,ages[i]!+(end+.01)/rate*rate)));
 }
 assert.equal(playbackRate(true),playbackRate(false)*2);
 bolts.forEach((bolt,i)=>assert.ok(pulse(initialAge(bolt.leaderDuration,bolts[0]!.leaderDuration,i*.005,true),bolt)>.8));
});
