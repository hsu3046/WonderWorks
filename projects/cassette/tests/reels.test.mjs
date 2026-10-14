// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cleanTitle,clamp,initialReels,packRadii,stepReels,PACK_MAX,PACK_MIN,MAX_TITLE,DEFAULT_TITLE} from '../src/settings.ts';
test('pack area is conserved while tape transfers',()=>{
 const start=packRadii(0),end=packRadii(1),mid=packRadii(.5);
 assert.equal(start.left,PACK_MAX);assert.equal(start.right,PACK_MIN);
 assert.equal(end.left.toFixed(9),PACK_MIN.toFixed(9));assert.equal(end.right.toFixed(9),PACK_MAX.toFixed(9));
 const sum=start.left**2+start.right**2;assert.ok(Math.abs(mid.left**2+mid.right**2-sum)<1e-9);
 assert.deepEqual(packRadii(5),end);assert.deepEqual(packRadii(-5),start);
});
test('the emptier reel spins faster and play turns both reels clockwise',()=>{
 const {reels}=stepReels({fraction:.2,angleLeft:0,angleRight:0},'play',.016);
 const {left,right}=packRadii(.2);
 const turnedLeft=Math.PI*2-reels.angleLeft,turnedRight=Math.PI*2-reels.angleRight;
 assert.ok(turnedLeft>0&&turnedRight>0,'both reels advanced');
 assert.ok(Math.abs(turnedRight/turnedLeft-left/right)<1e-6,'angular speeds are inverse to pack radius');
 assert.ok(reels.fraction>.2,'play winds tape onto the right reel');
});
test('rewind runs the tape backwards and stop leaves everything in place',()=>{
 const base={fraction:.5,angleLeft:1,angleRight:2};
 const rewind=stepReels(base,'rewind',.05);
 assert.ok(rewind.reels.fraction<.5);assert.ok(rewind.reels.angleLeft>1&&rewind.reels.angleRight>2);
 assert.equal(rewind.transport,'rewind');assert.equal(rewind.reversed,false);
 assert.deepEqual(stepReels(base,'stop',.05),{reels:base,transport:'stop',reversed:false});
 assert.deepEqual(stepReels(base,'play',Number.NaN),{reels:base,transport:'play',reversed:false});
 assert.deepEqual(stepReels(base,'play',-1),{reels:base,transport:'play',reversed:false});
});
test('reaching either end of the tape auto-reverses the transport',()=>{
 let state=initialReels(),transport='rewind',reversed=false;
 for(let i=0;i<400&&!reversed;i++){const step=stepReels(state,transport,.05);state=step.reels;transport=step.transport;reversed=step.reversed;}
 assert.equal(reversed,true);assert.equal(transport,'play');assert.equal(state.fraction,0);
 let forward=false;for(let i=0;i<4000&&!forward;i++){const step=stepReels(state,transport,.05);state=step.reels;transport=step.transport;forward=step.reversed;}
 assert.equal(forward,true);assert.equal(transport,'rewind');assert.equal(state.fraction,1);
 // Large frame gaps are capped so a background tab cannot jump the tape.
 const jump=stepReels({fraction:.5,angleLeft:0,angleRight:0},'play',30);
 assert.ok(jump.reels.fraction<.51);
});
test('titles are trimmed, bounded and free of control characters',()=>{
 assert.equal(cleanTitle('  Night'+String.fromCodePoint(0)+'  Drive'+String.fromCodePoint(0x200b)+'  '),'Night Drive');
 assert.equal(cleanTitle('x'.repeat(80)).length,MAX_TITLE);
 assert.equal(cleanTitle('\n\t'),DEFAULT_TITLE);
 assert.equal(cleanTitle('a'.repeat(MAX_TITLE-1)+' b'),'a'.repeat(MAX_TITLE-1));
 assert.equal(clamp(5,0,1),1);assert.equal(clamp(-5,0,1),0);assert.equal(clamp(.5,0,1),.5);
});
