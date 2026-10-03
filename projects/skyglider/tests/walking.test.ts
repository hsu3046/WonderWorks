// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc. https://www.aib.vote
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CLEARINGS,PERCH,CLIMB_DURATION,LAUNCH,runBranchTop} from '../src/landscape.ts';
import {FOOT_HEIGHT} from '../src/landing.ts';
import {renderedTerrainHeight} from '../src/terrain-surface.ts';
import {advanceWalk,createWalkState,walkingBranchPosition,walkable,WALK_SPEED} from '../src/walking.ts';
import {departurePosition} from '../src/departure.ts';

test('ground walking follows the visible dry terrain, respects frame time and normalizes diagonal speed',()=>{
  for(const site of CLEARINGS){
    const p={x:site.x,y:site.y+FOOT_HEIGHT,z:site.z},state=createWalkState();
    for(let i=0;i<180;i++){
      advanceWalk(state,p,1,.3,.7,1/60,false,[]);
      assert.ok(p.y>=renderedTerrainHeight(p.x,p.z)+FOOT_HEIGHT-.001);
      assert.ok(Number.isFinite(p.x+p.y+p.z+state.pitch+state.roll));
    }
    assert.ok(state.travel>4,'a landed squirrel must actually leave the touchdown point');
    const held={...p},phase=state.travel;advanceWalk(state,p,1,0,.7,0,false,[]);
    assert.deepEqual(p,held);assert.equal(state.travel,phase,'pause cannot advance feet');
  }
  const site=CLEARINGS[0]!,a={x:site.x,y:site.y+.72,z:site.z},b={...a},sa=createWalkState(),sb=createWalkState();
  for(let i=0;i<60;i++){advanceWalk(sa,a,1,0,0,1/60,false,[]);advanceWalk(sb,b,1,1,0,1/60,false,[]);}
  assert.ok(Math.abs(sa.travel-sb.travel)<1e-8);assert.ok(sa.speed<WALK_SPEED+.001);
});

test('walking stops before obstacles, cliffs and water and does not slide on key release',()=>{
  const site=CLEARINGS[0]!,p={x:site.x,y:site.y+.72,z:site.z},state=createWalkState(),obstacle={x:site.x,z:site.z-4,radius:1};
  for(let i=0;i<200;i++)advanceWalk(state,p,1,0,0,.05,false,[obstacle]);
  assert.ok(Math.hypot(p.x-obstacle.x,p.z-obstacle.z)>=1.95);assert.ok(state.blocked);
  const stopped={...p};for(let i=0;i<60;i++)advanceWalk(state,p,0,0,0,1/60,false,[]);
  assert.equal(p.x,stopped.x);assert.equal(p.z,stopped.z);assert.ok(state.gait<.001);
  assert.equal(walkable(380,-600,[]),false);assert.equal(walkable(-400,20,[]),false);
  // Heading toward the edge stays on gentle ground despite long held input.
  const edge={x:site.x,y:site.y+.72,z:site.z},se=createWalkState();
  for(let i=0;i<1200;i++)advanceWalk(se,edge,0,1,0,.05,false,[]);
  assert.ok(walkable(edge.x,edge.z,[]));assert.ok(se.travel<150);
});

test('bough walking stays on its support and takeoff begins at the walked position',()=>{
  const p={...PERCH},state=createWalkState();
  for(let i=0;i<200;i++)advanceWalk(state,p,1,0,0,.05,true,[]);
  assert.equal(state.branchDistance,6);assert.ok(Math.abs(p.y-runBranchTop(p.x,p.z)-.72)<1e-9);
  const start={...p},first=departurePosition(0,start),last=departurePosition(CLIMB_DURATION,start);
  assert.deepEqual([first.x,first.y,first.z],[start.x,start.y,start.z]);assert.deepEqual([last.x,last.y,last.z],[LAUNCH.x,LAUNCH.y,LAUNCH.z]);
  let previous=first;for(let t=.01;t<CLIMB_DURATION;t+=.01){const q=departurePosition(t,start);assert.ok(Math.hypot(q.x-previous.x,q.y-previous.y,q.z-previous.z)<.16);previous=q;}
  for(let i=0;i<200;i++)advanceWalk(state,p,-1,0,0,.05,true,[]);
  assert.equal(state.branchDistance,0);assert.deepEqual(p,PERCH);
  assert.deepEqual(walkingBranchPosition(999,{x:0,y:0,z:0}),start);
});
