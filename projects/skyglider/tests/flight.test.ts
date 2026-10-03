// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc. https://www.aib.vote
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CatmullRomCurve3,Quaternion,Vector3} from 'three';
import {PERCH,LAUNCH,CLIMB_DURATION,CLIMB_TOP,CLIMB_TRUNK,TOP_BRANCH,ROUTE,RUN_BRANCH,BRANCH_CLEARANCE,branchTop,terrainHeight} from '../src/landscape.ts';
import {CLIMB_SIDE_AT,CLIMB_TOP_AT,RELEASE_AT,DEPARTURE_EXIT_VELOCITY,departurePosition,departureOrientation} from '../src/departure.ts';

test('entire guided route clears the terrain, including between control points',()=>{
  const path=new CatmullRomCurve3(ROUTE.map(p=>new Vector3(...p)),false,'centripetal');path.arcLengthDivisions=400;path.updateArcLengths();
  let minimum=Infinity;const p=new Vector3();
  for(let i=0;i<=2000;i++){
    path.getPointAt(i/2000,p);const clearance=p.y-terrainHeight(p.x,p.z);minimum=Math.min(minimum,clearance);
    assert.ok(Number.isFinite(clearance));assert.ok(clearance>3,`unsafe route at ${i/2000}: clearance ${clearance}`);
  }
  assert.ok(minimum<40,'route must stay near scenery rather than bypassing it from far above');
});

test('approach, climbing, takeoff and home share exact handoff positions',()=>{
  const start=ROUTE[0]!,end=ROUTE[ROUTE.length-1]!;
  const first=departurePosition(0),last=departurePosition(CLIMB_DURATION);
  assert.deepEqual([first.x,first.y,first.z],[PERCH.x,PERCH.y,PERCH.z]);
  assert.deepEqual([last.x,last.y,last.z],start);assert.deepEqual(start,[LAUNCH.x,LAUNCH.y,LAUNCH.z]);
  assert.deepEqual(end,[PERCH.x,PERCH.y,PERCH.z]);
  let previous=first;for(let t=.01;t<=CLIMB_DURATION;t+=.01){const p=departurePosition(t);assert.ok(Math.hypot(p.x-previous.x,p.y-previous.y,p.z-previous.z)<.16);assert.ok(p.y>terrainHeight(p.x,p.z)+3);previous=p;}
});

test('the terrain is finite at edges and spans both water and elevated ground',()=>{
  let low=Infinity,high=-Infinity;
  for(let z=-645;z<=205;z+=7.5)for(let x=-400;x<=400;x+=7.5){const y=terrainHeight(x,z);assert.ok(Number.isFinite(y));low=Math.min(low,y);high=Math.max(high,y);}
  assert.ok(low<0&&low>-20);assert.ok(high>100&&high<125);
});

test('the running start follows the rendered branch surface between bounds',()=>{
  const a=new Vector3(...RUN_BRANCH.a),b=new Vector3(...RUN_BRANCH.b),axis=b.clone().sub(a),length=axis.length();axis.normalize();
  for(let i=0;i<=140;i++){
    const p=departurePosition(i/100),foot=new Vector3(p.x,p.y-BRANCH_CLEARANCE,p.z).sub(a),along=foot.dot(axis),radius=RUN_BRANCH.rootRadius+(RUN_BRANCH.tipRadius-RUN_BRANCH.rootRadius)*along/length;
    assert.ok(along>0&&along<length);assert.ok(Math.abs(foot.addScaledVector(axis,-along).length()-radius)<1e-9,'feet must meet the branch instead of following an unrelated floating arc');
  }
});

test('push-off gathers at the trunk and joins the tour without position, velocity or orientation jumps',()=>{
  const epsilon=1e-5,point=(t:number)=>{const p=departurePosition(t);return new Vector3(p.x,p.y,p.z);};
  const top=point(CLIMB_TOP_AT),gather=point((CLIMB_TOP_AT+RELEASE_AT)/2),release=point(RELEASE_AT);
  assert.ok(gather.y<top.y-.05);assert.ok(Math.abs(release.y-top.y+.12)<1e-10);assert.equal(release.x,top.x);assert.equal(release.z,top.z);
  assert.ok(point(RELEASE_AT+.35).x>release.x+.4,'push off into the open side of the trunk before pitching into flight');
  for(const t of [2.4,CLIMB_SIDE_AT,CLIMB_TOP_AT,RELEASE_AT]){
    const before=point(t).sub(point(t-epsilon)).divideScalar(epsilon),after=point(t+epsilon).sub(point(t)).divideScalar(epsilon);
    assert.ok(before.distanceTo(after)<.002,`continuous velocity at stage ${t}`);
  }
  const exit=point(CLIMB_DURATION).sub(point(CLIMB_DURATION-epsilon)).divideScalar(epsilon);
  assert.ok(exit.distanceTo(DEPARTURE_EXIT_VELOCITY)<.002,'do not stop and teleport into the moving flight route');
  const q=new Quaternion(),previous=departureOrientation(0,new Quaternion());
  for(let t=.01;t<=CLIMB_DURATION;t+=.01){departureOrientation(t,q);assert.ok(previous.angleTo(q)<.14,'no abrupt facing flip');previous.copy(q);}
  const heading=DEPARTURE_EXIT_VELOCITY.clone().normalize(),forward=new Vector3(0,0,-1).applyQuaternion(departureOrientation(CLIMB_DURATION,q));
  assert.ok(Math.abs(forward.x-heading.x)<.01&&Math.abs(forward.z-heading.z)<.01);
  assert.equal(departurePosition(CLIMB_DURATION).spread,1);assert.equal(departurePosition(CLIMB_DURATION).climbing,0);
});

test('the squirrel mounts the highest bough and gathers on its surface before taking flight',()=>{
  const top=departurePosition(CLIMB_TOP_AT),gather=departurePosition(RELEASE_AT-.1),q=departureOrientation(CLIMB_TOP_AT,new Quaternion());
  assert.ok(top.y-BRANCH_CLEARANCE>CLIMB_TRUNK.b[1],'reach the tree crown, not a point midway up the trunk');
  assert.ok(Math.abs(top.y-branchTop(TOP_BRANCH,top.x,top.z)-BRANCH_CLEARANCE)<1e-9);
  assert.deepEqual([top.x,top.y,top.z],[CLIMB_TOP.x,CLIMB_TOP.y,CLIMB_TOP.z]);
  assert.equal(top.climbing,0);assert.equal(top.ground,1);assert.equal(top.spread,0);
  assert.equal(gather.spread,0);assert.equal(gather.gait,0);
  assert.ok(new Vector3(0,1,0).applyQuaternion(q).y>.99,'stand above the bough before gathering');
});
