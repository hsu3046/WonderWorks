// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc. https://www.aib.vote
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CatmullRomCurve3,Vector3} from 'three';
import {CLEARINGS,ROUTE,terrainHeight} from '../src/landscape.ts';
import {FOOT_HEIGHT,landingPosition,planLanding} from '../src/landing.ts';
import {GLIDER_SCALE,STRIDE,stepPose} from '../src/glider-pose.ts';

test('landing from the whole tour, including steering offsets, remains above terrain and ends on dry level ground',()=>{
  const route=new CatmullRomCurve3(ROUTE.map(p=>new Vector3(...p)),false,'centripetal');route.arcLengthDivisions=400;route.updateArcLengths();
  const start=new Vector3(),heading=new Vector3(),side=new Vector3(),p={x:0,y:0,z:0};
  for(let i=0;i<=80;i++)for(const offset of [-18,0,18]){
    route.getPointAt(i/80,start);route.getTangentAt(i/80,heading);side.set(-heading.z,0,heading.x).normalize();start.addScaledVector(side,offset);
    start.y=Math.max(start.y-15,terrainHeight(start.x,start.z)+4);
    const plan=planLanding(start,heading);landingPosition(plan,0,p);assert.deepEqual(p,{x:start.x,y:start.y,z:start.z});
    for(let j=0;j<=500;j++){
      landingPosition(plan,j/500,p);assert.ok(p.y-terrainHeight(p.x,p.z)>=FOOT_HEIGHT-.02,`terrain intersection at route=${i/80}, offset=${offset}, landing=${j/500}`);
      assert.ok(Number.isFinite(p.x+p.y+p.z));
    }
    assert.ok(Math.hypot(p.x-plan.end.x,p.y-plan.end.y,p.z-plan.end.z)<1e-8);
    assert.ok(plan.end.y>10);assert.ok(plan.duration>=5&&plan.duration<=17);
    const end={...p};landingPosition(plan,1-1e-4,p);assert.ok(Math.abs(p.y-end.y)<.001,'flare must approach zero vertical speed');
  }
});

test('landing pads keep feet and the surrounding camera on level terrain',()=>{
  for(const site of CLEARINGS)for(let x=-2;x<=2;x+=.5)for(let z=-2;z<=2;z+=.5)assert.equal(terrainHeight(site.x+x,site.z+z),site.y);
});

test('a planted climbing foot cancels forward movement, then lifts and returns without a pose discontinuity',()=>{
  const start=.1*STRIDE,end=.6*STRIDE;
  const a=stepPose(start,0),b=stepPose(end,0);
  assert.equal(a.release,0);assert.equal(b.release,0);
  assert.ok(Math.abs((end-b.stroke*GLIDER_SCALE)-(start-a.stroke*GLIDER_SCALE))<1e-10);
  assert.ok(stepPose(.86*STRIDE,0).release>.99);
  const before=stepPose(STRIDE-1e-6,0),after=stepPose(STRIDE+1e-6,0);
  assert.ok(Math.abs(before.stroke-after.stroke)<1e-5);assert.ok(Math.abs(before.release-after.release)<1e-4);
});
