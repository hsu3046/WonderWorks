import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sequenceFrame,transitionDuration,sequenceDuration,sequenceModes} from '../src/sequence.ts';

test('all five geometric transitions have bounded morph weights, including wave to columns',()=>{
 const pairs=sequenceModes.map((mode,i)=>[mode,sequenceModes[(i+1)%sequenceModes.length]]);
 pairs.forEach(([from,to],i)=>{
  const mid=sequenceFrame(i*5+5-transitionDuration/2);
  assert.equal(mid.from,from);assert.equal(mid.to,to);
  assert.ok(Math.abs(mid.blend-.5)<1e-12);
  assert.ok(mid.toTime<0,'incoming animation is already moving before the boundary');
 });
 for(let t=-25;t<50;t+=.01){const s=sequenceFrame(t);assert.ok(s.blend>=0&&s.blend<=1);}
});

test('incoming motion time pass continuously through each scene boundary',()=>{
 const epsilon=1e-5;
 for(const boundary of [5,10,15,20,25,30,35,40,45,50]){
  const before=sequenceFrame(boundary-epsilon),after=sequenceFrame(boundary+epsilon);
  assert.equal(before.to,after.from);
  assert.ok(Math.abs(after.fromTime-before.toTime-2*epsilon)<1e-12);
  assert.ok(before.blend>1-1e-12);assert.equal(after.blend,0);
 }
});

test('blend starts and ends gently, and the whole composition repeats every 25 seconds',()=>{
 for(const offset of [0,5,10,15,20]){
  assert.equal(sequenceFrame(offset+3.4-1e-5).blend,0);
  assert.ok(sequenceFrame(offset+3.4+1e-5).blend<1e-12);
  assert.ok(sequenceFrame(offset+5-1e-5).blend>1-1e-12);
 }
 for(let t=0;t<sequenceDuration;t+=.125){
  const a=sequenceFrame(t),b=sequenceFrame(t+sequenceDuration);
  assert.equal(a.from,b.from);assert.equal(a.to,b.to);
  assert.ok(Math.abs(a.fromTime-b.fromTime)<1e-12);
  assert.ok(Math.abs(a.blend-b.blend)<1e-12);
 }
});
